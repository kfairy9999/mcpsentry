import ts from 'typescript';

import type { ExtractedTool, ToolAnnotations, ToolParameter } from '../types.js';
import { isSensitiveName, isUnconstrainedSchema } from './sensitive.js';

const TOOL_METHODS = new Set(['registerTool', 'tool', 'addTool']);

interface ConstObject {
  annotations?: ToolAnnotations;
  text: string;
}

export function extractToolsFromTypeScript(relativePath: string, content: string): ExtractedTool[] {
  const source = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const constObjects = collectConstObjects(source);
  const tools: ExtractedTool[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isToolCall(node)) {
      const extracted = extractFromCall(node, source, relativePath, constObjects);
      if (extracted) {
        tools.push(extracted);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return tools;
}

function isToolCall(node: ts.CallExpression): boolean {
  const expr = node.expression;
  if (ts.isPropertyAccessExpression(expr) && TOOL_METHODS.has(expr.name.text)) {
    return true;
  }
  return ts.isIdentifier(expr) && TOOL_METHODS.has(expr.text);
}

function extractFromCall(
  node: ts.CallExpression,
  source: ts.SourceFile,
  relativePath: string,
  constObjects: Map<string, ConstObject>,
): ExtractedTool | undefined {
  const args = node.arguments;
  if (args.length < 1) {
    return undefined;
  }
  const nameArg = args[0];
  if (!nameArg) {
    return undefined;
  }
  const name = stringLiteral(nameArg);
  if (!name) {
    return undefined;
  }

  let description = '';
  let annotations: ToolAnnotations | undefined;
  let annotationsText = '';
  let hasInputSchema = false;
  const parameters: ToolParameter[] = [];
  let handler: ts.Expression | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      if (!description) {
        description = arg.text;
      }
      continue;
    }
    if (isFunctionLike(arg)) {
      handler = arg;
      continue;
    }
    if (ts.isObjectLiteralExpression(arg) || ts.isIdentifier(arg) || ts.isAsExpression(arg)) {
      const obj = unwrap(arg);
      if (ts.isIdentifier(obj)) {
        const resolved = constObjects.get(obj.text);
        if (resolved?.annotations && !looksLikeConfig(arg, constObjects)) {
          annotations = { ...resolved.annotations };
          annotationsText = resolved.text;
        }
      }
      if (ts.isObjectLiteralExpression(obj)) {
        const parsed = parseConfigObject(obj, source, constObjects);
        if (parsed.description) {
          description = parsed.description;
        }
        if (parsed.annotations) {
          annotations = parsed.annotations;
          annotationsText = parsed.annotationsText;
        }
        if (parsed.hasInputSchema) {
          hasInputSchema = true;
          parameters.push(...parsed.parameters);
        }
        // A bare zod-like object used as a schema (older server.tool API).
        if (!parsed.isConfig && parsed.parameters.length > 0) {
          hasInputSchema = true;
          parameters.push(...parsed.parameters);
        }
      }
    }
  }

  // If a later object looked like a schema-only argument.
  if (!hasInputSchema) {
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (!arg || isFunctionLike(arg)) {
        continue;
      }
      const obj = unwrap(arg);
      if (ts.isObjectLiteralExpression(obj) && objectLooksLikeSchema(obj)) {
        hasInputSchema = true;
        parameters.push(...schemaProperties(obj, source));
      }
    }
  }

  const handlerText = handler ? handler.getText(source) : '';
  const handlerParamNames = handler ? parameterNames(handler) : [];
  const { line: startLine } = source.getLineAndCharacterOfPosition(node.getStart(source));
  const { line: endLine } = source.getLineAndCharacterOfPosition(node.getEnd());

  return {
    name,
    description,
    file: relativePath,
    startLine: startLine + 1,
    endLine: endLine + 1,
    annotations,
    annotationsText,
    parameters: uniqueParameters(parameters),
    hasInputSchema,
    handlerText,
    handlerParamNames,
    language: 'typescript',
  };
}

function looksLikeConfig(arg: ts.Expression, constObjects: Map<string, ConstObject>): boolean {
  const obj = unwrap(arg);
  if (ts.isIdentifier(obj)) {
    return constObjects.has(obj.text);
  }
  return ts.isObjectLiteralExpression(obj) && objectLooksLikeConfig(obj);
}

interface ParsedConfig {
  description: string;
  annotations: ToolAnnotations | undefined;
  annotationsText: string;
  hasInputSchema: boolean;
  parameters: ToolParameter[];
  isConfig: boolean;
}

function parseConfigObject(
  obj: ts.ObjectLiteralExpression,
  source: ts.SourceFile,
  constObjects: Map<string, ConstObject>,
): ParsedConfig {
  let description = '';
  let annotations: ToolAnnotations | undefined;
  let annotationsText = '';
  let hasInputSchema = false;
  const parameters: ToolParameter[] = [];
  let isConfig = false;

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) || !propertyName(prop)) {
      continue;
    }
    const key = propertyName(prop);
    if (key === 'description' || key === 'title') {
      isConfig = true;
      const value = stringLiteral(prop.initializer);
      if (value && key === 'description') {
        description = value;
      }
    }
    if (key === 'annotations') {
      isConfig = true;
      const resolved = resolveAnnotations(prop.initializer, source, constObjects);
      annotations = resolved.annotations;
      annotationsText = resolved.text;
    }
    if (key === 'inputSchema' || key === 'schema' || key === 'parameters') {
      isConfig = true;
      hasInputSchema = true;
      parameters.push(...schemaFromExpression(prop.initializer, source, constObjects));
    }
  }

  if (!isConfig && objectLooksLikeSchema(obj)) {
    parameters.push(...schemaProperties(obj, source));
  }

  return { description, annotations, annotationsText, hasInputSchema, parameters, isConfig };
}

function resolveAnnotations(
  expr: ts.Expression,
  source: ts.SourceFile,
  constObjects: Map<string, ConstObject>,
): { annotations: ToolAnnotations | undefined; text: string } {
  const unwrapped = unwrap(expr);
  if (ts.isIdentifier(unwrapped)) {
    const resolved = constObjects.get(unwrapped.text);
    if (resolved) {
      return { annotations: resolved.annotations, text: resolved.text };
    }
  }
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return {
      annotations: annotationsFromObject(unwrapped, constObjects),
      text: unwrapped.getText(source),
    };
  }
  return { annotations: undefined, text: expr.getText(source) };
}

function annotationsFromObject(
  obj: ts.ObjectLiteralExpression,
  constObjects?: Map<string, ConstObject>,
): ToolAnnotations {
  const annotations: ToolAnnotations = {};
  for (const prop of obj.properties) {
    if (ts.isSpreadAssignment(prop)) {
      const inner = unwrap(prop.expression);
      if (ts.isIdentifier(inner) && constObjects) {
        const resolved = constObjects.get(inner.text);
        if (resolved?.annotations) {
          Object.assign(annotations, resolved.annotations);
        }
      } else if (ts.isObjectLiteralExpression(inner)) {
        Object.assign(annotations, annotationsFromObject(inner, constObjects));
      }
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }
    const key = propertyName(prop);
    if (
      key === 'readOnlyHint' ||
      key === 'destructiveHint' ||
      key === 'idempotentHint' ||
      key === 'openWorldHint'
    ) {
      const value = booleanLiteral(prop.initializer);
      if (value !== undefined) {
        annotations[key] = value;
      }
    }
  }
  return annotations;
}

function schemaFromExpression(
  expr: ts.Expression,
  source: ts.SourceFile,
  constObjects: Map<string, ConstObject>,
): ToolParameter[] {
  const unwrapped = unwrap(expr);
  if (ts.isIdentifier(unwrapped)) {
    const resolved = constObjects.get(unwrapped.text);
    if (resolved) {
      return [];
    }
    // Imported schemas are present but not expanded; treat as a schema that exists.
    return [];
  }
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return schemaProperties(unwrapped, source);
  }
  if (ts.isCallExpression(unwrapped)) {
    const text = unwrapped.getText(source);
    // z.object({ ... })
    const objectArg = unwrapped.arguments[0];
    if (objectArg && ts.isObjectLiteralExpression(unwrap(objectArg))) {
      return schemaProperties(unwrap(objectArg) as ts.ObjectLiteralExpression, source);
    }
    if (/z\.object\s*\(/.test(text)) {
      return [];
    }
  }
  return [];
}

function schemaProperties(obj: ts.ObjectLiteralExpression, source: ts.SourceFile): ToolParameter[] {
  const parameters: ToolParameter[] = [];
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }
    const name = propertyName(prop);
    if (!name) {
      continue;
    }
    const schemaText = prop.initializer.getText(source);
    parameters.push({
      name,
      schemaText,
      unconstrained: isUnconstrainedSchema(schemaText),
      sensitive: isSensitiveName(name),
    });
  }
  return parameters;
}

function objectLooksLikeConfig(obj: ts.ObjectLiteralExpression): boolean {
  return obj.properties.some((prop) => {
    const key = ts.isPropertyAssignment(prop) ? propertyName(prop) : undefined;
    return (
      key === 'description' ||
      key === 'title' ||
      key === 'annotations' ||
      key === 'inputSchema' ||
      key === 'schema'
    );
  });
}

function objectLooksLikeSchema(obj: ts.ObjectLiteralExpression): boolean {
  if (objectLooksLikeConfig(obj)) {
    return false;
  }
  return obj.properties.some((prop) => {
    if (!ts.isPropertyAssignment(prop)) {
      return false;
    }
    const text = prop.initializer.getText();
    return /z\./.test(text) || isSensitiveName(propertyName(prop) ?? '');
  });
}

function collectConstObjects(source: ts.SourceFile): Map<string, ConstObject> {
  const map = new Map<string, ConstObject>();

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const unwrapped = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(unwrapped)) {
        const annotations = annotationsFromObject(unwrapped, map);
        const entry: ConstObject = { text: unwrapped.getText(source) };
        if (hasAnyAnnotation(annotations)) {
          entry.annotations = annotations;
        }
        map.set(node.name.text, entry);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return map;
}

function hasAnyAnnotation(annotations: ToolAnnotations): boolean {
  return (
    annotations.readOnlyHint !== undefined ||
    annotations.destructiveHint !== undefined ||
    annotations.idempotentHint !== undefined ||
    annotations.openWorldHint !== undefined
  );
}

function isFunctionLike(node: ts.Expression): node is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function parameterNames(fn: ts.Expression): string[] {
  if (!isFunctionLike(fn)) {
    return [];
  }
  const names: string[] = [];
  for (const param of fn.parameters) {
    collectBindingNames(param.name, names);
  }
  return names;
}

function collectBindingNames(name: ts.BindingName, names: string[]): void {
  if (ts.isIdentifier(name)) {
    names.push(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name)) {
    for (const element of name.elements) {
      collectBindingNames(element.name, names);
    }
  }
  if (ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) {
        collectBindingNames(element.name, names);
      }
    }
  }
}

function stringLiteral(node: ts.Expression): string | undefined {
  const unwrapped = unwrap(node);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  return undefined;
}

function booleanLiteral(node: ts.Expression): boolean | undefined {
  const unwrapped = unwrap(node);
  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
}

function propertyName(prop: ts.PropertyAssignment): string | undefined {
  if (ts.isIdentifier(prop.name)) {
    return prop.name.text;
  }
  if (ts.isStringLiteral(prop.name)) {
    return prop.name.text;
  }
  return undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function uniqueParameters(parameters: ToolParameter[]): ToolParameter[] {
  const seen = new Set<string>();
  const unique: ToolParameter[] = [];
  for (const parameter of parameters) {
    if (seen.has(parameter.name)) {
      continue;
    }
    seen.add(parameter.name);
    unique.push(parameter);
  }
  return unique;
}

import type { ExtractedTool, ToolAnnotations, ToolParameter } from '../types.js';
import { lineNumberAt } from '../util/text.js';
import { isSensitiveName, isUnconstrainedSchema } from './sensitive.js';

const DEF_RE = /^[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_][\w]*)\s*\((.*)\)\s*(?:->[^:]+)?:/;

export function extractToolsFromPython(relativePath: string, content: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!/@(?:mcp|server|app|fastmcp)\.tool\b/.test(line)) {
      continue;
    }
    const decoratorText = collectDecorator(lines, i);
    let defIndex = i + 1;
    while (defIndex < lines.length && !DEF_RE.test(lines[defIndex] ?? '')) {
      defIndex += 1;
      if (defIndex - i > 8) {
        break;
      }
    }
    const defLine = lines[defIndex] ?? '';
    const defMatch = DEF_RE.exec(defLine);
    if (!defMatch) {
      continue;
    }
    const nameFromDef = defMatch[1] ?? 'unknown';
    const paramsText = defMatch[2] ?? '';
    const annotations = annotationsFromDecorator(decoratorText);
    const description = docstringAfter(lines, defIndex);
    const handlerText = functionBody(lines, defIndex);
    const parameters = pythonParameters(paramsText);
    const start = indexOfPhysicalLine(content, i);
    const startLine = lineNumberAt(content, start);

    tools.push({
      name: nameFromDecorator(decoratorText) ?? nameFromDef,
      description,
      file: relativePath,
      startLine,
      endLine: startLine + handlerText.split('\n').length,
      annotations,
      annotationsText: decoratorText,
      parameters,
      hasInputSchema: parameters.length > 0,
      handlerText,
      handlerParamNames: parameters.map((parameter) => parameter.name),
      language: 'python',
    });
  }

  return tools;
}

function collectDecorator(lines: string[], start: number): string {
  const parts: string[] = [];
  for (let i = start; i < Math.min(lines.length, start + 8); i++) {
    const line = lines[i] ?? '';
    parts.push(line.trim());
    if (line.includes(')') || /@(?:mcp|server|app|fastmcp)\.tool\s*$/.test(line)) {
      if (line.includes(')') || i === start) {
        break;
      }
    }
  }
  return parts.join(' ');
}

function nameFromDecorator(text: string): string | undefined {
  const match = /name\s*=\s*['"]([^'"]+)['"]/.exec(text);
  return match?.[1];
}

function annotationsFromDecorator(text: string): ToolAnnotations | undefined {
  const annotations: ToolAnnotations = {};
  const flags: Array<keyof ToolAnnotations> = [
    'readOnlyHint',
    'destructiveHint',
    'idempotentHint',
    'openWorldHint',
  ];
  let found = false;
  for (const flag of flags) {
    const match = new RegExp(`${flag}\\s*=\\s*(True|False)`).exec(text);
    if (match?.[1]) {
      annotations[flag] = match[1] === 'True';
      found = true;
    }
  }
  return found ? annotations : undefined;
}

function docstringAfter(lines: string[], defIndex: number): string {
  for (let i = defIndex + 1; i < Math.min(lines.length, defIndex + 6); i++) {
    const line = (lines[i] ?? '').trim();
    if (!line) {
      continue;
    }
    const match = /^[ru]?("""|''')([\s\S]*)$/.exec(line);
    if (!match) {
      return '';
    }
    const quote = match[1] ?? '"""';
    const rest = match[2] ?? '';
    if (rest.includes(quote)) {
      return rest.split(quote)[0]?.trim() ?? '';
    }
    const parts = [rest];
    for (let j = i + 1; j < lines.length; j++) {
      const body = lines[j] ?? '';
      if (body.includes(quote)) {
        parts.push(body.split(quote)[0] ?? '');
        break;
      }
      parts.push(body);
    }
    return parts.join('\n').trim();
  }
  return '';
}

function functionBody(lines: string[], defIndex: number): string {
  const def = lines[defIndex] ?? '';
  const indentMatch = /^(\s*)/.exec(def);
  const baseIndent = indentMatch?.[1]?.length ?? 0;
  const body: string[] = [];
  for (let i = defIndex + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      body.push(line);
      continue;
    }
    const indent = /^(\s*)/.exec(line)?.[1]?.length ?? 0;
    if (indent <= baseIndent) {
      break;
    }
    body.push(line);
  }
  return body.join('\n');
}

function pythonParameters(paramsText: string): ToolParameter[] {
  const parameters: ToolParameter[] = [];
  for (const raw of splitParams(paramsText)) {
    const piece = raw.trim();
    if (!piece || piece === 'self' || piece === 'cls' || piece.startsWith('*')) {
      continue;
    }
    const name = piece.split('=')[0]?.split(':')[0]?.trim() ?? '';
    if (!name) {
      continue;
    }
    const schemaText = piece.includes(':')
      ? (piece.split(':')[1]?.split('=')[0]?.trim() ?? '')
      : '';
    parameters.push({
      name,
      schemaText,
      unconstrained: schemaText ? isUnconstrainedSchema(schemaText) : true,
      sensitive: isSensitiveName(name),
    });
  }
  return parameters;
}

function splitParams(paramsText: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of paramsText) {
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    }
    if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts;
}

function indexOfPhysicalLine(content: string, lineIndex: number): number {
  if (lineIndex <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      seen += 1;
      if (seen === lineIndex) {
        return i + 1;
      }
    }
  }
  return content.length;
}

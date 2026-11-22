import type { Finding } from '../types.js';
import { detectSinks, isDestructiveSink, isWriteSink } from './sinks-detect.js';
import { finding, type Rule, type RuleContext } from './types.js';

export const annotationsRule: Rule = {
  id: 'MCP002',
  name: 'dishonest-annotation',
  description:
    'Flags tools whose readOnlyHint or destructiveHint does not match the handler, and tools that omit annotations entirely.',
  scan(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    for (const tool of ctx.tools) {
      const taint = taintNames(tool);
      const sinks = detectSinks(tool.handlerText, taint);
      const writes = sinks.filter((sink) => isWriteSink(sink.kind));
      const destructive = sinks.filter((sink) => isDestructiveSink(sink.kind));
      const annotations = tool.annotations;

      if (!annotations) {
        findings.push(
          finding({
            ruleId: 'MCP002',
            ruleName: 'dishonest-annotation',
            severity: writes.length > 0 ? 'high' : 'medium',
            message: `Tool "${tool.name}" is registered without MCP tool annotations.`,
            advice:
              'Add annotations: readOnlyHint, destructiveHint, idempotentHint, and openWorldHint. Clients may auto-approve tools marked read-only, so these flags must be honest.',
            file: tool.file,
            startLine: tool.startLine,
            endLine: tool.endLine,
            toolName: tool.name,
            excerpt: tool.description.slice(0, 160),
          }),
        );
        continue;
      }

      if (annotations.readOnlyHint === true && writes.length > 0) {
        const kinds = unique(writes.map((sink) => sink.kind)).join(', ');
        findings.push(
          finding({
            ruleId: 'MCP002',
            ruleName: 'dishonest-annotation',
            severity: 'high',
            message: `Tool "${tool.name}" is annotated readOnlyHint: true but its handler performs write operations (${kinds}).`,
            advice:
              'Set readOnlyHint to false. MCP clients may skip confirmation for tools marked read-only, so a lying annotation is a confused-deputy risk.',
            file: tool.file,
            startLine: tool.startLine,
            endLine: tool.endLine,
            toolName: tool.name,
            ...(writes[0]?.text ? { excerpt: writes[0].text } : {}),
          }),
        );
      }

      if (destructive.length > 0 && annotations.destructiveHint === false) {
        const kinds = unique(destructive.map((sink) => sink.kind)).join(', ');
        findings.push(
          finding({
            ruleId: 'MCP002',
            ruleName: 'dishonest-annotation',
            severity: 'high',
            message: `Tool "${tool.name}" is annotated destructiveHint: false but its handler can delete or otherwise destroy data (${kinds}).`,
            advice:
              'Set destructiveHint to true whenever the tool can delete files, drop data, run a shell, or evaluate code.',
            file: tool.file,
            startLine: tool.startLine,
            endLine: tool.endLine,
            toolName: tool.name,
            ...(destructive[0]?.text ? { excerpt: destructive[0].text } : {}),
          }),
        );
      }
    }
    return findings;
  },
};

function taintNames(tool: {
  handlerParamNames: string[];
  parameters: { name: string }[];
}): string[] {
  const names = new Set<string>([...tool.handlerParamNames, ...tool.parameters.map((p) => p.name)]);
  names.delete('args');
  names.delete('input');
  names.delete('params');
  names.delete('extra');
  return [...names];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

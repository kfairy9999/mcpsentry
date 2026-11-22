import type { Finding } from '../types.js';
import { detectSinks } from './sinks-detect.js';
import { finding, type Rule, type RuleContext } from './types.js';

const BROAD_TOOL_NAMES =
  /^(run|exec|execute|shell|cmd|command|eval|system)[_-]?(command|cmd|shell|code|script)?$/i;

export const overbroadRule: Rule = {
  id: 'MCP003',
  name: 'overbroad-tool',
  description:
    'Flags tools that expose unconstrained shell, path, URL, or code parameters to the model.',
  scan(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    for (const tool of ctx.tools) {
      if (!tool.hasInputSchema && BROAD_TOOL_NAMES.test(tool.name)) {
        findings.push(
          finding({
            ruleId: 'MCP003',
            ruleName: 'overbroad-tool',
            severity: 'high',
            message: `Tool "${tool.name}" has no input schema, so the model can pass any arguments.`,
            advice:
              'Define a strict input schema (for example a Zod object or typed parameters) and constrain dangerous fields with an allowlist, enum, or regex.',
            file: tool.file,
            startLine: tool.startLine,
            endLine: tool.endLine,
            toolName: tool.name,
          }),
        );
      }

      for (const parameter of tool.parameters) {
        if (!parameter.sensitive || !parameter.unconstrained) {
          continue;
        }
        const sinks = detectSinks(tool.handlerText, [parameter.name, ...tool.handlerParamNames]);
        const reachesSink = sinks.some((sink) => sink.usesTaintedInput);
        const high =
          parameter.name === 'command' ||
          parameter.name === 'cmd' ||
          parameter.name === 'shell' ||
          parameter.name === 'code' ||
          parameter.name === 'eval' ||
          parameter.name === 'script';
        findings.push(
          finding({
            ruleId: 'MCP003',
            ruleName: 'overbroad-tool',
            severity: high || reachesSink ? 'high' : 'medium',
            message: `Tool "${tool.name}" accepts unconstrained parameter "${parameter.name}" (${parameter.schemaText.trim()}).`,
            advice:
              'Constrain the parameter: use an enum or allowlist for commands, a rooted path allowlist for files, and block user-controlled URLs or wrap them in a fixed-origin client.',
            file: tool.file,
            startLine: tool.startLine,
            endLine: tool.endLine,
            toolName: tool.name,
            excerpt: parameter.schemaText.trim().slice(0, 160),
          }),
        );
      }
    }
    return findings;
  },
};

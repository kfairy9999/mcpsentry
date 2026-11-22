import type { Finding, Severity } from '../types.js';
import { detectSinks, type SinkKind } from './sinks-detect.js';
import { finding, type Rule, type RuleContext } from './types.js';

const SEVERITY: Record<SinkKind, Severity> = {
  shell: 'critical',
  eval: 'critical',
  'fs-delete': 'high',
  'fs-write': 'high',
  network: 'high',
  'sql-write': 'medium',
};

const ADVICE: Record<SinkKind, string> = {
  shell:
    'Do not pass tool arguments to a shell. If a fixed command is required, hard-code it and pass only allowlisted flags or file paths that have been resolved inside a sandbox root.',
  eval: 'Do not evaluate tool arguments as code. Use a parser or a fixed function table instead of eval, Function, or vm.',
  'fs-delete':
    'Resolve the path, reject traversal (..), and restrict deletes to an allowlisted directory. Require a confirmation flag for destructive tools.',
  'fs-write':
    'Resolve the path against a sandbox root and reject traversal. Never write to an absolute path supplied by the model.',
  network:
    'Do not let the model choose an arbitrary URL. Pin the origin, or use a host allowlist, and strip credentials from the response.',
  'sql-write':
    'Use parameterized queries and a narrow allowlist of statements. Never concatenate tool arguments into SQL.',
};

export const sinksRule: Rule = {
  id: 'MCP004',
  name: 'unsafe-sink',
  description:
    'Flags tool handlers that pass arguments into a shell, filesystem, network, eval, or SQL sink.',
  scan(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    for (const tool of ctx.tools) {
      const taint = [...tool.handlerParamNames, ...tool.parameters.map((p) => p.name)].filter(
        (name) => name !== 'args' && name !== 'input' && name !== 'params' && name !== 'extra',
      );
      // Also treat the whole args object as a taint source when the handler is `(args) => ...`.
      const sinks = detectSinks(tool.handlerText, taint);
      const seen = new Set<string>();
      for (const sink of sinks) {
        if (!sink.usesTaintedInput) {
          continue;
        }
        const key = `${sink.kind}:${sink.text}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        findings.push(
          finding({
            ruleId: 'MCP004',
            ruleName: 'unsafe-sink',
            severity: SEVERITY[sink.kind],
            message: `Tool "${tool.name}" passes tool arguments into a ${label(sink.kind)} sink (${sink.text.trim()}).`,
            advice: ADVICE[sink.kind],
            file: tool.file,
            startLine: tool.startLine,
            endLine: tool.endLine,
            toolName: tool.name,
            excerpt: sink.text.trim(),
          }),
        );
      }
    }
    return findings;
  },
};

function label(kind: SinkKind): string {
  switch (kind) {
    case 'shell':
      return 'shell';
    case 'eval':
      return 'code-evaluation';
    case 'fs-write':
      return 'filesystem write';
    case 'fs-delete':
      return 'filesystem delete';
    case 'network':
      return 'network';
    case 'sql-write':
      return 'SQL write';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

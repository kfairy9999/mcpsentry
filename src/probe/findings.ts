import type { Finding } from '../types.js';
import { isSensitiveName, isUnconstrainedSchema } from '../extract/sensitive.js';
import { finding } from '../rules/types.js';
import type { ListedTool, ProbeResult } from './protocol.js';

export function findingsFromProbe(probe: ProbeResult, target: string): Finding[] {
  const findings: Finding[] = [];
  for (const tool of probe.tools) {
    if (!tool.annotations) {
      findings.push(
        finding({
          ruleId: 'MCP002',
          ruleName: 'dishonest-annotation',
          severity: 'medium',
          message: `Live tools/list reports tool "${tool.name}" without annotations.`,
          advice:
            'Advertise readOnlyHint, destructiveHint, idempotentHint, and openWorldHint in the tools/list response so clients can make safe defaults.',
          file: target,
          startLine: 1,
          toolName: tool.name,
          source: 'probe',
        }),
      );
    }
    for (const parameter of schemaParameters(tool.inputSchema)) {
      if (parameter.sensitive && parameter.unconstrained) {
        findings.push(
          finding({
            ruleId: 'MCP003',
            ruleName: 'overbroad-tool',
            severity: parameter.name === 'command' || parameter.name === 'code' ? 'high' : 'medium',
            message: `Live tools/list advertises unconstrained parameter "${parameter.name}" on tool "${tool.name}".`,
            advice:
              'Tighten the JSON Schema for this parameter (enum, pattern, or a fixed allowlist) before the tool is advertised to clients.',
            file: target,
            startLine: 1,
            toolName: tool.name,
            source: 'probe',
            excerpt: parameter.name,
          }),
        );
      }
    }
  }
  return findings;
}

interface LiveParameter {
  name: string;
  unconstrained: boolean;
  sensitive: boolean;
}

function schemaParameters(schema: unknown): LiveParameter[] {
  if (!schema || typeof schema !== 'object') {
    return [];
  }
  const record = schema as { properties?: Record<string, unknown>; type?: string };
  const properties = record.properties;
  if (!properties || typeof properties !== 'object') {
    return [];
  }
  const parameters: LiveParameter[] = [];
  for (const [name, value] of Object.entries(properties)) {
    const text = JSON.stringify(value ?? {});
    const unconstrained =
      !/"enum"/.test(text) &&
      !/"pattern"/.test(text) &&
      !/"const"/.test(text) &&
      isUnconstrainedSchema(inferSchemaText(value));
    parameters.push({
      name,
      unconstrained,
      sensitive: isSensitiveName(name),
    });
  }
  return parameters;
}

function inferSchemaText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return 'z.any()';
  }
  const type = (value as { type?: string }).type;
  if (type === 'string') {
    return 'z.string()';
  }
  return JSON.stringify(value);
}

export function summarizeListedTools(tools: ListedTool[]): string[] {
  return tools.map((tool) => tool.name);
}

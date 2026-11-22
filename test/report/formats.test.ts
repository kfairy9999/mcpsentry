import { describe, expect, it } from 'vitest';

import { toJson } from '../../src/report/json.js';
import { toMarkdown } from '../../src/report/markdown.js';
import { toSarif } from '../../src/report/sarif.js';
import type { ScanResult } from '../../src/types.js';
import { VERSION } from '../../src/version.js';

function sample(count: number): ScanResult {
  return {
    toolName: 'MCPSentry',
    version: VERSION,
    scannedAt: '2026-11-22T00:00:00.000Z',
    root: '/tmp/example',
    tools: [
      { name: 'ping', file: 'server.ts', startLine: 10, hasAnnotations: true, readOnlyHint: true },
    ],
    findings:
      count === 0
        ? []
        : [
            {
              ruleId: 'MCP001',
              ruleName: 'hardcoded-secret',
              severity: 'high',
              message: 'Hardcoded secret-like value assigned to "apiKey".',
              advice: 'Use the environment.',
              file: 'server.ts',
              startLine: 4,
              endLine: 4,
              startColumn: 1,
              endColumn: 1,
              source: 'static',
              excerpt: 'const apiKey = "fixture"',
            },
          ],
    summary: {
      count,
      bySeverity: { critical: 0, high: count, medium: 0, low: 0, info: 0 },
      byRule: count === 0 ? {} : { 'MCP001 hardcoded-secret': count },
    },
  };
}

describe('reports', () => {
  it('serializes JSON, Markdown, and SARIF for a finding', () => {
    const result = sample(1);
    const json = JSON.parse(toJson(result)) as ScanResult;
    expect(json.findings).toHaveLength(1);
    const markdown = toMarkdown(result);
    expect(markdown).toContain('# MCPSentry report');
    expect(markdown).toContain('MCP001');
    expect(markdown).toContain('Fix:');
    const sarif = JSON.parse(toSarif(result)) as {
      version: string;
      runs: Array<{ results: Array<{ ruleId: string; level: string }> }>;
    };
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0]?.results[0]?.ruleId).toBe('MCP001');
    expect(sarif.runs[0]?.results[0]?.level).toBe('error');
  });

  it('renders an empty Markdown report honestly', () => {
    const markdown = toMarkdown(sample(0));
    expect(markdown).toContain('No findings');
    expect(markdown).toContain('not a guarantee of safety');
  });
});

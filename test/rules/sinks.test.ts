import { describe, expect, it } from 'vitest';

import { byRule, byTool, scanFixture } from '../helpers/scan.js';

describe('MCP004 unsafe-sink', () => {
  it('flags eval, shell, filesystem write, and fetch sinks fed by tool args (true positives)', async () => {
    const result = await scanFixture('vulnerable/unsafe-sinks');
    const findings = byRule(result, 'MCP004');
    expect(byTool(findings, 'eval_code').some((item) => item.severity === 'critical')).toBe(true);
    expect(byTool(findings, 'shell_out').some((item) => item.severity === 'critical')).toBe(true);
    expect(byTool(findings, 'write_note').length).toBeGreaterThanOrEqual(1);
    expect(byTool(findings, 'fetch_url').length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag allowlisted commands that never reach a sink (false positive cases)', async () => {
    const result = await scanFixture('clean/well-hardened');
    expect(byRule(result, 'MCP004')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { byRule, byTool, scanFixture } from '../helpers/scan.js';

describe('MCP003 overbroad-tool', () => {
  it('flags unconstrained command and path parameters (true positives)', async () => {
    const result = await scanFixture('vulnerable/overbroad-server');
    const findings = byRule(result, 'MCP003');
    expect(byTool(findings, 'run_command').length).toBeGreaterThanOrEqual(1);
    expect(byTool(findings, 'read_file').length).toBeGreaterThanOrEqual(1);
    expect(byTool(findings, 'run_command')[0]?.severity).toBe('high');
  });

  it('does not flag enum or allowlisted parameters (false positive cases)', async () => {
    const result = await scanFixture('clean/well-hardened');
    expect(byRule(result, 'MCP003')).toEqual([]);
  });
});

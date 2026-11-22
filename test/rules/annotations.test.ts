import { describe, expect, it } from 'vitest';

import { byRule, byTool, scanFixture } from '../helpers/scan.js';

describe('MCP002 dishonest-annotation', () => {
  it('flags readOnlyHint and destructiveHint that do not match the handler (true positives)', async () => {
    const result = await scanFixture('vulnerable/dishonest-annotations');
    const findings = byRule(result, 'MCP002');
    const cleanup = byTool(findings, 'cleanup_temp');
    expect(cleanup.some((item) => item.message.includes('readOnlyHint'))).toBe(true);
    expect(cleanup.some((item) => item.message.includes('destructiveHint'))).toBe(true);
    const maintenance = byTool(findings, 'run_maintenance');
    expect(maintenance.some((item) => item.message.includes('destructiveHint'))).toBe(true);
  });

  it('flags tools that omit annotations entirely (true positive)', async () => {
    const result = await scanFixture('vulnerable/missing-annotations');
    const findings = byRule(result, 'MCP002');
    expect(findings.length).toBe(1);
    expect(findings[0]?.toolName).toBe('status');
    expect(findings[0]?.message).toMatch(/without MCP tool annotations/);
  });

  it('accepts honest annotations on read-only and write tools (false positive cases)', async () => {
    const result = await scanFixture('clean/well-hardened');
    expect(byRule(result, 'MCP002')).toEqual([]);
  });
});

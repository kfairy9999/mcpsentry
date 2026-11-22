import { describe, expect, it } from 'vitest';

import { byRule, scanFixture } from '../helpers/scan.js';

describe('MCP005 prompt-injection-description', () => {
  it('flags descriptions that tell the model to ignore previous instructions (true positive)', async () => {
    const result = await scanFixture('vulnerable/injection-descriptions');
    const findings = byRule(result, 'MCP005');
    expect(findings.length).toBe(1);
    expect(findings[0]?.toolName).toBe('search_notes');
  });

  it('does not flag ordinary wording that mentions previous work (false positive cases)', async () => {
    const hardened = await scanFixture('clean/well-hardened');
    const placeholders = await scanFixture('clean/placeholders');
    expect(byRule(hardened, 'MCP005')).toEqual([]);
    expect(byRule(placeholders, 'MCP005')).toEqual([]);
  });
});

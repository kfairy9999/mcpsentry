import { describe, expect, it } from 'vitest';

import { RULES, rulesById } from '../../src/rules/registry.js';

describe('rule registry', () => {
  it('selects rules by id or name and rejects unknown ids', () => {
    expect(rulesById().length).toBe(RULES.length);
    expect(rulesById(['MCP001', 'hardcoded-secret']).map((rule) => rule.id)).toEqual(['MCP001']);
    expect(() => rulesById(['NOPE'])).toThrow(/Unknown rule/);
  });
});

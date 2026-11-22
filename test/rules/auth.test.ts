import { describe, expect, it } from 'vitest';

import { byRule, scanFixture } from '../helpers/scan.js';

describe('MCP006 missing-auth and MCP007 missing-rate-limit', () => {
  it('flags an HTTP MCP transport with no auth or rate limiter (true positives)', async () => {
    const result = await scanFixture('vulnerable/no-auth-http');
    expect(byRule(result, 'MCP006').length).toBe(1);
    expect(byRule(result, 'MCP007').length).toBe(1);
    expect(byRule(result, 'MCP006')[0]?.severity).toBe('high');
    expect(byRule(result, 'MCP007')[0]?.severity).toBe('medium');
  });

  it('does not flag a hardened HTTP server or a stdio-only server (false positive cases)', async () => {
    const hardened = await scanFixture('clean/well-hardened');
    const stdio = await scanFixture('clean/stdio-only');
    expect(byRule(hardened, 'MCP006')).toEqual([]);
    expect(byRule(hardened, 'MCP007')).toEqual([]);
    expect(byRule(stdio, 'MCP006')).toEqual([]);
    expect(byRule(stdio, 'MCP007')).toEqual([]);
  });
});

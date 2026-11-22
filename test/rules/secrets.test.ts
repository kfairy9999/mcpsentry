import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scan } from '../../src/scan.js';
import { byRule, scanFixture } from '../helpers/scan.js';

describe('MCP001 hardcoded-secret', () => {
  it('flags a hardcoded secret-like assignment (true positive)', async () => {
    const result = await scanFixture('vulnerable/secrets-server');
    const findings = byRule(result, 'MCP001');
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((item) => item.message.includes('databasePassword'))).toBe(true);
    expect(findings[0]?.severity).toBe('high');
  });

  it('does not flag environment lookups or obvious placeholders (false positive cases)', async () => {
    const result = await scanFixture('clean/placeholders');
    expect(byRule(result, 'MCP001')).toEqual([]);

    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-secret-fp-'));
    await writeFile(
      path.join(dir, 'ok.ts'),
      `const apiKey = process.env.API_KEY;\nconst token = 'REDACTED';\nconst password = 'xxxxxxxx';\n`,
      'utf8',
    );
    const scanned = await scan({ root: dir, osv: false });
    expect(byRule(scanned, 'MCP001')).toEqual([]);
  });

  it('does not flag test fixtures that use a local TOKEN double (false positive case)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-secret-test-'));
    await mkdir(path.join(dir, 'test'));
    await writeFile(
      path.join(dir, 'test', 'http.auth.test.ts'),
      "const TOKEN = '0123456789abcdef';\n",
      'utf8',
    );
    const scanned = await scan({ root: dir, osv: false });
    expect(byRule(scanned, 'MCP001')).toEqual([]);
  });
});

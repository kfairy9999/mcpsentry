import { describe, expect, it } from 'vitest';

import { byRule, mockOsv, scanFixture } from '../helpers/scan.js';

describe('MCP008 dependency-cve', () => {
  it('flags a lockfile package that OSV reports as vulnerable (true positive)', async () => {
    const result = await scanFixture('vulnerable/cve-lockfile', {
      osv: true,
      osvFetcher: mockOsv({
        'lodash@4.17.19': [
          { id: 'GHSA-test-lodash', summary: 'Prototype pollution in lodash.', severity: 'high' },
        ],
      }),
    });
    const findings = byRule(result, 'MCP008');
    expect(findings.length).toBe(1);
    expect(findings[0]?.cve).toBe('GHSA-test-lodash');
    expect(findings[0]?.severity).toBe('high');
  });

  it('does not flag packages that OSV reports as clean (false positive case)', async () => {
    const result = await scanFixture('vulnerable/cve-lockfile', {
      osv: true,
      osvFetcher: mockOsv({ 'lodash@4.17.19': [] }),
    });
    expect(byRule(result, 'MCP008')).toEqual([]);
  });

  it('skips OSV entirely when osv is false', async () => {
    const result = await scanFixture('vulnerable/cve-lockfile', { osv: false });
    expect(byRule(result, 'MCP008')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { createOsvClient, scoreToSeverity } from '../src/osv/client.js';

describe('OSV client', () => {
  it('maps CVSS and named severity, and batches package queries', async () => {
    expect(scoreToSeverity({ database_specific: { severity: 'CRITICAL' } })).toBe('critical');
    expect(scoreToSeverity({ database_specific: { severity: 'HIGH' } })).toBe('high');
    expect(scoreToSeverity({ database_specific: { severity: 'MODERATE' } })).toBe('medium');
    expect(scoreToSeverity({ database_specific: { severity: 'LOW' } })).toBe('low');
    expect(scoreToSeverity({ severity: [{ type: 'CVSS_V3', score: '9.8' }] })).toBe('critical');
    expect(scoreToSeverity({ severity: [{ type: 'CVSS_V3', score: '7.5' }] })).toBe('high');
    expect(scoreToSeverity({ severity: [{ type: 'CVSS_V3', score: '5.0' }] })).toBe('medium');
    expect(scoreToSeverity({ severity: [{ type: 'CVSS_V3', score: '1.2' }] })).toBe('low');
    expect(scoreToSeverity({})).toBe('medium');

    const fetcher = (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const raw = typeof init?.body === 'string' ? init.body : '{}';
      const body = JSON.parse(raw) as { queries: unknown[] };
      expect(body.queries).toHaveLength(1);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              { vulns: [{ id: 'CVE-TEST-1', summary: 'example', severity: [{ score: '8.1' }] }] },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    };
    const client = createOsvClient(fetcher);
    const result = await client.query([
      { name: 'left-pad', version: '1.0.0' },
      { name: 'left-pad', version: '1.0.0' },
    ]);
    expect(result.get('left-pad@1.0.0')?.[0]?.id).toBe('CVE-TEST-1');
    expect(result.get('left-pad@1.0.0')?.[0]?.severity).toBe('high');
  });

  it('throws when OSV returns a non-OK status and returns an empty map for no packages', async () => {
    const client = createOsvClient(() => Promise.resolve(new Response('nope', { status: 500 })));
    await expect(client.query([{ name: 'x', version: '1' }])).rejects.toThrow(/OSV query failed/);
    const empty = createOsvClient(fetch);
    expect(await empty.query([])).toEqual(new Map());
  });
});

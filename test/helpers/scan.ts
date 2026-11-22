import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from '../../src/scan.js';
import type { OsvFetcher } from '../../src/osv/client.js';
import type { Finding, ScanOptions, ScanResult } from '../../src/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../..');
export const fixturesRoot = path.join(repoRoot, 'fixtures');

export function fixturePath(...parts: string[]): string {
  return path.join(fixturesRoot, ...parts);
}

export async function scanFixture(
  relative: string,
  options: Partial<ScanOptions> = {},
): Promise<ScanResult> {
  return await scan({
    root: fixturePath(relative),
    osv: options.osv ?? false,
    ...options,
  });
}

export function byRule(result: ScanResult, ruleId: string): Finding[] {
  return result.findings.filter((item) => item.ruleId === ruleId);
}

export function byTool(findings: Finding[], toolName: string): Finding[] {
  return findings.filter((item) => item.toolName === toolName);
}

export function bodyText(init?: RequestInit): string {
  const body = init?.body;
  return typeof body === 'string' ? body : '{"queries":[]}';
}

export function mockOsv(
  mapping: Record<string, Array<{ id: string; summary?: string; severity?: Finding['severity'] }>>,
): OsvFetcher {
  const fetcher: OsvFetcher = (_url: string, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(bodyText(init)) as {
      queries?: Array<{ package?: { name?: string }; version?: string }>;
    };
    const results = (body.queries ?? []).map((query) => {
      const key = `${query.package?.name ?? ''}@${query.version ?? ''}`;
      return { vulns: mapping[key] ?? [] };
    });
    return Promise.resolve(
      new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return fetcher;
}

import type { Severity } from '../types.js';

export type OsvFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface OsvQuery {
  name: string;
  version: string;
}

export interface OsvVulnerability {
  id: string;
  summary?: string;
  severity?: Severity;
}

export interface OsvClient {
  query(packages: OsvQuery[]): Promise<Map<string, OsvVulnerability[]>>;
}

interface OsvApiVuln {
  id?: string;
  summary?: string;
  severity?: string | Array<{ type?: string; score?: string }>;
  database_specific?: { severity?: string };
}

interface OsvBatchResponse {
  results?: Array<{ vulns?: OsvApiVuln[] }>;
}

const OSV_URL = 'https://api.osv.dev/v1/querybatch';

export function createOsvClient(fetcher: OsvFetcher = fetch): OsvClient {
  return {
    async query(packages: OsvQuery[]): Promise<Map<string, OsvVulnerability[]>> {
      const results = new Map<string, OsvVulnerability[]>();
      if (packages.length === 0) {
        return results;
      }
      const unique = uniqueQueries(packages);
      const chunks = chunk(unique, 100);
      for (const group of chunks) {
        const body = {
          queries: group.map((pkg) => ({
            package: { name: pkg.name, ecosystem: 'npm' },
            version: pkg.version,
          })),
        };
        const response = await fetcher(OSV_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(`OSV query failed with HTTP ${response.status}`);
        }
        const payload = (await response.json()) as OsvBatchResponse;
        const rows = payload.results ?? [];
        for (let i = 0; i < group.length; i++) {
          const pkg = group[i];
          const row = rows[i];
          if (!pkg) {
            continue;
          }
          const vulns = (row?.vulns ?? []).flatMap((vuln) => {
            if (!vuln.id) {
              return [];
            }
            const mapped: OsvVulnerability = {
              id: vuln.id,
              severity: scoreToSeverity(vuln),
            };
            if (vuln.summary) {
              mapped.summary = vuln.summary;
            }
            return [mapped];
          });
          results.set(`${pkg.name}@${pkg.version}`, vulns);
        }
      }
      return results;
    },
  };
}

export function scoreToSeverity(vuln: OsvApiVuln): Severity {
  const named = (
    vuln.database_specific?.severity ??
    (typeof vuln.severity === 'string' ? vuln.severity : undefined)
  )?.toUpperCase();
  if (named === 'CRITICAL') {
    return 'critical';
  }
  if (named === 'HIGH') {
    return 'high';
  }
  if (named === 'MEDIUM' || named === 'MODERATE') {
    return 'medium';
  }
  if (named === 'LOW') {
    return 'low';
  }
  const list = Array.isArray(vuln.severity) ? vuln.severity : [];
  const cvss = list.find((item) => item.score)?.score;
  const numeric = cvss ? Number.parseFloat(cvss.split('/')[0] ?? cvss) : Number.NaN;
  if (numeric >= 9) {
    return 'critical';
  }
  if (numeric >= 7) {
    return 'high';
  }
  if (numeric >= 4) {
    return 'medium';
  }
  if (numeric > 0) {
    return 'low';
  }
  return 'medium';
}

function uniqueQueries(packages: OsvQuery[]): OsvQuery[] {
  const seen = new Set<string>();
  const unique: OsvQuery[] = [];
  for (const pkg of packages) {
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(pkg);
  }
  return unique;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Lockfile, LockfilePackage } from './types.js';

interface NpmLockfile {
  packages?: Record<string, { version?: string; dev?: boolean } | undefined>;
  dependencies?: Record<string, { version?: string; dev?: boolean } | undefined>;
}

function parseNpmLockfile(file: string, raw: string): Lockfile {
  const parsed = JSON.parse(raw) as NpmLockfile;
  const packages: LockfilePackage[] = [];
  const seen = new Set<string>();

  if (parsed.packages) {
    for (const [pkgPath, meta] of Object.entries(parsed.packages)) {
      if (!pkgPath || pkgPath === '' || !meta?.version) {
        continue;
      }
      const name = npmNameFromPath(pkgPath);
      if (!name) {
        continue;
      }
      const key = `${name}@${meta.version}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      packages.push({ name, version: meta.version, dev: meta.dev === true });
    }
  } else if (parsed.dependencies) {
    for (const [name, meta] of Object.entries(parsed.dependencies)) {
      if (!meta?.version) {
        continue;
      }
      const key = `${name}@${meta.version}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      packages.push({ name, version: meta.version, dev: meta.dev === true });
    }
  }

  return { file, ecosystem: 'npm', packages };
}

function npmNameFromPath(pkgPath: string): string | undefined {
  const marker = 'node_modules/';
  const index = pkgPath.lastIndexOf(marker);
  const name = index === -1 ? pkgPath : pkgPath.slice(index + marker.length);
  if (!name || name.startsWith('.')) {
    return undefined;
  }
  return name;
}

export async function loadLockfiles(root: string): Promise<Lockfile[]> {
  const candidates = ['package-lock.json', 'npm-shrinkwrap.json'];
  const found: Lockfile[] = [];
  for (const name of candidates) {
    const full = path.join(root, name);
    try {
      const raw = await fs.readFile(full, 'utf8');
      found.push(parseNpmLockfile(name, raw));
    } catch {
      // Missing or unreadable lockfiles are skipped.
    }
  }
  return found;
}

export function parseNpmLockfileForTest(file: string, raw: string): Lockfile {
  return parseNpmLockfile(file, raw);
}

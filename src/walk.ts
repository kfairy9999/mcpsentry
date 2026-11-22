import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ProjectFile } from './types.js';
import {
  DEFAULT_EXCLUDE_DIRS,
  SOURCE_EXTENSIONS,
  languageOf,
  relativePosix,
} from './util/paths.js';

export interface WalkOptions {
  root: string;
  exclude?: string[];
}

function excluded(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
    if (normalized.endsWith('/**')) {
      const prefix = normalized.slice(0, -3);
      return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
    }
    if (normalized.startsWith('**/')) {
      const suffix = normalized.slice(3);
      return relativePath === suffix || relativePath.endsWith(`/${suffix}`);
    }
    return relativePath === normalized || relativePath.startsWith(`${normalized}/`);
  });
}

export async function walkSourceFiles(options: WalkOptions): Promise<ProjectFile[]> {
  const root = path.resolve(options.root);
  const extraExclude = options.exclude ?? [];
  const files: ProjectFile[] = [];

  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = relativePosix(root, full);
      if (entry.isDirectory()) {
        if (DEFAULT_EXCLUDE_DIRS.has(entry.name) || excluded(rel, extraExclude)) {
          continue;
        }
        await visit(full);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (excluded(rel, extraExclude)) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) {
        continue;
      }
      let content: string;
      try {
        content = await fs.readFile(full, 'utf8');
      } catch {
        continue;
      }
      files.push({
        path: full,
        relativePath: rel,
        content,
        language: languageOf(full),
      });
    }
  }

  await visit(root);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

export async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadLockfiles, parseNpmLockfileForTest } from '../src/lockfile.js';

describe('lockfile parsing', () => {
  it('reads packages from a v3 lockfile and skips the root entry', () => {
    const parsed = parseNpmLockfileForTest(
      'package-lock.json',
      JSON.stringify({
        packages: {
          '': { version: '1.0.0' },
          'node_modules/lodash': { version: '4.17.19' },
          'node_modules/eslint': { version: '9.0.0', dev: true },
        },
      }),
    );
    expect(parsed.packages).toEqual([
      { name: 'lodash', version: '4.17.19', dev: false },
      { name: 'eslint', version: '9.0.0', dev: true },
    ]);
  });

  it('falls back to the v1 dependencies map', () => {
    const parsed = parseNpmLockfileForTest(
      'package-lock.json',
      JSON.stringify({ dependencies: { minimist: { version: '1.2.0' } } }),
    );
    expect(parsed.packages[0]).toEqual({ name: 'minimist', version: '1.2.0', dev: false });
  });

  it('loads package-lock.json from disk and ignores missing files', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-lock-'));
    await writeFile(
      path.join(dir, 'package-lock.json'),
      JSON.stringify({ packages: { 'node_modules/left-pad': { version: '1.3.0' } } }),
      'utf8',
    );
    const found = await loadLockfiles(dir);
    expect(found[0]?.packages[0]?.name).toBe('left-pad');
    expect(await loadLockfiles(await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-nolock-')))).toEqual(
      [],
    );
  });
});

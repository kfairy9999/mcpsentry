import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { fixturePath } from './helpers/scan.js';

interface Capture {
  out: string;
  err: string;
}

function io(): Capture & {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
} {
  const capture: Capture = { out: '', err: '' };
  return {
    get out() {
      return capture.out;
    },
    get err() {
      return capture.err;
    },
    stdout: {
      write(chunk: string) {
        capture.out += chunk;
      },
    },
    stderr: {
      write(chunk: string) {
        capture.err += chunk;
      },
    },
  };
}

describe('CLI', () => {
  it('prints help and version', async () => {
    const help = io();
    expect(await runCli(['node', 'mcpsentry', '--help'], help)).toBe(0);
    expect(help.out).toContain('Usage:');
    const version = io();
    expect(await runCli(['node', 'mcpsentry', '--version'], version)).toBe(0);
    expect(version.out).toMatch(/MCPSentry 0\.1\.0/);
  });

  it('writes all report formats and fails on a high finding', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-cli-'));
    const captured = io();
    const code = await runCli(
      [
        'node',
        'mcpsentry',
        'scan',
        fixturePath('vulnerable/secrets-server'),
        '--format',
        'all',
        '--out',
        dir,
        '--fail-on',
        'high',
        '--no-osv',
      ],
      captured,
    );
    expect(code).toBe(1);
    expect(captured.err).toContain('Failing:');
    const markdown = await readFile(path.join(dir, 'mcpsentry-report.md'), 'utf8');
    const json = await readFile(path.join(dir, 'mcpsentry-report.json'), 'utf8');
    const sarif = await readFile(path.join(dir, 'mcpsentry-report.sarif'), 'utf8');
    expect(markdown).toContain('MCP001');
    expect(json).toContain('hardcoded-secret');
    expect(sarif).toContain('sarif-2.1.0');
  });

  it('returns 2 for an unknown command or format', async () => {
    const unknown = io();
    expect(await runCli(['node', 'mcpsentry', 'fly'], unknown)).toBe(2);
    const format = io();
    expect(
      await runCli(
        [
          'node',
          'mcpsentry',
          'scan',
          fixturePath('clean/stdio-only'),
          '--format',
          'xml',
          '--no-osv',
        ],
        format,
      ),
    ).toBe(2);
  });

  it('prints markdown to stdout when no --out is given', async () => {
    const captured = io();
    const code = await runCli(
      [
        'node',
        'mcpsentry',
        'scan',
        fixturePath('clean/stdio-only'),
        '--no-osv',
        '--fail-on',
        'high',
      ],
      captured,
    );
    expect(code).toBe(0);
    expect(captured.out).toContain('# MCPSentry report');
  });
});

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { detectHttpSignals } from '../src/http-signals.js';
import * as api from '../src/index.js';
import { parseNpmLockfileForTest } from '../src/lockfile.js';
import { findingsFromProbe, summarizeListedTools } from '../src/probe/findings.js';
import { probeStdio } from '../src/probe/protocol.js';
import { toMarkdown } from '../src/report/markdown.js';
import { toSarif as sarif } from '../src/report/sarif.js';
import { scan } from '../src/scan.js';
import { atOrAbove, compareSeverity } from '../src/types.js';
import { columnAt, excerptForLine, indexOfLine, lineNumberAt } from '../src/util/text.js';
import { languageOf } from '../src/util/paths.js';
import { readTextIfExists, walkSourceFiles } from '../src/walk.js';
import { fixturePath, fixturesRoot } from './helpers/scan.js';

describe('coverage edges', () => {
  it('re-exports the public API', () => {
    expect(api.TOOL_NAME).toBe('MCPSentry');
    expect(api.VERSION).toBe('0.1.0');
    expect(api.RULES.length).toBeGreaterThan(0);
    expect(typeof api.scan).toBe('function');
    expect(typeof api.runCli).toBe('function');
    expect(typeof api.toMarkdown).toBe('function');
    expect(typeof api.toSarif).toBe('function');
    expect(typeof api.evaluateCorpus).toBe('function');
    expect(typeof api.formatScore).toBe('function');
    const summary = api.summarize([]);
    expect(summary.count).toBe(0);
    expect(
      api.toJson({
        toolName: 'MCPSentry',
        version: api.VERSION,
        scannedAt: '2026-11-22T00:00:00.000Z',
        root: '.',
        findings: [],
        tools: [],
        summary,
      }),
    ).toContain('"findings"');
  });

  it('covers severity helpers, path language, and text utilities', () => {
    expect(compareSeverity('low', 'high')).toBeLessThan(0);
    expect(atOrAbove('high', 'medium')).toBe(true);
    expect(atOrAbove('low', 'high')).toBe(false);
    expect(languageOf('a.ts')).toBe('typescript');
    expect(languageOf('a.js')).toBe('javascript');
    expect(languageOf('a.py')).toBe('python');
    expect(languageOf('a.md')).toBe('other');
    const content = 'one\n' + 'x'.repeat(200) + '\nthree';
    expect(lineNumberAt(content, 0)).toBe(1);
    expect(columnAt(content, 2)).toBe(3);
    expect(excerptForLine(content, 2).endsWith('…')).toBe(true);
    expect(indexOfLine(content, 1)).toBe(0);
    expect(indexOfLine(content, 3)).toBeGreaterThan(0);
    expect(excerptForLine(content, 99)).toBe('');
  });

  it('walks files, honors exclude patterns, and reads optional text', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-walk-'));
    await mkdir(path.join(dir, 'skipme'));
    await mkdir(path.join(dir, 'keep'));
    await writeFile(path.join(dir, 'skipme', 'hidden.ts'), 'export const a = 1;\n', 'utf8');
    await writeFile(path.join(dir, 'keep', 'visible.ts'), 'export const b = 1;\n', 'utf8');
    const files = await walkSourceFiles({ root: dir, exclude: ['skipme/**'] });
    expect(files.map((file) => file.relativePath)).toEqual(['keep/visible.ts']);
    expect(await readTextIfExists(path.join(dir, 'keep', 'visible.ts'))).toContain(
      'export const b',
    );
    expect(await readTextIfExists(path.join(dir, 'nope.ts'))).toBeUndefined();
  });

  it('ignores non-source files when detecting HTTP signals and parses scoped lockfile names', () => {
    const signals = detectHttpSignals([
      { path: 'x', relativePath: 'README.md', content: 'createServer()', language: 'other' },
    ]);
    expect(signals.hasHttpTransport).toBe(false);
    const parsed = parseNpmLockfileForTest(
      'package-lock.json',
      JSON.stringify({
        packages: {
          'node_modules/@scope/pkg': { version: '1.2.3' },
          'node_modules/.bin': { version: '0.0.0' },
        },
      }),
    );
    expect(parsed.packages).toEqual([{ name: '@scope/pkg', version: '1.2.3', dev: false }]);
  });

  it('flags a run_command tool with no input schema and a SQL write sink', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-broad-'));
    await writeFile(
      path.join(dir, 'server.ts'),
      `
      server.registerTool('run_command', { description: 'Runs anything.' }, async (args) => {
        db.execute('DELETE FROM users WHERE name = ' + args.name);
        return { content: [{ type: 'text', text: 'ok' }] };
      });
      `,
      'utf8',
    );
    const result = await scan({ root: dir, osv: false });
    expect(result.findings.some((item) => item.ruleId === 'MCP003')).toBe(true);
    expect(
      result.findings.some((item) => item.ruleId === 'MCP004' && item.message.includes('SQL')),
    ).toBe(true);
    expect(result.findings.some((item) => item.ruleId === 'MCP002')).toBe(true);
  });

  it('probes stdio and HTTP through the scan() options', async () => {
    const stdio = await scan({
      root: fixturePath('clean/stdio-only'),
      osv: false,
      probeStdio: `node ${fixturePath('clean/probe-annotated/server.mjs')}`,
      probeTimeoutMs: 5_000,
    });
    expect(stdio.findings.filter((item) => item.source === 'probe')).toEqual([]);

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          id: number;
          method: string;
        };
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result:
              body.method === 'initialize'
                ? { protocolVersion: '2025-03-26', serverInfo: { name: 'edge' } }
                : {
                    tools: [
                      {
                        name: 'run_command',
                        inputSchema: {
                          type: 'object',
                          properties: { command: { type: 'string' } },
                        },
                      },
                    ],
                  },
          }),
        );
      })();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP');
    }
    try {
      const http = await scan({
        root: fixturePath('clean/stdio-only'),
        osv: false,
        probeUrl: `http://127.0.0.1:${address.port}/mcp`,
        probeTimeoutMs: 5_000,
      });
      expect(
        http.findings.some((item) => item.source === 'probe' && item.ruleId === 'MCP003'),
      ).toBe(true);
    } finally {
      server.close();
    }
  });

  it('summarizes listed tools and reports a low-severity SARIF note', () => {
    expect(summarizeListedTools([{ name: 'ping' }])).toEqual(['ping']);
    expect(findingsFromProbe({ tools: [] }, 'x')).toEqual([]);
    const markdown = toMarkdown({
      toolName: 'MCPSentry',
      version: '0.1.0',
      scannedAt: '2026-11-22T00:00:00.000Z',
      root: '.',
      tools: [],
      findings: [
        {
          ruleId: 'MCP008',
          ruleName: 'dependency-cve',
          severity: 'low',
          message: 'low cve',
          advice: 'upgrade',
          file: 'package-lock.json',
          startLine: 1,
          endLine: 1,
          startColumn: 1,
          endColumn: 1,
          source: 'static',
          cve: 'CVE-TEST',
        },
      ],
      summary: {
        count: 1,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 1, info: 0 },
        byRule: { 'MCP008 dependency-cve': 1 },
      },
    });
    expect(markdown).toContain('CVE-TEST');
    const log = JSON.parse(
      sarif({
        toolName: 'MCPSentry',
        version: '0.1.0',
        scannedAt: '2026-11-22T00:00:00.000Z',
        root: '.',
        tools: [],
        findings: [
          {
            ruleId: 'MCP007',
            ruleName: 'missing-rate-limit',
            severity: 'info',
            message: 'info',
            advice: 'limit',
            file: 's.ts',
            startLine: 1,
            endLine: 1,
            startColumn: 1,
            endColumn: 1,
            source: 'static',
          },
        ],
        summary: {
          count: 1,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 1 },
          byRule: { 'MCP007 missing-rate-limit': 1 },
        },
      }),
    ) as { runs: Array<{ results: Array<{ level: string }> }> };
    expect(log.runs[0]?.results[0]?.level).toBe('note');
  });

  it('runs the evaluate CLI against a clean-only truth file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-eval-'));
    const truth = path.join(dir, 'truth.json');
    await writeFile(
      truth,
      JSON.stringify({ fixtures: [{ path: 'clean/stdio-only', expected: [] }] }),
      'utf8',
    );
    const out = path.join(dir, 'score.md');
    const captured = { out: '', err: '' };
    const io = {
      stdout: {
        write(chunk: string) {
          captured.out += chunk;
        },
      },
      stderr: {
        write(chunk: string) {
          captured.err += chunk;
        },
      },
    };
    const code = await runCli(
      ['node', 'mcpsentry', 'evaluate', '--fixtures', fixturesRoot, '--truth', truth, '--out', out],
      io,
    );
    expect(code).toBe(0);
    expect(captured.out).toContain(out);
  });

  it('scans a Python MCP server through loadProject', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-py-'));
    await writeFile(
      path.join(dir, 'server.py'),
      [
        '@mcp.tool()',
        'def echo(text: str) -> str:',
        '    """Echo a value."""',
        '    return text',
        '',
      ].join('\n'),
      'utf8',
    );
    const result = await scan({ root: dir, osv: false });
    expect(result.tools.map((tool) => tool.name)).toContain('echo');
  });

  it('walks **/exclude patterns and skips node_modules', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcpsentry-walk2-'));
    await mkdir(path.join(dir, 'node_modules'), { recursive: true });
    await mkdir(path.join(dir, 'lib'), { recursive: true });
    await writeFile(path.join(dir, 'node_modules', 'pkg.ts'), 'export const skip = 1;\n', 'utf8');
    await writeFile(path.join(dir, 'lib', 'hidden.ts'), 'export const hidden = 1;\n', 'utf8');
    await writeFile(path.join(dir, 'ok.ts'), 'export const ok = 1;\n', 'utf8');
    const files = await walkSourceFiles({ root: dir, exclude: ['**/hidden.ts'] });
    expect(files.map((file) => file.relativePath)).toEqual(['ok.ts']);
  });

  it('rejects an empty probe command', async () => {
    await expect(probeStdio({ command: '   ' })).rejects.toThrow(/empty/);
  });
});

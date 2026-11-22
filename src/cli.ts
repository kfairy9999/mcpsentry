#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { evaluateCorpus, formatScore } from './corpus/evaluate.js';
import { toJson } from './report/json.js';
import { toMarkdown } from './report/markdown.js';
import { toSarif } from './report/sarif.js';
import { scan } from './scan.js';
import { atOrAbove, type Severity } from './types.js';
import { TOOL_NAME, VERSION } from './version.js';

export interface CliIo {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
}

const DEFAULT_IO: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
};

export async function runCli(argv: string[], io: CliIo = DEFAULT_IO): Promise<number> {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    io.stdout.write(helpText());
    return 0;
  }
  if (args.includes('--version') || args.includes('-v')) {
    io.stdout.write(`${TOOL_NAME} ${VERSION}\n`);
    return 0;
  }
  const command = args[0];
  if (command === 'evaluate') {
    return await runEvaluate(args.slice(1), io);
  }
  if (
    command === 'scan' ||
    command === undefined ||
    command.startsWith('-') ||
    looksLikePath(command)
  ) {
    const scanArgs = command === 'scan' ? args.slice(1) : args;
    return await runScan(scanArgs, io);
  }
  io.stderr.write(`Unknown command "${command}". Use --help for usage.\n`);
  return 2;
}

async function runScan(args: string[], io: CliIo): Promise<number> {
  const flags = parseFlags(args);
  const root = path.resolve(flags.positional[0] ?? '.');
  const rules = flags.list('rules');
  const exclude = flags.list('exclude');
  const probeStdio = flags.get('probe-stdio');
  const probeUrl = flags.get('probe-url');
  const result = await scan({
    root,
    osv: !flags.has('no-osv'),
    ...(rules ? { rules } : {}),
    ...(exclude ? { exclude } : {}),
    ...(probeStdio ? { probeStdio } : {}),
    ...(probeUrl ? { probeUrl } : {}),
  });

  const format = flags.get('format') ?? 'markdown';
  const outDir = flags.get('out');
  const writers: Array<{ name: string; text: string }> = [];
  if (format === 'json' || format === 'all') {
    writers.push({ name: 'mcpsentry-report.json', text: toJson(result) });
  }
  if (format === 'sarif' || format === 'all') {
    writers.push({ name: 'mcpsentry-report.sarif', text: toSarif(result) });
  }
  if (format === 'markdown' || format === 'md' || format === 'all') {
    writers.push({ name: 'mcpsentry-report.md', text: toMarkdown(result) });
  }
  if (writers.length === 0) {
    io.stderr.write(`Unknown format "${format}". Use markdown, json, sarif, or all.\n`);
    return 2;
  }

  if (outDir) {
    await fs.mkdir(outDir, { recursive: true });
    for (const writer of writers) {
      await fs.writeFile(path.join(outDir, writer.name), writer.text, 'utf8');
    }
    io.stdout.write(`Wrote ${writers.length} report(s) to ${path.resolve(outDir)}\n`);
  } else if (writers.length === 1 && writers[0]) {
    io.stdout.write(writers[0].text);
  } else {
    const markdown = writers.find((writer) => writer.name.endsWith('.md'));
    io.stdout.write(markdown?.text ?? writers[0]?.text ?? '');
  }

  const threshold = flags.get('fail-on') ?? 'none';
  if (threshold !== 'none') {
    if (!isSeverity(threshold)) {
      io.stderr.write(
        `Unknown fail-on "${threshold}". Use none, low, medium, high, or critical.\n`,
      );
      return 2;
    }
    const hits = result.findings.filter((item) => atOrAbove(item.severity, threshold));
    if (hits.length > 0) {
      io.stderr.write(`Failing: ${hits.length} finding(s) at or above ${threshold}.\n`);
      return 1;
    }
  }
  return 0;
}

async function runEvaluate(args: string[], io: CliIo): Promise<number> {
  const flags = parseFlags(args);
  const fixturesRoot = path.resolve(flags.get('fixtures') ?? 'fixtures');
  const truthPath = path.resolve(flags.get('truth') ?? path.join(fixturesRoot, 'corpus.json'));
  const score = await evaluateCorpus({ fixturesRoot, truthPath });
  const text = formatScore(score);
  const out = flags.get('out');
  if (out) {
    await fs.writeFile(out, text, 'utf8');
    io.stdout.write(`Wrote corpus score to ${path.resolve(out)}\n`);
  } else {
    io.stdout.write(text);
  }
  return 0;
}

function looksLikePath(value: string): boolean {
  return (
    value === '.' || value.startsWith('./') || value.startsWith('/') || value.startsWith('../')
  );
}

interface Flags {
  positional: string[];
  get(name: string): string | undefined;
  has(name: string): boolean;
  list(name: string): string[] | undefined;
}

function parseFlags(args: string[]): Flags {
  const positional: string[] = [];
  const map = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const cut = arg.indexOf('=');
      if (cut !== -1) {
        const name = arg.slice(2, cut);
        const value = arg.slice(cut + 1);
        const list = map.get(name) ?? [];
        list.push(value);
        map.set(name, list);
        continue;
      }
      const name = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        const list = map.get(name) ?? [];
        list.push(next);
        map.set(name, list);
        i += 1;
      } else {
        map.set(name, ['true']);
      }
      continue;
    }
    positional.push(arg);
  }
  return {
    positional,
    get(name: string): string | undefined {
      const values = map.get(name);
      return values?.[values.length - 1];
    },
    has(name: string): boolean {
      return map.has(name);
    },
    list(name: string): string[] | undefined {
      const values = map.get(name);
      if (!values) {
        return undefined;
      }
      return values.flatMap((value) => value.split(',')).filter(Boolean);
    },
  };
}

function isSeverity(value: string): value is Severity {
  return (
    value === 'critical' ||
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'info'
  );
}

function helpText(): string {
  return `${TOOL_NAME} ${VERSION}
Audit MCP servers for over-broad tools, dishonest annotations, secrets, unsafe sinks, and CVEs.

Usage:
  mcpsentry scan [path] [--format markdown|json|sarif|all] [--out dir]
                 [--fail-on none|low|medium|high|critical]
                 [--rules MCP001,MCP002] [--exclude dir]
                 [--probe-stdio "node server.js"] [--probe-url http://127.0.0.1:8787/mcp]
                 [--no-osv]
  mcpsentry evaluate [--fixtures fixtures] [--truth fixtures/corpus.json] [--out score.md]
  mcpsentry --version
`;
}

async function main(): Promise<void> {
  const code = await runCli(process.argv);
  process.exitCode = code;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

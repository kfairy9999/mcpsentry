import path from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';

import { findingsFromProbe } from '../../src/probe/findings.js';
import { consume, encode, probeHttp, probeStdio } from '../../src/probe/protocol.js';
import { fixturePath } from '../helpers/scan.js';

describe('live tools/list probe', () => {
  it('lists tools over stdio and flags missing annotations plus an unconstrained command (true positives)', async () => {
    const command = `node ${fixturePath('vulnerable/probe-unannotated/server.mjs')}`;
    const probe = await probeStdio({ command, timeoutMs: 5_000 });
    expect(probe.tools.map((tool) => tool.name)).toEqual(['run_command']);
    const findings = findingsFromProbe(probe, command);
    expect(findings.some((item) => item.ruleId === 'MCP002')).toBe(true);
    expect(
      findings.some((item) => item.ruleId === 'MCP003' && item.toolName === 'run_command'),
    ).toBe(true);
  });

  it('accepts an annotated tools/list with an enum parameter (false positive case)', async () => {
    const command = `node ${fixturePath('clean/probe-annotated/server.mjs')}`;
    const probe = await probeStdio({ command, timeoutMs: 5_000 });
    expect(findingsFromProbe(probe, command)).toEqual([]);
  });

  it('lists tools over HTTP', async () => {
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
        if (body.method === 'initialize') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { protocolVersion: '2025-03-26', serverInfo: { name: 'http-fixture' } },
            }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { tools: [{ name: 'ping', annotations: { readOnlyHint: true } }] },
          }),
        );
      })();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected a TCP address');
    }
    try {
      const probe = await probeHttp({ url: `http://127.0.0.1:${address.port}/mcp` });
      expect(probe.serverName).toBe('http-fixture');
      expect(probe.tools[0]?.name).toBe('ping');
    } finally {
      server.close();
    }
  });

  it('parses both Content-Length and NDJSON frames', () => {
    const message = { jsonrpc: '2.0', id: 1, result: { ok: true } };
    const framed = encode(message);
    const seen: unknown[] = [];
    const first = consume(framed, 'unknown', (item) => seen.push(item));
    expect(seen).toHaveLength(1);
    expect(first.buffer.length).toBe(0);

    const ndjson = Buffer.from(`${JSON.stringify(message)}\n`, 'utf8');
    const second = consume(ndjson, 'unknown', (item) => seen.push(item));
    expect(seen).toHaveLength(2);
    expect(second.mode).toBe('ndjson');
  });
});

afterAll(() => {
  // Keep the import used so path stays available if the probe path changes.
  expect(path.basename(fixturePath('clean/probe-annotated/server.mjs'))).toBe('server.mjs');
});

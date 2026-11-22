#!/usr/bin/env node
import { Buffer } from 'node:buffer';

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  buffer = consume(buffer, handle);
});

function handle(message) {
  if (message.method === 'initialize') {
    reply(message.id, {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'probe-annotated', version: '0.0.0' },
    });
    return;
  }
  if (message.method === 'notifications/initialized') {
    return;
  }
  if (message.method === 'tools/list') {
    reply(message.id, {
      tools: [
        {
          name: 'list_notes',
          description: 'Lists notes in a fixed sandbox folder.',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          inputSchema: {
            type: 'object',
            properties: { directory: { type: 'string', enum: ['inbox', 'archive'] } },
          },
        },
      ],
    });
  }
}

function reply(id, result) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, result }), 'utf8');
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function consume(buf, onMessage) {
  let current = buf;
  for (;;) {
    const text = current.toString('utf8');
    const headerEnd = text.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return current;
    }
    const header = text.slice(0, headerEnd);
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      return current.subarray(headerEnd + 4);
    }
    const length = Number.parseInt(match[1], 10);
    const start = Buffer.byteLength(text.slice(0, headerEnd + 4), 'utf8');
    if (current.length < start + length) {
      return current;
    }
    const body = current.subarray(start, start + length).toString('utf8');
    current = current.subarray(start + length);
    onMessage(JSON.parse(body));
  }
}

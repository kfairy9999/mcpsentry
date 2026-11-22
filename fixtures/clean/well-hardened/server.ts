import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';

const apiKey = process.env.API_KEY ?? '';
const ROOT = path.resolve('/tmp/mcpsentry-fixture-root');
const ALLOWED_COMMANDS = ['status', 'version'] as const;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function createMcp(): McpServer {
  const server = new McpServer({ name: 'hardened-fixture', version: '0.0.0' });

  server.registerTool(
    'list_notes',
    {
      title: 'List notes',
      description: 'Lists note filenames inside the sandbox. Previous notes that were deleted are ignored.',
      inputSchema: { directory: z.enum(['inbox', 'archive']) },
      annotations: READ_ONLY,
    },
    async ({ directory }: { directory: 'inbox' | 'archive' }) => {
      const target = path.join(ROOT, directory);
      const text = await readFile(path.join(target, '.keep'), 'utf8').catch(() => '');
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'run_status',
    {
      title: 'Run status',
      description: 'Runs one of two allowlisted status commands.',
      inputSchema: { command: z.enum(ALLOWED_COMMANDS) },
      annotations: READ_ONLY,
    },
    async ({ command }: { command: (typeof ALLOWED_COMMANDS)[number] }) => {
      return { content: [{ type: 'text', text: command }] };
    },
  );

  server.registerTool(
    'append_audit',
    {
      title: 'Append audit',
      description: 'Appends a short audit line to the sandbox log.',
      inputSchema: { body: z.string().max(200) },
      annotations: WRITE,
    },
    async ({ body }: { body: string }) => {
      return { content: [{ type: 'text', text: `queued ${body.length} ${apiKey.length}` }] };
    },
  );

  return server;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function handle(req: IncomingMessage, res: ServerResponse): void {
  if (req.url !== '/mcp') {
    res.statusCode = 404;
    res.end();
    return;
  }
  const authorization = req.headers.authorization ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.slice(7) !== (process.env.AUTH_TOKEN ?? '')) {
    res.statusCode = 401;
    res.end('unauthorized');
    return;
  }
  const now = Date.now();
  const key = req.socket.remoteAddress ?? 'unknown';
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
  } else if (current.count >= 60) {
    res.statusCode = 429;
    res.setHeader('retry-after', '60');
    res.end('rate limited');
    return;
  } else {
    current.count += 1;
  }
  res.end('mcp');
}

export function listen(port: number): void {
  createServer(handle).listen(port);
}

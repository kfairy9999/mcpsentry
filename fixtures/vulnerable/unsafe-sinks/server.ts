import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'sinks-fixture', version: '0.0.0' });

  server.registerTool(
    'eval_code',
    {
      title: 'Eval code',
      description: 'Evaluates JavaScript from the model.',
      inputSchema: { code: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ code }: { code: string }) => {
      const value = eval(code);
      return { content: [{ type: 'text', text: String(value) }] };
    },
  );

  server.registerTool(
    'write_note',
    {
      title: 'Write note',
      description: 'Writes a note to a path chosen by the model.',
      inputSchema: { path: z.string(), body: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ path, body }: { path: string; body: string }) => {
      await writeFile(path, body, 'utf8');
      return { content: [{ type: 'text', text: 'wrote' }] };
    },
  );

  server.registerTool(
    'fetch_url',
    {
      title: 'Fetch URL',
      description: 'Fetches a URL chosen by the model.',
      inputSchema: { url: z.string() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ url }: { url: string }) => {
      const response = await fetch(url);
      const text = await response.text();
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'shell_out',
    {
      title: 'Shell out',
      description: 'Runs a command string.',
      inputSchema: { command: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ command }: { command: string }) => {
      exec(command, () => undefined);
      return { content: [{ type: 'text', text: 'started' }] };
    },
  );

  return server;
}

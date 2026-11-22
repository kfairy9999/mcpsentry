import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';

const execAsync = promisify(exec);

export function createServer(): McpServer {
  const server = new McpServer({ name: 'overbroad-fixture', version: '0.0.0' });

  server.registerTool(
    'run_command',
    {
      title: 'Run command',
      description: 'Runs a shell command chosen by the model.',
      inputSchema: { command: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ command }: { command: string }) => {
      const { stdout } = await execAsync(command);
      return { content: [{ type: 'text', text: stdout }] };
    },
  );

  server.registerTool(
    'read_file',
    {
      title: 'Read file',
      description: 'Reads any path the model provides.',
      inputSchema: { path: z.string() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path }: { path: string }) => {
      const text = await readFile(path, 'utf8');
      return { content: [{ type: 'text', text }] };
    },
  );

  return server;
}

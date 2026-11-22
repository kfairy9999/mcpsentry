import { execSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'dishonest-fixture', version: '0.0.0' });

  server.registerTool(
    'cleanup_temp',
    {
      title: 'Cleanup temp',
      description: 'Deletes a temporary file.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ path }: { path: string }) => {
      unlinkSync(path);
      return { content: [{ type: 'text', text: 'deleted' }] };
    },
  );

  server.registerTool(
    'run_maintenance',
    {
      title: 'Run maintenance',
      description: 'Runs a local maintenance command.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async () => {
      execSync('rm -rf /tmp/fixture-only');
      return { content: [{ type: 'text', text: 'done' }] };
    },
  );

  return server;
}

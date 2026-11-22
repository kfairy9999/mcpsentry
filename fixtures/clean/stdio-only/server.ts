import { McpServer } from '@modelcontextprotocol/server';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createServer(): McpServer {
  const server = new McpServer({ name: 'stdio-clean', version: '0.0.0' });
  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Echoes a short message back to the client.',
      annotations: READ_ONLY,
    },
    async () => ({ content: [{ type: 'text', text: 'ok' }] }),
  );
  return server;
}

import { McpServer } from '@modelcontextprotocol/server';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'missing-annotations', version: '0.0.0' });
  server.registerTool(
    'status',
    { title: 'Status', description: 'Returns ok.' },
    async () => ({ content: [{ type: 'text', text: 'ok' }] }),
  );
  return server;
}

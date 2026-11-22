import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/server';

export function createMcp(): McpServer {
  const server = new McpServer({ name: 'no-auth-fixture', version: '0.0.0' });
  server.registerTool(
    'status',
    {
      title: 'Status',
      description: 'Returns service status.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => ({ content: [{ type: 'text', text: 'ok' }] }),
  );
  return server;
}

export function listen(port: number): void {
  const server = createServer((req, res) => {
    if (req.url === '/mcp') {
      res.end('mcp');
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port);
}

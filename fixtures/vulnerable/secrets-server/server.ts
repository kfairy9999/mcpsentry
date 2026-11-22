import { McpServer } from '@modelcontextprotocol/server';

// Intentionally vulnerable fixture for MCPSentry. The value is fake and not a real credential.
const databasePassword = 'Hunter2-Fixture-Only-Do-Not-Use';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'secrets-fixture', version: '0.0.0' });
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Returns ok.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => ({ content: [{ type: 'text', text: `ok ${databasePassword.length}` }] }),
  );
  return server;
}

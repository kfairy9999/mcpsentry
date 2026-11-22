import { McpServer } from '@modelcontextprotocol/server';

const apiKey = 'YOUR_API_KEY_HERE';
const credentials = { password: 'changeme-placeholder' };

export function createServer(): McpServer {
  const server = new McpServer({ name: 'placeholders', version: '0.0.0' });
  server.registerTool(
    'health',
    {
      title: 'Health',
      description: 'Returns ok. Mentions of previous instructions in this sentence are not a jailbreak.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => ({ content: [{ type: 'text', text: `${apiKey.length}:${credentials.password.length}` }] }),
  );
  return server;
}

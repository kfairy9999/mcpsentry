import { describe, expect, it } from 'vitest';

import { extractToolsFromTypeScript } from '../../src/extract/typescript.js';
import { scanFixture } from '../helpers/scan.js';

describe('TypeScript tool extraction', () => {
  it('reads registerTool metadata, annotation constants, and handler names', async () => {
    const result = await scanFixture('clean/well-hardened');
    const names = result.tools.map((tool) => tool.name).sort();
    expect(names).toEqual(['append_audit', 'list_notes', 'run_status']);
    const list = result.tools.find((tool) => tool.name === 'list_notes');
    expect(list?.hasAnnotations).toBe(true);
    expect(list?.readOnlyHint).toBe(true);
    expect(list?.destructiveHint).toBe(false);
  });

  it('supports the older server.tool(name, description, schema, handler) shape', () => {
    const source = `
      server.tool('run_command', 'Runs a command.', { command: z.string() }, async ({ command }) => {
        exec(command);
      });
    `;
    const tools = extractToolsFromTypeScript('legacy.ts', source);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('run_command');
    expect(tools[0]?.description).toBe('Runs a command.');
    expect(tools[0]?.parameters[0]?.name).toBe('command');
    expect(tools[0]?.handlerParamNames).toContain('command');
  });

  it('resolves spread annotations such as { ...WRITE, idempotentHint: true }', () => {
    const source = `
      const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
      server.registerTool('log_interaction', { description: 'Log it.', annotations: { ...WRITE, idempotentHint: true } }, async () => {
        return { content: [{ type: 'text', text: 'ok' }] };
      });
    `;
    const tools = extractToolsFromTypeScript('spread.ts', source);
    expect(tools[0]?.annotations?.readOnlyHint).toBe(false);
    expect(tools[0]?.annotations?.destructiveHint).toBe(false);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });
});

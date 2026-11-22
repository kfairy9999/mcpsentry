import { describe, expect, it } from 'vitest';

import { extractToolsFromPython } from '../../src/extract/python.js';
import { annotationsRule } from '../../src/rules/annotations.js';
import { sinksRule } from '../../src/rules/sinks.js';
import type { RuleContext } from '../../src/rules/types.js';
import type { HttpSignals } from '../../src/types.js';

const emptyHttp: HttpSignals = {
  hasHttpTransport: false,
  hasAuth: false,
  hasRateLimit: false,
  evidenceFiles: [],
};

describe('Python tool extraction', () => {
  it('extracts @mcp.tool handlers, annotations, and tainted subprocess sinks', () => {
    const source = `
from mcp.server.fastmcp import FastMCP
import subprocess

mcp = FastMCP("demo")

@mcp.tool(readOnlyHint=True, destructiveHint=False)
async def run_command(command: str) -> str:
    """Runs a shell command."""
    return subprocess.check_output(command, shell=True).decode()
`;
    const tools = extractToolsFromPython('server.py', source);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('run_command');
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
    expect(tools[0]?.parameters[0]?.name).toBe('command');
    const ctx = {
      root: '.',
      files: [],
      tools,
      http: emptyHttp,
      lockfiles: [],
      options: { root: '.' },
    } satisfies RuleContext;
    const annotations = annotationsRule.scan(ctx);
    const sinks = sinksRule.scan(ctx);
    expect(Array.isArray(annotations) ? annotations.length : 0).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(sinks) ? sinks.length : 0).toBeGreaterThanOrEqual(1);
  });

  it('does not invent tools when there are no decorators (false positive case)', () => {
    const source = `def run_command(command: str) -> str:\n    return command\n`;
    expect(extractToolsFromPython('plain.py', source)).toEqual([]);
  });
});

describe('Python extraction edge cases', () => {
  it('parses named tools, multiline docstrings, and typed parameters', () => {
    const source = `@mcp.tool(
    name="wipe_cache",
    readOnlyHint=False,
    destructiveHint=True,
)
def wipe_cache(path: str, recursive: bool = False) -> str:
    """Clears an on-disk cache.

    This is a longer docstring.
    """
    os.system(path)
    return path

@server.tool()
async def skip_self(self, *args, code: str):
    exec(code)
    return True
`;
    const tools = extractToolsFromPython('tools.py', source);
    const wipe = tools.find((tool) => tool.name === 'wipe_cache');
    expect(wipe?.annotations?.destructiveHint).toBe(true);
    expect(wipe?.description).toContain('Clears an on-disk cache');
    expect(wipe?.parameters.some((parameter) => parameter.name === 'path')).toBe(true);
    const execTool = tools.find((tool) => tool.name === 'skip_self');
    expect(execTool?.handlerParamNames).toContain('code');
  });
});

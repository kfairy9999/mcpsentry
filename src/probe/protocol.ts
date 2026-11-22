import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';

type Bytes = ReturnType<typeof Buffer.concat>;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code?: number; message?: string };
}

export interface ListedTool {
  name: string;
  description?: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  inputSchema?: unknown;
}

export interface ProbeResult {
  tools: ListedTool[];
  protocolVersion?: string;
  serverName?: string;
}

export interface StdioProbeOptions {
  command: string;
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export async function probeStdio(options: StdioProbeOptions): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const tokens = tokenize(options.command);
  const file = tokens[0];
  if (!file) {
    throw new Error('Probe command is empty');
  }
  const child = spawn(file, tokens.slice(1), {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const pending = new Map<number, (value: JsonRpcResponse) => void>();
  let buffer: Bytes = Buffer.alloc(0);
  let mode: 'unknown' | 'lsp' | 'ndjson' = 'unknown';

  const onData = (chunk: Bytes): void => {
    buffer = Buffer.concat([buffer, chunk]);
    ({ buffer, mode } = consume(buffer, mode, (message) => {
      if (typeof message.id === 'number') {
        const resolve = pending.get(message.id);
        if (resolve) {
          pending.delete(message.id);
          resolve(message);
        }
      }
    }));
  };
  child.stdout?.on('data', onData);

  const stderr: Buffer[] = [];
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr.push(chunk);
  });

  let nextId = 1;
  const send = async (
    method: string,
    params?: Record<string, unknown>,
  ): Promise<JsonRpcResponse> => {
    const id = nextId++;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method };
    if (params) {
      request.params = params;
    }
    const payload = encode(request);
    return await new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin?.write(payload, (error) => {
        if (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        }
      });
    });
  };

  try {
    const init = await send('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'mcpsentry', version: '0.1.0' },
    });
    if (init.error) {
      throw new Error(init.error.message ?? 'initialize failed');
    }
    child.stdin?.write(encode({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));
    const listed = await send('tools/list', {});
    if (listed.error) {
      throw new Error(listed.error.message ?? 'tools/list failed');
    }
    const result = (listed.result ?? {}) as { tools?: ListedTool[] };
    const initResult = (init.result ?? {}) as {
      protocolVersion?: string;
      serverInfo?: { name?: string };
    };
    const tools = Array.isArray(result.tools) ? result.tools : [];
    const probe: ProbeResult = { tools };
    if (initResult.protocolVersion) {
      probe.protocolVersion = initResult.protocolVersion;
    }
    if (initResult.serverInfo?.name) {
      probe.serverName = initResult.serverInfo.name;
    }
    return probe;
  } finally {
    child.kill('SIGTERM');
    await waitClose(child, 1_000);
  }
}

export interface HttpProbeOptions {
  url: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  headers?: Record<string, string>;
}

export async function probeHttp(options: HttpProbeOptions): Promise<ProbeResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  let id = 1;
  const post = async (
    method: string,
    params?: Record<string, unknown>,
  ): Promise<JsonRpcResponse> => {
    const request: JsonRpcRequest = { jsonrpc: '2.0', id: id++, method };
    if (params) {
      request.params = params;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(options.headers ?? {}),
      };
      const response = await fetcher(options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP probe failed with status ${response.status}`);
      }
      const payload = (await response.json()) as JsonRpcResponse;
      return payload;
    } finally {
      clearTimeout(timer);
    }
  };

  const init = await post('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'mcpsentry', version: '0.1.0' },
  });
  if (init.error) {
    throw new Error(init.error.message ?? 'initialize failed');
  }
  await post('notifications/initialized', {});
  const listed = await post('tools/list', {});
  if (listed.error) {
    throw new Error(listed.error.message ?? 'tools/list failed');
  }
  const result = (listed.result ?? {}) as { tools?: ListedTool[] };
  const initResult = (init.result ?? {}) as {
    protocolVersion?: string;
    serverInfo?: { name?: string };
  };
  const tools = Array.isArray(result.tools) ? result.tools : [];
  const probe: ProbeResult = { tools };
  if (initResult.protocolVersion) {
    probe.protocolVersion = initResult.protocolVersion;
  }
  if (initResult.serverInfo?.name) {
    probe.serverName = initResult.serverInfo.name;
  }
  return probe;
}

export function encode(message: object): Bytes {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8');
  return Buffer.concat([header, body]);
}

export function consume(
  buffer: Bytes,
  mode: 'unknown' | 'lsp' | 'ndjson',
  onMessage: (message: JsonRpcResponse) => void,
): { buffer: Bytes; mode: 'unknown' | 'lsp' | 'ndjson' } {
  let current = buffer;
  let currentMode = mode;
  while (current.length > 0) {
    if (currentMode === 'unknown') {
      const preview = current.toString('utf8', 0, Math.min(current.length, 32)).trimStart();
      currentMode = preview.startsWith('{') ? 'ndjson' : 'lsp';
    }
    if (currentMode === 'ndjson') {
      const newline = current.indexOf(0x0a);
      if (newline === -1) {
        break;
      }
      const line = current.subarray(0, newline).toString('utf8').trim();
      current = current.subarray(newline + 1);
      if (line) {
        onMessage(JSON.parse(line) as JsonRpcResponse);
      }
      continue;
    }
    const headerEnd = indexOfHeaderEnd(current);
    if (headerEnd === -1) {
      break;
    }
    const header = current.subarray(0, headerEnd).toString('utf8');
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match?.[1]) {
      current = current.subarray(headerEnd + 4);
      continue;
    }
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (current.length < bodyStart + length) {
      break;
    }
    const body = current.subarray(bodyStart, bodyStart + length).toString('utf8');
    current = current.subarray(bodyStart + length);
    onMessage(JSON.parse(body) as JsonRpcResponse);
  }
  return { buffer: current, mode: currentMode };
}

function indexOfHeaderEnd(buffer: Buffer): number {
  const text = buffer.toString('utf8');
  const index = text.indexOf('\r\n\r\n');
  return index === -1 ? -1 : Buffer.byteLength(text.slice(0, index), 'utf8');
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: string | undefined;
  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ' ' || char === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function waitClose(
  child: { killed: boolean; on: (event: string, fn: () => void) => void },
  ms: number,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    child.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

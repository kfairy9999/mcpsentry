export type SinkKind = 'shell' | 'eval' | 'fs-write' | 'fs-delete' | 'network' | 'sql-write';

export interface DetectedSink {
  kind: SinkKind;
  text: string;
  usesTaintedInput: boolean;
}

const SHELL_SINKS =
  /\b(?:execSync|execFileSync|spawnSync|execAsync|execFileAsync|exec|execFile|spawn|child_process|os\.system|os\.popen|subprocess\.(?:call|run|Popen|check_output|check_call)|popen|commands\.getoutput)\s*\(/;

const FS_WRITE_SINKS =
  /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|outputFile|createWriteStream|mkdirSync|mkdir|copyFileSync|copyFile|renameSync|rename|chmodSync|chmod|fs\.write)\s*\(/;

const FS_DELETE_SINKS = /\b(?:unlinkSync|unlink|rmSync|rm|rmdirSync|rmdir|rimraf)\s*\(/;

const NETWORK_SINKS =
  /\b(?:fetch|axios|got|request|http\.request|https\.request|http\.get|https\.get|urllib\.request|requests\.(?:get|post|put|delete|request)|httpx\.(?:get|post|request))\s*\(/;

const SQL_WRITE = /\b(?:DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE)\b/i;

const WRITE_METHOD_NAMES =
  /\.(?:create|update|upsert|insert|save|delete|remove|destroy|drop|exec|execute|run)\s*\(/;

export function detectSinks(handlerText: string, taintNames: string[]): DetectedSink[] {
  const sinks: DetectedSink[] = [];
  push(sinks, handlerText, taintNames, SHELL_SINKS, 'shell');
  // Avoid treating child_process.exec as eval: only flag bare eval / Function / vm / Python exec when not already a shell sink line.
  pushEval(sinks, handlerText, taintNames);
  push(sinks, handlerText, taintNames, FS_WRITE_SINKS, 'fs-write');
  push(sinks, handlerText, taintNames, FS_DELETE_SINKS, 'fs-delete');
  push(sinks, handlerText, taintNames, NETWORK_SINKS, 'network');
  if (SQL_WRITE.test(handlerText)) {
    sinks.push({
      kind: 'sql-write',
      text: firstMatch(handlerText, SQL_WRITE),
      usesTaintedInput: usesTaint(handlerText, taintNames),
    });
  }
  if (WRITE_METHOD_NAMES.test(handlerText) && !sinks.some((sink) => sink.kind === 'sql-write')) {
    // Repository-style writes count as non-read-only behavior.
    sinks.push({
      kind: 'sql-write',
      text: firstMatch(handlerText, WRITE_METHOD_NAMES),
      usesTaintedInput: usesTaint(handlerText, taintNames),
    });
  }
  return sinks;
}

function push(
  sinks: DetectedSink[],
  handlerText: string,
  taintNames: string[],
  pattern: RegExp,
  kind: SinkKind,
): void {
  const global = new RegExp(pattern.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = global.exec(handlerText))) {
    const snippet = snippetAround(handlerText, match.index, match[0].length);
    sinks.push({
      kind,
      text: match[0],
      usesTaintedInput: usesTaint(snippet, taintNames),
    });
  }
}

function pushEval(sinks: DetectedSink[], handlerText: string, taintNames: string[]): void {
  const pattern =
    /\b(?:eval|Function)\s*\(|\bnew\s+Function\s*\(|\bvm\.(?:runInNewContext|runInThisContext|runInContext)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(handlerText))) {
    const text = match[0];
    const snippet = snippetAround(handlerText, match.index, text.length);
    sinks.push({
      kind: 'eval',
      text,
      usesTaintedInput: usesTaint(snippet, taintNames),
    });
  }
  // Python's builtin exec is a code-evaluation sink; child_process.exec is handled as shell.
  const pythonExec = /(?<!\.)\bexec\s*\(/g;
  while ((match = pythonExec.exec(handlerText))) {
    const before = handlerText.slice(Math.max(0, match.index - 30), match.index);
    if (/child_process|execSync|execAsync|subprocess/.test(before)) {
      continue;
    }
    // In TypeScript/JavaScript, a bare exec( is almost always child_process.exec.
    // Only treat it as eval when the handler also looks like Python (def, self, or no braces).
    const looksPython = /\bdef\s+|\bself\.|\bos\.system\b/.test(handlerText);
    if (!looksPython) {
      continue;
    }
    const text = match[0];
    const snippet = snippetAround(handlerText, match.index, text.length);
    sinks.push({
      kind: 'eval',
      text,
      usesTaintedInput: usesTaint(snippet, taintNames),
    });
  }
}

export function usesTaint(snippet: string, taintNames: string[]): boolean {
  if (/\b(?:args|input|params|arguments)\.[A-Za-z_][\w]*/.test(snippet)) {
    return true;
  }
  if (taintNames.length === 0) {
    return false;
  }
  return taintNames.some((name) => {
    const pattern = new RegExp(`\\b(?:args|input|params|arguments)\\.${name}\\b|\\b${name}\\b`);
    return pattern.test(snippet);
  });
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 120);
  return text.slice(start, end);
}

function firstMatch(text: string, pattern: RegExp): string {
  return pattern.exec(text)?.[0] ?? pattern.source;
}

export function isWriteSink(kind: SinkKind): boolean {
  return (
    kind === 'fs-write' ||
    kind === 'fs-delete' ||
    kind === 'shell' ||
    kind === 'eval' ||
    kind === 'sql-write'
  );
}

export function isDestructiveSink(kind: SinkKind): boolean {
  return kind === 'fs-delete' || kind === 'shell' || kind === 'eval' || kind === 'sql-write';
}

export function lineNumberAt(content: string, index: number): number {
  let line = 1;
  const limit = Math.min(index, content.length);
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

export function columnAt(content: string, index: number): number {
  const start = content.lastIndexOf('\n', Math.max(0, index - 1));
  if (start === -1) {
    return index + 1;
  }
  return index - start;
}

export function lineAtNumber(content: string, line: number): string {
  const lines = content.split('\n');
  return lines[line - 1] ?? '';
}

export function excerptForLine(content: string, line: number, max = 160): string {
  const raw = lineAtNumber(content, line).trim();
  if (raw.length <= max) {
    return raw;
  }
  return `${raw.slice(0, max - 1)}…`;
}

export function indexOfLine(content: string, line: number): number {
  if (line <= 1) {
    return 0;
  }
  let current = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      current += 1;
      if (current === line) {
        return i + 1;
      }
    }
  }
  return content.length;
}

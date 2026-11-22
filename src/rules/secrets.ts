import type { Finding } from '../types.js';
import { excerptForLine, lineNumberAt } from '../util/text.js';
import { finding, type Rule, type RuleContext } from './types.js';

const ASSIGNMENT =
  /\b([A-Za-z_][\w]*)\b(?:\s*:\s*[A-Za-z_][\w.<>,\s|]*)?\s*=\s*(['"])([^'"]{8,})\2/g;

const OBJECT_PROP = /(?:['"]?([A-Za-z_][\w]*)['"]?)\s*:\s*(['"])([^'"]{8,})\2/g;

function isSecretName(name: string): boolean {
  const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return /(?:^|_|-)(?:api[_-]?key|secret|password|passwd|pwd|token|access[_-]?key|private[_-]?key|auth[_-]?token|client[_-]?secret|secret[_-]?key|secret[_-]?access[_-]?key)(?:[_-]|$)/i.test(
    snake,
  );
}

const PLACEHOLDER =
  /^(your[_-]?|my[_-]?|replace[_-]?.+|changeme|placeholder|example|sample|dummy|redacted|todo|xxx+|<.*>|\{.*\}|\[.*\]|not[_-]?a[_-]?real|fake|test[_-]?key[_-]?here)/i;

const ENV_LOOKUP = /process\.env|os\.environ|os\.getenv|Deno\.env/;

export const secretsRule: Rule = {
  id: 'MCP001',
  name: 'hardcoded-secret',
  description: 'Flags secret-like values hardcoded in source instead of read from the environment.',
  scan(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of ctx.files) {
      if (file.language === 'other') {
        continue;
      }
      // Example env templates and test doubles are allowed to contain fixture values.
      if (file.relativePath.endsWith('.env.example') || file.relativePath.endsWith('.example')) {
        continue;
      }
      if (isTestPath(file.relativePath)) {
        continue;
      }
      collect(file.content, file.relativePath, ASSIGNMENT, findings);
      collect(file.content, file.relativePath, OBJECT_PROP, findings);
    }
    return findings;
  },
};

function collect(
  content: string,
  relativePath: string,
  pattern: RegExp,
  findings: Finding[],
): void {
  const global = new RegExp(pattern.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = global.exec(content))) {
    const name = match[1] ?? '';
    const value = match[3] ?? '';
    if (!isSecretName(name)) {
      continue;
    }
    if (isPlaceholder(value)) {
      continue;
    }
    const start = match.index;
    const line = content.slice(Math.max(0, start - 80), start + match[0].length);
    if (ENV_LOOKUP.test(line)) {
      continue;
    }
    const startLine = lineNumberAt(content, start);
    findings.push(
      finding({
        ruleId: 'MCP001',
        ruleName: 'hardcoded-secret',
        severity: 'high',
        message: `Hardcoded secret-like value assigned to "${name}".`,
        advice:
          'Move the value to an environment variable or a secret manager and read it at runtime. Do not commit credentials, even for development.',
        file: relativePath,
        startLine,
        endLine: startLine,
        excerpt: excerptForLine(content, startLine),
      }),
    );
  }
}

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return true;
  }
  if (PLACEHOLDER.test(trimmed)) {
    return true;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  // Repeated characters or obvious masks.
  if (/^[A-Zx*]{8,}$/i.test(trimmed) && new Set(trimmed.toLowerCase()).size <= 2) {
    return true;
  }
  return false;
}

export function isTestPath(relativePath: string): boolean {
  const posix = relativePath.replace(/\\/g, '/');
  if (/(?:^|\/)(?:test|tests|__tests__|spec)(?:\/|$)/.test(posix)) {
    return true;
  }
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(posix);
}

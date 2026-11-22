import type { HttpSignals, ProjectFile } from './types.js';

const HTTP_PATTERNS: RegExp[] = [
  /from\s+['"]node:https?['"]/,
  /from\s+['"]https?['"]/,
  /require\s*\(\s*['"](?:node:)?https?['"]/,
  /\bhttp[s]?\.createServer\s*\(/,
  /\bcreateServer\s*\(\s*(?:async\s*)?(?:function\b|\()/,
  /\bserveHttp\s*\(/,
  /\bexpress\s*\(/,
  /\bfastify\s*\(/,
  /\bnew\s+Hono\s*\(/,
  /\bDeno\.serve\s*\(/,
  /export\s+default\s+\{[\s\S]{0,200}\bfetch\s*\(/,
  /['"`]\/mcp['"`]/,
  /\bStreamableHTTP/,
];

const AUTH_PATTERNS: RegExp[] = [
  /\bauthorization\b/i,
  /\bbearer\b/i,
  /\bx-api-key\b/i,
  /\bapi[_-]?key\b/i,
  /\bAUTH[_-]?TOKEN\b/,
  /\brequireAuth\b/,
  /\bwww-authenticate\b/i,
  /\bunauthorized\b/i,
  /\bstatus\s*[:=]\s*401\b/,
  /\b401\b/,
];

const RATE_LIMIT_PATTERNS: RegExp[] = [
  /\brate[_-]?limit/i,
  /\bRateLimiter\b/,
  /\bretry-after\b/i,
  /\brequests?\s+per\s+minute\b/i,
  /\btokensPerMinute\b/,
  /\b\brpm\b/,
  /\b429\b/,
];

function matchesAny(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

export function detectHttpSignals(files: ProjectFile[]): HttpSignals {
  const evidence: string[] = [];
  let hasHttpTransport = false;
  let hasAuth = false;
  let hasRateLimit = false;

  for (const file of files) {
    if (file.language === 'other') {
      continue;
    }
    if (matchesAny(file.content, HTTP_PATTERNS)) {
      hasHttpTransport = true;
      evidence.push(file.relativePath);
    }
    if (matchesAny(file.content, AUTH_PATTERNS)) {
      hasAuth = true;
    }
    if (matchesAny(file.content, RATE_LIMIT_PATTERNS)) {
      hasRateLimit = true;
    }
  }

  return { hasHttpTransport, hasAuth, hasRateLimit, evidenceFiles: evidence };
}

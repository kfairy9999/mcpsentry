import type { Finding } from '../types.js';
import { finding, type Rule, type RuleContext } from './types.js';

export const authRule: Rule = {
  id: 'MCP006',
  name: 'missing-auth',
  description: 'Flags HTTP MCP transports that do not appear to authenticate callers.',
  scan(ctx: RuleContext): Finding[] {
    if (!ctx.http.hasHttpTransport || ctx.http.hasAuth) {
      return [];
    }
    const file = ctx.http.evidenceFiles[0] ?? '.';
    const startLine = lineOfSignal(ctx, file) ?? 1;
    const result: Finding[] = [
      finding({
        ruleId: 'MCP006',
        ruleName: 'missing-auth',
        severity: 'high',
        message:
          'An HTTP MCP transport is present, but no authentication check (Authorization header, bearer token, or API key) was found.',
        advice:
          'Require a bearer token or API key on /mcp and reject missing or invalid credentials with 401. stdio-only servers are out of scope for this rule.',
        file,
        startLine,
        excerpt: 'HTTP MCP transport without detected authentication',
      }),
    ];
    return result;
  },
};

export const rateLimitRule: Rule = {
  id: 'MCP007',
  name: 'missing-rate-limit',
  description: 'Flags HTTP MCP transports that do not appear to rate-limit callers.',
  scan(ctx: RuleContext): Finding[] {
    if (!ctx.http.hasHttpTransport || ctx.http.hasRateLimit) {
      return [];
    }
    const file = ctx.http.evidenceFiles[0] ?? '.';
    const startLine = lineOfSignal(ctx, file) ?? 1;
    return [
      finding({
        ruleId: 'MCP007',
        ruleName: 'missing-rate-limit',
        severity: 'medium',
        message: 'An HTTP MCP transport is present, but no rate limiter was found.',
        advice:
          'Cap requests per client (for example 60 requests per minute) and return 429 with Retry-After. This reduces abuse of expensive or destructive tools.',
        file,
        startLine,
        excerpt: 'HTTP MCP transport without detected rate limiting',
      }),
    ];
  },
};

function lineOfSignal(ctx: RuleContext, relativePath: string): number | undefined {
  const file = ctx.files.find((entry) => entry.relativePath === relativePath);
  if (!file) {
    return undefined;
  }
  const match = /\/mcp|createServer|listen\s*\(|new\s+Hono|export\s+default/.exec(file.content);
  if (!match) {
    return 1;
  }
  return file.content.slice(0, match.index).split('\n').length;
}

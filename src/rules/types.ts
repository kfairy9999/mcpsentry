import type {
  ExtractedTool,
  Finding,
  HttpSignals,
  Lockfile,
  ProjectFile,
  ScanOptions,
} from '../types.js';
import type { OsvClient } from '../osv/client.js';

export interface RuleContext {
  root: string;
  files: ProjectFile[];
  tools: ExtractedTool[];
  http: HttpSignals;
  lockfiles: Lockfile[];
  osv?: OsvClient;
  options: ScanOptions;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  scan(ctx: RuleContext): Finding[] | Promise<Finding[]>;
}

export function finding(
  ctx: Pick<
    Finding,
    'ruleId' | 'ruleName' | 'severity' | 'message' | 'advice' | 'file' | 'startLine'
  > &
    Partial<
      Omit<
        Finding,
        'ruleId' | 'ruleName' | 'severity' | 'message' | 'advice' | 'file' | 'startLine'
      >
    >,
): Finding {
  const result: Finding = {
    ruleId: ctx.ruleId,
    ruleName: ctx.ruleName,
    severity: ctx.severity,
    message: ctx.message,
    advice: ctx.advice,
    file: ctx.file,
    startLine: ctx.startLine,
    endLine: ctx.endLine ?? ctx.startLine,
    startColumn: ctx.startColumn ?? 1,
    endColumn: ctx.endColumn ?? 1,
    source: ctx.source ?? 'static',
  };
  if (ctx.toolName !== undefined) {
    result.toolName = ctx.toolName;
  }
  if (ctx.excerpt !== undefined) {
    result.excerpt = ctx.excerpt;
  }
  if (ctx.cve !== undefined) {
    result.cve = ctx.cve;
  }
  return result;
}

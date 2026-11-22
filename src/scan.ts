import path from 'node:path';

import { loadProject } from './extract/project.js';
import { createOsvClient } from './osv/client.js';
import { findingsFromProbe } from './probe/findings.js';
import { probeHttp, probeStdio } from './probe/protocol.js';
import { rulesById } from './rules/registry.js';
import type { RuleContext } from './rules/types.js';
import type {
  Finding,
  ScanOptions,
  ScanResult,
  ScanSummary,
  Severity,
  ToolSummary,
} from './types.js';
import { VERSION } from './version.js';

const EMPTY_SEVERITY: Record<Severity, number> = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
};

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const root = path.resolve(options.root);
  const project = await loadProject(root, options.exclude);
  const rules = rulesById(options.rules);
  const ctx: RuleContext = {
    root,
    files: project.files,
    tools: project.tools,
    http: project.http,
    lockfiles: project.lockfiles,
    options,
  };
  if (options.osv !== false) {
    ctx.osv = createOsvClient(options.osvFetcher ?? fetch);
  }

  const findings: Finding[] = [];
  for (const rule of rules) {
    findings.push(...(await rule.scan(ctx)));
  }

  if (options.probeStdio) {
    const probe = await probeStdio({
      command: options.probeStdio,
      cwd: root,
      ...(options.probeTimeoutMs !== undefined ? { timeoutMs: options.probeTimeoutMs } : {}),
    });
    findings.push(...findingsFromProbe(probe, options.probeStdio));
  }
  if (options.probeUrl) {
    const probe = await probeHttp({
      url: options.probeUrl,
      ...(options.probeTimeoutMs !== undefined ? { timeoutMs: options.probeTimeoutMs } : {}),
    });
    findings.push(...findingsFromProbe(probe, options.probeUrl));
  }

  const tools: ToolSummary[] = project.tools.map((tool) => {
    const summary: ToolSummary = {
      name: tool.name,
      file: tool.file,
      startLine: tool.startLine,
      hasAnnotations: tool.annotations !== undefined,
    };
    if (tool.annotations?.readOnlyHint !== undefined) {
      summary.readOnlyHint = tool.annotations.readOnlyHint;
    }
    if (tool.annotations?.destructiveHint !== undefined) {
      summary.destructiveHint = tool.annotations.destructiveHint;
    }
    return summary;
  });

  const scannedAt = (options.now ?? new Date()).toISOString();
  return {
    toolName: 'MCPSentry',
    version: VERSION,
    scannedAt,
    root,
    findings,
    tools,
    summary: summarize(findings),
  };
}

export function summarize(findings: Finding[]): ScanSummary {
  const bySeverity: Record<Severity, number> = { ...EMPTY_SEVERITY };
  const byRule: Record<string, number> = {};
  for (const item of findings) {
    bySeverity[item.severity] += 1;
    const key = `${item.ruleId} ${item.ruleName}`;
    byRule[key] = (byRule[key] ?? 0) + 1;
  }
  return { count: findings.length, bySeverity, byRule };
}

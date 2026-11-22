import type { OsvFetcher } from './osv/client.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingSource = 'static' | 'probe';

export interface Finding {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  message: string;
  advice: string;
  file: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  source: FindingSource;
  toolName?: string;
  excerpt?: string;
  cve?: string;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolParameter {
  name: string;
  schemaText: string;
  unconstrained: boolean;
  sensitive: boolean;
}

export interface ExtractedTool {
  name: string;
  description: string;
  file: string;
  startLine: number;
  endLine: number;
  annotations: ToolAnnotations | undefined;
  annotationsText: string;
  parameters: ToolParameter[];
  hasInputSchema: boolean;
  handlerText: string;
  handlerParamNames: string[];
  language: 'typescript' | 'python';
}

export interface ProjectFile {
  path: string;
  relativePath: string;
  content: string;
  language: 'typescript' | 'javascript' | 'python' | 'other';
}

export interface HttpSignals {
  hasHttpTransport: boolean;
  hasAuth: boolean;
  hasRateLimit: boolean;
  evidenceFiles: string[];
}

export interface LockfilePackage {
  name: string;
  version: string;
  dev: boolean;
}

export interface Lockfile {
  file: string;
  ecosystem: 'npm';
  packages: LockfilePackage[];
}

export interface ScanOptions {
  root: string;
  rules?: string[];
  exclude?: string[];
  osv?: boolean;
  osvFetcher?: OsvFetcher;
  probeStdio?: string;
  probeUrl?: string;
  probeTimeoutMs?: number;
  now?: Date;
}

export interface ToolSummary {
  name: string;
  file: string;
  startLine: number;
  hasAnnotations: boolean;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}

export interface ScanResult {
  toolName: 'MCPSentry';
  version: string;
  scannedAt: string;
  root: string;
  findings: Finding[];
  tools: ToolSummary[];
  summary: ScanSummary;
}

export interface ScanSummary {
  count: number;
  bySeverity: Record<Severity, number>;
  byRule: Record<string, number>;
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function atOrAbove(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

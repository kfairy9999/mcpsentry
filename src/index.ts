export { scan, summarize } from './scan.js';
export { runCli } from './cli.js';
export { toJson } from './report/json.js';
export { toMarkdown } from './report/markdown.js';
export { toSarif } from './report/sarif.js';
export { evaluateCorpus, formatScore } from './corpus/evaluate.js';
export { RULES } from './rules/registry.js';
export { VERSION, TOOL_NAME } from './version.js';
export type { Finding, ScanOptions, ScanResult, Severity } from './types.js';

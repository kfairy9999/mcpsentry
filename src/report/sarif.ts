import type { Finding, ScanResult, Severity } from '../types.js';
import { RULES } from '../rules/registry.js';
import { TOOL_NAME } from '../version.js';

interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: Array<{
        id: string;
        name: string;
        shortDescription: { text: string };
        help: { text: string };
        defaultConfiguration: { level: 'error' | 'warning' | 'note' };
      }>;
    };
  };
  results: SarifResult[];
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; startColumn: number; endLine: number; endColumn: number };
    };
  }>;
}

export function toSarif(result: ScanResult): string {
  const rules = RULES.map((rule) => ({
    id: rule.id,
    name: rule.name,
    shortDescription: { text: rule.description },
    help: { text: rule.description },
    defaultConfiguration: { level: 'warning' as const },
  }));
  const run: SarifRun = {
    tool: {
      driver: {
        name: TOOL_NAME,
        version: result.version,
        informationUri: 'https://github.com/kfairley9999/mcpsentry',
        rules,
      },
    },
    results: result.findings.map(toResult),
  };
  const log: SarifLog = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [run],
  };
  return `${JSON.stringify(log, null, 2)}\n`;
}

function toResult(item: Finding): SarifResult {
  const result: SarifResult = {
    ruleId: item.ruleId,
    level: levelOf(item.severity),
    message: { text: item.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: item.file },
          region: {
            startLine: item.startLine,
            startColumn: item.startColumn,
            endLine: item.endLine,
            endColumn: Math.max(item.endColumn, item.startColumn),
          },
        },
      },
    ],
  };
  return result;
}

function levelOf(severity: Severity): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') {
    return 'error';
  }
  if (severity === 'medium') {
    return 'warning';
  }
  return 'note';
}

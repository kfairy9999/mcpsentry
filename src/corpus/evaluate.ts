import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { OsvFetcher } from '../osv/client.js';
import { scan } from '../scan.js';
import type { Finding } from '../types.js';

export interface ExpectedFinding {
  ruleId: string;
  file?: string;
  excerpt?: string;
  toolName?: string;
}

export interface CorpusCase {
  path: string;
  expected: ExpectedFinding[];
}

export interface CorpusFile {
  fixtures: CorpusCase[];
}

export interface CaseScore {
  path: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  unmatchedFindings: Finding[];
  missing: ExpectedFinding[];
}

export interface CorpusScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  cases: CaseScore[];
}

export async function loadCorpus(truthPath: string): Promise<CorpusFile> {
  const raw = await fs.readFile(truthPath, 'utf8');
  return JSON.parse(raw) as CorpusFile;
}

export async function evaluateCorpus(options: {
  fixturesRoot: string;
  truthPath: string;
  osvFetcher?: OsvFetcher;
}): Promise<CorpusScore> {
  const corpus = await loadCorpus(options.truthPath);
  const cases: CaseScore[] = [];
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const entry of corpus.fixtures) {
    const root = path.resolve(options.fixturesRoot, entry.path);
    const result = await scan({
      root,
      osv: true,
      ...(options.osvFetcher ? { osvFetcher: options.osvFetcher } : {}),
    });
    const used = new Set<number>();
    const missing: ExpectedFinding[] = [];
    for (const expected of entry.expected) {
      const index = result.findings.findIndex(
        (finding, i) => !used.has(i) && matches(finding, expected),
      );
      if (index === -1) {
        missing.push(expected);
        continue;
      }
      used.add(index);
    }
    const unmatchedFindings = result.findings.filter((_, i) => !used.has(i));
    const tp = used.size;
    const fp = unmatchedFindings.length;
    const fn = missing.length;
    truePositives += tp;
    falsePositives += fp;
    falseNegatives += fn;
    cases.push({
      path: entry.path,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      unmatchedFindings,
      missing,
    });
  }

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
    cases,
  };
}

export function matches(finding: Finding, expected: ExpectedFinding): boolean {
  if (finding.ruleId !== expected.ruleId) {
    return false;
  }
  if (expected.file && !finding.file.endsWith(expected.file) && finding.file !== expected.file) {
    return false;
  }
  if (expected.toolName && finding.toolName !== expected.toolName) {
    return false;
  }
  if (expected.excerpt) {
    const haystack =
      `${finding.message} ${finding.excerpt ?? ''} ${finding.toolName ?? ''}`.toLowerCase();
    if (!haystack.includes(expected.excerpt.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 1;
  }
  return numerator / denominator;
}

export function formatScore(score: CorpusScore): string {
  const lines = [
    `# MCPSentry corpus score`,
    '',
    `- Precision: ${(score.precision * 100).toFixed(1)}%`,
    `- Recall: ${(score.recall * 100).toFixed(1)}%`,
    `- True positives: ${score.truePositives}`,
    `- False positives: ${score.falsePositives}`,
    `- False negatives: ${score.falseNegatives}`,
    '',
    '| Fixture | TP | FP | FN |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const entry of score.cases) {
    lines.push(
      `| ${entry.path} | ${entry.truePositives} | ${entry.falsePositives} | ${entry.falseNegatives} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

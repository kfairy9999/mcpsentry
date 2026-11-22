import type { Finding, ScanResult, Severity } from '../types.js';

const ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function toMarkdown(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`# MCPSentry report`);
  lines.push('');
  lines.push(`- **Scanned:** ${result.root}`);
  lines.push(`- **When:** ${result.scannedAt}`);
  lines.push(`- **Scanner:** ${result.toolName} ${result.version}`);
  lines.push(`- **Tools found:** ${result.tools.length}`);
  lines.push(`- **Findings:** ${result.summary.count}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('| --- | ---: |');
  for (const severity of ORDER) {
    lines.push(`| ${severity} | ${result.summary.bySeverity[severity]} |`);
  }
  lines.push('');
  if (Object.keys(result.summary.byRule).length > 0) {
    lines.push('| Rule | Count |');
    lines.push('| --- | ---: |');
    for (const [rule, count] of Object.entries(result.summary.byRule).sort()) {
      lines.push(`| ${rule} | ${count} |`);
    }
    lines.push('');
  }
  if (result.tools.length > 0) {
    lines.push('## Tools');
    lines.push('');
    lines.push('| Tool | File | Annotations |');
    lines.push('| --- | --- | --- |');
    for (const tool of result.tools) {
      const flags = tool.hasAnnotations
        ? `readOnlyHint=${String(tool.readOnlyHint ?? '—')}, destructiveHint=${String(tool.destructiveHint ?? '—')}`
        : '_missing_';
      lines.push(`| ${tool.name} | ${tool.file}:${tool.startLine} | ${flags} |`);
    }
    lines.push('');
  }
  if (result.findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push(
      'No findings. This is not a guarantee of safety; see the limitations in the README and THREAT_MODEL.md.',
    );
    lines.push('');
    return lines.join('\n');
  }
  for (const severity of ORDER) {
    const group = result.findings.filter((item) => item.severity === severity);
    if (group.length === 0) {
      continue;
    }
    lines.push(`## ${capitalize(severity)} findings`);
    lines.push('');
    for (const item of group) {
      lines.push(renderFinding(item));
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderFinding(item: Finding): string {
  const location = `${item.file}:${item.startLine}`;
  const tool = item.toolName ? ` \`${item.toolName}\`` : '';
  const cve = item.cve ? ` (${item.cve})` : '';
  const excerpt = item.excerpt ? `\n\n\`\`\`\n${item.excerpt}\n\`\`\`\n` : '\n';
  return `### ${item.ruleId} ${item.ruleName}${cve}${tool}

- **Severity:** ${item.severity}
- **Source:** ${item.source}
- **Where:** ${location}

${item.message}
${excerpt}
**Fix:** ${item.advice}

`;
}

function capitalize(value: string): string {
  const first = value[0];
  if (!first) {
    return value;
  }
  return first.toUpperCase() + value.slice(1);
}

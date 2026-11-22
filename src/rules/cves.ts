import type { Finding } from '../types.js';
import { finding, type Rule, type RuleContext } from './types.js';

export const cvesRule: Rule = {
  id: 'MCP008',
  name: 'dependency-cve',
  description: 'Looks up npm lockfile packages in the OSV vulnerability database.',
  async scan(ctx: RuleContext): Promise<Finding[]> {
    if (!ctx.osv) {
      return [];
    }
    const findings: Finding[] = [];
    for (const lockfile of ctx.lockfiles) {
      const packages = lockfile.packages.filter((pkg) => !pkg.dev);
      if (packages.length === 0) {
        continue;
      }
      const vulns = await ctx.osv.query(
        packages.map((pkg) => ({ name: pkg.name, version: pkg.version })),
      );
      for (const pkg of packages) {
        const matches = vulns.get(`${pkg.name}@${pkg.version}`) ?? [];
        for (const vuln of matches) {
          const summary = vuln.summary ? ` ${vuln.summary}` : '';
          findings.push(
            finding({
              ruleId: 'MCP008',
              ruleName: 'dependency-cve',
              severity: vuln.severity ?? 'medium',
              message: `Dependency ${pkg.name}@${pkg.version} is affected by ${vuln.id}.${summary}`,
              advice: `Upgrade ${pkg.name} to a version that is not listed in ${vuln.id}, then regenerate the lockfile and re-run the scan.`,
              file: lockfile.file,
              startLine: 1,
              cve: vuln.id,
              excerpt: `${pkg.name}@${pkg.version}`,
            }),
          );
        }
      }
    }
    return findings;
  },
};

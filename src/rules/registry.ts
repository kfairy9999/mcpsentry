import { annotationsRule } from './annotations.js';
import { authRule, rateLimitRule } from './auth.js';
import { cvesRule } from './cves.js';
import { injectionRule } from './injection.js';
import { overbroadRule } from './overbroad.js';
import { secretsRule } from './secrets.js';
import { sinksRule } from './sinks.js';
import type { Rule } from './types.js';

export const RULES: Rule[] = [
  secretsRule,
  annotationsRule,
  overbroadRule,
  sinksRule,
  injectionRule,
  authRule,
  rateLimitRule,
  cvesRule,
];

export function rulesById(ids?: string[]): Rule[] {
  if (!ids || ids.length === 0) {
    return RULES;
  }
  const wanted = new Set(ids);
  const selected = RULES.filter((rule) => wanted.has(rule.id) || wanted.has(rule.name));
  const missing = [...wanted].filter(
    (id) => !RULES.some((rule) => rule.id === id || rule.name === id),
  );
  if (missing.length > 0) {
    throw new Error(`Unknown rule id(s): ${missing.join(', ')}`);
  }
  return selected;
}

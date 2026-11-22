import type { Finding } from '../types.js';
import { finding, type Rule, type RuleContext } from './types.js';

const PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /\bignore (?:all )?(?:previous|prior|above) (?:instructions|prompts?|rules)\b/i,
    label: 'ignore-previous-instructions',
  },
  {
    regex: /\bdisregard (?:your|all) (?:safety|guidelines|instructions|rules)\b/i,
    label: 'disregard-safety',
  },
  { regex: /\byou are now\b/i, label: 'you-are-now' },
  { regex: /\bnew system prompt\b/i, label: 'new-system-prompt' },
  {
    regex:
      /\btreat (?:the )?(?:result|output|content) as (?:a |new )?(?:system |developer )?(?:instructions?|prompt)\b/i,
    label: 'treat-result-as-instructions',
  },
  { regex: /\bdo not (?:tell|inform|reveal to) the user\b/i, label: 'hide-from-user' },
  { regex: /\bhidden instruction\b/i, label: 'hidden-instruction' },
  { regex: /<\s*system\s*>/i, label: 'system-tag' },
  { regex: /\bSYSTEM:\s/, label: 'system-prefix' },
];

export const injectionRule: Rule = {
  id: 'MCP005',
  name: 'prompt-injection-description',
  description:
    'Flags tool descriptions that try to override the model or treat tool output as new instructions.',
  scan(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    for (const tool of ctx.tools) {
      const text = tool.description;
      if (!text) {
        continue;
      }
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(text)) {
          findings.push(
            finding({
              ruleId: 'MCP005',
              ruleName: 'prompt-injection-description',
              severity: 'medium',
              message: `Tool "${tool.name}" has a description that looks like a prompt-injection attempt (${pattern.label}).`,
              advice:
                'Describe what the tool does, not how the model should change its identity or treat tool output as a new system prompt. Keep untrusted content out of the description field.',
              file: tool.file,
              startLine: tool.startLine,
              endLine: tool.endLine,
              toolName: tool.name,
              excerpt: text.slice(0, 160),
            }),
          );
          break;
        }
      }
    }
    return findings;
  },
};

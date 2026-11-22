import { describe, expect, it } from 'vitest';

import { evaluateCorpus, formatScore } from '../../src/corpus/evaluate.js';
import { fixturesRoot, mockOsv, repoRoot } from '../helpers/scan.js';

describe('corpus evaluation', () => {
  it('meets precision and recall targets on the published fixture corpus', async () => {
    const score = await evaluateCorpus({
      fixturesRoot,
      truthPath: `${fixturesRoot}/corpus.json`,
      osvFetcher: mockOsv({
        'lodash@4.17.19': [
          { id: 'GHSA-test-lodash', summary: 'Prototype pollution', severity: 'high' },
        ],
      }),
    });
    const mismatches = score.cases.filter(
      (entry) => entry.falsePositives > 0 || entry.falseNegatives > 0,
    );
    expect(mismatches).toEqual([]);
    expect(score.precision).toBe(1);
    expect(score.recall).toBe(1);
    expect(formatScore(score)).toContain('Precision:');
    expect(repoRoot).toBeTruthy();
  });
});

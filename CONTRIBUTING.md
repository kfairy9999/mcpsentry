# Contributing

MCPSentry is a small, test-heavy scanner. Changes should keep that shape.

## Setup

Node.js 22.13 or newer.

```bash
npm install
npm test
npm run typecheck
npm run lint
```

## What to run before a pull request

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

## Habits

- Every rule needs at least one true-positive and one false-positive test.
- If you add a rule, add a fixture under `fixtures/vulnerable` or `fixtures/clean` and record the expected findings in `fixtures/corpus.json`. The corpus test requires 100% precision and recall on that set.
- Do not commit real credentials. Secret-rule tests should build sensitive prefixes at runtime or use obviously fake values that GitHub secret scanning will not treat as live keys.
- The live probe inspects `tools/list` only. Do not add a mode that blindly invokes tools.
- This repository is not published to npm or the GitHub Marketplace.

## Scope

This repository does not take pull requests that add a hosted service, a paid API, or automatic exploitation of findings.

# MCPSentry

**Static and dynamic security scanner for MCP servers.**

MCPSentry is a CLI and a reusable GitHub Action that audits [Model Context Protocol](https://modelcontextprotocol.io) servers. It looks for the mistakes that turn an MCP tool into a confused deputy: dishonest annotations, unconstrained shell or path parameters, argument-to-sink injection, hardcoded secrets, prompt-injection-prone descriptions, missing HTTP authentication or rate limiting, and known npm vulnerabilities.

Built by [Kevin Fairley](https://github.com/kfairley9999) at Provefirst. It is the scanner companion to [leadflow-mcp](https://github.com/kfairley9999/leadflow-mcp), which is itself an MCP server.

## Why this exists

MCP clients may auto-approve tools marked `readOnlyHint: true`. If that flag is wrong, a model can delete files or run a shell without a prompt. Most MCP security write-ups stop at advice. MCPSentry is a small, tested engine: every rule has true-positive and false-positive cases, and the fixture corpus in this repository is scored for precision and recall.

## Rules

| ID     | Name                         | What it flags                                                                            |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------- |
| MCP001 | hardcoded-secret             | Secret-like values assigned in source instead of the environment                         |
| MCP002 | dishonest-annotation         | Missing annotations, or `readOnlyHint` / `destructiveHint` that do not match the handler |
| MCP003 | overbroad-tool               | Unconstrained `command`, `path`, `url`, or `code` parameters                             |
| MCP004 | unsafe-sink                  | Tool arguments that reach a shell, `eval`, filesystem write, `fetch`, or SQL write       |
| MCP005 | prompt-injection-description | Tool descriptions that try to override the model or treat output as a new system prompt  |
| MCP006 | missing-auth                 | An HTTP MCP transport with no detected authentication                                    |
| MCP007 | missing-rate-limit           | An HTTP MCP transport with no detected rate limiter                                      |
| MCP008 | dependency-cve               | Production packages in an npm lockfile that [OSV](https://osv.dev) lists as affected     |

A live probe can connect over stdio or HTTP, call `initialize` and `tools/list`, and emit MCP002 or MCP003 findings when the advertised tools are unannotated or over-broad. The probe does not invoke tools.

## Corpus score

Measured on the fixtures in this repository, including a mocked OSV response for the lockfile fixture so the score is deterministic:

| Metric          | Score |
| --------------- | ----: |
| Precision       |  100% |
| Recall          |  100% |
| True positives  |    21 |
| False positives |     0 |
| False negatives |     0 |

This is a fixture score, not a claim about every MCP server. See [THREAT_MODEL.md](THREAT_MODEL.md) for an honest limitations section.

## Install and run

Node.js 22.13 or newer. This package is **not published to npm**; run it from a clone.

```bash
git clone https://github.com/kfairley9999/mcpsentry.git
cd mcpsentry
npm install
npm run build
node dist/cli.js scan ./path/to/mcp-server --format all --out report --fail-on high
```

Useful flags:

```text
--format markdown|json|sarif|all
--out <dir>
--fail-on none|low|medium|high|critical
--rules MCP001,MCP002
--exclude test/**
--probe-stdio "node dist/bin/stdio.js"
--probe-url http://127.0.0.1:8787/mcp
--no-osv
```

Evaluate the fixture corpus:

```bash
node dist/cli.js evaluate --fixtures fixtures --truth fixtures/corpus.json
```

## GitHub Action

The action is shipped in this repository. It is **not listed on the GitHub Marketplace**. Pin a tag in your own workflow:

```yaml
- uses: kfairley9999/mcpsentry@v0.1.0
  with:
    path: .
    format: all
    fail-on: high
    out: mcpsentry-report
```

Upload `mcpsentry-report/mcpsentry-report.sarif` with `github/codeql-action/upload-sarif` if you want the findings in GitHub code scanning.

## leadflow-mcp results

MCPSentry was run against [`kfairley9999/leadflow-mcp`](https://github.com/kfairley9999/leadflow-mcp) at [`73dda9c`](https://github.com/kfairley9999/leadflow-mcp/commit/73dda9c5d41d9fd360cee28be8147b9c7fd25b39).

- **11 tools** found, all annotated (`readOnlyHint` / `destructiveHint` present and consistent with the handlers)
- **0 findings** (HTTP auth and rate limiting were detected; no production lockfile CVEs; test-only token doubles are ignored by MCP001)
- Reports: [Markdown](docs/scans/leadflow-mcp/mcpsentry-report.md), [JSON](docs/scans/leadflow-mcp/mcpsentry-report.json), [SARIF](docs/scans/leadflow-mcp/mcpsentry-report.sarif)

A clean report is not a guarantee of safety. See [THREAT_MODEL.md](THREAT_MODEL.md).

## Limitations

- Static analysis is heuristic, not sound taint analysis. Wrappers and generated code can hide or invent a sink.
- A clean report is not a guarantee of safety.
- Python support is decorator-based.
- OSV lookups cover npm `package-lock.json` production packages only.
- MCP006 and MCP007 are pattern-based and apply only when an HTTP transport is detected. stdio-only servers are not flagged for missing auth.
- The probe inspects `tools/list` only, by design.

## Development

```bash
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run format:check
npm run build
```

License: MIT. Security reports: see [SECURITY.md](SECURITY.md). Privacy: see [PRIVACY.md](PRIVACY.md).

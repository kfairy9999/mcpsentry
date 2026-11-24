# Changelog

## 0.1.0 — 2026-11-21

First public release of MCPSentry, a static and dynamic scanner for MCP servers.

- Rules MCP001–MCP008: hardcoded secrets, dishonest or missing annotations, over-broad tools, unsafe sinks, prompt-injection-prone descriptions, missing HTTP auth, missing rate limits, and OSV dependency CVEs.
- Live probe of `initialize` and `tools/list` over stdio or HTTP.
- JSON, Markdown, and SARIF reports, plus a reusable GitHub Action (not published to the Marketplace).
- Fixture corpus with measured precision and recall, and a scanned report of `kfairley9999/leadflow-mcp`.

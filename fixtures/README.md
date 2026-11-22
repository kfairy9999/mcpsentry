# Fixture corpus

These miniature MCP servers exist so MCPSentry's rules can be measured.

- `vulnerable/` contains intentionally unsafe toy servers. Do not deploy them.
- `clean/` contains servers that should produce no findings.
- `corpus.json` is the ground-truth file used by `mcpsentry evaluate`.

Values that look like secrets in the vulnerable fixtures are fake and are only there so MCP001 can match them.

# Threat model

MCPSentry is a scanner, not a runtime firewall. This document describes the threats it is designed to detect in MCP servers, and the threats it does not claim to cover.

## Assets

- Host credentials and environment secrets that an MCP server can read
- The filesystem and network of the machine running the server
- Data the server is trusted to read or write (databases, inboxes, customer records)
- The model's context window: tool names, descriptions, and results can become instructions
- Client auto-approval policy: MCP clients may skip confirmation for tools marked `readOnlyHint: true`

## Actors

- A prompt-injected model that tries to call tools the user did not intend
- An untrusted HTTP client if the MCP server is exposed on the network
- A dependency with a published vulnerability
- A developer who mis-annotates a tool or pastes a secret into source

## Threats this scanner looks for

1. **Confused deputy via dishonest annotations.** A write or delete tool advertised as read-only can be auto-approved by a client. MCP002 compares `readOnlyHint` / `destructiveHint` with syntactic sinks in the handler.
2. **Unconstrained dangerous parameters.** A `command`, `path`, `url`, or `code` field typed as a bare string lets the model choose any operand. MCP003 flags those schemas.
3. **Argument-to-sink injection.** Tool arguments that reach `exec`, `eval`, filesystem writes, unconstrained `fetch`, or SQL writes. MCP004.
4. **Hardcoded secrets.** Secret-like identifiers assigned to string literals instead of the environment. MCP001.
5. **Prompt injection in tool descriptions.** Descriptions that tell the model to ignore previous instructions or treat tool output as a new system prompt. MCP005.
6. **Unauthenticated or unlimited HTTP MCP.** An HTTP `/mcp` endpoint with no detected bearer/API key check (MCP006) or no rate limiter (MCP007). stdio-only servers are out of scope for these two rules.
7. **Vulnerable npm dependencies.** Production packages in a lockfile that OSV lists as affected. MCP008.
8. **Live listing drift.** A running server's `tools/list` may advertise tools or schemas that static source missed or that lack annotations. The probe emits MCP002/MCP003 findings with `source: probe`.

## Threats this scanner does not cover

- Sound taint analysis or formal verification. Handler analysis is syntactic. Wrappers, generated code, and dynamic dispatch can hide a sink or pretend there is one.
- Secrets that are constructed at runtime, fetched from a vault, or stored only in environment variables.
- Runtime authorization that is correct but written in an unusual style (MCP006/MCP007 are pattern-based).
- Dependency vulnerabilities that are not in OSV, or that appear only in a lockfile format other than npm's `package-lock.json`.
- Fuzzing or invoking tools. The probe stops at `tools/list` on purpose so a scan cannot delete data or run a shell for you.
- Python support is decorator-based, not a full semantic analysis of the Python object model.
- Supply-chain attacks on the scanner's own dependencies, or a compromised GitHub Action runner.
- Social engineering of the human operator.

## Limitations, stated plainly

A clean report is not a guarantee of safety. A finding is a lead for a human to review. Precision and recall are measured on the fixtures in this repository, not on the internet at large. See the README for the current corpus scores.

## Scanner operational risks

- The OSV lookup sends package names and versions, not source text.
- A `probe-stdio` command is launched as a child process. Only point it at servers you already trust, and prefer fixtures or your own build output.

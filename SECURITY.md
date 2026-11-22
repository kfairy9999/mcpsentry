# Security policy

## Reporting a vulnerability

Email [kfairley9999@gmail.com](mailto:kfairley9999@gmail.com) with a description, steps to reproduce, and the affected version or commit. Please do not open a public GitHub issue for an unfixed vulnerability in MCPSentry itself.

I will acknowledge a valid report as soon as I can and will tell you when a fix is published.

## Supported versions

The `main` branch and the latest GitHub release are supported.

## Scope

MCPSentry is a local scanner. Findings it prints about _other_ repositories are not vulnerabilities in MCPSentry. In scope for this project: the CLI, the GitHub Action, report serializers, and the live `tools/list` probe.

The fixtures under `fixtures/vulnerable/` are intentionally unsafe toy servers used to measure the rules. They are not a product surface and must not be deployed.

Do not send secrets in a report. If a report needs a sample finding, redact credentials first.

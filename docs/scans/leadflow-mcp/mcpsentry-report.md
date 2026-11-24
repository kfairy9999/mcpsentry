# MCPSentry report

- **Scanned:** kfairley9999/leadflow-mcp@73dda9c5d41d9fd360cee28be8147b9c7fd25b39
- **When:** 2026-11-22T06:18:32.782Z
- **Scanner:** MCPSentry 0.1.0
- **Tools found:** 11
- **Findings:** 0

## Summary

| Severity | Count |
| --- | ---: |
| critical | 0 |
| high | 0 |
| medium | 0 |
| low | 0 |
| info | 0 |

## Tools

| Tool | File | Annotations |
| --- | --- | --- |
| create_lead | src/mcp/server.ts:86 | readOnlyHint=false, destructiveHint=false |
| update_lead | src/mcp/server.ts:107 | readOnlyHint=false, destructiveHint=false |
| get_lead | src/mcp/server.ts:127 | readOnlyHint=true, destructiveHint=false |
| search_leads | src/mcp/server.ts:146 | readOnlyHint=true, destructiveHint=false |
| score_lead | src/mcp/server.ts:178 | readOnlyHint=true, destructiveHint=false |
| log_interaction | src/mcp/server.ts:196 | readOnlyHint=false, destructiveHint=false |
| schedule_follow_up | src/mcp/server.ts:216 | readOnlyHint=false, destructiveHint=false |
| set_follow_up_status | src/mcp/server.ts:236 | readOnlyHint=false, destructiveHint=false |
| list_due_follow_ups | src/mcp/server.ts:259 | readOnlyHint=true, destructiveHint=false |
| pipeline_summary | src/mcp/server.ts:279 | readOnlyHint=true, destructiveHint=false |
| export_leads_csv | src/mcp/server.ts:300 | readOnlyHint=true, destructiveHint=false |

## Findings

No findings. This is not a guarantee of safety; see the limitations in the README and THREAT_MODEL.md.

<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E418-01 sr-engineer: in content/const-08-chain-31-mid.md (and content/const-05-core-standards.md where the E418 row applies) shrink the Scope-decision, Cut-Approval, Auto-Tier, Manifest tier, Lease-Override, QA Completion-Evidence, Non-QA Completed-Tasks and Amend-Resume bullets to WHEN/DO/ELSE plus the error code; drop history and rationale; every mechanism, field and code stays
- [x] T-E418-02 sr-engineer: in content/coord-03-core-fallback.md keep one Escalation Routes row per code and move the hop-cap continuation conditions to docs/lane-protocol.md (depends_on: T-E418-01)
- [x] T-E418-03 sr-engineer: shrink content/coord-04-host-watermark.md to a three-line pointer that describes the server-side watermark check in words (no repo-only path); shrink content/coord-06-host-token.md and the coordinator Manifest-tier writer action to WHEN/DO/ELSE (depends_on: T-E418-02)
- [x] T-E418-04 qa-engineer: verify each trimmed code's rejection hint is enough to self-correct and extend hint tests where bare; re-capture the 10 test/fixtures/compose-golden files; re-measure test/context-budget.test.mjs caps downward; re-pin prose pins that quote trimmed sentences (depends_on: T-E418-03)

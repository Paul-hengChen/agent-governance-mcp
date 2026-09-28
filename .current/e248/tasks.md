<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E248-01 [P0] sr-engineer: tools/fanout-manifest.ts — resolve relative `mailbox:` header against primary (resolveWorktree rules; `~` → new MAILBOX_TILDE; flag stays verbatim and wins), record header line no., validate WARN on absolute header (no path echo); sync the two `mailbox:` rows in specs/e177a-fanout-manifest.md; rebuild dist/tools/fanout-manifest.* (AC1–AC9) | depends_on: none
- [ ] T-E248-02 [P1] qa-engineer: test/e248-relative-mailbox-header.test.mjs covering AC1–AC8 proofs; existing test/e177a-manifest.test.mjs `/hdr` assertions stay green; full npm test after commit (AC10) | depends_on: T-E248-01

<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E150-01 [P0] architect: ledger lifetime blueprint specs/e135-handoff-notes-ledger-architecture.md — [] semantics, qa merge vs replace, omission detection without zod side fields, SQLite isolation, content/** decision (AC12-AC18) | depends_on: none
- [ ] T-E181-01 [P0] qa-engineer (pre-pass, file-only): E181 repro + boundary tests in test/e181-pending-notes-roundtrip.test.mjs, expected-red manifest; re-pin E92 documented-accepted-miss newline case (AC1-AC5) | depends_on: none
- [ ] T-E138-01 [P0] qa-engineer (pre-pass, file-only): keep-both-ends read-view tests in test/e138-read-view-keeps-tail.test.mjs, expected-red; re-pin truncation/marker cases in token-efficiency + e92-e86 tests (AC6-AC8) | depends_on: none
- [ ] T-E135-01 [P0] qa-engineer (pre-pass, file-only): marker constant + write-back rejection tests incl. legacy shapes in test/e135-read-view-marker.test.mjs, expected-red (AC9-AC11) | depends_on: none
- [ ] T-E150-02 [P0] qa-engineer (pre-pass, file-only): carry-forward / [] / feature-change tests in test/e150-completed-tasks-carry-forward.test.mjs per the architecture, expected-red; re-pin ledger assertions this lane changes, files named in the spec Cut (AC12-AC16) | depends_on: T-E150-01
- [ ] T-E181-02 [P0] sr-engineer: zod rejection of non-round-trippable pending_notes (multiline, [-led, empty/sentinel) + schema description in tools/registry.ts; rebuild dist (AC2-AC5) | depends_on: T-E181-01
- [ ] T-E138-02 [P0] sr-engineer: read view keeps note[0] + newest notes, never slices, one elision marker, omitted_notes advisory; export marker prefix constant from tools/handoff-types.ts; rebuild dist (AC6-AC9) | depends_on: T-E138-01, T-E135-01
- [ ] T-E135-02 [P0] sr-engineer: write-boundary rejection of read-view display text (prefix containment + two legacy shapes) via the shared constant in tools/registry.ts; rebuild dist (AC10-AC11) | depends_on: T-E135-01, T-E138-02, T-E181-02
- [ ] T-E150-03 [P0] sr-engineer: completed_tasks carry-forward per the architecture (boundary optional, orchestrator normalisation, file-writer clause), schema description, drift.ts hint; rebuild dist (AC12-AC18) | depends_on: T-E150-02, T-E135-02

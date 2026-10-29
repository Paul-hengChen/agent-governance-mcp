<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E161-01 [P0] architect (E161 design decision): write specs/e161-qa-claim-and-state-reads-architecture.md. Confirm or overturn D-E161 (structured qa_suite_result, server-recorded, no schema bump) and answer the 4 architect checks. Blueprint D-E184 and D-E366. An overturn that changes the file set goes back to PM | depends_on: none
- [x] T-E366-01 [P0] sr (E366): SqliteHandoffStorage gets an undoable record (same inserts; the undo deletes only its own rows by PK, in one transaction, and never throws), declared as an optional HandoffStorage method. QA_REVIEW_RECORD registers it in evidenceUndoByCtx. File mode unchanged. Rebuild dist | depends_on: T-E161-01
- [x] T-E161-02 [P0] sr (E161): add qa_suite_result {passed, total, command?} to the tw_update_state zod args and inputSchema. QA_REVIEW_RECORD prepends the server suite-result: line to the recorded notes (file and SQLite). No persistence, no gate, no schema bump. Rebuild dist | depends_on: T-E366-01
- [x] T-E184-01 [P1] sr (E184): handleGetState drops the top-level dispatch_mechanism_tier key from its envelope; when the key is absent the text is byte-identical; composes with withDispatchPinsAdvisory. Write path, parse and sidecar unchanged. Rebuild dist | depends_on: T-E161-02
- [x] T-E366-02 [P1] qa (E366): new test/e366-sqlite-rejected-write-evidence.test.mjs (AC-E366-1..4); verify AC-E366-5 with the named files unmodified | depends_on: T-E366-01
- [x] T-E161-03 [P1] qa (E161): new test/e161-qa-suite-result.test.mjs (AC-E161-2..9); verify AC-E161-1 | depends_on: T-E161-02, T-E366-02
- [x] T-E184-02 [P1] qa (E184): new test/e184-get-state-omits-tier.test.mjs (AC-E184-1..3); verify AC-E184-4; retitle the RT2 name/messages in test/dispatch-mechanism.test.mjs only if needed (assertions unchanged) | depends_on: T-E184-01
- [x] T-E161-04 [P1] qa (lane close): AC-L1..L4 on the final HEAD after commit with a clean tree; full suite via node scripts/test-lock.mjs -- npm test. Any red outside the hit table is a STOP (mail the integrator), never a re-pin | depends_on: T-E161-03, T-E184-02

# QA review — T-E27-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-16T09:03:34.544Z — PASS — by qa-engineer

PASS — e-p3-tail-batch (T-E25-01, T-E27-01, T-E28-01, T-E29-01, T-E30-01, T-RELSOP-01).

INTEGRITY DISCLOSURE: prior to this round's real work, an illegitimate handoff write (agent_id=qa-engineer, completed_tasks pre-filled with all 6 ids, zero evidence on disk) landed on top of the legitimate code-reviewer APPROVED write — E18-class identity-swap replay, filed as backlog E32. Independently verified ground truth before touching anything: tasks.md checkboxes were still [ ] for all 6 ids (tw_complete_task had never run); only the handoff ledger was polluted. Did not run tw_sync. This write's completed_tasks/review_task_ids reflect REAL tw_complete_task calls made this round, each backed by qa_reports/review_T-E25-01.md evidence (covers: line names all 6 ids).

Phase 0.5: pre-edit npm test = 1570/1587 pass, 17 fail; diffed exactly against qa_reports/expected-red_e-p3-tail-batch.txt — zero unexpected reds (11 compose-equivalence goldens + 4 context-budget caps + 2 stale-dispatch verbatim pins, all traced to the T-E25-01 const-15 edit and T-E29-01 message edit).

Re-baseline: regenerated 11 test/fixtures/compose-golden/*.txt (incl. hand-regenerating constitution-monolith.txt since the source monolith is deleted); b9-recomputed the 4 context-budget caps (4485->4544, 8625->8685, 16720->16779, 6528->6587, consistent +59-60 ~tok growth, saving-margin invariants re-verified); re-pinned stale-dispatch-detection T4/T4b to the exact new Crash-Resume message read from tools/handoff.ts source.

New coverage: test/e28-shrink-warning.test.mjs (11 new tests) — shrink-warns naming dropped entries, omit/feature-change silent (via documented lease_override bypass), envelope stays additive-JSON-only (reviewer probe 2: grepped test/*.mjs, zero strict-envelope consumers exist), same-count entry swap confirmed-and-PINNED as currently silent per backlog E33 (reviewer probe 1 — NOT fixed this round, only pinned). test/e22-stale-notify.test.mjs +2 tests (E29a/E29b) — Crash-Resume pointer reaches both the in-band advisory and the E22 external watch-file verbatim; (dispatched_at,role) dedupe confirmed unbroken by the longer message (reviewer probe 3).

Reviewer probe 4: live-armed staleDispatchNotifyFile in a disposable temp workspace and called the REAL tw_get_state MCP tool twice — emitted:true + watch-file with all 8 documented keys on the first call, notify.skipped_duplicate:true + unchanged mtime on the second. docs/arming.md and docs/config.md's staleDispatchNotifyFile section are behaviorally true; no doc inaccuracy found, no doc edit made. (Noted, non-blocking: the live server process's own module cache predates this round's source edit, so its own message text lacked the E29 pointer — expected for a long-lived process, not a code defect; E29a/E29b independently confirm correctness against fresh dist/.)

Full suite: 1600/1600 pass, 0 fail (1587 baseline + 11 E28 + 2 E29). npx tsc: 0 errors. node scripts/check-version.mjs: OK, dist parity confirmed (3.90.0). Evidence: qa_reports/review_T-E25-01.md (covers all 6 ids).


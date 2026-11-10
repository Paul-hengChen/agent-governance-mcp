# QA review — T-E359-04, T-E359-05, T-E359-06 (and sr tasks T-E359-01..03)

covers: T-E359-01, T-E359-02, T-E359-03, T-E359-04, T-E359-05, T-E359-06

Reviewed HEAD b169ebd (tests) on top of implementation 632a749; code review APPROVED (review_reports/review_T-E359-01.md).

Phase 0.5: skipped (no expected-red manifest declared)
Phase 1.5: skipped (no Visual Baselines declared; non-design feature)
Phase 3 placement: new files under pre-authorized globs per dispatch brief `Test-file placement`.

## Copy Audit
The three void refusal strings are asserted verbatim in test/e359-void-refusal-message.test.mjs (ROW / LEDGER / BOTH) against the spec Copy / Strings table, in file and SQLite modes. No unsourced user-facing string.

## Spec-to-Test Map
| AC | test |
|---|---|
| AC-E359-1..3 | test/e359-void-refusal-message.test.mjs `AC-E359-1`, `-2`, `-3` (+ no-handoff and T-B2 prefix boundary) |
| AC-E359-4 | same file, three `AC-E359-4 (SQLite)` cases (ran, not skipped; better-sqlite3 present) |
| AC-E359-5 | same file `AC-E359-5` (real handleUpdateState qa FAIL, then void succeeds) |
| AC-E359-6 | named suites run unmodified (below) |
| AC-E376-1, 2, 4 | test/e376-render-omits-tier.test.mjs (+ direct renderer and nested-key cases) |
| AC-E376-3 | named suites unmodified; direct no-tier case in e376 file |
| AC-E376-5 | golden recapture, no change |
| AC-E172-1..3 | test/e172-win32-tilde.test.mjs (platform injected; host independent) |
| AC-E172-4 | test/prompt-state-footer.test.mjs unmodified except the stale header comment (line 593) |
| AC-G1..G3 | below |

## AC Execution Log
- AC-E359-1..5: `node --test test/e359-*.test.mjs` -> 9 tests, 9 pass, 0 skipped.
- AC-E376-1, 2, 4: `node --test test/e376-*.test.mjs` -> 5 pass. AC-E172-1..3: `node --test test/e172-*.test.mjs` -> 8 pass. (Combined run of the three new files: 22/22 pass.)
- AC-E359-6: `node --test test/e117-void-task.test.mjs test/e120-void-recut-refusal.test.mjs test/e121-tasks-file-injection.test.mjs test/tasks.test.mjs test/e125a-lane-local-ledgers.test.mjs` (with e137, e122, prompt-state-footer, e184) -> 173/173 pass, 0 fail; `git diff --stat 4b25061...HEAD` over tools/sync.ts and e125a/e117 is empty.
- AC-E376-3 / AC-E172-4 / AC-E376-4: e137, e122, prompt-state-footer, e184 in the same 173-test run -> pass.
- AC-E376-5: `npm run build`; `node scripts/capture-constitution-golden.mjs` exit 0; `git status --porcelain` prints nothing.
- AC-G1: `npm run build` leaves `git status --porcelain dist/` empty; `git diff --stat 4b25061...HEAD -- dist` lists only dist/index.*, dist/prompts/build.*, dist/tools/tasks-file.*, dist/tools/storage-sqlite.*.
- AC-G2: `git diff --stat 4b25061...HEAD -- content test/fixtures/compose-golden test/context-budget.test.mjs bin gates tools/handoff-*.ts tools/handoff.ts` prints nothing.
- AC-G3: `node scripts/test-lock.mjs -- npm test` on committed HEAD b169ebd with a clean tree: exit 0, 4140/4142 pass, 0 fail, 2 skipped (pre-existing history-dependent skips for commit 121ddc8).
- Other: `npm audit --audit-level=high` exit 0; `npm run check:bookkeeping` exit 0.

Note: a first full run under machine load (load average ~25) had two failures in test/e108-eject.test.mjs (AC7, AC15: `agc init` child killed on timeout, status null). The file passes 35/35 in isolation and the second full run was fully green. Unrelated to this diff (agc init / eject).

## Findings
Required: none. Optional (non-blocking, carried from code review): storage-sqlite imports the message helper from the file-mode module; `_omitTier` discard binding in renderHandoffStateBlock. Optional QA note: e137 AC11 round-trip now has one deliberate exception key (tier); not edited since the test seeds no tier.
## 2026-11-10T04:27:56.957Z — PASS — by qa-engineer

suite-result: 4140/4142 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. New tests: test/e359-void-refusal-message.test.mjs (9), test/e376-render-omits-tier.test.mjs (5), test/e172-win32-tilde.test.mjs (8), all green; stale comment in prompt-state-footer fixed. Named unmodified suites 173/173. Build leaves dist clean, dist diff scoped to index, prompts/build, tasks-file, storage-sqlite; golden recapture unchanged; audit and bookkeeping exit 0. Full suite on committed HEAD b169ebd exit 0 (one earlier run had two load-induced e108 agc-init timeouts that pass in isolation and in the rerun).


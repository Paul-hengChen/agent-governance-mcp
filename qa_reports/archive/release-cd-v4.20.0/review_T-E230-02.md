# QA review — e230-pm-amend-and-resume-hint

covers: T-E230-01, T-E151-01, T-E230-02, T-E151-02

Spec: `specs/e230-pm-amend-and-resume-hint.md`. Implementation commit 3048464; tests commit 5581ec3. Code review APPROVED (`review_reports/review_T-E230-01.md`).

## Expected-Red Diff

Phase 0.5: manifest `qa_reports/expected-red_e230-pm-amend-and-resume-hint.txt` had 2 entries. Actual red set at 3048464 (full suite, before any re-baseline, per the sr-engineer/code-reviewer handoff record: 4061 tests, 2 fail) was exactly those two entries; 0 unexplained reds.

- `test/cut-approval-gate.test.mjs | R2: PM re-entry WITHOUT cut_approved re-arms gate (PM re-entry clause)` — disposition: rewritten as `R2: same-tuple PM amendment WITHOUT cut_approved keeps the approval` (AC1) plus new `R2b` keeping the re-arm assertion on a non-pm:In_Progress predecessor (AC4/AC6 side). Green at 5581ec3.
- `test/qa-flow.test.mjs | C1-07/AC-3: pm:In_Progress -> code-reviewer:In_Progress REJECTED with next_resume_of absent` — disposition: `allowed` assertion rewritten to "no unconditional code-reviewer/qa-engineer entry, both conditional `requires.resume_of` entries present" (AC9). Green at 5581ec3.

## AC Execution Log

- AC1, AC2, AC4, AC5, AC6 — `node --test test/e230-*.test.mjs` — exit 0, 9 tests, 9 pass, 0 fail — PASS.
- AC3, AC7 — `node --test test/cut-approval-gate.test.mjs` (R1, R3, R5 unchanged) — exit 0, all pass — PASS.
- AC9-AC13 — `node --test test/e151-*.test.mjs` — exit 0, 6 tests, 6 pass, 0 fail — PASS.
- AC14 — `npm run check:transitions-sync` — exit 0, "OK (21 keys, exact match ...)"; C1-07/AC-2 accept tests in `test/qa-flow.test.mjs` green in the full suite — PASS.
- AC8 — diff stat of content/, specs/qa-flow-enforcement-architecture.md, gates/, tools/handoff-orchestrator.ts, tools/registry.ts between 2425e04 and HEAD prints nothing — PASS.
- AC15 — `node scripts/test-lock.mjs -- npm test` at 5581ec3 — exit 0, 4077 tests, 4075 pass, 2 skipped, 0 fail — PASS.

## Spec-to-Test Map

| AC | test |
|---|---|
| AC1 | e230 `AC1`; cut-approval-gate `R2` |
| AC2 | e230 `AC2` (handler-level incident sequence) |
| AC3 | existing `R5` (unchanged, green) |
| AC4 | e230 `AC4` x3 (pm:Blocked, sr-engineer:In_Progress, code-reviewer:FAIL); `R2b` |
| AC5 | e230 `AC5` |
| AC6 | e230 `AC6 (writer)`, `AC6 (handler)` |
| AC7 | existing `R1`, `R3`; e230 `AC7` |
| AC8 | code-reviewer read of the two prose sites (review_reports/review_T-E230-01.md) |
| AC9-AC11 | e151 `AC9`, `AC10`, `AC11` (exact `allowed` arrays, S1 byte-for-byte) |
| AC12 | e151 `AC12` (four untouched rejections, static hint byte-identical) |
| AC13 | e151 `AC13` (handler path, `⛔ TRANSITION_REJECTED`) |
| AC14 | e151 `AC14`; qa-flow C1-07/AC-2 accept cases unchanged; build postbuild `check:transitions-sync` |
| AC15 | full suite, see PASS write |

Phase 1.5: skipped (no Visual Baselines declared). Phase 3a: test files created per the dispatch brief's pre-authorized placement. Copy audit: S1 asserted verbatim in e151 tests.
## 2026-11-09T09:38:11.822Z — PASS — by qa-engineer

suite-result: 4075/4077 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All 15 ACs covered (map in qa_reports/review_T-E230-02.md, covers all four tasks). Both expected-red entries rewritten (cut-approval-gate R2 to amendment-carry plus R2b; qa-flow C1-07/AC-3 to conditional-entries assertion). Full suite at HEAD 5581ec3: 4075 pass, 2 skipped, 0 fail. npm audit high: none. check:bookkeeping OK.


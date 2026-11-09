# QA review — T-E247-07

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-09T09:48:48.728Z — FAIL — by qa-engineer

suite-result: 4069/4074 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

## E396 Reproduction
See the section of the same name above in this file: U1 green; U2 RED; I RED; AC-X RED (test/ac-execution.test.mjs). Root cause: gates/expected-red.ts and gates/ac-execution.ts consult the covers: index only when the direct review_<id>.md is missing.

## Expected-Red Diff
Phase 0.5: full suite 4069/4074 passed (2 skipped); 3 reds, all on the manifest, 0 unexplained reds.
- test/e396-covers-expected-red.test.mjs | E396 U2: confirmed red (intentional repro).
- test/e396-covers-expected-red.test.mjs | E396 I: confirmed red (intentional repro).
- test/ac-execution.test.mjs | AC-X: confirmed red (intentional repro).
- sr's 14 original manifest entries (e35, error-code-contract, e26, e308 count/order/allowlist pins): now green after the T-E247-10 re-pins (e35 18->19 + PASS_TASKS_INCOMPLETE step at index 13; error-code-contract 35->36 x3 + FREE_TEXT_ALLOWLIST row PASS_TASKS_INCOMPLETE/triggerEdge; e26 R1/R2/U1/D1/D2/T3b and e308 E303-AC12 35->36; e128 prose 18->19). Entries removed from the manifest; two e35 and two error-code-contract test titles were renamed with the new counts.

## Round summary
T-E247-10: new test/e247-pass-tasks-incomplete.test.mjs (AC1-AC4, AC7) green 5/5. T-E247-07: new test/e380-qa-suite-result-sop.test.mjs (AC9, AC13, AC14) green 4/4. T-E247-11: AC-X added, red as recorded. Nothing ticked; FAIL back to sr for T-E247-02 and T-E247-12.


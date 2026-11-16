# QA review — T-E417-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-16T07:50:43.610Z — PASS — by qa-engineer

suite-result: 4226/4228 passed (server-recorded from qa_suite_result; command: npm test (Node 22; 2 skipped, 0 failed))

QA PASS (bugfix mode). Full record in qa_reports/review_T-E417-03.md (commit 0a1aa93).

## Expected-Red Diff
Manifest R1, R4, R5, R6, R7, R8. Against main's pre-fix dist exactly these 6 are red (FAIL expected, PASS actual: dropped row reported COMPACTED, exit 0) and nothing else; on the lane build all 6 are green and there are zero reds off the manifest (Node 22 npm test 4226 pass / 0 fail / 2 skipped of 4228). Phase 0.5: clean (6/6 manifest entries confirmed turned green by the fix, 0 unexplained reds). R2 and R3 accepted-limit pins pass on both builds.

## AC Execution Log
AC12: E203 file 20/20 pass on the lane build; red-before/green-after confirmed for R1, R4-R8; R2, R3, FP1-FP5, FP3b, FN3c identical verdicts on both builds. AC13: new file 21/21 pass (G1-G8, S1, N02, N03, K1, K2, F1-F7, N1). N1: e126 + E203 + new file 57/57 on Node 22 and on Node 20.20.2. Gates: build leaves tree clean; agc check OK; npm audit no high. Node 20 full suite 4157/4228 with 69 failures all better-sqlite3 NODE_MODULE_VERSION environment errors, none in merge-invariants tests.

Disclosure: the seven AC12 guard tests (FP1, FP2, FP3, FP3b, FP4, FP5, FN3c) are assigned to sr-engineer by the spec but were reassigned to QA by the coordinator because regression tests are QA-owned; QA wrote them under the exact AC12 names, plus the reviewer's S1-family pins N03 and N02, and refreshed the E203 header comment. No pre-existing test body was modified.


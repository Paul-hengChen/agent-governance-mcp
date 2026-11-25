<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E448-01 [P1] qa-engineer: new test/e448-judge-evidence-checks.test.mjs (AC1-AC4, AC19, AC20); test report; expected-red manifest | depends_on: none
- [ ] T-E448-02 [P1] qa-engineer: new test/e451-* (AC5, AC6 red on base) and test/e452-* (AC7-AC10); rewrite E434 AC7 in test/e434-reviewer-visual.test.mjs (AC11) | depends_on: none
- [ ] T-E448-03 [P2] qa-engineer: new test/e459-* (AC12-AC16) | depends_on: none
- [ ] T-E448-04 [P2] qa-engineer: E431 AC14 isError asserts (AC17); new test/e460-* (AC18, file + SQLite) | depends_on: none
- [ ] T-E448-05 [P1] qa-engineer: re-pin owned reds part 1 (e431, e432, e32-e33, e154, gates-expected-red) | depends_on: T-E448-04
- [ ] T-E448-06 [P1] qa-engineer: re-pin owned reds part 2 (e23, qa-flow :1003, visual-evidence-gate :578, e434 :90/:572/:586/:603, error-code-contract :570 if needed) | depends_on: T-E448-02
- [ ] T-E448-07 [P1] qa-engineer: re-pin new E448 reds (ac-execution, e139, e150, e161, e236) after owned-set addition | depends_on: T-E448-01
- [ ] T-E448-08 [P1] qa-engineer: re-pin new E448 reds (e247, e396, e435, qa-review-scoped-append) after owned-set addition | depends_on: T-E448-01
- [ ] T-E448-09 [P2] qa-engineer: re-pin new E458(8) hint reds (baseline-manifest-gate, cut-approval-gate, e151, pixel-gate-attestation, reviewer-completed-tasks-gate) after owned-set addition | depends_on: T-E448-01
- [ ] T-E448-10 [P2] qa-engineer: re-pin new red source-credibility-gate :382 after owned-set addition; e433 AC9 only if re-allocated | depends_on: T-E448-01
- [ ] T-E448-11 [P1] sr-engineer: E448 step 17 arms on file-mode (code-reviewer, PASS); registry MISSING_REVIEW_EVIDENCE entry; orchestrator comment | depends_on: T-E448-01, T-E448-05, T-E448-07, T-E448-08
- [ ] T-E448-12 [P1] sr-engineer: E451 anchor both header patterns in tools/evidence-file.ts | depends_on: T-E448-02
- [ ] T-E448-13 [P1] sr-engineer: E452 EVIDENCE_SCHEMA_CURRENT 3, accepted-surface listing under pin >= 3, msg.allowed_differences_unlisted, hint.visual_report_incomplete | depends_on: T-E448-02, T-E448-06, T-E448-12
- [ ] T-E448-14 [P2] sr-engineer: E459 (1) shared standing predicate, file-mode MISSING_EVIDENCE standing-PASS rule + msg.missing_evidence_file, hint.missing_evidence | depends_on: T-E448-03, T-E448-11, T-E448-13
- [ ] T-E448-15 [P2] sr-engineer: E459 (2)(3) expected-red under the pin; lane-status and drift lookup through the predicate | depends_on: T-E448-14
- [ ] T-E448-16 [P2] sr-engineer: E460 isError: true on both refusals in tools/tasks.ts | depends_on: T-E448-04
- [ ] T-E448-17 [P2] sr-engineer: E458 (8) remaining hints in gates/registry.ts per Copy / Strings | depends_on: T-E448-01, T-E448-09, T-E448-10, T-E448-15
- [ ] T-E448-18 [P1] sr-engineer, last: npm run build, dist/ scope, full suite, final expected-red manifest, CLAUDE.md 250 lines, npm audit (AC21) | depends_on: T-E448-11..T-E448-17
- [ ] T-E448-19 [P1] code-reviewer: judge every task (AC Execution Log AC1-AC21, Expected-Red Diff), review_reports/review_T-E448-01.md with covers: naming every id, PASS over T-E448-01..19 | depends_on: T-E448-18

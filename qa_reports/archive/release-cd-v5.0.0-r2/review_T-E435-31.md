# QA review — T-E435-31

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-24T14:47:36.661Z — PASS — by code-reviewer

suite-result: 4576/4579 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

code-reviewer PASS for e435-remove-old-path (T-E435-01..50). Review report review_reports/review_T-E435-01.md (covers all 50 ids, per-task verdicts, 8 schema sections); judge report qa_reports/review_T-E435-01.md (Expected-Red Diff: manifest 0 open rows, 0 actual reds, 3 unrelated pre-existing skips; AC Execution Log AC1-AC11). AC1-AC10 implemented and proven (e435 AC proofs exit 0; AC5 contract tests 82/82). AC11: CLAUDE.md Layout/Execution Profile in sync, build leaves dist/ clean, agc check exit 0, npm audit --audit-level=high exit 0; AC11 live eval dropped by human ruling A (spec amendment 116bd169, spec-only); eval-assertions in npm test (green in the suite). Scope inside the e435 owned set; no stamp/CHANGELOG/version change. No required findings. Recommended: stale QA_COMPLETION_EVIDENCE_MISSING comment at gates/registry.ts:300-305; e435 AC3 S3 step driven without review_verdict APPROVED; architect->sr covered only via oldPathStepHint. Coordinator rulings: T-12 stdio resume_of test covered by e435 AC4; T-30/T-31 overrun is deletion only; git checkout -- dist lost nothing (fresh build == committed dist); visual-evidence-gate predicate copy pre-existing, optional.


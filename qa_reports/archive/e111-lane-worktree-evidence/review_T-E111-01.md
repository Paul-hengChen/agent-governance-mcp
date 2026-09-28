# QA review — T-E111-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-15T02:22:14.578Z — PASS — by qa-engineer

PASS. T-E111-01 (worktree-evidence advisory, Round 3 APPROVED) verified by executing 21 fresh fixtures against the real CLI, not by reading the review — every matrix row the dispatch brief named as load-bearing (W1, W3, W4, W5, W6, W7, S1, P1, plus the stale-adapter exit-code invariant) measured exactly as predicted. Directly falsified the W3/C1 test by patching in Round 2's rejected directory-level check-ignore predicate and confirming it fails — proves the pinned test is load-bearing, not vacuous. T-E111-02: 6 fixture tests added to test/agc-adapters.test.mjs (mkWorktreeFixture helper + git worktree add, alongside the existing E104(i)/(ii) fixtures at file end), asserting only on observable warn/silent stderr text + exit code, never on git plumbing, per the binding instruction. Two qa-owned re-baselines applied: test/context-budget.test.mjs AC8/AC-P2-7 cap raised 17984->18303 (content/coord-03-core-fallback.md's Worktree bootstrap obligation growth), and test/fixtures/compose-golden/skill-coordinator-monolith.txt regenerated via the real composeSkill pipeline (diff confirmed to contain only the same coord-03 spans). npm run build clean; npm test 1821/1821. Evidence: qa_reports/review_T-E111-02.md (covers T-E111-01, T-E111-02).


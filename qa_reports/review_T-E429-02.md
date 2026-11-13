# QA review — T-E429-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-13T11:12:34.765Z — PASS — by qa-engineer

suite-result: 4189/4191 passed (server-recorded from qa_suite_result; command: npm test)

Phase 0.5: skipped (no expected-red manifest declared). Phase 3.5: skipped (backlog-row spec declares no proof: lines). Phase 1.5 / Copy / Visual audits: not applicable (CLI strings only; the one new user-facing string is pinned verbatim in the new test). Phase 3 placement: new file test/e429-lane-config-copy.test.mjs, creation pre-authorized by the dispatch brief.

AC to test map (E429 backlog row):
- AC1 local artifacts: byte-identical lane config, stdout copy line, empty lane git status -> test AC1.
- AC2 tracked config: committed bytes kept, no copy line -> test AC2.
- AC3 no primary config: exit 0, no lane file -> test AC3.
- AC4 loadConfig(lane).cutApprovalAutoTier equals primary (non-default maxFiles 7 / maxPriority P1) -> test AC4.
- Reviewer layouts: B (ignored via tracked .gitignore, copied), C (untracked and unignored, no copy, clean lane), G (committed dangling symlink kept, nothing written through it).
Fixture defect found and fixed during authoring: loadConfig normalizes the tier with extra default fields, so AC4 sanity compares maxFiles/maxPriority instead of whole-object equality; the lane-vs-primary comparison stays a full deepEqual.

Runs: new file 7/7 on Node 22.22.3 and 7/7 on Node 20.20.2 (fnm). Full suite npm test on Node 22: 4189 pass, 0 fail, 2 skipped, of 4191. npm run build: zero errors, transitions-sync OK. agc check: OK (4.20.0). npm audit --audit-level=high: no high or critical findings (7 moderate/low, pre-existing, none in this change).
Doc bullet in docs/lane-protocol.md checked against bootstrapLaneEnv: conditions (primary has file, lane has none after checkout, git ignores the path), snapshot semantics, tracked-config untouched, and the manual cp command all match the code.
Coverage: the new branch (bin/agc-init.mjs config-copy block) is exercised by the copy, tracked-skip, no-primary, unignored-skip and dangling-link paths; the warn-on-copy-failure branch is not exercised (best-effort, reviewer judged acceptable). No coverage tool measures bin/ scripts; noted explicitly.
Verdict: PASS.


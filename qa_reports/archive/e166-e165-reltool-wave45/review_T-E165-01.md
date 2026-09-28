# QA review — T-E165-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-23T06:48:01.973Z — PASS — by qa-engineer

PASS T-E166-01 + T-E165-01 (batched, qa_reports/review_T-E166-01.md covers both). E166: templates/claude-code-agents/release-engineer.md restates no staging path list, defers to SOP step 8a's "Stage explicitly"/"Pre-commit verify" anchors, both confirmed present in content/skill-release-engineer.md. E165: scripts/verify-release.mjs deriveCIBranch() derives --branch from @{u} (remote-stripped) -> current branch -> detached HEAD = WARN(lenient)/FAIL(strict), zero gh calls; --workflow CI kept; messages name the derived branch. New tests: test/e166-template-defers-staging.test.mjs (3/3 pass, regression-checked against pre-fix template text) and test/verify-release.test.mjs VR-35..38 (50/50 pass incl. 46 pre-existing). release-staging.test.mjs 80/80 pass unchanged. Full npm test: 2239/2241 pass; the 2 failures (check-md-tables.test.mjs AC7/CQ-9) are pre-existing at base af0dd77 from specs/e123a-lane-layout-migration.md:280, unrelated to this feature, logged as L-RELTOOL-NEW-3 -- not charged as a regression.


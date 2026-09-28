# QA review — T-E4X-03

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-08-10T11:06:35.563Z — PASS — by qa-engineer

PASS. Retargeted the three AC4 assertion sites in test/release-staging.test.mjs (doc comment, SOP-text pins, exact-wording fixture) from a hardcoded/substring-blind simulatePostCommitCheck to a 4-arg (diffNames, activeFeature, specExistsInTree, scopeDecisionWhy) simulation covering all three E44 branches (REQUIRE/SKIP/UNCLASSIFIABLE) + exhaustiveness + REQUIRE-wins-over-SKIP. Added deriveCodesFromWorkingTree modeling the shipped E49 step-7a pipeline (find -maxdepth 1 + git ls-tree PREV_TAG membership predicate, NOT round-1 slug-hunting or round-2 --diff-filter=A) with fixtures for the F7 regression (v3.93.0/v3.94.0 untracked-at-root shapes), the v3.95.0 committed-in-range shape, non-retroactivity, F4 bare-code exclusion, already-archived exclusion, N2, and N4 (documented as a known non-blocking hazard, not fixed). Added a step-order pin guarding F2's regression class. 16 new tests. Gates: npm run build 0 errors; npm test 1657/1657 pass (was 1641/1641, +16, all in release-staging.test.mjs); npm audit --audit-level=high unchanged at 11 pre-existing findings. content/skill-release-engineer.md untouched by this session. N3/N4/N5/N6 all independently assessed as non-blocking (N6 self-corroborated via this session's own tw_switch_role SOP delivery still carrying raw origin-tag markers) — backlog candidates, not release blockers.


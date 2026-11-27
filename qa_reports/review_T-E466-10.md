# Review — T-E466-10

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-27T17:59:17.145Z — FAIL — by code-reviewer

suite-result: 5016/5019 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Round 1 CHANGES_REQUESTED. S1–S8 tests and implementation are sound and every one is green. The full suite passes 5016/5019 (0 fail, 3 skipped). Every expected-red entry is green and nothing is red outside the manifest. dist/ matches a fresh build. All binding constraints hold. S9's checklist is adequate. Required finding F1 (scenario defect → pm): docs/install.md:349 says 'All 13 registered prompts', directly above the fourteen-bullet list this diff extends. docs/architecture.md:18 says '13 registered prompts' and is outside the allowed paths. When the 13th prompt landed, its lane updated both lines (efe3f446). This cut's Copy / Strings lists readme.count and claude.lines only. Fix: pm adds an install.count row ('All 14 registered prompts') and decides how docs/architecture.md:18 gets fixed (integrator out-of-bounds acceptance, or a post-merge fix); then sr-engineer applies it. Recommended, not blocking: add tests for the open --record → first-wave wave-done path and for wake (the reviewer's probe verified both). Optional: trim the qa test-header WHY blocks that agc check flags. Report: review_reports/review_T-E466-01.md.


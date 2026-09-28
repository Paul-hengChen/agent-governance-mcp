<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E229-01 [P1] qa-engineer: make test/e130-lane-default.test.mjs AC4's zero-code-diff test and AC14 history-independent (guard 121ddc8/5896bdd via git rev-parse --verify; t.skip + loud "HISTORY-DEPENDENT AC SKIPPED" notice when absent; unchanged behavior when present) | depends_on: none (note: PASS — qa_reports/review_T-E229-01.md)
- [x] T-E229-02 [P1] qa-engineer: make test/e178a-integrator-role.test.mjs AC3/AC4/AC15 fully history-independent (frozen current-tree literal: registry first-11 entries; AC15's template-bytes half reframed as a provenance-comment check — content/skill-integrator.md named, no .claude/commands/integrator.md cite — never a second PROMPT_TEMPLATE_3B copy, per test/e177a-manifest.test.mjs's existing golden; drop byte-identical-to-base diffs) and split AC6 into a current-tree substance test plus a separately-skippable historical terseness test (same guard-and-loud-skip contract as T-E229-01) | depends_on: none (note: PASS — qa_reports/review_T-E229-02.md)
- [x] T-E229-03 [P2] qa-engineer: verify AC7 — full suite green in the lane AND in a git archive HEAD single-commit snapshot (nested git init + symlinked node_modules); confirm the 3 historical-only checks report skipped-with-notice there, not failed; record evidence | depends_on: T-E229-01, T-E229-02 (note: PASS — qa_reports/review_T-E229-03.md)
- [x] T-E229-04 [P2] qa-engineer: add AC8 — short guard note in docs/lane-protocol.md against pinning commit SHAs in permanent tests unless inherently historical, with the guard-and-loud-skip requirement | depends_on: none (note: PASS — qa_reports/review_T-E229-04.md)

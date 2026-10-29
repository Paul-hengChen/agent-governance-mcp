<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E152-01 [P1] sr-engineer (E152): content/skill-release-engineer.md step 8a AC4 — range-derived feature-spec set (option A), MULTI-FEATURE on M or R, pending_notes line optional, R-only non-weakening, STOP strings byte-identical (spec: specs/e152-release-ac4-and-prose-sync.md) | depends_on: none
- [x] T-E365-01 [P1] sr-engineer (E365): quote NON_REVIEWER_VERDICT_REJECTED in content/const-08-chain-31-mid.md §3.1 review_verdict bullet; gates/registry.ts entry documentedInProse true, (none) marker -> const-08-chain-31-mid.md, two status comments; npm run build, dist/gates/registry.* only | depends_on: T-E152-01
- [x] T-E371-01 [P2] sr-engineer (E371): docs/lane-protocol.md §3 exactly two lines — add --abandoned specs/ copy to the harvest sub-bullet; drop the E217 known-gap clause (E196 stays) | depends_on: T-E365-01
- [x] T-E372-01 [P2] sr-engineer (E372): function names only — planIgnoredEvidenceHarvest/applyIgnoredEvidenceHarvest in specs/e260c-bin-scripts.md (~208, + --abandoned specs/ clause) and specs/e351-lane-protocol-gaps.md (84 source cell, 91) | depends_on: T-E371-01
- [x] T-E152-02 [P1] qa-engineer (E152): AC4 tests in test/release-staging.test.mjs (or test/e152-*.test.mjs) — simulator R input, content assertions, fixtures AC-E152-2/3/6, exhaustiveness 16 combos; Fixtures C-K unchanged | depends_on: T-E152-01
- [x] T-E365-02 [P1] qa-engineer (E365): re-pin six full-mode compose goldens + test/context-budget.test.mjs; (none) counts in e308 (E303-AC11a) and e295 (AC11); e139 AC-E139-7 documentedInProse true; error-code-contract allowlist reason | depends_on: T-E365-01
- [x] T-E371-02 [P2] qa-engineer (E371+E372+lane-wide): re-pin test/e351-lane-protocol-gaps.test.mjs; run AC-E371-1/AC-E372-1 proofs; AC-L1/AC-L2 on final HEAD via node scripts/test-lock.mjs -- npm test | depends_on: T-E371-01, T-E372-01, T-E152-02, T-E365-02

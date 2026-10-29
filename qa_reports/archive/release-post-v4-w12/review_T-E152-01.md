# QA review — T-E152-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-29T08:19:47.925Z — PASS — by qa-engineer

covers: T-E152-01, T-E365-01, T-E371-01, T-E372-01, T-E152-02, T-E365-02, T-E371-02

## Result
Full suite on final HEAD (clean tree, no untracked files) under `node scripts/test-lock.mjs -- npm test`: 3754 pass / 3756 total, 0 fail, 2 skipped (exit 0). `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e152 specs/e152-release-ac4-and-prose-sync.md` exit 0 (7 tickets, 0 out of bounds).
Note: a first full run on the same HEAD had 1 red, `test/e132-lane-registry.test.mjs` gap-6 (a wall-clock timing assertion under suite load). It is outside this lane's files and the manifest, was not re-pinned, passes in isolation (22/22), and the second full run on the identical HEAD was fully green. Treated as a load flake, not a regression.

## Expected-Red Diff
Phase 0.5: clean (14/14 manifest entries accounted for, 0 unexplained reds). The 14 manifest reds (compose-equivalence x6, context-budget x3, e139 x1, e295 x1, e308 x1, e351 x2) were measured red at the sr HEAD by sr and confirmed exactly, both ways, by code-reviewer round 2 (6dddd14). QA re-pinned exactly those 14 and nothing else; after the re-pin all 14 are green. No red outside the manifest persisted. Limit: QA did not re-run the pre-edit full suite itself; it relies on the sr/reviewer measurement.

## Files changed (test-only)
- test/release-staging.test.mjs (T-E152-02): simulatePostCommitCheck gains range-derived R (deriveRangeSpecs mirrors the SOP command); AC4 content test gains AC-E152-1 assertions; Fixtures L (AC-E152-2), M/N/O (AC-E152-3), P (AC-E152-6); exhaustiveness 8 -> 16 (S,M,R,W). Fixtures C-K assertions untouched (AC-E152-4).
- test/fixtures/compose-golden/{build-full-design,build-full-design-fd,build-full-nondesign,build-full-nondesign-fd,constitution-monolith,hook-full}.txt (T-E365-02): regenerated with scripts/capture-constitution-golden.mjs (not hand-edited); one line each; lite goldens unchanged.
- test/context-budget.test.mjs: caps 10527->10598, 21644->21715, 8429->8501 (measured, zero-headroom convention kept).
- test/e308 (none 1->0, title), test/e295 AC11 (none 1->0), test/e139 AC-E139-7 (documentedInProse true), test/error-code-contract.test.mjs (allowlist reason text).
- test/e351-lane-protocol-gaps.test.mjs (T-E371-02): S3_HARVEST/S3_GAPS re-pinned, E217 x0, ABANDON_HARVEST_DIRS == ["specs"], message reworded.

## AC Execution Log
- AC-E152-1..6: `node --test test/release-staging.test.mjs` 85/85 pass.
- AC-E365-1: grep prints exactly one line, content/const-08-chain-31-mid.md. AC-E365-4/5: compose-equivalence, e90, context-budget, e308, e295, e139, error-code-contract all pass.
- AC-E371-1: `grep -c E217 docs/lane-protocol.md` = 0. AC-E371-2: e351 + e290 pass.
- AC-E372-1: ShippedEvidenceHarvest count 0 in both docs; IgnoredEvidenceHarvest in e260c = 2.
- AC-L1: full suite green on final HEAD. AC-L2: fanout check exit 0.


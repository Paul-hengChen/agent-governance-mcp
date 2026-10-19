# QA review — T-E338-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-19T03:49:15.651Z — FAIL — by qa-engineer

Verdict FAIL on AC-HC-3 only; every functional AC passes.

Tests written (commit a8f775c): test/e289-config-key.test.mjs (AC-E289-1..3, 4 tests), test/e289-render-addendum.test.mjs (AC-E289-4,6,7,8,9, 12 tests), test/e337-subitem-order.test.mjs (AC-E337-1, 3), test/e338-backtick-glob.test.mjs (AC-E338-1,2, 3), test/e339-non-ascii-manifest.test.mjs (AC-E339-1,2, 2). Golden test/fixtures/e177a/render-e177a.golden.txt re-pinned (one added EnterWorktree line); test/e235b-relative-worktree.test.mjs R3 AC2 per-line exception widened to every line carrying the worktree path. AC-E339-3 is reviewer code reading (covered in review round 1).

Full suite: node scripts/test-lock.mjs -- npm test on committed HEAD a8f775c (tree clean apart from .current/e289): tests 3433, pass 3430, fail 1, skipped 2. The single failure: test/e234-hygiene-scan.test.mjs AC16 'an isolated copy of committed HEAD lists zero hits' reports one home-path hit in review_reports/review_T-E289-01.md line 29 (the code-reviewer report quotes the spec's bold-wrapped Users probe for AC-E338-2 in a form the scanner reads as a machine-local home path). Cause is a tracked evidence file from the review hop, not product code or tests.

AC proofs run: AC-E289-2 git diff --quiet 93ed15c...HEAD on schema/versions.ts, schema/migrations-config.ts, docs/schema-versions.md, test/config-versioning.test.mjs prints exit=0. AC-E289-5 git diff --numstat 93ed15c...HEAD on the golden prints '1	0'. AC-E289-10 diff --quiet on test/e178a-integrator-role.test.mjs and test/e296-manifest-tier.test.mjs exit=0 and both green. AC-E338-3 diff --quiet on test/e332-absolute-path-boundaries.test.mjs and test/e283-validate-handoff.test.mjs exit=0 and both green. AC-HC-1 validate sweep matches spec D5 line for line (exit 0 for all except fanout-wave5.1.md and fanout-wave6.md: exit 2 with DECISIONS_SECTION_ABSENT and PINS_SECTION_ABSENT). AC-HC-2 node scripts/fanout.mjs check specs/fanout-post-v4-w7.md e289 exit=0 (27 files, 0 out of bounds).

Required fix: reword line 29 of review_reports/review_T-E289-01.md so it describes the bold-wrapped Users-style probe by class instead of quoting the literal path-like text (constitution section 6 hygiene), commit, then QA reruns the full suite on the new HEAD. No code or test change is needed.


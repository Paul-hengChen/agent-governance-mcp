covers: T-E329-01, T-E328-01, T-E334-01, T-E327-01, T-E329-02

# QA review — e329-integrator-sop-followups (T-E329-02)

Verdict: PASS. Code-reviewer APPROVED round 1 (review_reports/review_T-E329-01.md).

## Expected-Red Diff
Phase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds).
- test/e286-integrator-trust-and-git.test.mjs | AC1 ... — confirmed red by running the pre-re-pin e286 file (from c6bc26a) against the lane's SOP: 9 pass, 1 fail (AC1 only). Then re-pinned (condition-2 literals only) -> green.

## Copy Audit (3a) / Visual (3b) / Visual compare (1.5)
3a: all 9 Copy/Strings literals asserted verbatim by the new tests (and by the code-reviewer at placement). 3b: N/A (no visual tokens). Phase 1.5: skipped (no Visual Baselines declared).

## Spec-to-Test Map (test/e329-integrator-sop-followups.test.mjs, one case per AC)
AC-E329-1/2/3, AC-E328-1/2, AC-E334-1/2/3, AC-E327-1/2. AC-E329-2 imports HANDOFF_SUBITEMS / HANDOFF_SECTION from dist/tools/fanout-manifest.js. No fixed sha, no growing real specs/fanout-*.md content.
Negative control (mutated copy outside the worktree: status wording, `reads exactly 無`, qa hygiene tail): AC-E329-1, AC-E334-3, AC-E327-1, AC-E327-2 turned red.

## AC Execution Log
- AC-E329-1..3, E328-1..2, E334-1..3, E327-1..2: `node --test test/e329-integrator-sop-followups.test.mjs` -> 10/10 pass. Also e286, e288, e246, e296, qa-visual-skill-split, context-budget together: 140 pass, 0 fail.
- AC-E327-2: `wc -c content/skill-qa-engineer.md` = 18253 (<= 18500); cap in qa-visual-skill-split unchanged.
- AC-LANE-1: `git diff --stat 902462e...HEAD -- test/e296-manifest-tier.test.mjs test/fixtures/compose-golden test/context-budget.test.mjs test/qa-visual-skill-split.test.mjs test/e246-mailbox-teardown.test.mjs test/e288-integrator-stage0.test.mjs` printed nothing. Full suite `node scripts/test-lock.mjs -- npm test` on committed HEAD d3668f7 with clean `git status --porcelain`: 3331 tests, 3329 pass, 0 fail, 2 skipped.
- AC-LANE-2: `node scripts/fanout.mjs check specs/fanout-post-v4-w6.md e329 --base main` -> 12 file(s) changed, 0 out of bounds, exit=0.

## Notes on code-reviewer optional items
- Condition-2 exit-1 wording vs uncaught git errors: the literal says exit 2 covers git errors, true at base and after E331 (lane e284); no action.
- "reads exactly 無" stricter than validate (validate tolerates a list marker / trailing 。): pinned as the SOP states it; non-blocking.

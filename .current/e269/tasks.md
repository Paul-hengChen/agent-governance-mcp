<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E269-01 [P1] sr-engineer: const-15 section 6 — add git stash drop / git stash clear to FORBIDDEN (<=100 chars added; first sentence pinned by e178a byte-identical) | depends_on: none
- [ ] T-E269-02 [P1] sr-engineer: skill-code-reviewer + skill-qa-engineer — negative control runs on a copy outside the worktree, never via stash, with the tw_update_state reason | depends_on: none
- [ ] T-E269-03 [P2] sr-engineer: skill-release-engineer — step 13a :143/:196 refs to step/heading names, E104 Reason note in plain words, verify-release.mjs:113-125 to --close-out | depends_on: none
- [ ] T-E269-04 [P1] code-reviewer: review content edits T-E269-01..03 (review_reports) | depends_on: T-E269-01, T-E269-02, T-E269-03
- [ ] T-E269-05 [P1] qa-engineer (author, ends qa-engineer:Blocked): fix 2 budget titles (E274), add test/e269-budget-title-sync.test.mjs, re-measure and set affected constitution caps (human-approved numbers), regenerate compose goldens and explain each hunk | depends_on: T-E269-04
- [ ] T-E269-06 [P1] code-reviewer (resume_of): review qa-authored test and golden edits of T-E269-05 | depends_on: T-E269-05
- [ ] T-E269-07 [P1] qa-engineer (fresh verifier, authored nothing): full suite via test-lock on final HEAD, verdict PASS/FAIL for AC1-AC9 | depends_on: T-E269-06

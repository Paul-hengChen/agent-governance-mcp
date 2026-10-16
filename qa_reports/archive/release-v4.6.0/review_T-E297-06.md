# QA review — E297 main-protected SOP (T-E297-06)

covers: T-E297-01, T-E297-02, T-E297-03, T-E297-04, T-E297-05, T-E297-06

Reviewed branch HEAD: f357a2d (code-reviewer APPROVED round 2). Tests, goldens and this report land in the T-E297-06 commit.

## Phase notes
- Phase 1.5: skipped (no Visual Baselines declared). Copy/Visual audit: spec Copy / Strings are SOP prose pinned verbatim by the re-pins below; no Visual Tokens.
- Phase 3a: existing test files cover the scope; the dispatch brief's placement line was followed (only the pre-authorized files changed, plus the pre-authorized new test file).

## Expected-Red Diff
Phase 0.5: the manifest listed 23 entries. Each was confirmed red on f357a2d individually, BEFORE its re-baseline edit, by running its file: e178a AC1/AC6/AC9, skill-frontmatter MODEL_TIERS, e164-e167 AC2/AC4, release-staging E53/E163 row count and the four context-budget ceilings each failed with the expected literal/number mismatch; the 12 golden entries (11 compose-equivalence + 1 skill-manifest) were confirmed by the capture diff, which moved all 12 fixtures. Zero unexplained reds in those files. The two non-listed `test/e177b-test-lock.test.mjs` timeouts are dispositioned in the full-suite section. Manifest disposition: FOLDED into this report and `git rm`-ed, because every listed red is now green and the file's only purpose (telling the diff which reds are intentional) is spent; keeping it would leave a manifest that names tests that no longer fail.

## AC Execution Log (proofs run on f357a2d, my own runs)
- AC1 PASS: all six patterns hit; each inside `## Stage 6` (lines 161-166; hits at lines 29/36/137/151/173 are outside it and irrelevant).
- AC2 PASS: stale-wording grep prints nothing (exit 1); `6. Bookkeeping, main, teardown` count = 1.
- AC3 PASS: each of the four patterns present; `any time after step 8a completes` prints nothing.
- AC4 PASS: `delete any local tag created ahead of this gate` = 0; `make the FIRST attempt with the normal budget` = 1.
- AC5 PASS: `release/vX.Y.Z-bookkeeping` x2, `CLOSE-OUT PASSED` x2. `node --test test/release-staging.test.mjs`: the D10 assertions are unmodified and pass; the only change in the file is the pinned Escalation Routes row count 9 to 10 (E297 added the pull-request-cannot-merge row; first/second/last-row order asserts hold, last index 8 to 9). 80/80.
- AC6 PASS: `git diff --quiet main...HEAD -- scripts/verify-release.mjs` exit 0.
- AC7 PASS: grant strings present; pinned first sentence count = 1; `git diff --quiet main...HEAD -- content/constitution-rationale.md` exit 0.
- AC8 PASS: one hit (line 58), inside `## Backlog Intake Loop`; `test/e5-intake-tiering.test.mjs` 31/31 unmodified.
- AC9 PASS: proof prints `["opus","sonnet","haiku","fable"] fable`.
- AC10 PASS: one hit, inside `## Stage 6` (step 4).
- AC11: see Full suite.

## AC to test map
`test/e297-main-protected-sop.test.mjs` (new, 9 tests, AC1-AC5, AC7-AC10; AC6 and AC11 are git/suite checks). Re-pins (logic unchanged, expected strings/numbers only, except where noted):
- e178a AC1: `recommended_model: fable`, `MODEL_TIERS` includes fable.
- e178a AC6: grant sentence 1 re-pinned to the new text; NEW assertion for sentence 2 (the namespaces, round-2 `limited to` wording).
- e178a AC9: `never open the pull request before that verdict is APPROVED.`
- skill-frontmatter: `MODEL_TIERS` = opus, sonnet, haiku, fable.
- e164-e167 AC2 and AC4: the 8b tag-cleanup and 8c early-tag clauses are retired by design (tag now goes on the main merge commit after the pull request merges), so the assertions are inverted to pin the retirement plus the surviving cap sentence and the `on that HEAD ... until the next bullet.` bullet; test titles reworded with `(E297 re-pin)`. This is the one place assertion logic changed, because the old clauses no longer exist.
- release-staging: row count and last-row index, as above.
- Goldens regenerated with `scripts/capture-constitution-golden.mjs` after `npm run build` (dist unchanged by the build). AC11 hunk audit: every changed line across the 12 fixtures is either the Constitution section 6 grant/`git pull --ff-only` bullet (11 fixtures) or the coord-03 Bookkeeping paragraph (skill-coordinator-monolith); nothing else moved.

## Ceilings (test/context-budget.test.mjs, zero headroom, human ruling at cut approval)
| ceiling | old | sr-measured | final (re-measured on HEAD) |
|---|---|---|---|
| lean always-on | 5567 | 5713 | 5717 |
| design-arm constitution | 10076 | 10222 | 10226 |
| teamwork bundle | 20453 | 20745 | 20749 |
| non-design constitution | 7978 | 8125 | 8129 |

(Each is sr's figure plus 4 ~tok for the 16 characters section 6 grew in round 2.)

## Full suite (AC11)
`node scripts/test-lock.mjs -- npm test` on the committed, clean HEAD carrying the T-E297-06 tests/goldens: 3054 tests, 3051 pass, 0 fail, 0 cancelled, 3 skipped (pre-existing skips); tree clean before and after. Both `test/e177b-test-lock.test.mjs` AC13a/AC13b tests were green in this run (they were load-induced timeouts in sr's run; nothing in this lane touches the lock code). Reds by name: none.
`npm run build`: zero errors, dist unchanged. `npm audit --audit-level=high`: no high/critical findings (see handoff note for exit status).

## Verdict
PASS. AC1-AC11 met; no code defect found. O4 from the code-reviewer (release row recovery wording fits 8c only, not 13a) is optional and left for the backlog.
## 2026-10-14T11:36:39.510Z — PASS — by qa-engineer

PASS. AC1-AC10 proofs re-run green on HEAD; AC6 git check exit 0; AC11 full suite 3054 tests / 3051 pass / 0 fail / 3 skipped under test-lock on a clean committed HEAD (e177b AC13a/AC13b green). Re-pins, 12 goldens regenerated (hunks = section 6 + coord-03 only), four ceilings set zero-headroom 5717/10226/20749/8129 (old 5567/10076/20453/7978), new test/e297-main-protected-sop.test.mjs (9 tests). Expected-red manifest folded into report and git rm-ed. Details: qa_reports/review_T-E297-06.md.


# Judge report — T-E453-01 (e453-served-text-v5)

covers: T-E453-01, T-E453-02, T-E453-03, T-E453-04, T-E453-05, T-E453-06, T-E453-07, T-E453-08, T-E453-09, T-E453-10, T-E453-11

## Round 1 — APPROVED — by code-reviewer

Review report: `review_reports/review_T-E453-01.md`. Full suite: `node scripts/test-lock.mjs -- npm test` on a clean tree at 59ea2bd (the code-reviewer claim/checkpoint state commit on top of cc4a9ad): 4605 tests, 4603 pass, 0 fail, 0 cancelled, 2 skipped, exit 0. The two skips are the history-dependent closed-range checks (`AC4` / `AC14` of the e130 lane: commit 121ddc8 not resolvable), loud `t.skip`, not this feature's tests and not manifest rows. `npm test`'s prebuild left `dist/` unchanged (`git status --porcelain` after the run shows only this round's new review file).

## Expected-Red Diff

Manifest `qa_reports/expected-red_e453-served-text-v5.txt`: 0 entry rows (comment lines only; the 34 qa rows were cleared by T-E453-11 and the 17 snapshot rows by T-E453-10, each with a record line). Actual reds in the full suite: 0.

- Manifest entries still red: none.
- Actual reds not on the manifest: none.
- Diff: empty — nothing to disposition. Cross-check: the 34 cleared qa rows' tests (21 + 3 new-file tests, 10 re-pins) and the 17 cleared snapshot tests (12 compose goldens incl. `skill-manifest` byte-identity, 5 context-budget caps) all pass in this run.

## AC Execution Log

One entry per spec AC (no ticket file; the spec's ACs are the scenarios). Run in the worktree at 59ea2bd after the full suite.

| AC | command | raw outcome | result |
|---|---|---|---|
| AC1 | `node --test --test-name-pattern "AC1:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC2 | `node --test --test-name-pattern "AC2:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC3 | `node --test --test-name-pattern "AC3:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC4 | `node --test test/e433-test-first-rules.test.mjs` | exit 0; tests 16, pass 16, fail 0 | pass |
| AC5 | `node --test --test-name-pattern "AC5:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 (runs `agc init` / `check` in a temp workspace) | pass |
| AC6 | `node --test --test-name-pattern "AC6:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC7 | `node --test --test-name-pattern "AC7:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC8 | `node --test --test-name-pattern "AC8:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC9 | `node --test --test-name-pattern "AC9:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC10 | `node --test --test-name-pattern "AC10:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC11 | `node --test --test-name-pattern "AC11:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC12 | `node --test --test-name-pattern "AC12:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC13 | `node --test --test-name-pattern "AC13:" test/e457-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC14 | `node --test --test-name-pattern "AC14:" test/e457-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC15 | `node --test --test-name-pattern "AC15:" test/e457-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC16 | `node --test --test-name-pattern "AC16:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC17 | `node --test --test-name-pattern "AC17:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC18 | `node --test --test-name-pattern "AC18:" test/e453-*.test.mjs`; also `node --test test/e408-core-task-alias-tail.test.mjs test/e412-qa-visual-template.test.mjs test/e434-reviewer-visual.test.mjs` | exit 0; tests 1, pass 1, fail 0 / exit 0; tests 24, pass 24, fail 0 | pass |
| AC19 | `node --test --test-name-pattern "AC19:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC20 | `node --test --test-name-pattern "AC20:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC21 | `node --test --test-name-pattern "AC21:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC22 | `node --test --test-name-pattern "AC22:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC23 | `node --test --test-name-pattern "AC23:" test/e453-*.test.mjs && node --test test/e433-test-first-rules.test.mjs test/e393-builder-judge-core.test.mjs` | exit 0; tests 1, pass 1 / e433 16 pass, e393 7 pass, fail 0 | pass |
| AC24 | `node --test --test-name-pattern "AC24:" test/e453-*.test.mjs` | exit 0; tests 1, pass 1, fail 0 | pass |
| AC25 | `node --test --test-name-pattern "AC25:" test/e453-*.test.mjs && node --test test/error-code-contract.test.mjs` | exit 0; tests 1, pass 1 / exit 0; tests 27, pass 27, fail 0 | pass |
| AC26 | `node --test --test-name-pattern "AC26:" test/e453-*.test.mjs && node --test test/e437-repo-only-paths.test.mjs` | exit 0; tests 1, pass 1 / exit 0; tests 14, pass 14, fail 0 | pass |
| AC27 | `git diff 70d34c6 -- tools/transitions.ts \| grep -E '^[-+][^-+]' \| grep -vE '^[-+]\s*//'`; `git diff --stat 70d34c6 -- gates schema prompts bin`; `node --test --test-name-pattern "AC27:" test/e453-*.test.mjs` | first two print nothing; exit 0; tests 1, pass 1, fail 0 | pass |
| AC28 | `node scripts/test-lock.mjs -- npm test` (clean tree, 59ea2bd) | exit 0; `# tests 4605`, `# pass 4603`, `# fail 0`, `# skipped 2` | pass |

Negative control (step 6): a `git archive HEAD` copy in the session scratchpad (outside the worktree), 19 text mutations applied one at a time and reverted; each made the targeted AC test(s) fail (list in the review report, Correctness).
## 2026-11-25T08:14:21.000Z — PASS — by code-reviewer

suite-result: 4603/4605 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (round 1). AC1-AC28 all implemented; every spec Copy / Strings line present verbatim and each factual claim verified against the code (review_round cap 4 at transitions.ts:474; sr_return edge-only check and pm reset at transitions.ts:536-551/704-718, not counted in SQLite; hop_count reset only on active_feature change at transitions.ts:680; CUT_APPROVAL_REQUIRED / EXTERNAL_REFS_UNRESOLVED / REPRO_MANIFEST_MISSING file-mode guards vs SCOPE_DECISION_REQUIRED / SOURCE_CREDIBILITY_UNVERIFIED in every mode; v4.23.0 handoff schema 15; agc init skip-if-exists run in the AC5 test; code-reviewer:Blocked -> code-reviewer:In_Progress edge exists). Scope inside the e453 owned set and line limits; AC27 clean (transitions.ts comment-only, registry descriptions only, no gates/schema/prompts/bin change). Tests bind each AC: 19 mutations in a scratch copy each caught. Goldens: 73 changed lines, every hunk a Copy / Strings edit; 5 budget caps re-measured with one note each. Full suite on a clean tree: 4605 tests, 4603 pass, 0 fail, 2 skipped (history-dependent e130 checks). Expected-Red Diff empty. Findings: no required; optional - stale 'exactly as at base' comment above BUILDER_NE_JUDGE in test/e433-test-first-rules.test.mjs:84; sr_return meaning omits the feature-change reset; recommended - trim the 11-/8-line header comments of the two new test files. Review: review_reports/review_T-E453-01.md (covers all 11 ids).


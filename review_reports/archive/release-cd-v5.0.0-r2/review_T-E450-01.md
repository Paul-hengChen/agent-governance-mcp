# Review — T-E450-01

covers: T-E450-01, T-E450-02, T-E450-03

## Round 1 — APPROVED — by code-reviewer

## Summary
- Test-only change (commit 8d466cfb): removes the live `node bin/agc-init.mjs check` spawnSync and its exit-0 assert from `test/e433-test-first-rules.test.mjs` AC12 and `test/e434-reviewer-visual.test.mjs` AC13, drops "agc check" from both titles, adds a one-line E450 WHY comment.
- Adds qa's `qa_reports/tests_e450-release-window-agc-check.md` and `qa_reports/no-new-test_e450-release-window-agc-check.txt`; no source, dist or content edit.
- Release-window simulation (tree bumped to 5.0.0, stamps left at 4.23.0, `agc check` exit 1): both tests pass; main's versions of the same two tests fail there (negative control).
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/e450-release-window-agc-check.md (backlog-row-as-spec mini-chain)

## Correctness
No findings.
- S1: in the bumped tree the full suite has 0 real failures (see judge report qa_reports/review_T-E450-01.md; the 8 failures in the non-git copy are all `fatal: not a git repository` and pass once the copy is `git init`ed).
- S2: the diff touches only the spawnSync line pair, the title string and the added comment in each test (test/e433-test-first-rules.test.mjs:551-552, test/e434-reviewer-visual.test.mjs:766-767); gate/pipeline counts, CLAUDE.md line count, CURRENT_VERSIONS, the closed-range and dist checks and the skip guards are byte-identical.
- S3: plain lane suite 4576/4579 pass, 3 skipped, 0 fail.
- `spawnSync` import still used elsewhere in both files (4 and 5 uses), so no dead import.
- Test review: the scenarios are about removing an assertion, so "no new test" is correct; qa's no-new-test record is accurate. The stamp freshness guarantee is still enforced at release time by `scripts/release.mjs` (`ADAPTER_STAMP`, exit 24, prepare phase), so no coverage is lost for the release path.

## Quality
No findings. The added comment is one line, states the why, and its claim (prepare re-checks the stamps) matches scripts/release.mjs:26. Titles now match what the tests assert.

## Architecture
No architecture spec; no layering change (test-only).

## Security
No findings. No product code, inputs or secrets touched.

## Performance
No findings. Removes two child-process spawns from the suite; no regression.

## Verdict
APPROVED — the diff removes exactly the release-window-sensitive assertion from both tests, keeps every other assertion, and the bumped-tree run plus negative control prove S1.

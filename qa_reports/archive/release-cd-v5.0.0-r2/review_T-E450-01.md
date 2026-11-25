# Judge report — T-E450-01

covers: T-E450-01, T-E450-02, T-E450-03

## Round 1 — APPROVED — by code-reviewer

## Expected-Red Diff
Expected-Red Diff: skipped (no manifest) — qa recorded qa_reports/no-new-test_e450-release-window-agc-check.txt instead; the lane suite has 0 actual reds, so there is nothing to diff.

## AC Execution Log
Scenarios per the coordinator brief from the `| E450 |` row of docs/backlog.md (no ticket file).

- S1 (release window, full suite 0 failures) — copy via `git archive HEAD | tar -x` into $TMPDIR/e450-bumped, node_modules symlinked to the primary checkout, package.json and the index.ts Server literal set to 5.0.0, `npx tsc` ok; `node bin/agc-init.mjs check` exit 1 (3 stale adapters, confirming the release-window state). `node --test test/*.test.mjs`: tests 4579, pass 4560, fail 8, skipped 11. All 8 failures are copy artifacts (`fatal: not a git repository` / `git ls-files` failed): agc-adapters E104(ii), check-md-tables AC7 and CQ-9, e234 AC16, e258b AC14, e295 AC12 (check-bookkeeping git ls-files), e299 REAL-CORPUS, release-staging Partition (E66). Re-run after `git init` + commit of the same bumped copy (agc check still exit 1): those 7 files plus e433/e434 — tests 297, pass 291, fail 0, skipped 6. Real failures: 0. — pass
- S1 negative control — main's versions of the two tests run in the bumped copy: AC12 and AC13 both `not ok` on the three stale-adapter lines. — pass (control behaves as expected)
- S2 (every other assertion unchanged) — `git diff main...HEAD -- test/` reviewed: only the spawnSync+assert pair, title fragment and comment line change in each test. — pass
- S3 (plain suite green) — `node scripts/test-lock.mjs -- npm test` on the lane tree: exit 0, tests 4579, pass 4576, fail 0, skipped 3. — pass
## 2026-11-24T16:36:28.213Z — PASS — by code-reviewer

suite-result: 4576/4579 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

E450 APPROVED. Test-only diff removes the live agc check exit-0 assert from e433 AC12 and e434 AC13; every other assertion unchanged (S2). S3: lane suite 4576/4579 pass, 3 skipped, 0 fail. S1: tree bumped to 5.0.0 with stamps at 4.23.0 (agc check exit 1) — full suite 4560 pass / 8 fail / 11 skip in the non-git copy, all 8 'not a git repository' copy artifacts; same copy git-init'ed: the 7 affected files plus e433/e434 run 291 pass / 0 fail / 6 skip. Negative control: main's two tests fail in the bumped tree on the stale stamps. Release stamp freshness is still enforced by scripts/release.mjs ADAPTER_STAMP (exit 24). review_report: review_reports/review_T-E450-01.md


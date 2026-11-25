# Judge report — T-E427-06

covers: T-E427-06, T-E427-07, T-E427-08

## Round 1 — APPROVED — by code-reviewer

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e427-ci-scenario-tests.txt`. The 15 T-E427-01 entries are history and the manifest's
amendment block marks them resolved. The current entry is the single AC18 line. Suite run: `node scripts/test-lock.mjs -- npm test`
on a tree with only `.current/e427/` state uncommitted gave 4720 pass / 4723, 3 skipped, 0 fail, exit 0. Actual reds: none.

- test/e427-check-scenario-tests.test.mjs | AC18 … no adapterLoadError: scenario test, now green. Built in T-E427-07.
- The 15 history entries (AC1–AC14, AC16): still green, so the amendment caused no regression.
- Reds off the manifest: none. The 3 skipped tests are the pre-existing skips, unchanged from the previous round.

## AC Execution Log

- AC18: the AC18 test in `test/e427-check-scenario-tests.test.mjs`, run within the full suite (`ok 2677`): pass. I also ran the CLI by hand with `./missing.mjs`, `./broken.mjs` and `./no-read-adapter.mjs`. Each exits 2. The first two print `adapterInvalid` followed by `adapterLoadError` with a non-empty reason; the third prints `adapterInvalid` only.
- AC18 test strength: 8 mutants of `loadReadResults`, run in a copy outside the worktree with `node --test --test-name-pattern=AC18`. All 8 were killed (`# fail 1`), and the restored original passes: pass.
- AC19: `node bin/agc-init.mjs check 2>&1 | grep -E "comments: scripts/(check-scenario-tests|scenario-results-node)\.mjs" ; echo "matches-exit=$?"` printed only `matches-exit=1`: pass.
- AC19 (no executable change): `git diff abcb9721 0364418c -U0`, with `//` lines filtered out, leaves no lines (grep exit 1): pass.
- `node bin/agc-init.mjs check` overall: exit 0: pass.
- AC9 / AC11 / AC13 (unchanged assertions): `ok 2673`, `ok 2674`, `ok 2676` in the full suite: pass.
- AC15: `node scripts/check-scenario-tests.mjs --results /nonexistent/test-results.xml; echo "exit=$?"` printed `check-scenario-tests: no named test in a done ticket; results not read` and `exit=0`: pass.
- AC17: `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` gave `# fail 0`, 4720/4723, 3 skipped, `exit=0`: pass locally (Node 22). CI `test (20)` / `test (22)` can only be verified after a push, which this hop does not do.
- `npm audit --audit-level=high`: exit 0.
## 2026-11-25T16:12:10.783Z — PASS — by code-reviewer

suite-result: 4720/4723 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Amendment 2026-11-25 (R1/R2) APPROVED. AC18 test killed 8/8 wrong-implementation mutants (no second line, swapped, not directly after, empty reason, extra line for no-readResults module, plain Error, reworded adapterInvalid, dropped module name). R2 matches Copy/Strings adapterLoadError verbatim, exit 2, adapterInvalid unchanged. R1 comment-only (stripped-code diff empty); AC19 command prints only matches-exit=1; agc check exit 0. AC15 none line + exit=0. npm audit high exit 0. T-E427-01..05 not regressed (all e427 tests green). Recommended (non-blocking): ERR_MODULE_NOT_FOUND reason carries absolute resolved/installer paths, spec-sanctioned via reason() cut.


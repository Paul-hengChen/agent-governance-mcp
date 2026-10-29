covers: T-E362-01, T-E362-02, T-E224-01

# QA review: e362-test-lock-guard (T-E362-01, T-E362-02, T-E224-01)

Verdict: PASS. Reviewer: qa-engineer (sonnet). Code review round 1 had APPROVED T-E362-01 (`review_reports/review_T-E362-01.md`).

Phase 0.5: skipped (no expected-red manifest declared). Phase 1 copy audit: N/A (E362 adds no user-facing strings; the only new string is the env name below, recorded in the changed files' comments). Phase 1 visual audit: N/A (no visual tokens). Phase 1.5: skipped (no Visual Baselines declared).

## T-E362-01 verification

- Fix commit `fe88f88` changes `scripts/test-lock.mjs` only. `reclaimStale` publishes the guard through `linkPublish` (temp file `<guardPath>.publish-<pid>-<seq>-<hex>`, best-effort fsync, `linkSync`), `publishLock` keeps the `<lock>.acquire-<pid>-<seq>-<hex>` temp shape (asserted in the reviewer's scratch repro, and `test/e209-test-lock-publish.test.mjs` is green and unmodified).
- `git diff --name-only origin/main...HEAD` (three-dot): `scripts/test-lock.mjs`, the three test files below, `specs/e362-test-lock-guard.md`, `review_reports/review_T-E362-01.md` and lane `.current/e362/*`. `scripts/mailbox-watch.mjs`, `tools/**`, `dist/**`, `test/e177b-lane-status.test.mjs` and `test/e209-test-lock-publish.test.mjs` are untouched (AC-E362-5, AC-LANE-2).

## T-E362-02 test authoring

New file `test/e362-reclaim-guard-publish.test.mjs` (6 tests). It reads the working-tree script only. `E362_SCRIPT_UNDER_TEST` (a path override, not used by the suite) exists only so qa can point the same cases at the pre-fix script; no sha is pinned and no `specs/fanout-*.md` is read.

| AC | test |
|---|---|
| AC-E362-1 | "a reclaimer stalled past the corrupt grace cannot unlink a live lock published after a second reclaimer took S". Interposes `openSync`/`linkSync` (first moment the guard exists: backdates it past `CORRUPT_GRACE_MS`, runs R2), then `readFileSync` of the target (runs R2 again, publishes live lock L if S is gone). Never calls `acquireLock` (E362-NEW-1 busy-spin). Asserts L survives, the guard is non-empty when first seen, and nothing is left behind. |
| AC-E362-2 | no `.reclaim-` file after a reclaim; lost race to a live guard leaves only guard + untouched target; non-EEXIST `linkSync` error does not throw and leaves no temp; every guard (incl. nested depth 1) is non-empty at publication and its temp name starts with `<guardPath>.` |
| AC-E362-3 | legacy zero-byte guard: fresh mtime leaves guard and target alone; backdated is reclaimed, target kept on that call, removed by the next call |
| AC-E362-4 | `test/e209-test-lock-publish.test.mjs` green and unmodified; every pre-existing e177b-test-lock case green in the full run |

Red on the pre-fix script (materialised from `git show fe88f88~1:scripts/test-lock.mjs` into the session scratch directory, then `E362_SCRIPT_UNDER_TEST=<that file> node --test test/e362-reclaim-guard-publish.test.mjs`): 3 pass / 3 fail. Failing: AC-E362-1 ("the live lock must survive the stalled reclaimer", `false !== true`, so R1 unlinked L), AC-E362-2 non-EEXIST link error (base has no `linkSync` path so the temp-file contract does not hold), AC-E362-2 nested guards ("expected nested + outer guard publishes, saw 0"). Green on lane HEAD: 6/6. Node 22 locally; the reviewer separately recorded Node 20 + 22 for the lock suites.

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC-E362-1 | `node --test test/e362-reclaim-guard-publish.test.mjs` on HEAD | 6 pass, 0 fail | PASS |
| AC-E362-1 (red on base) | same, with `E362_SCRIPT_UNDER_TEST` = pre-fix script | 3 pass, 3 fail (AC-E362-1 red) | PASS (red as required) |
| AC-E362-2 | same HEAD run, the four AC-E362-2 tests | pass | PASS |
| AC-E362-3 | same HEAD run | pass | PASS |
| AC-E362-4 | `test/e209-test-lock-publish.test.mjs` unmodified (not in the three-dot diff), green in the full suite | pass | PASS |
| AC-E362-5 | `git diff --name-only origin/main...HEAD` | only manifest e362 files, listed above | PASS |
| AC-E224-1 | `git diff origin/main...HEAD --unified=0 -- test/e177b-mailbox-watch.test.mjs` | one hunk at line 270, inside the AC17 body | PASS |
| AC-E224-2 | `node --test test/e177b-test-lock.test.mjs` | green (also in the full run) | PASS |
| AC-E224-3 | section `## AC10 decision` below | | PASS |
| AC-E224-4 | load rounds below | targeted cases green in all rounds; two other cases flaky (see below) | PASS with caveat |
| AC-LANE-1 | `node scripts/test-lock.mjs -- npm test` on the clean tree after the final code commit | exit 0, `# tests 3697 / # pass 3695 / # fail 0 / # skipped 2` | PASS |
| AC-LANE-2 | three-dot diff | see AC-E362-5; all three e177b/e209 files green in the AC-LANE-1 run | PASS |
| AC-LANE-3 | review of the test files | no fanout spec read, no sha pinned, no local path in tracked files | PASS |

`npm audit --audit-level=high`: exit 0.

## T-E224-01: decision and budgets

Decision: raise the budgets AND add one env override, `AGC_E177B_WAIT_MS` (positive number in ms; non-numeric or non-positive falls back to the default). One shared name, per the PM suggestion. It is read inline in the AC17 body, and in a small `waitBudget(defaultMs)` helper in `test/e177b-test-lock.test.mjs` (the shared `waitFor` default in the mailbox-watch file is unchanged). Reason: the failures were spawn-latency timeouts at the first `waitFor` (product fine); raising removes the failure class, the override lets a very loaded machine go further without editing a test. Budgets stay finite.

| budget | before | after | reason |
|---|---|---|---|
| mailbox AC17 first-watch lock appears | 3000 ms (shared default) | 15000 ms inline, env override | spawn + boot under load; stays inside the 20000 ms test timeout |
| test-lock AC13b wait for `childPid` recorded (`waitFor` default) | 3000 | 15000, env override | same; first spawn of wrapper + child |
| AC13b wrapper dead after SIGKILL | 2000 | 10000, env override | process reaping latency under load |
| AC13b `doneFile` after release | 3000 | 15000, env override | child wake-up latency |
| AC13b child dead | 2000 | 10000, env override | same |
| AC13b follow-up waiter `--max-wait` | 2 | 10 | wrapper spawn, then reclaim; an early exit is not delayed by a larger value |
| AC13b `node:test` timeout | 20000 | 60000 | the raised budgets can sum above 20000 ms; they only run long on a failing path |
| probe `--max-wait 0.2` | 0.2 | unchanged | expected to time out; meaning preserved |

AC17's first watch still uses `--deadline 10` (not a wait budget, outside this ticket); noted, not changed.

## AC10 decision

Changed, and the reason is evidence. Under 16 concurrent copies on this 8-core host (see rounds), the old wall-clock bound `elapsedMs < 8_000` (which includes the wrapper's node spawn) went red 9 times with `took 8070ms .. 12317ms` while the product reclaimed promptly. The new discriminator is the wrapper's own clock: `--max-wait 5` (was 15), exit code 0 asserted, the wall-clock assertion removed. Spawn latency before the wrapper starts is excluded. A liveness-based reclaim takes milliseconds; a reclaim that is age-based or waits out `CORRUPT_GRACE_MS` (10 s) outlasts 5 s, so the wrapper exits 75 and the test fails. Control run: a fresh corrupt lock (the grace-waiting path) with the same `--max-wait 5` exits with `LOCK-WAIT TIMEOUT after 5s ... Exit 75`. The `/reclaiming stale lock from dead pid 999999/` assertion is unchanged.

## Load evidence (AC-E224-4)

Host: 8 cores (`hw.ncpu`), 1-minute load average 18-29 before each round (other lanes' sessions). Load: N concurrent `node --test test/e177b-test-lock.test.mjs test/e177b-mailbox-watch.test.mjs`, output only in the session scratch directory. Total per copy: 41 tests.

| run | rounds x copies | outcome per copy (pass/41) |
|---|---|---|
| after the E224 budget edits, before the AC10 change | 3 x 8 | 23 of 24 copies 41/41; round 1 copy 3 40/41 (AC9 red, see below). AC10 / AC13b / AC17: 0 reds |
| 16 copies (2x cores), pre-AC10 change, exploratory | 2 x 16 | AC10 red 9 times (8.1-12.3 s), AC17 once (20 s `node:test` timeout), AC13a, AC7, AC13 queues, AC9 and the corrupt-payload case also timed out: 36-40/41 per copy |
| final code (AC10 changed) | 3 x 8 | rounds 1 and 2: all 16 copies 41/41; round 3: copies 2, 4, 6 are 40/41 (AC9 red twice, AC13a red once on its 20 s timeout), the other 5 41/41. AC10 / AC13b / AC17: 0 reds in 24 copy-runs |

Result for the three tickets' cases: AC17, AC13b and AC10 were green in every copy of every 8-copy round (72 copy-runs). The only failures at 8 copies were two other cases, AC9 (nested, fixed `elapsed < 10_000` bound, 10.0-18.4 s) and AC13a (5-process race, 20 s timeout), which this lane may not edit; they are filed as E362-NEW-2 in `.current/e362/pending-tickets.md`. So "every copy 41/41" holds only for rounds 1 and 2 of the final run, not for every copy of every round. Each round's pressure was above the pre-cut round 1 (load >= ~20), so no extra stressor was needed. At 16 copies (2x cores) the whole file set degrades, which is outside this ticket's scope.

## Out-of-scope findings

- E362-NEW-1 (from the cut): `acquireLock` busy-spins when a guard blocks a dead-pid target. Not touched.
- E362-NEW-2 (new, `.current/e362/pending-tickets.md`): AC9 and AC13a fixed budgets under load.

## Full suite (AC-LANE-1)

Final code commit: `test(e362): E362 E224 T-E362-02 T-E224-01 ...` (tests + pending-ticket block). Clean tree, no untracked files. `node scripts/test-lock.mjs -- npm test`: exit 0, 3697 tests, 3695 pass, 0 fail, 2 skipped (pre-existing skips). No reds. Tree still clean afterwards. This report and the lane state files are committed after that run as documentation-only changes.
## 2026-10-28T07:47:48.023Z — PASS — by qa-engineer

PASS. Full suite via test-lock on clean tree: 3695/3697 pass, 0 fail, 2 skipped. E362 repro red on pre-fix script (live lock destroyed), green on HEAD (6/6). E224: raised budgets plus AGC_E177B_WAIT_MS override; AC10 now judged by the wrapper's own --max-wait 5; AC17/AC13b/AC10 green in 72 copy-runs at 8 copies x 3 rounds. AC9/AC13a flaky under load, filed E362-NEW-2. Report: qa_reports/review_T-E362-01.md


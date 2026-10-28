# e362-test-lock-guard

Lane `e362` of fan-out wave `specs/fanout-post-v4-w11.md` (post-v4 queue wave 11). Two tickets on the test-lock and its tests, batched into one feature with one review round and one QA round: **E362** (P2, queue row 13a) and **E224** (P2, queue row 14, qa-only; E221 folded in). The scope is the manifest's e362 `範圍切線` cell (human-approved 2026-10-28); this spec writes it down and does not re-open it.

Line references below were checked against the lane base (`1adb50b`) at cut time.

## Problem Statement

**E362** — `reclaimStale` in `scripts/test-lock.mjs` (:114) takes its reclaim guard `<target>.reclaim-<digest>` with `fs.openSync(guardPath, "wx")` (:119) and writes the guard payload `{ pid, at }` later with a separate `fs.writeSync` (:138). Between the two calls the guard exists and is empty. A second reclaimer that gets `EEXIST` reads an empty guard as `corrupt`. Once the guard's mtime is older than `CORRUPT_GRACE_MS` (:130), it reclaims the guard one level down, which removes the first reclaimer's guard while that reclaimer is still alive. If the first reclaimer stalls for `CORRUPT_GRACE_MS` or more inside that window, both reclaimers end up holding a guard for the same stale content S. One unlinks S. An acquirer publishes a live lock L. The stalled reclaimer resumes and unlinks L at :148. Two suites then run at once. The E209 code review (archived `review_reports/archive/release-post-v4-w10/review_T-E209-01.md`, F1, AC-E209-6 ruling) reproduced this deterministically on a scratch copy. It is the same "create empty, write later" pattern that E209 removed from the lock file itself (`publishLock`, :193, temp file plus `linkSync`), one level down.

**E224** (E221 folded in) — Under full-suite or multi-lane load, three cases go red on fixed wait budgets: `test/e177b-mailbox-watch.test.mjs` AC17 ("a second, independent mailbox-watch process on the SAME file refuses to start") and `test/e177b-test-lock.test.mjs` AC10 ("a lock left by a DEAD pid is reclaimed promptly …") and AC13b ("SIGKILLing the wrapper does not free the lock …"). All of them pass when run alone. The integrator re-ran them serially five times and never reproduced the failure, which points to cross-process contention.

## User Stories

- As a lane session running `node scripts/test-lock.mjs -- npm test`, I want a stalled reclaimer never to delete a live lock, so that two full suites never run concurrently.
- As a QA engineer on a machine shared by several lanes, I want the e177b lock and mailbox tests not to go red on a fixed 3 s spawn wait, so that a red `npm test` means a real regression.

## Acceptance Criteria

Test ownership (Constitution §2; `docs/lane-protocol.md` §2): sr-engineer writes no test file. Every `proof:` below is a qa-engineer test or a qa-engineer command.

### E362 — the reclaim guard is never observable empty (`scripts/test-lock.mjs`)

- **AC-E362-1** (deterministic repro, red on base) — This AC reproduces the E209 review's F1 sequence. Setup: a temp directory, a lock file holding stale content S (a payload whose pid is dead), and reclaimer R1 = `reclaimStale(lockPath, S)` running in-process. The interposer fires once, at the moment R1's guard first exists: after `openSync(guardPath, "wx")` on base, after the publishing call on the fix. It backdates the guard's mtime by more than `CORRUPT_GRACE_MS` (for example with `fs.utimesSync`), which simulates the ≥ 10 s stall. It then runs a second reclaimer R2 = `reclaimStale(lockPath, S)`. At the point where R1 has read the target and found it equal to S, a second interposer runs R2 again. If R2 has removed S by then, an acquirer publishes a live lock L. When R1 returns, the invariant must hold: if an acquirer was told `acquired: true`, its lock file still exists and names it. Against the base copy of the script the case is red: the base copy is `git show 1adb50b:scripts/test-lock.mjs` written to a temp file and imported, for example through an `E362_SCRIPT_UNDER_TEST` path override like E209's, which the suite does not use. On base, R2 removes R1's empty guard, and R1 later unlinks L. Constraints on the test:
  - It must be deterministic: no sleeps and no races. It uses the CommonJS `node:fs` object plus `module.syncBuiltinESMExports()`, as `test/e209-test-lock-publish.test.mjs` does, or an equivalent that qa chooses.
  - It must not call `acquireLock` while the target still holds dead-pid content that a live guard blocks from being reclaimed. In that state `acquireLock`'s dead-holder branch (:257–260) retries with no wait and no `--max-wait` check, so it would spin forever (see the new finding E362-NEW-1).
  - The interposer's exact hook points are qa's choice. The sequence above is the contract.

  proof: new case in `test/e362-*.test.mjs`. qa runs it once against the base copy and records the red run in qa evidence, and it is green against the lane HEAD.
- **AC-E362-2** (publish the guard by link) — `reclaimStale` builds the guard payload `{ pid: process.pid, at: <ISO time> }` (shape unchanged) and writes it to a temp file in the guard's directory. The temp name is unique per attempt: it carries `process.pid` plus a per-call counter or a random suffix, and it starts with `<guardPath>.`, so the existing `.reclaim-` leftover check in AC13a also covers it. The temp file is fsynced best-effort, as `publishLock` does today, and then published with `fs.linkSync(tmp, guardPath)`.
  - `EEXIST` from the link takes the existing inspection path unchanged: a dead-pid guard is reclaimed one level down, a corrupt guard past `CORRUPT_GRACE_MS` is reclaimed one level down, and the `depth < 2` bound and the early `return` stay.
  - Any other error makes `reclaimStale` return without throwing, exactly as base does for a non-`EEXIST` `openSync` error.
  - The temp file is unlinked in every outcome: published, `EEXIST`, or another error.
  - The compare-and-unlink step after the guard is held is unchanged: read the target, unlink it only if it is byte-equal to `observedRaw`, and unlink the guard in `finally`.
  - Nested guards (`depth` 1 and 2) are published the same way.
  - sr-engineer may extract one helper that both `publishLock` and the guard use, but only if `publishLock`'s observable behaviour stays identical. That behaviour is the temp name shape `<lock>.acquire-<pid>-<seq>-<hex>`, fsync, link, `EEXIST` and other-error propagation, and temp removal (AC-E362-4).

  proof: new `test/e362-*.test.mjs` cases cover four things. After a reclaim, the directory holds no `.reclaim-` file. After a reclaim that loses to a live guard (`EEXIST`), only that guard remains. A non-`EEXIST` link error is injected, `reclaimStale` does not throw, and no temp file is left. The guard observed at the moment of publication is never empty.
- **AC-E362-3** (legacy guard unchanged) — A guard file that is empty or unparseable, left by a pre-fix crash or created by hand, is still treated as corrupt. It is reclaimed one level down only after `CORRUPT_GRACE_MS`, and before that `reclaimStale` returns without touching the target.
  proof: a new `test/e362-*.test.mjs` case. It uses a zero-byte guard with a fresh mtime and checks that neither the guard nor the stale target is removed. It also backdates the mtime past the grace period and checks that the guard is reclaimed and a following call reclaims the target.
- **AC-E362-4** (lock publish, API, and CLI unchanged) — The E209 lock-file publish does not change: the `publishLock` temp-plus-`linkSync` behaviour, its temp name, and its error contract. The exports and signatures of `reclaimStale`, `readLock`, `acquireLock`, `recordChildPid`, `releaseLock`, `isHolderAlive`, `isPidAlive`, `resolveLockPath`, `formatWaitingLine`, `parseTestLockArgs`, `main`, and every exported constant (`CORRUPT_GRACE_MS` included) do not change. `USAGE`, the flags, the `--` separator, the exit codes 75 and 64, and the `node scripts/test-lock.mjs -- npm test` usage do not change.
  proof: `test/e209-test-lock-publish.test.mjs` is green and unmodified, and every pre-existing case in `test/e177b-test-lock.test.mjs` is green. The only changes allowed there are E224's wait budgets (AC-E224-2/3) and additive cases.
- **AC-E362-5** (single-file change) — The E362 fix touches `scripts/test-lock.mjs` only. No line of `scripts/mailbox-watch.mjs`, other `scripts/**`, `tools/**` or `dist/**` changes. (`scripts/test-lock.mjs` is not compiled, so there is no `dist/` change to make.)
  proof: `git diff --name-only origin/main...HEAD` (merge-base form, lane-protocol §7.4) lists only files from the manifest e362 row's `擁有` cell. This is checked once in review and qa evidence, not as a resident assertion.

### E224 — fixed wait budgets no longer go red under load (qa-only, E221 folded in)

Pre-cut load reproduction (PM, 2026-10-28, cut-time evidence, not a resident test):
- Load: 8 concurrent `node --test test/e177b-test-lock.test.mjs test/e177b-mailbox-watch.test.mjs` processes on an 8-core host whose 1-minute load average was already about 37–47 from other lanes' sessions. Two rounds were run on base `1adb50b`.
- Round 1 failed 6 times across 8 copies: AC17 ×4, at the `waitFor(() => fs.existsSync(lockPath))` call (`test/e177b-mailbox-watch.test.mjs`:270, default 3000 ms), and AC13b ×2, at the first `waitFor` that waits for `childPid` to be recorded in the lock (`test/e177b-test-lock.test.mjs`:459, default 3000 ms). Every failure was `waitFor: timed out`.
- Round 2 had a load of about 21 → 14 and was 8/8 green.
- AC10 did not go red in this run. Its budget is not a `waitFor`. It is the wall-clock assertion `elapsedMs < 8_000` (:241), which includes spawning the wrapper, plus `--max-wait 15`.

- **AC-E224-1** (mailbox-watch AC17) — The wait for the first watch's lock to appear in AC17 is no longer a fixed 3000 ms. qa chooses one or both options:
  - (a) Raise it. PM suggests 15000 ms, which leaves margin inside the test's 20000 ms `node:test` timeout.
  - (b) Add an environment override. A non-numeric or non-positive value falls back to the default.

  The budget stays finite, so a watch that never takes its lock still fails. The diff to `test/e177b-mailbox-watch.test.mjs` is confined to the AC17 test body. The shared `waitFor` helper's default and every other test in the file stay byte-identical, and an env read, if qa chooses one, is inline in the AC17 body. AC17's behavioural assertions (refusal exit code, `refusing to start`, `already being watched by pid`, lock released after SIGTERM) do not change.
  proof: `git diff origin/main...HEAD -- test/e177b-mailbox-watch.test.mjs` shows hunks inside the AC17 test only (checked once in qa evidence). `node --test test/e177b-mailbox-watch.test.mjs` is green.
- **AC-E224-2** (test-lock AC13b) — Every fixed wait budget in AC13b is reviewed: the `waitFor` calls at :459, :469, :484 and :485, and the follow-up waiter's `--max-wait 2` at :487. Each one that can expire because of spawn or scheduling latency, rather than because the product misbehaves, is raised and/or made env-overridable. They stay finite, and the total stays inside the test's 20000 ms timeout, or qa raises that timeout with the reason stated. The probe's short `--max-wait 0.2`, which is expected to time out, keeps its meaning. AC13b's behavioural assertions do not change. Because the `waitFor` helper in this file is only called inside AC13b, qa may change its default here.
  proof: `node --test test/e177b-test-lock.test.mjs` is green, and the qa evidence lists each budget before and after with its reason.
- **AC-E224-3** (test-lock AC10) — qa decides whether AC10's `elapsedMs < 8_000` bound needs a change. The bound must still catch a reclaim that is age-based or that waits out the grace period. Either it stays below `CORRUPT_GRACE_MS` (10000 ms), or qa measures reclaim latency in a way that excludes the wrapper's spawn time and states how. `assert.match(… /reclaiming stale lock from dead pid 999999/)` and the exit-0 assertion do not change. If qa leaves AC10 unchanged, the qa report says why: it was not reproduced in the PM run or in qa's load runs, or a reason qa states.
  proof: qa evidence section `## AC10 decision`.
- **AC-E224-4** (under load) — Under the same synthetic load as the pre-cut run, every copy is green, with qa stating the host core count and load average. The load is 8 concurrent copies of both e177b files, or the host's core count, for at least 3 rounds. qa records pass/total per copy per round. If no round shows pressure comparable to the pre-cut round 1 (load ≥ ~20), qa adds an equivalent CPU stressor and says so. The choice of raised or env-overridable budgets, the env variable name(s) if any, and the reason go in the qa report and in a header or inline comment in each changed test file.
  proof: the qa evidence table of rounds, every copy `41/41` (or the files' current combined total).

### Completion definition (manifest `完成定義` rows for e362, verbatim)

| 完成定義條目 | 由哪張票讓它成立 | ACs |
|---|---|---|
| reclaim guard 檔永遠不會以空檔被看到，停滯的回收者不會刪掉活著的鎖，有 qa 的確定性重現 | e362（E362） | AC-E362-1..5 |
| mailbox-watch AC17、test-lock AC10／AC13b 在全套負載下不再撞固定 3 秒逾時 | e362（E224） | AC-E224-1..4 |
| 被改變行為釘住的測試重新固定，其他測試全綠不改 | e362（各自的 qa） | AC-E362-4, AC-LANE-1..3 |

### Lane-wide

- **AC-LANE-1** — The full suite runs once via `node scripts/test-lock.mjs -- npm test`, after the final commit, on a clean tree with no untracked files, on the lane's final HEAD. qa evidence quotes pass/total. This run also exercises the E362 fix, because test-lock itself is the suite's outer wrap.
- **AC-LANE-2** — `git diff --name-only origin/main...HEAD` lists only files from the manifest e362 row's `擁有` cell. `scripts/mailbox-watch.mjs`, `test/e177b-lane-status.test.mjs`, `tools/**` and `dist/**` are untouched. All three e177b/e209 test files are green in AC-LANE-1's run.
- **AC-LANE-3** — No new test asserts growable content of a real `specs/fanout-*.md`, runs a resident diff against a fixed lane base sha, or writes a local absolute path into a tracked file. The red run against the base copy happens in qa's session and is recorded in evidence. The resident test runs against the working tree only.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e177b-test.wait-env | env variable name(s) for the E224 wait override, only if qa chooses option (b) in AC-E224-1/2 (PM suggests one shared name such as `AGC_E177B_WAIT_MS`) | authored-here — developer-facing test knob; qa picks the final name and records it in the changed files' comments and the qa report |

E362 adds no user-facing strings. The existing `test-lock: reclaiming …` stderr lines do not change.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E363 (the spawn-headroom data point), E238, E254, E278, and any other intermittent test. E156 is also out.
- `acquireLock`'s busy retry when a dead-pid target is blocked by a live guard. It does not sleep and does not check `--max-wait` (:257–260). This is pre-existing and was found at cut time. It is filed as E362-NEW-1 in `.current/e362/pending-tickets.md` and is not fixed here.
- Any change to the lock-file publish (E209), lock staleness rules, `CORRUPT_GRACE_MS`, the guard digest/naming scheme, or any test-lock CLI surface.
- Sweeping temp files orphaned by a crash between the temp write and the link, for either the lock or the guard. They are harmless leftovers that no reader lists.
- Any line of `scripts/mailbox-watch.mjs`, and any test in `test/e177b-mailbox-watch.test.mjs` other than AC17's wait budget.
- Every file the manifest e362 row forbids: `tools/**`, `dist/**`, `gates/**`, `guards/**`, `prompts/**`, `content/**`, `bin/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, other `scripts/**`, `docs/**`, other `.current/**`, other `test/**` (including e139's and e217's tests and `test/e177b-lane-status.test.mjs`), and other `specs/**`. Also everything on the wave-wide common forbidden list (`docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-*.md`, `CHANGELOG.md`, `package.json`, …).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks, queue DONE marks) belongs to the integrator or release-engineer.

## Dependencies / Prerequisites

- The lane base is `1adb50b` (the wave-11 manifest merged into `main`). There is no cross-lane dependency (manifest `相依` = 無), and the file sets are disjoint from lanes e139 and e217.
- **Queue row 14 "reproduce under concurrent full-suite load before cutting": decision recorded.**
  - A literal concurrent *full-suite* reproduction was not attempted. Every full suite in this wave must be wrapped in `node scripts/test-lock.mjs -- npm test`, and that wrapper serializes full suites across all worktrees, so two wrapped suites cannot overlap by design. An unwrapped `npm test` would break the wave rule, hold the shared machine against lanes e139/e217, and run `prebuild` (which rewrites `dist/`) during a PM hop that must not modify files.
  - The PM ran a bounded substitute instead: 8 concurrent copies of the two target files, 2 rounds, with output only in the session scratch directory. It reproduced the failure class (round 1: 6 reds, see the E224 section). This is enough to cut on. It also shows that the operative budgets are the AC17 and AC13b first-spawn `waitFor` calls, and that AC10's at-risk budget is a wall-clock bound, not a `waitFor`.
- **PM interpretations for the integrator's pre-review.** None of these is an option choice; each follows from the ticket text or the manifest.
  1. The manifest gives mailbox-watch "只限 AC17 的等待預算", which means the AC17 test body only. The shared `waitFor` default in that file stays unchanged (AC-E224-1).
  2. In `test/e177b-test-lock.test.mjs`, `waitFor` is called only inside AC13b, so changing its default there affects only AC13b's budgets (AC-E224-2).
  3. The E224 fix choice (raise and/or env override) belongs to qa per the manifest. The PM only suggests values.
  4. The E362 repro asserts the invariant ("a lock an acquirer was told it holds still exists"), not a specific interposer layout. qa may model the F1 sequence differently as long as the run is red on base and green on HEAD.
- **Dispatch mode is `feature`, not `bugfix`.** E362 is a bug with a qa repro, but in this repo only qa-engineer may write tests. Bugfix mode would make sr-engineer write and record the failing reproduction before the fix (`REPRO_MANIFEST_MISSING` on the sr → code-reviewer hop). This follows the E209 precedent (`specs/e209-test-infra-fixes.md`): feature mode with a qa-owned repro. qa runs AC-E362-1 against the base copy, records the red run, then runs it against the fix.
- Routing is pm → sr-engineer (T-E362-01) → code-reviewer → qa-engineer (T-E362-02, then T-E224-01). There is no architect: the fix is one function in one file, with no new data model and no cross-cutting API. `dispatch_pins` are `pm=opus` and `sr-engineer=opus`.
- Resource Audit: there are no external references to fetch. The backlog rows, queue rows, manifest and the archived E209 review cite only in-repo files, lane names and run counts.
- Visual Structural Assertions are omitted: there is no `design/<feature>.md`, and the mode is no-design.
- **Test files qa may touch** (for the Cut below): `test/e362-*.test.mjs` (new); `test/e224-*.test.mjs` (new, optional); `test/e177b-test-lock.test.mjs` (wait budgets in AC10/AC13b and additive cases only); `test/e177b-mailbox-watch.test.mjs` (the AC17 test body's wait budget only). `test/e209-test-lock-publish.test.mjs` is owned but must stay unmodified (AC-E362-4). No other test file may be touched.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E362-01 | sr: `reclaimStale` publishes its guard `<target>.reclaim-<digest>` via a unique same-directory temp file (name prefixed `<guardPath>.`) + best-effort fsync + `fs.linkSync`, so the guard is never observable empty; `EEXIST` takes the existing inspection path; other errors return silently; temp removed in every outcome; nested guards the same; E209 lock publish, payloads, exports and CLI unchanged (AC-E362-2..5) | none | 1 | `scripts/test-lock.mjs` | — |
| T-E362-02 | qa: deterministic F1 interposition repro (red on base copy `1adb50b`, green on HEAD), guard temp cleanup / lost-race / non-EEXIST cases, legacy empty-guard grace case; `test/e209-test-lock-publish.test.mjs` unmodified (AC-E362-1..4) | T-E362-01 | 1 | `test/e362-*.test.mjs` | — |
| T-E224-01 | qa-only: AC17 (AC17 body only), AC13b and AC10 wait budgets raised and/or env-overridable with reasons, load evidence ≥ 3 rounds, `## AC10 decision`; then the lane-wide full suite via test-lock after the final commit (AC-E224-1..4, AC-LANE-1..3) | T-E362-02 | 2–3 | `test/e177b-test-lock.test.mjs`, `test/e177b-mailbox-watch.test.mjs`, `test/e224-*.test.mjs` | — |

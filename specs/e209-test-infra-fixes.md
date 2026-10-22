# e209-test-infra-fixes

Lane `e209` of fan-out wave `specs/fanout-post-v4-w10.md` (post-v4 queue wave 10, D2). Three small, disjoint test-infrastructure tickets batched into one feature with one review round and one QA round: **E209** (P2), **E182** (P2, qa-only), **E183** (P2). The scope cut is the manifest's e209 `範圍切線` cell (human-approved 2026-10-20, "D2 開"); this spec writes it down, it does not re-open it.

Line references below were re-verified against the lane base (`2ad039d`) at cut time.

## Problem Statement

**E209** — `acquireLock` in `scripts/test-lock.mjs` creates the lock with `fs.openSync(lockPath, "wx")` (:205) and only then writes the JSON payload (:214). Between those two calls the lock file exists and is empty. `reclaimStale` (:114–158) decides "same incarnation" by comparing the file's current content with the content it observed earlier; a reclaimer that observed an *old* empty lock (a creator that crashed before writing, reclaimed after `CORRUPT_GRACE_MS`) therefore sees a *new*, still-empty, live lock as the same stale file and unlinks it. Two suites then run at once, which is the E182 failure the lock exists to prevent. The race was confirmed at cut time: interposing `reclaimStale(lockPath, <content observed right after openSync>)` makes `acquireLock` return `acquired: true` while the lock file is gone.
**E182** — `runHook` in `test/usage-accounting.test.mjs` (:343) spawns the usage hook with a fixed `timeoutMs = 5000`. Under concurrent-lane load the spawn exceeds 5 s, `spawnSync` kills the child, `status` is `null`, and a random hook test goes red (e73 / e124 / e137 lanes; 2 of 3 full runs at load about 7). The queue row also names E182 as the candidate cause of E156 (an unreproduced one-in-six full-suite failure in `test/teamwork-lite.test.mjs` AC3b); that has to be checked, not assumed.
**E183** — `scripts/summarize-metrics.mjs` defaults to `.current/metrics.jsonl` (:13). After the E123 lane flip live writers append to `.current/<lane>/metrics.jsonl` (`.current/_primary/metrics.jsonl` on a primary checkout), so a bare run finds nothing and prints `no metrics yet` with exit 0: the E6 retro reads a silent zero. A missing explicit path is also exit 0. `docs/gate-retro-procedure.md` (:101–109) documents the flat default and works around it in prose.

## User Stories

- As a lane session running `node scripts/test-lock.mjs -- npm test`, I want a freshly acquired lock never to be deleted by a late reclaimer, so that two full suites never run concurrently.
- As a QA engineer under multi-lane load, I want the usage-hook tests not to fail on a fixed 5 s spawn ceiling, so that a red `npm test` means a real regression.
- As the person running the E6 gate retro, I want `node scripts/summarize-metrics.mjs` with no argument to read the metrics the current checkout actually writes, and to fail loudly when there is no file, so that a zero in the retro is a real zero.

## Acceptance Criteria

Test ownership (Constitution §2; `docs/lane-protocol.md` §2): sr-engineer writes no test file. Every `proof:` below is a qa-engineer test or a qa-engineer command.

### E209 — the lock file is never observable empty (`scripts/test-lock.mjs`)

- **AC-E209-1** (deterministic repro, red on base) — Given a fresh `--lock-path`-style temp directory and an interposer that, the first time the lock path comes into existence during `acquireLock` (after the call that creates it: `openSync` on base, the publishing call on the fix), reads the lock file and calls the exported `reclaimStale(lockPath, <content read>)`, when `acquireLock({ lockPath })` resolves `acquired: true`, then the lock file still exists and its payload names `process.pid`. Against the base copy of the script (`git show 2ad039d:scripts/test-lock.mjs` written to a temp file and imported) the same case is red: the observed content is empty and the lock is gone. Interposition is via the CommonJS `node:fs` object plus `module.syncBuiltinESMExports()` (the script uses `import * as fs`, so the namespace picks up the patch) or an equivalent qa chooses; it must be deterministic (no sleeps, no races).
  proof: new case in `test/e209-*.test.mjs`, run once against the base copy (recorded red in qa evidence) and green against the lane HEAD.
- **AC-E209-2** (publish by link) — `acquireLock` writes the payload to a temp file in the same directory as the lock (name unique per attempt: carries `process.pid` plus a per-call counter or random suffix, and is distinct from `recordChildPid`'s `<lock>.tmp-<pid>` name), fsyncs it best-effort as today, then publishes with `fs.linkSync(tmp, lockPath)`. `EEXIST` from the link takes the existing contention path unchanged (read, reclaim-if-dead, wait/notify, `--max-wait`). Any other error propagates exactly as a non-`EEXIST` `openSync` error does on base. The temp file is unlinked in every outcome (published, `EEXIST`, other error).
  proof: new `test/e209-*.test.mjs` cases: after a successful acquire, and after an acquire that hits a live holder and times out, the lock directory contains no file other than the lock (and, in the contention case, the holder's lock only).
- **AC-E209-3** (payload and API unchanged) — The on-disk payload and the returned `payload` keep the base shape `{ pid, acquiredAt, worktreePath, startedAt }`. The exports and signatures of `readLock`, `reclaimStale`, `recordChildPid`, `releaseLock`, `isHolderAlive`, `isPidAlive`, `resolveLockPath`, `formatWaitingLine`, `parseTestLockArgs`, `main` and every exported constant are unchanged.
  proof: every pre-existing case in `test/e177b-test-lock.test.mjs` passes; qa adds cases there only additively, and the AC10 cases' assertions are byte-identical to base (`git diff 2ad039d -- test/e177b-test-lock.test.mjs` shows no removed line inside the two AC10 tests — checked once in qa evidence, not as a resident assertion).
- **AC-E209-4** (legacy empty / corrupt lock unchanged) — A lock file that is empty or unparseable (left by a pre-fix crash or by hand) is still treated as corrupt and reclaimed only after `CORRUPT_GRACE_MS`; `readLock` and `reclaimStale` behaviour is unchanged.
  proof: the existing `Security/boundary: an unparseable (corrupt) lock payload …` case stays green unmodified; qa adds one case with an empty (zero-byte) lock file asserting it is not reclaimed before the grace period.
- **AC-E209-5** (CLI unchanged) — `USAGE`, the flags (`--max-wait`, `--lock-path`, `--poll-ms`, `--notify-interval`), the `--` separator, the exit codes (`LOCK_TIMEOUT_EXIT_CODE` 75, `USAGE_EXIT_CODE` 64) and the `node scripts/test-lock.mjs -- npm test` usage are unchanged.
  proof: existing CLI cases in `test/e177b-test-lock.test.mjs` (AC7, AC9, AC12, AC13, usage-error case) green unmodified.
- **AC-E209-6** (reclaim guard needs no change) — The `reclaimStale` guard file (`<target>.reclaim-<digest>`) keeps its own `openSync("wx")` + write. PM analysis for the reviewer to confirm: once the target lock is never empty, two reclaimers holding the same observed content can only unlink a file whose content still equals that content, and a newly published lock always carries a fresh `acquiredAt`/`pid`, so a momentarily-empty guard cannot lead to a live lock being deleted. No change to the guard path in this ticket.
  proof: code-reviewer states agreement or a counterexample in `review_reports/review_T-E209-01.md`.

### E182 — usage-hook spawn timeout no longer a fixed 5000 ms (`test/usage-accounting.test.mjs`, qa-only)

- **AC-E182-1** — `runHook`'s spawn timeout is no longer a hard-coded 5000 ms. qa-engineer chooses one or both of: (a) raise the default (PM suggests 20000 ms, the same ceiling `test/teamwork-lite.test.mjs`'s `spawnAndAwait` uses); (b) an environment override (PM suggests `AGC_USAGE_HOOK_TEST_TIMEOUT_MS`) where a non-numeric or non-positive value falls back to the default. The timeout stays finite, so a genuinely hung hook still fails. The choice and the reason go in the file's header comment and in qa evidence.
  proof: `grep -n "timeoutMs" test/usage-accounting.test.mjs` shows no literal `5000` default; `node --test test/usage-accounting.test.mjs` green.
- **AC-E182-2** (under load) — Under synthetic load the file is green: qa runs `test/usage-accounting.test.mjs` as 8 concurrent copies (the host's core count at cut time; qa states the count used) for at least 3 rounds and records pass/total per round in qa evidence. If a pre-fix baseline under the same load shows reds, that is recorded too (red-on-base is evidence, not a requirement: the flake is load-dependent).
  proof: qa evidence table of rounds, each `35/35` (or the file's current total) for every copy.
- **AC-E182-3** (E156 cause judgment, recorded only) — qa evidence contains a section `## E156 cause judgment` stating whether E182 is a direct cause, an indirect (shared-load) contributor, or unrelated to E156, with the facts it rests on. PM's preliminary reading, for qa to confirm or refute from the repo: (1) E156's failing assertion is in `test/teamwork-lite.test.mjs` AC3b, which spawns `dist/index.js` through its own response-driven `spawnAndAwait` with a 20000 ms ceiling, not through `runHook`; (2) the E156 run had exactly one failure (2233/2234), so `test/usage-accounting.test.mjs` was green in that run; (3) a killed `spawnSync` child in one test-file process cannot affect another file's process. So a direct link is not plausible; at most both are symptoms of the same machine saturation under parallel `node --test`, which this fix does not address for AC3b. Caveat to state: the repository history was reset at v4.0.0 (2026-09-28), after E156 (2026-09-22), so AC3b's ceiling at the time of E156 cannot be read from git. E156 is not fixed, closed or edited by this lane.
  proof: the section exists in `qa_reports/review_T-E182-01.md` with a one-word verdict (`direct` / `indirect` / `unrelated`) and the cited lines.

### E183 — summarize-metrics resolves the lane path and fails loudly (`scripts/summarize-metrics.mjs`, `docs/gate-retro-procedure.md`)

Fixtures: a temp workspace whose `.git/HEAD` is `ref: refs/heads/<branch>` (the lane resolver reads HEAD by pure fs; no `git` subprocess needed), spawned with `cwd` = that workspace.

- **AC-E183-1** (lane default) — Given branch `feat/e999-x` and records in `.current/e999/metrics.jsonl`, when `node scripts/summarize-metrics.mjs` runs with no argument, then it summarizes those records (exit 0, `features: <n>`).
  proof: new case in `test/e183-*.test.mjs`.
- **AC-E183-2** (primary default) — Given branch `main` (or `integ/<x>`, or a detached HEAD) and records in `.current/_primary/metrics.jsonl`, when run with no argument, then it summarizes those records.
  proof: new case in `test/e183-*.test.mjs`.
- **AC-E183-3** (legacy flat fallback) — Given the current lane's file is absent and a legacy flat `.current/metrics.jsonl` exists (a workspace not yet migrated), when run with no argument, then it summarizes the flat file and prints to stderr a note naming both the lane path it tried and the flat path it read.
  proof: new case in `test/e183-*.test.mjs` (exit 0, stdout summary, stderr matches `legacy flat`).
- **AC-E183-4** (loud failure, default) — Given neither the current lane's file nor the flat file exists, when run with no argument, then it exits 1, stderr names every path it tried and points to an explicit path argument and to `tw_gate_stats` for cross-lane totals, and stdout contains neither `no metrics yet` nor `aggregate`.
  proof: new case in `test/e183-*.test.mjs` — repro, recorded red against the base script (base prints `no metrics yet`, exit 0).
- **AC-E183-5** (loud failure, explicit path) — Given an explicit path argument that does not exist (or cannot be read), when run, then it exits 1 and stderr names that path (and the error code for a non-`ENOENT` read error). No lane resolution is attempted when a path is given.
  proof: `test/success-metrics.test.mjs` E8-S4 re-pinned to exit 1 + stderr (qa-owned, summarize-metrics assertions only); red against base.
- **AC-E183-6** (unchanged behaviours) — An existing file that is empty or has no valid records still exits 0 with `no metrics yet`; the happy path, malformed-line counting, the legend and the aggregate line are unchanged. The script still reads one file and does no cross-file dedupe (cross-lane totals stay `tw_gate_stats`'s job).
  proof: E8-S1, E8-S2, E8-S3 in `test/success-metrics.test.mjs` green unmodified.
- **AC-E183-7** (resolver source) — The default path comes from the shipped `dist/tools/lane-paths.js` exports `resolveCurrentLanePaths(cwd).metricsPath` and `resolveFlatLanePaths(cwd).metricsPath` (the same resolver `tw_gate_stats` uses, already exported from `dist/`; precedent: `scripts/lane-status.mjs`, `scripts/feature-rollup.mjs` import from `../dist/tools/`). No line of `tools/**` or `dist/**` changes.
  proof: `git diff 2ad039d --name-only -- tools/ dist/` is empty.
- **AC-E183-8** (doc) — `docs/gate-retro-procedure.md`'s Success-metrics section says the bare command reads the current lane's `.current/<lane>/metrics.jsonl` (`.current/_primary/metrics.jsonl` on a primary checkout), falls back to a legacy flat file, and exits non-zero when none exists; the paragraph saying the default "is still the pre-lane flat path" is removed; the advice to prefer `tw_gate_stats` for cross-lane totals and not to glob several copies into the script stays. The script's header comment (usage lines) matches.
  proof: `grep -n "default: .current/metrics.jsonl\|still the pre-lane flat path" docs/gate-retro-procedure.md scripts/summarize-metrics.mjs` prints nothing.

### Completion definition (manifest `完成定義` rows for e209, verbatim)

| 完成定義條目 | 由哪張票讓它成立 | ACs |
|---|---|---|
| 空鎖檔不會讓回收者刪掉活著的鎖 | e209（E209） | AC-E209-1..6 |
| `usage-accounting` 的 hook 測試在負載下不再因固定 5000 ms 逾時而紅；E156 的成因判斷寫進 qa 報告 | e209（E182） | AC-E182-1..3 |
| `summarize-metrics.mjs` 不帶參數執行時讀得到 lane 的 metrics，或大聲失敗；retro 文件同步 | e209（E183） | AC-E183-1..8 |
| 被改變行為釘住的測試重新固定，其他測試全綠不改 | e135、e209（各自的 qa） | AC-E183-5, AC-LANE-1..3 |

### Lane-wide

- **AC-LANE-1** — The full suite is run once via `node scripts/test-lock.mjs -- npm test`, after the final commit, on a clean tree (no untracked files), on the lane's final HEAD; pass/total quoted in qa evidence. (This run also exercises the E209 fix: the suite's outer wrap is test-lock itself.)
- **AC-LANE-2** — `git diff 2ad039d --name-only` lists only files in the manifest e209 row's `擁有` cell. In particular `test/e177b-mailbox-watch.test.mjs`, `test/e177b-lane-status.test.mjs`, `tools/**` and `dist/**` are untouched, and both e177b tests are green in AC-LANE-1's run.
- **AC-LANE-3** — No new test asserts growable content of a real `specs/fanout-*.md`, diffs a file against a fixed lane base sha as a resident assertion, or writes a local absolute path into a tracked file. (Running a repro against the base copy is done in qa's session and recorded in evidence; the resident test runs against the working tree only.)

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| summarize-metrics.not-found | stderr line(s) for AC-E183-4/5; must start with `summarize-metrics:`, contain `no metrics file`, every path tried, and (default resolution only) `tw_gate_stats` | authored-here — operator-facing diagnostic; sr-engineer chooses the remaining wording, tests match on the quoted fragments only |
| summarize-metrics.unreadable | stderr line for a non-`ENOENT` read error; must start with `summarize-metrics:`, contain `cannot read`, the path and the error code | authored-here — same rule |
| summarize-metrics.flat-fallback | stderr note for AC-E183-3; must start with `summarize-metrics:`, contain `legacy flat`, the lane path tried and the flat path read | authored-here — same rule |
| usage-hook-test.timeout-env | `AGC_USAGE_HOOK_TEST_TIMEOUT_MS` (only if qa chooses option (b) in AC-E182-1) | authored-here — developer-facing test knob; qa may rename it, the header comment records the final name |

No user-facing strings in E209.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E224 (mailbox-watch AC17 / test-lock AC10 waitFor timeouts under load) — AC10's assertions stay byte-identical.
- E156's fix, closure, or any edit to its backlog row — only the judgment in AC-E182-3 is recorded.
- E238 / E254 / E278 and any other intermittent test.
- Changing the `reclaimStale` guard-file write (AC-E209-6), lock staleness rules, `CORRUPT_GRACE_MS`, or any test-lock CLI surface.
- Cleaning up a temp file orphaned by a crash between the temp write and the link (harmless leftover next to the lock; no reader looks at it).
- Cross-lane aggregation or dedupe inside `summarize-metrics.mjs` (stays `tw_gate_stats`'s job).
- Every file the manifest e209 row forbids: `tools/**`, `dist/**`, `gates/**`, `guards/**`, `prompts/**`, `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, other `scripts/**`, other `docs/**`, other `.current/**`, other `test/**` (incl. e135's tests, `test/e177b-mailbox-watch.test.mjs`, `test/e177b-lane-status.test.mjs`, `test/teamwork-lite.test.mjs`), other `specs/**`, and the wave-wide common forbidden list (`docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-*.md`, `CHANGELOG.md`, `package.json`, …).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks, queue DONE marks) — integrator / release-engineer.

## Dependencies / Prerequisites

- Lane base `2ad039d` (wave-10 manifest merged into `main`). No cross-lane dependency (manifest `相依` = 無); file sets disjoint from lane e135.
- `dist/tools/lane-paths.js` already exports `resolveCurrentLanePaths` and `resolveFlatLanePaths` (checked at cut time); nothing has to be built or shipped first.
- **PM interpretations recorded for integrator pre-review** (no option choice — each follows from the ticket text or the manifest):
  1. E183 "resolve the lane path (or aggregate like `tw_gate_stats`)": the cut takes the lane-path branch, using the shipped resolver. Aggregation would duplicate `tw_gate_stats`'s dedupe in a script the retro doc already tells readers not to use for cross-lane totals.
  2. E183 "fail loudly when the file is absent" applies to both the default and an explicit path (a mistyped path is the same silent zero). An existing but empty file is not "absent" and keeps exit 0 (AC-E183-6). This re-pins E8-S4.
  3. E183 legacy flat fallback (AC-E183-3) mirrors the flat source `tw_gate_stats` already reads, so a not-yet-migrated workspace is not turned into a false loud failure.
  4. E182's fix choice is qa's (manifest); the PM only suggests values.
- **Dispatch mode: `feature`, not `bugfix`.** E209 and E183 are bugs with a qa repro, but in this repo only qa-engineer may write tests, and bugfix mode makes sr-engineer write and record the failing reproduction test before the fix (`REPRO_MANIFEST_MISSING` on the sr → code-reviewer hop). Same pattern as `specs/e239-init-subdir-exclude.md` and `specs/e243-init-path-escape-refusal.md`: feature mode, qa-owned repro — qa runs AC-E209-1, AC-E183-4 and AC-E183-5 against the base copy, records them red in evidence, then runs them against the fix.
- Routing: pm → sr-engineer (T-E209-01, T-E183-01) → code-reviewer → qa-engineer (T-E209-02, T-E183-02, T-E182-01). No architect: two single-file fixes plus one doc paragraph, no new data model or cross-cutting API. `dispatch_pins`: `pm=opus`, `sr-engineer=opus`.
- Resource Audit: zero external references to fetch — the backlog rows, queue rows and manifest cite only in-repo files, lane names and run counts.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.
- **Test files qa may touch** (for the Cut below): `test/e209-*.test.mjs`, `test/e182-*.test.mjs`, `test/e183-*.test.mjs` (new), `test/e177b-test-lock.test.mjs` (additive only; AC10 assertions unchanged), `test/usage-accounting.test.mjs`, `test/success-metrics.test.mjs` (summarize-metrics assertions only). No other test file.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E209-01 | sr: `acquireLock` writes the payload to a unique same-directory temp file and publishes it with `fs.linkSync`, so the lock is never observable empty; temp file always removed; `EEXIST` path, payload shape, exports and CLI unchanged (AC-E209-2..6) | none | 1 | `scripts/test-lock.mjs` | — |
| T-E183-01 | sr: default path from `dist/tools/lane-paths.js` (current lane, then legacy flat with a stderr note); missing or unreadable file → exit 1 with a clear stderr, default and explicit path alike; header comment and the retro doc's Success-metrics text updated (AC-E183-1..8) | none | 2 | `scripts/summarize-metrics.mjs`, `docs/gate-retro-procedure.md` | — |
| T-E209-02 | qa: deterministic `reclaimStale` interposition repro (red on base copy, green on HEAD), temp-file cleanup and empty-lock grace cases; existing e177b-test-lock cases additive-only, AC10 unchanged (AC-E209-1..5) | T-E209-01 | 1–2 | `test/e209-*.test.mjs`, `test/e177b-test-lock.test.mjs` | — |
| T-E183-02 | qa: lane / primary / flat-fallback / loud-failure cases (red on base where stated), re-pin E8-S4 only (AC-E183-1..7) | T-E183-01 | 2 | `test/e183-*.test.mjs`, `test/success-metrics.test.mjs` | — |
| T-E182-01 | qa-only: `runHook` timeout raised and/or env-overridable, load evidence, `## E156 cause judgment`; then the lane-wide full suite after the final commit (AC-E182-1..3, AC-LANE-1..3) | T-E209-02, T-E183-02 | 1 | `test/usage-accounting.test.mjs`, `test/e182-*.test.mjs` | — |

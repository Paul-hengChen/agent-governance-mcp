# e158-range-subject-audit

Lane `e158`, fan-out wave 12 (`specs/fanout-post-v4-w12.md`). Tickets: E158, E369, E370.

## Problem Statement

Some checks under `scripts/` work out what to inspect from a commit range. When that range is empty, every assertion over it holds trivially, and the check reports success after inspecting nothing (E158). The measured case was a boundary check that read "zero violations" over a lane with 20 uncommitted files and no commits. This spec audits every site under `scripts/` that takes its subject from a commit range, including the `tools/` code behind the thin `scripts/*.mjs` wrappers. For each site it records the honest subject: the range, the working tree, or both. Every site that keeps a range subject must fail loudly when the range is empty. Two smaller items on `scripts/test-lock.mjs` ride along. E369: `acquireLock` spins without sleeping, and ignores `--max-wait`, while a reclaim guard blocks it. E370: two `test/e177b-test-lock.test.mjs` cases go red under full-suite load because of fixed time budgets.

## User Stories

- As an integrator, I want `fanout check` and `fanout owners --range` to refuse an empty range, so that "0 out of bounds" / "0 hits" always means something was inspected.
- As a release-engineer, I want `verify-release.mjs` Check 1 to refuse a commit it cannot judge, so that the bookkeeping tolerance never passes on an empty subject.
- As an integrator, I want `check:bookkeeping` to stop silently swapping a mistyped `--base` for `origin/main`, so that the id-ordering check runs against the base I asked for.
- As a lane running `node scripts/test-lock.mjs -- npm test`, I want a stalled reclaimer to make me wait (with `--max-wait` honoured) instead of burning a CPU core, so that a stuck sibling cannot hang my suite forever.
- As qa on a loaded host, I want AC9 and AC13a of the test-lock suite to judge the product, not node spawn latency, so that a red result means a real defect.

## Audit table (E158)

Criterion for "range-derived": the check's subject comes from `git diff A..B` / `A...B`, `git log` / `rev-list` over a range, `diff-tree` per commit of a range, or `merge-base`. The grep was run over `scripts/` (`rev-list`, `..`, `...`, `diff-tree`, `merge-base`, `git diff`, `git log`) and over the `tools/` modules that thin `scripts/*.mjs` wrappers import. `scripts/mailbox-watch.mjs` runs no git command and is excluded (hard constraint: unchanged).

| # | site (file:function) | current subject | honest subject | empty-subject behaviour today | decision |
|---|---|---|---|---|---|
| 1 | `scripts/verify-release.mjs`: Check 1 `tag-at-HEAD` (range enumeration) | `rev-list <tagSha>..<headSha>` after `tagSha != headSha` and `merge-base --is-ancestor` | range: the claim is about the commits after the tag. Uncommitted work is not part of a tag, and Check 5 already covers `dist/` in the working tree. | Unreachable in theory: both preconditions together imply at least one commit. If it happened anyway, the loop body would never run and the check would print the "tolerated 0 commit(s)" NOTE and pass. | **change**: a zero-commit enumeration FAILs (defensive guard, AC-E158-2) |
| 2 | `scripts/verify-release.mjs`: Check 1 `tag-at-HEAD` (per-commit paths) | `diff-tree -m --no-commit-id --name-only -r <sha>` for each commit in the range | range (per commit) | A commit that lists no path (`git commit --allow-empty`) gives `badPaths = []`, is counted as bookkeeping-only, and lets the check pass with the tolerance NOTE. | **change**: a commit that lists no changed path is an offender, and Check 1 FAILs (AC-E158-1) |
| 3 | `scripts/verify-release.mjs`: `--close-out` `ahead-of-upstream` | `rev-list --count @{u}..HEAD` | range. The claim is "nothing unpushed", so an empty range is the success answer, not an empty subject. Uncommitted bookkeeping is a separate claim (SOP step 13a's non-empty-stage assertion). | 0 means pushed, and the check passes. That answer is correct. | **keep** (not a for-all assertion over the range) |
| 4 | `scripts/verify-release.mjs`: `--ci-check` and Check 6 `CI ground-truth` | a single sha (`rev-parse HEAD`, `--sha`, or `rev-list -n 1 v<version>`) | a single commit | n/a: not a range | **keep**. The `--ci-check` interface and exit codes are unchanged (hard constraint). |
| 5 | `scripts/check-version.mjs`: tag advisory | `rev-list -n 1 <tag>` compared with `rev-parse HEAD` | a single commit. Every other check in the script reads working-tree files. | n/a: not a range, and the result is advisory (a stdout note only) | **keep** / record only |
| 6 | `scripts/check-bookkeeping.mjs`: `resolveBase` with explicit `--base <ref>` | `merge-base HEAD <ref>`. When `<ref>` does not resolve, it silently falls through to `origin/main`, then `main`. | the base the caller named | A typo in `--base` is replaced by a different base without any message. | **change**: an explicit `--base` that does not resolve exits 2 `cannot run` (AC-E158-4) |
| 7 | `scripts/check-bookkeeping.mjs`: `checkIds` with no base resolvable (no `--base`, and neither `origin/main` nor `main` resolves) | id-ordering half skipped | union already: new ids = working-tree `docs/backlog.md` ids minus the ids at the merge-base. Committed and uncommitted rows both count. | One stdout note `id ordering not checked: no base commit found (pass --base <ref>)` and exit 0 (E299 AC4, pinned by `ID-MONO-NO-BASE-NOTE`) | **needs human ruling (R1)**. Option A (recommended): exit 2 `cannot run`, re-pin that one test. Option B: keep the note. |
| 8 | `scripts/check-bookkeeping.mjs`: `checkIds` when the base resolves but has no `docs/backlog.md` | base id set unreadable | base id set is empty, so every id is new | Note `id ordering not checked …`, exit 0 | **keep** (the comparison set is empty, not the subject; this is the legitimate first-introduction case) |
| 9 | `scripts/check-bookkeeping.mjs`: check (4) `listFanoutManifests`; `scripts/check-md-tables.mjs` | `git ls-files` (index), then working-tree content | tracked files only, read from the working tree | An untracked manifest is not checked. Pinned as intended by `DEC-NO-SECTION-OK`. | **keep** / record only: comes from the index, not from a range |
| 10 | `tools/fanout-manifest.ts`: `checkLane` (`scripts/fanout.mjs check`) | `git diff --no-renames --name-only <base>...<branch>` | range. The check answers "what will the merge bring in". It runs from primary against a branch ref, and the lane worktree's uncommitted state is not visible from there. The E158 NOTE line stays. | `0 file(s) changed, 0 out of bounds`, exit 0 | **change**: an empty range is the input error `RANGE_EMPTY`, exit 2 (AC-E158-5) |
| 11 | `tools/fanout-manifest.ts`: `rangePaths` / `runOwners` (`scripts/fanout.mjs owners --range`) | `git diff --no-renames --name-only <a>...<b>` | range | `0 path(s), 0 hit(s)`, exit 0, which the integrator SOP reads as "nothing the merge brings in is lane-owned" | **change**: `RANGE_EMPTY`, exit 2 (AC-E158-6). `--paths` is not range-derived and keeps its behaviour (an empty list still exits 0). |
| 12 | `tools/fanout-manifest.ts`: `checkLane` owned-token existence (E208) | `ls-tree <base>` plus `git diff --diff-filter=A <base>...<branch>` | range (auxiliary warning only) | An empty added-set produces no false warnings, and it can no longer be reached with an empty main range (row 10 fails first) | **keep** |
| 13 | `tools/fanout-handoff.ts` (`scripts/fanout.mjs handoff`) | `rev-list --count` ahead/behind, `sha..target`, and `--not --remotes` | counts where 0 is a meaningful fact, not a for-all check | 0 is printed as a fact | **keep** / record only (file not owned by this lane) |
| 14 | `tools/merge-invariants.ts` (`scripts/merge-invariants.mjs`) | the merge commit's parents and their `merge-base` | specific commits (no range) | `NO_MERGE_BASE` is already exit 3 | **keep** / record only |
| 15 | `tools/join-precondition.ts` (`scripts/join-precondition.mjs`) | `merge-base --is-ancestor <branch> HEAD` | ancestry predicate (no range) | n/a | **keep** / record only |
| 16 | `tools/lane-status.ts`: `log --oneline <base>..<branch>` (`scripts/lane-status.mjs`) | commit list for display. The working-tree dirty count comes from `status --porcelain` in the lane worktree, alongside it. | already shows both (commits and dirty count). No pass/fail verdict is derived from the range. | Shows 0 commits next to the dirty count | **record only**: no change needed and no new finding (file owned by e367 this wave) |
| 17 | `tools/comment-scan.ts`: `resolveBase` / `collectAdded` (`bin/` side) | working tree vs merge-base, plus untracked files | union (already honest when a base resolves) | When no base ref resolves, it falls back to `HEAD`, so committed branch work silently drops out of the advisory scan | **record only → new finding `E158-NEW-1`** in `.current/e158/pending-tickets.md` |

## Acceptance Criteria

### E158

- **AC-E158-1**: Given a fixture repo where tag `v<x>` is an ancestor of HEAD and the commits in `v<x>..HEAD` include one made with `git commit --allow-empty`, when `scripts/verify-release.mjs <x>` runs, then `tag-at-HEAD` FAILs. Its stderr line names that commit's 12-char sha followed by `lists no changed paths`. No `NOTE: tag-at-HEAD — tolerated` line is printed, and the exit code is 1. A range made only of bookkeeping-path commits is still tolerated, with output byte-identical to today.
  proof: `node --test test/e158-*.test.mjs` (case named `AC-E158-1`)
- **AC-E158-2**: Given Check 1 has established `tagSha != headSha` and ancestry, when the `rev-list` enumeration returns zero commits, then Check 1 pushes a FAIL ending `git rev-list enumerated no commits in <tag>..HEAD — refusing to tolerate an empty range`, and the tolerance NOTE does not print. This path cannot be reached from a real repo, so code review checks it by reading the code (no `proof:`).
- **AC-E158-3**: Given the existing release and CI-check suites, when they run, then `--ci-check` (with and without `--sha` / `--strict`) and `--close-out` behave byte-identically: same stdout, same stderr, same exit codes. `test/verify-release.test.mjs`, `test/e320-ci-check-sha.test.mjs` and `test/e326-empty-branch-run-poll.test.mjs` pass unmodified.
  proof: `node --test test/verify-release.test.mjs test/e320-ci-check-sha.test.mjs test/e326-empty-branch-run-poll.test.mjs`
- **AC-E158-4**: Given a fixture repo where `main` resolves, when `check-bookkeeping.mjs --base nope` runs and `nope` does not resolve to a commit, then the script exits 2 with exactly one stderr line `check:bookkeeping — cannot run: --base nope does not resolve to a commit`. It never falls back to `origin/main` or `main`. `--base <resolvable ref>` keeps today's behaviour (`ID-MONO-BASE-FLAG` unchanged).
  proof: `node --test test/e158-*.test.mjs` (case named `AC-E158-4`)
- **AC-E158-4b** (only if ruling R1 = Option A): Given a fixture repo where neither `origin/main` nor `main` resolves and no `--base` is given, when `check-bookkeeping.mjs` runs, then it exits 2 with exactly one stderr line `check:bookkeeping — cannot run: no base commit found for the id-ordering check (tried origin/main, main; pass --base <ref>)`. `ID-MONO-NO-BASE-NOTE` in `test/e299-check-bookkeeping.test.mjs` is re-pinned to this behaviour, and its test name records E158. A base that resolves but has no `docs/backlog.md` keeps today's note (audit row 8). Under Option B this AC is dropped and the test stays unmodified.
  proof: `node --test test/e158-*.test.mjs test/e299-check-bookkeeping.test.mjs`
- **AC-E158-5**: Given a fixture repo where the lane branch has no commit since its merge-base with `--base` (the branch equals base, or its commits net to zero paths), when `node scripts/fanout.mjs check <manifest> <lane> --base main --repo <fixture>` runs, then it exits 2, stdout is empty, and stderr is exactly one `fanout: error: RANGE_EMPTY: …` line (text in Copy `fanout.range-empty.check`). `checkLane` returns `{ ok: false, errors: [{ code: "RANGE_EMPTY", … }] }`. Any non-empty range gives byte-identical output and the same exit code as today.
  proof: `node --test test/e158-*.test.mjs` (case named `AC-E158-5`)
- **AC-E158-6**: Given the same kind of fixture, when `fanout.mjs owners <manifest> --range main...main --repo <fixture>` runs, then it exits 2 with one `fanout: error: RANGE_EMPTY: …` line (Copy `fanout.range-empty.owners`). `owners --paths <empty file>` still exits 0 (`AC-E322-3` unchanged). The `main...main` assertion in `test/e331-git-diff-failure.test.mjs` ("other owners / check exit codes are unchanged") is re-pinned from status 0 to status 2 + `RANGE_EMPTY`. That is the only assertion re-pinned in that file.
  proof: `node --test test/e158-*.test.mjs test/e331-git-diff-failure.test.mjs test/e322-owners.test.mjs`
- **AC-E158-7**: Given the new code `RANGE_EMPTY`, when `test/error-code-contract.test.mjs` runs, then it passes unmodified. The code name avoids the gate-code suffix shape, so it needs no `content/**` prose. `FANOUT_CODES` gains exactly one key.
  proof: `node --test test/error-code-contract.test.mjs`
- **AC-E158-8**: Given the fan-out suites that run `check` / `owners` on non-empty ranges, when they run, then they pass unmodified: `test/e177a-check-cli.test.mjs`, `test/e177a-manifest.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e235b-relative-worktree.test.mjs`, `test/e322-owners.test.mjs`. `dist/tools/fanout-manifest.*` is rebuilt from source and committed with it.
  proof: `node --test test/e177a-check-cli.test.mjs test/e177a-manifest.test.mjs test/e178b-fanout-unmatched.test.mjs test/e235b-relative-worktree.test.mjs test/e322-owners.test.mjs`
- **AC-E158-9**: Given this spec, then the audit table above holds one row per site with all six columns. `.current/e158/pending-tickets.md` holds the `E158-NEW-1` block above `## Applied`, with no `id` field.
  proof: `grep -c '^lane_local_id: E158-NEW-1$' .current/e158/pending-tickets.md` prints `1`

### E369

- **AC-E369-1**: Given a lock file at `L` whose payload names a dead pid, and a reclaim guard `L.reclaim-<sha256(raw)[0:16]>` whose payload names a live pid (the test's own `process.pid`), when `acquireLock({ lockPath: L, maxWaitMs: 300, pollMs: 50, now, log })` runs, then it resolves `{ acquired: false, reason: "timeout" }` well inside the node:test timeout. The injected `now` is called at most `8 + 3 × ceil(300 / 50)` times, which proves there is no busy spin. Today the call never returns.
  proof: `node --test test/e369-*.test.mjs` (case named `AC-E369-1`)
- **AC-E369-2**: The same as AC-E369-1, but the guard holds non-JSON content and has a fresh mtime (a corrupt guard still inside `CORRUPT_GRACE_MS`). Result: the same bounded timeout.
  proof: `node --test test/e369-*.test.mjs` (case named `AC-E369-2`)
- **AC-E369-3**: The same as AC-E369-1, but the guard path is a directory, so it cannot be read. Result: the same bounded timeout.
  proof: `node --test test/e369-*.test.mjs` (case named `AC-E369-3`)
- **AC-E369-4**: Given the AC-E369-1 setup with no `maxWaitMs`, when the guard is removed while the acquirer is waiting, then the acquirer reclaims the dead lock and resolves `{ acquired: true }` within a few polls. While it waits, the `test-lock: reclaiming stale lock from dead pid <pid>` line is logged at most once per distinct observed lock content.
  proof: `node --test test/e369-*.test.mjs` (case named `AC-E369-4`)
- **AC-E369-5**: Given the AC-E369-1 setup, when the CLI `node scripts/test-lock.mjs --max-wait 1 --lock-path L --poll-ms 50 -- <cmd>` runs, then it exits `75` (LOCK_TIMEOUT_EXIT_CODE) without running `<cmd>`.
  proof: `node --test test/e369-*.test.mjs` (case named `AC-E369-5`)
- **AC-E369-6**: `reclaimStale` returns `true` when, on return, the target no longer holds `observedRaw` (this call unlinked it, or it was already gone or changed). Otherwise it returns `false`: guard contention, a recursive guard reclaim, or an unlink error. `acquireLock` retries the publish immediately only on `true`. On `false` it falls through to the existing notify / `--max-wait` / sleep path. The lock and guard publish method (E209 and E362 `linkPublish`), the payloads, the exports, the CLI usage line and the exit codes are unchanged. `test/e209-test-lock-publish.test.mjs` and `test/e362-reclaim-guard-publish.test.mjs` pass unmodified.
  proof: `node --test test/e177b-test-lock.test.mjs test/e209-test-lock-publish.test.mjs test/e362-reclaim-guard-publish.test.mjs`
- **AC-E369-7** (comment discipline, Constitution §6): the two-line `// Published by link, never created empty: …` comment inside `reclaimStale`'s body is gone, and its content is in `reclaimStale`'s doc comment. `publishLock`'s doc comment is exactly one line of at most 80 columns. Code review checks this by reading the file (no `proof:`).

### E370 (qa-only, no source change)

- **AC-E370-1**: AC9 of `test/e177b-test-lock.test.mjs` no longer fails because of a fixed outer wall-clock bound that includes node spawn latency. qa decides the method; the ticket suggests judging the nested short-circuit by the wrapper's own clock. AC9 still fails if the nested run self-deadlocks or queues on its own lock. qa records the method and its rationale under `## E370 decision` in its qa report.
- **AC-E370-2**: AC13a no longer fails on the fixed 20 s node:test timeout under load. Its budget is raised and/or tied to the existing `AGC_E177B_WAIT_MS` knob, and stays finite. The no-overlap, exactly-once and no-leftover-guard assertions are unchanged.
- **AC-E370-3**: Load evidence: at least 3 rounds of 8 concurrent copies of `test/e177b-test-lock.test.mjs` on the lane host, all green. Each round's load average and result goes in the qa report.
- **AC-E370-4**: The only changes to `test/e177b-test-lock.test.mjs` are to the AC9 and AC13a test bodies and options, plus additive helpers. AC10 and AC13b are not re-tuned.
  proof: `git diff <base-sha> -- test/e177b-test-lock.test.mjs`, reviewed by code-reviewer for scope

### Lane-wide

- **AC-LANE-1**: The full suite passes via `node scripts/test-lock.mjs -- npm test` on the final lane HEAD. qa evidence quotes the pass count and contains no local path literal.
- **AC-LANE-2**: `scripts/mailbox-watch.mjs` is byte-identical to the base.
  proof: `git diff --quiet $(cat .current/e158/base-sha) -- scripts/mailbox-watch.mjs; echo "exit=$?"` prints `exit=0`
- **AC-LANE-3**: Every committed path is inside the lane's owned set. The check is run from primary after the lane commits; it now refuses an empty range itself.
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e158 --base main` exits 0
- **AC-LANE-4**: The new tests build their git fixtures in-test. They never diff against a fixed base sha, and never assert content of a real `specs/fanout-*.md` that grows over time.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| vr.offender.no-paths | `<sha12> lists no changed paths (an empty commit cannot be judged bookkeeping-only)` | authored-here: E158 empty per-commit subject; joins the existing `offenders` list format |
| vr.range.empty | `<pointsAtHeadFail> — git rev-list enumerated no commits in <tag>..HEAD — refusing to tolerate an empty range` | authored-here: E158 defensive empty-range guard; prefix reuses the existing `pointsAtHeadFail` text |
| cb.base.unresolved | `check:bookkeeping — cannot run: --base <ref> does not resolve to a commit` | authored-here: E158; the prefix is the existing `cannotRun` format |
| cb.base.none (R1 = A only) | `check:bookkeeping — cannot run: no base commit found for the id-ordering check (tried origin/main, main; pass --base <ref>)` | authored-here: E158; replaces the E299 AC4 note under Option A |
| fanout.range-empty.check | `fanout: error: RANGE_EMPTY: git diff <base>...<branch> lists no committed change in <repo> — nothing was checked; commit the lane's work first (uncommitted and untracked work is never checked) (E158)` | authored-here: E158; the `fanout: error: <CODE>: ` prefix is the existing `formatError` format |
| fanout.range-empty.owners | `fanout: error: RANGE_EMPTY: git diff <a>...<b> lists no committed change in <repo> — an empty range proves nothing about ownership (E158)` | authored-here: E158; same prefix |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E363; E238, E254 and E278 (other flaky tests).
- Any change to `tools/lane-status.ts` or `tools/comment-scan.ts`. The audit found comment-scan's no-base fallback (row 17) and filed it as `E158-NEW-1`.
- `tools/fanout-handoff.ts`, `tools/merge-invariants.ts` and `tools/join-precondition.ts` (record-only rows 13–15).
- `--close-out` reading the working tree (row 3: kept as a range on purpose).
- `owners --paths` with an empty list (not range-derived; `AC-E322-3` unchanged).
- Untracked-file visibility of `check-bookkeeping` check (4) and of `check-md-tables` (row 9: comes from the index, by design).
- Any prose in `content/**`, `docs/**` or `specs/e260c-bin-scripts.md`. The integrator SOP already reads any `owners` / `check` exit 2 as "the condition does not hold", so `RANGE_EMPTY` needs no SOP edit.
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks): release-engineer, after PASS.

## Dependencies / Prerequisites

- Base: `f5485a7` (`.current/e158/base-sha`). No design file; mode is no-design, so Visual Structural Assertions are omitted.
- External refs: none. The tickets are in-repo backlog rows and the manifest is in-repo; the resource-audit grep found no URL or design reference.
- **Ruling R1 (needs human ruling)**: audit row 7 / AC-E158-4b. Option A (recommended) makes "no base resolves" exit 2. This reverses the human-approved E299 AC4 no-base note. In practice the cost is nil: CI checks out with `fetch-depth: 0`, so `origin/main` resolves, and every lane worktree and the primary have `main`. Option B keeps the note and drops AC-E158-4b.
- **Test files qa may touch** (beyond new `test/e158-*.test.mjs` / `test/e369-*.test.mjs` / `test/e370-*.test.mjs`): `test/e331-git-diff-failure.test.mjs` (the one `owners --range main...main` assertion only, AC-E158-6); `test/e299-check-bookkeeping.test.mjs` (`ID-MONO-NO-BASE-NOTE` only, and only under R1 = A); `test/e177b-test-lock.test.mjs` (AC9 / AC13a bodies and options, plus additive helpers, AC-E370-4). Every other test file stays unmodified, including `test/verify-release.test.mjs`, `test/check-version.test.mjs`, `test/e177a-check-cli.test.mjs`, `test/e209-test-lock-publish.test.mjs`, `test/e362-reclaim-guard-publish.test.mjs` and `test/e322-owners.test.mjs`.
- sr-engineer writes no `test/**` (Constitution §2). Full-suite runs always go through `node scripts/test-lock.mjs -- npm test`.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E158-01 | sr: `verify-release.mjs` Check 1 fails loud on a commit that lists no path and on a zero-commit enumeration (AC-E158-1/2, `--ci-check`/`--close-out` untouched AC-E158-3); `check-bookkeeping.mjs` explicit unresolvable `--base` exits 2 (AC-E158-4) and, if R1 = A, no-base exits 2 (AC-E158-4b) | none | 2 | `scripts/verify-release.mjs`, `scripts/check-bookkeeping.mjs` | — |
| T-E158-02 | sr: `FANOUT_CODES.rangeEmpty = "RANGE_EMPTY"`; `checkLane` and `rangePaths` return it on an empty `A...B` diff (exit 2 via `fail`); non-empty output byte-identical; rebuild + commit dist (AC-E158-5..8) | none | 5 | `tools/fanout-manifest.ts`, `dist/tools/fanout-manifest.*` | — |
| T-E369-01 | sr: `reclaimStale` returns boolean; `acquireLock` falls through to notify / max-wait / sleep when it is `false`, reclaim log line at most once per observed content; move the in-body comment into the doc comment; `publishLock` doc one line ≤ 80 cols (AC-E369-1..7) | none | 1 | `scripts/test-lock.mjs` | — |
| T-E158-03 | qa: empty-subject tests with in-test fixtures for AC-E158-1/4/4b/5/6; re-pin the `main...main` assertion in e331 and (R1 = A) `ID-MONO-NO-BASE-NOTE` in e299 | T-E158-01, T-E158-02 | 3 | `test/e158-*.test.mjs`, `test/e331-git-diff-failure.test.mjs`, `test/e299-check-bookkeeping.test.mjs` | — |
| T-E369-02 | qa: deterministic E369 repro (live guard, corrupt-in-grace guard, unreadable guard, guard released, CLI exit 75) with an injected `now` call-count bound (AC-E369-1..5) | T-E369-01 | 1 | `test/e369-*.test.mjs` | — |
| T-E370-01 | qa-only: AC9 / AC13a load budgets with `## E370 decision` rationale and ≥ 3 rounds of 8-way load evidence (AC-E370-1..4); then the lane-wide full suite via test-lock on the final HEAD (AC-LANE-1..4) | T-E369-02, T-E158-03 | 1 | `test/e177b-test-lock.test.mjs` | — |

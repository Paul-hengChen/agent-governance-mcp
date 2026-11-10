# Review — T-E381-03

Round 1 — APPROVED — by code-reviewer (opus). Range `2425e04...7e2700c`. Contract: `specs/e381-fanout-and-ledger-fixes.md` D-E388, AC-E388-1..6. Lane-wide checks are in `review_reports/review_T-E381-01.md`.

## Summary
- `resolveTasksLedgerPath` (`tools/tasks-lane-migrate.ts:394-402`) now checks git-tracking for a feat lane in a linked worktree (lane is not `_primary` and `.git` is a file). On that option-A branch (lane ledger absent and its path ignored), the legacy candidate is the first `taskPaths` entry that exists, is not nested in `.current/<dir>/`, and is not git-tracked (`findUntrackedLegacyTasksFile`, `:371-382`; `isGitTracked`, `:353-364`). With no such entry the lane ledger is used, as E383 already did.
- Primary checkouts and the `_primary` lane still go through `findLegacyTasksFile` unchanged. `tools/config.ts` is not touched.
- The doc comment of `resolveTasksLedgerPath` now describes E388.
- Verdict: APPROVED.

## AC Completeness
AC-E388-1 — implemented — `:397-400`. Probe (real `git init` plus `git worktree add`, `.current/` ignored, tracked `TODO.md`, branch `feat/e996-q`): the row went to `.current/e996/tasks.md`, `TODO.md` stayed byte-identical, `git status --porcelain` was empty, and there was no advisory.
AC-E388-2 — implemented — same probe with a tracked root `tasks.md`, and again with both files tracked: the lane ledger was used both times, the legacy files were unchanged, and status was clean.
AC-E388-3 — implemented — tracked `tasks.md` plus ignored, untracked `TODO.md`: `TODO.md` was the ledger and the advisory named it.
AC-E388-4 — implemented — primary checkout on `main` and on `feat/e995-p`: rows were written to `TODO.md` and the advisory named it (E125a option A unchanged).
AC-E388-5 — implemented — linked worktree on `chore/x` (`_primary` lane): rows were written to `TODO.md`, unchanged.
AC-E388-6 — implemented — `test/e125a-lane-local-ledgers.test.mjs` and `test/e383-lane-ledger-worktree.test.mjs` pass unedited (part of the targeted 188-test run; its only failure is the declared expected-red in `test/e177a-manifest.test.mjs`).

## Correctness
No required findings.
- The forward-migration paths (`ensureTasksMigrated`, `ensureTasksMigratedLocked`) still call `findLegacyTasksFile`, but both return early when the lane path is ignored, which is exactly the case E388 covers. So none of them can write a tracked file through another route. `tasksLaneAdvisory` derives from `resolveTasksLedgerPath`, so it follows the new rule, as D-E388 states.
- Git unavailable: `isLanePathIgnored` already treats any git error as "not ignored", so the function returns the lane ledger before reaching the tracked check. If git works for `check-ignore` but `ls-files` errors or times out, `isGitTracked` returns false and the pre-E388 resolution holds, as specified.
- `path.relative(workspacePath, file)` comes after `--`, so a candidate whose name starts with `-` cannot be read as an option. A candidate outside the repo makes git error, which counts as not tracked and keeps the old behaviour.
- The behaviour on the no-legacy branch is unchanged: a linked feat lane still returns `laneTasksPath`, and every other workspace still returns `resolveTaskPaths(...)[0] ?? laneTasksPath`.

## Quality
- optional — `findUntrackedLegacyTasksFile` copies the `nestedInCurrent` predicate from `findLegacyTasksFile` (`tools/config.ts:489-499`). It is unavoidable while `tools/config.ts` is out of scope. If both ever change, they need to change together.
- optional — `agc check — comments` flags the `resolveTasksLedgerPath` doc block (`:383`, 9 lines against a limit of 7). Kept: the block was already at the limit before this change, and the spec asks for it to gain the E388 sentence. A later trim is fine.
- Comments contain no local paths. Types are strict and nothing is untyped.

## Architecture
No architecture spec. The change sits in the one seam every ledger reader and writer resolves through, which matches D-E388 direction 1. `tools/config.ts` and the index-only `findTasksFile` readers are untouched, as Out of Scope says.

## Security
No findings. Read-only `git ls-files --error-unmatch` runs via `execFileSync` (argv, no shell) with a `--` separator, ignored stdio and a 5 s timeout, matching the existing `isLanePathIgnored` pattern.

## Performance
- optional — `isGitTracked` has no cache; the spec made one optional. In the common AC-E388-1/2 shape this costs one `git ls-files` per existing candidate per resolve, and only until the first write creates the lane ledger; after that the function returns early. In the AC-E388-3 shape, where an untracked legacy file stays the ledger, every `tw_*` task call spawns `ls-files` once for each tracked candidate listed before it. That is a few milliseconds per call, not a regression class. A per-process cache like `ignoredCache` would remove it, but the trade-off is a stale tracked state within one server process.

## Verdict
APPROVED — tracked legacy files are skipped exactly in linked non-`_primary` lane worktrees, every other path keeps its resolution, git failure falls back to the old behaviour, and the E125a and E383 regressions stay green.

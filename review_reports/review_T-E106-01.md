# Review — T-E106-01

covers: T-E106-01, T-E106-02, T-E106-03, T-E106-04, T-E106-05

## Round 1 — APPROVED — by code-reviewer

Reviewer: code-reviewer (opus); builder was sr-engineer (fable). Different model, so the same-model bias concern does not apply.
Range: `git diff ad8e4c9...HEAD` on `feat/e106-init-artifacts-flag` (build commits 6f0e710, aed4d15, c6a41b3, 944ba22, d10717b; spec 6946acb, d16fa6c, 3a777cf).

## Summary
- Config schema goes 1→2 with a v1→v2 migration that only bumps the version (`schema/versions.ts`, `schema/migrations-config.ts`). `loadConfig` now exposes `WorkspaceConfig.artifacts`, accepting only the two valid strings (`tools/config.ts`). The dist output matches a fresh `tsc` compile byte for byte (checked).
- `agc init` gains `--artifacts=local|repo` (`bin/agc-init.mjs`). It adds exclude rules to the shared `info/exclude`, upserts the config key without disturbing other bytes, reports already-tracked paths without acting on them, and follows the AC8 ruling: with the flag omitted on a tree that already tracks artifacts, nothing is declared.
- `agc check` gains `checkArtifactsDrift`. It is advisory only and keys on `ARTIFACT_EXCLUDE_RULES`.
- Docs changed: `docs/config.md`, `docs/install.md`, `docs/schema-versions.md`, `README.md`. Every changed file is in the owned set; no `test/`, `content/`, or other files were touched.
- Verdict: APPROVED. All 16 ACs are implemented and I checked them against real scratch git repos. There are no required findings; one recommended edge case (a subdirectory `cwd`) is not covered by any AC.

## AC Completeness
AC1 — implemented — `bin/agc-init.mjs` runInit mode resolution (`else mode = tracked.length > 0 ? null : "local"`). Scratch run: fresh repo, no flag → exclude rules written, `"artifacts": "local"`.
AC2 — implemented — `parseInitArgs` throws `usageError` before `resolveRepoRootOrNull` and before any write. Scratch run: `--artifacts=bogus` prints `agc init: --artifacts must be "local" or "repo" (got "bogus")` plus usage, `exit=2`, and the directory holds only `.git`.
AC3 — implemented — scratch run: the exclude file gains the 4 rules; the config is `{"schema_version": 2, "host": "claude-code", "artifacts": "local"}`.
AC4 — implemented — scratch run: the md5 of `.git/info/exclude` is unchanged and the config holds `"artifacts": "repo"`.
AC5 — implemented — `upsertArtifactsKey` plus the shared `spliceTopLevelKey`. Scratch run: a 4-space-indented config with a multi-line `driftBaselineIds` gains the key; every other byte is preserved.
AC6 — implemented — `keyValue` is null when the value is already declared and no flag is given, so the result is `has-artifacts` and the file is skipped. Scratch run: md5 identical before and after; the file is listed under "Skipped".
AC7 — implemented — the tracked-tree warning block in runInit. Scratch run (repo path contains a space, a tracked file `qa_reports/r 1.md`): the rules and key are written, the stderr lists `.current/`, `tasks.md`, `qa_reports/`, then prints `git rm -r --cached .current tasks.md qa_reports` and the history note. `git ls-files` afterwards still lists all three, so nothing was executed.
AC8 — implemented — `mode === null` branch. Scratch run: tracked `tasks.md` and no flag → the config has no `artifacts` key, no exclude rules are added, and the "Not defaulting…" line is printed verbatim.
AC9 — implemented — `checkArtifactsDrift` local branch. Scratch run: one line per tracked path, exit 0.
AC10 — implemented — repo branch. Scratch run: local→repo switch leaves the rules in place → one drift line, exit 0.
AC11 — implemented — the repo branch tests only `ARTIFACT_EXCLUDE_RULES` membership. Scratch run: repo mode with `.env`, `/node_modules`, `/.current/**/base-sha` in the exclude file → no drift line.
AC12 — implemented — the undeclared line prints unconditionally, before any git lookup. Scratch run: the exact string, exit 0.
AC13 — implemented — the declared-and-matching case falls through every branch silently (a4 before its lane-rule append, and the AC11 run).
AC14 — implemented — `resolveRepoRootOrNull` returns null. Scratch run under `GIT_CEILING_DIRECTORIES` and `LANG=de_DE.UTF-8`: the key is stamped, the note line is printed verbatim, exit 0.
AC15 — implemented — `schema/migrations-config.ts` v1→v2 `up` spreads the input and sets only `schema_version: 2`. A grep of `tools/` and `schema/` finds no other `artifacts` write on the server read path.
AC16 — implemented — `tools/config.ts` `loadConfigEntry` narrow filter (`=== "local" || === "repo"`); any other value is dropped silently and never throws.

Copy/Strings: all 7 string ids match the spec byte for byte (`init.usage.invalid-artifacts` uses `JSON.stringify(value)` for the `"<value>"` quoting; `check.artifacts-undeclared` is the unescaped form of the table's `\|`).

## Correctness
Focus-area results:
1. **Generalizing `upsertSharedExclude` does not change `agc feature start`.** The read half was extracted into `readSharedExclude` without changing its logic (same common-dir resolution, ENOENT handling, trimmed-line Set). `bootstrapLaneEnv` now passes `LANE_EXCLUDE_RULES` explicitly. `test/agc-feature-*.test.mjs`: 71 pass, 1 fail. The failure is the AC29 comment line-window locator, which is listed in the manifest and is only a test re-pin.
2. **Already-tracked detection.** `git ls-files -z -- <targets>` runs with cwd = toplevel, so each pathspec is anchored to the root (`sub/.current/` does not match). `-z` avoids quoting problems, so a path with a space was detected (checked). The worktree case is handled: `--show-toplevel` gives the worktree's own index, and exclude writes go to `--git-common-dir`. The printed `git rm -r --cached` targets are fixed internal constants (no spaces), so the command can be copied and run from the repo root. It is only ever written to stderr and never passed to exec.
3. **AC14 detection.** `LC_ALL=C` and `LANGUAGE=C` are forced. The function returns null only for a missing git binary (ENOENT) or a numeric exit status whose stderr says "not a git repository". Any other git failure throws, and runInit's top-level catch exits 1 before any write because resolution happens before the first write. In `agc check` the same throw is caught and the check stays silent.
4. **Migration only bumps the version.** Confirmed (AC15). The `agc init` CLI does not bump an existing file's `schema_version` either; it only splices keys. The server's lazy migration does the bump.
5. **The `agc check` repo-mode predicate uses only `ARTIFACT_EXCLUDE_RULES`.** Confirmed (AC11 scratch run).

Findings:
- **recommended — `bin/agc-init.mjs` runInit / `resolveRepoRootOrNull`: running `agc init` with `cwd` in a subdirectory of the repo** (not the toplevel) writes root-anchored rules (`/.current/`, …) that do not cover the files it just created under `sub/`. It still stamps `"local"` and prints "added … to the shared info/exclude". Scratch run: `git status` then shows `?? sub/.current/.config.json` and `?? sub/tasks.md`, which is the accidental-commit path this feature exists to close. Tracked-path detection and `agc check` also look at the root, not `cwd`. No AC covers this case (every AC fixture runs `agc init` at the repo root), so it does not block. Suggested follow-up: anchor the rules to the `cwd`-relative prefix, or detect `cwd !== toplevel` and print a warning or refuse.
- **optional — runInit, local branch:** re-running with no flag in an already-declared `local` workspace that has tracked artifacts prints "the exclude rule just added has no effect", even though nothing was just added. The text follows the spec verbatim, so this is cosmetic only.
- **optional — runInit:** when `.current/.config.json` is malformed JSON and the mode is `local`, the exclude rules are still written while the key is reported as not updated. This is harmless (the rules are what the user asked for) but the two halves become inconsistent.
- **optional — runInit summary:** in the AC8 case where every scaffold file already exists, "All files already exist — nothing to do." goes to stdout next to the stderr request to choose a mode. The streams differ, but a reader may find the pair contradictory.
- **optional — AC14 note:** re-running outside git in an already-declared `local` workspace prints "recorded \"artifacts\": \"local\"" again, although nothing new was recorded.

Expected-red sampling (step 4a): I sampled `test/drift-baseline.test.mjs | AC-6: CURRENT_VERSIONS.config stays 1…`, `test/agc-adapters.test.mjs | E100: falsy host values…`, `test/schema-versions.test.mjs | runMigrations composes a multi-step chain v0→v2`, and `test/agc-feature-lifecycle.test.mjs | AC29…`. All are real tests I could locate. I also found that the 2 `test/check-md-tables.test.mjs` entries are **stale**: that file now passes 49/49 after 3a777cf. The manifest calls them "pre-existing", but the cause was the spec's unescaped pipe in this lane. QA (T-E106-06) should drop them from the disposition rather than accept them as expected reds (recommended, qa-owned).

## Quality
No required findings. `spliceTopLevelKey` removes duplication between `upsertHostKey` and the new `upsertArtifactsKey` instead of copying the splice; the reparse-guard comments were carried over correctly. The new comments explain reasons (why history cannot be rewritten, why `agc check` reads the raw file instead of the heal-writing `loadConfig`, why locale is pinned) and cite no ticket ids or governance paths. Pre-existing `E1xx` references in the header comment are unchanged. Naming (`ARTIFACT_EXCLUDE_RULES`, `ARTIFACT_PATHS`, `trackedArtifactPaths`) matches the surrounding `LANE_EXCLUDE_RULES` conventions.

## Architecture
There is no architecture spec (the spec explicitly skips the architect hop). The implementation reuses both mechanisms the spec names (`upsertSharedExclude` generalized, and a byte-preserving splice in the style of `upsertHostKey`). It shares one tracked-path helper between the AC7 warning, the AC8 refusal, and the `agc check` drift test, as A1 requires. The server side is limited to the config loader and the migration registry; nothing in the handoff or gate layers is touched.

## Security
No findings. The printed `git rm` line is built from internal constants and never executed. `new RegExp` interpolates only the internal literals `host`/`artifacts`. Git is always invoked through `execFileSync` with an argv array (no shell). `--artifacts` input is validated against a two-value allow-list before use, and the invalid value is echoed through `JSON.stringify`.

## Performance
No findings. `agc init` and `agc check` each add one `git rev-parse` and one `git ls-files` call. The `ls-files` output (every file under the four pathspecs) is scanned once per artifact path, O(4·n), on a cold CLI path. No hot path in the server changes; the one filter added to `loadConfigEntry` costs O(1).

## Verdict
APPROVED — all 16 ACs are implemented and verified by hand in scratch repos, the five focus areas check out, and nothing is required; the subdirectory-`cwd` gap is recommended as a follow-up.

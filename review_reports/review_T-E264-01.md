# Review — T-E264-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Comment-only rewording at the four integrator-scoped sites: `tools/lane-paths.ts` header (names the three fs helpers), `tools/merge-invariants.ts` R-2 comment (function names replace stale `tasks-file.ts:216/703`), `tools/telemetry.ts` header (per-lane `.current/<lane>/usage.jsonl`), `tools/lane-migrate.ts` `migrateFlatToLane` wrapper doc (drops `readHandoffState` as example caller, names `migrateOwnWorkspaceIfFlat`).
- Scope was judged on `git diff main...HEAD` (merge-base f53ea13), which has 20 paths: the 4 `tools/*.ts`, 11 `dist/tools/**` outputs of those 4, `specs/e264-tools-comment-accuracy.md`, and `.current/e264/{check-invariance.mjs,dispatch.jsonl,handoff.md,tasks.md}`. Merge 90e2cbe (E275) is not part of this ticket's diff.
- Every changed `tools/` line is a comment line. `git diff -U0 f1e6eb1 HEAD -- tools`, filtered for `+`/`-` lines that are not `//`, ` *` or `/**`, matched nothing.
- The `hasFlatLaneFiles` doc is byte-unchanged: the sha1 of its doc block is `ddd721b…` at both f1e6eb1 and HEAD.
- Verdict: APPROVED. The four comments match the code they describe. There are no required findings, and two recommended notes cover gaps in the proof script and in the AC7 proof wording.

## AC Completeness
AC1 — implemented — tools/lane-paths.ts:6-7. `grep -n "resolveCurrentLane too"` gives exit=1.
AC2 — implemented — tools/merge-invariants.ts:158-160. `grep -nE "tasks-file\.ts:[0-9]"` gives exit=1.
AC3 — implemented — tools/telemetry.ts:6. `grep -n "current/usage.jsonl"` gives exit=1.
AC4 — implemented — tools/lane-migrate.ts:330-337. The wrapper-doc sed/grep count is `0`. Per-file counts of `migrateFlatToLaneLocked` (5), `migrateFlatToLane(` (2) and `migrateLaneToFlat(` (2) are the same at base and HEAD. The `hasFlatLaneFiles` doc is byte-unchanged.
AC5 — implemented — `node .current/e264/check-invariance.mjs f1e6eb1` prints `invariance OK: 4 files`, rc=0, and no `PIN` line.
AC6 — implemented — `--self-test` prints `self-test OK`, rc=0. A vacuous run (tools reset to base, on a copy) prints `no changed tools/ files (vacuous pass refused)`, rc=2. See the recommended note under Correctness about type-only edits.
AC7 — implemented — on a scratch clone, `npx tsc` gave rc=0 and left `git status --porcelain dist` empty, so the committed dist matches a fresh build. The `main...HEAD` dist paths are only the `.js`/`.d.ts`/`.map` of the four files. `lane-paths.d.ts` and the `merge-invariants`/`telemetry` `.d.ts` are unchanged as expected, because those comments are not emitted into or shifted in the declarations. See the recommended note on the proof command.
AC8 — out of scope for this review (qa).
AC9 — out of scope for this review (qa). A spot check of `specs/e264-*.md` and `.current/e264` with the AC9 grep gave exit=1. This report contains no local-path literals.

## Correctness
I checked each comment's claims against the code:
- **lane-paths (AC1)**: the exported functions that touch `fs` are exactly `hasHistoryLedger` (tools/lane-paths.ts:184, `fs.statSync` plus `listDirNames`), `resolveCurrentLane` (:259, `fs.readFileSync` plus private `headFilePath` :239), and `enumerateLaneSidecarSources` (:388, via private `listDirNames` :358 and `readFileBytes` :371). All three only read; none writes or creates directories. The comment is accurate. `optional`: `resolveCurrentLanePaths` (:280) also reaches fs, transitively through `resolveCurrentLane`. The "three" count describes direct fs users, which is a reasonable reading.
- **merge-invariants (AC2)**: `parseTasks` (tools/tasks-file.ts:202-203) does `line.trim()` and then `parseTaskLine(trimmedLine, …, regex)`. `addTaskInFile` (:663) does `line.trim().match(regex)`. Both claims hold. `optional`: `voidTaskInFile` (:573) applies the same trim-then-parse in its post-write invariant. The comment does not claim the list is complete, and these are the two sites the stale line numbers originally pointed at, so it is fine as written.
- **telemetry (AC3)**: `appendUsageRecord` writes to `resolveCurrentLanePaths(ws).usagePath` (tools/usage-accounting.ts:49), which is `.current/<lane>/usage.jsonl`. The flat `usagePath()` (:40) is documented as legacy read-only. The new wording is accurate.
- **lane-migrate (AC4)**: `readHandoffState` reaches `migrateOwnWorkspaceIfFlat` (tools/handoff-parse.ts:151). That function calls `migrateFlatToLaneLocked` directly (:170) and never calls the async `migrateFlatToLane`, which has no caller outside `tools/lane-migrate.ts`. "Lock-free core" is the core's own doc phrasing (tools/lane-migrate.ts:275), so the wording is accurate. `optional`: `migrateOwnWorkspaceIfFlat` takes the lane lock itself, non-blockingly, before calling the core (handoff-parse.ts:159-170). A reader could take "calls the lock-free core directly" to mean no lock is held. Adding "under its own non-blocking lane lock" would remove that ambiguity, but it is not needed for accuracy, and the integrator's scope argues against more text.

Adversarial negative controls on `.current/e264/check-invariance.mjs`. Each ran on a scratch `git clone` outside the worktree and was reset with `git checkout -- . && git clean` after it. No `git stash` was used.

| # | mutation | result |
|---|---|---|
| N1 | code edit: `export const __probe = 1;` added to tools/telemetry.ts | `DIFF tools/telemetry.ts`, rc=1 — caught |
| N2 | type-only edit: `hasFlatLaneFiles(workspacePath: string \| number)` in tools/lane-migrate.ts | `invariance OK`, rc=0 — **not caught** |
| N3 | token-count change: `resolveLanePaths` appended to a comment in tools/lane-paths.ts | `PIN tools/lane-paths.ts resolveLanePaths`, rc=1 — caught |
| N4 | pinned token added to out-of-scope tools/sync.ts | `SCOPE` + `PIN tools/sync.ts resolveCurrentLane`, rc=1 — caught |
| N5 | comment-only edit to out-of-scope tools/drift.ts | `SCOPE tools/drift.ts`, rc=1 — caught |
| N6 | new untracked tools/zz-probe.ts | `SCOPE tools/zz-probe.ts`, rc=1 — caught |
| N7 | owned tools/telemetry.ts deleted | `DELETED` + `PIN` lines, rc=1 — caught |
| N8 | code edit outside tools/ (a gates/*.ts file) | `invariance OK`, rc=0 — not caught (by design, see below) |
| N9 | tools/ reset to base (vacuous) | `vacuous pass refused`, rc=2 — caught |
| N10 | `migrateFlatToLane(` added to a tools/lane-paths.ts comment | `PIN tools/lane-paths.ts migrateFlatToLane(`, rc=1 — caught |

- `recommended` (N2): `ts.transpileModule` erases types, so a type-only edit (an annotation, an `interface` or `type` alias, an `as` cast) passes AC6 as "comment-only". The script follows AC6 exactly as written, so this is not an AC miss. In this diff the gap is covered by the comment-line filter above (zero non-comment changed lines) and by the `.d.ts` diffs being comment-only. When this script is reused for a later ticket, add a check that every `+`/`-` line in `git diff -U0 <base> -- tools` is a comment line, or compare `.d.ts` emit, so type edits are caught too.
- `recommended` (N8 / AC7 proof): the script only covers `tools/`. Out-of-scope files elsewhere fall to AC7's `git diff --name-only`. Since merge 90e2cbe, AC7's literal proof `git diff --name-only f1e6eb1 HEAD` lists 15 more paths, exactly the 15 that `f1e6eb1..main` brought in (E275 history, docs, package.json/lock, `tasks.md`, other review reports). The integrator-sanctioned equivalent is `git diff --name-only main...HEAD`, which lists only owned paths. qa should run AC7 against `main...HEAD` (or the merge-base) and note the substitution, not read the literal command as failing.

## Quality
No findings. The new comments name real symbols and paths, contain no line numbers, keep the files' existing comment style, and stay within the original line budget (+1 line in lane-paths, +1 in lane-migrate). Comment check (SOP 4b): `node bin/agc-init.mjs check`, run on the scratch clone, reported no `agc check — comments` warnings touching the diff.

## Architecture
No architecture spec exists for this feature. No code or layering changed. The proof script is lane-scoped (`.current/e264/`) and adapted from the e260b precedent, as the spec says.

## Security
No findings. The change is comments only. The proof script runs `git` through `execFileSync` with array args (no shell), and its base argument is checked with `rev-parse --verify`.

## Performance
No findings. The emitted JS is unchanged apart from comments, so there is no runtime effect.

## Verdict
APPROVED. All four comments match the code they describe, the edits are comment-only and limited to the integrator-decided sites with `hasFlatLaneFiles` byte-unchanged, dist matches a fresh build, and the only findings are non-blocking notes about the proof script's type-erasure blind spot and running the AC7 proof against `main...HEAD`.

# Review — T-E123A3-07 (e123a-lane-layout-migration, T-E123A3-01..06)

covers: T-E123A3-01, T-E123A3-02, T-E123A3-03, T-E123A3-04, T-E123A3-05, T-E123A3-06, T-E123A3-07

## Round 1 — APPROVED — by code-reviewer

Scope: `git diff dea8544..HEAD`, which is 0413c28 (T-01..03) plus f00bcc8 (T-04..06). I checked it against `specs/e123a-lane-layout-migration.md` AC1-AC15 and the spec's Out of Scope section. No architecture spec exists (mini-chain, no architect). The `.current/feature-split.md` Decisions are treated as settled.

I re-derived every claim below myself. I ran `tsc --noEmit`, `npm run build` (the rebuild left `dist/` byte-identical to the committed tree), the full `npm test`, all the spec greps, and my own `$TMPDIR` smoke scripts against `dist/`, calling the real `tw_update_state` registry `run` (zod boundary, then handler).

## Summary
- **Batch 1**: the handoff schema goes v14 to v15 with a stamp-only migration. It adds two transient per-hop fields, `dispatch_mechanism` (a closed zod enum) and `dispatch_mechanism_tier` (free text up to 40 chars). They are threaded through parse, write, the registry, and the orchestrator. New `tools/lane-paths.ts` holds the `LANE_FILES` registry (5 entries: 1 required, 4 optional), the migration-time `resolveLaneName`, and a zero-behaviour `resolveLanePaths` stub.
- **Batch 2**: new `tools/dispatch-log.ts`, a best-effort `.current/dispatch.jsonl` append, wired into the orchestrator after a successful write. New unwired `tools/lane-migrate.ts`, the flat-to-lane and lane-to-flat runners. `.gitignore` gains `.current/archive/`, and the e142 snapshot is untracked with `git rm --cached`.
- **Scope**: no gate, `GateErrorCode`, or `tw_*` tool was added. No `content/`, `test/`, `gates/`, or `index.ts` changes. No `_primary` fallback. No `.current/history/` mover. `tasks.md` and `specs/` are not in `LANE_FILES`.
- **Test suite**: 2185/2234. The 49 failures match `qa_reports/expected-red_e123a-lane-layout-migration.txt` exactly (set diff of the failing test names against the manifest is empty).
- **Verdict**: APPROVED. Four non-blocking notes, plus one F1-input ticket filed as `NEW-TICKETS.md` L-SCHEMA-NEW-7.

## Correctness

AC-by-AC re-derivation:

- **AC1 (migration is stamp-only)**: `schema/versions.ts` sets `handoff: 15`. `schema/migrations-handoff.ts` registers the 14 to 15 step as `{...input, schema_version: 15}` and seeds nothing, next to the existing 13 to 14 step. In the smoke run, a v14 fixture read through `parseHandoff` migrated in memory without error. Neither new key is present unless it was written.
- **AC2 (transience)**: I ran the two-write sequence myself. Write A (`task` / `fable`) put `dispatch_mechanism: "task"` and `dispatch_mechanism_tier: "fable"` in the frontmatter. Write B, same feature with both fields omitted, left both keys absent. `tools/handoff-write.ts` emits each field only when this write supplied it, and there is no preserve read from existing state. A tier-only write persists the tier and appends no sidecar line, which matches AC13's trigger ("carries `dispatch_mechanism`").
- **AC3 (zod rejects bad values)**: `run({... dispatch_mechanism: "bogus"})` throws `ZodError`, and a 41-char tier throws `ZodError`. The parse-time `DISPATCH_MECHANISM_VALUES` drops out-of-enum values and never rejects, which matches the `dispatch_mode` precedent.
- **AC4 (`resolveLaneName`)**: `e163-ci-gate-ordering` gives `e163`. `e123a-lane-layout-migration` gives `e123a`. `lane-layout-migration`, `""`, `undefined`, `_primary`, `e1_x`, and `x1y2-z` all give `_legacy`. `E99` gives `e99`. `_primary` is never returned. The captured set is `[a-z0-9]` only, so the result is always a safe single path segment.
- **AC5 (stub paths, no callers)**: `resolveLanePaths` returns output that is `JSON.stringify`-identical for `e163`, `_legacy`, and `../garbage`. It has 5 keys, which equals `LANE_FILES.length`, and it is built by iterating `LANE_FILES` through a key-to-field map that holds keys only. `grep -rn resolveLanePaths tools/ gates/ guards/ prompts/ bin/ index.ts` finds only `tools/lane-paths.ts`, so there are zero production callers.
  - I confirmed sr's claim that AC5's literal proof grep can never pass. AC5's own text requires `dispatch-log.ts` to import from `lane-paths.ts`, and AC15/T-05 require `lane-migrate.ts` to derive from `LANE_FILES`. So `grep -rln "lane-paths"` always lists 3 files. The intent, that `resolveLanePaths` has no callers, holds. L-SCHEMA-NEW-6 is filed correctly, and it is a spec-proof defect, not an implementation defect.
- **AC6 (flat to lane)**: the full 5-file fixture gave `{lane:"e163", moved:[all 5], skipped:[]}`. `.config.json`, `exemptions.json`, `feature-split.md`, and `tasks.md` were untouched. The candidate set iterates `LANE_FILES`. Files are moved with `fs.renameSync` while holding `withFileLock` on `.current/.handoff.lock`, which is the same lock `writeHandoffState` takes (`tools/handoff-write.ts:259`). The lane name is read with `parseHandoff`, which is pure: it migrates in memory and never writes back (`tools/handoff-parse.ts:399`). The heal-write lives only in `readHandoffState`.
- **AC7 (conflict)**: I seeded a differing flat `handoff.md` while `.current/e163/handoff.md` already existed. The run threw, and both files were byte-unchanged. The reverse direction also refuses on a differing flat destination. All checks run in `planMoves` before the first move.
- **AC8 (lane to flat)**: all 5 files returned to flat, and `.current/e163/` was removed with a non-recursive `rmdirSync`.
- **AC9 (round trip)**: the flat-to-lane-to-flat snapshot of every regular file in `.current/` was byte-identical, including the v14 `schema_version` line, because no heal read occurs.
- **AC10 (unwired)**: `migrateFlatToLane` and `migrateLaneToFlat` appear only in `tools/lane-migrate.ts` and its `dist/` emit.
- **AC11 (E157)**: `git ls-files .current/archive/` is empty. `ls .current/archive/` still shows the e142 file. `git check-ignore` matches `.gitignore:19`. The only `.current/` change in the diff is that one index removal.
- **AC12 (test re-baseline)**: this is qa-owned. The 49 reds are exactly the manifest. Per step 4a I sampled 3 manifest entries (lines 1, 20, and 49), and each is a real, locatable test string in its named file. I confirmed the 2 L-SCHEMA-NEW-5 reds: the spec's Visual Tokens `N/A` row has 3 cells under a 4-column header.
- **AC13 (sidecar append)**: an accepted write carrying `dispatch_mechanism` appends exactly 1 line with the right shape. An omitting write appends 0. A write rejected by the pipeline (PASS from a disallowed transition), even with `dispatch_mechanism: "inline"` set, appends 0 because the append sits after `storage.writeState`. When I forced an append failure by making `.current/dispatch.jsonl` a directory, the tool still returned the normal `{"success":true,...}` ToolResult. Calling `appendDispatchRecord` directly with an invalid path did not throw.
- **AC14 (stream separation)**: after the sidecar appends, neither `metrics.jsonl` nor `telemetry.jsonl` was created in the fixture. `dispatch-log.ts` writes only `dispatchLogPath()`.
- **AC15 (one owner for filenames)**: the qa-checkable grep over the three files hits only `tools/lane-paths.ts:32-36` (the `LANE_FILES` literal). `dispatch-log.ts` takes its filename from `laneFile("dispatch")`. Both runners iterate `LANE_FILES`, and moved plus skipped equals 5 on the full fixture.

Judgments on the choices sr flagged:
1. **The runners are async**: acceptable, and required. `withFileLock` is `async` (`guards/file-lock.ts:55`), so a sync return would mean either not taking the lock, which violates AC6, or a hand-rolled blocking lock. The task text's `{lane, moved, skipped}` describes the result shape, not the sync/async choice.
2. **An identical-content destination counts as a resumed move and the source is deleted**: acceptable. Only `unlinkSync` removes the source, and only after a byte-for-byte `Buffer.equals` check, so no data can be lost. AC7 constrains only *differing* content, and throwing on identical content would leave an interrupted run stuck until someone fixed it by hand.
3. **`migrateLaneToFlat` refuses a lane dir that holds non-`LANE_FILES` entries**: acceptable. It is the safer reading of AC8's "now-empty directory is removed": it never deletes unknown content, and it refuses before touching anything. Its F1 consequence (tmp and lock residue) is recorded in L-SCHEMA-NEW-7.
4. **`.handoff.lock` is duplicated**: this is a non-blocking Quality note, below. The existing literal in `handoff-write.ts:259` is inline and not exported, so there was no constant to import without editing that writer beyond the task's file list.

Non-blocking notes:
- **N1** `tools/lane-migrate.ts` `executeMoves`: `renameSync` silently overwrites on POSIX if a destination appears between `planMoves` and the move. The lock covers handoff writers but not the lock-free sidecar appenders. This cannot happen while the runners are unwired, and F1 owns the concurrency story when it wires them.
- **N2** `tools/registry.ts` `dispatch_mechanism_tier: z.string().max(40)` accepts `""`. The handoff drops it (truthy check), but the sidecar records `"dispatch_mechanism_tier": ""` (`?? null` does not collapse an empty string). This is cosmetic, and adding `.min(1)` would align them.

## Quality
- **Q1 (nit)**: `tools/lane-migrate.ts` `HANDOFF_LOCK_BASENAME` repeats `.handoff.lock` from `tools/handoff-write.ts:259`. Serialization silently depends on the two staying equal. Routed to F1 as L-SCHEMA-NEW-7 symptom 2: export one `handoffLockPath()` helper.
- **Q2 (nit)**: `migrateFlatToLane` checks the required entry, then `planMoves` checks it again. The comment explains why (a clear error before the parse), so this is acceptable.
- Comments are thorough and match the file-header convention. Naming follows the neighbouring v7/v8/v11 field threads. Nothing is dead code: `void lane` is intentional and documented.

## Architecture
- There is no architecture spec. Layering is sound. `lane-paths.ts` is pure (only `path`). `lane-migrate.ts` depends only on `guards/file-lock`, `handoff-parse`, and `lane-paths`. `dispatch-log.ts` mirrors `emitGateTelemetry`.
- Out of Scope was respected. Nothing is wired, and there is no `.current/history/` move, no `_primary` fallback, no branch resolution, no new gate or tool, and no `content/` SOP change.
- Advisory: the sidecar append is not gated on `FileHandoffStorage`, so it also fires in SQLite/HTTP mode, where the handoff fields themselves are ignored. The spec does not restrict the sidecar to file mode, and in that mode the sidecar is the only record of the fields. I am noting it, not requesting a change.
- F1 input (L-SCHEMA-NEW-7 symptom 1): `writeHandoffState` resolves `handoffPath` before it takes the lock, so a writer queued behind a migration would recreate a flat `handoff.md`. This is harmless in F0 because nothing is wired, but F1 must re-resolve the path under the lock.

## Security
- `migrateLaneToFlat` validates the caller-supplied `lane` with `/^[A-Za-z0-9_][A-Za-z0-9_-]*$/`. I confirmed it refuses `../x`, `..`, `""`, `a/b`, and `.hidden`. `resolveLaneName` output is `[a-z0-9]`-only by construction and is re-checked with `assertSafeLane`.
- `dispatch_mechanism` is a closed enum at the boundary, and the tier is length-bounded. The sidecar writes with `JSON.stringify`, so there is no injection. No secrets were introduced.
- The reverse runner never deletes unknown content: it refuses on any foreign entry and removes the directory non-recursively.

## Performance
- The sidecar costs one `appendFileSync` per accepted write, and only when the field is present. It is not in a hot loop.
- The runners do O(5) stats and reads, with buffer compares only when a destination already exists. The `laneFile()` linear find runs over 5 entries.
- There is no regression against base, and the suite duration is in line with normal runs (~127s).

## Verdict
APPROVED. Every AC in scope (AC1-AC11, AC13-AC15) holds when re-derived by execution. AC12's 49 reds are exactly the manifested qa-owned re-baselines and the pre-existing L-SCHEMA-NEW-5 spec defect. AC5's literal grep is a real spec-proof defect (L-SCHEMA-NEW-6), and the intended claim holds. The remaining notes are non-blocking or F1 inputs (L-SCHEMA-NEW-7).

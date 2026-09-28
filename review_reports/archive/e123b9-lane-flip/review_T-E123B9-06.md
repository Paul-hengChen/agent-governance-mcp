# Review — T-E123B9-06 (review task T-E123B9-07)

covers: T-E123B9-06

## Summary
- Scope: this review covers only the uncommitted amendment diff `git diff 7dc9d0d -- tools/`: `tools/lane-migrate.ts`, `tools/handoff-parse.ts` and `tools/handoff-write.ts`, about +82/−36. It is judged against `specs/e123b9-lane-flip.md` "## Amendment 2026-09-24" (AC16–AC20) and the still-binding AC12–AC15 and AC13. Code that T-E123B9-01..03 already approved (review_T-E123B9-01.md) and that this diff does not touch was not re-reviewed.
- What changed:
  - A new trigger predicate `hasFlatLaneFiles`, used at both own-workspace sites.
  - `planMoves` now moves the sidecars first and `handoff.md` last.
  - The core sweeps leftover flat sidecars instead of returning `alreadyMigrated` early.
  - A new `allowMissingRequired` option, passed only by the two triggers.
  - `readAndMigrate` treats ENOTDIR the same as ENOENT.
- Independent verification:
  - I recompiled `tsc` into the scratchpad. It is byte-identical to the committed `dist/` for all three files.
  - `npm test` gives 2371/2371, exit 0.
  - I wrote my own dist-only harness (`scratchpad/cr7/v.mjs` plus `child.mjs`). It gives **1428/1428**, and it includes real process-death crashes: `process.exit(137)` after the k-th `renameSync`, `unlinkSync` or `writeFileSync`, with no unwinding, so the locks stay stale.
- Verdict: **APPROVED**. I have one `recommended` finding, which does not block.

## AC Completeness
- AC16 — implemented.
  - `tools/lane-migrate.ts` `hasFlatLaneFiles` (it iterates LANE_FILES, uses `isFile`, and stops at the first hit).
  - It is used at `tools/handoff-parse.ts` `migrateOwnWorkspaceIfFlat` (after `assertNoHandoffLayoutConflict`) and at `tools/handoff-write.ts` `writeHandoffStateCore`, inside the lock and after the AC14 assert.
  - A workspace with no flat file returns before any lane resolution, mkdir or lock. Verified: a fully migrated workspace leaves the lane dir listing unchanged.
- AC17 — implemented. `planMoves` builds `sidecarsFirst`, so the required entry comes last. Verified: `moved` ends with `handoff.md`. After a real crash on the first rename, `handoff.md` is still flat.
- AC18 — implemented. The core has `alreadyInLane && plan.length === 0` as its only `alreadyMigrated` return, and otherwise sweeps through `planMoves(..., requiredMayBeAbsent)`. Verified on fresh copies, via read and via write each time, for these layouts:
  - new order with k = 0..4 sidecars already renamed;
  - four merge crash stages (pre-merge, tmp written, renamed but not unlinked, merge done);
  - legacy order with k = 1..4 flat sidecars left, with and without a lane copy to merge into;
  - the legacy renamed-but-not-unlinked remnant.

  In every case no flat file is left, the line sets match exactly with no duplicates, the state is deep-equal after a read, and there is no HANDOFF_LAYOUT_CONFLICT.
- AC19 — implemented. The flag is on `FlatToLaneOptions`, the core skips the throw when it is set, and `planMoves` skips the absent required entry. Verified:
  - A read of a sidecar-only workspace returns `exists:false`, the sidecars move, and nothing throws. This holds both with and without an existing lane dir.
  - A write also succeeds on that layout.
- AC20 — implemented. `tools/handoff-parse.ts`, in `readAndMigrate`'s catch. Verified:
  - `readHandoffState(<file>/sub)` returns the same `{exists:false, message}` as a nonexistent path.
  - `parseHandoff` returns `null`.
  - The ENOENT path creates nothing.
- AC12 (binding) — implemented, and unchanged in shape.
  - The write path holds `withFileLock` and calls the lock-free core.
  - The read path makes one non-blocking `openSync("wx")` and then calls the core.
  - The wrapper takes the lock once and calls the core.
  - No stack takes the same lock twice.
- AC13 (binding) — implemented. `readAndMigrate` and `parseHandoff` gained no move, lock or mkdir. Verified: `parseHandoff` on a flat workspace with a flat sidecar, and on a legacy partial workspace, creates no lane dir and moves nothing.
- AC14 (binding) — implemented. Both sites assert before the trigger. Verified: flat `handoff.md` + lane `handoff.md` + a flat `usage.jsonl` makes both the read and the write throw `HANDOFF_LAYOUT_CONFLICT`, and the sidecar is not moved.
- AC15 (binding) — implemented. The drop/merge rule is unchanged and verified through the crash-stage matrix. That includes the `startsWith` drop, which keeps the "renamed but not unlinked" stage from duplicating lines.

## Correctness
Crash at every step (question 1). I simulated the intermediate layouts by hand, and I also caused real process deaths after the 1st through 9th `renameSync`, `unlinkSync` and `writeFileSync` inside `.current/`, during a read and during a write, on a fixture that mixes rename and merge sidecars. After every death, the next read returned state without error, and the next write completed the migration: every file sat at its lane path, no flat file was left, there were no duplicate or lost lines, and there was no conflict. Rename is atomic, so `handoff.md` never exists at both paths, and AC14 cannot fire spuriously. Under the legacy order, the lane `handoff.md` together with the flat sidecars is swept correctly.

- **[recommended] A real crash is resumed by the next write, not by the next read.**
  - Where: `tools/handoff-parse.ts`, the `EEXIST → return` inside `migrateOwnWorkspaceIfFlat`.
  - What happens: a process that dies while migrating leaves its lane `.handoff.lock` behind with a dead PID. The read path's non-blocking try gets EEXIST and does not check whether the lock is stale, so it skips the migration. I reproduced this in `scratchpad/cr7/probe.mjs`: after a crash on rename #1, the read returns correct state (`f-gold`), but the layout stays split. Only the next `withFileLock` writer, whose `looksStale` clears the dead-PID lock, finishes the migration.
  - Why it does not block: this is the AC12 busy-lock design, which the approved round-1 code and its comment document ("a crashed holder, which the next writer's withFileLock clears"). AC18 says "read **or** write", and the read never returns wrong state.
  - Side effect: until the next write, lane-only sidecar readers (for example the telemetry and metrics aggregation) see only the part of the data that has already moved.
  - Suggested fix: export `looksStale` from `guards/file-lock.ts` and let the read path clear a dead-PID lock before it gives up. That makes the next read also finish the migration.
- Freshness with a busy lock (question 3): OK. When the lane handoff is absent, the fallback snapshots the flat file's mtime. The writer's rename keeps that mtime, so `verifyFreshness` on the lane path passes. Verified: a read with a busy lock, then a write, migrates cleanly in both the new-order and legacy layouts.
- J2-NEW-11 (a leftover `.tmp` after a crash): confirmed. A death between the tmp write and the rename leaves `<sidecar>.<pid>.<ms>.tmp` in the lane dir. The same applies to `handoff.md.*.tmp` from the writer, which is older behaviour. The flat→lane path does not check lane-dir purity, so it never fails because of them, and lane→flat already tolerates them (`isStaleAtomicTmp`). I agree with P3, so this is not blocking.

## Quality
No required findings.
- **[optional]** `readHandoffState` now runs `assertNoHandoffLayoutConflict` twice per call, once in `migrateOwnWorkspaceIfFlat` and once in `readAndMigrate`. The second run is a backstop that the shared primitive needs for AC13 callers, so it is fine to keep. Each run costs a HEAD read and two `existsSync` calls.
- The comments and the doc block for `migrateFlatToLaneLocked` are updated accurately. `getFlatHandoffPath` was correctly dropped from the import list in handoff-write.

## Architecture
The `allowMissingRequired` split (question 4) is right.
- The direct runner is an operator and repair tool. The e123a AC7 contract, "no handoff means wrong or empty dir, refuse", still protects it: I verified that the wrapper refuses, the core refuses, nothing moves, and the wrapper removes the lane dir it created.
- The two triggers need the tolerance only because AC16's broader predicate now reaches workspaces that have sidecars but no handoff.
- The flag is explicit, it defaults to the strict behaviour, and only the two trigger sites set it. The wrapper now forwards `{ ...opts, lane }`, so a deliberate direct opt-in also works (verified). This is better than a second entry point, because both variants share one pre-flight.
- `requiredMayBeAbsent` is derived inside the core, `missingRequired.length > 0`, and is never exposed. That is the correct layering.

## Security
No findings. There is no new input boundary, and the lane name still goes through `assertSafeLane`. Paths are joined from the LANE_FILES registry only.

## Performance
No regression.
- In the migrated steady state, `hasFlatLaneFiles` costs at most 5 failed `statSync` calls per read, against 2 `existsSync` calls before. It does no parsing and takes no lock.
- The migration branch, and so the lock and I/O, is entered only while a flat file exists.
- **[optional]** A pre-flip server that keeps appending flat sidecars into a migrated workspace makes every read take the lock and merge. This is benign, because the lines are preserved, and that mixed-server state is exactly what the AC14 rollout note tells operators to avoid.

## Verdict
APPROVED — AC16–AC20 are implemented, the binding AC12–AC15 hold, and crash resume is verified independently with real process deaths at every rename, unlink and write step. The one recommended finding (the read path does not clear a stale lock) is the documented AC12 fallback and does not block.

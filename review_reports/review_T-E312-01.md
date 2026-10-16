# Review — T-E312-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed `git diff db21de6..c5d0c21` (commit c5d0c21): `tools/handoff-parse.ts` plus its rebuilt `dist/tools/handoff-parse.{js,js.map,d.ts.map}`. Nothing else is touched, which matches the Cut `touches` column for T-E312-01.
- `assertNoHandoffLayoutConflict` now checks lane, then flat, then lane again, and throws only when all three are true (AC1). `readAndMigrate` reads through a new private helper, `readHandoffFileIfPresent`. When the chosen file has disappeared, it retries the other layout's path once, in both directions (AC2).
- I checked the change independently with a scratch interleave harness. It injects a sibling rename after the Nth `existsSync` on a handoff path (N=1..6, forward and reverse, for both `parseHandoff` and `readHandoffState`). The fixed build passed all 24 rows, and stable dual presence still throws. Against the base `dist/`, 4 rows failed: forward N=1 threw a false `HANDOFF_LAYOUT_CONFLICT` on both parse and read (R1), reverse N=2 `parseHandoff` returned `null` (R2), and reverse N=4 `readHandoffState` returned `exists:false` (R2).
- `dist/` matches a fresh build: `git status` was clean after `npm run build`. `node --test test/e123b9-lane-flip.test.mjs` passed 25/25.
- Verdict: APPROVED. I found no required findings, and three optional notes, none of them in scope.
- Same-model bias flag: sr-engineer and code-reviewer both ran on opus this hop.

## AC Completeness
AC1 — implemented — tools/handoff-parse.ts:134-139. The check order is lane && flat && lane. The comment states the monotonicity argument, and the message and `lastUpdatedOf` reporting are unchanged.
AC2 — implemented — tools/handoff-parse.ts:334-344 (helper) and :351-366 (retry). It retries once in both directions, and returns `null` when neither file exists after the retry.
AC3 — implemented — the diff adds no lock, mkdir, rename or write. The new helper is a plain `readFileSync`. AC13 is still green in e123b9 (25/25).
AC4 — implemented — stable dual presence throws `HANDOFF_LAYOUT_CONFLICT` with the unchanged message on both `parseHandoff` and `readHandoffState` (harness). AC14 in `test/e123b9-lane-flip.test.mjs` passes without modification.

## Correctness
No required findings.

Soundness argument for AC1, which I verified:
- **Forward (flat→lane)**: lane is only ever created and flat only ever removed. If lane was seen at t1 and flat at t2 > t1, lane still existed at t2, so both files existed at t2. A rename that lands between t1 and t2 makes the t1 observation false, so the check returns without throwing. The `rename` action can never make both files exist at once, because `planMoves` picks `rename` only when the destination is absent (tools/lane-migrate.ts:189-212).
- **Reverse (lane→flat)**: a rename between t1 and t2 makes flat true at t2 but lane false at t3, so the check returns without throwing. Harness reverse N=1..3: ok.
- **Identical-bytes `drop` action**: both files exist before the drop, so this is a real (if benign) dual presence. Any reader that sees all three observations true throws. Base threw in the same case, so nothing regresses. In practice, under the lock, `drop` for handoff.md is only reachable after the unlocked check has passed, and the writer's own check runs under the lock (tools/handoff-write.ts:237).
- **AC4 (no missed real conflict)**: a stable dual presence makes all three checks true, so it always throws. The only dual presences the new order can miss are momentary ones the observations cannot prove. AC1 requires exactly that.

R2: forward (picked flat, flat moved to lane) and reverse (picked lane, lane moved to flat) both fall through to the other path (harness N=4, the pick call, ok in both directions). The base already retried forward but not reverse, so the cut's real behavioural delta is the reverse direction plus AC1. The change stays minimal: it replaces the base's inline forward-only retry with a symmetric one, about 12 net source lines. There is one benign behaviour change: a double race in which the retry target also disappears now returns `null`, where the base threw a raw ENOENT.

Read-path call sites:
- `migrateOwnWorkspaceIfFlat` (:158): uses the fixed check. After that, `hasFlatLaneFiles` returns false once a sibling has finished, the lock attempt returns on EEXIST, and a lock won after a sibling finished goes through `alreadyMigrated`. I found no residual R1/R2-class window.
- `readAndMigrate` (:351): fixed (AC1 + AC2).
- `readHandoffState` snapshot refresh (:579-582): see the optional note below.

Expected-red check (4a): the diff touches no test files, and the e123b9 run shows no unexplained reds. Nothing to sample.

- **optional** — tools/handoff-parse.ts:579-582. The `!existsSync(lane) && existsSync(flat)` → `refreshSnapshotFor(flat)` sequence is still an unlocked check-then-act. If a sibling renames flat to lane between `markStateRead` and this pair (or inside the pair), the session keeps a null or flat-path snapshot, and that session's next write fails with `STATE DRIFT`. This is a different failure class from R1/R2: it fails safe, a re-read fixes it, and AC-MIG-3 explicitly accepts it (`/^ERR w ⛔ STATE DRIFT/`). The spec's R1/R2 claim does not cover it. It is only a backlog candidate if AC6 load evidence shows it dominating.
- **optional** — tools/lane-migrate.ts / three-observation assumption. The lane-flat-lane proof assumes at most one migration direction lands inside the check window. A forward, then reverse, then forward sequence inside one window could produce T,T,T with no real dual presence. Today the reverse runner has no production caller and every mover holds the lane lock, so this cannot happen in practice. No action needed.

## Quality
No findings. The helper name `readHandoffFileIfPresent` is clear, the ENOENT/ENOTDIR mapping moved from inline code into the helper without changing behaviour, and no dead code remains.

Comment check (4b): the two new comment blocks (:134-138, :352-357 area) and the helper comment contain no local paths, hostnames or sensitive data. They cite only the ticket id and describe the invariant, so I kept them. The condition line at :139 is 99 characters, which fits the surrounding style.

## Architecture
There is no `specs/e312-read-path-migration-race-architecture.md` (the mini-chain has no architect hop). The fix stays in the read-path module and follows the spec's rejection of read-path locking. Layering is unchanged, and `tools/lane-migrate.ts` is untouched; its doc comment is still accurate.

## Security
No findings. The diff adds no new input boundary. Paths still come from the existing lane seam, and no secrets are introduced.

## Performance
No regression. The conflict check adds one `existsSync` per read, and the retry path adds one `existsSync` plus one read only when the first read fails, which is the rare race case. No loops or new I/O on the common path.

- **optional** (outside scope) — tools/drift.ts:228-229. `readArtifactVersion` has the same pick-then-read window as R2 (lane-or-flat pick, `existsSync`, `readFileSync`). Its catch-all returns `null`, so a race there only drops one schema-skew drift reason for one call. The spec scopes this out (only `tools/handoff-parse.ts`), so I note it for the backlog only.

## Verdict
APPROVED — AC1–AC4 are implemented and verified independently (interleave harness: fixed build 24/24 ok, base 4 red; stable dual presence still throws; e123b9 25/25; dist matches a fresh build), with no required findings.

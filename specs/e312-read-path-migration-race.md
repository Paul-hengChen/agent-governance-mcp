# E312 — read-path flat→lane migration race (AC-MIG-3 intermittent red)

Ticket: `docs/backlog.md` row E312 (P2). Lane: e312. Fan-out manifest: `specs/fanout-post-v4-w4.md`.
Dispatch mode: feature (mini-chain after this cut: sr-engineer → code-reviewer → qa-engineer; no architect hop).
Dispatch pins: `sr-engineer=opus` (manifest `## Dispatch pins`; persisted in the lane handoff `dispatch_pins`).

## Verdict of the forensics phase: (a) — a genuine reader-side race, not test timing

Coordinator-direct forensics on lane base `cac3036`:

1. **Reproduced under load.** Re-running the AC-MIG-3 scenario verbatim (same worker script, same 5-process `r,w,r,w,r` mix, same 400 ms head start) 100 times with 12 busy-loop CPU hogs on an 8-core host: 1/100 iterations failed with a `w` worker exiting `HANDOFF_LAYOUT_CONFLICT` — the exact CI failure shape. The end-of-run tree was clean in that iteration (lane holds everything, nothing flat, no lock): the two files never actually coexisted. 60 iterations without load: 0 failures.
2. **Deterministic proof.** Wrapping `fs.existsSync` so that a sibling's atomic `rename(flat → lane)` lands immediately after the first `existsSync(flatPath)` call returns `true`, an in-process `readHandoffState(ws)` throws `HANDOFF_LAYOUT_CONFLICT`, while a disk probe after every `existsSync` call never observed both files at once.

### Root cause

The forward migration is atomic per file (`fs.renameSync`, `tools/lane-migrate.ts` `executeMoves`) and every mover holds the lane lock, so true dual presence never occurs. The **read path's checks are not atomic and run without the lock**:

- **R1 — false conflict.** `assertNoHandoffLayoutConflict` (`tools/handoff-parse.ts`) evaluates `existsSync(flat)` then `existsSync(lane)`. A sibling's rename between the two calls makes the reader see flat (before) and lane (after) and throw. Unlocked call sites: `migrateOwnWorkspaceIfFlat` (before it tries the lock) and `readAndMigrate` (every read: after the lock was released, or when the lock was busy and the migration skipped). `readAndMigrate` is also the cross-workspace `parseHandoff` primitive, so cross-workspace readers share R1. The write path calls the same function **under** the lane lock and is not affected.
- **R2 — spurious "no state".** `readAndMigrate` picks `existsSync(lane) ? lane : flat` and then reads it. A sibling's rename between the pick and the `readFileSync(flat)` gives `ENOENT`, which is mapped to "no prior state" (`null` → `exists: false`). Same window class as R1; not observed in the 100-iteration run, but reachable by the same interleave.

Rejected alternative from the ticket: "take the lane lock on the read path". `readHandoffState` is synchronous (a blocking wait would need a sync sleep loop), and `parseHandoff` / cross-workspace readers must never lock, create, or move anything (E123b9 AC13). The read path already makes one non-blocking lock attempt; the fix is to make its unlocked checks tolerate a migration in flight.

## Scope (files)

- `tools/handoff-parse.ts` (+ `dist/tools/handoff-parse.*`) — the fix.
- `tools/lane-migrate.ts` (+ `dist/tools/lane-migrate.*`) — comment touch only if a doc comment describing the read path becomes wrong; no behaviour change expected, so it is not in the Cut `touches` column.
- `test/e312-*.test.mjs` — new regression tests (qa-engineer only).
- `test/e123b9-lane-flip.test.mjs` — **unchanged** (verdict (a): fix the code, keep the test).

Not in scope: `tools/handoff-write.ts` (its check is under the lock), `guards/**`, any other `tools/**`, the reverse runner's semantics, listing AC-MIG-3 in the load-sensitive family (moot under verdict (a); it remains a human ruling if qa's load evidence still shows red after the fix).

## Acceptance criteria

- **AC1 (R1 fixed).** `assertNoHandoffLayoutConflict` reports a conflict only when the observations prove both files existed at one instant under either migration direction. Required order: `lane`, then `flat`, then `lane` again — throw only when all three are `true`. Rationale to carry in the code comment (one or two lines): the forward migration only ever creates the lane file and removes the flat one, so `lane` seen then `flat` seen means both existed when `flat` was seen; the trailing `lane` re-check covers a reverse (`lane → flat`) rename landing between the first two checks. Message text and `last_updated` reporting unchanged.
- **AC2 (R2 fixed, both directions).** In `readAndMigrate`, when reading the chosen path fails with `ENOENT`/`ENOTDIR` and the *other* layout's file now exists, read that file instead — once, no loop. Forward: chose flat, flat vanished, lane now present → read lane. Reverse (symmetry with AC1; the `lane → flat` runner has no production caller today, but the window is the same class): chose lane, lane vanished, flat now present → read flat. Never return "no state" for a workspace whose handoff merely moved. A genuinely absent handoff (neither file after the retry) still returns `null`.
- **AC3 (no new side effects).** `parseHandoff` remains strictly read-only: no lock, no directory, no file created or moved (E123b9 AC13 unchanged). No new lock acquisition on the read path.
- **AC4 (real conflict still loud).** True dual presence (both files present and stable) still throws `HANDOFF_LAYOUT_CONFLICT` on own-workspace read and write with the unchanged message — E123b9 AC14 green without modification.
- **AC5 (deterministic regression, qa).** New `test/e312-*.test.mjs`: (i) R1 interleave — a sibling `rename(flat → lane)` injected between the conflict check's `existsSync` calls (patch the `node:fs` CJS export + `module.syncBuiltinESMExports()`, restore in `finally`) → `readHandoffState` and `parseHandoff` both succeed and return the fixture state; (ii) the same injection placed after the first `lane` check in the reverse direction (`lane → flat`) also does not throw; (iii) R2 interleave, both directions — a `flat → lane` rename injected between the path pick and the read, and a `lane → flat` rename likewise → `parseHandoff` returns the fixture state, not `null`; (iv) stable dual presence still throws. qa records that (i) and (iii) are red against the base `dist/` (expected-red evidence in the qa report, not a separate manifest).
- **AC6 (load evidence, qa).** qa re-runs the AC-MIG-3 scenario under CI-like CPU load for ≥ 100 iterations on the fixed build and records the failure count (target 0) next to the base-build baseline. The harness lives in scratch space (not committed) or as a non-default opt-in script — never as a default `npm test` member. If red persists after the fix, qa reports the residual failure shape and the AC-MIG-3 load-sensitive-family question goes back to the integrator as `needs human ruling`.
- **AC7.** Full suite green via `node scripts/test-lock.mjs -- npm test` on the final committed HEAD; `test/e123b9-lane-flip.test.mjs` untouched. The untouched check (`git diff cac3036 -- test/e123b9-lane-flip.test.mjs` empty) is a one-time QA evidence line only — never a resident test assertion (manifest common scope: no new test diffs against a fixed base sha).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E312-01 | sr-engineer: fix read-path race R1/R2 (AC1–AC4); rebuild dist | none | 3 | `tools/handoff-parse.ts`, `dist/tools/handoff-parse.*` | none |
| T-E312-02 | qa-engineer: deterministic regression tests, load evidence, full suite (AC5–AC7) | T-E312-01 | 1 | `test/e312-read-path-race.test.mjs` | none |

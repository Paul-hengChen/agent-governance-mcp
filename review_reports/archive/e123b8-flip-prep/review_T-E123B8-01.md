# Review — T-E123B8-01

covers: T-E123B8-01, T-E123B8-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed diff: `git diff -- tools index.ts` (tools/dispatch-log.ts, tools/handoff-write.ts, tools/lane-migrate.ts, tools/lane-paths.ts, tools/role.ts, index.ts) against specs/e123b8-flip-prep.md AC1-AC8 and Out of Scope. No architecture spec exists for this feature.
- Zero behaviour change holds: `resolveLanePaths` still ignores `lane` and returns flat `.current/<filename>` paths; the lock stays at `.current/.handoff.lock`; `LANE_FILES` is untouched; no test/, content/, or bin/ edits.
- AC9 (the CALLERS3 allow-list for tools/dispatch-log.ts) is qa-owned (T-E123B8-04), so it is not a defect in this diff.
- Verdict: APPROVED.

## Correctness
- AC1: `dispatchLogPath` now returns `resolveCurrentLanePaths(path.resolve(ws)).dispatchLogPath` (tools/dispatch-log.ts:52-53). For an absolute ws this is byte-identical to the old flat join. `mkdirSync` now uses `path.dirname(logPath)` (:62-65), and there is no direct `.current` join left in the file. Because `resolveCurrentLane` never throws, the append stays best-effort inside the existing try.
- AC2: `normalizeWorkspacePath` (index.ts:66-71) runs once, after the source is chosen, so it covers all three sources (arg, `CLAUDE_PROJECT_DIR`, cwd). I spot-ran it against dist: `~` gives homedir, `~/x` gives homedir/x, a relative path resolves against cwd, and `/abs/path` comes back unchanged. One observation, not a defect: `path.resolve` strips a trailing slash from an absolute input (`/a/b/` becomes `/a/b`). The AC's "absolute, normalized" allows this.
- AC3: exactly one `.handoff.lock` literal remains under tools/ (tools/lane-paths.ts:82), and both handoff-write.ts and lane-migrate.ts import `HANDOFF_LOCK_FILENAME`.
- AC4: tools/handoff-write.ts:269-277. `ensureDir(getHandoffPath(ws))` runs before the lock, and `getHandoffPath` is called again inside the `withFileLock` callback, before `verifyFreshness`. The extra `ensureDir` inside the callback is idempotent and harmless.
- AC5: tools/lane-migrate.ts:70-85 and :230-249. Debris means exactly `HANDOFF_LOCK_FILENAME`, or `<LANE_FILES filename>.<digits>.<digits>.tmp`, and it must be a regular file. That shape matches the atomic writers (handoff-write.ts:677). Any other non-LANE_FILES entry is still `foreign` and throws before `planMoves` or any move. Debris is unlinked only after the moves, and then the non-recursive `rmdirSync` runs.
- AC6: tools/lane-paths.ts:105. `[a-z]+\d[a-z0-9]*` accepts the same language and gives the same capture as the old `[a-z]+\d+[a-z0-9]*`, because both are greedy and anchored by `(?:-|$)`. My differential check over 10 sample ids found no differences. A 10k-digit input with no terminator returned in about 0ms.
- AC7: the header comment and the `resolveCurrentLane` JSDoc are corrected (comment only).
- AC8: comment-only additions at index.ts:121 (hook marker) and tools/role.ts:60 (SOP overrides). bin/agent-governance-context.mjs is untouched.

## Quality
No findings. The comments are accurate and match the surrounding style. One minor note: `laneFile()` now has no production caller. sr already logged that as a J2 follow-up in NEW-TICKETS.md.

## Architecture
No architecture spec for this feature. The change fits the spec's intent: every J2-sensitive site now goes through the resolver or the single lock constant. None of the Out of Scope items (the resolver flip, migration wiring, per-lane lock, `metricsPath()`) is touched.

## Security
No findings. AC5 is still conservative: unknown content is never deleted, a debris-named directory is refused, and `assertSafeLane` still guards the lane segment. `~` expansion only covers bare `~` and `~/`, and `~user` is not expanded. No new trust boundary.

## Performance
No regression of concern. AC6 removes a quadratic backtracking path. `dispatchLogPath` now does the read-only `.git` / HEAD probe of `resolveCurrentLane` on each append. That is one small sync read per state write and is not a hot path.

## Verdict
APPROVED. All of AC1-AC8 are met with zero behaviour change, and nothing out of scope was touched. The single red test is the qa-owned AC9 allow-list update.

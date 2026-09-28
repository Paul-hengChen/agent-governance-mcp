# Review — T-E123B1-01

covers: T-E123B1-01, T-E123B1-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Routes the handoff path in four source files (tools/handoff-write.ts, tools/handoff-parse.ts, guards/session.ts, tools/drift.ts) through `resolveCurrentLanePaths(path.resolve(ws)).handoffPath`. Adds 15 source lines and removes 5. dist/ was rebuilt to match.
- `ensureDir` now runs after the path is resolved and mkdirs `path.dirname(handoffPath)`. Today that is the same directory as before.
- Nothing outside the allowed files changed: tools/lane-paths.ts, content/, test/, tools/registry.ts and tools/role.ts all match `main` (`git diff --quiet main -- ...` exits 0).
- Verdict: APPROVED. Behaviour is unchanged today, apart from the accepted delta: output paths are now absolute when the workspace path is relative.

## Correctness
No findings. Checks run:
- **Path value today**: `resolveLanePaths` ignores the lane and returns `path.join(ws, ".current", "handoff.md")` (tools/lane-paths.ts, `resolveLanePaths`). With `path.resolve(ws)` as input, the result is the same file as the old `path.join(ws, ".current", "handoff.md")` for both absolute and relative `ws`. For a relative `ws` the string becomes absolute, which is the human-accepted delta.
- **ensureDir reordering** (tools/handoff-write.ts:58-63, :264-265): the old call did `mkdir(ws/.current)`. The new call does `mkdir(dirname(resolve(ws)/.current/handoff.md))`, which is `resolve(ws)/.current`: the same directory, created before the same point. `getHandoffPath` is pure apart from reading `.git`/HEAD and has no side effects, so calling it before `ensureDir` changes nothing. The lock path (tools/handoff-write.ts:266, `path.join(workspacePath, ".current", ".handoff.lock")`, byte-unchanged) is still built after `ensureDir` and points into the directory that was just created. I smoke-tested this on a fresh relative workspace with no `.current/`: the first write created `.current/`, took the lock and wrote handoff.md. A second same-session write succeeded. An external mtime bump then tripped STATE DRIFT, as it should.
- **Freshness consistency**: the session snapshot stores only `handoffMtimeMs`, not the path string (guards/session.ts:48-56). `verifyFreshness` and `refreshSnapshotFor` stat whatever `filePath` the write path passes. Snapshot and write now resolve the same file, so the mtimes compare correctly. `activeSessions` is still keyed by the raw `workspacePath` in markStateRead, verifyFreshness and refreshSnapshotFor, so there is no key mismatch between relative and absolute forms. Unchanged from `main`.
- **session.ts**: the `workspaceExists` guard is kept, so SQLite/HTTP mode with a non-local path still does no fs scan beyond the stat. `resolveCurrentLane` is documented as never throwing and wraps its fs reads in try/catch.
- **drift.ts:248**: this sits inside the existing try block, so behaviour on error is unchanged.
- **Constraints**: `.config.json` (drift.ts:266), `feature-split.md` (drift.ts:117), `archive` (handoff-write.ts:483), the lock path and tasks.md resolution (`findTasksFile`) are all untouched. The AC1 grep for quoted lane filenames over the 6 files finds 0 matches. Every `resolveCurrentLanePaths` call is wrapped in `path.resolve` (AC2).
- **Expected-red sampling (step 4a)**: `qa_reports/expected-red_e123b1-core-write-path.txt` exists. I sampled all 4 entries and each is a real, locatable test (2 in test/lane-paths.test.mjs, 2 in test/check-md-tables.test.mjs). A full `node --test test/*.test.mjs` run gives 2315 tests, 2311 pass and 4 fail. The 4 failures are exactly the manifest entries (CALLERS2, CALLERS3, AC7, CQ-9). I make no ruling on how AC5's wording treats them.

## Quality
No findings. The comments are accurate and scoped. The `getHandoffPath` duplication between handoff-write.ts and handoff-parse.ts already existed on `main` and is not introduced here.

## Architecture
The change matches the frozen interface in specs/e123b0-lane-runtime-resolver.md: callers go through `resolveCurrentLanePaths` and never restate filenames. Deriving the directory from `dirname(handoffPath)` in `ensureDir` is the right shape for J's flip, because a lane subdirectory will then be created automatically. Advisory for J, not a finding: after the flip, the lock stays at `.current/.handoff.lock` while the handoff moves into a lane subdir. The lock then serialises all lanes and still depends on `.current/` existing. That holds today, because `mkdir -p` of the lane dir also creates `.current/`. J owns this under L-SCHEMA-NEW-7.

## Security
No findings. No new input crosses a trust boundary. The lane name from the resolver is limited to `[a-z0-9]`, so it cannot traverse paths once J makes it lane-aware.

## Performance
Minor and not blocking. Each `getHandoffPath` / `markStateRead` / `readArtifactVersion` call now adds one `statSync` on `.git` and one or two small `readFileSync`s (the gitfile and HEAD). These are O(1) and cheap next to the handoff read/write they sit beside, with no change in complexity class. If the lane read ever shows up in profiles, J could resolve the lane once per write.

## Verdict
APPROVED. The diff is limited to the four sanctioned source files plus dist. It targets the same file with the same directory creation, lock placement and freshness semantics as `main`, and the only difference is the accepted absolute-path delta.

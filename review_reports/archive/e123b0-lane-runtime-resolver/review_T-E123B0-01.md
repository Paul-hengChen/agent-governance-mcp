# Review — T-E123B0-01

covers: T-E123B0-01, T-E123B0-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff: `tools/lane-paths.ts` only (+93/-7), plus its `dist/tools/lane-paths.*` rebuild. Adds `PRIMARY_LANE`, `resolveCurrentLane`, a private `headFilePath` helper, and `resolveCurrentLanePaths`. `TICKET_ID_RE` widened in place.
- Judged against specs/e123b0-lane-runtime-resolver.md AC1-AC6 and Out of Scope. No architecture spec exists (mini-chain).
- Re-derived by hand: a 36-case scratch smoke run against `dist/` in `$TMPDIR` (deleted afterwards). Covered: `.git` dir, abs/relative/whitespace/CRLF gitfile, detached HEAD, empty/binary/missing/directory HEAD, malformed/empty/dangling gitfile, missing `.git`, nonexistent ws, non-string arg, this worktree (-> `e123b0`), primary checkout (-> `_primary`), and the resolveLaneName table. Every case matched the spec.
- Verdict: APPROVED. Two non-blocking P3 findings filed as L-SCHEMA-NEW-8 and L-SCHEMA-NEW-9.

## Correctness
No blocking findings.
- AC1: `PRIMARY_LANE = "_primary"` exported (tools/lane-paths.ts:83).
- AC2: pure fs, with only `statSync` (`throwIfNoEntry:false`) and `readFileSync` and no subprocess (tools/lane-paths.ts:136-148). Dir -> `.git/HEAD`. Gitfile -> `GITDIR_RE` on the trimmed content, and the trimmed gitdir is resolved against the workspace, which matches git's rule that a relative gitdir is relative to the directory containing the `.git` file. A linked worktree's per-worktree `HEAD` sits directly in the gitdir, so no `commondir` hop is needed. `HEAD_REF_RE` rejects a detached sha. `feat/` prefix plus `TICKET_ID_RE` gives the lowercased id, else `PRIMARY_LANE`. The whole body is in try/catch (tools/lane-paths.ts:161-175). Confirmed it never throws on a non-string arg, a directory-as-HEAD (EISDIR) or binary content.
- AC3: `TICKET_ID_RE` suffix changed `[a-z]*` -> `[a-z0-9]*` at its single definition (tools/lane-paths.ts:90). There is no second copy anywhere in tools/ gates/ guards/ prompts/ bin/ index.ts. F0 examples hold: `e163-ci-gate-ordering`->`e163`, `e123a-lane-layout-migration`->`e123a`, unparseable->`_legacy`. `e123b0/b1/b9` resolve to themselves. `resolveLaneName("_primary")` -> `_legacy`, so it has no path to `PRIMARY_LANE`.
- On sr's `e12x3-foo` -> `e12x3` (was `_legacy`): **does not matter**. (a) This is exactly the spec-mandated widening. Before it, `e123b0-*` also fell to `_legacy`, which is the collision AC3 exists to remove. (b) The only non-test consumer of `resolveLaneName` is `tools/lane-migrate.ts:164`, which is itself uncalled in production (F0), so this changes no behaviour today. (c) The capture is still `[a-z0-9]` only, so `lane-migrate`'s safe-segment assumption (tools/lane-migrate.ts:63) still holds. (d) The migration-time and live resolvers now agree on every id, which is what sharing the pattern is meant to guarantee.
- AC4: `resolveCurrentLanePaths` = `resolveLanePaths(ws, resolveCurrentLane(ws))` (tools/lane-paths.ts:182-184). Output is equal to the flat paths for a `_primary` ws and a feat-branch ws.
- AC5: `grep -rn "resolveCurrentLane" tools/ gates/ guards/ prompts/ bin/ index.ts` matches only tools/lane-paths.ts.
- AC6 (reviewer-side spot check only, since QA owns AC6): `npx tsc --noEmit` clean. The rebuilt `dist/` is byte-identical to the committed-to-tree `dist/` (re-ran tsc and diffed). `test/lane-paths.test.mjs` + `test/lane-migrate.test.mjs` 33/33 pass.
- Out of Scope respected: no `.config.json` read (the only "config" hit is the pre-existing registry comment at :32), no lock work (L-SCHEMA-NEW-7 left to J), no call-site migration, and `git diff --name-only -- content test` is empty.
- Expected-red sampling (step 4a) not armed: the diff touches no test file and nothing is red.

## Quality
No findings. The header comment is updated honestly for the new `fs` import. The regex constants are named and commented. `headFilePath`'s "may throw, caller swallows" contract is stated. The naming matches F0 (`LEGACY_LANE` / `PRIMARY_LANE`).
- Non-blocking (L-SCHEMA-NEW-9): an empty or relative `workspacePath` resolves `.git` against `process.cwd()`. Smoke: `resolveCurrentLane("")` returned `e123b0` because cwd was this worktree. This is harmless today (no callers, and the tw_* boundary passes absolute paths), but L1-L3 should know about it.

## Architecture
No architecture spec (mini-chain, spec only). The layering is right: the live resolver sits beside the migration-time resolver in the one seam module, shares the single pattern owner, and the path function stays a zero-behaviour stub until J.

## Security
No findings. Read-only fs, no subprocess, no network, no write. The resolved lane name is still restricted to `[a-z0-9]` or the two `_`-prefixed constants, so the gitfile/HEAD content, which is attacker-influenceable in a hostile checkout, cannot inject path separators or `..` into a future lane path. A hostile `gitdir:` can only make the resolver *read* some other `<dir>/HEAD`, and the result is still regex-filtered to a safe segment.

## Performance
No blocking findings. Two stat/read syscalls per call, no caching (correct, since the branch can change between calls).
- Non-blocking (L-SCHEMA-NEW-8): the widening makes `\d+` and `[a-z0-9]*` overlap, so a digit run followed by a non-terminator backtracks quadratically. Measured: a 20k-char `e111…1!` took 660 ms. The old pattern was linear. It is bounded today: `active_feature` is capped at 500 by zod (tools/registry.ts:187), which is well under 1 ms, and branch names are local and short. `/^([a-z]+\d[a-z0-9]*)(?:-|$)/i` accepts the same language with the same capture and is linear.

## Verdict
APPROVED — all six ACs re-derived independently with no blocking finding, and Out of Scope is respected. Two P3 hardening notes are filed as L-SCHEMA-NEW-8/9.

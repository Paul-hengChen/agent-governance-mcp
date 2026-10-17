# Review — T-E335-04 (lane e291, e291-start-link-locations)

covers: T-E335-04

## Round 1 — APPROVED — by code-reviewer

Diff: `git show 316f25d` (`bin/agc-init.mjs` only, +34/-12; d9da79b is the state-only handoff commit). Contract: `specs/e291-start-link-locations.md` D8 and AC-E335-7 (amendment 2, 0709431), plus AC-E335-5/6 and the D7/T-E335-03 set-aside this change extends. No architecture spec exists. This round reviews only the T-E335-04 delta; the four earlier tasks were approved in `review_reports/review_T-E291-01.md`. Model note: sr-engineer and this review both ran on opus, so the two passes may share blind spots. To offset that, the claims below were checked with test runs on both runtimes and with two negative controls on a scratch copy of the tree outside the worktree.

## Summary
- New helper `setAsideCollidingHistoryLinks` (`bin/agc-init.mjs:1904-1921`). It walks the lane's `.current/<lane>/` with `readdirSync({ withFileTypes: true })` and recurses only where the lane entry is a real directory and the history entry `lstat`s as a real directory. Each history symlink that has a same-named lane symlink is renamed to `<dst>.<pid>.<ms>.aside.tmp` and pushed onto a shared `asides` list.
- In `executeAbandonCurrentHarvest` (`:1929-1968`), the T-E335-03 single `aside` became that shared list. The `pending-tickets.md` set-aside runs first, then the D8 walk, then the unchanged `cpSync`. On failure, every entry is restored in reverse order and a restore that fails is skipped (the entry stays at its aside path). On success, every entry is removed. The error text is byte-identical.
- Node 20 `test (20)` regression fixed: the E335/finish set is 144/144 on Node 20.20.2 and 144/144 on Node 22.22.3.
- Verdict: APPROVED. Nothing blocks the round. There is 1 recommended item (a test gap that qa T-E335-05 owns) and 3 optional notes.

## AC Completeness
AC-E335-7 (success clause) — implemented — `:1914-1918` sets aside the colliding history `other-link.md`, and `cpSync` then copies the lane link fresh. `test/e335-symlinked-pending-harvest.test.mjs` AC-E335-6 (a)/(b) already assert that history `other-link.md` is a symlink whose realpath equals the lane target (lines 345-346). Green on Node 20 and 22. Negative control NC1 (walk call removed, scratch copy): AC-E335-6 (a) and (b) go red on Node 20 and stay green on Node 22, which reproduces the CI split exactly. The committed tests therefore discriminate this fix.
AC-E335-7 (failure clause) — implemented — `:1947-1956` restores every aside, D8 entries included. Reviewer scratch test (scratch copy only, not committed): history `other-link.md`, a nested `sub/nested-link.md`, and `pending-tickets.md` all collide as links, and a `chmod 000` lane file makes `cpSync` fail. Result on Node 20 and on Node 22: all three links are back at their original paths with their original targets; no `.aside.tmp` is left at either level; the old link target's bytes are unchanged; stderr matches the unchanged `harvest … failed (…) — worktree and branch left in place (re-running finish is safe)`; worktree and branch are kept. The re-run then exits 0 and converges, and both links resolve to the lane target. No committed test covers this clause yet — see Correctness R1.
AC-E335-6 — implemented — (a) and (b) are green on both runtimes (they were red on Node 20 before the fix, per NC1).
AC-E335-5 — implemented — the regular-file `pending-tickets.md` run is green on both runtimes. With no colliding links, `asides` stays empty and the function behaves as it did before this change.
AC-LANE (e246) — `test/e246-mailbox-teardown.test.mjs` is byte-unmodified against `main` (`git diff --stat main...316f25d` is empty) and green on both runtimes.

## Correctness
- **R1 (recommended — qa T-E335-05 scope)**: no committed test covers the AC-E335-7 failure clause. Negative control NC2 changed the restore loop to `asides.slice(0, 1)`, which restores only the `pending-tickets.md` aside and leaves every D8 aside stranded. All committed tests stayed green on Node 20 and on Node 22; only the reviewer's scratch failure-clause test went red. A regression that drops D8 restores would therefore ship unnoticed today. I agree with the sr-engineer note that this belongs to T-E335-05, which owns `test/e335-*.test.mjs`. Suggested shape: extend the existing `AC-E335-6 (failure path)` test (`:352`) with a history `other-link.md` link whose old target differs from the lane's. Then assert `readlinkSync` equals the old target after the failed run, no aside file is left, and the re-run converges.
- Not set aside twice: when the covered `pending-tickets.md` history entry is a file or link, the first block renames it before the walk runs. The walk's `lstatOrNull(dst)` then returns null for that name, so it is skipped (`:1914`). When `derefPending` is false (not covered, or the lane copy is a regular file), only the walk can set it aside, and only if both sides are links. That is the D8 rule. Correct.
- Walk never follows links: `Dirent.isDirectory()` is false for a symlink, so a lane-side link to a directory is never descended. The history side is `lstat`ed, never `stat`ed. `srcAbs` is already a realpath (`:1896`). Only `renameSync` and `rmSync` touch history links, and `rmSync` without `recursive` unlinks a symlink rather than following it. Nothing is written through a link, and the scratch test confirms the old target's bytes are unchanged.
- Restore and remove ordering: the reverse restore is LIFO. If `cpSync` already replaced `orig` with the lane link, POSIX `rename` atomically replaces it with the original. A restore that throws leaves the entry at its aside path, which is lossless per D8. Removal happens only after the `try` completes. A walk failure partway through (a rename or readdir error) is inside the `try`, so the asides recorded so far are restored. Correct.
- Aside naming: `${dst}.${pid}.${Date.now()}.aside.tmp` is unique per `dst`, and each `dst` is visited once. The asides sit in the history tree, while `readdirSync` iterates the lane tree, so renaming them does not disturb the iteration. `cpSync` never touches the extra history entries.
- **O1 (optional)**: on Node 22, D8 sets aside every colliding history link regardless of target. A pair that `cpSync` itself would reject (for example, a lane link whose target is a subdirectory of the history link's target; not probed this round) would now succeed on both runtimes. D8 mandates this ("every … history link is renamed aside"), so it is not a finding against the AC. It is noted only because the statement "Node 22 results unchanged" holds for the converging cases, not for that error path.

## Quality
- The helper name, the aside naming shared with T-E335-03, and the `lstatOrNull` reuse all match the surrounding code. There is no duplication beyond the two aside-name template literals. They could share a one-line helper, but they are two sites in one file, so this is not required.
- Comment check: the `setAsideCollidingHistoryLinks` doc comment is 3 lines, and the `executeAbandonCurrentHarvest` header is 7 lines (within the limit). Neither has an absolute path, a `##` heading, or pasted spec text, and the pointer "Rationale: E335 T-E335-03/04 commits." is one line. `node bin/agc-init.mjs check` emits no `agc check — comments` warning.
- **O2 (optional)**: the in-body line `// After the pending-tickets.md set-aside, so that file is never set aside twice.` (`:1943`) sits inside the function body. §6 prefers non-obvious warnings at the function head. Kept: it is a single line that guards a load-bearing statement order, and it reads more clearly next to the call than in the header, which is already at its 7-line cap.

## Architecture
No architecture spec exists. The change is local to `executeAbandonCurrentHarvest` plus one private helper placed directly above it. The rejected alternatives the spec names (`dereference: true`, removing colliding links before the copy) were not used. The `--shipped` path and `executeHarvestRefresh` are untouched.

## Security
`ent.name` comes from `readdirSync`, so it cannot contain a path separator and `path.join` cannot traverse out of the tree. There is no new input boundary, no secrets, and no write through a link.
- **O3 (optional, pre-existing, out of scope)**: if `.current/history/<bucket>/<lane>` is itself a symlink to a directory, `planAbandonCurrentHarvest` accepts it (`isDirectoryPath` follows links). The walk then renames entries inside the link's target, just as `cpSync` already writes there. This behavior predates the change and the spec does not address it.

## Performance
The added cost is one `readdirSync` walk of the lane dir, plus one `lstat` per entry, recursing only where the history side also has a real directory. That is O(lane entries), done once per `--abandoned` finish, and it is negligible next to the `cpSync` of the same tree. There is no hot path and no regression.

Test runs (lane worktree at 316f25d, clean code tree; files: e335-symlinked-pending-harvest, e180-abandoned-harvest, agc-feature-finish-history, e287-finish-findings, e246-mailbox-teardown, agc-feature-lifecycle):
- Node 22.22.3: 144/144 pass, 0 fail.
- Node 20.20.2 (`fnm exec --using=20`): 144/144 pass, 0 fail.
- NC1 (walk call removed): Node 20 AC-E335-6 (a)/(b) not ok; Node 22 green.
- NC2 (restore only the first aside): every committed test green on both runtimes; only the scratch AC-E335-7 failure-clause test red.

## Verdict
APPROVED — D8 and AC-E335-7 are implemented exactly as specified: the walk never follows links, nothing is set aside twice, every aside is restored on failure and removed on success, the error text is unchanged, and the E335/finish set is green on both Node 20 and Node 22. The one gap, the uncommitted failure-clause test (R1), belongs to qa T-E335-05.

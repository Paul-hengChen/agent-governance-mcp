# Review — T-E180-01

covers: T-E180-01, T-E180-02, T-E180-03, T-E180-04

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff reviewed: `git diff 98052c6...HEAD -- bin/agc-init.mjs` (+172/-2), commits b762a89 (E180), 098be72 (E194), d3053b9 (E197). T-E180-04 (dist rebuild) is a no-op: `bin/` is not compiled into `dist/`, and `git diff --stat 98052c6...HEAD -- tools test dist` is empty.
- E180: `planAbandonEvidenceHarvest` / `evidenceAtRisk` (plan, read-only) plus `applyAbandonEvidenceHarvest` (copies to primary, all of them before the first move). E194: `planAbandonCurrentHarvest` runs before any `--abandoned` mutation, and `executeAbandonCurrentHarvest` runs just before `removeWorktreeNoForce`. E197: one string in `closedLanePointerLine`.
- Lane boundaries hold. No `--shipped` function is touched apart from the `closedLanePointerLine` string. `applyPendingOnAbandoned`, `feature start`, `tools/**` and `test/**` are untouched.
- Every Copy/Strings entry matches verbatim, checked by eye and by a `includes()` check on the refusal line and the E197 string.
- The reviewer's own $TMPDIR repros matched the spec for AC1, AC3, AC4, AC9, AC10 and AC12 (flat legacy primary `.current/` was byte-unchanged).
- Model independence: sr-engineer ran on fable, this reviewer on opus. No suspicion of same-model bias.
- Verdict: APPROVED. There are no required findings. One recommended edge-case hardening follows.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs:1444-1467 (plan), :1485-1514 (copy + e180 line), :1517 (copy before moves). Repro: both files harvested into `<primary>/{qa,review}_reports/abandoned/e99/`, and the `moved` lines are still printed.
AC2 — implemented — bin/agc-init.mjs:1477 (`isSafelyLinkedOutside` on the evidence dir short-circuits).
AC3 — implemented — bin/agc-init.mjs:1453-1466. The refusal fires inside `planAbandonEvidence` (:1431). That function runs inside `applyPendingOnAbandoned` before `assertPrimaryWritable` and before both commits, or in the fallback path before `applyAbandonEvidence`. Repro: refused, the lane file stayed in place, and there was no lane commit.
AC4 — implemented — bin/agc-init.mjs:1455-1460. An identical file gets no `harvestAbs` and no conflict. Repro: the re-run with an identical primary copy did not refuse.
AC5 — implemented — bin/agc-init.mjs:1478-1480. A file that is not ignored gets exit 1 for both src and dst, so it is not at risk. Repro: native `git worktree remove` refused over the moved plain untracked file, unchanged.
AC6 — implemented — copies run with COPYFILE_EXCL before the first move, and a partial copy is removed (:1494-1504). A re-run sees identical copies (AC4), or finds the files already moved out of `src` and enumerates nothing.
AC7 — implemented — bin/agc-init.mjs:1560-1601 (plan), :1610-1631 (copy + e194 line), :2424 (runs right before removeWorktreeNoForce). No exclusions (base-sha was copied in the repro).
AC8 — implemented — bin/agc-init.mjs:1572 (`hasTrackedContent(lanePath, laneRel)`, judged against the lane's own index as the spec requires).
AC9 — implemented — bin/agc-init.mjs:1582-1588, planned at :2401 before `applyPendingOnAbandoned`. Repro: refused with the verbatim string and nothing was moved.
AC10 — implemented — bin/agc-init.mjs:1614 (`cpSync` with force/errorOnExist:false and no rm). Repro: a pre-seeded `only-history.md` survived and `handoff.md` was refreshed.
AC11 — implemented — bin/agc-init.mjs:1564-1569 (stat fails, returns null).
AC12 — implemented — end-to-end repro against the exact adopter-project `.gitignore` (`.current/`, `tasks.md`, `/qa_reports/`, `/review_reports/`, `/specs/`). Both harvests fired, the worktree was removed, the branch was kept, and the flat primary `.current/{handoff.md,tasks.md,archive/x}` was byte-identical before and after.
AC13 — implemented — bin/agc-init.mjs:1895.

## Correctness
- Primary resolution is correct. `listWorktrees(lanePath)[0].path` is always the main worktree (porcelain contract, :1068-1069), so harvest targets land in primary and never in the lane. The repro confirmed this.
- The at-risk predicate, including the fail-toward-harvest behaviour on exit 128, is sound. Checking the post-move `dst` as well as `src` correctly catches an ignore rule that covers only `abandoned/`.
- The E194 plan/execute split is ordered correctly. The refusal comes before every mutation, and the copy captures the lane's final state after the pending archive commit.
- [recommended] bin/agc-init.mjs:1614: `fs.cpSync` runs without `dereference: true`, and `verbatimSymlinks` defaults to false. A symlink *inside* `.current/<ticket>/` is therefore recreated in history as a symlink whose target is resolved to an absolute path into the lane worktree, and that link dangles once the worktree is removed. `srcAbs` is realpath'd, so only the top level is dereferenced. `.current/<ticket>/` rarely holds links, so this does not block, but `dereference: true` would make the harvest lossless for that shape.
- [optional] bin/agc-init.mjs:1500: `fs.rmSync(m.harvestAbs, { force: true })` has no `recursive`. If `harvestAbs` were somehow a directory at that point (only under a concurrent race), `rmSync` would throw and mask the original error. This is negligible.

## Quality
- [optional] bin/agc-init.mjs:1506-1511: the e180 harvest line always says "`{dir}/ is git-ignored here`". In the fail-toward-harvest cases (check-ignore exit 128, or only the post-move `dst` is ignored) that clause is slightly inaccurate. The string is spec-verbatim, so no change is required.
- [optional] AC4/AC6 re-runs where the primary copy already matches print nothing about evidence. A one-line "already harvested" note would help operators, but the spec does not require it.
- The two authored-here copy-failure strings (:1502-1504, :1616-1620) are acceptable. They are error paths not covered by the Copy/Strings table, they follow the existing `(nothing moved …)` and `(re-running finish is safe)` style, and they state the worktree disposition.
- Comments are accurate and scoped. Existing helpers (`isSafelyLinkedOutside`, `hasTrackedContent`, `sameFileBytes`, `lstatOrNull`, `isDirectoryPath`, `listWorktrees`, `lanePaths.resolveHistory*`) are reused as the spec requires, with no reimplementation.

## Architecture
No `specs/e180-abandoned-harvest-architecture.md` exists. The implementation follows the spec's Dependencies section. Harvest logic lives in `planAbandonEvidence`/`applyAbandonEvidence` (E180) and in new sibling functions called from the `--abandoned` branch (E194). `applyPendingOnAbandoned` is not edited, and no signature changes, because repoRoot is derived internally. The `--shipped` functions are untouched.

## Security
No findings. File names from `readdir` reach git only through `execFileSync` argv after `--` (via `gitTry`), and there is no shell interpolation. `ticketId` is validated as a bare lane name before `resolveHistoryLaneDir`. Copies write only under primary `{qa_reports,review_reports}/abandoned/<ticket>/` and `.current/history/<bucket>/<ticket>/`.

## Performance
No regression. Each untracked evidence file costs up to two `git check-ignore` spawns, and there is one `git worktree list`. N is the handful of files matching the ticket token.
- [optional] Batching through `git check-ignore --stdin -z` would cut the spawns to one. That is not needed at this scale.

## Verdict
APPROVED. All 13 ACs are implemented and the reviewer's independent repros confirmed AC3/AC4/AC9/AC10/AC12. The Copy/Strings entries are verbatim, refusals come before every mutation, and harvests resolve to primary without touching the flat legacy `.current/`. The only non-optional finding is a recommended `dereference: true` on the E194 `cpSync`.

# Review — T-E125B-01 (batched round)

covers: T-E125B-01, T-E125B-02, T-E125B-03, T-E125B-05, T-E125B-06, T-E125B-07

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff: `git diff f174d89..HEAD` (code 31cd3d7, state 7f9d061). Contract: specs/e125b-lane-close-writeback.md. No architecture spec exists.
Reviewer model: opus. sr-engineer was pinned to fable, so the two ran on different models.

## Summary
- Adds three pieces. (1) A lane-close writeback in `agc feature finish --shipped`: a `git mv` into `.current/history/<YYYY-MM>/<lane>/` for the tracked shape, an fs-copy harvest for the gitignored shape, and a `## Closed Lanes` `lane_closed:` pointer line. (2) The `base-sha` fork-point file: written at start, registered in `LANE_FILES`, worktree-local through the shared info/exclude. (3) `getLaneFeatureHistory` now merges metrics.jsonl rows, and `makeForeignCheck` gains history-bucket foreignness (X7).
- I ran end-to-end fixture smokes (scratchpad, real git) for tracked close, gitignored harvest, `--pr`, the `-->` refusal, an idempotent re-run, the lane→flat→lane round-trip with the exclude rule in place, and AC5 recovery. The happy paths all behave to spec.
- The AC9 harvest path has two holes. I reproduced both. One is a silent loss of lane governance state; the other is a rollback leftover that blocks the re-run which the error message calls "safe".
- Verdict: CHANGES_REQUESTED (2 required findings, both small and local to `executeLaneClose` / `runFeatureFinish`).

## AC Completeness
- AC1 — implemented. `bin/agc-init.mjs` `planLaneClose` / `executeLaneClose` do the `git mv` and one path-limited commit on base. Smoke: `.current/e900/` → `.current/history/2026-09/e900/`, with an adjacent commit `chore(lanes): close lane e900 (shipped)`.
- AC2 — implemented. `closedLanePointerLine` and `applyClosedLanePointer` produce one HTML-comment line under `## Closed Lanes`, which is created when absent. The line never starts with `- [`.
- AC3 — implemented. `applyClosedLanePointer` filters `TASKS_MOVED_LANE_RE` lines for the lane. The regex is byte-identical to `MARKER_LANE_RE` in tools/tasks-lane-migrate.ts:405.
- AC4 — implemented (comment only). `bin/agc-init.mjs:825-831`. `checkOrphanLanes` behavior is unchanged.
- AC5 — implemented. `tools/lane-registry.ts` `readMetricsEntries` and the candidate merge. The documented limitation is in the header. Smoke: `_primary` with metrics `feat-a` and handoff `feat-b` gives `["feat-a","feat-b"]`.
- AC6 — implemented. `tools/lane-paths.ts` `resolveHistoryLaneDir` throws on a bucket outside `HISTORY_BUCKET_RE` and on an unsafe lane via `assertSafeLaneName`.
- AC8 — implemented. `tools/tasks-file.ts:131-136`. The edit is call-site-only; `path.dirname(lanesDir)` is the workspace root as the spec prescribes.
- AC9 — **partial**. The harvest happens before `removeWorktreeNoForce` on the first run. It fails the "never silently lose" intent on the re-run path (R1), and partial-failure restore is incomplete (R2).
- AC10 — implemented (no production change needed). The pointer line is an HTML comment, and `## Closed Lanes` resolves to LEGACY_LANE. QA owns the proof.
- AC11 — implemented, with the wording deviation stated below. Start writes the fork point (`runFeatureStart`, after `bootstrapLaneEnv`). `LANE_FILES` has the `baseSha` entry, with no `noFlatCounterpart`. Finish reads the file from the lane worktree before removal. Smoke: base advanced after start, and the pointer carried the start-time commit (`aaa861b…`), not the merge-base or the tip.
- AC12 — implemented. `--pr` must match `/^\d+$/`; the default is `none`; there are no network calls. The extra `--pr` + `--abandoned` usage error is a reasonable tightening.
- AC13 — implemented for scope. `git diff --stat f174d89..HEAD -- content test schema docs tasks.md` is empty. The suite is red by 12 expected re-baselines only (see Correctness / expected-red sampling). `npm run build` reproduces committed `dist/` byte-for-byte: no diff after a rebuild.

**AC11 wording deviation (for QA, stated explicitly as the integrator asked):** AC11 says only that start writes `.current/<ticket>/base-sha` in the new lane worktree. It does not say whether the file is tracked. The implementation makes it worktree-local and never committed, via a new shared info/exclude rule `/.current/**/base-sha` (`LANE_EXCLUDE_RULES`, bin/agc-init.mjs:967). Consequence: in the tracked shape, `.current/history/<bucket>/<lane>/` holds no `base-sha` file. The durable record of the fork point is the pointer line's `base_sha=` field alone. In the gitignored shape, the harvested copy does include `base-sha`, which is also ignored. I judge this consistent with AC11 and D2, for three reasons:
- D2 makes the pointer line the index, with `base_sha` as an auxiliary field.
- AC1's "holding the same files" refers to the tracked `.current/<ticket>/` merged onto base, which never contained base-sha.
- Without the exclude, `git worktree remove` (never `--force`) would refuse on the untracked file, and so would the clean-status and `--abandoned` preconditions.

## Correctness

**R1 — required — AC9 silent loss on re-run after a refused worktree removal (gitignored shape).**
- Where: `runFeatureFinish` alreadyClosed branch (bin/agc-init.mjs, around the "skipping the close writeback" message), plus the ordering of `executeLaneClose` before `removeWorktreeNoForce`.
- Repro, in a gitignored `.current/` workspace:
  1. The lane has `.current/e903/handoff.md` = `v1` and a stray untracked file.
  2. `finish --shipped` harvests `v1`, commits the pointer, then `git worktree remove` refuses. Exit 1, "worktree left in place".
  3. The operator removes the stray file. A later governance write sets `handoff.md` = `v2`.
  4. The re-run hits `alreadyClosed`, skips the whole close including the harvest, removes the worktree and deletes the branch. Exit 0.
  5. Result: the history copy is `v1` and `v2` is gone. The only output is "skipping the close writeback", which does not tell the operator that current lane state is about to be deleted unharvested.
- Why it is required: AC9 requires the copy to happen BEFORE `removeWorktreeNoForce` runs. On the re-run, the removal runs with no copy of the current contents. The first-run refusal message also invites exactly this re-run.
- Suggested fix, either or both:
  - (a) Pre-flight the lane worktree's cleanliness (`git -C <lanePath> status --porcelain`) inside the plan phase, so the removal refusal fires before any mutation.
  - (b) On `alreadyClosed` with an untracked-shape source present, re-harvest into the history dir named by the existing pointer's `history=` field. Either overwrite, or compare and refuse loudly on difference.
  - (a) is the cleaner fix, because the first run then never leaves the half-closed state.

**R2 — required — AC9 partial-failure rollback leaves the history dir behind and blocks the "safe" re-run.**
- Where: `executeLaneClose` rollback. `harvested = true` is set only after `fs.cpSync` returns, and `createdDirs` covers `dirname(histAbs)` upward but never `histAbs` itself.
- Repro: one unreadable file in the lane's `.current/e904/` makes cpSync throw EACCES. The message says "lane close not applied … (re-running finish is safe)". But `.current/history/2026-09/e904/` is left on disk (empty in my run; partially filled in general). After fixing permissions, the re-run refuses: "`.current/history/2026-09/e904 already exists` … move it aside first".
- Impact: no data loss, because the source is intact and the refusal is loud. But the restore is incomplete, which contradicts the function's own "restores every file it touched" contract and its user-facing message.
- Fix: `planLaneClose` already asserted that `histAbs` is absent. Mark the harvest as attempted before calling `cpSync`, so rollback `rmSync(histAbs, {recursive, force})` runs on any failure after that point.

**Expected-red sampling (SOP 4a).** The manifest `qa_reports/expected-red_e125b-lane-close-writeback.txt` lists 12 entries. I ran the three test files: the reds are exactly these 12 (lifecycle 1, lane-migrate 9, lane-paths 2). Sampled failure causes:
- `agc-feature-lifecycle` "AC2 proof (1)": `git log -1` is now the adjacent close commit, and the old `.current/e179a/pending-tickets.md` path has moved. Spec-mandated by AC1.
- `lane-migrate` "AC5-DEBRIS3", "RT1" and "AC2 (e125a) … refuses outright": they fail on `base-sha must not have moved` or ENOENT `.current/base-sha`. `seedAllFiveFiles` (test/lane-migrate.test.mjs:96) does not seed base-sha, while the assertions iterate `MOVABLE_FILENAMES`, which is now 8 − tasks = 7 entries. This is a seed-helper re-baseline, not a runner regression.
- `lane-paths` "REG1" counts 7 → 8. "CALLERS1": `bin/agc-init.mjs` is now a resolveLanePaths caller, which AC11 mandates ("every consumer instead calls `resolveLanePaths(ws, lane).baseShaPath`").

All sampled entries are real, locatable tests that fail for spec-mandated reasons. The claim holds.

**Review point 1 — `hasFlatLaneFiles` (tools/lane-migrate.ts:432-435) now counts flat `.current/base-sha`.** The claim is verified as narrow:
- Nothing writes base-sha flat. Start writes it lane-scoped.
- The exclude rule (`**` matches zero directories) means `git checkout` can never materialize a flat `.current/base-sha`.
- The only producer is `migrateLaneToFlat` on a lane that holds it. Smoke: `migrateLaneToFlat(L,"e902")` moved `base-sha` and `handoff.md` flat. `git status` showed flat `base-sha` as ignored, not untracked. `hasFlatLaneFiles` became true. `migrateFlatToLane` then moved both back, and base-sha was byte-identical.
- The integrator's AC11 round-trip proof therefore still holds with the exclude rule in place.
- Residual theoretical hazard: a flat base-sha whose bytes differ from an existing `.current/<lane>/base-sha` would make the forward migration refuse. This needs a manual reverse migration followed by a new start in the same worktree. It is not reachable through normal flows. No finding.

## Quality
- optional — `assertPrimaryWritable(..., what)`: when both a pending commit and a close commit are planned, the refusal names only "pending tickets are". This is cosmetic.
- recommended — A lane that never committed `.current/<ticket>/` in a workspace that does NOT ignore `.current/` takes the harvest branch, because `hasTrackedContent` is false. It then prints the advisory claiming "the source path is git-ignored in this workspace", which is false there. Consider wording it conditionally, or detecting ignore status with `git check-ignore`. A zero-write lane (only `base-sha`) always takes this branch and harvests just `base-sha`. That is harmless, but the advisory misleads.
- Naming, comments and the pure/mutating plan/execute split fit the surrounding E179 code.

## Architecture
- There is no `specs/e125b-*-architecture.md`. The layering follows the existing pattern: `tools/lane-paths.ts` owns filenames and paths (`LANE_FILES` entry, history resolvers); `bin/agc-init.mjs` owns git and fs mutation.
- Shared info/exclude side effects (review point 2): `upsertSharedExclude` is idempotent (it appends only missing rules) and runs on every `feature start`, so the rule reaches primary and every worktree of any adopter that starts a lane.
  - Effect: any path named `base-sha` under `.current/` becomes ignored repo-wide.
  - Exclude never affects already-tracked files, and no other governance file has that name. I found no harm in primary or in adopter repos.
  - Lanes started before this ticket have no base-sha and are unaffected. The rule lands on the next start.
- Ownership (review point 3): `tools/tasks-file.ts` changes only the import and the `makeForeignCheck` existence check (X7). Nothing changed under `content/**`, `test/**`, `schema/**`, `docs/**` or root `tasks.md`. `dist/**` is rebuilt and matches source.
- E125b-NEW-3 (review point 7): after a lane close, `_primary` `migratePrimaryReverse` refuses because the receipt sha no longer matches. The failure is loud, it is fail-safe (no data loss), and it sits in a file this lane does not own (`tools/tasks-lane-migrate.ts`). I agree it is correctly deferred; the integrator has escalated it to the human as a v4 placement decision. Not a blocker for this ticket.

## Security
- Pointer-line injection (review point 5):
  - `ticketId` passes the existing safe-lane validation.
  - `branch` is refused when it contains `-->`. Smoke: `feat/e905-a-->b` refused, nothing applied. Git refnames cannot hold newlines, so a single line is guaranteed.
  - `--pr` must match `/^\d+$/`. Smoke: `--pr '4 -->'` is a usage error.
  - `base_sha` is filtered by `BASE_SHA_RE` and otherwise reads as `unknown`, so a tampered base-sha file cannot inject anything.
  - `histRel` is built from validated bucket and lane values; `closed_at` is an ISO timestamp.
- Idempotency: a re-run with an existing pointer for the same ticket and branch does not append a second line (smoke: `grep -c lane_closed` = 1). But see R1 for what that skip does to the harvest.
- No secrets and no new network calls.

## Performance
No findings. `hasHistoryLedger` does one readdir plus one stat per bucket, cached per lane by `makeForeignCheck`'s `seen` map. `readMetricsEntries` is linear in the metrics file length. The finish path adds a handful of git subprocesses. There is no hot-path regression.

## Verdict
CHANGES_REQUESTED — two required AC9 harvest defects in `bin/agc-init.mjs` must be fixed before QA:
- R1: a re-run after a refused worktree removal skips the harvest and silently deletes newer lane state.
- R2: the partial-copy rollback leaves `histAbs` behind and blocks the re-run its own message calls safe.

Everything else (AC1–AC8, AC10–AC13, pointer hardening, base-sha exclude design, the expected-red manifest) is sound.

### Round 1 — sr-engineer reply (fable)

**R1: fixed. Design: re-harvest on `alreadyClosed`, option (b). The cleanliness pre-flight, option (a), was not taken.**
- What it does, in `bin/agc-init.mjs`:
  - `planLaneClose`'s `alreadyClosed` branch, which is read-only and runs before any mutation, lists the lane's `.current/<ticket>/` files using `git ls-files --others --ignored --exclude-standard`. Those are exactly the files `git worktree remove` (never `--force`) deletes without refusing; tracked edits and non-ignored untracked files already make git refuse. `base-sha` is left out because it is durable in `base_sha=`.
  - Each listed file is compared byte-for-byte with its copy under the dir that the committed pointer's `history=` field names. That field is re-validated through `resolveHistoryLaneDir`.
  - `executeHarvestRefresh` copies every missing or differing file over the history copy before `removeWorktreeNoForce`, and prints the new Copy / Strings `e125b.harvest-refresh-line`.
  - If the `history=` field does not resolve while at-risk files exist, the run refuses and removes nothing. If the listing itself fails, the run fails closed.
- Why (b) and not (a):
  - (a) covers only one way into the half-closed state: a dirty worktree. A locked worktree, or a crash between the pointer commit and the removal, still gets there. (a) also opens a gap between its check and the removal.
  - (b) guards the actual deletion step, whatever caused the earlier failure.
  - (a) would also replace git's own verbatim refusal with an agc message. That contradicts e73 AC19 ("fails with git's own error"; test `AC19: finish --shipped on a dirty worktree…`).
- Why overwriting is lossless: agc's only writer of that history dir is the harvest of this same live lane dir. A differing copy is therefore an older snapshot the lane has since superseded, so the outcome equals running a first close now. Files that exist only in the history copy are kept.
- Smokes (scratchpad, real git):
  - Your repro: `v1` then a stray file then a refusal, then `v2` plus a new `dispatch.jsonl`, then a re-run. Result: history holds `v2` plus `dispatch.jsonl`, 2 files listed, exit 0.
  - An identical re-run gives no refresh line.
  - A tampered `history=../../etc/` refuses and leaves the lane in place.
  - A tracked-shape re-run: the only ignored file is base-sha, so there is no refresh.

**R2: fixed.** `harvestStarted` is now set *before* `fs.cpSync`, so rollback `rmSync(histAbs)` runs on any failure after that point. `planLaneClose` asserted that `histAbs` was absent, so everything under it is this run's own output. Smoke: an EACCES file gives exit 1 with no `.current/history` left behind. After `chmod`, the re-run harvests and closes (exit 0).

**Non-blocking advisory wording: fixed.** The plan now records `sourceIgnored` (`git check-ignore -q -- .current/<ticket>` on primary). If it is not ignored, the reason clause reads `this lane never committed .current/<ticket>/, so there was nothing on <base> to git mv`. The spec's Copy / Strings row is updated to match. Smoked on a non-ignoring repo with a zero-write lane.

**Spec edits** (`specs/e125b-lane-close-writeback.md`):
- AC11: an "Implementation note" recording the base-sha deviation (worktree-local via info/exclude, never committed, `base_sha=` is its only durable record in the tracked shape).
- AC9: a "Re-run note" covering R1 and R2.
- Copy / Strings: the advisory row now carries `<reason>`, and there is a new row for `e125b.harvest-refresh-line`.

**Residual (not fixed, out of R1's scope):** in the tracked shape, a *first* run still drops any git-ignored file under the lane's `.current/<ticket>/` other than base-sha, as before this ticket. `git mv` moves only tracked files. This only happens when an adopter ignores individual governance files while tracking the lane dir.

Suite: 2555 tests, 2543 pass, 12 fail. The 12 fails are exactly the unchanged expected-red manifest, diffed by name. `npm run build` and `tsc --noEmit` are clean.

## Round 2 — APPROVED — by code-reviewer

covers: T-E125B-01, T-E125B-02, T-E125B-03, T-E125B-05, T-E125B-06, T-E125B-07

Diff: `git diff 7f9d061..HEAD` (fix b52a653, state 30d3920). Reviewer: opus.

### Summary
- R1 and R2 are fixed. I re-ran my own Round 1 repros against b52a653 and both now behave correctly.
- The spec edits (AC9 re-run note, AC11 implementation note, the two Copy / Strings rows) match the code byte-for-byte.
- The tracked-shape residual that sr-engineer flagged predates this ticket and does not block. I recommend filing it as a pending ticket.
- Verdict: APPROVED.

### AC Completeness
- AC9 — **implemented** (was partial):
  - First-run harvest: `executeLaneClose`.
  - Re-run re-harvest: `planLaneClose` alreadyClosed branch plus `executeHarvestRefresh`.
  - Partial-failure rollback: `harvestStarted` is set before `cpSync`.
- All other ACs are unchanged from Round 1: implemented.
- AC11 deviation: now recorded in the spec's own "Implementation note", which matches `LANE_EXCLUDE_RULES`.

### Correctness
- **R1 re-repro (dirty worktree, refused removal, later write, re-run):**
  - The re-run prints `e125b.harvest-refresh-line`, naming `.current/e903/handoff.md`.
  - The history copy is now `v2-later-write`, and there is still exactly one `lane_closed` line. Exit 0. Resolved.
- **R2 re-repro (EACCES mid-copy):**
  - Exit 1, and no `.current/history/` is left behind. `createdDirs` and `histAbs` are both removed.
  - After `chmod`, the re-run harvests, closes and exits 0, so the "re-running finish is safe" message now holds. Resolved.
- **Round 1 happy-path smokes re-run:** the tracked `git mv` with `--pr 42`, the gitignored harvest, and the fork-point `base_sha` all still behave to spec.
- **Design choice (b) re-harvest over (a) pre-flight: accepted.**
  - (b) guards the actual deletion step no matter why the first run stopped: a dirty worktree, a locked worktree, or a crash between the pointer commit and the removal. (a) covers only the dirty case and opens a gap between its check and the removal.
  - (b) keeps git's own verbatim refusal, which e73 AC19 requires.
  - Overwriting is safe: the only writer of that history dir is the harvest of the same live lane dir, and files that exist only in the history copy are kept.
  - Fail-closed behaviour: a listing failure refuses. A `history=` field that does not resolve refuses when at-risk files exist. The regex `[^/\s]+` segments plus `resolveHistoryLaneDir` re-validation reject traversal.
- **Tracked-shape residual (ignored non-base-sha files under a tracked `.current/<ticket>/` are dropped on the first run): non-blocking.**
  - This behavior predates the ticket. The worktree removal deleted those files before E125b too.
  - It only occurs when an adopter ignores individual governance files while tracking the lane dir.
  - AC1 scopes the move to the tracked contents.
  - recommended: file it as a lane pending ticket. The fix is small: on the first tracked-shape run, apply the same `laneIgnoredStateFiles` copy into `histAbs`. That would also make the first run consistent with the re-run, which already re-harvests those files.
- Suite: 2543 pass, 12 fail. The 12 fails are the unchanged expected-red set (lifecycle 1, lane-migrate 9, lane-paths 2), re-verified by name. `npm run build` leaves `dist/` unchanged. The diff touches no `content/`, `test/`, `schema/`, `docs/` or root `tasks.md`.

### Quality
- No new findings. The advisory reason clause now depends on `git check-ignore`, which resolves Round 1's recommended wording issue.
- optional (carried over): the refusal clause names only "pending tickets are" when both commits are planned.

### Architecture
No change. The new helpers stay in `bin/agc-init.mjs` and use `lanePaths` resolvers for every path.

### Security
- The `history=` field read back from `tasks.md` is re-validated before any write, and a tampered value refuses.
- No new trust boundary.

### Performance
One extra `git ls-files` and `git check-ignore` per finish, plus byte comparisons on the re-run path only. Negligible.

### Verdict
APPROVED — both required AC9 defects are fixed and re-verified by repro, and the spec edits match the code. The tracked-shape residual predates this ticket and should become a pending ticket.

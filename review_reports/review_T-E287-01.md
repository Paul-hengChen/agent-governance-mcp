# Review — T-E287-01 (batched: E287, E324, E325, E326)

covers: T-E287-01, T-E324-01, T-E325-01, T-E326-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Range reviewed: `git diff dac6069...5c334d9 -- bin/ tools/ scripts/ dist/ .current/e287/pending-tickets.md`, against `specs/e287-finish-findings-and-small-fixes.md` and `specs/e287-finish-findings-and-small-fixes-architecture.md`.

## Summary
- E287: O6 detector, preserve copy and warning, D4 `target_repo` field, archive and provenance exemption, Q5 refusal, orphan-scan change, usage text, and the lane finding are all present. Copy strings match the architecture's Copy table. Both source-slice placement constraints hold.
- E324, E325 and E326 are small and correct against their ACs. `npm run build` on HEAD produces no dist diff.
- One required defect in E287. A `--shipped` re-run after a late failure is now refused permanently whenever the lane's `pending-tickets.md` was committed (the plain E179 path). At base the same re-run succeeds. This breaks AC-E287-4 (idempotent re-run unchanged) and AC-E287-8 (a re-run never errors).
- Verdict: CHANGES_REQUESTED.

## AC Completeness
- AC-E287-1 — implemented — `bin/agc-init.mjs` `readUnallocatedFindings` / `executeFindingsPreserve` / `formatUnallocatedWarning`; wired in `runFeatureFinish` (--shipped). Smoke: ignored `.current/` → exit 0, warning on stderr, no allocate commit.
- AC-E287-2 — implemented — same helpers on the --abandoned branch of `runFeatureFinish`. Smoke: exit 0, branch kept, warning present.
- AC-E287-3 — implemented — the history copy is verified byte-identical before the warning names it. Smoke: tracked-dir / ignored-file shape, both verbs → the named history file exists and is byte-identical.
- AC-E287-4 — **partial** — the existing owned suites pass (221/221 across lifecycle, finish-history, e213, e180, e298, e246, lane-ticket-allocation, e303, e312, e320, drift-*). But the E179 idempotent re-run regresses (Correctness R1).
- AC-E287-5 — implemented — `tools/lane-ticket-allocation.ts` `validateBlock` `target_repo` check plus the `entry.targetRepo` set.
- AC-E287-6 — implemented — `planPendingApply` external split, plus `printTargetRepoListing` after `commitPendingOnShipped` / `applyPendingOnAbandoned`. Smoke (abandoned, mixed): one `E11` row and the listing line.
- AC-E287-7 — implemented — `rels` / restore list are conditioned on `backlogPresent` / `allocated`. Smoke, shipped and abandoned with no backlog: exit 0 (shipped up to the worktree-remove step), no `docs/backlog.md` created, `chore(lane): archive lane … target_repo finding(s)` on --shipped, archive only on the branch for --abandoned.
- AC-E287-8 — **partial** — the orphan scan is correct (smoke: an external-only live branch gets no warning, a local-only one does). The re-run clause fails: the AC's own proof shape (forced late failure, then re-run) errors. See R1.
- AC-E287-9 — implemented — the warning shows `[target_repo: <repo> — …]` per external entry (smoke output).
- AC-E287-10 — implemented — `STR_USAGE_FEATURE` text matches the architecture verbatim. `.current/e287/pending-tickets.md` matches the architecture's block verbatim.
- AC-E324-1 — implemented — `tools/registry.ts` `emitZodGateTelemetry`: `path.resolve` plus a whole-segment `.current` test.
- AC-E324-2 — implemented — the segment test runs on the normalized path. `my.current-ws` is not a segment match, and `<ws>/.current/..` normalizes to `<ws>`.
- AC-E324-3 — implemented — `dist/tools/registry.*` was rebuilt, and the rebuild is clean.
- AC-E325-1 — implemented — `tools/drift.ts` `readArtifactVersion`: a one-shot re-read of the other layout, in both directions, through `readFileIfPresent` (ENOENT/ENOTDIR → null).
- AC-E325-2 — implemented — neither file present → null. Other errors propagate to the outer catch (null). No frontmatter → 0.
- AC-E325-3 — implemented — `tools/handoff-parse.ts` is not in the diff.
- AC-E325-4 — implemented — dist was rebuilt, and drift-* tests are green.
- AC-E326-1 — implemented — `scripts/verify-release.mjs`: a branch-scoped `[]` now flows into the poll loop, with its own progress line.
- AC-E326-2 — implemented — at budget end, `warn()` gives the unchanged reason `no completed CI runs found on <label>`, so strict mode FAILs. With budget 0 there is exactly one call.
- AC-E326-3 — implemented — lenient mode prints the same `warn()` text, byte-identical.
- AC-E326-4 — implemented — the `byCommit` branches are untouched, and e320 is green.
- AC-E326-5 — implemented — spawn error, non-zero exit, unparseable output and non-array JSON all still degrade on the first call.
- AC-E326-6 — implemented (source side) — VR-22 and VR-23 are not touched by this diff. Their pass lines are qa's to quote.
- AC-E326-7 — implemented (option A, human ruling) — one rule in the shared evaluator. VR-15 now waits out the default 480 s budget. This is expected under option A, and qa owns the one-line budget pin. It is not a code defect.
- AC-LANE-1..3 — qa scope. The diff touches only owned paths.

## Correctness

**R1 — required — `bin/agc-init.mjs` `readUnallocatedFindings` (≈:2200–2219) together with the `--shipped` wiring (≈:3131–3140): the O6 detector misfires on the alreadyClosed re-run of a lane whose `pending-tickets.md` was committed.**

How it fails, step by step:
1. A lane commits `.current/<lane>/pending-tickets.md` (normal E179 shape) and is merged.
2. `finish --shipped` runs:
   - `commitPendingOnShipped` allocates the entries and archives them on `--base`.
   - `executeLaneClose` sees a tracked lane dir and does `git mv .current/<lane>/ -> .current/history/<bucket>/<lane>/`.
   - `git worktree remove` then refuses, for example because of an untracked file in the worktree. This is exactly AC-E287-8's "forced late failure".
3. The operator fixes the blocker and re-runs. The file is no longer at `<base>:.current/<lane>/pending-tickets.md`, because it was moved, so `git cat-file -e` fails. The worktree still holds the lane's own unarchived copy, so `readUnallocatedFindings` returns its entries as "unallocated".
4. The target is the pointer's history dir. That dir already holds the archived (different) version, so `planFindingsPreserve` refuses with e287.preserve-differs-refuse. Every re-run refuses the same way.
5. If the operator follows the message and moves the history file aside, the next run writes the stale unarchived copy into history. It then prints a warning saying the findings "were not allocated ids", which is false: they got E-ids on the first run.

Reproduced (ad-hoc smoke in $TMPDIR, the same fixture against HEAD and against a `git archive dac6069` snapshot):
- HEAD re-run: exit 1, `agc feature finish --shipped: .current/history/2026-10/e9/pending-tickets.md already exists in the primary checkout and differs from the lane's .current/e9/pending-tickets.md (1 unallocated finding(s)) — move it aside first (nothing applied, nothing removed)`. The worktree stays.
- Base re-run: exit 0. It prints "already recorded … skipping the close writeback", removes the worktree and deletes the branch.

The same failure happens with external-only (`target_repo`) committed files. That is AC-E287-8's own scenario.

The architecture's *Re-run / idempotency* section did not anticipate this: its O6 rule keys only on `<rev>:<pendingRel>`, and the first run's `git mv` moves that path. So this is an architecture gap that the implementation inherited faithfully. It still blocks.

Suggested fix, sr's choice, and either one keeps the O6/E179 mutual exclusion:
- (a) On `--shipped`, also treat the file as committed when `git cat-file -e refs/heads/<branch>:<pendingRel>` succeeds. The ancestor guard has already proven the branch is merged into `--base`, so anything committed there went through the E179 path at merge time.
- (b) On the alreadyClosed re-run, also probe `<base>:<close.hist.histRel>/<filename>`.

Option (a) is more general. It also covers a base that later dropped the file for any other reason. Either way, add an explicit regression case to qa's T-E287-02 list: a committed pending file, a forced late failure, then a re-run that exits 0 with no warning.

**R2 — optional — `bin/agc-init.mjs` `commitPendingOnShipped`, the `failMessage` argument.** The external-only, no-backlog commit (rels = `[pendingRel]`) still reports `docs/backlog.md and <pendingRel> restored` if the commit fails, but nothing was done to the backlog. This only touches wording on a failure path.

**R3 — optional — `executeFindingsPreserve`, covered case with a symlinked lane `pending-tickets.md`.** `readUnallocatedFindings` follows the link (`statSync`, which is what the architecture specifies). But the E194 / lane-close harvest `cpSync` copies the link as a link, so the lstat post-check fails with reason "a different file is already there". The refresh copies the link again on every re-run, so "re-running finish is safe" never converges. The fail-closed outcome is what the architecture's "Truthful destination" DR accepts. Only the reason text is misleading. Note it for a follow-up if wanted.

Judgement on the three sr-flagged deviations:
1. `newPendingText` also passes external `laneLocalId`s to `markApplied`. **Accepted.** Q4 requires the archive, and `markApplied` only moves the ids it is given, so this line is the mechanism Q4 implies. Abandoned smoke: the branch commit is `chore(lane): mark e9 pending tickets applied (E11, X1 (target_repo))`.
2. `displayField` is applied to `laneLocalId` too. **Accepted.** The output is identical for valid ids, and the change only adds defence.
3. The post-check also runs after a fresh `wx` write. **Accepted.** The architecture says "only once dst is a byte-identical regular file: print". Checking unconditionally is the stricter reading. The reused reason text is reachable only under a concurrent writer (optional wording nit, same class as R3).

## Quality
- No dead code. The helper names match the architecture. The E287 block sits in its own banner section directly after `commitPendingOnShipped`, as specified.
- Comment check (4b): the added comments carry ticket ids and rationale only. They contain no sensitive or host-specific content. The `checkOrphanLanes` comment does not contain the forbidden word (slice check: 0 occurrences).
- `formatUnallocatedWarning` is the single composer, as the architecture requires.

## Architecture
- The implementation matches the architecture's changed-function list, helper contracts, wiring order (every O6 refusal runs before `assertPrimaryWritable` and the first mutation) and Copy table, and the shared `now` hoist. Placement constraints:
  - `checkOrphanLanes` slice: clean.
  - Nothing new between `deleteRemoteLaneBranch` and `runFeatureFinish`: no diff hunk in that range.
- DR-8 is kept as approved. The smoke confirms it: no orphan warning for a live external-only branch, and the warning still fires for a local-only one.
- R1 is an architecture omission in *Re-run / idempotency*, not an sr deviation. The fix is local to the O6 detector and needs no architecture re-open, as long as sr records the added probe in a pending note.

## Security
No findings. New git invocations use argv arrays (`gitTry`) and add no shell. Free-text fields pass through `displayField` → `escapeSegmentForDisplay` before stderr. The history destination is derived through `lanePaths.resolveHistoryLaneDir` (validated) and written `wx`. E324 tightens the existing path boundary.

## Performance
No findings. Each finish run adds one `git cat-file -e` and one small file read. E326 adds no new loop, only the existing bounded poll with the same budget. E325 adds at most one extra `existsSync` and read on a miss.

## Verdict
CHANGES_REQUESTED — R1 is a required regression: a `--shipped` re-run after a late failure, for any lane with a committed `pending-tickets.md` and a tracked lane dir, is refused permanently (base: exit 0). This violates AC-E287-4 and AC-E287-8. Everything else is approved as is.

Evidence: dist rebuild clean on HEAD; 221/221 on the targeted existing suites; ad-hoc smokes s1–s10 (O6 both verbs, tracked-dir, differs refusal, D4 external-only and mixed both verbs, Q5 refusal, orphan scan, HEAD vs base re-run comparison), run in throwaway `$TMPDIR` repos and not committed.

### sr-engineer reply — Round 1

- **R1: fixed with option (a).** `readUnallocatedFindings` now takes `revs` (an array) in place of `rev`, and returns null when `<pendingRel>` exists at any of them. `--shipped` passes `[base, refs/heads/<branch>]`. The merge guard has already proved the branch is contained in `--base`, so a file committed on the branch went the E179 path at merge time. That holds even when `--base` no longer has it at `<pendingRel>`, for example when the first run's lane close moved it into history. `--abandoned` passes `[refs/heads/<branch>]` and is unchanged. The O6/E179 mutual exclusion is kept: a file that was never committed is in neither rev and still warns. I chose (a) over (b) because it is the more general fix (it also covers a base that dropped the file for any other reason). It also needs no new dependency on the lane-close plan's `hist` inside the detector. (b) is not needed on top: on the re-run, the branch still exists until `git branch -d`, which runs after the worktree is removed.
  - Repro on 8672061, in a throwaway `$TMPDIR` repo using the reviewer's s8/s5 fixtures: re-run → exit 1 `e287.preserve-differs-refuse`.
  - After the fix: s8 (local, committed, forced late failure) re-run → exit 0, no warning, worktree removed, branch deleted. s5 (target_repo-only, no backlog, committed) re-run → exit 0, no warning.
  - New s11 (never-committed file under ignored `.current/`, forced late failure): first run warns and keeps the byte-identical copy. The re-run warns again and exits 0. It converges because the destination is already byte-identical.
  - s1/s2/s3/s3a (AC-E287-1/2/3, both verbs) still warn, and the history copy is byte-identical. s4 differs-refusal unchanged. s9/s10 unchanged.
- **R2: fixed.** The `commitPendingOnShipped` failure message names `docs/backlog.md` only when the commit's `rels` include it. String change, on the external-only no-backlog path only: `agc feature finish --shipped: git commit on <base> failed — <pendingRel> restored; nothing applied, nothing removed`. Every other path's text is byte-identical to before. Smoke s12 (pre-commit hook rejects) prints the new text, and no backlog is created.
- **R3: deferred, no change.** Making a symlinked lane `pending-tickets.md` converge means either changing the E194/E125b harvest to dereference links, or adding a new plan-time refusal (a new Copy string plus an architecture decision). Both are outside R1–R3's wording scope. The fail-closed outcome is what the "Truthful destination" DR accepts. Suggest filing it as a follow-up.
- Copy table: no Copy-table string changed. Q1–Q6 / DR-8 untouched. The only string change is the R2 one above (a pre-existing E179 failMessage, now conditional).
- Evidence: 221/221 on the targeted existing suites (finish-history, lifecycle, e180, e213, e246, e298, lane-ticket-allocation, e303, e312, e320, drift-*). `tools/` is untouched, so there was no dist rebuild.

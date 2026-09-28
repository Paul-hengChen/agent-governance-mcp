# Review — T-E126-01 (batched round: e126-merge-invariants)

covers: T-E126-01, T-E126-02, T-E126-03, T-E126-04

## Round 1 — APPROVED — by code-reviewer

Diff: `git diff adfab53..HEAD` (eed6689 T-E126-01..03, 460685d T-E126-04). Contract: `specs/e126-merge-invariants.md`. Its `## Task → AC Coverage` table is treated as authoritative. No architecture spec exists. Reviewer tier: opus. The sr-engineer tier was fable, so this is not a same-model review.

## Summary
- Adds `tools/merge-invariants.ts` (570 lines). It covers the git-tree read layer, row presence, `[x]` preservation, sidecar-count invariants, the compaction exemption (a)–(d), the report, and argv parsing. Also adds a thin shell, `scripts/merge-invariants.mjs`, which has zero logic.
- T-E126-04 adds two entries to `BOOKKEEPING_PATH_RES` in `scripts/verify-release.mjs` (`_primary` literal + lane-scoped `tasks.md`). Nothing else in that file changes.
- Only owned files changed. `dist/tools/merge-invariants.*` is byte-identical to a fresh `tsc` build, `tsc --noEmit` is clean, the code has no `any`, and `test/**` is untouched.
- I re-ran the sr sanity checks myself. `ed7432f` gives exit 0 with 946 ids: 29 present, 917 COMPACTED, 0 MISSING, 0 LOST_DONE, 0 sidecar shortfalls. `165b72d` gives exit 2 ("1 parent(s)").
- Verdict: APPROVED. No required findings. One recommended finding is a spec-level gap in (c) that should go to the integrator/PM (see Correctness R-1).

## AC Completeness
AC1 — implemented — tools/merge-invariants.ts:363-379 (whole-tree identity by task_id; MISSING lists parent occurrences, the merge files checked, and one `not compacted:` reason per occurrence); fixture verified.
AC2 — implemented — tools/merge-invariants.ts:380-383 (a `[x]` at either parent needs an `[x]` somewhere at the merge; COMPACTED is exempt; `[x]`→`[-]` counts as LOST_DONE, which matches the spec's "must be `[x]`"); fixture verified.
AC3 — implemented — tools/merge-invariants.ts:386-404 (keys = P1 ∪ P2 ∪ base; `merge < p1 + p2 − base`; all three counts printed); byte-prefix dedup at :239-267 matches `enumerateLaneSidecarSources` (lane-paths.ts:478-529) rule for rule. Fixture: history copy that is a prefix of live is skipped (base = 2, not 3), and the shortfall is reported as `merge=3 < 3+3-2 = 4`.
AC4 — implemented — tools/merge-invariants.ts:90-96 (`isLedgerPath` enumerates root, `_primary`, `.current/<lane>/`, and `.current/history/<bucket>/<lane>/` using imported predicates); presence ignores the path.
AC5 — implemented — tools/merge-invariants.ts:419-466 (one line per MISSING / LOST_DONE / SIDECAR_SHORTFALL, then a RESULT line with a per-kind tally; exit 1).
AC6 — implemented — tools/merge-invariants.ts:507-513. Verified for 0 parents (root commit), 1 parent (`165b72d`), and 3 parents (octopus fixture): all exit 2 and the message names the actual parent count.
AC7 — implemented — tools/merge-invariants.ts:515-523; unrelated-histories fixture gives exit 3 with a distinct message.
AC8 — implemented — tools/merge-invariants.ts:459-461; clean-merge fixture and `ed7432f` give exit 0 with the "all three invariants held" line.
AC9 — implemented — tools/merge-invariants.ts:486-500. `bogus-ref-xyz`, a non-repo dir, `--ref -x`, `--ref` with no value, and unknown options all give exit 4 with usage and no stack trace.
AC10 — implemented — scripts/verify-release.mjs:259-265; `test/verify-release.test.mjs` 59/59. The regex reuses `LANE_SEGMENT_RE_SRC`, so `history/` and `archive/` stay excluded.
AC11 — implemented — tools/merge-invariants.ts:322-343. I checked all three counter-examples against fixtures:
  (i) An open row under a manifest-named section gives MISSING with reason `(a)`.
  (ii) With an under-counting manifest, every un-found row of S is listed individually. In my fixture that was T-S-01/02/03, including a row under a duplicate `## Sec A` heading, each with reason `(c)`. The open T-S-04 was listed with reason `(a)`. Nothing was aggregated.
  (iii) Recycled "Active": a `[x]` row at a parent whose own `tasks.md` already carries `- Active:` gives MISSING with reason `(d)` and exit 1.
  `ed7432f` reconciles to 917 COMPACTED.

## Correctness
- **(d) recycled-section guard — correct.** :339 tests the manifest of `parentSnap`, the snapshot of the parent where this occurrence was found (P_row), in the same file F. That matches the spec's R1 wording. Evaluation is strict (:370-378): every parent occurrence must qualify. So a row present at both parents cannot be laundered by the parent that is eligible.
- **R2 — correct.** The (c) predicate depends only on (P_row, F, S), so it evaluates the same way for every closed row of S at that parent. Once (c) fails, every un-found row of S is listed by task_id. Open rows are listed too, under (a).
- **Manifest recognition — correct.** :148-156 recognises the manifest only when the first non-blank line after `## Compacted History` matches `<!-- compacted:`. A prose line first disarms it (verified: result is MISSING with reason `(b)`). Blank lines before the marker are tolerated (verified). Duplicate bullets and duplicate manifest sections are summed (:160-161). Duplicate H2 row sections are summed by `sectionCounts` (:311-319), so the counts are symmetric.
- **(b) is file-scoped — correct.** :330 looks up the manifest in `merge.ledgers.get(occ.file)`. A manifest in `tasks.md` naming "Sec A" did not cover a `.current/_primary/tasks.md` row under the same section name (verified: reason `(b)`).
- **R-1 (recommended, spec-level; escalate to integrator/PM):** (c) compares the manifest against ONE parent's count (P_row), as the spec literally says ("rows F held under section S at PARENT"). It never compares against the distinct closed ids of F§S across both parents. The gap shows up when a merge compacts S itself (neither parent has the manifest, so (d) holds) and both sides added different rows to S. Fixture: base had 3 `[x]` in `## Active`, main added T-A-04, side added T-A-05, and the merge replaced S with `- Active: 4 done, 0 voided`. Result: 5 COMPACTED, exit 0, although the manifest accounts for only 4 of 5 distinct rows, so one row is silently lost. This is the under-count shape that (c) exists to catch. The implementation is spec-literal: the spec says COMPACTED "iff" (a)–(d), so tightening it here would contradict the approved text. Not blocking. Suggested amendment: in (c), compare the manifest against the count of distinct task_ids that are closed under F§S at either parent. `ed7432f` stays green under that rule, because P1 = merge-base holds all 917 rows and P2 holds none under those sections.
- **R-2 (recommended):** `parseLedger` (:140-170) matches the task regex against the raw line. `tools/tasks-file.ts:216` / `:703` match against `line.trim()`, and the `config.ts` header says "matched against trimmed line". An indented checkbox row is therefore invisible to all three invariants: it is never checked, and a row indented on only one side reads as a false MISSING. Live ledgers today are unindented, so there is no current impact. A one-line fix is to apply `.trim()` before the void-prefix test and the exec.
- Sidecar math, the dedup order (live, then history-vs-live-same-lane, then flat-vs-any-counted), and empty-file handling all mirror lane-paths.ts. The flat→lane flip false shortfall is spec Out of Scope, as sr noted.
- Expected-red sampling (SOP 4a): `qa_reports/expected-red_e126-merge-invariants.txt` has 1 entry (fewer than 3, so I sampled all of it). `test/lane-paths.test.mjs:358` "CALLERS2 (allow-list) …" exists and is the only failure in that file (59 pass / 1 fail). This is a legitimate red caused by the spec-mandated new importer. T-E126-05 owns the fix.

## Quality
- **Q-1 (recommended):** the COMPACTED breakdown (:447-457) counts *occurrences* (parent × file) but the header says "N row(s)". When both parents hold the same row, the section count is doubled. Fixture: header says 5 rows, `tasks.md § Active: 8`. On `ed7432f` it happens to sum correctly because P1 is the merge-base and P2 holds no summarized rows. Dedup by (taskId, file, section) so the breakdown sums to the header, which is what the spec's "917 rows compacted — see file:section breakdown" intends.
- **Q-2 (optional):** `--help` exits 4 (USAGE_ERROR) and prints to stderr. The spec does not define `--help`, so this is defensible. Exit 0 on explicit help is the usual CLI convention.
- **Q-3 (optional):** the line 21 comment says "exit-code table (spec T-E126-02)". The spec does not define the numeric values. The code is self-consistent with its own usage string.
- Naming, section banners per task, and the reuse-by-import of `isSafeLaneName`, `NON_LANE_DIRS`, `HISTORY_BUCKET_RE`, `isBytePrefix`, `resolveTaskRegex`, and `SECTION_HEADING_RE` all match the spec's Dependencies. Nothing is restated.

## Architecture
- There is no architecture spec. The structure follows the spec's suggested layering: a read layer (ls-tree/cat-file, never the working tree), then evaluate, then render, then a `runMergeInvariants` that never throws, then argv parsing. `scripts/merge-invariants.mjs` only wires argv, prints, and exits, mirroring the `join-precondition.mjs` pattern.
- Only in-bounds files changed. No `content/**`, `bin/**`, `docs/**`, `test/**`, `tools/join-precondition.ts`, or git-hook wiring.
- One minor note: `resolveTaskRegex(repoRoot)` reads the working-tree `.current/.config.json`, not each commit's config. That is acceptable for a same-repo check and makes no difference with the default regex.

## Security
- All git calls use `execFileSync("git", argv)` with no shell (:81-87).
- A ref starting with `-` is rejected before any git call (:487). The CLI rejects unknown `-`-prefixed options (verified with `--upload-pack=...`, which gives exit 4). The ref reaches git only as `rev-parse --verify --quiet <ref>^{commit}`, and after that only resolved SHAs are passed.
- The tool is read-only: it performs no writes and no git state changes. There are no secrets. `maxBuffer` is 512 MiB, which is generous but bounded.

## Performance
- 4 × `ls-tree -r -z`, plus one `cat-file` per distinct ledger/sidecar blob, with a cache shared across the 4 snapshots. The real `ed7432f` run takes about 0.8s wall time.
- `dedupSidecars` is O(files²) per kind only in the flat-vs-counted step, and there is at most one flat file per kind. No hot path is involved, and existing code sees no regression.

## Verdict
APPROVED — AC1–AC11 are all implemented and verified against the real `ed7432f` merge and adversarial fixtures, including (d) recycled-Active, R2 per-row listing, file-scoped (b), marker recognition, octopus, root, unrelated histories, and injection. There are no required findings. R-1 (a union-count gap in (c)) is spec-literal and goes to the integrator/PM as a possible spec amendment. R-2, Q-1, and the optional items do not block.

## Round 2 — APPROVED — by code-reviewer

Scope: delta only, `git diff 09707cd..d0eaa65` (tools/merge-invariants.ts + dist, deletion of qa_reports/expected-red_e126-merge-invariants.txt), judged against the human-approved spec amendment e405de8. Reviewer tier: opus. Builder tier: fable, so the models differ.

### Summary
- R-1: condition (c) now checks a union U per file/section (`unionReconciliationFailures`, tools/merge-invariants.ts:338-373). (a), (b) and (d) moved into `perParentIneligibility` (:318-329). A (d)-barred parent contributes nothing to U. Check order is now (a)->(b)->(d)->(c).
- R-2: `parseLedger` now applies `line.trim()` before `VOID_PREFIX_RE` and the task regex (:165-170). Heading detection still runs on the raw line.
- Q-1: the COMPACTED breakdown adds 1 per distinct task_id per `file § section` (:492-494).
- Verdict: APPROVED. The delta implements the amended spec as written. One recommended finding (R2-1) is a spec-level false positive that fails loudly, and it predates this delta.

### AC Completeness
- AC11 (amended (c) union, counter-example iv): implemented at tools/merge-invariants.ts:338-385. The 5-vs-4 fixture test passes.
- AC11 (ii) "every row of U not found at merge is MISSING by task_id": implemented. `compactionIneligibility` returns the per-F/S union failure for every occurrence under a failing key, so each un-found id is reported individually (:376-385, :410-419).
- R-2 trim alignment: implemented, and it follows the same rule. tasks-file.ts:209 matches `SECTION_HEADING_RE` on the raw line and :216 applies `line.trim()` before `parseTaskLine`. :703 is also `line.trim()`. merge-invariants does the same thing (:142 raw heading, :168 trim). `\r` is stripped first, and trim() would remove it anyway.
- Q-1 dedup: implemented at :492-494.
- All other ACs are unchanged since round 1.

### Correctness
Integrator focus cases, traced through the code:
- Row X in both parents, P2 (d)-barred and P1 not. P1's occurrence goes into U. P2's occurrence returns a (d) reason, and the strict every-occurrence rule (:410-414) then makes X MISSING. That result is right. P2 holding X under a section its own manifest already names means X was added or kept after P2's compaction, so dropping X loses it from P2's view. P2's other rows under S never enter U, as the spec requires.
- `[x]` in one parent and `[-]` in the other. `ids.get(taskId) !== "x"` means done wins whatever order the occurrences arrive in. Each id counts once in U, as done or as voided, never both. If the compacting side voided X and main completed it concurrently, U counts X as done against a manifest done count that excludes it, so X is MISSING/LOST_DONE. That is a real divergence and it should fail loudly.
- **R2-1 (recommended, spec-level, fails loudly, predates this delta). U includes rows that are still present at the merge, and this gives false MISSING on a merge that loses nothing.** Reproduced read-only in `$TMPDIR/e126cr2.*`:
  - Base has `## Wave` with T-A-01..03 `[x]`.
  - The lane compacts Wave (manifest `Wave: 3 done, 0 voided`).
  - Main concurrently adds `- [x] T-D-01` under `## Wave`.
  - The merge keeps T-D-01 literally under `## Wave` plus the manifest.
  - Result: U = {A1, A2, A3, D1} = 4 done > 3, so T-A-01..03 are reported MISSING and LOST_DONE, exit 1. Nothing was lost.

  The manifest can only vouch for rows it removed. A row present at the merge is already proven by identity, so counting it in U adds no detection power and only creates false failures. Excluding task_ids present at the merge from U does not weaken any counter-example: in (iv) all 5 rows are dropped, so U is unchanged.

  Realism: `Active` is `tw_add_task`'s default section and was the largest compacted section in ed7432f (438 rows). So a lane compacting `Active` while main closes a row under `Active` is plausible. It has not happened yet in real history: the 25 most recent primary merges (ed7432f back to e784a3b), run read-only with `node scripts/merge-invariants.mjs <sha> <repo-root>`, all exit 0 with 0 MISSING, 0 LOST_DONE and 0 sidecar shortfalls. ed7432f still reports 917 COMPACTED.

  This is not a delta regression. Round 1's per-parent `sectionCounts` also counted every `[x]`/`[-]` row under S at the parent, present or not, and I missed it in round 1. The implementation follows the amended spec's literal definition ("EVERY row of U not found at the merge" presumes U can contain found rows). The fix therefore needs a PM/human spec amendment first: restrict U to closed task_ids absent from the merge. It should not be done as an unapproved code change. Suggested follow-up ticket: E126-NEW-2.
- No other correctness findings. `split("\0")` on the F/S key is safe because paths and headings cannot contain NUL. The `if (!entry) continue` at :357 is unreachable, as its comment says.

### Quality
- Optional: `perParentIneligibility` is evaluated twice per occurrence, once in the union pass and once in `compactionIneligibility`. It is cheap and clear, so no change is needed.
- Optional: the `ref.section === null ||` guard at :344 is redundant with (b), but TypeScript needs it for narrowing. Fine as is.
- dist is in sync: a fresh `tsc --outDir $TMPDIR/...` build gives byte-identical `tools/merge-invariants.js`.

### Architecture
No layering change. The check stays pure over `CommitSnapshot`s, and git I/O stays in the scripts shell. Removing the expected-red manifest is correct: the test file is fully green and none of its tests are meant to fail.

### Security
No findings. No new input surface, and no shell or regex built from untrusted data.

### Performance
No findings. The union pass is O(total occurrences) using Map/Set. The Q-1 Set is per compacted id. No regression from the base.

### Verification (run by reviewer)
- `node --test test/e126-merge-invariants.test.mjs`: 16/16 pass.
- `tsc` exit 0, and dist matches the fresh build.
- `node scripts/merge-invariants.mjs ed7432f <repo-root>`: exit 0, 946 ids, 29 present, 917 COMPACTED, 0 MISSING, 0 LOST_DONE.
- 24 earlier merges: all exit 0.
- `fe2d688`: exit 2 (not a merge).
- R2-1 fixture: exit 1 with 3 false MISSING (above).

### Verdict
APPROVED. The delta correctly implements the amended (c) union, the per-parent (d), the R-2 trim and the Q-1 dedup, and all tests are green. R2-1 is a spec-level false positive that fails loudly and predates this delta. It is routed to the integrator/PM for a spec amendment and does not block this round.

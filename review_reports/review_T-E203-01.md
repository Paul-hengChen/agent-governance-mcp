# Review — T-E203-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- `tools/merge-invariants.ts` `unionReconciliationFailures` now skips every `task_id` that has any row at the merge (`merge.rowsById`, the whole-tree identity search) before building `U`; the (c) reason text follows the `merge.c.reason` copy row; `dist/tools/merge-invariants.*` rebuilt (commit 6131677). The spec amendment (b0f115f) precedes it on the branch.
- The code implements the amended (c) paragraph exactly, and all three verification points pass (probed in scratch git repos, below).
- It also opens a silent false PASS that the pre-change code caught: a merge that keeps one row the manifest counted and drops a new row the other side added reports the dropped row COMPACTED, exit 0. The amended spec's claim that counting a kept row "adds no detection, only a false MISSING" is false for this case.
- `npm run build` reproduces the committed `dist/` byte for byte; `test/e126-merge-invariants.test.mjs` is green unchanged.
- Verdict: CHANGES_REQUESTED (one required finding; the fix needs the (c) paragraph re-amended first, so the route runs through PM).

## AC Completeness
AC-E203-0 — implemented — `specs/e126-merge-invariants.md:107-108` ("does NOT find anywhere at MERGE"); amendment b0f115f precedes 6131677.
AC-E203-1 — implemented — probe "repro, merge keeps T-D-01": PASS, MISSING and LOST_DONE empty, COMPACTED = T-A-01..03. Test pin is T-E203-02.
AC-E203-2 — implemented — `node --test test/e126-merge-invariants.test.mjs` green, including the R-1 5-vs-4 case unchanged.
AC-E203-3 — implemented — probe "merge drops T-D-01": FAIL, MISSING = T-A-01, T-A-02, T-A-03, T-D-01, each with the `(c) manifest under-reconciles` reason.
AC-E203-4 — implemented — probe "under-count 2, merge keeps T-D-01": FAIL, MISSING = exactly T-A-01..03.
AC-E203-5 — implemented — e126 green; `npm run build` then `git status --porcelain -- dist/` prints nothing.

## Correctness
- **required** — `tools/merge-invariants.ts:340` (spec `specs/e126-merge-invariants.md:107-117`): dropping every kept `task_id` from `U` lets a row the manifest counted, but which the merge kept, leave a free slot in the manifest count that a genuinely lost row then fills. Repro, using the spec's own fixture: base and parent2-before-compaction hold `## Wave` T-A-01..03 `[x]`; parent2 compacts to `- Wave: 3 done, 0 voided`; parent1 keeps the three and adds `- [x] T-D-01`; the merge holds the manifest plus `## Wave` / `- [x] T-A-03` and drops T-D-01.
  - At 4b25061 (pre-change logic): `FAIL`, MISSING = T-A-01, T-A-02, T-D-01 (U = 4 > 3).
  - At HEAD: `PASS`, COMPACTED = T-A-01, T-A-02, T-D-01, LOST_DONE empty. T-D-01 was never compacted by anyone; it is a lost `[x]` row reported as summarized. That is the silent-loss class R-1 was added to close, and the E203 backlog row's own bar was "loud, never a silent pass".
  - The amendment states "a closed row the merge still holds … counting it in `U` adds no detection". It does add detection: a kept row that the manifest counted is exactly what made `U` exceed N here. AC-E203-4's "a row the merge keeps neither counts toward `U` nor absorbs the manifest's shortfall" does not hold in this case — T-A-03 absorbs it.
  - The spec defines `U` this way, so sr-engineer cannot fix this in code alone: PM re-amends (c), then sr follows. One candidate rule for PM to weigh (verified by hand against all five fixtures in this review: the E203 repro, the dropped row, the under-count, the R-1 5-vs-4, and the case above): a kept row leaves `U` only when its `task_id` is absent from F/S at the merge-base, since rows present at the base are the ones the compacting side's manifest counted. Known residual of that rule: a row the compacting side added after the base, counted in its manifest, and that the merge then restores still frees a slot. Either cover that or record it as an accepted limit in the spec. The verification points then need a fourth case: merge keeps a compacted row and drops the new row → FAIL, the new row MISSING.
  - Probe script (scratch, not committed): builds the four commits with `git commit-tree` the way `test/e126-merge-invariants.test.mjs`'s `mkMergeFixture` does and calls `runMergeInvariants`; results above for both HEAD `dist/` and a copy with the new `continue` removed.

## Quality
- recommended — `tools/merge-invariants.ts:324-333`: the doc block grew from 5 to 8 body lines and now trips `agc check — comments: tools/merge-invariants.ts:324 long-block 8 lines (limit 7)`, a warning this diff introduced. Trim it: the `(E203: …)` parenthetical restates rationale that belongs in the spec (c) paragraph, which already carries it. Sent back rather than kept.
- The new reason string matches the `merge.c.reason` copy row verbatim and keeps the `(c) manifest under-reconciles` prefix the e126 tests match.

## Architecture
No architecture spec. The change is a single-line filter inside the existing (c) union builder; layering unchanged; `scripts/merge-invariants.mjs` untouched as the Out of Scope list requires.

## Security
No findings. Reads committed git objects only; no new input surface.

## Performance
No findings. One Map lookup per `task_id` before the existing occurrence loop; it reduces work, never adds a pass.

## Verdict
CHANGES_REQUESTED — the code matches the amended spec, but that amendment turns a detected loss (merge keeps a compacted row and drops a new row) into a silent PASS with the lost row reported COMPACTED; (c) needs re-amending, then the code follows.

## Round 2 — APPROVED — by code-reviewer

covers: T-E203-01, T-E406-01

## Summary
- Re-reviewed `git diff 4be9bfa HEAD -- tools/ dist/ specs/`: PM re-amended the (c) paragraph of `specs/e126-merge-invariants.md` and `specs/e406-release-and-merge-scripts.md` (9c316e0, new AC-E203-6/-7, known-limit text); sr rework d7afad5 changes `tools/merge-invariants.ts` `unionReconciliationFailures` plus the rebuilt `dist/tools/merge-invariants.*`.
- The code implements the re-amended rule exactly: a closed `task_id` not found at the merge always enters `U`; a kept one enters only when (i) `base.rowsById` has it under the same file and section AND (ii) no parent whose own copy of F has a manifest naming S holds it anywhere in its tree (`tools/merge-invariants.ts:341-350`).
- The round-1 required finding is closed: the round-1 repro (merge keeps T-A-03, drops T-D-01) now FAILs with T-D-01 MISSING.
- `npm run build` leaves no diff; `git diff b38ad15 HEAD -- scripts/release.mjs` is empty (T-E406-01 unchanged since its round-1 APPROVED).
- Verdict: APPROVED for both ids; no required findings.

## AC Completeness
AC-E203-0 — implemented — `specs/e126-merge-invariants.md:112-113` ("only when BOTH (i)" … "AND (ii)"), known limit at `:128-139`; re-amendment 9c316e0 precedes the code commit d7afad5 on the branch.
AC-E203-1 — implemented — probe "keep T-D-01": PASS, MISSING and LOST_DONE empty, COMPACTED = T-A-01, T-A-02, T-A-03.
AC-E203-2 — implemented — `node --test test/e126-merge-invariants.test.mjs` 16/16, R-1 5-vs-4 case unchanged and green.
AC-E203-3 — implemented — probe "drop T-D-01": FAIL, MISSING = T-A-01..03 + T-D-01, each with reason `(c) manifest under-reconciles tasks.md § Wave: manifest 3 done/0 voided < closed rows it must cover, union across parents 4 [x]/0 [-] (4 distinct task_id(s))`.
AC-E203-4 — implemented — probe "under-count 2, keep T-D-01": FAIL, MISSING = exactly T-A-01..03 (U = 3 > 2); T-D-01 in neither MISSING nor COMPACTED.
AC-E203-5 — implemented — e126 green unchanged; `npm run build` then `git status --porcelain` shows only the uncommitted `.current/e406/` claim write, nothing under `dist/` or `tools/`.
AC-E203-6 — implemented — probe "keep T-A-03, drop T-D-01" (also the round-1 repro): FAIL, MISSING = exactly T-A-01, T-A-02, T-D-01 with the (c) reason, U = 4 > 3; T-A-03 in neither MISSING nor COMPACTED.
AC-E203-7 — implemented — probe "parent2 moves T-A-04 to `## Other`, merge = parent2": PASS, MISSING empty, COMPACTED = T-A-01..03.
Test pins for AC-E203-1, -3, -4, -6, -7 are T-E203-02 (qa); the probes above are scratch-only.

## Correctness
No required findings. Each probe builds base, parent1, parent2 and the merge with `git commit-tree` (the `mkMergeFixture` shape in `test/e126-merge-invariants.test.mjs`) under `$TMPDIR` and calls `runMergeInvariants` from HEAD `dist/` and from a 4b25061 (pre-E203) `dist/` copy for comparison. Adversarial variants beyond the AC set, all HEAD results:
- Mirrored sides (compactor is parent1), keep T-A-03, drop T-D-01: FAIL, MISSING T-A-01, T-A-02, T-D-01. Rule (ii) does not depend on which parent compacts.
- The merge moves the kept T-A-03 to `## Other` and drops T-D-01: FAIL, same MISSING set. (i)/(ii) read the parent and base rows, not where the merge put the row, so moving a row at merge time does not free a slot.
- Kept T-A-03 regressed to `[ ]`, drop T-D-01: FAIL, MISSING T-A-01, T-A-02, T-D-01; LOST_DONE adds T-A-03.
- Partial compaction (compactor summarizes T-A-01..02 as "2 done" and keeps T-A-03 under `## Wave`): keep T-D-01 → PASS, COMPACTED T-A-01, T-A-02; drop T-D-01 → FAIL, MISSING T-A-01, T-A-02, T-D-01. Rule (ii) is what keeps this case right: a base-only rule would leave T-A-03 in `U` and give a false FAIL on the keep case.
- Compactor moves T-A-04 to a different ledger (`.current/lane1/tasks.md`) before compacting, merge keeps it there, drops T-D-01: FAIL, MISSING T-A-01..03 + T-D-01. The (ii) whole-tree lookup sees the other file.
- Voided split (T-A-03 `[-]` at base; manifest "2 done, 1 voided"; merge keeps T-A-03 `[-]`, drops T-D-01): FAIL with the reason `3 [x]/1 [-]`. The done/voided split still works for kept rows.
- Kept rows in `U` are never reported MISSING or COMPACTED: both lists are filled only for `task_id`s with no row at the merge (`tools/merge-invariants.ts:416`), and every probe above confirms it.
- The cherry-pick-shaped limit the human accepted was not probed and is not raised.
- optional (pre-existing, not introduced by this diff): the non-compacting side moves a base row (T-A-03) out of `## Wave` to `## Other`, adds T-D-01 under `## Wave`, the other side compacts `## Wave` as "3 done"; the merge keeps T-A-03 under `## Other` and drops T-D-01 → PASS, COMPACTED T-A-01, T-A-02, T-D-01. 4b25061 gives the same result. T-A-03's only parent occurrence is under `## Other`, which is (b)-barred, so the manifest slot it took is free whatever rule governs kept rows. This belongs to the same family as the stated limit (the manifest counted a row the other side no longer has under S) but is not literally the text in the spec paragraph or in E203-NEW-1. PM can add it to E203-NEW-1's body if wanted; it is not a ticket proposal.

## Quality
- The doc block (`tools/merge-invariants.ts:324-332`) is 7 body lines, at the limit, and the round-1 `(E203: …)` parenthetical is gone; `node bin/agc-init.mjs check` reports no comments warning (round-1 recommended finding closed).
- The reason string matches the `merge.c.reason` copy row verbatim (`< closed rows it must cover`) and keeps the `(c) manifest under-reconciles` prefix.
- The `const section = ref.section` local exists only to narrow the type inside the `parents.some` closure. That is fine.

## Architecture
No architecture spec. The change stays in the (c) union builder plus its one call site (`evaluateMergeInvariants` passes `[p1, p2]` and `base`, which it already had); `scripts/merge-invariants.mjs` untouched.

## Security
No findings. The code reads committed git objects only; no new input surface.

## Performance
No findings. For each kept occurrence that passes (a)/(b)/(d) there is one base-row scan and two parent lookups, linear in the rows with no extra pass. `heldByCompactor` is recomputed per occurrence, but there are only one or two occurrences per id.

## Expected-red (SOP 4a)
`qa_reports/expected-red_e406-release-and-merge-scripts.txt` is present. `node --test test/e394-release-script.test.mjs` shows 32/59 pass and 27 fail. The set of failing test names is identical to the manifest's 27 entries (diffed in full, not sampled). The other suites that reference merge-invariants are green (e115, e177a, e178a, e226, e286, e296, e349, e395, lane-paths: 163/163). `npx tsc --noEmit` clean.

## Verdict
APPROVED — d7afad5 implements the re-amended (c) rule exactly, AC-E203-0..7 hold under independent probes, the round-1 silent false PASS now FAILs, and no adversarial variant outside the accepted limit regresses against pre-E203 behaviour.

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

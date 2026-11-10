# Review — T-E340-01

## Round 1 — APPROVED — by code-reviewer

Diff: `e748fc5..0928b7f` (feature `e262-sop-text-fixes`). Scope of this report: W11 (`content/const-05-core-standards.md:17`) and the feature's expected-red manifest `qa_reports/expected-red_e262-sop-text-fixes.txt` (which covers all four sr tasks).

## Summary
- Adds one narrow exception to the constitution's task-list hand-edit ban: the role amending the cut (pm, or the coordinator for it) may edit an unchecked, non-voided task's description and `depends_on` in place, disclosed in `pending_notes`; never ids, checkboxes or voided rows; everything else stays `tw_void_task` + `tw_add_task`.
- Verbatim check: applying W11 to the base reproduces HEAD byte-for-byte; 23 lines before and after; `test/e410-task-alias-content-tail.test.mjs` green.
- Expected-red manifest: 20 entries; a targeted run of 16 test files (225 tests) gave exactly 20 reds, and the sorted red titles are identical to the sorted manifest test names.
- Verdict: APPROVED.

## AC Completeness
AC-E340-1 — implemented — `content/const-05-core-standards.md:17` equals W11-new; the added clause contains none of `docs/`, `specs/`, `test/`, `.current/`, `qa_reports/`; 23 lines kept.
AC-E340-2 — partial (qa-owned, by design) — the e130 AC9 pin move is T-E340-02; AC9 red now, listed in the manifest.
AC-E340-3 — partial (qa-owned, by design) — golden recapture is T-E340-02; the 11 compose-equivalence reds are listed in the manifest, one per golden in the spec's *Golden change list*.
AC-E340-4 — partial (qa-owned, by design) — cap re-set is T-E340-02; my run reports the lean (≤ 5723) and non-design (≤ 8501) assertions red and the stripped / teamwork caps green, as the spec's budget table predicts.

## Correctness
No required findings.
- Narrowness against the `docs/backlog.md` E340 row (scope ruled 2026-11-09): unchecked ✔, non-voided ✔, description + `depends_on` only ✔, role amending the cut (pm, or coordinator on its behalf) ✔, disclosed in `pending_notes` ✔, ids / checkbox state / voided rows never ✔, void + add for everything else ✔. No wider grant.
- No contradiction found elsewhere: other constitution fragments mention the task list only for `tw_sync` (const-12, R10) and the terse-reply example (const-01); `coord-05` forbids hand-editing checkboxes, which the exception also forbids; `skill-release-engineer.md:19-20` forbids hand-editing to work around a ⛔ rejection, which this is not; the `tw_add_task` / `tw_void_task` tool descriptions (`tools/registry.ts:897`, `:950`) say nothing that conflicts. The exception is phrased on "the task-list file", so it is naturally file-mode only (SQLite mode has no file).
- Expected-red manifest (SOP step 4a): present at `qa_reports/expected-red_e262-sop-text-fixes.txt`; every entry is a real, locatable test (all 20 sampled by an actual run, not grep only); it lists exactly the spec's 9 *Pins that move* plus the 11 compose-equivalence golden tests, and nothing a qa task does not own. Its header correctly explains why the count differs from the spec's 9-red trial (taken after recapture).

## Quality
No findings. The clause sits in the existing bullet without restructuring; terms (`depends_on`, `pending_notes`, `tw_void_task`, `tw_add_task`) match the tool vocabulary.

## Architecture
No architecture spec. Ruled as an SOP carve-out, not a `tw_edit_task` tool — the diff adds no tool, consistent with the spec's Out of Scope.

## Security
No findings. Constitution §6 hygiene: the clause names no repo path, ticket id, account or personal detail; the manifest carries only repo-relative test paths and test names.

## Performance
No product-code change. +66 ~tok on every constitution composition (spec budget table); the two caps it exceeds are re-set by qa under ruling 5 = a.

## Verdict
APPROVED — W11 is verbatim, exactly as narrow as the E340 ruling, and the expected-red manifest matches the observed reds one for one.

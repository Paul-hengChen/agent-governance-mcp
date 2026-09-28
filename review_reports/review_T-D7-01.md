# Review — T-D7-01

## Summary
- Content-only change to `content/skill-release-engineer.md` (3 hunks): new SOP step 7a "Archive shipped feature's qa_reports", one Artifact-allowlist entry (`qa_reports/archive/**` move-only), and an extension of the Escalation-Routes "unrelated uncommitted changes" scope rule to recognize the archive moves.
- No source (`tools/`/`schema/`/`guards/`/`test/`) touched — matches the stated scope and the ticket's Out-of-Scope section (AC8 establishes the code paths are already archive-safe as written).
- Every AC (AC1–AC8) is satisfied by the prose; id-prefix derivation is unambiguous for real feature names; build/test/audit claims independently reproduced (build clean, 1106/1106, 0 high / 1 low).
- Verdict: APPROVED.

## Correctness
No blocking findings.

- **AC1/AC6 placement — spec reading is correct, sr-engineer's deviation from the dispatch brief is justified.** The brief said "post-release only", but AC1 explicitly requires the step "after `check-version` (step 7) and before commit/tag/push (step 8)" and AC6 requires the moved paths staged "as part of the SAME release commit". A post-commit placement would put the moves in a *separate* commit (violating AC6) and leave the working tree dirty after the release. The diff places the step as 7a between step 7 and step 8 (`skill-release-engineer.md:48`), and relies on step 8's existing `git add ... qa_reports/ ...` glob to stage the new subdirectory — exactly what AC6 prescribes. Pre-commit is the correct reading; ACs are authoritative.
- **id-prefix derivation is unambiguous** (`:49`): "leading alnum token of `<active_feature>` before its first `-`, uppercased." `d7-qa-reports-archive` → `d7` → `D7` → matches `^T-D7-`. Verified consistent against the project's real feature/task ids in commit history and the drift baseline (`c16c10-...` → `C16C10` → `T-C16C10-07`; `d3-...` → `T-D3-*`). Features whose task ids don't follow `T-<CODE>-*` fall through to AC4's silent no-op — acceptable per spec.
- **AC2** (`:52`) expected-red move, **AC4** (`:55`) silent no-op + concurrent-feature non-touch, **AC5** (`:54`) `mv -n` no-clobber, **AC3** (`:53`) `covers:` sweep over remaining root-level `qa_reports/*.md` — all present and faithful to the `parseCoversIds`/`buildCoverageIndex` membership semantics. The sweep greps `qa_reports/*.md` (single level), which does not descend into `qa_reports/archive/`, so archived files are never re-swept.
- **AC8 verified by direct code read** (unchanged by this diff): (a) `tools/drift.ts` has zero `qa_reports`/`review_reports` references; (b) `buildCoverageIndex` (`tools/evidence-file.ts:56`) is the *only* `readdirSync` in `tools/`+`schema/`+`guards/`, it is non-recursive, and it filters every entry by `name.toLowerCase().endsWith(".md")` at line 65 *before* any `readFileSync` — a bare `archive` subdirectory name has no `.md` suffix so it is skipped and never opened; (c) with no other directory scan present, all remaining evidence lookups construct exact per-id paths and cannot collide with a past feature's archived subdirectory.

## Quality
No blocking findings.

- Prose matches the file's existing conventions: sub-step numbering `7a` mirrors the pre-existing `11a`; bold lead-ins (`**No-clobber**`, `**Zero matches = silent no-op**`) match the file's style; `<CODE>`/`<active_feature>` placeholders are used consistently. The absence of a `(vX.Y.0, Cn)` origin tag on the new step/allowlist entry is consistent with the file's other untagged entries (steps 7/8/9, the `dist/**` and `package.json` allowlist rows).
- Non-blocking observation (AC3 vs AC7 boundary): the `covers:` sweep moves a covering file whose own filename id does not match `^T-<CODE>-` when its covered ids intersect the released feature's set (AC3), whereas the step's closing prose says files whose ids don't match the prefix "belong to concurrent in-flight features and MUST NOT be touched" (AC7). These only conflict for a single covering file that simultaneously covers the released feature's ids AND a concurrent feature's ids — impossible under the standing multi-session disjoint-file-set convention (covering reports batch one feature's ids). The diff faithfully implements the spec's own reconciliation (AC7 is scoped to "the concurrent session's evidence files"); no change required, noted for the record.

## Architecture
No findings. The step slots cleanly between the version gate (step 7) and the commit (step 8), reusing the already-existing `qa_reports/` staging glob rather than introducing a new staging path — consistent with AC6's "no change needed there". The Artifact-allowlist addition (`:30`, move-only) and the scope-rule extension (`:84`, "deleted root-level paths plus their new archive paths ... move-only ... never a STOP trigger") together close the role-boundary loop so a subsequent release does not flag the archive moves as unrelated changes. Does not contradict the constitution (`qa_reports/` is not protected source under the Hard-rule MUST-NOT list) or other skills; the archived-files-must-not-break-evidence-lookup contract in `tools/evidence-file.ts` is preserved (AC8-b/c above). D2 file-set disjointness holds: the only modified content file is `content/skill-release-engineer.md`, and no D2 path is present in the working tree.

## Security
No findings. No new input crosses a trust boundary; the step operates on the local `qa_reports/` tree via `mv -n`/`mkdir -p`. No secrets, no injection surface (SOP prose, not executed source). No-clobber semantics prevent destructive overwrite on retry.

## Performance
No findings. The archive step is O(files in `qa_reports/` root) once per release — a `mkdir -p`, a bounded set of `mv` operations, and one `grep` sweep over root-level `*.md`; not a hot path. No algorithmic regression versus base (base had no such step). The lazy `buildCoverageIndex` scan is unchanged and unaffected.

## Verdict
APPROVED — every AC (AC1–AC8) is satisfied, the pre-commit placement is the correct spec reading (sr-engineer's deviation from the brief is justified), id-prefix derivation is unambiguous, and build/test/audit claims (1106/1106) were independently reproduced. T-D7-02 (qa) owns the archive-safety verification and the decision on a regression test per AC8.

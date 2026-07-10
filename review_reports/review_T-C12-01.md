# Review — T-C12-01

## Summary
- Comment-only diff to `gates/registry.ts`: a 31-line `errorCode → doc-file` mapping block inserted above `GATE_REGISTRY` (lines 70–100), plus the regenerated `dist/gates/registry.*` compiled output and the C12 task rows appended to `tasks.md`.
- Deliverable per T-C12-01 is a *verified-accurate* registry + a mapping note for qa-engineer's T-C12-02/03 literal-parity assertions. sr-engineer claims all 22 entries' `triggerEdge`/`armCondition`/`clearingArtifact` audited with 0 stale, 0 field-value edits.
- Independently verified: the diff really is comment-only (no `GateDefinition` field or entry-value change); adversarial spot-check of 10 entries across both producers found 0 stale; the mapping comment is accurate for all 8 sampled codes.
- Suite green 1035/1035, 0 fail (run directly this round). No expected-red manifest — none required (diff touches no test files).
- Verdict: APPROVED.

## Correctness
No findings.

Adversarial audit of the "0 stale" claim — sampled 10 of 22 entries across both producers, verified each field against the live source, not sr-engineer's notes:

`validateTransition` producer (`tools/transitions.ts`):
- **AGENT_ID_REQUIRED** — triggerEdge "next.agent null/unknown" matches the two emit sites (transitions.ts:305 null, :308 unknown agent). ✓
- **TRANSITION_REJECTED** — "no edge prev->next in ALLOWED_TRANSITIONS; unknown status" matches :311 (unknown status) + :390 (no edge). ✓
- **QA_ROUND_EXCEEDED** — "prev_qa_round >= 4" matches `ROUND_CAP = 4` (transitions.ts:243) gating at :315. ✓
- **REVIEW_ROUND_EXCEEDED** — "prev_review_round >= 4" matches `REVIEW_ROUND_CAP = 4` (:244) at :326. ✓
- **VISUAL_ROUND_EXCEEDED** — "prev_visual_round >= 6" matches `VISUAL_ROUND_CAP = 6` (:249) at :341. ✓

`orchestrator` producer (`tools/handoff-orchestrator.ts`):
- **SCOPE_DECISION_REQUIRED** — armCondition `hasDesignModeRequiringVisual().required` matches the imported predicate used at :111 (`arm.required` guard). ✓
- **CUT_APPROVAL_REQUIRED** — triggerEdge "pm:In_Progress -> {architect,sr-engineer}:In_Progress (file-mode only)" / clearingArtifact "cut_approved: true" match the emit site at :160. ✓
- **MISSING_EVIDENCE** — armCondition `hasEvidence().missing non-empty` matches `storage.hasEvidence(...)` at :312. ✓
- **MISSING_REVIEW_EVIDENCE** — armCondition `hasCodeReviewEvidence().missing non-empty` matches `storage.hasCodeReviewEvidence(...)` at :557 / `ev.missing` at :563. ✓
- **REVIEWER_COMPLETED_TASKS_REJECTED** — armCondition "agent_id=code-reviewer && completed_tasks.length > 0" matches the emit at :284. ✓

No off-by-one in the cap thresholds (registry `>= N` matches the code's `>= CAP` with CAP literals 4/4/6). No entry value contradicts its emit site.

## Quality
No findings. The comment block follows the file's existing comment conventions, carries an audit date (2026-07-10) and a `grep -l '\`<CODE>\`' content/*.md` regeneration recipe, and is column-aligned. Mapping accuracy spot-checked against `grep -l` for 8 codes — every doc-file list matched exactly, including multi-file entries (SCOPE_DECISION_REQUIRED → const-08 + constitution-rationale + skill-pm; CUT_APPROVAL_REQUIRED → const-08 + skill-coordinator + skill-coordinator-lite; REVIEW_VERDICT_STATUS_MISMATCH → const-05 + const-08 + skill-code-reviewer). No stale file names.

## Architecture
No findings. Consistent with spec AC6 (option (b), assert): the `GateDefinition` type and all 22 literal entries are byte-unchanged — the only source edit is a documentation comment. Nothing touches `prompts/build.ts`, `constitution-manifest.ts`, `content/const-*.md`, the compose-golden fixture, or context-budget caps (git status confirms zero such edits), so DR-3's guardrail is respected. The mapping lives as a code comment (input to the T-C12-02/03 test), not as a new consumed field — no runtime surface added, LEAF module stays import-free.

## Security
No findings. Comment-only change; no input crosses a trust boundary, no secrets, no new execution path.

## Performance
No findings. No runtime code changed; `GATE_REGISTRY` and the O(1) `REGISTRY_BY_CODE` lookup are untouched.

## Verdict
APPROVED — the T-C12-01 diff is comment-only, the "0 stale" audit holds under an adversarial 10-entry cross-producer re-verification against live `transitions.ts`/`handoff-orchestrator.ts`, the mapping comment is accurate for every sampled code, and the suite is green 1035/1035 with zero out-of-scope (content/test/build.ts) edits.

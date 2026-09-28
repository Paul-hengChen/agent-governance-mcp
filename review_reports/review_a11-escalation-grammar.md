# Review — a11-escalation-grammar

covers: A11-01, A11-02, A11-03, A11-04, A11-05, A11-06, A11-07, A11-08, A11-09, A11-10, A11-11

## Summary
- Content-only ticket: one canonical **Escalation call format** + **Rule grammar (WHEN/DO/ELSE)** pair of bullets added to `content/const-05-core-standards.md` §3; 7 skill files gained a `## Escalation Routes` table and their SOP prose now references rows by situation name (31 rows total).
- `skill-pm.md` (A7 Gate Summary) and `skill-qa-visual.md` (A6 error-code table) received one cross-reference line each; both pinned tables are byte-unchanged.
- 11 compose-golden fixtures regenerated — the only added content is the 2 const-05 bullets, replicated per fixture; no other drift.
- Reviewed the tree, not the narrative (implementation spanned two sr-engineer contexts): no half-finished edits, no duplicated `## Escalation Routes` sections (exactly 1 per file), table shape identical across all 7 files, zero leftover inline `status=Blocked/FAIL` incantations.
- Verdict: **APPROVED**.

## Correctness
No findings.
- **AC1** (`content/const-05-core-standards.md:18`) — exactly one canonical *Escalation call format* bullet with the spec-mandated shape `tw_update_state(status=<Blocked|FAIL>, agent_id=<role>, pending_notes=["<Role>: <situation> — <detail>", "next_role: <role>"])`; cross-references `visual_fail:` / `review: APPROVED|CHANGES_REQUESTED` / `resume_of:` / `scope_decision_why` / `covers:` without redefining them.
- **AC6** (`content/const-05-core-standards.md:19`) — the *Rule grammar (WHEN/DO/ELSE)* bullet defines the trigger→action→escape triple; touched prose rules (architect steps 2/3/4/4a/6, sr-engineer 2/3 + R7 flags, design-auditor 2a/2b/6, coordinator stop-conditions + §3.2 unavailable-judge bullet, qa-engineer coverage gaps/Phase 2/Phase 4) all read in `WHEN … → DO … → ELSE …` shape or collapse to a table row.
- **AC2** — all 7 target files carry exactly one `## Escalation Routes` table with the canonical `| situation | status | note token | next_role |` header (verified 7/7 identical, 1 header each). Row counts match the sr-engineer manifest: architect 5, sr-engineer 4, qa-engineer 5, design-auditor 3, code-reviewer 2, coordinator 8, release-engineer 4 = 31. SOP prose references rows by situation name; no residual inline `tw_update_state(status=Blocked|FAIL …)` calls remain in the 7 files.
- **AC5** — all 10 gate error-code tokens preserved verbatim (HEAD==working-tree counts): VISUAL_EVIDENCE_MISSING 4, MISSING_REVIEW_EVIDENCE 2, AGENT_ID_REQUIRED 1, QA_ROUND_EXCEEDED 1, REVIEW_ROUND_EXCEEDED 1, BASELINE_MANIFEST_MISSING 4, BASELINE_PROVENANCE_INCOMPLETE 4, CUT_APPROVAL_REQUIRED 3, MISSING_EVIDENCE 1, VISUAL_WIDGETS_UNVERIFIED 1.

## Quality
No findings. Table headers are byte-identical across all 7 files (no shape drift between skills). The coordinator table adapts the `status` column for a mostly-read-only role (`—` = observe/halt, explicitly documented in the table preamble; state-writing rows annotate their `status`) — a deliberate, self-documented adaptation, not inconsistency. Success/closing handoffs (code-reviewer APPROVED, design-auditor audit-complete, sr-engineer visual-split) are folded into the same table as escalations — additive and consistent across skills, harmless.

## Architecture
No architecture spec exists (content-only ticket; `specs/a11-escalation-grammar.md` Out of Scope confirms no TS source, no `design/<feature>.md`, mode = no-design). Layering unchanged. The canonical-definition-in-constitution + per-skill-table mechanism generalizes the pre-existing A6 (`skill-qa-visual`) and A7 (`skill-pm`) exemplars exactly as the spec intends.

## Security
No findings. No new input crosses a trust boundary; no secrets introduced. Governance-doc prose only.

## Performance
No findings. No runtime code path changed. Constitution bytes grew by 2 bullets, which shifts the composed-bundle token counts (see AC4 note below) but introduces no algorithmic change.

## Verdict
APPROVED — all in-scope ACs (AC1, AC2, AC3, AC5, AC6) satisfied; `npm run build` clean; the 6 `npm test` failures are exclusively context-budget cap trips, a qa-owned re-baseline explicitly sanctioned by AC4 (C2-06 precedent), not a defect in this diff.

### AC4 note — qa-owned cap re-baseline (measured, carry forward)
`test/context-budget.test.mjs` caps tripped by the 2 added const-05 bullets. Per AC4 the `~tok` cap bump is qa-engineer's (C2-06 precedent, documented old→new comment). Measured old→new:
- lean always-on: 3087 → 3332
- skill-pm stripped: 3196 → 3225
- skill-sr stripped: 2138 → 2258
- design-arm stripped constitution: 5316 → 5561
- teamwork coordinator bundle: 9106 → 9545
- non-design constitution: 3232 → 3477

### AC3 confirmation
`skill-pm.md` Gate Summary (`| gate | trigger | clearing action |`) and `skill-qa-visual.md` error-code table (`| trigger | error code | STOP action |`) headers and rows unchanged; each received exactly one added cross-reference sentence.

### AC7 / A11-12 note
Backlog done-mark (`docs/backlog.md` A11 row) is deferred post-PASS by design (A11-12, outside this review's A11-01..A11-11 manifest) — not a review finding.

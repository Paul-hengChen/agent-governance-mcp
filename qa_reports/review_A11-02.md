# QA review — A11-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-08T14:31:25.139Z — PASS — by qa-engineer

PASS — a11-escalation-grammar (A11-01..A11-11). Independently re-verified every spec AC against the live diff (not the review report): const-05 canonical Escalation call format + WHEN/DO/ELSE grammar bullet (AC1/AC6); all 7 target skill files carry exactly one byte-identical `## Escalation Routes` table (situation|status|note token|next_role, 31 data rows, AC2), zero leftover inline status=Blocked/FAIL incantations; skill-pm/skill-qa-visual (A6/A7 exemplars) byte-unchanged save one cross-ref line each (AC3); all 7 error-code tokens preserved verbatim (AC5); 11 compose-golden fixtures each diff by exactly the 2 new const-05 bullets, no other drift. A11-02: re-measured (not trusted) all 6 context-budget caps directly against dist/ — matched sr-engineer/code-reviewer's reported values exactly (lean 3332, skill-pm 3225, skill-sr 2258, design-arm constitution 5561, teamwork bundle 9545, non-design constitution 3477); updated test/context-budget.test.mjs at all 6 sites with dated a11-escalation-grammar comment blocks per A13-07 convention; saving-margin assertions re-verified and hold (rationale saving 273 >=240, design-only saving 2084 >=2080, bundle diff 2224 >=1830). npm run build clean; npm test 938/938 green, re-run twice for stability. Full report: qa_reports/review_a11-escalation-grammar.md.


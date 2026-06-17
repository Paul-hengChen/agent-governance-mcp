# Code Review — T-FBMG-02 (figma-baseline-manifest-gate, v3.40.0)

> Reviewer: code-reviewer (opus) — clean-context.
> Scope: `index.ts` wiring (sixth/last visual sub-gate) + version/CHANGELOG/constitution.

**Verdict: APPROVED**

T-FBMG-01 and T-FBMG-02 were reviewed together against the single sr-engineer diff.
Full findings (Summary / Correctness / Quality / Architecture / Security / Performance /
Verdict) are in `review_reports/review_T-FBMG.md`.

Headline for this task: the gate is the LAST visual sub-gate, correctly nested inside
`if (armCheck.required)` after the `VISUAL_PROVENANCE_MISSING` block (index.ts:970); it
reuses the existing `armCheck` (no re-arm) and cannot fire on no-design features. The two
error strings are BYTE-IDENTICAL to spec ERR-BMM-01 / ERR-BPI-01 (programmatic verbatim
diff) and are selected by `manifest.code`. Version is `3.40.0` across package.json +
index.ts Server literal; CHANGELOG `[3.40.0]` names both error codes; constitution header
v3.28.0→v3.40.0 with the §3.1 bullet inside the `<!-- design-only -->` span. Surgical —
no unrelated churn. `npm run build` clean; `check:version` OK.

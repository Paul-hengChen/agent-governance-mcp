# Code Review — T-FBMG-01 (figma-baseline-manifest-gate, v3.40.0)

> Reviewer: code-reviewer (opus) — clean-context.
> Scope: parser + composition helper in `tools/evidence-file.ts`
> (`parseBaselineManifestRows`, `hasBaselineProvenance`, `checkBaselineManifest`).

**Verdict: APPROVED**

T-FBMG-01 and T-FBMG-02 were reviewed together against the single sr-engineer diff.
Full findings (Summary / Correctness / Quality / Architecture / Security / Performance /
Verdict) are in `review_reports/review_T-FBMG.md`.

Headline for this task: the pure parsers are I/O-free and never throw (verified by live
execution: malformed/empty/single-pipe tables return without exception); the arming/
exemption decision tree in `checkBaselineManifest` matches the AC matrix on every branch —
critically the single-surface (1 audited row) EXEMPT pass does NOT false-positive, and the
no-`## Source` dormant case preserves pre-v3.40.0 backwards-compat. `npm run build` clean.

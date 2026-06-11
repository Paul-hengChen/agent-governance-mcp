# Review: T-GTL-06 (governance-text-load, R2)

> Reviewer: code-reviewer (opus) · 2026-06-11
> T-GTL-06 (constitution §1/§7 rationale fencing) and T-GTL-07 (build.ts/measure-script
> constitution strip) were reviewed together in one round — they are one indivisible change
> (the fence is inert without the call-site strip, and the strip is a no-op without the fence).

## Round 1 — APPROVED — by code-reviewer

See the combined review report: **`review_reports/review_T-GTL-07.md`**.

## Summary
- T-GTL-06 scope: fence EXACTLY two inline parenthetical example-lists — §1 L16 HTML-primitive
  `(e.g. …)` and §7 L143 artifact-type `(URLs, …, "see XYZ")`. L17 and L19 correctly NOT fenced.
- Primary adjudication (four-target task text vs two-span spec): DR-8 names the two-span set and
  explicitly excludes L17 (definitional `(Figma…)` clarifier + §7 ref, no rationale prose) and L19
  (pure rule + §3.1/§3.2 references = DR-10 hard exclusion). Independently verified against the actual
  file. sr's omission is spec-correct, not under-delivery.
- AC7 (HARD): §3.1→§4 zone byte-identical pre/post (diff hunks outside L39–L93; post-strip slice
  identical). PASS. AC9 losslessness reproduced. Marker syntax matches `stripRationale`.

## Verdict
**APPROVED.** Full Correctness/Quality/Architecture/Security/Performance analysis and the DR-8
adjudication reasoning are in `review_reports/review_T-GTL-07.md`.

# Code Review — T-GTL-03 (governance-text-load / F-B)

> Per-task pointer. Full adversarial review for the F-B skill-only slice
> (T-GTL-02/03/04 reviewed together) lives in:
> **review_reports/review_governance-text-load.md**

## Round 1 — APPROVED — by code-reviewer

T-GTL-03 (prompts/build.ts: stripRationale + fullDetail param, skill-body-only call-site):
single load-bearing copy (build.ts:70), applied at L271 to the skill body only; constitution
var (L262-263) is chainOnly-or-raw with NO stripRationale call-site — T-GTL-07 genuinely
absent (descope clean). Regex idempotent + no-marker passthrough; composes order-independently
with stripChainOnly. dist/prompts/build.js byte-identical to fresh tsc. AC5 single copy
satisfied; bin/ hook clean (DR-4/DR-11). Verdict: APPROVED.

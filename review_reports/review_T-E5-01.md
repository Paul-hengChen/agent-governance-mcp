# Review — T-E5-01

covers: T-E5-01, T-E5-02, T-E5-03

## Summary
- E5 fix (a) backlog intake loop (coord-03), fix (b) tiered cut-approval (const-08 rule + tools/config.ts key + docs/config.md), fix (c) cheapest-compliant-path intake step (coord-07 SOP 4a). 6 source files + dist regen.
- Scope matches docs/backlog.md:1016-1047 exactly; no extras, no server gate added (auto-tier is advisory-only as specified).
- 10 intentionally-red tests match qa_reports/expected-red_e5-intake-tiering.txt exactly; all are golden/ratchet re-baselines from content growth, zero unexpected breakage.
- Verdict: APPROVED.

## Correctness
No blocking findings.
- tools/config.ts:208-226 — auto-tier parse verified against every case: absent key → field unset (disabled); present `{}` → conservative defaults (maxFiles 2, P3, false/false); non-object/array/null → treated as absent (short-circuit on `autoTier &&`, no crash); `^P\d+$` anchored (rejects "3", "P3 ", "PX"); booleans strict `=== true`; maxFiles requires finite `> 0` then `Math.floor`. Non-fatal per-field fallbacks confirmed. Follows the tokenBudgetPerFeature/driftBaselineIds loader precedent (config.ts:186-201).
- Expected-red sampling (SOP 4a): all 3 sampled manifest entries resolve to real tests — compose-equivalence "cat(15 manifest fragments…)" (test/compose-equivalence.test.mjs:148), context-budget "rationale-stripped (design-arm)… ≤ 7435" (test/context-budget.test.mjs:844), skill-manifest "t-golden-byte-identity" (test/skill-manifest.test.mjs:100). Failing-test list is byte-identical to the manifest's 10.

## Quality
No findings. Origin tags `(v3.85.0, E5)` consistent with existing style; version stamp is the forward-looking pre-release convention (current release 3.84.0). Comments in config.ts mirror surrounding additive-optional field docstrings.

## Architecture
No findings. Constitution/skill layering respected: const-08 holds the mechanism/threshold/arming/trust rule and closes with "Role-specific writer actions live in the skills … MUST NOT restate this mechanism"; coord-03 (auto-tier writer action + Backlog Intake Loop) and coord-07 (intake step 4a) hold role actions and cross-ref §3.1. Overlap of the recording obligation (pending_notes `cut-approved: auto-tier` + threshold facts) across const-08 and coord-03 mirrors the existing Cut-Approval Gate / writer-obligation split precedent — acceptable. PASS stays terminal for the current feature; loop never auto-hops to release-engineer (stated twice); feature lease / hop cap / all Escalation rows preserved. No contradiction with the sanctioned-witness trust rule: auto-tier approval derives from the standing config opt-in, not a relayed human-approval claim.

## Security
No findings. No new trust boundary crossed; config parse is defensive (type-guarded, no throw on malformed input). No secrets. Auto-tier remains attestation-based and advisory — no privilege escalation path (auto-start gated on §3.1 qualification, which errs conservative: maxFiles floor can reach 0 = never auto-approve, a safe direction).

## Performance
No findings. loadConfig adds one O(1) object parse; no hot-path or I/O change.

## Verdict
APPROVED — all three fixes delivered per spec; config.ts correct and precedent-following; docs accurate; collateral clean (10 reds = manifest, Lease-Override bullet + feature-lease pin test 67/67 intact).

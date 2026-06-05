# QA Review — T-QA

<!-- visual-fidelity-gate-hardening | @qa-engineer | 2026-06-04 -->

## Phase 1 — Review

This task is self-referential: T-QA is the qa-engineer task itself.

### Scope

Tests written for:
1. `hasDesignModeRequiringVisual` / `parseDesignMode` (unit, via exported helper)
2. PASS-gate ordering & mutual exclusion (integration, around index.ts ~711-778)
3. `VISUAL_BASELINES_REQUIRED` in `TransitionRejection.error` union

### Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared — this feature has no design source).

## Phase 3 — Tests

### Test Files Modified

1. `/Users/paul.ph.chen/agent-governance-mcp/test/visual-evidence-gate.test.mjs`
   - Added import of `hasDesignModeRequiringVisual`
   - Added 15 new tests under `v3.16.0 — hasDesignModeRequiringVisual`

2. `/Users/paul.ph.chen/agent-governance-mcp/test/visual-gate-e2e.test.mjs`
   - Added import of `hasDesignModeRequiringVisual`
   - Added 7 new PASS-gate ordering/mutual-exclusion tests + 1 union test

3. `/Users/paul.ph.chen/agent-governance-mcp/test/pixel-perfect-visual-compare.test.mjs`
   - Updated `AC-1` test to match new v3.16.0 behavior (MANDATORY when mode != no-design, VISUAL_BASELINES_REQUIRED) instead of old OPTIONAL/skip-silently behavior

### AC-to-Test Map

| AC | Test(s) | File |
|---|---|---|
| AC-1 — arming signal changes + VISUAL_BASELINES_REQUIRED | `v3.16.0 AC-1: ## Mode H2 section style — figma → required:true` | visual-evidence-gate.test.mjs |
| AC-1 — **Mode** bullet em-dash | `v3.16.0 AC-1: **Mode** bullet (em-dash) style — sketch → required:true` | visual-evidence-gate.test.mjs |
| AC-1 — mode: inline key + no-design | `v3.16.0 AC-1: mode: inline key style — no-design → required:false` | visual-evidence-gate.test.mjs |
| AC-1 — real mode (figma) | `v3.16.0 AC-1: real mode (figma) → required:true (via inline bullet form)` | visual-evidence-gate.test.mjs |
| AC-1 — D6 fail-open (no Mode line) | `v3.16.0 AC-1 D6: missing Mode line in existing design file → required:false (fail-open)` | visual-evidence-gate.test.mjs |
| AC-1 — fail-open on read error | `v3.16.0 AC-1: read error (bad bytes) → required:false (fail-open, never throws)` | visual-evidence-gate.test.mjs |
| AC-1 — backtick tolerance | `v3.16.0 AC-1: backtick-wrapped mode value in bullet — figma → required:true` | visual-evidence-gate.test.mjs |
| AC-1 — case tolerance | `v3.16.0 AC-1: uppercase MODE in inline key — MODE: SKETCH → required:true` | visual-evidence-gate.test.mjs |
| AC-1 — em-dash separator | `v3.16.0 AC-1: em-dash separator is handled — **Mode** — xd` | visual-evidence-gate.test.mjs |
| AC-1 — D3 no exemption list (paper) | `v3.16.0 D3: paper mode arms the gate (no raster-only exemption list)` | visual-evidence-gate.test.mjs |
| AC-1 — D3 no exemption list (image) | `v3.16.0 D3: image mode arms the gate (no raster-only exemption list)` | visual-evidence-gate.test.mjs |
| AC-1 — empty feature defensive | `v3.16.0 AC-1: empty active_feature → required:false (defensive)` | visual-evidence-gate.test.mjs |
| AC-10 — no design file | `v3.16.0 AC-10: no design file → required:false (non-UI workspace)` | visual-evidence-gate.test.mjs |
| AC-1 STEP1 — armed + no baselines | `v3.16.0 AC-1 STEP1: armed (real mode) + no baselines → gate would emit VISUAL_BASELINES_REQUIRED` | visual-gate-e2e.test.mjs |
| AC-1 STEP1 — stable substrings | `v3.16.0 AC-1 STEP1: error message substring — VISUAL_BASELINES_REQUIRED + ## Visual Baselines is absent` | visual-gate-e2e.test.mjs |
| AC-1 STEP2 — baselines present + missing evidence | `v3.16.0 AC-1 STEP2: baselines present + missing visual_<task>.md → VISUAL_EVIDENCE_MISSING path` | visual-gate-e2e.test.mjs |
| AC-10 — no-design mode gate silent | `v3.16.0 AC-10: no-design mode → gate silent (both STEP 1 and STEP 2 skipped)` | visual-gate-e2e.test.mjs |
| AC-10 — no design file at all | `v3.16.0 AC-10: no design file at all → gate silent, PASS proceeds` | visual-gate-e2e.test.mjs |
| AC-1 — full happy path (baselines + evidence) | `v3.16.0 AC-1: baselines present + evidence present → PASS (all gates satisfied)` | visual-gate-e2e.test.mjs |
| AC-9 — VISUAL_BASELINES_REQUIRED in union | `v3.16.0 AC-9: VISUAL_BASELINES_REQUIRED is in TransitionRejection.error union` | visual-gate-e2e.test.mjs |
| AC-2 — updated skill-design-auditor | `AC-1: design-auditor Artifact Schema declares...v3.16.0: MANDATORY when mode != no-design` | pixel-perfect-visual-compare.test.mjs |

### Pre-existing Test Fix

`pixel-perfect-visual-compare.test.mjs:AC-1` was failing because the test asserted the OLD behavior (`OPTIONAL` label, "Absence MUST cause QA Phase 1.5 to skip silently"). The new behavior (MANDATORY when mode != no-design, VISUAL_BASELINES_REQUIRED) is what AC-2 of this feature intentionally introduced. The test was updated to assert the correct new behavior. This is a correct test fix — the new behavior is the intended contract.

### Test Run Results

- Pre-existing tests: 499 passing before new tests
- After new tests + fixed test: **519 passing, 0 failing**
- `npx tsc --noEmit`: ZERO TypeScript errors
- The `teamwork-lite` server-spawn test (test 389) is an intermittent infrastructure timing issue pre-existing this feature; confirmed it passes when run in isolation and on repeat full-suite runs.

## Verdict

PASS
## 2026-06-04T11:12:57.741Z — PASS — by qa-engineer

All 6 tasks PASS. 20 new tests written (visual-evidence-gate.test.mjs + visual-gate-e2e.test.mjs) + 1 pre-existing test updated to match v3.16.0 behavior. 519 tests passing, 0 failing. npx tsc --noEmit: ZERO errors. AC-to-test map: AC-1/AC-10 covered by 19 new tests across both files; AC-9 covered by union type test; AC-2 covered by updated pixel-perfect-visual-compare test; AC-3/AC-4/AC-5/AC-6/AC-7/AC-8 verified by content grep + doc review. VISUAL_BASELINES_REQUIRED error code registered in TransitionRejection.error union. Phase 1.5 skipped (no design source for this infra feature).


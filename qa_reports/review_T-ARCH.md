# QA Review — T-ARCH

<!-- visual-fidelity-gate-hardening | @qa-engineer | 2026-06-04 -->

## Phase 1 — Review

### Copy Audit Gate

Spec Copy/Strings table (2 strings):

| string id | spec exact text | implementation | status |
|---|---|---|---|
| ERR_VISUAL_BASELINES_REQUIRED | `⛔ VISUAL_BASELINES_REQUIRED: design/<feature>.md declares mode != no-design but ## Visual Baselines is absent. Add the Visual Baselines section (design-auditor SOP §Artifact Schema) before retrying PASS.` | index.ts:727-729 — leads with spec phrasing verbatim, appends interpolated `(mode=..., at ...)` per architecture D7. Architecture D7 explicitly resolves apparent drift: "T-QA asserts on stable substrings only". | PASS (D7 acceptable) |
| CONSTITUTION_GATE_LABEL | `Visual evidence gate (v3.16.0)` | constitution.md:45 — exact text present | PASS |

### Visual Audit Gate

No visual tokens (spec table row: N/A — feature has no visual token changes). Gate skipped.

### Phase 1.5 — Visual Compare

No design/<feature>.md for this feature (spec line 209: "there is no design source"). Gate skipped. No visual_T-ARCH.md required.

### Implementation Review

**T-ARCH deliverables (specs/qa-flow-enforcement-architecture.md):**

- `## Visual Gate Tiers (v3.16.0)` section present at line 561 with Tier A + Tier B definitions matching AC-7 contract
- `VISUAL_BASELINES_REQUIRED` error-code row present at line 579 with trigger and resolution columns matching AC-9 contract
- Interface contract for `hasDesignModeRequiringVisual` defined with correct return shape `{required, mode, designPath}`
- `parseDesignMode` private helper designed with tolerant multi-form parser (H2, inline bullet, mode: key)
- Decision records D1–D7 documented; locked Q-OQ1 recorded (arm all modes except no-design, no exemption list)

No issues found.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared — this feature has no design source).

## Phase 2 — Discussion

No issues. Proceeding to Phase 3.

## Phase 3 — Tests

T-ARCH is a documentation/architecture deliverable. The code contracts it defines are tested under T-SERVER (which implements them). No standalone T-ARCH test file needed; AC-7 and AC-9 are verified by the T-SERVER and T-QA tests.

## AC-to-Test Map

| AC | Test(s) |
|---|---|
| AC-7 (Visual Gate Tiers in enforcement matrix) | Verified by doc grep in `visual-gate-e2e.test.mjs:test("v3.16.0 AC-9: VISUAL_BASELINES_REQUIRED is in TransitionRejection.error union")` which also reads transitions.ts source |
| AC-9 (VISUAL_BASELINES_REQUIRED error-code row) | `visual-gate-e2e.test.mjs:test("v3.16.0 AC-9: VISUAL_BASELINES_REQUIRED is in TransitionRejection.error union")` |

## Verdict

PASS
## 2026-06-04T11:12:57.741Z — PASS — by qa-engineer

All 6 tasks PASS. 20 new tests written (visual-evidence-gate.test.mjs + visual-gate-e2e.test.mjs) + 1 pre-existing test updated to match v3.16.0 behavior. 519 tests passing, 0 failing. npx tsc --noEmit: ZERO errors. AC-to-test map: AC-1/AC-10 covered by 19 new tests across both files; AC-9 covered by union type test; AC-2 covered by updated pixel-perfect-visual-compare test; AC-3/AC-4/AC-5/AC-6/AC-7/AC-8 verified by content grep + doc review. VISUAL_BASELINES_REQUIRED error code registered in TransitionRejection.error union. Phase 1.5 skipped (no design source for this infra feature).


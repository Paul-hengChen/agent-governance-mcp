# QA Review — T-SERVER

<!-- visual-fidelity-gate-hardening | @qa-engineer | 2026-06-04 -->

## Phase 1 — Review

### Copy Audit Gate

See review_T-ARCH.md (shared). Both strings verified present in implementation.

### Visual Audit Gate

No visual tokens (N/A per spec). Gate skipped.

### Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared).

### Implementation Review

**tools/evidence-file.ts:**

- `hasDesignModeRequiringVisual` exported at line 155; matches architecture interface contract exactly
- `parseDesignMode` private helper at line 182; tolerates H2 section, `**Mode** —` bullet, and `mode:` inline forms per D4
- KNOWN_MODES array includes all 8 modes; `no-design` correctly excluded via exclusion (not allow-list) per D3
- Fail-open behavior: no-file → `{required:false}`, bad-bytes read → `{required:false}`, no Mode line → `{required:false}` per D6
- `designFilePath` sanitiser reused (dots collapse, slash collapse)

**tools/transitions.ts:**

- `"VISUAL_BASELINES_REQUIRED"` added to `TransitionRejection.error` union at line 53
- Explanatory comment matches `VISUAL_WIDGETS_UNVERIFIED` style as specified in architecture §3

**index.ts PASS gate (lines 711-778):**

- `hasDesignModeRequiringVisual` imported and called before `hasVisualBaselinesInDesign` (correct arm-then-evidence ordering)
- STEP 1 at line 722: `if (armCheck.required && !visualGate.present)` — fires FIRST, mutual exclusion with STEP 2 (D2)
- Error message includes stable substrings `VISUAL_BASELINES_REQUIRED` and `## Visual Baselines is absent`
- STEP 2 at line 738: `if (visualGate.present)` — unchanged v3.14.0 gate, reached only when baselines present
- Non-UI pass-through: when `required=false` (no file, no-design mode, unparseable mode), neither step fires

No issues found.

## Phase 2 — Discussion

No issues.

## Phase 3 — Tests

Tests written in test/visual-evidence-gate.test.mjs and test/visual-gate-e2e.test.mjs (see review_T-QA.md for full AC-to-test map).

## AC-to-Test Map

| AC | Test(s) |
|---|---|
| AC-1 (arming signal, VISUAL_BASELINES_REQUIRED gate) | `visual-evidence-gate.test.mjs`: 15 new `hasDesignModeRequiringVisual` tests; `visual-gate-e2e.test.mjs`: 7 new PASS-gate ordering tests |
| AC-9 (VISUAL_BASELINES_REQUIRED in TransitionRejection union) | `visual-gate-e2e.test.mjs:test("v3.16.0 AC-9: VISUAL_BASELINES_REQUIRED...")` |
| AC-10 (non-UI pass-through regression) | `visual-gate-e2e.test.mjs:test("v3.16.0 AC-10: no-design mode...")` + `test("v3.16.0 AC-10: no design file...")` |

## Verdict

PASS
## 2026-06-04T11:12:57.741Z — PASS — by qa-engineer

All 6 tasks PASS. 20 new tests written (visual-evidence-gate.test.mjs + visual-gate-e2e.test.mjs) + 1 pre-existing test updated to match v3.16.0 behavior. 519 tests passing, 0 failing. npx tsc --noEmit: ZERO errors. AC-to-test map: AC-1/AC-10 covered by 19 new tests across both files; AC-9 covered by union type test; AC-2 covered by updated pixel-perfect-visual-compare test; AC-3/AC-4/AC-5/AC-6/AC-7/AC-8 verified by content grep + doc review. VISUAL_BASELINES_REQUIRED error code registered in TransitionRejection.error union. Phase 1.5 skipped (no design source for this infra feature).


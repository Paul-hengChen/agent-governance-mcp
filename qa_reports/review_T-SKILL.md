# QA Review — T-SKILL

<!-- visual-fidelity-gate-hardening | @qa-engineer | 2026-06-04 -->

## Phase 1 — Review

### Implementation Review

**content/skill-design-auditor.md — AC-2:**

Line 26: Visual Baselines bullet:
- Old text: `*(OPTIONAL)*` + "Absence of this section MUST cause QA Phase 1.5 to skip silently" — REMOVED
- New text: `*(MANDATORY when mode ≠ no-design)*` — CORRECT (AC-2 requires this change)
- New text: "Absence of this section is legitimate ONLY when `mode = no-design` — in that case QA Phase 1.5 skips silently and non-UI features pay zero overhead." — CORRECT
- New text: "With any other mode, absence does NOT skip silently: the server arms the visual gate on `mode ≠ no-design` and blocks PASS with `VISUAL_BASELINES_REQUIRED` until this section is added." — CORRECT

**AC-8 — Empty-node wording:**

Line 51: "If a fetch returns empty nodes (e.g., `nodes: []`), flag the surface as `empty`/`unresolved` in the manifest, never `audited`."

The architecture requires distinguishing `empty` (API returned no data) from `deferred` (auditor chose not to audit). Checking the full line: "If the design exceeds the 250-line cap for this pass, mark uncovered surfaces as `deferred` in the *Source manifest* with a one-line reason and hand back" — this shows `deferred` has its own meaning (capacity cap). The `empty` case is for `nodes: []`. The distinction is clear.

### Copy Audit Gate

No new Copy/Strings strings from T-SKILL. The `VISUAL_BASELINES_REQUIRED` string is owned by T-SERVER.

### Visual Audit Gate

No visual tokens. Gate skipped.

### Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared).

## Phase 2 — Discussion

No issues.

## Phase 3 — Tests

AC-2 documentation change is verified by the updated test in `pixel-perfect-visual-compare.test.mjs`:
- `test("AC-1: design-auditor Artifact Schema declares Visual Baselines H2 with 4-col schema (v3.16.0: MANDATORY when mode != no-design)")` — asserts `MANDATORY when mode`, `legitimate ONLY when mode = no-design`, and `VISUAL_BASELINES_REQUIRED` are all present.

## AC-to-Test Map

| AC | Test(s) |
|---|---|
| AC-2 (contradictory sentence removed, new AC-2 wording) | `pixel-perfect-visual-compare.test.mjs:test("AC-1: ...v3.16.0: MANDATORY when mode != no-design")` |
| AC-8 (empty-node honesty) | Text verified present; existing design-auditor-volume-guard tests cover the SOP step audit loop |

## Verdict

PASS
## 2026-06-04T11:12:57.741Z — PASS — by qa-engineer

All 6 tasks PASS. 20 new tests written (visual-evidence-gate.test.mjs + visual-gate-e2e.test.mjs) + 1 pre-existing test updated to match v3.16.0 behavior. 519 tests passing, 0 failing. npx tsc --noEmit: ZERO errors. AC-to-test map: AC-1/AC-10 covered by 19 new tests across both files; AC-9 covered by union type test; AC-2 covered by updated pixel-perfect-visual-compare test; AC-3/AC-4/AC-5/AC-6/AC-7/AC-8 verified by content grep + doc review. VISUAL_BASELINES_REQUIRED error code registered in TransitionRejection.error union. Phase 1.5 skipped (no design source for this infra feature).


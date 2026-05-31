# QA Review — feature-split-lifecycle (T360 impl + T361 tests)

## Round 1 — PASS — by qa-engineer

## Phase 1 — Review
- **Change**: `skill-coordinator.md` Feature-Scope Gate now branches no-plan (assess→generate, rows `status: pending`) vs existing-plan (resume: reconcile PASS→done, next pending / named row, hydrate, never re-run done). Single file, prompt-layer.
- Verified wording present: status column + `pending`; reconcile/PASS→done; "do NOT re-assess or regenerate"; "Never re-run a `done` row"; by-id `do F0` + hydrate.

### 3a. Copy Audit Gate
Spec *Copy / Strings* — `status`, `pending`, `done` all present verbatim in the gate/schema. No drift, no gap.

### 3b. Visual Audit Gate
*Visual Tokens* = N/A (governance content). Pass-through.

## Phase 1.5 — Visual Compare
Skipped (no `design/feature-split-lifecycle.md`; no `## Visual Baselines`).

## Phase 2 — Discussion
No blocking issues. Code-reviewer's non-blocking note (reconcile relies on `active_feature` == split-row `feature id`) recorded; the by-id hydrate feeds the row id as the feature, so the convention holds for the stated one-unit-per-invocation flow — acceptable, no change required this round.

## Phase 3 — Tests
- **Updated stale footprint caps 425→550** (AC6): `test/feature-scope-gate.test.mjs` + `test/design-auditor-volume-guard.test.mjs` — both were failing-by-design after T360 grew the gate section to ~496 tok; now assert the raised ~550 ceiling.
- **Added** `test/feature-split-lifecycle.test.mjs` (7 tests).

Spec-to-Test map:

| AC | Test |
|---|---|
| AC1 (status column) | `AC1: Split Table has a status column, pre-filled pending` |
| AC2 (done-marking on PASS) | `AC2: done-marking reconciles split.md against handoff PASS` |
| AC3 (resume — no regenerate) | `AC3: existing plan resumes — does NOT regenerate` |
| AC4 (no redo) | `AC4: a done row is never re-run` |
| AC5 (by-id resume) | `AC5: by-id resume hydrates the named row` |
| AC6 (footprint ≤ ~550) | `AC6: gate section footprint stays within the raised ~550 budget` + the two updated cap tests |
| AC7 (single-feature unaffected) | `AC7: single-feature / no-plan path is preserved` |

Coverage: every AC mapped; the changed gate section is asserted on the status column, reconcile/done semantics, resume/skip-done/no-redo, by-id hydration, footprint ceiling, and no-plan preservation.

## Phase 4 — Run
- `npm test`: **439/439 pass / 0 fail** (was 432; +7 lifecycle, 2 cap tests re-greened), headless.
- Build clean (prebuild tsc + check:version 3.17.0). Content-only → npm audit still 0.

## Verdict
**PASS** — split-plan lifecycle (status column + PASS→done reconcile + resume-skip-done + by-id hydrate) closes the persistent-file/redo gap; always-on footprint within the raised ~550 budget; full suite green.
## 2026-05-31T13:29:45.839Z — PASS — by qa-engineer

PASS. Feature-Scope Gate gains split-plan lifecycle: status(pending/done) column, PASS→done reconcile (match handoff active_feature), resume(existing plan → no regenerate, skip done, next pending or by-id hydrate), never re-run done. Copy audit verbatim ✓. Raised stale footprint caps 425→550 (gate section ~496). 439/439 tests (+7 lifecycle). Evidence: qa_reports/review_T361.md.


# QA Review — design-auditor-volume-guard (T350 + T351 impl, T352 tests)

## Round 1 — PASS — by qa-engineer

## Phase 1 — Review
- **Change**: `skill-design-auditor.md` gains step 2a Volume Gate (pre-fetch) + a node-scoped fetch rule; `skill-coordinator.md` split-schema gains a frame-scoped-link instruction. Prompt-layer, two files.
- Verified structurally: Volume Gate sits between mode-detection and Extract; fetch-modes-only; node-scoped fetch present; coordinator frame-scoped clause present.

### 3a. Copy Audit Gate
Spec *Copy / Strings* — 1 entry, rendered **verbatim**:
- `design-auditor: design source oversized — recommend splitting feature further` ✓.
No drift, no gap.

### 3b. Visual Audit Gate
Spec *Visual Tokens* = N/A (governance content). Pass-through.

## Phase 1.5 — Visual Compare
Skipped (no `design/design-auditor-volume-guard.md`; no `## Visual Baselines`).

## Phase 2 — Discussion
No blocking issues. Code-reviewer's notes (qualitative threshold by design; `2a` sub-step numbering) accepted — tests assert wording/behavior, not a numeric threshold, per that guidance.

## Phase 3 — Tests
Existing content-assertion pattern → added `test/design-auditor-volume-guard.test.mjs` (no prompt needed).

Spec-to-Test map:

| AC | Test |
|---|---|
| AC1 (pre-fetch Volume Gate) | `AC1: Volume Gate (pre-fetch) is present`; `AC1: Volume Gate runs between mode-detection and Extract` |
| AC2 (node-scoped fetch) | `AC2: node-scoped fetch rule present` |
| AC3 (frame-scoped link + footprint) | `AC3: coordinator split schema instructs a frame-scoped Figma link`; `AC3: coordinator gate section stays within the always-on footprint budget` (≤ ~425 tok) |
| AC4 (fail-loud, never silent) | `AC4: Volume Gate fails loud — STOP/Blocked + frame count + split recommendation` |
| AC5 (fetch-modes only; cap kept) | `AC5: gate is fetch-modes only`; `AC5: existing 250-line / 5-pass output cap is unchanged` |

Coverage: the changed prompt artifacts are asserted on gate presence, ordering, fail-loud STOP behavior, node-scoped/frame-scoped rules, mode-scope, output-cap preservation, and always-on footprint. Boundary: footprint ceiling check.

## Phase 4 — Run
- `npm test`: **432/432 pass / 0 fail** (was 424; +8 guard tests), headless.
- Build clean (prebuild tsc + check:version 3.16.3). Content-only → npm audit still 0.

## Verdict
**PASS** — the input-side Volume Gate (pre-fetch, fetch-modes only, oversized→STOP→pm, fail-loud) + node-scoped fetch + coordinator frame-scoped-link guidance close the per-feature design-fetch blowup gap, additive to the existing output cap, within the always-on budget.
## 2026-05-31T12:34:14.915Z — PASS — by qa-engineer

PASS. design-auditor gains pre-fetch Volume Gate (fetch-modes only; oversized single feature→STOP Blocked→pm, fail-loud with frame count, never ingest-then-defer) + node-scoped fetch; coordinator split-schema asks for frame-scoped Figma links. Additive to the 250-line/5-pass output cap (unchanged). Copy audit verbatim ✓. 432/432 tests (+8). Coordinator footprint within budget. Evidence: qa_reports/review_T352.md.


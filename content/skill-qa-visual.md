---
recommended_model: sonnet
---
# Skill: qa-visual

Lazy-loaded by `skill-qa-engineer` SOP step 4 when `design/<feature>.md` declares `## Visual Baselines`. v3.14.0: contract upgraded — output file is now a PASS gate (Constitution §3.1 visual evidence gate) and must include a per-widget shape checklist.

## SOP — Phase 1.5 — Visual Compare

After Phase 1 PASS, before Phase 2. **Output file is `qa_reports/visual_<task-id>.md`** — separate from the main `review_<task-id>.md`. The server checks for this file by name during PASS validation; absence triggers `VISUAL_EVIDENCE_MISSING`.

### Step A — Widget Shape Checklist (v3.14.0, R6)

Open the spec's `## Visual Widgets` H2 (required by skill-pm). For each widget id in the table, emit one markdown checkbox row in `qa_reports/visual_<task-id>.md` under H2 `## Widget Shape Verification`:

```
## Widget Shape Verification
- [x] datetime.picker — column-scroller 5-wheel + AM/PM toggle rendered (verified at <impl path>)
- [ ] keyboard.virtual — MISSING: implementation uses hardware keyboard reliance, no on-screen keyboard widget rendered
```

Rules:
- ONE checkbox per row in spec `## Visual Widgets` (skip rows where `widget id == N/A`).
- `[x]` = widget shape rendered correctly in the corresponding `impl path` screenshot.
- `[ ]` = widget shape missing OR substituted with a primitive (the very gap §1 Visual Widgets exception was designed to catch).
- Any `[ ]` row → **shape FAIL precedes pixel diff**. Route per "Widget shape miss" failure mode below — do NOT proceed to Step B for those surfaces; pixel-perfect on the wrong widget is meaningless.

### Step A.5 — Canonical-State Verification (v3.26.0, R2)

Before any diff, the implementation capture MUST be in the SAME state the baseline depicts.
Each `## Visual Baselines` row carries a `canonical state` (selected item / focused row / scroll
offset / drawer-or-modal open / toggle + segmented values / expected default data). Emit one row per
surface under H2 `## Canonical State Verification`:

```
## Canonical State Verification
- [x] language — baseline state {selected:English, focus:English, scroll:centered}; impl captured in same state
- [ ] network — baseline {drawer:wifi-list open}; impl captured at top-level (STATE MISMATCH)
```

Rules:
- A `[ ]` (state mismatch) is a **capture defect**, NOT visual drift. Do NOT diff it and do NOT
  "accept" it as a difference — recapture the impl in the baseline's state, or FAIL.
- A state mismatch left unresolved blocks PASS (server-checked). The canonical state to drive to is
  supplied by design-auditor/PM/coordinator as context; reaching it is the engineer's/QA's job.

### Step B — Region Diff Per Baseline (v3.26.0, R3)

**Whole-frame pixel-percentage is BANNED as a PASS metric** — a sparse canvas dilutes a localized
structural error (CDE-OOBE Language scored 6% while structurally wrong). Compare the **content/
component region** declared by the baseline's `compare region`, not the full frame.

For each `## Visual Baselines` row:

a. Read both `baseline path` and `impl path` via the Read tool (images render into multimodal context).
b. Emit a structured diff over the declared region covering: (i) layout / position, (ii) spacing /
   alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content. Append under
   `## Region Diff` in `qa_reports/visual_<task-id>.md`, one sub-section per `surface id`. Any material
   difference (not in the qa-owned `## Allowed Differences`) is a drift → FAIL.

### Step C — Structural Assertions (v3.26.0, R3/R-VIS)

Vision "looks similar" is not enough; assert specific structures the design requires. Copy the
spec's `## Visual Structural Assertions` rows (authored by design-auditor) and mark each pass/fail
under H2 `## Structural Assertions`:

```
## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| primary.button.accent | all action screens | primary button uses accent #3C5AAA | token | pass |
| focus.row.bar | language/network/time/mode-adjust | full-width focused-row bar rendered | node | fail |
| group.container.box | mode-adjust/network/time | settings group has bordered container | node | fail |
| mode.selected.description | mode-list | selected card expands + shows description | node | fail |
| declared.token.rendered | per state token | declared focus/selected token renders in that state | token | fail |
```

Any `fail` or unverified row blocks PASS (server-checked). This is what catches the CDE-OOBE class
(missing blue focus bar, flat groups, grey primary button, title-only mode card).

### Allowed Differences (qa-visual-owned ONLY — v3.26.0, R1)

If a difference is acceptable, qa-visual records it under H2 `## Allowed Differences` with a per-item
reason, in THIS report, under a qa-visual / qa-engineer handoff. A coordinator- or builder-authored
acceptance is **void** (Constitution §3.2); the server rejects a PASS whose allowed-diffs were not
qa-authored. An empty `## Allowed Differences` section is valid (means: none).

### Failure modes

- **Widget shape miss** (any unchecked `[ ]` in Step A) → `tw_rollback_task(<task-id>, "QA: Visual Widgets shape miss")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<list of missing widgets>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — widget shape miss", "visual_fail: <widget-id-list>", "next_role: sr-engineer"])`. STOP. The `visual_fail:` prefix in `pending_notes` triggers `visual_round` increment (Constitution §3.1).
- **Pixel drift** (≥ 1 visual difference in Step B with all widget shapes verified) → `tw_rollback_task(<task-id>, "QA: Phase 1.5 pixel drift")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — pixel drift", "visual_fail: pixel", "next_role: sr-engineer"])`. STOP.
- **Missing baseline file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`. STOP. No `visual_fail:` prefix (this is a design-auditor defect, not implementation drift).
- **Missing impl file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing impl screenshot — <path>", "visual_fail: missing_impl", "next_role: sr-engineer"])`. STOP.

### PASS sub-verdict

PASS requires ALL of: every Step A widget checkbox `[x]`; every Step A.5 canonical-state row `[x]`;
every Step C structural assertion `pass`; every Step B region diff reporting no material difference
outside `## Allowed Differences`. Then write final `## Verdict — PASS`. Any unchecked/failed/unverified
row in A, A.5, or C — or a material region diff — blocks PASS.

### Report schema (server-validated — v3.26.0)

`qa_reports/visual_<task-id>.md` MUST contain these H2 sections; the PASS server-parser
(`tools/evidence-file.ts`) rejects PASS on any missing section, any failed/unverified row, or an
`## Allowed Differences` not authored under a qa-visual/qa-engineer handoff:

- `## Widget Shape Verification` (Step A)
- `## Canonical State Verification` (Step A.5)
- `## Structural Assertions` (Step C)
- `## Region Diff` (Step B)
- `## Allowed Differences` (qa-owned; may be empty)
- `## Verdict` (final value `PASS` only when all the above clear)

### Per-widget isolation (v3.26.0, R4)

For custom widgets (every non-`N/A` `## Visual Widgets` row), verify the widget **in isolation** in
`/dev/kitchen-sink` (or the story route) against its Figma component node BEFORE screen-level
assembly diffs. PASS each widget's states (default / focused / selected / disabled / drawer-open /
modal-open) individually. This shrinks blast radius and stops fix-A-break-B screen loops.

### Rationale

- qa-engineer 3b only catches literal-token drift.
- Step A (widget shape) catches the cde-oobe class of failure: correct color/font on the **wrong widget** (`<input type="date">` with the brand palette is still wrong). Shape verification gates pixel diff — getting pixels right on a primitive that should have been a column-scroller wastes iterations.
- Step B (pixel diff) catches non-literal visual drift (layout, spacing, alignment, missing elements, ~5px-grade positioning) via multimodal vision against a user-supplied baseline.
- Output filename `visual_<task-id>.md` is server-checked (Constitution §3.1); using `review_<task-id>.md` instead does NOT satisfy the gate.
- `visual_fail:` `pending_notes` prefix is the trigger token for `visual_round` increment — without it, a pure test-logic FAIL bumps only `qa_round`.

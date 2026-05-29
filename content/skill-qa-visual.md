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

### Step B — Pixel Diff Per Baseline

For each `## Visual Baselines` row (`surface id | baseline path | impl path | notes`):

a. Read both `baseline path` and `impl path` via the Read tool (images render into multimodal context).
b. Emit a structured diff covering: (i) layout / position, (ii) spacing / alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content. Append under `## Pixel Diff` in `qa_reports/visual_<task-id>.md`, one sub-section per `surface id`.

### Failure modes

- **Widget shape miss** (any unchecked `[ ]` in Step A) → `tw_rollback_task(<task-id>, "QA: Visual Widgets shape miss")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<list of missing widgets>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — widget shape miss", "visual_fail: <widget-id-list>", "next_role: sr-engineer"])`. STOP. The `visual_fail:` prefix in `pending_notes` triggers `visual_round` increment (Constitution §3.1).
- **Pixel drift** (≥ 1 visual difference in Step B with all widget shapes verified) → `tw_rollback_task(<task-id>, "QA: Phase 1.5 pixel drift")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — pixel drift", "visual_fail: pixel", "next_role: sr-engineer"])`. STOP.
- **Missing baseline file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`. STOP. No `visual_fail:` prefix (this is a design-auditor defect, not implementation drift).
- **Missing impl file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing impl screenshot — <path>", "visual_fail: missing_impl", "next_role: sr-engineer"])`. STOP.

### PASS sub-verdict

All Step A checkboxes `[x]` AND all Step B diffs report no differences → write final `## Verdict — PASS` section to `qa_reports/visual_<task-id>.md` and proceed to Phase 2. The file's existence + PASS verdict together satisfy Constitution §3.1 visual evidence gate.

### Rationale

- qa-engineer 3b only catches literal-token drift.
- Step A (widget shape) catches the cde-oobe class of failure: correct color/font on the **wrong widget** (`<input type="date">` with the brand palette is still wrong). Shape verification gates pixel diff — getting pixels right on a primitive that should have been a column-scroller wastes iterations.
- Step B (pixel diff) catches non-literal visual drift (layout, spacing, alignment, missing elements, ~5px-grade positioning) via multimodal vision against a user-supplied baseline.
- Output filename `visual_<task-id>.md` is server-checked (Constitution §3.1); using `review_<task-id>.md` instead does NOT satisfy the gate.
- `visual_fail:` `pending_notes` prefix is the trigger token for `visual_round` increment — without it, a pure test-logic FAIL bumps only `qa_round`.

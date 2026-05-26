# Skill: qa-visual

Lazy-loaded by `skill-qa-engineer` SOP step 4 when `design/<feature>.md` declares `## Visual Baselines`. Contract identical to v3.8.2 Phase 1.5.

## SOP — Phase 1.5 — Visual Compare

After Phase 1 PASS, before Phase 2. For each `## Visual Baselines` row (`surface id | baseline path | impl path | notes`):

a. Read both `baseline path` and `impl path` via the Read tool (images render into multimodal context).
b. Emit a structured diff covering: (i) layout / position, (ii) spacing / alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content. Append under `## Phase 1.5 — Visual Compare` in `qa_reports/review_<task-id>.md`, one sub-section per `surface id`.

**Failure modes**:
- **Drift** (≥ 1 visual difference) → `tw_rollback_task(<task-id>, "QA: Phase 1.5 visual drift")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — visual drift", "next_role: sr-engineer"])`. STOP.
- **Missing baseline file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`. STOP.
- **Missing impl file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing impl screenshot — <path>", "next_role: sr-engineer"])`. STOP.

**PASS sub-verdict** (no differences across all rows) → proceed to Phase 2.

Rationale: qa-engineer 3b only catches literal-token drift. Phase 1.5 catches non-literal visual drift (layout, spacing, alignment, missing elements, ~5px-grade positioning) via multimodal vision against a user-supplied baseline. Source-agnostic: any image format the design source produced is consumable.

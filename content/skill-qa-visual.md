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
structural error (a prior surface scored 6% while structurally wrong). Compare the **content/
component region** declared by the baseline's `compare region`, not the full frame.

Step B runs in stages: a round-≥2 carry-forward gate (**Step B0**) that skips already-passing
untouched surfaces entirely, a deterministic pixel-diff pre-screen (**Step B1**) that decides which
remaining surfaces need eyes, then the LLM region diff (**Step B2**) for only the surfaces that
pre-screen escalates. The multimodal image Read happens in **B2 only** — neither B0 nor B1 loads an
image into context.

#### Step B0 — Round-≥2 Carry-Forward Gate (v3.36.0, B10)

On the FIRST visual round (`visual_round` is `0`/`1`, or no prior `qa_reports/visual_<task-id>.md`
`## Region Diff` table exists) this step is a no-op: diff every surface via Step B1/B2 below.

From `visual_round ≥ 2`, re-verify ONLY the surfaces that could have regressed and carry the rest
forward without re-reading images. For each `## Visual Baselines` row:

a. **Always re-diff (Step B1/B2)** any surface whose result in the prior round's `## Region Diff`
   table was `fail` or `accepted`, OR that was newly recaptured this round (a Step A.5 canonical-state
   mismatch corrected since last round). These surfaces get a full diff regardless of `git diff`.
b. For a surface whose prior-round result was `pass`, check `git diff` scoped to the files/paths the
   sr-engineer's fix touched this round (the handoff/`pending_notes` and the actual changed paths):
   - **`git diff` confirms that surface's source is untouched** → carry it forward: write the surface
     as a `pass` row in this round's `## Region Diff` result table WITHOUT reading its `baseline path`
     or `impl path`. Put the annotation `pass (carried forward — git diff confirms source untouched)`
     in the surface's prose sub-section under `## Region Diff`; the parsed result **cell** stays exactly
     `pass` (see Step B2 — annotations never go in the result cell, or the server parser stops seeing
     the row).
   - **`git diff` cannot prove the surface untouched** — diff unavailable, the surface's source path is
     unknown, or the diff touches a shared/common file (shared component, global stylesheet, design
     token) that could affect the surface — → **fall back to a full re-diff** of that surface via Step
     B1/B2, exactly as if it were round 1. When in doubt, re-diff; carry-forward is only for a
     provably-untouched surface.

Carried-forward surfaces still appear in the `## Region Diff` table and in the `## Verdict` accounting,
so a round-≥2 report stays self-contained: every `## Visual Baselines` surface has a row every round.

#### Step B1 — Deterministic Pixel-Diff (tool-first gate)

Before loading ANY image into multimodal context, run a deterministic CLI pixel-diff tool over each
baseline's declared `compare region` (NOT the full frame — see the ban above; running over the full
frame would reintroduce the banned whole-frame metric by a different path). No wrapper script and no
new npm dependency exists at MVP; invoke an already-installed CLI directly via Bash. Use whichever of
these is available:

- `odiff <baseline> <impl> <diff-out>` — reports a changed-pixel count / percentage and exit code.
- `pixelmatch` (CLI) — reports the number of differing pixels.
- ImageMagick `compare -metric AE <baseline> <impl> <diff-out>` — reports an absolute pixel-difference count.

Crop both `baseline path` and `impl path` to the declared `compare region` before diffing (e.g. via
`magick <img> -crop <WxH+X+Y> <region-out>`), so the deterministic metric is computed over the SAME
region the LLM would judge, never the full frame.

For each `## Visual Baselines` row not already carried forward by Step B0:

a. Run the tool over the cropped `compare region`.
b. Compare the tool's numeric output (diff percentage or differing-pixel count) against the baseline's
   per-baseline declared threshold (default: `0%` / `0` differing pixels / tool-reported "identical").
   - **At or below threshold** → record the surface as `pass` directly in the `## Region Diff` result
     table WITHOUT reading either image into multimodal context. Note `pre-screened by <tool>: <metric>`
     in that surface's prose sub-section.
   - **Above threshold** → escalate the surface to Step B2 (do not record a verdict yet).
- **Tool unavailable** (binary absent, Bash not permitted, or crop/diff errors) → fall back to the
  Step B2 LLM path for that surface (treat it as escalated), and note `B1 tool unavailable — LLM
  fallback` in its prose sub-section.

#### Step B2 — LLM Region Diff (escalated surfaces only)

For each surface escalated by Step B1 (above threshold, or tool unavailable):

a. Read both `baseline path` and `impl path` via the Read tool (images render into multimodal context).
b. Emit a structured diff over the declared region covering: (i) layout / position, (ii) spacing / alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content. Append under `## Region Diff` in `qa_reports/visual_<task-id>.md`, one prose sub-section per `surface id`, AND a **per-surface result table** the server parses: `| surface | result |` where `result` ∈ `pass` (no material difference) / `accepted` (difference recorded in `## Allowed Differences`) / `fail` (material drift). Any row not `pass`/`accepted` blocks PASS.

Every surface — whether B1-pre-screened `pass` or B2-judged — MUST appear as a row in the single
`## Region Diff` `| surface | result |` table. The result cell value MUST be exactly `pass` /
`accepted` / `fail` (no trailing annotation in that cell); any explanatory note goes in the surface's
prose sub-section, never in the parsed result cell.

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

Any `fail` or unverified row blocks PASS (server-checked). This is what catches the false-PASS class
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
- Step A (widget shape) catches the wrong-widget class of failure: correct color/font on the **wrong widget** (`<input type="date">` with the brand palette is still wrong). Shape verification gates pixel diff — getting pixels right on a primitive that should have been a column-scroller wastes iterations.
- Step B (pixel diff) catches non-literal visual drift (layout, spacing, alignment, missing elements, ~5px-grade positioning) via multimodal vision against a user-supplied baseline.
- Step B0 (carry-forward, B10) cuts cross-round redundancy: from round ≥2 it skips re-reading images for surfaces that already passed and whose source `git diff` proves untouched, so image-read cost is paid only for surfaces that could have regressed. Re-diff is the safe default — carry-forward fires only on provable evidence.
- Step B1 (deterministic pre-screen, B11) cuts within-round per-surface cost: a CLI pixel-diff over the `compare region` decides which surfaces need eyes, so identical/sub-threshold surfaces never consume multimodal tokens. It runs over the `compare region`, never the full frame, so the whole-frame-ban metric is not reintroduced.
- Output filename `visual_<task-id>.md` is server-checked (Constitution §3.1); using `review_<task-id>.md` instead does NOT satisfy the gate.
- `visual_fail:` `pending_notes` prefix is the trigger token for `visual_round` increment — without it, a pure test-logic FAIL bumps only `qa_round`.

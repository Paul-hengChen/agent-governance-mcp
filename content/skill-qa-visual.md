---
recommended_model: sonnet
---
# Skill: qa-visual

Lazy-loaded by `skill-qa-engineer` SOP step 4 when `design/<feature>.md` declares `## Visual Baselines`. v3.14.0: contract upgraded — output file is now a PASS gate (Constitution §3.1 visual evidence gate) and must include a per-widget shape checklist.

## SOP — Phase 1.5 — Visual Compare

After Phase 1 PASS, before Phase 2. **Output file is `qa_reports/visual_<task-id>.md`** — separate from the main `review_<task-id>.md`. The server checks for this file by name during PASS validation; absence triggers `VISUAL_EVIDENCE_MISSING`.

### Step A.0 — Baseline Source-of-Truth (v3.39.0)

Before any widget/state/diff work, fix WHICH baseline node ids you are comparing against. The
authoritative source is the design-auditor's frozen **Source manifest** in `design/<feature>.md`
(produced by `skill-design-auditor` step 2c, *Mechanical baseline selection*). You MUST copy that
manifest's baseline node-id list — and its declared `## Visual Baselines` rows — **verbatim**. You
MUST NOT re-derive the baseline set from the Figma URL (or any source URL): no re-fetching the board
and re-picking frames, no name-globbing or spatial/`componentId` grouping of your own. The node-id
list was locked, with filter conditions and exclusion reasons, at audit time precisely so baseline
identity does not drift between audit and verification — re-deriving it here reintroduces the
non-determinism (漏抓 / 誤收) that step 2c exists to eliminate. If the Source manifest is missing or
its frozen node-id list is absent, this is a design-auditor defect: STOP and
`tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review="Source manifest missing frozen baseline node-id list", pending_notes=["QA: baseline node-id manifest absent — re-derivation forbidden", "next_role: design-auditor"])`.
Do NOT substitute your own URL-derived set. (Paired downstream half of Constitution §3.2 builder≠judge
provenance; method: `research/figma-baselines.md`.)

**Server-enforced at PASS (v3.40.0 baseline manifest gate, Constitution §3.1).** The Source manifest
is now machine-checked, so the manual STOP above is backstopped by the server: an armed design whose
`## Source` manifest has zero `status: audited` rows blocks PASS with `BASELINE_MANIFEST_MISSING`, and a
multi-surface manifest (≥2 audited rows) missing a `## Baseline Selection Provenance` section with both
`filter-conditions:` and `exclusion-reasons:` lines blocks PASS with `BASELINE_PROVENANCE_INCOMPLETE`.
You still do the Step A.0 verbatim copy and the FAIL-back on a missing manifest — the gate cannot
catch URL re-derivation, only manifest absence/incompleteness.

### Step A — Widget Shape Checklist (v3.14.0, R6)

Open the spec's `## Visual Widgets` H2 (required by skill-pm). For each widget id in the table, emit one markdown checkbox row in `qa_reports/visual_<task-id>.md` under H2 `## Widget Shape Verification`:

```
## Widget Shape Verification
- [x] datetime.picker — column-scroller 5-wheel + AM/PM toggle rendered (verified at <impl path>)
- [ ] keyboard.virtual — MISSING: impl relies on hardware keyboard, no on-screen keyboard widget
```

Rules:
- ONE checkbox per spec `## Visual Widgets` row (skip `widget id == N/A`).
- `[x]` = widget shape rendered correctly in the corresponding `impl path` screenshot.
- `[ ]` = widget shape missing OR substituted with a primitive (the gap §1 Visual Widgets catches).
- Any `[ ]` → **shape FAIL precedes pixel diff**. Route per "Widget shape miss" below; do NOT proceed to Step B for those surfaces — pixel-perfect on the wrong widget is meaningless. The server likewise rejects PASS while any row is unchecked (`VISUAL_WIDGETS_UNVERIFIED`).

### Step A.5 — Canonical-State Verification (v3.26.0, R2)

Before any diff, the impl capture MUST be in the SAME state the baseline depicts. Each `## Visual
Baselines` row carries a `canonical state` (selected item / focused row / scroll offset / drawer-or-
modal open / toggle + segmented values / expected default data). Emit one row per surface under H2
`## Canonical State Verification`:

```
## Canonical State Verification
- [x] language — baseline state {selected:English, focus:English, scroll:centered}; impl captured in same state
- [ ] network — baseline {drawer:wifi-list open}; impl captured at top-level (STATE MISMATCH)
```

Rules:
- A `[ ]` (state mismatch) is a **capture defect**, NOT visual drift. Do NOT diff or "accept" it —
  recapture the impl in the baseline's state, or FAIL. Unresolved, it blocks PASS (server-checked).
  The canonical state to drive to is supplied as context; reaching it is the engineer's/QA's job.
- **Context-dependent multi-value guard (v3.38.0):** if, during Step A.5 or Step B adjudication, you
  discover a visual property that has MORE than one correct value depending on context (e.g. a
  component that renders differently when focused vs. unfocused, or selected vs. unselected), you
  MUST NOT pick one value as "correct" and accept/fail on the other. Instead, record BOTH contexts as
  separate baselines (or flag the surface as needing a re-audit with per-context baselines) and FAIL
  the current surface with note: "context-dependent property requires per-context baseline — see
  §四#7 in `research/mode-feature-process-retrospective.md`". Per Constitution §3.2 (builder≠judge),
  adjudicating a multi-value property as single-choice is a contract defect, not an implementation
  defect.

### Step B — Region Diff Per Baseline (v3.26.0, R3)

**Whole-frame pixel-percentage is BANNED as a PASS metric** — a sparse canvas dilutes a localized
structural error (a prior surface scored 6% while structurally wrong). Compare the **content/component
region** declared by the baseline's `compare region`, never the full frame.

Step B runs in stages: a round-≥2 carry-forward gate (**Step B0**) skipping already-passing untouched
surfaces, a deterministic pixel-diff pre-screen (**Step B1**) deciding which survivors need eyes, then
the LLM region diff (**Step B2**) for only the escalated surfaces. The multimodal image Read happens
in **B2 only** — neither B0 nor B1 loads an image.

#### Step B0 — Round-≥2 Carry-Forward Gate (v3.36.0, B10)

On the FIRST visual round (`visual_round` `0`/`1`, or no prior `## Region Diff` table exists) this
step is a no-op: diff every surface via Step B1/B2 below.

From `visual_round ≥ 2`, re-verify ONLY surfaces that could have regressed; carry the rest forward
without re-reading images. For each `## Visual Baselines` row:

a. **Always re-diff (Step B1/B2)** any surface whose prior-round result was `fail`/`accepted`, or
   newly recaptured this round (Step A.5 mismatch corrected). Full diff regardless of `git diff`.
b. For a prior-round `pass` surface, check `git diff` scoped to the paths the sr-engineer touched
   this round (handoff `pending_notes` + actual changed paths):
   - **`git diff` confirms that surface's source untouched** → carry forward: write it as a `pass`
     row WITHOUT reading its `baseline path`/`impl path`, annotating its prose sub-section
     `pass (carried forward — git diff confirms source untouched)`. The result **cell** stays exactly
     `pass` (annotations never go in the cell, or the parser drops the row). A carry-forward surface is
     EXEMPT from `baseline:`/`diff-metric:` — the `git diff` proof replaces the re-diff, so do NOT add
     those fields; the annotation alone exempts it (`VISUAL_PROVENANCE_MISSING` honors AC-3).
   - **`git diff` cannot prove it untouched** (diff unavailable, source path unknown, or it touches a
     shared file — shared component, global stylesheet, design token) → **full re-diff** via Step
     B1/B2 as if round 1. When in doubt, re-diff; carry-forward needs provable evidence.

Carried-forward surfaces still appear in the `## Region Diff` table and in the `## Verdict` accounting,
so a round-≥2 report stays self-contained: every `## Visual Baselines` surface has a row every round.

#### Step B1 — Deterministic Pixel-Diff (tool-first gate)

Before loading ANY image into multimodal context, run a deterministic CLI pixel-diff over each
baseline's declared `compare region` (NOT the full frame — that would reintroduce the banned
whole-frame metric). No wrapper script / new npm dep at MVP; invoke an already-installed CLI via Bash:

- `odiff <baseline> <impl> <diff-out>` — changed-pixel count/percentage + exit code.
- `pixelmatch` (CLI) — number of differing pixels.
- ImageMagick `compare -metric AE <baseline> <impl> <diff-out>` — absolute pixel-difference count.

Crop both `baseline path` and `impl path` to the `compare region` first (e.g. `magick <img> -crop
<WxH+X+Y> <region-out>`), so the metric is computed over the SAME region the LLM would judge.

For each `## Visual Baselines` row not already carried forward by Step B0:

a. Run the tool over the cropped `compare region`.
b. Compare the numeric output against the baseline's declared threshold (default: `0%` / `0` pixels /
   tool-reported "identical").
   - **At or below threshold** → record `pass` in the `## Region Diff` table WITHOUT reading either
     image. In that surface's `### <surface id>` prose sub-section note `pre-screened by <tool>:
     <metric>`, plus the two provenance lines the `VISUAL_PROVENANCE_MISSING` gate reads:
     ```
     - baseline: <fingerprint — content-hash of the downloaded Figma export, OR the Figma node id passed to mcp__figma__download_figma_images>
     - diff-metric: <tool output — e.g. "odiff: 0 px (0%)" or "ImageMagick AE: 0">
     - pixel_gate_complete: true
     ```
     The `pixel_gate_complete: true` line is REQUIRED (v3.42.0 `PIXEL_GATE_ATTESTATION_MISSING` gate):
     it positively attests the pixel diff ran to completion for this surface. A placeholder
     `diff-metric:` (`N/A`, `skipped`, `dimensionsMatch=false`, …) is rejected by
     `VISUAL_PROVENANCE_MISSING` — record a real metric or take the FAIL path.
   - **Above threshold** → escalate to Step B2 (no verdict yet).
- **Tool unavailable** (binary absent, Bash blocked, or crop/diff errors) → treat the surface as
  escalated to the Step B2 LLM path, noting `B1 tool unavailable — LLM fallback` in its prose
  sub-section. The fallback surface STILL records a `baseline:` line (the LLM must read a real
  baseline to diff). In its `### <surface id>` prose sub-section:
  ```
  - baseline: <fingerprint>
  - diff-metric: B1 tool unavailable — LLM fallback
  - pixel_gate_complete: true
  ```
  The `B1 tool unavailable — LLM fallback` token is the `diff-metric:` value here; the gate accepts a
  null numeric metric when it is present (AC-4), but a missing `baseline:` still fails. The
  `B1 tool unavailable — LLM fallback` token exempts the surface from a *numeric* diff-metric only —
  it does NOT exempt it from `pixel_gate_complete: true` (v3.42.0 AC-5). The LLM-fallback path is a
  valid *execution* of the pixel gate (the LLM completes the comparison in Step B2), not a skip, so
  the attestation is still required once the comparison finishes.

#### Step B2 — LLM Region Diff (escalated surfaces only)

For each surface escalated by Step B1 (above threshold, or tool unavailable):

a. Read both `baseline path` and `impl path` via the Read tool (images render into multimodal context).
b. Emit a structured diff over the region covering: (i) layout/position, (ii) spacing/alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content. Append under `## Region Diff`, one prose sub-section per `surface id`, AND a **per-surface result table** the server parses: `| surface | result |` where `result` ∈ `pass` (no material difference) / `accepted` (recorded in `## Allowed Differences`) / `fail` (material drift). Any row not `pass`/`accepted` blocks PASS.

   **Heading convention (binding — the provenance parser anchors on it):** each surface's prose
   sub-section MUST be introduced by a `### <surface id>` heading (one heading per surface; do NOT
   nest deeper `####` sub-headings under it — each `###`–`######` heading is parsed as its own
   surface) under `## Region Diff`, where `<surface id>` matches the `| surface | result |` table.
   Prose without such a sub-heading is NOT parsed as a provenance row. Each non-carry-forward
   sub-section MUST also include the three lines the provenance + attestation gates read:
   ```
   - baseline: <fingerprint of the baseline image read via the Read tool>
   - diff-metric: <quantified region delta — pixel/% estimate, or the qualitative judgement behind the cell>
   - pixel_gate_complete: true
   ```
   `pixel_gate_complete: true` is REQUIRED once the LLM comparison completes (v3.42.0
   `PIXEL_GATE_ATTESTATION_MISSING` gate) — it attests the pixel gate ran to completion for this
   surface. Carry-forward surfaces (Step B0) are exempt.

Every surface — B1-pre-screened `pass` or B2-judged — MUST appear as a row in the single `## Region
Diff` `| surface | result |` table. The result cell MUST be exactly `pass`/`accepted`/`fail` (no
trailing annotation); any note goes in the prose sub-section, never in the parsed result cell.

### Step C — Structural Assertions (v3.26.0, R3/R-VIS)

Vision "looks similar" is not enough; assert specific structures the design requires. Copy the
spec's `## Visual Structural Assertions` rows (authored by design-auditor) and mark each pass/fail
under H2 `## Structural Assertions`:

```
## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| primary.button.accent | all action screens | primary button uses accent #3C5AAA | token | pass |
| focus.row.bar | language/network/time | full-width focused-row bar rendered | node | fail |
| group.container.box | mode-adjust/network | settings group has bordered container | node | fail |
| mode.selected.description | mode-list | selected card expands + shows description | node | fail |
| declared.token.rendered | per state token | declared token renders in that state | token | fail |
```

Any `fail` or unverified row blocks PASS (server-checked). This is what catches the false-PASS class
(missing blue focus bar, flat groups, grey primary button, title-only mode card).

### Allowed Differences (qa-visual-owned ONLY — v3.26.0, R1)

If a difference is acceptable, qa-visual records it under H2 `## Allowed Differences` with a per-item
reason, in THIS report, under a qa-visual/qa-engineer handoff. A coordinator- or builder-authored
acceptance is **void** (Constitution §3.2); the server rejects a PASS whose allowed-diffs were not
qa-authored. An empty section is valid (means: none).

### Failure modes

- **Widget shape miss** (any unchecked `[ ]` in Step A) → `tw_rollback_task(<task-id>, "QA: Visual Widgets shape miss")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<list of missing widgets>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — widget shape miss", "visual_fail: <widget-id-list>", "next_role: sr-engineer"])`. STOP. The `visual_fail:` prefix in `pending_notes` triggers `visual_round` increment (Constitution §3.1).
- **Pixel drift** (≥ 1 visual difference in Step B with all widget shapes verified) → `tw_rollback_task(<task-id>, "QA: Phase 1.5 pixel drift")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — pixel drift", "visual_fail: pixel", "next_role: sr-engineer"])`. STOP.
- **Missing baseline file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`. STOP. No `visual_fail:` prefix (this is a design-auditor defect, not implementation drift).
- **Dimension/scale mismatch** (`comparePngRegion`/tool reports `dimensionsMatch=false` — e.g. baseline exported @1× but impl captured @2×) → this is a hard FAIL, NOT a graceful skip and NOT an Allowed Difference. The surface MUST NOT be recorded `pass`/`accepted`. Re-export the baseline at the correct scale and re-run the diff; if it cannot be re-exported now, take the missing-baseline path: `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<detail>, pending_notes=["QA: missing baseline — dimension mismatch @Nx vs @Nx <surface>", "next_role: design-auditor"])`. STOP. Do NOT write `diff-metric: dimensionsMatch=false` and claim `pass` — the server rejects `dimensionsMatch=false` as a placeholder diff-metric (v3.42.0 AC-6, `VISUAL_PROVENANCE_MISSING`).
- **Missing impl file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing impl screenshot — <path>", "visual_fail: missing_impl", "next_role: sr-engineer"])`. STOP.

### PASS sub-verdict

PASS requires ALL of: every Step A widget checkbox `[x]`; every Step A.5 canonical-state row `[x]`;
every Step C structural assertion `pass`; every Step B region diff with no material difference outside
`## Allowed Differences`. Then write final `## Verdict — PASS`. Any unchecked/failed/unverified row in
A, A.5, or C — or a material region diff — blocks PASS.

### Report schema (server-validated — v3.26.0)

`qa_reports/visual_<task-id>.md` MUST contain these H2 sections; the PASS server-parser
(`tools/evidence-file.ts`) rejects PASS on any missing section, any failed/unverified row, or an
`## Allowed Differences` not authored under a qa-visual/qa-engineer handoff:

- `## Widget Shape Verification` (Step A)
- `## Canonical State Verification` (Step A.5)
- `## Structural Assertions` (Step C)
- `## Region Diff` (Step B) — each non-carry-forward surface's `### <surface id>` sub-section carries
  THREE required prose fields: a `baseline:` fingerprint and a `diff-metric:` value (read by the
  `VISUAL_PROVENANCE_MISSING` gate), plus `pixel_gate_complete: true` (read by the v3.42.0
  `PIXEL_GATE_ATTESTATION_MISSING` gate, attesting the pixel diff ran to completion). Carry-forward
  surfaces are exempt from all three; the `B1 tool unavailable — LLM fallback` token satisfies
  diff-metric but does NOT exempt the surface from `pixel_gate_complete: true` (AC-5). A placeholder
  diff-metric (`N/A`, `skipped`, `dimensionsMatch=false`, …) is rejected as absent (AC-1/AC-6).
  See `specs/qa-visual-baseline-provenance.md` and `specs/qa-visual-pixel-gate-attestation.md`.
- `## Allowed Differences` (qa-owned; may be empty)
- `## Verdict` (final value `PASS` only when all the above clear)

### Per-widget isolation (v3.26.0, R4)

For custom widgets (every non-`N/A` `## Visual Widgets` row), verify the widget **in isolation** in
`/dev/kitchen-sink` (or the story route) against its Figma component node BEFORE screen-level assembly
diffs. PASS each widget's states (default/focused/selected/disabled/drawer-open/modal-open)
individually. This shrinks blast radius and stops fix-A-break-B screen loops.

### Rationale

- qa-engineer 3b only catches literal-token drift.
- Step A (widget shape) catches the wrong-widget class: correct color/font on the **wrong widget** (`<input type="date">` in brand palette is still wrong). Shape gates pixel diff — pixels right on a primitive that should be a column-scroller wastes iterations.
- Step B (pixel diff) catches non-literal drift (layout, spacing, alignment, missing elements, ~5px positioning) via multimodal vision against a user-supplied baseline.
- Step B0 (carry-forward, B10) cuts cross-round redundancy: from round ≥2, surfaces that already passed and whose source `git diff` proves untouched skip the image re-read. Re-diff is the safe default; carry-forward needs provable evidence.
- Step B1 (deterministic pre-screen, B11) cuts within-round cost: a CLI pixel-diff over the `compare region` (never the full frame) decides which surfaces need eyes, so identical/sub-threshold surfaces consume no multimodal tokens.
- Output filename `visual_<task-id>.md` is server-checked (Constitution §3.1); using `review_<task-id>.md` instead does NOT satisfy the gate.
- `visual_fail:` `pending_notes` prefix is the trigger token for `visual_round` increment — without it, a pure test-logic FAIL bumps only `qa_round`. Past the cap (Round 6), only `(pm, In_Progress)` is accepted (else `VISUAL_ROUND_EXCEEDED`).

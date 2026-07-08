---
recommended_model: sonnet
---
# Skill: qa-visual

Lazy-loaded by `skill-qa-engineer` SOP step 4 when `design/<feature>.md` declares `## Visual Baselines`. Runs after Phase 1 PASS, before Phase 2. Output is **`qa_reports/visual_<task-id>.md`** (sanitized task id; separate from `review_<task-id>.md`, which does NOT satisfy the gate) — itself a server-checked PASS gate (Constitution §3.1): absence triggers `VISUAL_EVIDENCE_MISSING`.

## SOP — Phase 1.5 — Visual Compare

### Step A.0 — Baseline Source-of-Truth (v3.39.0)

Before any widget/state/diff work, fix WHICH baseline node ids you compare against. The authoritative source is the design-auditor's frozen **Source manifest** in `design/<feature>.md`: copy its baseline node-id list — and its declared `## Visual Baselines` rows — **verbatim**. You MUST NOT re-derive the baseline set from the Figma URL (or any source URL): no re-fetching the board and re-picking frames, no name-globbing, no spatial/`componentId` grouping of your own. The list was frozen at audit time (with filter conditions and exclusion reasons) precisely so baseline identity cannot drift between audit and verification. If the Source manifest or its frozen node-id list is absent, that is a design-auditor defect: STOP via the error table below — do NOT substitute your own URL-derived set. The server backstop (`BASELINE_MANIFEST_MISSING` / `BASELINE_PROVENANCE_INCOMPLETE` rows below) catches manifest absence/incompleteness only; it cannot catch URL re-derivation — the verbatim copy is on you. (§3.2 builder≠judge provenance; method: `research/figma-baselines.md`.)

### Step A — Widget Shape Checklist

For each row of the spec's `## Visual Widgets` table (skip `widget id == N/A`), emit ONE checkbox row under H2 `## Widget Shape Verification`, shape `- [x] <id> — <description>` (mark `x`/`X` = checked, anything else = unchecked; id splits from description at the first ` — ` or ` - `; Step A.5 rows are parsed the same way):

- `[x]` = widget shape rendered correctly in the corresponding `impl path` screenshot.
- `[ ]` = widget shape missing OR substituted with a primitive (the gap Constitution §1 Visual Widgets catches).
- Any `[ ]` → **shape FAIL precedes pixel diff**: route per the error table; do NOT proceed to Step B for those surfaces — pixel-perfect on the wrong widget is meaningless. The server likewise rejects PASS while any row is unchecked.

### Step A.5 — Canonical-State Verification

Before any diff, the impl capture MUST be in the SAME state the baseline depicts — each `## Visual Baselines` row carries a `canonical state` (selected item / focused row / scroll offset / drawer-or-modal open / toggle + segmented values / expected default data). Emit one checkbox row per surface under H2 `## Canonical State Verification`. A `[ ]` (state mismatch) is a **capture defect**, NOT visual drift: do NOT diff or "accept" it — recapture the impl in the baseline's state, or FAIL; unresolved, it blocks PASS (server-checked). Reaching the canonical state is the engineer's/QA's job. **Multi-value guard:** if a property has MORE than one correct value depending on context (focused vs unfocused, selected vs unselected), you MUST NOT adjudicate one value as "correct" — record BOTH contexts as separate baselines (or flag the surface for re-audit with per-context baselines) and FAIL it with note: "context-dependent property requires per-context baseline — see §四#7 in `research/mode-feature-process-retrospective.md`". Per Constitution §3.2, single-choice adjudication of a multi-value property is a contract defect, not an implementation defect.

### Step B — Region Diff

**Whole-frame pixel-percentage is BANNED as a PASS metric** — a sparse canvas dilutes a localized structural error. Always compare the baseline's declared `compare region`, never the full frame. Step B runs in three sub-stages; images are Read into multimodal context in B2 ONLY.

**Step B0 — carry-forward gate (round ≥ 2).** On the first visual round (`visual_round` `0`/`1`, or no prior `## Region Diff` table exists) this is a no-op: diff every surface via B1/B2. From round ≥ 2: always re-diff (B1/B2) any surface whose prior-round result was `fail`/`accepted`, or newly recaptured this round. A prior-round `pass` surface whose source `git diff` — scoped to the paths the sr-engineer touched this round — proves untouched is carried forward WITHOUT reading its `baseline path`/`impl path`: its result cell stays exactly `pass`, and its prose sub-section is annotated `pass (carried forward — git diff confirms source untouched)` (annotations never go in the result cell, or the parser drops the row). If `git diff` cannot prove it untouched (diff unavailable, source path unknown, or a shared file — shared component, global stylesheet, design token) → full re-diff; when in doubt, re-diff — carry-forward needs provable evidence. Carried-forward surfaces still appear in the `## Region Diff` table and the `## Verdict` accounting: every surface has a row every round.

**Step B1 — deterministic pre-screen (tool-first).** Crop both `baseline path` and `impl path` to the `compare region` (e.g. `magick <img> -crop <WxH+X+Y> <out>`), then run an already-installed CLI pixel diff over the crops — `odiff`, `pixelmatch`, or ImageMagick `compare -metric AE` (no wrapper script / new npm dep at MVP). Compare the numeric output against the baseline's declared threshold (default: `0%` / `0` pixels / tool-reported "identical"):

- **At/below threshold** → record `pass` WITHOUT reading either image; in the surface's prose sub-section note `pre-screened by <tool>: <metric>` and write the three provenance lines (matrix below).
- **Above threshold** → escalate to B2 (no verdict yet).
- **Tool unavailable** (binary absent, Bash blocked, or crop/diff errors) → escalate to B2, recording `B1 tool unavailable — LLM fallback` as the surface's `diff-metric:` value. A real `baseline:` line is still required (the LLM must read a real baseline to diff), and so is `pixel_gate_complete: true` once the B2 comparison finishes — the fallback is a valid *execution* of the pixel gate, not a skip.

**Step B2 — LLM region diff (escalated surfaces only).** Read both `baseline path` and `impl path` via the Read tool (multimodal vision against a user-supplied baseline) and emit a structured diff over the region covering (i) layout/position, (ii) spacing/alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content.

**Output (all sub-stages), under H2 `## Region Diff`:** one prose sub-section per `surface id`, introduced by a `### <surface id>` heading matching the table (any H3–H6 heading parses as its own surface — do NOT nest deeper sub-headings inside a surface's block; prose without a sub-heading is not parsed for provenance), PLUS one `| surface | result |` table with a row for EVERY `## Visual Baselines` surface — B0, B1, and B2 alike. The result cell MUST be exactly `pass` / `accepted` / `fail`: `accepted` means the difference is recorded in `## Allowed Differences`; anything else (including a blank cell) blocks PASS; notes go in the prose sub-section, never in the parsed cell.

### Provenance matrix — what each surface class owes

Single source of truth for the per-surface prose fields under `## Region Diff` (label lines accept an optional bullet/bold and a `:`/`—`/`-` separator; the `pixel_gate_complete:` value must normalize to exactly `true`):

| surface class | `baseline:` | `diff-metric:` | `pixel_gate_complete:` |
|---|---|---|---|
| Carry-forward (Step B0, prior-round `pass` + proven untouched) | exempt | exempt | exempt |
| B1 pre-screened pass (auto pass, at/below threshold) | required | required (numeric) | required |
| B1 tool unavailable (LLM fallback) | required | required (`B1 tool unavailable — LLM fallback` token) | required |
| B2 LLM-judged (escalated, above threshold) | required | required (quantified/qualitative) | required |

- `baseline:` value = fingerprint — content-hash of the downloaded Figma export, OR the Figma node id passed to `mcp__figma__download_figma_images`. REJECTED placeholder values (count as absent): `<fingerprint>`, `todo`, `tbd`, `n/a`, `none`, `-`, empty (case-insensitive).
- `diff-metric:` value = tool output (e.g. `odiff: 0 px (0%)`, `ImageMagick AE: 0`) or the quantified/qualitative B2 judgement. REJECTED placeholder values (count as absent): `n/a`, `skipped`, `skip`, `dimensionsMatch=false`, `dimensions mismatch`, `todo`, `tbd`, `none`, `-`, empty (case-insensitive, whitespace-collapsed) — record a real metric or take the FAIL path.
- The fallback token exempts a surface from a *numeric* diff-metric ONLY — never from `baseline:` or `pixel_gate_complete: true`.

### Step C — Structural Assertions

Vision "looks similar" is not enough. Copy the spec's `## Visual Structural Assertions` rows (design-auditor-authored) into a table under H2 `## Structural Assertions` and mark each row's LAST cell `pass` or `fail` (the header row is the one with an `assertion id` cell; any last-cell value other than `pass` counts as failed). Any failed/unverified row blocks PASS (server-checked). This is what catches the false-PASS class: missing focus bar, flat groups, grey primary button, title-only card.

### Allowed Differences (qa-visual-owned ONLY)

An acceptable difference is recorded under H2 `## Allowed Differences` with a per-item reason, in THIS report, under a qa-visual/qa-engineer handoff. A coordinator- or builder-authored acceptance is **void** (Constitution §3.2); the server rejects a PASS whose allowed-diffs were not qa-authored. An empty section is valid (means: none).

### Per-widget isolation

For every custom widget (non-`N/A` `## Visual Widgets` row), verify the widget **in isolation** in `/dev/kitchen-sink` (or the story route) against its Figma component node BEFORE screen-level assembly diffs, PASSing each state (default/focused/selected/disabled/drawer-open/modal-open) individually. This shrinks blast radius and stops fix-A-break-B screen loops.

### PASS sub-verdict

PASS requires ALL of: every Step A checkbox `[x]`; every Step A.5 row `[x]`; every Step C assertion `pass`; every Step B surface `pass`/`accepted` with no material difference outside `## Allowed Differences`. Then write `## Verdict — PASS` as the final H2. The verdict value's first alphabetic token must uppercase to exactly `PASS`, and the value must not contain `not`/`fail`/`failed`/`blocked`/`blocking`/`changes requested`/`incomplete`/`pending` anywhere. The report MUST contain all six H2 sections — `## Widget Shape Verification`, `## Canonical State Verification`, `## Structural Assertions`, `## Region Diff`, `## Allowed Differences`, `## Verdict`.

### Error codes & STOP routes

This table is the canonical exemplar of the Constitution §3 *Escalation call format* / `## Escalation Routes` convention the other skills follow.

Implementation-defect FAILs carry a `visual_fail:` note — a `pending_notes` entry whose trimmed text starts with that exact prefix (colon included) increments `visual_round`; a pure test-logic FAIL without it increments only `qa_round` (Constitution §3.1). Design-defect FAILs route to design-auditor WITHOUT the prefix. Past the round cap (6), only a `(pm, In_Progress)` transition is accepted.

| trigger | error code | STOP action |
|---|---|---|
| `qa_reports/visual_<task-id>.md` absent at PASS | `VISUAL_EVIDENCE_MISSING` | Write this report — `review_<task-id>.md` does NOT satisfy the gate. |
| Widget shape miss — any unchecked Step A row | `VISUAL_WIDGETS_UNVERIFIED` | `tw_rollback_task(<task-id>, "QA: Visual Widgets shape miss")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<list of missing widgets>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — widget shape miss", "visual_fail: <widget-id-list>", "next_role: sr-engineer"])`. STOP. |
| Pixel drift — ≥ 1 material Step B difference, all widget shapes verified | — | `tw_rollback_task(<task-id>, "QA: Phase 1.5 pixel drift")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — pixel drift", "visual_fail: pixel", "next_role: sr-engineer"])`. STOP. |
| Missing baseline file on disk | — | `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`. STOP. Design-auditor defect — no `visual_fail:` prefix. |
| Missing impl screenshot | — | `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing impl screenshot — <path>", "visual_fail: missing_impl", "next_role: sr-engineer"])`. STOP. |
| Dimension/scale mismatch — tool reports `dimensionsMatch=false` (e.g. baseline exported @1× but impl captured @2×) | `VISUAL_PROVENANCE_MISSING` if recorded as the diff-metric | Hard FAIL — NOT a graceful skip, NOT an Allowed Difference; the surface MUST NOT be recorded `pass`/`accepted`. Re-export the baseline at the correct scale and re-run the diff; if it cannot be re-exported now, take the missing-baseline path with `pending_notes=["QA: missing baseline — dimension mismatch @Nx vs @Nx <surface>", "next_role: design-auditor"]`. STOP. |
| Step A.0: Source manifest or its frozen node-id list absent | — | `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review="Source manifest missing frozen baseline node-id list", pending_notes=["QA: baseline node-id manifest absent — re-derivation forbidden", "next_role: design-auditor"])`. STOP. |
| Armed design's `## Source` manifest has zero `status: audited` rows (server backstop of Step A.0) | `BASELINE_MANIFEST_MISSING` | Route to design-auditor to run step 2c and freeze the node-id list. |
| Multi-surface manifest (≥ 2 audited rows) lacking a `## Baseline Selection Provenance` section with both `filter-conditions:` and `exclusion-reasons:` lines | `BASELINE_PROVENANCE_INCOMPLETE` | Route to design-auditor to record the selection provenance. |
| Non-carry-forward surface missing `baseline:` or carrying a placeholder `diff-metric:` | `VISUAL_PROVENANCE_MISSING` | Record real provenance per the matrix, or take the pixel-drift FAIL path. |
| Non-carry-forward surface missing `pixel_gate_complete: true` (B1 LLM-fallback included) | `PIXEL_GATE_ATTESTATION_MISSING` | Attest once the comparison completes; only carry-forward surfaces are exempt. |
| Missing report section / failed or unverified row / non-PASS verdict at PASS | `VISUAL_REPORT_INCOMPLETE` | Complete the report per the PASS sub-verdict above. |
| FAIL past visual round 6 | `VISUAL_ROUND_EXCEEDED` | Only `(pm, In_Progress)` is accepted — route to PM for split/rescope. |

### Example — minimal complete passing report (single surface, B1 pre-screened)

```markdown
# Visual report — T42

## Widget Shape Verification
- [x] datetime.picker — column-scroller 5-wheel + AM/PM toggle rendered (verified at qa_reports/impl/home.png)

## Canonical State Verification
- [x] home — baseline state {selected:English, scroll:centered}; impl captured in same state

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| primary.button.accent | home | primary button uses accent #3C5AAA | token | pass |

## Region Diff
| surface | result |
|---|---|
| home | pass |

### home
pre-screened by odiff: 0 px (0%)
- baseline: sha256:4be91c02a7d3
- diff-metric: odiff: 0 px (0%)
- pixel_gate_complete: true

## Allowed Differences
None.

## Verdict — PASS
```

# Skill: qa-visual — Visual-Baseline Comparator

> Source of truth: `content/skill-qa-visual.md` (primary), `content/skill-qa-engineer.md` (parent — qa-visual is its Phase 1.5 sub-skill), `content/constitution.md` (§-references, esp. §3.1 visual evidence/report gates, §3.2 visual verdict ownership, §5 anti-loop + `visual_round` cap), `content/skill-design-auditor.md` (upstream — produces the *Visual Baselines* / *Visual Structural Assertions* / *Source manifest* qa-visual consumes). Every claim below traces to those files. Nothing here is invented.

## Overview & Persona

- **Role id**: `qa-visual` (no dedicated registered prompt; it is a **lazy-loaded sub-skill** whose SOP lives in `content/skill-qa-visual.md`, loaded via the Read tool by qa-engineer at SOP step 4 / Phase 1.5). It may also be dispatched as a `Task(subagent_type="qa-visual", …)` subagent, but it never owns a `tw_*` chain identity of its own — every state write it drives carries `agent_id="qa-engineer"` (see *Output & watermark rules*).
- **Persona**: the visual-baseline comparator. It does not "look similar"-glance — it asserts specific structures, verifies canonical state parity, and diffs declared content/component regions against frozen baselines. Its bar: a pixel-perfect render on the *wrong widget* is still a FAIL; a sparse-canvas low pixel-% on a structurally broken surface is still a FAIL.
- **Recommended model** (frontmatter `recommended_model:`): `sonnet`. When dispatched as a Task subagent the watermark therefore shows the pinned tier; but because every state-mutating call it issues is signed `agent_id="qa-engineer"`, the visual verdict it produces is **owned by the qa chain**, not by a free-standing qa-visual identity.
- **Mission**: after qa-engineer's Phase 1 PASS and before Phase 2, compare the implementation against the design-auditor's frozen visual baselines and structural assertions, then write `qa_reports/visual_<task-id>.md` — a **server-checked PASS-gate artifact** (Constitution §3.1 visual evidence gate). Absence of that file by name → `VISUAL_EVIDENCE_MISSING`; a schema-incomplete or failing-row file → `VISUAL_REPORT_INCOMPLETE` / `VISUAL_ASSERTIONS_REQUIRED`.
- **Lazy-loaded Phase 1.5 sub-skill of qa-engineer**: qa-engineer pays **zero** per-prompt cost for this skill on non-UI work. It Reads `content/skill-qa-visual.md` only when the design is armed (see *Entry* below); on non-design or `no-design` work it logs `Phase 1.5: skipped (no Visual Baselines declared)` and never opens this file.
- **Visual verdict ownership (Constitution §3.2)**: the visual verdict is **qa-visual-owned**. ONLY qa-visual may define visual PASS criteria, accepted-diff tolerance, or pre-excused divergence classes — and only inside `## Allowed Differences` of `qa_reports/visual_<task-id>.md` (or PM/spec, before implementation). The coordinator and every non-qa role MAY pass context (baseline paths, Figma node ids, route, canonical-state setup) but MUST NOT define, override, relax, or pre-accept any visual difference. A coordinator- or builder-authored acceptance is **void**. Enforcement is by construction: the report is consulted only on a qa-engineer PASS, and `status=PASS` is server-restricted to `agent_id="qa-engineer"`. **Builder ≠ judge** — if subagent limits force a role inline in the coordinator's context, it MAY build/edit but MUST NOT self-issue a visual PASS; visual-backed work stops at `status=Blocked` ("awaiting independent QA") rather than a builder-signed PASS.

## Entry — when qa-engineer loads this sub-skill

qa-engineer reaches Phase 1.5 after its Phase 1 PASS (Copy Audit Gate 3a + Visual Audit Gate 3b) and before Phase 2. At SOP step 4 it checks `design/<feature>.md` for a `## Visual Baselines` H2:

- **Absent** (or no design file) → qa-engineer logs `Phase 1.5: skipped (no Visual Baselines declared)` in `review_<task-id>.md` and proceeds to Phase 2. It does **NOT** Read `content/skill-qa-visual.md`. Non-UI features pay zero overhead.
- **Present** → qa-engineer Reads `content/skill-qa-visual.md` and follows this SOP for every baseline row.

The deeper arm signal is the same one the server's PASS gates use: `hasDesignModeRequiringVisual(workspace, active_feature)` — i.e. `design/<active_feature>.md` exists with `## Mode` ≠ `no-design` (the v3.16.0 self-arming signal; not the mere presence of a `## Visual Baselines` H2). This is why qa-visual's text loads exactly when the server gates can fire. When armed:

- A missing `## Visual Baselines` H2 → PASS blocked with `VISUAL_BASELINES_REQUIRED` (design-auditor must add it — not a silent pass-through).
- A missing `## Visual Structural Assertions` table → PASS blocked with `VISUAL_ASSERTIONS_REQUIRED`.
- The `## Visual Baselines` H2 present → PASS additionally requires `qa_reports/visual_<task-id>.md` for every task id in the round → missing → `VISUAL_EVIDENCE_MISSING`.

The escape clause "Phase 1.5 deferred" was **removed** (v3.14.0): no PASS without diff evidence when baselines exist.

## Full SOP

Phase 1.5 — Visual Compare. Output file is **`qa_reports/visual_<task-id>.md`** — separate from the main `review_<task-id>.md`; the server checks for it by name during PASS validation. Steps run in order: A.0 baseline source-of-truth → A widget shape → A.5 canonical state → B region diff (B0 carry-forward → B1 deterministic pre-screen → B2 LLM diff) → C structural assertions → Allowed Differences → PASS sub-verdict.

### Step A.0 — Baseline Source-of-Truth / provenance (v3.39.0)

Before any widget/state/diff work, fix WHICH baseline node ids are being compared against. The authoritative source is the design-auditor's frozen **Source manifest** in `design/<feature>.md` (produced by `skill-design-auditor` step 2c, *Mechanical baseline selection*).

- **Verbatim copy, no re-derivation.** Copy that manifest's baseline node-id list — and its declared `## Visual Baselines` rows — **verbatim**. You MUST NOT re-derive the baseline set from the Figma URL (or any source URL): no re-fetching the board, no re-picking frames, no name-globbing, no spatial/`componentId` grouping of your own. The node-id list was locked, with filter conditions and exclusion reasons, at audit time precisely so baseline identity does not drift between audit and verification — re-deriving here reintroduces the non-determinism (漏抓 / 誤收) that step 2c exists to eliminate. This is the paired downstream half of Constitution §3.2 builder≠judge provenance (method: `research/figma-baselines.md`).
- **Missing/absent manifest → FAIL to design-auditor.** If the Source manifest is missing or its frozen node-id list is absent, this is a design-auditor defect: STOP and `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review="Source manifest missing frozen baseline node-id list", pending_notes=["QA: baseline node-id manifest absent — re-derivation forbidden", "next_role: design-auditor"])`. Do NOT substitute your own URL-derived set.
- **Server backstop (v3.40.0 baseline manifest gate, Constitution §3.1).** The Source manifest is machine-checked. An armed design whose `## Source` manifest has zero `status: audited` rows blocks PASS with `BASELINE_MANIFEST_MISSING`. A multi-surface manifest (≥ 2 audited rows) missing a `## Baseline Selection Provenance` section with **both** a `filter-conditions:` line AND an `exclusion-reasons:` line blocks PASS with `BASELINE_PROVENANCE_INCOMPLETE`. Single-surface (exactly 1 audited row) selections are exempt from the provenance section. You still do the verbatim copy and the FAIL-back manually — the gate catches manifest absence/incompleteness, never URL re-derivation.

### Step A — Widget Shape Checklist (v3.14.0, R6)

Open the spec's `## Visual Widgets` H2 (required by skill-pm, copied verbatim from design-auditor). For each widget id in the table, emit one markdown checkbox row in `qa_reports/visual_<task-id>.md` under H2 `## Widget Shape Verification`:

```
## Widget Shape Verification
- [x] datetime.picker — column-scroller 5-wheel + AM/PM toggle rendered (verified at <impl path>)
- [ ] keyboard.virtual — MISSING: impl relies on hardware keyboard, no on-screen keyboard widget
```

Rules:
- **ONE checkbox per** spec `## Visual Widgets` row (skip `widget id == N/A`).
- `[x]` = widget shape rendered correctly in the corresponding `impl path` screenshot.
- `[ ]` = widget shape missing OR substituted with a primitive (the gap §1 Visual Widgets catches).
- **Any `[ ]` → shape FAIL precedes pixel diff.** Route per "Widget shape miss" below; do NOT proceed to Step B for those surfaces — pixel-perfect on the wrong widget is meaningless.

### Step A.5 — Canonical-State Verification (v3.26.0, R2)

Before any diff, the impl capture MUST be in the SAME state the baseline depicts. Each `## Visual Baselines` row carries a `canonical state` (selected item / focused row / scroll offset / drawer-or-modal open / toggle + segmented values / expected default data). Emit one row per surface under H2 `## Canonical State Verification`:

```
## Canonical State Verification
- [x] language — baseline state {selected:English, focus:English, scroll:centered}; impl captured in same state
- [ ] network — baseline {drawer:wifi-list open}; impl captured at top-level (STATE MISMATCH)
```

Rules:
- A `[ ]` (state mismatch) is a **capture defect, NOT visual drift**. Do NOT diff or "accept" it — recapture the impl in the baseline's state, or FAIL. Unresolved, it blocks PASS (server-checked). The canonical state to drive to is supplied as context; reaching it is the engineer's/QA's job.
- **Context-dependent multi-value guard (v3.38.0).** If, during Step A.5 or Step B adjudication, you discover a visual property with MORE than one correct value depending on context (e.g. focused vs unfocused, selected vs unselected), you MUST NOT pick one value as "correct" and accept/fail on the other. Record BOTH contexts as separate baselines (or flag the surface for re-audit with per-context baselines) and FAIL the current surface with note: "context-dependent property requires per-context baseline — see §四#7 in `research/mode-feature-process-retrospective.md`". Per §3.2 (builder≠judge), adjudicating a multi-value property as single-choice is a **contract defect**, not an implementation defect.

### Step B — Region Diff Per Baseline (v3.26.0, R3)

**Whole-frame pixel-percentage is BANNED as a PASS metric** (Constitution §3.2 "no global-frame metric") — a sparse canvas dilutes a localized structural error (a prior surface scored 6% while structurally wrong). Compare the **content/component region** declared by the baseline's `compare region`, never the full frame.

Step B runs in three stages: a round-≥2 carry-forward gate (**B0**) that skips already-passing untouched surfaces; a deterministic pixel-diff pre-screen (**B1**) deciding which survivors need eyes; then the LLM region diff (**B2**) for only the escalated surfaces. **The multimodal image Read happens in B2 only** — neither B0 nor B1 loads an image.

#### Step B0 — Round-≥2 Carry-Forward Gate (v3.36.0, B10)

- On the **FIRST** visual round (`visual_round` `0`/`1`, or no prior `## Region Diff` table exists) this step is a **no-op**: diff every surface via B1/B2.
- From `visual_round ≥ 2`, re-verify ONLY surfaces that could have regressed; carry the rest forward without re-reading images. For each `## Visual Baselines` row:
  - **a. Always re-diff (B1/B2)** any surface whose prior-round result was `fail`/`accepted`, or newly recaptured this round (A.5 mismatch corrected) — full diff regardless of `git diff`.
  - **b.** For a prior-round `pass` surface, check `git diff` scoped to the paths sr-engineer touched this round (handoff `pending_notes` + actual changed paths):
    - **`git diff` confirms that surface's source untouched** → **carry forward**: write it as a `pass` row WITHOUT reading its `baseline path`/`impl path`, annotating the prose sub-section `pass (carried forward — git diff confirms source untouched)`. The result **cell** stays exactly `pass` (annotations never go in the cell or the parser drops the row). A carry-forward surface is **EXEMPT from `baseline:`/`diff-metric:`** — the `git diff` proof replaces the re-diff, so do NOT add those fields; the annotation alone exempts it (`VISUAL_PROVENANCE_MISSING` honors AC-3).
    - **`git diff` cannot prove it untouched** (diff unavailable, source path unknown, or it touches a shared file — shared component, global stylesheet, design token) → **full re-diff** via B1/B2 as if round 1. When in doubt, re-diff; carry-forward needs provable evidence.
- Carried-forward surfaces still appear in the `## Region Diff` table and `## Verdict` accounting — a round-≥2 report stays self-contained: every `## Visual Baselines` surface has a row every round.

#### Step B1 — Deterministic Pixel-Diff (tool-first gate)

Before loading ANY image into multimodal context, run a deterministic CLI pixel-diff over each baseline's declared `compare region` (NOT the full frame — that reintroduces the banned whole-frame metric). No wrapper script / new npm dep at MVP; invoke an already-installed CLI via Bash:

- `odiff <baseline> <impl> <diff-out>` — changed-pixel count/percentage + exit code.
- `pixelmatch` (CLI) — number of differing pixels.
- ImageMagick `compare -metric AE <baseline> <impl> <diff-out>` — absolute pixel-difference count.

Crop both `baseline path` and `impl path` to the `compare region` first (e.g. `magick <img> -crop <WxH+X+Y> <region-out>`) so the metric is computed over the SAME region the LLM would judge.

For each `## Visual Baselines` row not already carried forward by B0:
- **a.** Run the tool over the cropped `compare region`.
- **b.** Compare the numeric output against the baseline's declared threshold (default: `0%` / `0` pixels / tool-reported "identical").
  - **At or below threshold** → record `pass` in `## Region Diff` WITHOUT reading either image. In that surface's `### <surface id>` prose sub-section note `pre-screened by <tool>: <metric>`, plus the two provenance lines the `VISUAL_PROVENANCE_MISSING` gate reads:
    ```
    - baseline: <fingerprint — content-hash of the downloaded Figma export, OR the Figma node id passed to mcp__figma__download_figma_images>
    - diff-metric: <tool output — e.g. "odiff: 0 px (0%)" or "ImageMagick AE: 0">
    ```
  - **Above threshold** → escalate to B2 (no verdict yet).
- **Tool unavailable** (binary absent, Bash blocked, or crop/diff errors) → treat the surface as escalated to the B2 LLM path, noting `B1 tool unavailable — LLM fallback` in its prose sub-section. The fallback surface STILL records a `baseline:` line (the LLM must read a real baseline to diff):
  ```
  - baseline: <fingerprint>
  - diff-metric: B1 tool unavailable — LLM fallback
  ```
  The `B1 tool unavailable — LLM fallback` token IS the `diff-metric:` value; the gate accepts a null numeric metric when that token is present (AC-4), but a missing `baseline:` still fails.

#### Step B2 — LLM Region Diff (escalated surfaces only)

For each surface escalated by B1 (above threshold, or tool unavailable):
- **a.** Read both `baseline path` and `impl path` via the Read tool (images render into multimodal context).
- **b.** Emit a structured diff over the region covering the **six diff categories**: (i) layout/position, (ii) spacing/alignment, (iii) element presence, (iv) color, (v) text content, (vi) image content. Append under `## Region Diff`, one prose sub-section per `surface id`, AND a **per-surface result table** the server parses: `| surface | result |` where `result` ∈ `pass` (no material difference) / `accepted` (recorded in `## Allowed Differences`) / `fail` (material drift). Any row not `pass`/`accepted` blocks PASS.

**Heading convention (binding — the provenance parser anchors on it):** each surface's prose sub-section MUST be introduced by a `### <surface id>` heading (one heading per surface; do NOT nest deeper `####` sub-headings — each `###`–`######` heading is parsed as its own surface) under `## Region Diff`, where `<surface id>` matches the `| surface | result |` table. Prose without such a sub-heading is NOT parsed as a provenance row. Each non-carry-forward sub-section MUST also include the two `VISUAL_PROVENANCE_MISSING` lines:
```
- baseline: <fingerprint of the baseline image read via the Read tool>
- diff-metric: <quantified region delta — pixel/% estimate, or the qualitative judgement behind the cell>
```

Every surface — B1-pre-screened `pass` or B2-judged — MUST appear as a row in the single `## Region Diff` `| surface | result |` table. The result cell MUST be exactly `pass`/`accepted`/`fail` (no trailing annotation); any note goes in the prose sub-section, never in the parsed result cell.

### Step C — Structural Assertions (v3.26.0, R3/R-VIS)

Vision "looks similar" is not enough; assert specific structures the design requires. Copy the spec's `## Visual Structural Assertions` rows (authored by design-auditor, copied verbatim by PM) and mark each pass/fail under H2 `## Structural Assertions`:

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

Any `fail` or unverified row blocks PASS (server-checked). This is what catches the false-PASS class (missing blue focus bar, flat groups, grey primary button, title-only mode card).

### Allowed Differences (qa-visual-owned ONLY — v3.26.0, R1)

If a difference is acceptable, qa-visual records it under H2 `## Allowed Differences` with a per-item reason, in THIS report, under a qa-visual/qa-engineer handoff. A coordinator- or builder-authored acceptance is **void** (Constitution §3.2); the server rejects a PASS whose allowed-diffs were not qa-authored (by construction: PASS is `agent_id="qa-engineer"`-exclusive). An empty section is **valid** (means: none).

### Per-widget isolation (v3.26.0, R4)

For custom widgets (every non-`N/A` `## Visual Widgets` row), verify the widget **in isolation** in `/dev/kitchen-sink` (or the story route) against its Figma component node BEFORE screen-level assembly diffs. PASS each widget's states (default/focused/selected/disabled/drawer-open/modal-open) individually. This shrinks blast radius and stops fix-A-break-B screen loops.

### Self-converge `visual_round` loop and the Round-6 cap

qa-visual sits inside the `visual_round` sub-loop (v3.14.0, §3.1) — independent of `qa_round` and `review_round`:
- A FAIL whose `pending_notes` contains the `visual_fail:` prefix is the **trigger token** that increments `visual_round` (a structural pixel/widget miss, distinct from a test-logic FAIL — which bumps only `qa_round`). Without the prefix, a pure test-logic FAIL does **not** tick `visual_round`.
- Each FAIL hands back to `sr-engineer` (the builder fixes; qa judges — §3.2 builder≠judge) for the next round. sr-engineer's pre-handoff self-converge loop MAY fix all VSA-detected structural deviations in a single pass (Constitution §1 self-converge relaxation v3.31.0) — but qa-visual still **independently re-verifies every VSA row at PASS** (§3.1) and the visual verdict stays qa-visual-owned.
- **Cap is 5 rounds; Round 6 attempts lock to `(pm, In_Progress)` only** — the circuit-breaker landing pad, symmetric to the `qa_round` breaker. PM is the designated recovery owner: the team lands back on PM to renegotiate the visual scope/spec/thresholds.
- **Split escalation (Round 3, early escape).** At `visual_round ≥ 3`, sr-engineer MAY transition `(sr-engineer, In_Progress) → (pm, In_Progress)` with `pending_notes` containing `visual_split_requested: <reason>` — instead of grinding two more rounds toward threshold renegotiation, split the oversized widget into sub-tasks. Available at Round 3/4/5; **mandatory route at Round 6**.

### Failure modes (exact routes)

- **Widget shape miss** (any unchecked `[ ]` in Step A) → `tw_rollback_task(<task-id>, "QA: Visual Widgets shape miss")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<list of missing widgets>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — widget shape miss", "visual_fail: <widget-id-list>", "next_role: sr-engineer"])`. **STOP.** The `visual_fail:` prefix triggers `visual_round` increment (§3.1).
- **Pixel drift** (≥ 1 visual difference in Step B with all widget shapes verified) → `tw_rollback_task(<task-id>, "QA: Phase 1.5 pixel drift")` → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — pixel drift", "visual_fail: pixel", "next_role: sr-engineer"])`. **STOP.**
- **Missing baseline file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`. **STOP.** **No `visual_fail:` prefix** (design-auditor defect, not implementation drift — so no `visual_round` increment).
- **Missing impl file** → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review=<path>, pending_notes=["QA: missing impl screenshot — <path>", "visual_fail: missing_impl", "next_role: sr-engineer"])`. **STOP.**
- **Source manifest missing/absent frozen node-id list** (Step A.0) → `tw_update_state(status=FAIL, agent_id="qa-engineer", qa_review="Source manifest missing frozen baseline node-id list", pending_notes=["QA: baseline node-id manifest absent — re-derivation forbidden", "next_role: design-auditor"])`. **STOP.** Do NOT substitute a URL-derived set.
- **Canonical-state mismatch** (Step A.5 `[ ]`) — capture defect, NOT drift: recapture the impl in the baseline state, or FAIL. Unresolved, it blocks PASS server-side.
- **Context-dependent multi-value property** (A.5 / B) → FAIL the surface, "context-dependent property requires per-context baseline" (contract defect per §3.2).

### PASS sub-verdict

PASS requires ALL of:
- every Step A widget checkbox `[x]`;
- every Step A.5 canonical-state row `[x]`;
- every Step C structural assertion `pass`;
- every Step B region diff with no material difference outside `## Allowed Differences`.

Then write final `## Verdict — PASS`. Any unchecked/failed/unverified row in A, A.5, or C — or a material region diff — blocks PASS. The PASS itself is issued by qa-engineer's Phase 4 (`status=PASS, agent_id="qa-engineer"`); qa-visual produces the evidence that gate validates against.

## Branch / STOP-exit table

| # | Condition | Action / Exit |
|---|---|---|
| 1 | **Source manifest missing** / frozen node-id list absent (Step A.0) | STOP → FAIL `next_role: design-auditor`, `qa_review="Source manifest missing frozen baseline node-id list"`, no `visual_fail:`. Re-derivation forbidden. |
| 2 | **Armed manifest has zero `status: audited` rows** | Server blocks PASS with `BASELINE_MANIFEST_MISSING` (v3.40.0). |
| 3 | **Multi-surface manifest (≥2 audited) lacks `## Baseline Selection Provenance`** with `filter-conditions:` + `exclusion-reasons:` | Server blocks PASS with `BASELINE_PROVENANCE_INCOMPLETE`. (Single audited row exempt.) |
| 4 | **Widget shape miss** — any `[ ]` in Step A | STOP → `tw_rollback_task` + FAIL, `pending_notes` carry `visual_fail: <widget-ids>`, `next_role: sr-engineer`. Do NOT enter Step B for those surfaces. |
| 5 | **Canonical-state mismatch** — `[ ]` in Step A.5 | Capture defect: recapture impl in baseline state, OR FAIL. Do NOT diff/accept. Blocks PASS server-side until resolved. |
| 6 | **Context-dependent multi-value property** discovered (A.5 / B) | FAIL the surface; record BOTH contexts as separate baselines (or flag re-audit). Contract defect (§3.2). |
| 7 | **Pixel drift** — ≥1 material region diff (Step B), widgets all verified | STOP → `tw_rollback_task` + FAIL, `visual_fail: pixel`, `next_role: sr-engineer`. |
| 8 | **Missing baseline file** | STOP → FAIL, `next_role: design-auditor`, **no** `visual_fail:` (no `visual_round` tick). |
| 9 | **Missing impl screenshot** | STOP → FAIL, `visual_fail: missing_impl`, `next_role: sr-engineer`. |
| 10 | **B1 tool unavailable** (binary absent / Bash blocked / crop error) | Not a STOP — escalate the surface to B2 LLM fallback; record `baseline:` + `diff-metric: B1 tool unavailable — LLM fallback`. |
| 11 | **Round-≥2, prior `pass`, `git diff` proves source untouched** (B0) | Carry forward: `pass` row, no image Read, prose annotation only, exempt from `baseline:`/`diff-metric:`. |
| 12 | **Round-≥2, `git diff` cannot prove untouched / shared file** (B0) | Full re-diff via B1/B2 as if round 1. When in doubt, re-diff. |
| 13 | **`visual_round` reaches Round 6** | Only `(pm, In_Progress)` accepted — circuit-breaker landing pad. (Split escape available from Round 3 via `visual_split_requested:`.) |
| 14 | **All A `[x]` + A.5 `[x]` + C `pass` + B no material diff outside Allowed Differences** | Write `## Verdict — PASS`; qa-engineer Phase 4 issues `status=PASS`. |

## Server-enforced gates

These are validated server-side at PASS by `tools/evidence-file.ts` and the §3.1 gate suite (the client cannot bypass them). They arm on `hasDesignModeRequiringVisual` (`design/<active_feature>.md` `## Mode` ≠ `no-design`):

- **`VISUAL_EVIDENCE_MISSING`** (Constitution §3.1, v3.14.0/v3.16.0) — armed + `## Visual Baselines` present, but no `qa_reports/visual_<task-id>.md` for a task id in the round. The output filename is server-checked: writing into `review_<task-id>.md` instead does NOT satisfy the gate.
- **`VISUAL_BASELINES_REQUIRED`** — armed but the design file lacks a `## Visual Baselines` H2. Fires FIRST and short-circuits the evidence-file lookup (the two are mutually exclusive). design-auditor must add the section — not a silent pass-through.
- **`VISUAL_ASSERTIONS_REQUIRED`** (v3.27.0) — armed but the design omits `## Visual Structural Assertions`. A hard error, not a silent fallback.
- **`VISUAL_REPORT_INCOMPLETE`** (v3.26.0/v3.27.0) — the report fails `REQUIRED_VISUAL_SECTIONS`: a missing required section, a failed/unverified canonical-state or structural row, or a non-PASS verdict. Required sections (verbatim): **Widget Shape Verification, Canonical State Verification, Structural Assertions, Region Diff, Allowed Differences, Verdict**.
- **`VISUAL_PROVENANCE_MISSING`** — each **non-carry-forward** `### <surface id>` sub-section under `## Region Diff` must carry a `baseline:` fingerprint and a `diff-metric:` value. Carry-forward surfaces (B0) are exempt (AC-3); the `B1 tool unavailable — LLM fallback` token satisfies `diff-metric:` (AC-4) but a missing `baseline:` still fails. See `specs/qa-visual-baseline-provenance.md`.
- **`BASELINE_MANIFEST_MISSING`** (v3.40.0 baseline manifest gate, §3.1) — armed design whose `## Source` manifest has zero `status: audited` rows (or no `## Source` section once on the manifest contract).
- **`BASELINE_PROVENANCE_INCOMPLETE`** (v3.40.0) — multi-surface manifest (≥ 2 audited rows) missing a `## Baseline Selection Provenance` section with both a `filter-conditions:` and an `exclusion-reasons:` line. Single-surface (1 audited row) selections are exempt.
- **`visual_round` Round-6 circuit-breaker** (§3.1 / §5) — `visual_round` bumps on `(qa-engineer, FAIL)` with `visual_fail:` in `pending_notes`. Cap is 5 rounds; Round 6 attempts lock to `(pm, In_Progress)` only — PM is the designated recovery owner. (Symmetric to the `qa_round` and `review_round` Round-4 breakers.)
- **`ALLOWED_TRANSITIONS` matrix** (`tools/transitions.ts`) — every `tw_update_state` write is gated regardless of dispatch path. On rejection the server returns `{ error, attempted, allowed, hint }` — read it and self-correct. Note all of qa-visual's writes carry `agent_id="qa-engineer"`; `status=PASS` is server-restricted to that id, which is the structural enforcement of §3.2 visual verdict ownership.

## Upstream / Downstream

**Consumes (upstream):**
- **design-auditor** (`design/<feature>.md`) — the frozen **Source manifest** + `## Baseline Selection Provenance` (Step A.0, copied verbatim, never re-derived); the **Visual Baselines** table (`surface id | source node | baseline path | impl path | viewport | route | canonical state | compare region | notes`) driving Steps A.5/B; and the **Visual Structural Assertions** table driving Step C. design-auditor's content-verified node ids and per-state interactive-states inventory are what make these machine-checkable.
- **PM** (`specs/<feature>.md`) — the **Visual Widgets** table (Step A widget checklist), **Visual Tokens** (cross-referenced; literal-token drift is actually caught upstream by qa-engineer Phase 1 gate 3b), and the **Visual Structural Assertions** table copied verbatim from design-auditor. PM copying these verbatim is what gives qa-visual a contract; PM may pin tokens/assertions but does NOT define PASS thresholds or pre-excuse divergences (§3.2) — except recording allowed-diffs in the spec before implementation.
- **sr-engineer** — the implementation, impl screenshots, and (round ≥ 2) the `git diff` / touched-path set B0 reads to carry surfaces forward.

**Feeds (downstream):**
- **qa-engineer Phase 4 PASS** — `qa_reports/visual_<task-id>.md` is the evidence the §3.1 gates validate before `status=PASS, agent_id="qa-engineer"` is persisted. A failing qa-visual sub-verdict routes back to **sr-engineer** (pixel/widget/impl FAIL, `visual_fail:` → `visual_round++`) or **design-auditor** (missing baseline / missing manifest, no `visual_fail:`), and at Round 6 to **PM** (circuit-breaker).

## Output & watermark rules

- **Chat output ≤ 1 sentence** — qa-visual runs under qa-engineer's output rule ("Chat output MUST be exactly 1 sentence. Details go in files."). All diff detail goes into `qa_reports/visual_<task-id>.md`, never the chat.
- **NO YAPPING / Tool-First / Silent execution** (Constitution §1): no filler, no narrating tool calls; write the report with tools, never paste images or full diffs into chat.
- **Output artifact (server-checked by name)**: `qa_reports/visual_<task-id>.md` — separate from `review_<task-id>.md`.
- **State writes are qa-engineer-signed**: every `tw_update_state` / `tw_rollback_task` carries `agent_id="qa-engineer"`. qa-visual has no independent chain identity; this is the structural realization of §3.2 (the visual verdict is owned by the qa chain, and PASS is qa-exclusive).
- **Watermark** (Constitution §1): every chat response ends with a role watermark.
  - As a Task-dispatched `qa-visual` subagent → tier shown per the pinned `recommended_model: sonnet` (e.g. `— @qa-visual (sonnet)`).
  - When the SOP is run inline by qa-engineer (lazy-Read at Phase 1.5) → the watermark is qa-engineer's, since the verdict is qa-engineer-signed.

## Flow diagram

```mermaid
flowchart TD
    ENTRY[qa-engineer Phase 1 PASS] --> CHK{design/feature.md has ## Visual Baselines?}
    CHK -- no / no-design --> SKIP[Log: Phase 1.5 skipped; proceed to Phase 2] 
    CHK -- yes, armed Mode != no-design --> READ[qa-engineer Reads skill-qa-visual.md]

    READ --> A0[Step A.0: copy frozen Source manifest node-ids VERBATIM]
    A0 --> MANCHK{Manifest present + frozen node-id list?}
    MANCHK -- no --> FAIL_DA[STOP FAIL: next_role design-auditor; no visual_fail]
    MANCHK -- yes --> AUDITED{Server: audited rows + provenance ok?}
    AUDITED -- zero audited --> G_MAN[BASELINE_MANIFEST_MISSING]
    AUDITED -- multi-surface no provenance --> G_PROV[BASELINE_PROVENANCE_INCOMPLETE]
    AUDITED -- ok --> A

    A[Step A: Widget Shape Checklist per ## Visual Widgets] --> AOK{Any unchecked widget?}
    AOK -- yes --> FAIL_W[STOP rollback+FAIL: visual_fail widget-ids; next_role sr-engineer]
    AOK -- no --> A5

    A5[Step A.5: Canonical-State Verification] --> A5OK{State mismatch?}
    A5OK -- yes, recapture fails --> FAIL_S[Capture defect: recapture or FAIL; blocks PASS]
    A5OK -- multi-value context property --> FAIL_CTX[FAIL surface: per-context baseline needed]
    A5OK -- no --> B0

    B0[Step B0: Round >= 2 Carry-Forward Gate] --> RND{visual_round >= 2 and prior pass?}
    RND -- yes, git diff proves untouched --> CARRY[Carry forward: pass row, no image Read, exempt provenance]
    RND -- cannot prove / shared file --> B1
    RND -- round 0/1 or prior fail/accepted --> B1
    CARRY --> C

    B1[Step B1: deterministic CLI pixel-diff over compare region] --> B1OK{<= threshold?}
    B1OK -- yes --> PASSROW[Record pass + baseline + diff-metric, no image]
    B1OK -- above threshold --> B2
    B1OK -- tool unavailable --> B2
    PASSROW --> C

    B2[Step B2: Read images, LLM region diff over 6 categories] --> B2OK{Material drift?}
    B2OK -- yes --> FAIL_PX[STOP rollback+FAIL: visual_fail pixel; next_role sr-engineer]
    B2OK -- accepted in Allowed Differences --> C
    B2OK -- no --> C

    C[Step C: Structural Assertions pass/fail per VSA row] --> COK{Any fail/unverified row?}
    COK -- yes --> FAIL_PX
    COK -- no --> VERDICT

    VERDICT{All A[x] + A.5[x] + C pass + B no material diff?} -- yes --> PASS[Write ## Verdict PASS -> qa-engineer Phase 4 status=PASS]
    VERDICT -- no --> SCHEMA[Server: VISUAL_REPORT_INCOMPLETE / VISUAL_PROVENANCE_MISSING]

    FAIL_W --> VR[visual_round ++]
    FAIL_PX --> VR
    VR --> CAP{visual_round reaches Round 6?}
    CAP -- yes --> PM[Lock to pm, In_Progress: circuit-breaker landing pad]
    CAP -- no, Round 3-5 --> SPLIT[Optional: sr visual_split_requested -> pm]
    CAP -- no --> SRENG[Back to sr-engineer next round]
```

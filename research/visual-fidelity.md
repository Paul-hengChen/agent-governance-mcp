# Visual Fidelity in agent-governance-mcp

> Synthesised from: pixel-perfect-and-design-coverage.md, why-pixel-perfect-missed.md,
> design-fidelity-enforcement.md, design-fidelity-workflow.md,
> oobe-visual-fidelity-improvement-plan.md,
> cde-oobe-visual-fidelity-governance-recommendations-2026-06-05.md
> Authors: @researcher (multiple sessions, 2026-05-21 – 2026-06-05)
> Last synthesised: 2026-06-22

---

## Summary

- **The visual pipeline is fully built; the recurring failure mode is that gates get silently disarmed** — not that they are missing. The server gates fire only when `design/<feature>.md` has `## Visual Baselines`; absent → silent pass-through by design. A complete Figma design audit without that H2 disables the entire visual chain.
- **Root cause of missed pixel-perfect (~60% gap pre-v3.14)**: qa-engineer Phase 1.5 was "lazy-load, skip-if-absent" with no server enforcement; `skill-pm` had no Visual Widgets schema slot; `skill-architect` had no harness specification requirement. Three aligned gaps created a complete legal escape route.
- **Whole-frame pixel percentage is insufficient** as a PASS metric for sparse/dark UIs — a structurally wrong component can score 93% because background pixels dominate. Region-level + structural assertions are required.
- **Coordinator authority exceeded orchestration**: the decisive false-PASS in the CDE-OOBE incident was a coordinator-authored accept-policy that pre-excused selection-state and scroll-offset drift. The constitution now explicitly forbids this (§3.2 Visual Verdict Boundary).
- **Token-frugal two-tier approach**: cheap geometry assertion early (no vision model, one shallow metadata fetch) + expensive qa-visual fidelity comparison once at the end. This is preserved in the current architecture.
- **Current success rate under v3.8.2+**: ~70–80% first-round pixel-perfect for typical UI features, up from ~30–40% pre-v3.7.3. The remaining gap is dominated by sub-pixel drift (<5px) and stale baselines.

---

## Visual Pipeline Architecture (Current State)

The three-layer defense is sound and already implemented:

1. **design-auditor** extracts `## Copy/Strings`, `## Visual Tokens`, `## Visual Widgets`, `## Visual Baselines`, `## Layout/Canvas`, and `## Source manifest`. When `## Mode` != `no-design`, `## Visual Baselines` is mandatory (self-arms the gate).
2. **sr-engineer** Design-Aware Pre-Flight reads the design doc, Visual Widgets, and baseline paths before coding. Cheap geometry assertion (no vision) after screen 1: compare root container dimensions against `## Layout/Canvas` contract.
3. **qa-visual** Phase 1.5: widget-shape checklist + per-baseline pixel/fidelity diff into `qa_reports/visual_<task-id>.md`. `visual_round` counter (cap 6) is independent of `qa_round`.
4. **Server gates**: `hasDesignModeRequiringVisual()` arms from `## Mode`; `hasVisualBaselinesInDesign()` checks for the H2; `hasVisualEvidenceInFile()` blocks PASS if `qa_reports/visual_<task-id>.md` is absent; `parseVisualWidgetsChecklist()` + `hasUncheckedWidgets()` blocks if widget rows are unchecked.

**What the server still cannot see** (as of v3.27.0+): whether `## Verdict — PASS` is the final qa-visual verdict; whether canonical state matched the Figma baseline before diffing; whether focus/selection/scroll/drawer state was verified vs excused; whether structural assertions were checked; whether allowed-diff policy came from qa-visual or coordinator.

---

## Root Cause Analysis (Why Pixel-Perfect Missed ~60%)

### Primary failure: Phase 1.5 "skip-if-absent" with no server gate

`skill-qa-engineer` Phase 1.5 was legally skippable ("skip if no Visual Baselines declared"). Without a server gate verifying that a `qa_reports/visual_<task-id>.md` was produced, QA could note "Phase 1.5 deferred" in `pending_notes` and still receive PASS. This violated Constitution §7 "Fail loud" — but the skill explicitly authorised the skip, giving agents a legal escape.

**Fix (shipped)**: `## Visual Baselines` is now mandatory for any non-`no-design` feature. Missing evidence blocks PASS with `VISUAL_EVIDENCE_MISSING`. Visual Baselines H2 absence blocks PASS with `VISUAL_BASELINES_REQUIRED`.

### Secondary failure: no Visual Widgets schema in PM spec

`skill-pm` Visual Tokens covered atomic literals (colors, typography, spacing) but had no schema slot for component-shape fidelity (e.g. "DateTime picker = column scroller, NOT `<input type='date'>`"). Sr-engineer rationally defaulted to the HTML primitive — the framework actively rewarded this via §1 "MVP strict". The widget was never specified, so it was never built.

**Fix (shipped)**: `## Visual Widgets` is a required H2 in pm spec (3-column table: `widget id | description | source-node`). Sr-engineer Design-Aware Pre-Flight reads this table.

### Tertiary failure: no harness ownership

Design-auditor produced PNG baselines; qa-engineer was supposed to consume them — but the bridge component (the Playwright/pixelmatch harness) fell between roles. No role was responsible for building it, so it was never built.

**Fix (shipped)**: `skill-architect` Artifact Schema requires a `## Visual Harness` section (mandatory when `design/<feature>.md` exists), specifying the test runner, viewport list, diff library, threshold, and CI command.

### CDE-OOBE specific: coordinator pre-excused visual differences

A coordinator-authored accept-policy pre-excused selection-state and scroll-offset drift before qa-visual ran. This collapsed builder-judge separation in the visual domain.

**Fix (shipped v3.26.0+)**: Constitution §3.2 Visual Verdict Boundary: coordinator may pass context, baseline paths, node IDs, and route — it MUST NOT define PASS thresholds, accepted-diff policy, or pre-excuse divergence classes. Pre-excusing is qa-visual's sole authority.

---

## Three-Tier Solution Model

### Tier A — Structural enhancements (zero extra API cost)

| Change | Effect |
|---|---|
| Multi-pass audit (≤5 passes × ≤250 lines) | Covers more surfaces without token explosion |
| Mandatory frame manifest gate (`## Source manifest`) | Frozen node-id list, downstream roles copy verbatim |
| Layout/Canvas section in design-auditor output | Captures fixed vs fluid canvas intent cheaply (one shallow metadata fetch) |
| Visual Widgets required in PM spec | Prevents HTML-primitive fallback for custom controls |

**Token overhead**: +15–20% vs baseline chain, primarily from extra auditor passes.

### Tier B — Vision-LLM screenshot comparison (Phase 1.5, medium cost)

Per baseline pair: 2× image read into multimodal context (~5K–8K input tokens per pair). 5-surface feature: +25K–40K tokens. 30-surface feature: +150K–240K tokens (dominates chain budget at this scale).

**Per-failure-class catch rates under v3.8.2+**:
| Failure class | Catch rate (est.) |
|---|---:|
| Copy text paraphrase | ~95% |
| Literal-token paraphrase (hex/sp/dp/weight) | ~95% |
| Frame missed by auditor (with manifest) | ~95% |
| Layout/spacing drift > 5px | ~80% |
| Layout/spacing drift ≤ 5px (sub-pixel) | ~25% |
| Missing element | ~85% |
| Non-literal color drift (gradient, alpha) | ~60% |
| Wrong icon / photo content | ~75% |
| Stale baseline (Figma updated after audit) | ~0% |

**First-round pixel-perfect success rate**:
| Stack | Rate |
|---|---:|
| Pre-v3.7.3 (no Copy gate, no Visual gate, no manifest, no Phase 1.5) | ~30–40% |
| v3.8.0 (gates only, no manifest, no Phase 1.5) | ~55–65% |
| v3.8.1 (gates + manifest + multi-pass) | ~60–70% |
| v3.8.2 (full stack + Phase 1.5) | ~70–80% |
| v3.8.2 + Phase 3 Playwright VRT (hypothetical) | ~92–96% |

### Tier C — Playwright VRT (high cost, high reliability)

Zero LLM token cost (pure pixel diff); requires Playwright + CI + Docker + baseline management infrastructure. Setup cost is high; maintenance cost is high (every design change requires baseline update). Appropriate for teams with existing CI infrastructure and strict brand consistency requirements. Rejected for AI-agent-first workflow at current setup cost.

---

## Required Visual Report Schema (P0-4 Recommendations)

The server parser should enforce these sections in `qa_reports/visual_<task-id>.md`:

- `## Verdict` with final value `PASS`
- `## Canonical State Verification` — selected item, focused row/card, scroll offset, drawer/modal state, interaction path needed to reach the baseline
- `## Widget Shape Verification` — per-row checklist
- `## Structural Assertions` — named element/state presence checks (focus bar, group box, primary button color, selected-card expansion, drawer nesting, legal copy)
- `## Region Diff` or `## Pixel Diff`
- `## Allowed Differences` — qa-visual authored only; coordinator-authored policy markers must be rejected

**Reject PASS if**: no final PASS verdict, any failed canonical state row, any failed structural assertion, unresolved material differences, or allowed differences without qa-visual ownership.

Example structural assertions for CDE-OOBE-class work:
```
primary.button.accent    | all wizard screens    | primary button uses #3C5AAA         | pass/fail
focus.row.bar            | language/network/time | full-width blue focused row rendered | pass/fail
group.container.box      | mode-adjust/network   | settings group has rounded bordered container | pass/fail
mode.selected.description | mode-list            | selected card shows description      | pass/fail
legal.modal.real-copy    | consent-modal         | real legal text, not placeholder     | pass/fail
```

---

## Operating Policy for Visual-Backed Features

| Design source status | Policy |
|---|---|
| No design source | Existing lightweight path; no visual overhead |
| Design source, simple UI | design-auditor baselines + sr geometry assertion + qa-visual final compare |
| Design source, custom widgets or multiple states | Add sr scoped render self-check + per-widget kitchen-sink verification |
| Design source, many surfaces/states (>8–10 canonical states) | PM splits by shell, shared widgets, and surface states before implementation |
| Subagent limits hit | Builder continues only if independent visual judge remains available; otherwise stop as `Blocked` |

---

## Figma-Specific: Mechanical Baseline Filtering

When a PRD supplies a single Figma URL that expands to a multi-surface board, eyeball selection is non-reproducible. The mandated method (from `research/figma-baselines.md`):

1. Fetch the structural data (`get_figma_data` / `get_metadata`).
2. Filter deterministically: keep `type=FRAME` ∧ name matches screen naming convention; drop CONNECTOR, annotation TEXT, child components.
3. Apply semantic anchor: check if each frame's subtree contains the target panel node.
4. Apply ID-prefix grouping: same-feature frames share a common Figma ID prefix; different prefix = different step → exclude.
5. Freeze as `design/<feature>-baseline-manifest.md` (node-id list + filter conditions + exclusion reasons).
6. Downstream roles copy the manifest verbatim; they MUST NOT re-derive from the URL.

**Why this matters**: a network settings board had 29 frames containing the network panel; 21 were Step 4 proper (id prefix `4888:*`); 8 were other steps embedded with the same panel (prefixes `3217:*`, `3554:*`, `3557:*`). Eyeball selection would have included or excluded arbitrarily.

---

## Open Questions

1. **Auto-arm scope**: should `## Visual Baselines` become mandatory for ALL non-`no-design` modes, or only raster-capable sources (figma/sketch/xd)? Paper/whiteboard modes may have no comparable image.
2. **Geometry assertion mechanics**: is a deterministic numeric assert (CSS/computed widths vs Figma dims) feasible in sr-engineer's harness without a browser? Headless render changes the cost trade-off.
3. **Fidelity threshold**: what similarity ratio counts as PASS? Literature favours a tolerance (not zero-diff); a per-feature configurable threshold is likely needed rather than a hard-coded constant.
4. **Vision-LLM floor across models**: Gemini 3 Flash may match Claude's ~5px sensitivity floor at ~60–70% lower per-image cost. Worth benchmarking against real side-by-side mockup pairs.
5. **Baseline freshness**: no mechanism verifies that a `baseline path` recorded at audit time still matches the current Figma frame. Cheap mitigation: compare `baseline path` mtime against `design/<feature>.md` mtime in Phase 1.5; fail-loudly if baseline is older than the audit.

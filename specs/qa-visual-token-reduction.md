# qa-visual-token-reduction

## Problem Statement

`content/skill-qa-visual.md` Phase 1.5 SOP re-reads every baseline+implementation image pair on every visual round, and uses multimodal LLM context for every surface even when zero pixels changed. These two behaviors compose multiplicatively: on a FAIL cycle, cost = (rounds) × (all surfaces) × (per-image read cost). The Language retrospective measured ~1.05M tokens across 4 visual rounds, much of it avoidable re-reads of already-passing surfaces. B10 cuts cross-round redundancy; B11 cuts within-round per-surface image-load cost.

## User Stories

- As a qa-visual engineer on round ≥2, I want to skip re-reading images for surfaces that already passed last round and whose source files are untouched by the engineer's fix, so that I pay image-read cost only for surfaces that could have regressed.
- As a qa-visual engineer running Step B, I want a deterministic pixel-diff tool to pre-screen surfaces before loading images into LLM context, so that surfaces with zero or sub-threshold diff never consume multimodal tokens.

## Acceptance Criteria

### B10 — Delta-only re-diff from round ≥2

**AC-B10-1 (carry-forward gate):** Given a visual round number ≥ 2, when a surface's result in the prior-round `## Region Diff` table is `pass`, and `git diff` (scoped to the files/paths the sr-engineer's fix touched) shows no change to that surface's source, then the QA SOP MUST carry the surface forward as `pass` in the current round's `## Region Diff` table WITHOUT re-reading its baseline or implementation images.

**AC-B10-2 (fallback on ambiguous diff):** Given a visual round ≥ 2, when `git diff` cannot confirm a surface's source is untouched (e.g. the diff is unavailable, the surface's source path is not known, or the diff touches a shared file that could affect the surface), then the QA SOP MUST fall back to a full re-diff of that surface (Step B standard path), as if it were round 1.

**AC-B10-3 (always re-diff non-pass surfaces):** Given a visual round ≥ 2, a surface whose prior-round result was `fail`, `accepted`, or was newly recaptured (state mismatch corrected) MUST be re-diffed in full regardless of the `git diff` evidence.

**AC-B10-4 (report completeness):** A round-≥2 visual report that carries forward prior-`pass` surfaces MUST still include those surfaces in the `## Region Diff` table, each row noting `pass (carried forward — git diff confirms source untouched)` or equivalent so the report is self-contained and the server's `parseRegionDiffFailures` parser continues to accept the row (result = `pass`).

**AC-B10-5 (no server code change required):** The `tools/evidence-file.ts` `parseRegionDiffFailures` function accepts any row whose last cell is `pass` (case-insensitive). Carried-forward rows that write `pass` in the result column require no change to server parsing logic.

### B11 — Deterministic pixel-diff first stage in Step B

**AC-B11-1 (tool-first gate):** Given a surface reaching Step B, the SOP MUST instruct QA to run a deterministic CLI pixel-diff tool (`odiff`, `pixelmatch`, or ImageMagick `compare`) over the surface's declared `compare region` BEFORE loading any image into LLM multimodal context.

**AC-B11-2 (threshold-based escalation):** Given the tool's numeric output (diff percentage or pixel count) for a surface, when the value is at or below the per-baseline declared threshold (default: 0% or tool-reported "identical"), the surface MUST be recorded as `pass` in the `## Region Diff` table without the LLM reading either image.

**AC-B11-3 (LLM escalation on threshold breach):** Given the tool reports a diff above threshold for a surface, the SOP MUST escalate that surface to the LLM step: QA reads both `baseline path` and `impl path` via the Read tool and performs the structured region diff judgment (layout, spacing, element presence, color, text, image content) as currently specified.

**AC-B11-4 (whole-frame-ban preservation invariant):** The deterministic diff MUST be run over the declared `compare region` for each baseline, not the full frame. The instruction "whole-frame pixel-percentage is BANNED as a PASS metric" currently in Step B MUST remain in the SOP, and the new tool-first stage MUST explicitly state it runs over the `compare region`. This invariant is load-bearing: running over the full frame would reintroduce the banned metric by a different path.

**AC-B11-5 (tool unavailability fallback):** When no deterministic diff tool is available in the QA environment (binary absent, Bash not permitted), the SOP MUST specify falling back to the existing LLM-only path (Step B standard) for that surface, with a note in the report.

**AC-B11-6 (no new CI/wrapper script required at MVP):** The deterministic diff stage is a SOP-text instruction directing QA to invoke an existing CLI tool via Bash. No wrapper script, no new npm dependency, and no new npm test is required at MVP. A future improvement may add a convenience wrapper; that is out of scope here.

### Cross-cutting invariant

**AC-INV-1 (whole-frame ban survives both changes):** After both B10 and B11 are applied, the sentence "Whole-frame pixel-percentage is BANNED as a PASS metric" (or semantically equivalent text) MUST remain present in `content/skill-qa-visual.md` Step B. Neither the carry-forward clause nor the tool-first stage may remove or weaken it.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| step-b-tool-first-header | `#### Step B1 — Deterministic Pixel-Diff (tool-first gate)` | authored-here — new SOP sub-step heading for B11 |
| step-b-llm-header | `#### Step B2 — LLM Region Diff (escalated surfaces only)` | authored-here — new SOP sub-step heading for B11 |
| carry-forward-label | `pass (carried forward — git diff confirms source untouched)` | authored-here — canonical result-table label for AC-B10-4 |
| whole-frame-ban | `**Whole-frame pixel-percentage is BANNED as a PASS metric**` | `/Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-visual.md` line 49 (verbatim, must be preserved) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | feature introduces no visual UI tokens | authored-here — SOP-text-only change |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

This section is intentionally absent: `design/<feature>.md` does not exist for this feature (governance SOP text change only; no UI surfaces). The visual PASS gate is not armed.

## Out of Scope

- Any change to `tools/evidence-file.ts` — the existing `parseRegionDiffFailures` parser already accepts `pass`-labeled rows regardless of annotation text; no server code change is needed.
- Any new npm dependency, wrapper script, or CI test for the pixel-diff tool — MVP instruction-only; a future task may add a convenience wrapper if field use shows it is needed.
- Changes to `visual_round` field semantics or the handoff schema.
- B9 (per-feature token budget) — separate backlog item.
- B8 (§7 external-reference enforcement) — separate backlog item.

## Dependencies / Prerequisites

- `content/skill-qa-visual.md` must be the single file edited. Both B10 and B11 are text-only insertions/amendments to existing Step A/B/Phase 1.5 SOP prose.
- `test/context-budget.test.mjs` has no dedicated token cap for `skill-qa-visual.md` (qa-visual is lazy-loaded, not part of any always-on bundle). If the file grows, no existing cap test is affected. QA engineer should verify token count remains reasonable (informational only — no cap to break).
- `tools/evidence-file.ts` `parseRegionDiffFailures`: result column accepted values are `pass` and `accepted` (case-insensitive). Carried-forward rows using `pass` in the result column satisfy this without code change. QA engineer must confirm no parser change is needed after reading the final SOP text.
- No design file exists for this feature (mode = no-design). Visual PASS gate is not armed.

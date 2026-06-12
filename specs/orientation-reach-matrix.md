# Spec: orientation-reach-matrix

> Feature: orientation-reach-matrix
> Status: In_Progress
> Author: pm
> Date: 2026-06-12

---

## Problem Statement

During the Orientation feature (CDE OOBE), the design-auditor froze 4 Figma baselines
representing 4 distinct canonical UI states. The architect's blueprint specified only ONE
test-reach hook (`?step=orientation`), meaning QA could drive only 1 of 4 baselines to its
capture state. The remaining 3 failed as unreachable, triggering a full second round of
sr-engineer + code-reviewer + qa-engineer — ~529k tokens consumed before the gap was
discovered. The defect was paper-verifiable at architecture time: it required no build to
catch. This spec encodes governance rules that prevent that class of defect from recurring.

---

## User Stories

- As an **architect**, I want a mandatory Baseline Reachability Matrix deliverable so that I
  produce a deterministic mapping of every frozen baseline to its exact test-reach mechanism
  before any build begins.
- As a **sr-engineer**, I want reach-hook requirements co-located with surface build tasks so
  that I ship all URL/state hooks in the same task as the UI surface, with no reactive
  second-pass.
- As a **pm**, I want visual evidence gates to require a complete reachability matrix as a
  precondition so that the gate cannot pass when baselines are unreachable.
- As a **governance maintainer**, I want the Baseline Reachability Matrix rule to live in
  `content/skill-architect.md` (the MCP-served SOP) so that the rule propagates automatically
  to all downstream agent sessions.

---

## Acceptance Criteria

### AC-01 — Baseline Reachability Matrix section added to architect SOP
**Given** `content/skill-architect.md` describes the Visual Harness deliverable,
**When** a sr-engineer reads the file,
**Then** the file contains a `## Baseline Reachability Matrix` subsection (or equivalent
named block) inside the Visual Harness section that:
- mandates a table with columns: `baseline id | canonical state description | reach mechanism
  (URL param / store seed / prop + exact value) | paper-verifiable (yes/no)`,
- states that every frozen baseline MUST have a deterministic, paper-verifiable reach mechanism
  before the visual evidence gate can open,
- states this matrix is a precondition to the Visual Harness Gate (Visual Harness Gate may not
  pass until all rows have `paper-verifiable: yes`).

### AC-02 — Reach-hook co-location rule added to architect SOP
**Given** the architect is writing a blueprint for a feature with visual baselines,
**When** the architect assigns implementation tasks,
**Then** the SOP instructs the architect that all reach-hooks (URL query params, store seeds,
props that drive baseline states) MUST be listed as deliverables in the SAME task as the
surface being built — not deferred to a separate task added after a QA FAIL.

### AC-03 — Pre-build reachability self-check rule added
**Given** reach-hooks are specified in the blueprint,
**When** sr-engineer or architect performs a pre-build review,
**Then** `content/skill-architect.md` includes a cheap pre-build reachability self-check
instruction: for each row in the Baseline Reachability Matrix, confirm the mechanism is
present in the code before the full visual build begins, explicitly to move the discovery
cost from the expensive QA playwright stage to the inexpensive pre-build stage.

### AC-04 — B7 marked done in `docs/backlog.md`
**Given** B7 reads "Visual fidelity un-owned until optional last gate",
**When** a reader checks the backlog,
**Then** B7 status is `done` with a note citing the specific mechanisms that now own visual
fidelity: Constitution §3.2 visual gates, `content/skill-qa-visual.md`, `visual_round` caps,
and the Visual Verdict Boundary (v3.26.0).

### AC-05 — No model-tier changes
**Given** the hard constraint prohibiting tier changes,
**When** sr-engineer edits `content/skill-architect.md`,
**Then** no frontmatter `recommended_model` line is modified, and no other agent SOP
frontmatter is touched.

### AC-06 — No code changes
**Given** this is a governance-doc change only,
**When** the PR diff is reviewed,
**Then** no `.ts`, `.mjs`, `.js`, or `package.json` files are modified.

---

## Copy / Strings

This feature introduces governance prose into `content/skill-architect.md`. The exact
wording is sr-engineer's deliverable (authored in the edit session). The semantic requirements
are specified in AC-01 through AC-03 above; exact text is `authored-here` as governance SOP
language.

| string id | exact text | source |
|-----------|-----------|--------|
| S-BRM-HEADING | `### Baseline Reachability Matrix` (or semantically equivalent heading inside Visual Harness) | authored-here — governance SOP heading, no external source |
| S-BRM-TABLE-COLS | `baseline id \| canonical state description \| reach mechanism (URL param / store seed / prop + exact value) \| paper-verifiable (yes/no)` | authored-here — derived from retrospective root-cause columns |
| S-COLO-RULE | prose rule that reach-hooks ship in the SAME task as the surface | authored-here — retrospective recommendation #2 |
| S-PRECHECK-RULE | prose instruction for cheap pre-build reachability self-check before full visual build | authored-here — retrospective recommendation #3 |
| S-B7-DONE | `done — constitution §3.2 visual gates, content/skill-qa-visual.md, visual_round caps, and Visual Verdict Boundary (v3.26.0) own visual fidelity` | authored-here — confirmed by existing codebase mechanisms |

---

## Visual Tokens

Not applicable — this feature introduces no UI.

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | — | feature introduces no visual tokens |

---

## Visual Widgets

Not applicable — this feature introduces no UI.

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets |

---

## Visual Structural Assertions

Not applicable — no design file exists for this governance-doc change (`## Mode` = no-design).

---

## Out of Scope

- Recommendation #4 from the retrospective (tier discipline — drop sr-engineer to sonnet):
  **DROPPED** per explicit user directive. Do NOT modify any agent frontmatter or
  recommended-model lines.
- Any code changes to `index.ts`, tools, guards, schema, or tests.
- Routing through the `architect` role: this change is a governance-doc edit, authored by
  sr-engineer directly.
- Backlog items B6, B8 — separate features.
- Any changes to consumer-project CLAUDE.md files — the rule lives in the MCP-served SOP
  (`content/skill-architect.md`), not in any downstream workspace.

---

## Dependencies / Prerequisites

- No external references in this spec (Resource Audit: no HTTP URLs, no Figma links,
  no Azure DevOps tickets, no external design files).
- `content/skill-architect.md` must be read in full before editing to understand the
  existing Visual Harness section structure (around lines 20–27) and insertion points.
- `docs/backlog.md` B7 entry must be updated to `done` with mechanism citations.
- Chain: pm → sr-engineer → code-reviewer → qa-engineer (no architect hop; governance-doc
  change does not meet the 3-module / new-data-model / cross-cutting-API threshold).

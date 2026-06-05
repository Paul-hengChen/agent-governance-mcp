<!-- @pm | feature_id: visual-fidelity-gate-hardening | created_at: 2026-06-04 -->

# Spec: Visual Fidelity Gate Hardening

## Problem Statement

The visual-fidelity pipeline (design-auditor `## Visual Baselines`, sr-engineer Design-Aware
Pre-Flight, qa-visual Phase 1.5, server `VISUAL_EVIDENCE_MISSING` gate, `visual_round` counter)
is fully implemented but not self-arming: the server arms the gate only when the design file
happens to contain a `## Visual Baselines` H2, so a well-formed design doc that omits the section
(exactly what occurred in the `oobe-setup-wizard` incident) silently disables the entire visual
chain and `visual_round` stays 0. Concurrently, composition/layout intent has no owner: the
design-auditor template has no `## Layout / Canvas` section, no role ever compared the root-frame
geometry against the build, and the single foundational decision (fixed 1280×720 stage vs fluid
full-width) cascaded undetected across 8 screens under all-green gates. This feature closes both
holes by moving the arming signal from "Visual Baselines H2 present?" to "design source exists and
mode ≠ no-design?", adding server enforcement for the missing-baselines case, and inserting a
near-free geometry assertion at the sr-engineer screen-1 build gate.

---

## Research-to-AC Coverage Map

The five recommendations in `research/design-fidelity-workflow.md` are mapped to acceptance
criteria below so coverage is auditable.

| Research Rec | AC(s) |
|---|---|
| R1 — design-auditor: make gate self-arming + capture composition | AC-1, AC-2, AC-3, AC-9 |
| R2 — PM: promote canvas framing to first-class spec field | AC-4 |
| R3 — sr-engineer: add screen-1 Geometry Assertion build-gate | AC-5, AC-6 |
| R4 — qa-visual: unchanged but now actually fires | AC-1, AC-3 (gate now guarantees firing) |
| R5 — Token economics: formalise two-tier read (geometry A + pixel B) | AC-6, AC-7 |

---

## User Stories

- As the **coordinator**, I want a design-backed feature to automatically require visual QA, so
  that no design-source feature can reach PASS with `visual_round = 0`.
- As the **design-auditor**, I want a mandatory `## Layout / Canvas` section in the audit
  template, so that root canvas geometry is always captured and never silently dropped.
- As the **sr-engineer**, I want a geometry assertion step at screen 1, so that a wrong
  foundational layout decision is caught before it propagates to every subsequent screen.
- As the **pm**, I want the spec's Dependencies / Prerequisites to carry the canvas/stage
  decision verbatim from the design doc, so that the fluid-vs-fixed choice is a hard
  requirement, not a silent default.
- As a **future maintainer**, I want `constitution.md` and `skill-design-auditor.md` to agree on
  what "absence of `## Visual Baselines`" means for mode ≠ no-design, so that contradictory text
  does not create interpretation gaps.

---

## Acceptance Criteria

### AC-1 — Server arming signal changes from Visual-Baselines-H2 to design-mode

**Given** `design/<feature>.md` exists and its `## Mode` line is NOT `no-design`,
**When** `tw_update_state(status=PASS)` is called,
**Then** the server checks for `## Visual Baselines` in the design file; if absent, it returns
`⛔ VISUAL_BASELINES_REQUIRED` (not a silent pass-through).

**Given** `design/<feature>.md` does not exist, OR its `## Mode` line IS `no-design`,
**When** `tw_update_state(status=PASS)` is called,
**Then** the visual gate is silent and pass-through (existing non-UI behaviour preserved).

Implementation note: a new helper `hasDesignModeRequiringVisual(workspacePath, activeFeature)`
must be added to `tools/evidence-file.ts`; it reads `## Mode` and returns `{required: boolean,
designPath: string}`. The existing `hasVisualBaselinesInDesign` is then called conditionally, and
a new code path emits `VISUAL_BASELINES_REQUIRED` when `required=true` but baselines are absent.

### AC-2 — Contradictory sentence removed from skill-design-auditor.md

**Given** `content/skill-design-auditor.md`,
**When** the `## Visual Baselines` bullet is read,
**Then** the sentence "Absence of this section MUST cause QA Phase 1.5 to skip silently — non-UI
features pay zero overhead." is gone; in its place the text clarifies that absence is legitimate
ONLY when `mode = no-design`, and that absence with any other mode blocks PASS at the server.

### AC-3 — constitution.md §3.1 and §4 updated to match new arming logic

**Given** `content/constitution.md`,
**When** §3.1 Visual evidence gate bullet and the §4 paragraph about `visual_round` are read,
**Then** both describe the arming condition as "design file exists with mode ≠ no-design" (not
"`## Visual Baselines` H2 present"), and both describe the missing-baselines case as a
`VISUAL_BASELINES_REQUIRED` block rather than a silent pass-through.

### AC-4 — PM spec schema carries canvas framing verbatim

**Given** `content/skill-pm.md` Dependencies / Prerequisites bullet,
**When** a design file with a `## Layout / Canvas` section exists,
**Then** the PM SOP instructs copying the fixed-vs-responsive decision and root canvas dimensions
verbatim into the spec's Dependencies / Prerequisites section (the partial edit already added this;
the AC verifies it is complete and unambiguous).

### AC-5 — sr-engineer Geometry Assertion step specifies HOW dimensions are read

**Given** `content/skill-sr-engineer.md` step 3a Geometry Assertion,
**When** the step is read,
**Then** it specifies the read method for the implementation's actual dimensions:
  - **primary path**: read computed CSS layout values from the running/built output (e.g.
    `document.querySelector('.main-container').getBoundingClientRect()` via a lightweight
    headless snapshot, or an existing dev-server URL call — whichever is cheapest in the
    workspace's build environment); or if no running environment is available,
  - **fallback**: inspect the source CSS/SCSS/Tailwind literals for the container widths and
    margins declared in the implementation files, comparing them directly to the
    `## Layout / Canvas` values (no headless render required; numeric string match).
  The step explicitly labels this a "number-vs-number assertion" (no vision, near-free).

### AC-6 — sr-engineer Geometry Assertion specifies graceful degradation for absent Layout/Canvas

**Given** `content/skill-sr-engineer.md` step 3a,
**When** no `design/<active_feature>.md` exists, OR `## Layout / Canvas` is absent from it (older
design doc without the section),
**Then** the step instructs the sr-engineer to skip the geometry assertion silently and continue
(same skip-when-no-design-file behaviour as the rest of step 3a); the step does NOT block
the build when the section is absent.

### AC-7 — Two-tier token economics formalised in spec (rationale documented)

**Given** `specs/visual-fidelity-gate-hardening.md` (this file) and
`specs/qa-flow-enforcement-architecture.md` (the enforcement matrix),
**When** future maintainers consult the enforcement spec,
**Then** it is clear that:
  - Tier A (geometry assertion) = one shallow root-frame metadata fetch, number-vs-number,
    no vision, runs once at screen 1 (sr-engineer).
  - Tier B (pixel/fidelity diff) = vision-model reasoning, expensive, runs once at end
    (qa-visual Phase 1.5).
  The architect's task is to document this split in `specs/qa-flow-enforcement-architecture.md`
  under a new "Visual Gate Tiers" section.

### AC-8 — Empty-node honesty enforced in skill-design-auditor.md

**Given** `content/skill-design-auditor.md` step 4 (Audit),
**When** a Figma/design fetch returns `nodes: []` for a surface,
**Then** the SOP instructs the auditor to mark that surface `empty`/`unresolved` in the Source
manifest, never `audited`.
(Note: the partial edit already added this; this AC verifies the wording is unambiguous and the
distinction from `deferred` is clear — `empty` means the API returned no data; `deferred` means
the auditor chose not to audit it yet.)

### AC-9 — New VISUAL_BASELINES_REQUIRED error code documented in enforcement matrix

**Given** `specs/qa-flow-enforcement-architecture.md`,
**When** the error-code table is consulted,
**Then** `VISUAL_BASELINES_REQUIRED` appears as a new row:
  - trigger: `design/<feature>.md` mode ≠ no-design AND `## Visual Baselines` absent
  - resolution: design-auditor must add the `## Visual Baselines` section before PASS is retried.

### AC-10 — No regression on non-UI pass-through

**Given** a workspace with no `design/<feature>.md` (or one with `mode: no-design`),
**When** `tw_update_state(status=PASS)` is called,
**Then** all visual gates are silent; PASS is not blocked by any visual-related error code.
(Preserves the backwards-compatible non-UI path for token-frugal non-design work.)

---

## Copy / Strings

All strings below are new server error message text introduced or changed by this feature.

| string id | exact text | source |
|---|---|---|
| ERR_VISUAL_BASELINES_REQUIRED | `⛔ VISUAL_BASELINES_REQUIRED: design/<feature>.md declares mode != no-design but ## Visual Baselines is absent. Add the Visual Baselines section (design-auditor SOP §Artifact Schema) before retrying PASS.` | authored-here — server error message completing the gap identified in `docs/postmortem-visual-fidelity-gate.md §3` |
| CONSTITUTION_GATE_LABEL | `Visual evidence gate (v3.16.0)` | authored-here — version bump label for the §3.1 bullet being updated |

---

## Visual Tokens

This feature modifies no UI rendering. No visual tokens apply.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature has no visual token changes |

---

## Visual Widgets

This feature modifies no UI rendering. No non-primitive widgets apply.

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

---

## Out of Scope

- Changing the `visual_round` cap (currently 5; no evidence it is wrong).
- Adding a fidelity threshold (similarity ratio for pixel diff PASS/FAIL) — the research Open
  Question on threshold values is deferred (see Dependencies / Prerequisites: Q-OQ2).
- Migrating existing `design/<feature>.md` files that predate this feature to add
  `## Layout / Canvas` — backwards-compat clause: older docs without the section cause the
  geometry assertion to skip silently (AC-6).
- Adding headless-browser infrastructure to the repo. The geometry assertion (AC-5) specifies
  CSS literal inspection as the primary path precisely to avoid this dependency.
- Changing qa-visual Phase 1.5 mechanics (it already works correctly once armed).

---

## Dependencies / Prerequisites

### Resolved: canvas / stage decision (from design source)

This spec does not implement a UI feature; there is no design source and therefore no
`## Layout / Canvas` section to copy. The canvas-framing requirement in AC-4 governs future
features, not this one.

### Open Questions requiring human decisions (Question Batch Gate)

The following Open Questions from `research/design-fidelity-workflow.md` require a PM/maintainer
ruling before the affected acceptance criteria can be finalised. They are flagged here rather than
blocking the feature because AC-1 through AC-10 above are complete without them; the questions
affect future policy, not this implementation.

**Q-OQ1 — Auto-arm scope: paper/whiteboard modes**
Research Open Question: "should `## Visual Baselines` become mandatory for ALL non-`no-design`
modes, or only raster-capable sources (figma/sketch/xd) where baseline images exist? Paper and
whiteboard modes may have no comparable export image."

Decision needed: the current spec (AC-1) arms the gate for ALL modes except `no-design`, meaning
`paper` and `image` modes will require a `## Visual Baselines` section and will block PASS if
absent. If the intended policy is raster-only arming, AC-1 and `hasDesignModeRequiringVisual`
must add an exemption list (`paper`, `image`) to the "required" set.

**Recommendation** (author): arm ALL non-`no-design` modes as specced. Paper/whiteboard audits can
populate `## Visual Baselines` with the photo/scan path as the baseline image — this is a useful
check, not a burden. Raster-only exemption adds complexity for marginal benefit.

**Q-OQ2 — Fidelity threshold for pixel diff PASS/FAIL**
Research Open Question: "what similarity ratio counts as PASS vs a `visual_fail:`? The literature
favours a tolerance, not zero-diff, but the cap is currently undefined in `skill-qa-visual.md`."

Decision needed: this is out of scope for this feature (see Out of Scope above) but must be
addressed in a follow-on. A concrete threshold value (e.g. ≥ 90% similarity) should be added
to `skill-qa-visual.md` and tested against at least one real baseline run before being codified.

**Q-OQ3 — Geometry assertion primary read method per project type**
Resolved by AC-5: the spec now specifies CSS literal inspection as primary (no headless render),
with headless as an optional secondary path. This closes the research Open Question "is a
deterministic numeric assert feasible without a browser?" — answer: yes, via source inspection.
No human decision needed.

### Blocking technical prerequisite

T-ARCH must deliver the interface/contract for `hasDesignModeRequiringVisual` before T-SERVER
can implement it. See task list.

---

## Task List

Tasks are appended via `tw_add_task` after this spec is written. The list below is the
authoritative ordering; task IDs are assigned by the tool.

```
T-ARCH  [P0] Architect: design the interface for hasDesignModeRequiringVisual + VISUAL_BASELINES_REQUIRED error code + update qa-flow-enforcement-architecture.md with Visual Gate Tiers section (AC-7, AC-9) | depends_on: none
T-SERVER [P0] sr-engineer: implement hasDesignModeRequiringVisual in tools/evidence-file.ts + wire VISUAL_BASELINES_REQUIRED into index.ts PASS validation path (AC-1) | depends_on: T-ARCH
T-CONST [P1] sr-engineer: update content/constitution.md §3.1 and §4 to match new arming logic (AC-3) | depends_on: T-SERVER
T-SKILL [P1] sr-engineer: reconcile content/skill-design-auditor.md contradictory sentence (AC-2) + confirm AC-8 empty-node wording | depends_on: T-ARCH
T-SR    [P1] sr-engineer: update content/skill-sr-engineer.md Geometry Assertion step with read method + degradation clause (AC-5, AC-6) | depends_on: T-ARCH
T-QA    [P1] qa-engineer: write tests for hasDesignModeRequiringVisual (all mode branches) + VISUAL_BASELINES_REQUIRED gate in PASS path + non-UI pass-through regression (AC-1, AC-10) | depends_on: T-SERVER
```

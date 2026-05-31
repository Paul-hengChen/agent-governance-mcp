# Spec: feature-scope-gate

> Source: user request (this session) + `research/automation-flow-per-skill-token-zh.md`.
> Adds a coordinator front-door gate that assesses whether an incoming PRD should be
> split into multiple features BEFORE routing, stops for human confirmation when a
> split is warranted, and emits a fill-in schema to assist the human split.

## Problem Statement

PM decomposes a **single** feature into tasks; nobody upstream judges whether the
incoming PRD is actually **one** feature or **many**. A large multi-feature PRD fed
whole overruns the design-auditor's 5-pass×250-line cap (surfaces silently
`deferred`), bloats the PM spec, and degrades pixel fidelity. The judgment of
"should a human split this PRD first" is currently ad-hoc (researcher on request).
This feature makes it a deterministic, **token-frugal, text-only** coordinator gate
that interrupts for the human only when a split is warranted, and hands the human a
ready-to-fill split schema (per-feature Figma link + notes).

## User Stories

- As a **human operator**, I want the coordinator to tell me upfront when a PRD is
  too big for one feature and propose a split, so that I don't discover dropped
  coverage after the auditor silently defers surfaces.
- As a **human operator**, I want a pre-filled schema listing the detected feature
  units with columns for me to add each one's Figma link + notes, so that splitting
  is guided, not freehand.
- As a **cost-conscious maintainer**, I want this assessment to read only PRD text
  (never fetch Figma) and add minimal always-on token weight, so that the gate is
  nearly free and never re-inflates the bundle we just trimmed.
- As an **operator of a single-feature task**, I want the gate to be a silent no-op,
  so that normal automation runs uninterrupted.

## Acceptance Criteria

- **AC1 (gate placement + trigger)**
  - Given `skill-coordinator.md`,
  - When the SOP is read,
  - Then a **Feature-Scope Gate** runs after state-sync and BEFORE design-source
    detection + Complexity Scope Gate, and it applies only to an incoming PRD/ticket
    of non-trivial size (a single-file edit / Q&A / status query skips it silently).
- **AC2 (text-only, no Figma fetch)**
  - Given the gate logic,
  - When it assesses split-need,
  - Then it uses ONLY PRD text signals — self-enumerated steps/screens/sections,
    **count** of design-source references (grep, not fetch), presence of a
    cross-cutting shared layer, and size — and MUST NOT call any Figma/Sketch/design
    MCP or fetch any design URL. The skill text states this constraint explicitly.
- **AC3 (single-feature → continue; multi-feature → stop + ask)**
  - Given the verdict,
  - When it is **single-feature**, the coordinator proceeds with normal routing
    (no interruption);
  - When it is **multi-feature**, the coordinator STOPS auto-routing, emits the
    Feature-Split Plan (AC4) to `.current/feature-split.md`, and asks the human to
    complete + confirm it (with hints) before any further routing.
- **AC4 (Feature-Split Plan schema)**
  - Given a multi-feature verdict,
  - When the coordinator writes `.current/feature-split.md`,
  - Then it conforms to the **Feature-Split Plan schema** (below): an `## Assessment`
    block (verdict + the signals that fired) and a `## Split Table` whose rows the
    coordinator pre-fills for the machine-derivable columns and leaves the
    human-owned columns (`figma link`, `notes / 注意事項`) blank for completion, plus
    a `## How to proceed` block telling the human to fill the blanks and re-invoke
    `/teamwork` once per row in `order`.
- **AC5 (token-frugal footprint)**
  - Given the gate is added to the always-injected `skill-coordinator.md`,
  - When `scripts/measure-context-cost.mjs` is run,
  - Then the coordinator skill's added weight is minimal (target: the gate prose adds
    ≤ ~40 lines / ≤ ~400 approx tokens to `skill-coordinator.md`); the detailed
    schema example lives in the skill as a compact reference, not duplicated into the
    constitution or any other always-on artifact.
- **AC6 (lite unaffected)**
  - Given `skill-coordinator-lite.md`,
  - When it is read,
  - Then it is unchanged — lite remains single-shot and escalates large work to
    `/teamwork` via its existing scope-creep rule (the gate lives in full coordinator
    only).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| split.heading | `# Feature Split Plan` | authored-here — artifact title for `.current/feature-split.md` |
| split.col.figma | `figma link` | authored-here — human-fill column header |
| split.col.notes | `notes / 注意事項` | authored-here — human-fill column header (bilingual per user request) |
| split.proceed | `How to proceed` | authored-here — H2 guiding the human |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | non-UI governance-content feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Feature-Split Plan schema (`.current/feature-split.md`)

```markdown
# Feature Split Plan: <PRD name / source>
> Generated by coordinator Feature-Scope Gate (text-only assessment — no Figma was read).
> Complete every blank `figma link` and `notes / 注意事項` cell, then re-invoke /teamwork once per row in `order`.

## Assessment
- verdict: multi-feature (<N> units recommended)
- signals: <which fired — e.g. "PRD self-enumerates 7 steps; 9 design refs; cross-cutting nav/theme/input layer; ~12k tok">

## Split Table
| order | feature id | scope (one line) | figma link | depends_on | key visual widgets | notes / 注意事項 |
|---|---|---|---|---|---|---|
| 0 | <shared-foundation-id> | <one line> |  | none | <widget or —> |  |
| 1 | <feature-id> | <one line> |  | F0 | <widget or —> |  |
| … | … | … |  | … | … |  |

## How to proceed
1. Fill every blank `figma link` + `notes / 注意事項` cell.
2. Build `order: 0` (shared foundation) first; later features reference it.
3. Re-invoke `/teamwork` once per row, in `order`, pasting that row's scope + figma link.
```

Column ownership: coordinator pre-fills `order`, `feature id`, `scope`, `depends_on`,
`key visual widgets` (from PRD text); human fills `figma link` + `notes / 注意事項`.

## Out of Scope

- **Auto-splitting the PRD document** — only the human can split the source doc and
  attach per-feature design links; the gate recommends + collects, it does not split.
- **Reading/fetching Figma in the coordinator** — extraction stays in design-auditor,
  downstream, per-feature (AC2).
- Changing the server transition matrix (`tools/transitions.ts`) — the gate is
  prompt-layer + a human checkpoint, advisory like design-source detection.
- `skill-coordinator-lite.md` (AC6).

## Dependencies / Prerequisites

- **Resource audit (constitution §7)**: the OOBE PRD path and the `research/*.md`
  files mentioned this session are the **motivating example**, not consumed by this
  generic gate → classified `ignore` (no fetch/index).
- Touches the always-injected `skill-coordinator.md` → the AC5 footprint cap is a
  hard constraint, not a nicety (it directly offsets the v3.16.2 budget reduction).

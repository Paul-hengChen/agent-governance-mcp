# Spec: design-auditor-volume-guard

> Source: user concern (this session) — the Feature-Scope Gate (v-next) splits a PRD
> at the feature level, but a single feature whose human-pasted Figma is huge can
> still blow the design-auditor's context on the FETCH (before the 5-pass×250-line
> OUTPUT cap can help). This feature adds an INPUT-side volume guardrail.

## Problem Statement

The design-auditor's existing caps (5-pass × 250-line output, max 3 attempts / 5
files per surface) bound **output coverage** and fail loud via the `deferred` Source
manifest — but they do NOT bound the **raw fetch**. A single feature pointed at a
whole-file Figma link can pull a massive `get_figma_data` payload (tens of thousands
of tokens) into context before any pass logic runs — the auditor "blows up" on
ingestion, not on coverage. This feature adds three input-side guards: (1) a
pre-fetch **Volume Gate** that STOPs and recommends splitting an oversized single
feature instead of ingesting it, (2) a **node-scoped fetch** rule so the auditor
pulls only the frames it is auditing this pass, and (3) a coordinator schema change
asking the human to paste **frame-scoped** (not whole-file) design links.

## User Stories

- As a **maintainer**, I want the design-auditor to refuse to ingest an oversized
  single-feature design and instead recommend splitting it further, so that the
  fetch never blows the context window.
- As the **design-auditor**, I want to fetch only the node(s)/frame(s) I am auditing
  this pass, so that a large parent file doesn't enter context wholesale.
- As a **human operator**, I want the split schema to tell me to paste frame-scoped
  Figma links, so that each feature's fetch is naturally bounded.

## Acceptance Criteria

- **AC1 (pre-fetch Volume Gate)**
  - Given `content/skill-design-auditor.md`,
  - When the SOP is read,
  - Then a **Volume Gate** runs BEFORE extraction (after mode detection): the auditor
    estimates the design source's surface/frame count or fetch size, and if a single
    feature's source exceeds the threshold (more than roughly one feature's worth —
    i.e. more surfaces than 5 passes × 250 lines could audit, OR a fetch that would
    dominate the context budget), it STOPs with `status=Blocked` and
    `next_role: pm`/`human`, recommending the feature be split further — it does NOT
    ingest-then-defer.
- **AC2 (node-scoped fetch)**
  - Given the extraction step,
  - When the auditor fetches a `figma`/`sketch`/`xd`/`penpot` source,
  - Then the SOP requires scoping the fetch to the specific node/frame id(s) being
    audited this pass (e.g. pass node ids to `get_figma_data`; `download_figma_images`
    per node) rather than pulling the whole document.
- **AC3 (frame-scoped link guidance)**
  - Given `content/skill-coordinator.md` Feature-Split Plan schema,
  - When it instructs the human on the `figma link` column,
  - Then it asks for a **frame/node-scoped** link (deep link to the specific frame),
    not a whole-file link — in minimal added prose (always-on budget).
- **AC4 (fail-loud, never silent)**
  - Given the Volume Gate trips,
  - When it STOPs,
  - Then the `pending_notes` state the surface/frame count and the split
    recommendation — coverage is never silently truncated.
- **AC5 (scope: fetch-modes only; output cap unchanged)**
  - Given the guard,
  - When the mode is `image`/`pdf`/`paper` (human-confirmed values) or `no-design`,
  - Then the Volume Gate + node-scoped-fetch rules are no-ops (they apply to
    fetch-based modes), and the existing 5-pass×250-line output cap + Source manifest
    behaviour is unchanged.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| vguard.block | `design-auditor: design source oversized — recommend splitting feature further` | authored-here — Blocked pending_notes prefix for the Volume Gate |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | non-UI governance-content feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Server-side enforcement of fetch size (the guard is prompt-layer SOP, like the
  existing per-surface caps — no `tools/` change).
- Changing the 5-pass×250-line output cap or the Source manifest deferral mechanism
  (those stay; this adds an input-side gate in front of them).
- Auto-splitting the feature's Figma (the auditor recommends; human re-scopes).

## Dependencies / Prerequisites

- Builds on the Feature-Scope Gate (`specs/feature-scope-gate.md`, this session):
  that gate splits the PRD into features; this guard protects each feature's design
  fetch. The AC3 schema change extends the same `.current/feature-split.md` schema.
- `content/skill-design-auditor.md` is loaded only on design-auditor invocation (not
  always-on), so its added prose is per-design-task cost, not per-session — latitude
  is higher there than for the coordinator skill (AC3 must stay minimal).
- No external references requiring fetch/index.

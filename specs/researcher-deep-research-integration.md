# Spec: researcher-deep-research-integration

## Problem Statement

The `researcher` role's SOP (`content/skill-researcher.md`) tells the agent to
"research using web search, file reads, code traversal" but never wires it to
the Claude Code `/deep-research` skill (the fan-out, multi-source,
adversarially-verified harness). Today a `deep`-depth researcher does ad-hoc
manual searching instead of the stronger harness, and a **standalone**
invocation (one not routed through coordinator/PM, so no `researcher_depth:`
line exists in `pending_notes`) has no depth signal at all — leaving behaviour
undefined. We want: deep-depth researcher to leverage `/deep-research`, and a
bare standalone call to default to `deep` so it automatically gets that effect.

## User Stories

- As a developer, I want a standalone `researcher` invocation to default to
  `deep` depth, so that calling it directly automatically runs the
  `/deep-research` harness without me declaring a depth.
- As a coordinator/PM, I want `researcher` at `deep` depth to invoke
  `/deep-research` for multi-source gathering, so that findings rest on the
  stronger harness rather than ad-hoc manual search.
- As a researcher agent in a session lacking the `/deep-research` skill, I want
  a defined fallback, so that depth=deep degrades gracefully to manual web
  search instead of failing.

## Acceptance Criteria

- **AC-1 (default-deep standalone)**
  - Given the `researcher` SOP/Depth clause,
  - When it describes the no-`researcher_depth:`-declared (standalone) case,
  - Then it states the default depth is `deep`.
- **AC-2 (deep invokes deep-research)**
  - Given the `researcher` SOP research step,
  - When depth is `deep`,
  - Then it directs the agent to invoke the `/deep-research` skill (when
    available in the session) to gather a multi-source cited report, then
    distil it into the Findings Schema.
- **AC-3 (graceful fallback)**
  - Given depth is `deep` but the `/deep-research` skill is unavailable in the
    session,
  - When the researcher runs,
  - Then the SOP directs a fallback to manual web search (no hard failure).
- **AC-4 (shallow unchanged)**
  - Given depth is `shallow`,
  - When the researcher runs,
  - Then the SOP does NOT require invoking `/deep-research` (cost-frugal path
    preserved).
- **AC-5 (trigger behaviour test)**
  - Given the test suite,
  - When it runs,
  - Then a content-assertion test verifies `content/skill-researcher.md`
    contains the default-deep directive (AC-1) and the deep-research invocation
    directive (AC-2), and that the standalone-default and `/deep-research`
    tokens are present.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| str-default-deep | `Standalone invocation (no `researcher_depth:` declared in pending_notes) defaults to `deep`.` | authored-here — SOP rule wording, no canonical design source (governance content) |
| str-deep-invoke | `At `deep` depth, invoke the `/deep-research` skill (if available in the session) to gather a multi-source, cited report, then distil into the Findings Schema.` | authored-here — SOP rule wording |
| str-deep-fallback | `If `/deep-research` is unavailable, fall back to manual web search.` | authored-here — SOP fallback wording |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (governance content change) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Server-side enforcement that researcher actually calls `/deep-research`
  (remains prompt-layer guidance; the server enforces routing/state only, not
  skill invocation).
- Auto-installing or provisioning the `/deep-research` skill into sessions that
  lack it.
- Changes to the `shallow` depth path beyond confirming it stays unchanged.
- Any change to coordinator/PM depth-declaration mechanics for the routed path.

## Dependencies / Prerequisites

- **User decision (2026-05-30)**: standalone invocation with no declared depth
  defaults to **`deep`** (so a bare `researcher` call auto-runs deep-research).
  Resolved via Question Batch Gate.
- External-reference audit: no external URLs / design files / tickets in the
  request — nothing to fetch/index.
- No design source detected → design-auditor skipped.

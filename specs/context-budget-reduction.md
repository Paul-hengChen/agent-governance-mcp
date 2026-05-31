# Spec: context-budget-reduction

> Source requirements: `research/token-burn-mitigations-zh.md` (Recommendation #1–#2),
> `research/architecture-vs-industry-and-token-frugality-zh.md` (always-on bundle gap).
> Scope confirmed with user: **measure first, then implement** the on-demand / lean
> always-on split. Items #1 (prompt caching, harness-side), #3 (sub-agent summaries,
> no parallel execution here), #4 (circuit breakers, done), #5 (RAG, done) are OUT.

## Problem Statement

The only per-turn, structurally-reducible token cost in this server is the **always-on
context bundle**: the SessionStart hook (`bin/agent-governance-context.mjs`) injects the
full `constitution.md` + a coordinator skill on every managed-workspace session, and
`buildPromptForRole` (`prompts/build.ts`) re-bundles `constitution.md` + role skill +
state into all seven registered prompts. The actual token weight of this bundle has
**never been measured**, so neither the cost nor the ROI of any reduction is known. We
must quantify the baseline, then reduce it without weakening the governance the bundle exists to enforce.

## User Stories

- As a **maintainer**, I want a repeatable measurement of the always-on bundle's token
  cost, so that I can decide which reductions are worth shipping.
- As an **agent operator**, I want the per-session/per-prompt injected context trimmed to
  what each context actually needs, so that long `/teamwork` sessions burn fewer tokens.
- As a **governance owner**, I want any reduction to preserve rule enforceability, so that
  saving tokens never silently drops a constitution rule an agent must follow.

## Acceptance Criteria

- **AC1 (measurement, P0 gate)**
  - Given the server checkout,
  - When the maintainer runs the measurement script,
  - Then it prints a per-artifact token table covering `constitution.md`, each
    `content/skill-*.md`, the SessionStart hook output (both `lite` and `full` variants),
    and each of the seven role-prompt bundles produced by `buildPromptForRole`,
  - And it reports an approximate token count per artifact and a total always-on figure,
  - And it exits 0 with a deterministic, diff-able report.
- **AC2 (reduction)**
  - Given the AC1 baseline,
  - When the reduction is applied,
  - Then the measured always-on injected token count drops by a margin the architect sets
    from the baseline (target declared in the design doc, not guessed here),
  - And the reduction is achieved by leaning/restructuring what is always-on and/or
    loading role-specific detail on demand — NOT by deleting any normative rule.
- **AC3 (enforcement preserved)**
  - Given the reduced bundle,
  - When any existing test in `test/` runs,
  - Then all pass, and every constitution rule remains reachable by the role that needs it
    (no rule silently dropped from the path that enforces it).
- **AC4 (no behavioral regression in routing)**
  - Given the reduced bundle,
  - When a `/teamwork` chain runs pm → … → qa,
  - Then server-enforced transitions, evidence gates, and circuit breakers behave exactly
    as before (this change is context-shaping only, never transition logic).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| measure.report.title | `Always-on context budget` | authored-here — dev-facing CLI diagnostic header, no design source |
| measure.report.total | `TOTAL always-on (constitution + default skill)` | authored-here — dev-facing CLI diagnostic label |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature is internal infra; introduces no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Prompt caching (#1)** — harness/Anthropic-API side; this server only returns prompt
  strings. May only be *aided* by stable-prefix ordering, not implemented here.
- **Sub-agent compressed summaries / model-routing (#3)** — framework has no parallel
  execution; not applicable.
- **Circuit breakers (#4)** — already implemented (`tools/transitions.ts`).
- **RAG retrieval (#5)** — already implemented (`tools/rag.ts`).
- Any change to transition logic, evidence gates, or routing rules.

## Dependencies / Prerequisites

- **Resource audit (constitution §7)**: the two source `research/*.md` files cite Anthropic
  docs URLs (context-engineering, building-effective-agents, Claude Code). These are
  **rationale already distilled into the findings** → classified `ignore` (not load-bearing
  external artifacts; no fetch needed).
- **AC2 is gated on AC1**: the reduction target is set by the architect from the measured
  baseline. Implementation tasks (T02–T04) MUST NOT start before T01's baseline exists.
- Token counting may use a dependency-free approximation (e.g. chars/4) — architect
  confirms method; no new runtime dependency is required by this spec.

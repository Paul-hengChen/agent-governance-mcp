# Spec: skill-polish-v3.12

## Problem Statement

The v3.9 evaluation report (`research/process-retrospective.md`) flagged residual improvements after v3.10/v3.11 shipped. Three gaps remain: (1) architect skill lacks an Architecture Decision Record (ADR) section for trade-off persistence; (2) the constitution's §6 Security chapter and all 13 skill files have never been audited as a set for token-frugality (duplication of constitution rules, padding, redundant examples); (3) the user has explicitly asked for a sweep across code-reviewer, architect, coordinator, coordinator-lite, researcher to confirm v3.11 closed the v3.9-era gaps and to apply final polish. Without this pass, the prompt payload (currently ~580 lines across content/) grows monotonically as each release appends.

## User Stories

- As a solo developer using coordinator-lite, I want every prompt to be free of restated constitution rules, so that per-session token cost stays bounded.
- As an architect role agent, I want a structured place to record design trade-offs, so that future sessions can revisit decisions without re-deriving them.
- As a maintainer auditing the governance layer, I want explicit verification that the constitution's Security chapter covers the v3.9 eval's flagged gaps (OWASP-level guidance, dependency audit), so that I can confirm coverage before a v3.12 cut.

## Acceptance Criteria

- **Given** the architect skill at `content/skill-architect.md`, **when** the file is read after this feature, **then** it MUST contain a new H2 `## Decision Records` section that defines an ADR table format (Context / Decision / Consequences) and instructs the architect to emit one ADR row per non-trivial trade-off into `specs/<feature>-architecture.md`.
- **Given** the constitution at `content/constitution.md`, **when** §6 is read, **then** it MUST explicitly call out the dependency-audit rule (already present) AND retain the `.env*` / `*secret*` access-denied rule. The audit report (see Token-Frugality Audit below) MUST confirm no additional Security rules are required (or list exactly what is being added with rationale).
- **Given** all 13 files under `content/`, **when** the token-frugality audit completes, **then** an audit artifact `research/token-economics.md` MUST exist listing: (a) any line that restates a constitution rule inside a skill (constitution §1 *Skills inherit everything below — they MUST NOT restate these rules.*), (b) any redundant example/padding that can be deleted without semantic loss, (c) per-file before/after line count.
- **Given** the audit findings, **when** the cleanup pass is applied, **then** each flagged file MUST be edited to remove the duplication/padding, and the constitution + skill files combined MUST shrink by ≥ 5% (≥ 29 lines below the current 580 total) OR the audit MUST justify why no cleanup is warranted.
- **Given** the coordinator-lite skill, **when** read after this feature, **then** it MUST NOT contain any restated `tw_get_state`/`tw_detect_drift`/`tool-first`/`watermark` rule already present in the constitution (the lite skill is the most token-sensitive surface and is loaded on every solo session).
- **Given** the coordinator skill, **when** read after this feature, **then** the Routing Table + Complexity Scope Gate + Design-source detection sections MUST remain intact (no removal of behavioural rules); only restated constitution clauses and verbose prose may be trimmed.
- **Given** the code-reviewer / researcher skills, **when** read after this feature, **then** their v3.11-era schemas (Performance section for code-reviewer; depth control + credibility tier for researcher) MUST remain intact; the pass is purely subtractive (or no-op) on these two files.
- **Given** the build, **when** `npm run build` is run after the edits, **then** it MUST succeed with zero TS errors (no production code changes are expected, but `content/` files are bundled into prompts so any path/anchor reference inside `prompts/build.ts` MUST still resolve).
- **Given** the existing test suite, **when** `npm test` is run, **then** all tests MUST pass (no test files are expected to be modified — see Out of Scope).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| arch.adr.heading | `## Decision Records` | authored-here — new H2 anchor in architect artifact schema |
| arch.adr.empty | `_No non-trivial trade-offs in this artifact._` | authored-here — placeholder when an architecture spec has zero ADRs, so the section is never silently absent |
| audit.artifact.filename | `token-frugality-audit-v3.12.md` | authored-here — audit deliverable filename |

## Visual Tokens

_Not applicable — this feature edits only Markdown prompt content; no UI, no visual literals._

## Out of Scope

- New skill files (e.g. skill-refactor-planner from the v3.9 eval): explicitly deferred to a future release.
- Server-code changes in `tools/`, `guards/`, `prompts/build.ts`, `index.ts`: this is a content-only release.
- Test-file changes: no behavioural change in TS code, so existing tests cover the regression surface.
- CHANGELOG.md / README.md / package.json version bump: owned by release-engineer post-QA, not part of this spec.
- Constitution security additions beyond what the audit identifies: if the audit concludes §6 is complete, no edits to §6 are required.

## Dependencies / Prerequisites

- `research/process-retrospective.md` — primary input. Local file, already in workspace, classified as **fetched**.
- No external URLs (Figma, ticket links, design files) in the source material; the eval report uses only `file://` local references.

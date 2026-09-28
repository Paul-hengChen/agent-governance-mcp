# Spec: auto-routing-v3.13

## Problem Statement

Today, every role transition in a `/teamwork` chain requires the human to manually invoke `tw_switch_role(<next_role>)`. The v3.9 architecture evaluation flagged this as the workflow's hardest throughput ceiling (Open Question #1). In practice this session already showed the agent self-routing through `pm → architect → sr-engineer → code-reviewer → qa-engineer` based on each role's `pending_notes.next_role`, but the behaviour is undocumented and unbounded — a misbehaving role could chain indefinitely. This release formalises auto-routing as an explicit, hop-capped behaviour in the `/teamwork` (full) coordinator only, while leaving `/teamwork-lite` strictly manual. It also adds a PM *Question Batch Gate* that collects all PM-stage human clarifications in a single upfront `AskUserQuestion` batch, reducing mid-chain Blocked interruptions.

## User Stories

- As a developer running `/teamwork`, I want the agent to self-route through `pm → architect → sr-engineer → code-reviewer → qa-engineer` after each role's handoff, so that I don't have to issue `tw_switch_role` myself between hops.
- As a developer worried about runaway agent loops, I want a hard hop ceiling of 10 transitions per `/teamwork` session, so that any pathological chain stops itself within a bounded token budget.
- As a developer using `/teamwork-lite` for solo work, I want auto-routing to remain off in lite mode, so that the lite skill keeps its zero-state-write contract.
- As a PM-role agent, I want a single upfront `AskUserQuestion` batch covering ambiguity + external-reference + scope decisions, so that downstream architect/sr-engineer/qa stages hit fewer mid-chain Blocked interruptions.
- As a developer who wants manual control on a given invocation, I want an `AGC_AUTO_ROUTE=0` environment-variable opt-out, so that I can disable auto-routing without uninstalling or editing skill files.

## Acceptance Criteria

- **Given** the `/teamwork` coordinator skill at `content/skill-coordinator.md`, **when** the file is read after this feature, **then** it MUST contain a new H2 `## Auto-Routing` section that (a) declares auto-routing default-ON, (b) lists the five stop conditions verbatim, (c) names the hop cap as `10`, (d) documents the `AGC_AUTO_ROUTE=0` opt-out, and (e) instructs the coordinator agent to self-count hops in-memory per session (no server change).
- **Given** the auto-routing instructions in `content/skill-coordinator.md`, **when** a `/teamwork` session is in progress, **then** the coordinator MUST stop hopping (and yield to the human) immediately on ANY of: (1) `status=Blocked`, (2) `next_role: human` in pending_notes, (3) no `next_role:` line in pending_notes, (4) hop counter ≥ 10, (5) `status=PASS` from qa-engineer (terminal success). The skill MUST list all five.
- **Given** the lite skill at `content/skill-coordinator-lite.md`, **when** read after this feature, **then** it MUST explicitly state that auto-routing is NOT applied in lite mode (one line), preserving the lite zero-write contract.
- **Given** the PM skill at `content/skill-pm.md`, **when** read after this feature, **then** it MUST contain a new SOP step (numbered consistently with the existing 7-step sequence) named **Question Batch Gate** that instructs PM to enumerate every required human decision (ambiguity, resource-audit fetch/index/ignore classification, scope clarifications) BEFORE writing the spec, and emit a single `AskUserQuestion` call (or 2 batches if > 4 questions) covering all of them at once.
- **Given** the PM Question Batch Gate, **when** a PM-stage agent has zero questions, **then** the gate MUST be a no-op (silently proceed to spec writing) — no empty `AskUserQuestion` call.
- **Given** the auto-routing behaviour and `AGC_AUTO_ROUTE` env var, **when** the env var is set to `0` at session start, **then** the coordinator MUST honour manual routing (the existing pre-v3.13 behaviour). The skill text MUST instruct the agent to check this env var at SOP step 1.
- **Given** the constitution at `content/constitution.md`, **when** read after this feature, **then** §5 *Anti-Loop Circuit Breaker* MUST gain a new bullet referencing the auto-routing hop cap (one line, pointer-style — the cap value lives in skill-coordinator.md).
- **Given** the build, **when** `npm run build` is run after the edits, **then** it MUST succeed with zero TS errors.
- **Given** the existing test suite, **when** `npm test` is run, **then** all tests MUST pass (no server-code change is expected; tests cover the regression surface).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| coordinator.autoroute.heading | `## Auto-Routing` | authored-here — new H2 anchor in coordinator skill |
| coordinator.autoroute.envvar | `AGC_AUTO_ROUTE` | authored-here — opt-out environment variable name (existing convention: `AGC_*` per `bin/agent-governance-context.mjs`) |
| coordinator.autoroute.hopcap | `10` | authored-here — hop ceiling, chosen per user spec to cover the full chain plus two retry rounds |
| pm.questionbatch.heading | `Question Batch Gate` | authored-here — new SOP step name in PM skill |
| lite.autoroute.disclaimer | `Auto-routing is NOT applied in lite mode.` | authored-here — single-line guard sentence in coordinator-lite |
| constitution.section5.bullet | `Auto-routing hop cap: per /teamwork session, max 10 role transitions. See skill-coordinator §Auto-Routing.` | authored-here — new constitution §5 bullet |

## Visual Tokens

_Not applicable — Markdown content edit; no UI surface, no visual literals._

## Out of Scope

- Server-side hop counter persistence (handoff state field): explicitly deferred. The user's design decision is agent-side in-memory counting.
- Auto-routing in `/teamwork-lite`: explicitly excluded by design (lite's server-read-only contract).
- New `tw_*` tool for hop counter or routing intent: not needed; the existing `tw_switch_role` + `tw_update_state` covers the mechanics.
- TS code changes in `tools/`, `guards/`, `index.ts`, `prompts/build.ts`: this is a content-only release. Behavioural change lives entirely in the skill instructions.
- Tests modifying agent-side behaviour: agent-side behaviour is non-deterministic prose instruction-following; no executable test surface exists for "does the agent self-route" without an integration harness. Phase 3 will follow the conditional-test rule (ask user).
- CHANGELOG / README / version bumps: owned by release-engineer post-PASS.
- `AGC_AUTO_ROUTE` env-var server enforcement (e.g. a `tw_*` tool refusing to honor the env): out of scope. The env var is read by the agent at session-start per skill instruction, not validated server-side.

## Dependencies / Prerequisites

- None. This feature edits Markdown content only; no upstream blocking tasks.
- The user has answered all four upfront design questions in the coordinator pre-flight batch (auto-routing default-ON, hop cap 10, include PM Question Batch, in-memory hop counter); no further human input is required before architect handoff.
- No external references — the spec is self-contained.

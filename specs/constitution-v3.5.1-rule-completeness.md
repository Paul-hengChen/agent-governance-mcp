# Spec: Constitution v3.5.1 — Rule Completeness

## Problem Statement

The v3.5.0 fusion (per [claude-md-12-rule-fusion.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/cross-agent-governance.md)) merged 7 of the 12-rule template's high-value rules, but cross-checking against the original 12-rule source revealed 3 material gaps: R3's "don't touch adjacent code" anti-scope-creep clause, R12's "tests pass is wrong if any skipped" sub-clause, and R11's "conformance > taste / surface harmful conventions" decision logic. These are silent omissions that weaken the cognitive guardrails v3.5.0 was meant to install.

## User Stories

- As an AI agent, I want an explicit "don't touch adjacent code" rule so that I don't smuggle drive-by refactors into a surgical change.
- As a qa-engineer, I want "skipped tests ≠ passing" stated in the constitution so that I never report PASS on a partial test run.
- As an AI agent encountering a convention I dislike, I want explicit guidance to conform-but-surface so that I don't silently fork the codebase.

## Acceptance Criteria

### AC1: R3 "Surgical Changes" clause added to §1
- **Given** `content/constitution.md` §1 Output Directives
- **When** inspected
- **Then** a new bullet exists encoding R3: "Surgical changes: Touch only what the task requires. Don't 'improve' adjacent code, comments, or formatting. Clean up only your own mess."

### AC2: R12 tests sub-clause merged into §7 Fail loud
- **Given** `content/constitution.md` §7 "Fail loud" bullet
- **When** inspected
- **Then** the bullet additionally states: `"Tests pass" is wrong if any were skipped.`

### AC3: R11 conformance-over-taste clause extends §2 Match conventions
- **Given** `content/constitution.md` §2 "Match conventions" bullet
- **When** inspected
- **Then** the bullet additionally states: conformance > personal taste; if a convention is genuinely harmful, surface it — don't fork silently.

### AC4: Constitution header bumped to v3.5.1
- **Given** the constitution header line 1
- **When** inspected
- **Then** it reads `# Constitution v3.5.1`.

### AC5: Token budget bounded
- **Given** the combined additions for AC1–AC3
- **When** token-counted
- **Then** net addition to constitution is ≤ 80 tokens.

## Out of Scope

- R1 sub-clauses ("present multiple interpretations" / "stop when confused") — deferred, low marginal value.
- Top-of-file "Bias: caution over speed" meta-statement — deferred.
- R5 (model judgment) and R6 (token budget) — already deferred in v3.5.0 per research open questions.
- `package.json` / `index.ts` / `CHANGELOG.md` / `README.md` version bump — content-only spec; release sync is a separate concern (see prior commit fb2cfa0 pattern).
- Skill file changes — all 3 gaps land in constitution, none require skill edits.

## Dependencies / Prerequisites

- Completed: v3.5.0 fusion ([constitution-v3.5-cognitive-discipline.md](file:///Users/paul.ph.chen/agent-governance-mcp/specs/constitution-v3.5-cognitive-discipline.md)).
- Source reference: original 12-rule CLAUDE.md template (user-provided in conversation).

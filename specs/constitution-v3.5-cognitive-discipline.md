# Spec: Constitution v3.5.0 — Cognitive Discipline

## Problem Statement

Constitution v3.4.0 excels at process compliance (state sync, routing chain, QA enforcement) but lacks "thinking quality" guardrails. The [claude-md-12-rule-fusion.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/claude-md-12-rule-fusion.md) research identified 5 high-value rules (R1, R4, R7, R8, R12) that fill this gap at minimal token cost (~100 tokens).

## User Stories

- As an AI agent, I want explicit "think first" instructions so that I don't jump into coding before understanding the problem.
- As a human operator, I want agents to surface conflicts between contradictory patterns so that I'm not surprised by inconsistent code.
- As a qa-engineer, I want tests to encode *intent* (WHY), not just behavior (WHAT), so that future maintainers understand the purpose.

## Acceptance Criteria

### AC1: §7 Cognitive Discipline exists in constitution
- **Given** the constitution file at `content/constitution.md`
- **When** a reader inspects the document
- **Then** a new `## 7. Cognitive Discipline` section exists between §6 and Document Priority, containing 5 bullet rules: Think first, Goal-driven, Surface conflicts, Read before write, Fail loud.

### AC2: Version bump to v3.5.0
- **Given** the constitution header
- **When** inspected
- **Then** it reads `# Constitution v3.5.0`.

### AC3: R9 (Tests verify intent) added to qa-engineer skill
- **Given** `content/skill-qa-engineer.md`
- **When** inspected
- **Then** the `## Hard rules` section includes a rule: tests must encode WHY (intent), not just WHAT (behavior).

### AC4: R11 (Match conventions) added to §2 Dev & Tech Standards
- **Given** `content/constitution.md` §2
- **When** inspected
- **Then** a new bullet exists: "Match conventions: Follow existing codebase style (naming, structure, patterns) before introducing new patterns."

### AC5: Zero token budget regression
- **Given** the combined additions
- **When** token-counted
- **Then** the net addition to constitution is ≤ 150 tokens and to skill-qa-engineer is ≤ 30 tokens.

## Out of Scope

- Token budget rule (R6) — deferred per research open question #1; needs MCP server support.
- R5 (Use model only for judgment) — implicitly satisfied by tool-driven architecture.
- Skill file changes other than qa-engineer.
- Any server-side code changes.

## Dependencies / Prerequisites

- Research artifact: [claude-md-12-rule-fusion.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/claude-md-12-rule-fusion.md) (completed).
- Current constitution: [constitution.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md) at v3.4.0.

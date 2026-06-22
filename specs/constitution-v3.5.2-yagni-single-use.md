# Spec: Constitution v3.5.2 — YAGNI Single-Use

## Problem Statement

The [post-v3.5.1-coverage-audit](file:///Users/paul.ph.chen/agent-governance-mcp/research/process-retrospective.md) identified one Medium-High value gap remaining from R2 (Simplicity First): "No abstractions for single-use code." The current §1 MVP strict bullet covers *speculative refactors* and *predictive features* but does not explicitly prohibit single-use abstractions (e.g., introducing a `BaseFooHandler` with one subclass, or a `useXyzHelper` hook called from one site). This is a concrete YAGNI failure mode worth naming.

## User Stories

- As an AI agent, I want an explicit "no single-use abstractions" rule so that I don't add interfaces/base classes/helper hooks that have only one caller.

## Acceptance Criteria

### AC1: §1 MVP strict extended with single-use clause
- **Given** `content/constitution.md` §1 MVP strict bullet
- **When** inspected
- **Then** the bullet additionally states `No abstractions for single-use code.` (verbatim, end of bullet).

### AC2: Constitution header bumped to v3.5.2
- **Given** `content/constitution.md` line 1
- **When** inspected
- **Then** it reads `# Constitution v3.5.2`.

### AC3: Token budget bounded
- **Given** the addition for AC1
- **When** token-counted
- **Then** net addition is ≤ 15 tokens.

## Out of Scope

- All other audit gaps (R1 multiple-interpretations, R10 lost-track recovery, etc.) — audit explicitly recommends STOP after this one.
- Release sync (`package.json`, `index.ts`, `CHANGELOG`, `README`, git tag) — handled as a separate release commit after QA PASS, mirroring v3.5.1 process.

## Dependencies / Prerequisites

- Audit artifact: [post-v3.5.1-coverage-audit.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/process-retrospective.md).
- Prior release: v3.5.1 ([CHANGELOG](file:///Users/paul.ph.chen/agent-governance-mcp/CHANGELOG.md)).

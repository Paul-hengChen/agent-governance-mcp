# Spec: Skill Role Enhancements
<!-- Authored by @pm -->
<!-- feature_id: skill-role-enhancements | created_at: 2026-05-15 -->

## Problem Statement

Current `pm`, `sr-engineer`, and `qa-engineer` skill files lack structure and guardrails found in industry-leading agentic frameworks (MetaGPT, CrewAI). Key gaps: no spec schema, no task dependency metadata, no security checklist in sr-engineer, no coverage targets in QA, and no Architect role for system design phase.

## User Stories

- As a **PM agent**, I want an enforced spec schema so generated artifacts are consistent and machine-readable.
- As a **PM agent**, I want an ambiguity gate so I halt and signal rather than proceeding on vague requirements.
- As a **sr-engineer agent**, I want a security checklist so I verify no OWASP basics are violated before QA handoff.
- As a **sr-engineer agent**, I want a task-size circuit breaker so I flag oversized scope instead of silently overrunning a session.
- As a **qa-engineer agent**, I want a coverage target and spec-to-test mapping so tests are driven by acceptance criteria, not just code inspection.
- As a **qa-engineer agent**, I want a round time-box so the 3-round protocol never deadlocks in `Blocked` state.
- As any agent, I want a richer persona backstory so role drift and hallucination are reduced.
- As a **coordinator**, I want an Architect role available for non-trivial features so system design happens before implementation.

## Acceptance Criteria

### PM (skill-pm.md)
- AC1: SOP includes step 2.5 ambiguity gate — if requirements are incomplete/conflicting, call `tw_update_state(status=Blocked)` and STOP.
- AC2: SOP references enforced spec schema (Problem Statement, User Stories, AC, Out of Scope, Dependencies).
- AC3: Task format upgraded to include `[P0/P1/P2]` priority tag and `depends_on:` field.
- AC4: Persona section added with 2-sentence backstory.

### sr-engineer (skill-sr-engineer.md)
- AC5: SOP step 1.5 clarification gate added — ambiguous tasks trigger `tw_update_state(status=Blocked)` before coding.
- AC6: SOP step 3.5 security checklist added (hardcoded secrets, input validation, injection vectors).
- AC7: Task-size protocol added — >5 files or >300 lines triggers split request to PM.
- AC8: Persona section added with 2-sentence backstory.

### qa-engineer (skill-qa-engineer.md)
- AC9: Phase 3 includes coverage gate: ≥80% line coverage on new/modified files.
- AC10: Phase 3 begins with spec-to-test mapping from `specs/<feature>.md` acceptance criteria.
- AC11: Phase 3 includes security smoke test checklist (boundary inputs, auth/permission if applicable).
- AC12: 3-round protocol includes time-box rule: escalate to human if sr-engineer has not replied by next session.
- AC13: Phase 4 includes CI runnability check.
- AC14: Persona section added with 2-sentence backstory.

### New: Architect Role (skill-architect.md)
- AC15: New file `content/skill-architect.md` created.
- AC16: Architect SOP: reads PM spec → produces system design artifact (`specs/<feature>-architecture.md`) containing file list, data structures, interface contracts.
- AC17: Coordinator routing table updated to include Architect.
- AC18: Persona with 2-sentence backstory included.

## Out of Scope

- Changes to `constitution.md` (separate concern).
- Changes to tool implementations in `tools/` or `guards/`.
- `questions/<task-id>.md` clarification path (P3, deferred).
- Performance/security testing additions beyond smoke tests (P3, deferred).
- Observability metadata in artifacts (P3, deferred).

## Dependencies / Prerequisites

- Research artifact: `research/process-retrospective.md` (complete)
- No blocking tasks

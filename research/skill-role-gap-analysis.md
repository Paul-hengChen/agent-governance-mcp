# Skill Role Gap Analysis: pm / sr-engineer / qa-engineer
<!-- Authored by @researcher -->
<!-- Date: 2026-05-15 -->

## Benchmark Sources

- MetaGPT multi-agent framework (5-role software company model)
- CrewAI role-based agent orchestration best practices
- 2026 Agentic Coding Trends Report (Anthropic/Hubspot)
- InfoWorld: Best practices for building agentic systems
- GitHub Blog: Context engineering for reliable AI workflows
- Addy Osmani: LLM coding workflow going into 2026

---

## 1. PM Role (`skill-pm.md`)

### Gaps vs. Industry

| Gap | Industry Benchmark | Current State |
|-----|-------------------|---------------|
| **No PRD schema** | MetaGPT PM produces structured PRDs: User Stories + Requirement Pool + Acceptance Criteria | `specs/<feature>.md` has no enforced schema |
| **No Architect phase** | MetaGPT: PM → Architect → Project Manager → Engineer pipeline | PM writes tasks directly for sr-engineer, skipping system design |
| **No dependency/blocker in tasks** | Industry standard: tasks carry `depends_on: [T01, T02]` metadata | Checkboxes are flat with no dependency graph |
| **No priority/risk signal** | PM roles should flag high-risk / time-critical tasks explicitly | No P0/P1/P2 tagging or risk notes in tasks.md |
| **No ambiguity escalation protocol** | If requirements conflict or are vague, PM should halt and ask | SOP proceeds linearly with no ambiguity gate |
| **No persona depth** | CrewAI: rich backstory + singular goal reduces hallucination | No backstory; identity is one sentence |

### Recommended Additions

1. **Spec Schema**: Enforce sections in `specs/<feature>.md`:
   - Problem Statement
   - User Stories (`As a <user>, I want <goal>, so that <value>`)
   - Acceptance Criteria (BDD-style: Given/When/Then preferred)
   - Out of Scope
   - Dependency / Prerequisite tasks

2. **Task Metadata**: Extend checkbox format:
   ```
   - [ ] T01 [P1] <description> | depends_on: none
   - [ ] T02 [P0] <description> | depends_on: T01
   ```

3. **Ambiguity Gate**: Add step 2.5 — if requirements are incomplete/conflicting, `tw_update_state(status=Blocked, pending_notes="PM blocked: ambiguous requirements — <detail>")` and STOP.

---

## 2. sr-engineer Role (`skill-sr-engineer.md`)

### Gaps vs. Industry

| Gap | Industry Benchmark | Current State |
|-----|-------------------|---------------|
| **No clarification protocol** | Engineers should ask PM/human for clarification on ambiguous tasks before coding | Proceeds directly to implementation |
| **No security review step** | OWASP Top 10 check is expected; industry treats it as non-optional | Constitution mentions security but role SOP doesn't enforce it |
| **No task-size circuit breaker** | If a task cannot fit one session, engineer should flag and split | No protocol for oversized tasks |
| **No inline doc standard** | Self-documenting code is stated but no minimum bar defined | No guidance on when to add comments vs. not |
| **No API-surface documentation** | Public functions/interfaces should be documented at boundary | Absent; causes QA friction |
| **No dependency signaling** | If T02 is blocked by T01, engineer should signal explicitly | No mechanism; leads to silent blocking |
| **Persona is thin** | CrewAI/MetaGPT: domain-specific expertise in backstory reduces drift | "Staff-level engineer" with no domain specialization cues |

### Recommended Additions

1. **Clarification Gate (before step 2)**: If task description has ambiguous requirements, reply with one clarifying question and `tw_update_state(status=Blocked, pending_notes="sr-engineer: awaiting clarification — <question>")`.

2. **Security Checklist** (step 3.5): Before handoff to QA, verify:
   - No hardcoded secrets
   - User input validated at boundaries
   - No obvious injection vectors (SQL, command, XSS)

3. **Task-Size Protocol**: If the task requires touching > 5 files or > 300 lines, flag to PM: "Task T0X scope too large for one session. Recommend split."

---

## 3. qa-engineer Role (`skill-qa-engineer.md`)

### Gaps vs. Industry

| Gap | Industry Benchmark | Current State |
|-----|-------------------|---------------|
| **No coverage target** | Industry standard: 80%+ line/branch coverage for new code | No coverage threshold stated |
| **No regression strategy** | "Agentic QA 2026": self-healing, regression suite required | Review-first but no regression regression protocol |
| **No performance testing** | Modern QA includes basic perf assertions (response time, memory) | Absent |
| **No security testing** | OWASP: QA should check for input validation, auth bypass basics | Absent |
| **No CI/CD integration hint** | Tests should be designed to run in CI; QA should flag if they can't | No mention of test runnability in CI |
| **No test data strategy** | Mock only external deps (matches constitution) but no guidance on fixtures | No fixture or test data management guidance |
| **Review bottleneck risk** | Industry: PR review times inflate 91% with AI code; QA must be time-boxed | 3-round protocol has no time/turn limit per round |
| **No autonomous test generation** | Agentic QA 2026: AI generates tests from specs, not just code review | QA reads code; could also read PM spec for coverage mapping |

### Recommended Additions

1. **Coverage Gate**: Add to Phase 3 — "Tests must achieve ≥80% line coverage on new/modified files. If tooling cannot measure, note explicitly."

2. **Spec-Driven Test Mapping**: At start of Phase 3, cross-reference `specs/<feature>.md` acceptance criteria → each criterion must map to at least one test.

3. **Security Smoke Tests**: Add to Phase 3 checklist:
   - Input boundary tests (null, empty, oversized, special chars)
   - Auth/permission tests if applicable

4. **Round Time-box**: Add to 3-round protocol — if sr-engineer does not reply within the same session, escalate to human after Round 1. (Prevents permanent `Blocked` state.)

5. **CI Runnability Check**: After Phase 3 — "Confirm tests run headlessly via `npm test` / `pytest` / `cargo test` with zero human interaction required."

---

## 4. Cross-Cutting Gaps (All Roles)

| Gap | Recommendation |
|-----|---------------|
| **No Architect role** | Add a `skill-architect.md` between PM and sr-engineer for non-trivial features. Produces: file list, data structures, interface contracts. Maps to MetaGPT's Architect agent. |
| **Thin persona depth** | Add 2-sentence backstory per role (seniority, domain, working style). CrewAI evidence: reduces hallucination and role drift. |
| **No observability metadata** | Each artifact (spec, qa_report, task) should carry: `created_by`, `created_at`, `feature_id`. Supports audit trails. |
| **No escalation SLA** | If any role is `Blocked` for > 1 session without human response, auto-escalate with `pending_notes` bump. |
| **PM-to-Engineer clarification path** | sr-engineer has no formal channel to ask PM questions. Add `questions/<task-id>.md` as lightweight Q&A artifact. |

---

## Priority Ranking (Impact vs. Effort)

| Priority | Change | Role | Effort |
|----------|--------|------|--------|
| P0 | Add dependency metadata to tasks | PM | Low |
| P0 | Add spec schema (User Stories + AC) | PM | Low |
| P0 | Add security checklist to SOP | sr-engineer | Low |
| P1 | Add coverage target (80%) + spec-to-test mapping | qa-engineer | Low |
| P1 | Add ambiguity gate to PM | PM | Low |
| P1 | Add task-size circuit breaker | sr-engineer | Low |
| P2 | Add Architect role skill file | New | Medium |
| P2 | Add backstory to all role personas | All | Low |
| P3 | Add performance/security smoke tests | qa-engineer | Medium |
| P3 | Add questions/<task-id>.md clarification path | All | Medium |

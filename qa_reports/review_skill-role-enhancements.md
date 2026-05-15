# QA Review: skill-role-enhancements
<!-- Authored by @qa-engineer -->
<!-- feature_id: skill-role-enhancements | reviewed_at: 2026-05-15 -->

## Spec-to-AC Verification

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| AC1 | PM ambiguity gate | ✅ PASS | Step 3 in SOP — functional |
| AC2 | PM spec schema enforced | ✅ PASS | All 5 sections present |
| AC3 | PM task format with priority + depends_on | ✅ PASS | Format documented with examples |
| AC4 | PM persona (2-sentence backstory) | ✅ PASS | Maya, Staff-level TPM |
| AC5 | sr-engineer clarification gate | ✅ PASS | Step 2, blocks on ambiguity |
| AC6 | sr-engineer security checklist | ✅ PASS | Step 6, 3 OWASP checks |
| AC7 | sr-engineer task-size circuit breaker | ✅ PASS | Step 3, >5 files or >300 lines |
| AC8 | sr-engineer persona (2-sentence backstory) | ✅ PASS | Alex, Staff-level SWE |
| AC9 | QA coverage gate ≥80% | ✅ PASS | Phase 3b |
| AC10 | QA spec-to-test mapping | ✅ PASS | Phase 3a, AC→test mapping required |
| AC11 | QA security smoke tests | ✅ PASS | Phase 3c, boundary + auth |
| AC12 | QA round time-box | ✅ PASS | Core Rules, escalate to human |
| AC13 | QA CI runnability check | ✅ PASS | Phase 4, headless run verified |
| AC14 | QA persona (2-sentence backstory) | ✅ PASS | Jordan, Senior QA |
| AC15 | skill-architect.md created | ✅ PASS | File exists at content/skill-architect.md |
| AC16 | Architect produces architecture artifact | ✅ PASS | Schema: file list, data structs, contracts |
| AC17 | Coordinator routing table includes architect | ⚠️ PARTIAL | Content correct; tool broken (see B1) |
| AC18 | Architect persona (2-sentence backstory) | ✅ PASS | Sam, Staff-level Architect |

---

## Round 1 — Blocker

### B1 🔴 BLOCKER: `tw_switch_role("architect")` fails at runtime

**Evidence:**

`index.ts:67`:
```typescript
role: z.enum(["pm", "researcher", "sr-engineer", "qa-engineer"]),
```
`tools/role.ts:20-24`:
```typescript
const ROLE_SKILL_MAP = {
  "pm": "skill-pm.md",
  "researcher": "skill-researcher.md",
  "sr-engineer": "skill-sr-engineer.md",
  "qa-engineer": "skill-qa-engineer.md",
} as const satisfies Record<string, string>;
```

**Impact:** Calling `tw_switch_role` with `role="architect"` throws a Zod validation error before any code runs. The coordinator routing table now directs users to `architect` but the tool rejects the call — broken UX.

**Required fix (2 changes):**

1. `tools/role.ts` — add to `ROLE_SKILL_MAP`:
   ```typescript
   "architect": "skill-architect.md",
   ```

2. `index.ts:67` — add `"architect"` to enum:
   ```typescript
   role: z.enum(["pm", "researcher", "sr-engineer", "qa-engineer", "architect"]),
   ```

**Questions for sr-engineer:**
- Should a corresponding `prompts/architect.ts` file be added for the SessionStart hook (parity with other roles)? Or is the `tw_switch_role` wiring sufficient for now?

---

> Waiting for sr-engineer Round 1 reply before proceeding to Phase 3 — Test.

# Skill: coordinator-lite

Solo-dev direct-execute mode. No chain, no role switching, no state writes.

## Persona
Doer. Read request, do it, reply. No triage, no delegation.

## When to use
- **Lite**: solo daily work — 1-file edits, doc tweaks, Q&A, one-liner fixes, status checks.
- **Full (`/teamwork`)**: cross-module work, anything needing `tasks.md`/`handoff.md` tracking or independent QA.

## Hard rules
- **Server-read-only.** Lite has no `agent_id` in the routing chain (`tools/transitions.ts`); `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task` / `tw_switch_role` will be rejected. Do NOT call them.
- `tw_get_state` allowed (read-only) if you need context. `tw_detect_drift` only on user request.
- **No code-reviewer step.** Lite excludes the code-reviewer gate. The reviewer gate is a multi-context separation tool; lite is solo-dev same-context work where it is structurally meaningless.

## SOP
1. Q&A / doc / status query → answer directly. No tools.
2. Small edit → do it, build/lint if code (ZERO errors), short reply. No `tw_*` writes.
3. Scope creep (≥ 3 files / new public API / needs tests / design decision) → STOP, recommend `/teamwork`. Don't simulate the chain.

## Scope-creep examples

Cases that LOOK lite but require `/teamwork` escalation:

- **"Add a single config option"** — touches both `tools/config.ts` and `tools/handoff.ts` schema → 2 files + schema change → **full**.
- **"Refactor a 30-line helper"** — innocent until grep reveals 8 callers across 4 modules → cross-module → **full**.
- **"Add a CLI flag"** — needs test coverage by definition (constitution §2) → **full**.

Affirmative lite case:

- **"Fix a typo in README.md"** → single file, no logic, no tests → **lite**.


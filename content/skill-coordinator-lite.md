---
recommended_model: haiku
---
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
- **No code-reviewer step.** Lite excludes the code-reviewer gate — solo-dev same-context work; the reviewer gate is a multi-context tool.
- **No auto-routing.** Lite is single-shot; the auto-hop loop lives in `/teamwork` only.
- **Cut-approval halt (pm-cut-approval-gate, SOP-ceiling).** Lite is server-read-only, so the server's `CUT_APPROVAL_REQUIRED` transition gate cannot fire here — this SOP rule is the enforcement ceiling for the lite path. If a lite task ever crosses into PM-style ticket-splitting and then build work, you MUST present the ticket cut inline in chat (`id | desc | depends_on | est. files | design-link`) and HALT for human approval before executing/nominating build — do NOT use `AskUserQuestion`, present inline and wait. In practice this is also a `/teamwork` escalation signal (multi-ticket cut → not a one-shot lite edit → **full** per step 3), so prefer escalating.

## SOP
1. Q&A / doc / status query → answer directly. No tools.
2. Small edit → do it, build/lint if code (ZERO errors), short reply. No `tw_*` writes.
3. Scope creep (≥ 3 files / new public API / needs tests / design decision) → STOP, recommend `/teamwork`. Don't simulate the chain.

## Scope-creep examples

Cases that LOOK lite but require `/teamwork` escalation:

- **"Add a single config option"** — touches both `tools/config.ts` and `tools/handoff.ts` schema → 2 files + schema change → **full**.
- **"Refactor a 30-line helper"** — innocent until grep reveals 8 callers across 4 modules → cross-module → **full**.
- **"Add a CLI flag"** — needs test coverage by definition (constitution §2) → **full**.
- **"Fix the visual / make it match Figma"** (cross-file visual-fidelity iteration) — compares rendered output to Figma across multiple UI files, then applies fixes and re-checks; each iteration is a new cross-context visual comparison, and iterative eyeball loops on visual work hit Constitution §5 anti-loop → this is `/teamwork` + `qa-visual` work by design → **full**. Lite is appropriate ONLY for a one-shot environment-exclusion diagnosis (e.g. confirming a stale build is the cause): run one diagnostic pass, report the finding, then escalate. Long-running lite visual iteration → **full**.

Affirmative lite case:

- **"Fix a typo in README.md"** → single file, no logic, no tests → **lite**.

## Subagent Reply Watermark Validation

After `Task(subagent_type=…)`, call `validateWatermark` from `dist/lib/watermark-check.js`; relay `corrected`. Regex:

```
/^—\s@[\w-]+\s\([\w-]+\)$/i
```

Out-of-scope: ONLY after `Task(…)`; skip after `tw_*`/bash/file. Full rules: `skill-coordinator.md` §Subagent Reply Watermark Validation.

Coordinator-lite is non-subagent: own replies end `— @lite` (no tier) per §1; only relayed subagents keep `— @<role> (<tier>)`.


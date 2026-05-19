# Research: Is MCP packaging necessary for agent-governance-mcp?

<!-- @researcher -->

## Verdict First

**Single-IDE (Claude Code only)**: MCP is over-engineered. Bash scripts + SessionStart hook cover 90%.  
**Multi-IDE / multi-agent**: MCP is the only viable standard. No equivalent protocol exists.

---

## What MCP actually buys you here

| Capability | MCP provides | Alternative |
|---|---|---|
| Cross-IDE tool calls | ✅ JSON-RPC 2.0, universal | Per-IDE bash integration (fragile) |
| Prompt injection (roles) | ✅ `prompts/list` endpoint | CLAUDE.md only (Claude Code specific) |
| Schema validation | ✅ Zod, server-side | None (agent sees raw file) |
| File locking | ✅ O_EXCL + stale-PID | Implementable in any CLI |
| Atomic writes | ✅ tmp + rename | Implementable in any CLI |
| Freshness / drift detection | ✅ in-process snapshot | Implementable, but no standard hook point |

---

## What you already get WITHOUT MCP

- **Constitution injection**: `bin/agent-governance-context.mjs` SessionStart hook does this today.
- **State read**: agent reads `.current/handoff.md` directly via file tools.
- **State write**: agent edits `.current/handoff.md` directly — no locking, no validation.

The hook already covers the **read path** entirely. MCP is load-bearing only on the **write path** (concurrent safety + schema enforcement).

---

## When MCP is overkill

- You only run Claude Code (no Cursor / Continue / Gemini Code).
- You never have two IDE windows open simultaneously.
- You are willing to accept the risk of handoff.md corruption on concurrent writes.
- You don't need the `prompts/` endpoint (role injection via SessionStart hook is enough).

In this scenario, replacing MCP with:
```
tw get-state        # reads .current/handoff.md, prints JSON
tw update-state     # writes with O_EXCL lock
tw complete-task    # edits tasks.md checkbox
```
...as a plain Node CLI would be functionally equivalent and remove the MCP overhead entirely.

---

## When MCP is NOT overkill

- Two IDE sessions open (e.g., main work + background agent): **file lock is critical**.
- You want Cursor or Gemini Code to call the same tools: **MCP is the only universal protocol**.
- You need schema-validated tool args (prevents agent from sending malformed state): MCP enforces this before the handler runs.
- You want `prompts/list` to expose role contexts to any MCP-compatible client: no bash equivalent.

---

## Honest risk if you strip MCP

The one failure mode that bash scripts cannot prevent without discipline: **two agents writing handoff.md at the same time**. Without the file lock, the second write silently clobbers the first. This is a real bug in multi-window workflows.

Everything else (constitution, roles, drift detection) can be reimplemented outside MCP. The lock is the hard part.

---

## Recommendation

**Keep MCP if**: you ever open two IDE windows simultaneously OR plan to use non-Claude clients.  
**Replace with CLI if**: Claude Code single-window is your only use case AND you're willing to enforce "one session at a time" as a social contract.

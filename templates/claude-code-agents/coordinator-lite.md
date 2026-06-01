---
name: coordinator-lite
model: haiku
description: Solo-dev direct-execute single-shot mode — no chain, no state writes, no role switching.
---

This subagent runs the agc coordinator-lite SOP under a pinned model tier (Haiku for cheap single-shot work). On invocation, call `tw_get_state` (read-only allowed) and follow the coordinator-lite SOP from `content/skill-coordinator-lite.md`. Do NOT call any tw_* write tools (server rejects lite-mode writes).

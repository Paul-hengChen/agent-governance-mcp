---
name: teamwork
model: sonnet
description: Sonnet-pinned coordinator subagent — runs the agc /teamwork chain orchestrator in a fresh context.
---

This subagent runs the agc coordinator (full) SOP from `content/skill-coordinator.md` under a pinned Sonnet tier. On invocation, call `tw_get_state` then `tw_detect_drift`, then follow the coordinator SOP exclusively (load it via the Read tool, NOT via tw_switch_role — coordinator is not in the RoleName enum).

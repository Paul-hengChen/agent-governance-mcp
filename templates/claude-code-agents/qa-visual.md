---
name: qa-visual
model: sonnet
description: Visual-baseline comparator — lazy-loaded sub-skill of qa-engineer (Phase 1.5).
---

This subagent runs the agc qa-visual SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("qa-engineer")` and follow the returned SOP, lazy-loading qa-visual when Visual Baselines are present.

---
name: architect
model: opus
description: Translates PM specs into precise architecture blueprints (specs/<feature>-architecture.md).
---

This subagent runs the agc architect SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("architect")` and follow the returned SOP exclusively.

---
name: doc-writer
model: haiku
description: Updates README / CHANGELOG / in-tree docs after PASS per the agc doc-writer SOP.
---

This subagent runs the agc doc-writer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("doc-writer")` and follow the returned SOP exclusively.

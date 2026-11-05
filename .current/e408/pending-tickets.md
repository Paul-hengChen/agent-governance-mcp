# Pending tickets — lane e408

```pending-ticket
lane_local_id: E408-NEW-1
title: Lite SOP says tw_add_task and tw_rollback_task are server-rejected, but the server accepts them
priority: P3
depends_on: [E408]
source: pm, E408 cut (lite.md write-tool wording decision, 2026-11-05)
body: |
  content/skill-coordinator-lite.md line 16 (Hard rules, Server-read-only, last rewritten by E391
  G2-11) lists `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task` as
  "server-rejected". Only two of them are: tw_update_state rejects a write without agent_id
  (AGENT_ID_REQUIRED) and tw_complete_task runs requireQaEngineer. tools/tasks.ts handleAddTask and
  handleRollbackTask run only enforcePreFlight, which a lite session passes once it has called
  tw_get_state (which lite is told to do), so both writes succeed. Fix options: (a) wording only,
  "server-rejected" for the two gated tools and "SOP-forbidden" for the other two (and for
  tw_switch_role), with test/e391-prompt-audit-stale-facts.test.mjs AC-G2-11 re-pinned; or (b) add
  an agent gate to the two handlers (behaviour change, needs its own design). The E408 lane changed
  only the lite subagent template's parenthetical to cite the SOP prohibition instead of a server
  claim.
```

## Applied

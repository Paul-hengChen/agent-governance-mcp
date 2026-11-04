# Pending tickets — lane e403

## Applied

```pending-ticket
lane_local_id: E403-NEW-1
title: Core coordinator fragments still name the Claude Code-only `Task` alias outside coord-03 line 1
priority: P3
depends_on: [E403]
source: pm, E403 cut (integrator pre-review to-lane#1, 2026-11-04)
body: |
  E392 defines `Task(...)` once, in content/coord-02-host-dispatch.md line 1, as shorthand for
  Claude Code's subagent tool; coord-02 is tagged host:claude-code, so the lean / no-host
  coordinator composition drops that definition. E403 made coord-03 line 1 host-neutral, but six
  more `Task` mentions remain in core fragments composed into every profile:
  content/coord-03-core-fallback.md lines 31, 77, 88 and 95, content/coord-05-core-visual-drift.md
  line 5 ("Task or `tw_switch_role`"), and content/coord-07-core-sop.md line 14. On a non-Claude-Code host they
  name an undefined tool. Fix options mirror E403: host-neutral wording per site, or move the alias
  definition into a core fragment. Re-capture the compose goldens and re-measure the lean and
  teamwork budgets (the lean ceiling has little headroom).
```

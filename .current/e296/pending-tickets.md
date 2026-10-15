# Pending tickets — lane e296

New blocks go ABOVE `## Applied`.

```pending-ticket
lane_local_id: E296-NEW-1
title: tw_update_state rejects a relative prd_path, but lane handoffs are tracked and lane-protocol §1-1 forbids absolute worktree paths in tracked files
priority: P3
depends_on: none
source: pm, lane e296 opener (wave 3)
body: |
  The tool boundary now returns `prd_path must be absolute`. In a fan-out lane the
  handoff (`.current/<lane>/handoff.md`) is committed on the lane branch, and
  lane-protocol §1-1 says never write the absolute worktree path into a tracked
  file. 20 archived lane handoffs under `.current/history/` carry the relative
  form `prd_path: "docs/backlog.md"`, so the rule post-dates them. Options: accept
  a workspace-relative prd_path (resolve against workspace_path on read), or
  document in skill-pm / lane-protocol that lanes omit prd_path. Until ruled,
  lane PMs omit the field and name the PRD in pending_notes.
```

## Applied

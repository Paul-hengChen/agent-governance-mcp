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

```pending-ticket
lane_local_id: E296-NEW-2
title: check --cut treats some touches spans as prose and drops them silently — extension-less root files (Dockerfile, LICENSE), bare . / .., unicode lookalikes without an ASCII extension
priority: P3
depends_on: [E296]
source: code-reviewer, e296 review round 2 (R1)
body: |
  Under the AC3(a) path-token rule a backtick span with no `/` and no ASCII
  extension is prose, so `fanout check --cut` drops it. A touches cell such as
  `tools/fanout-manifest.ts`、`Dockerfile` therefore exits 0 although the
  second file is never checked; the same holds for `LICENSE`, a bare `.` or
  `..`, and lookalikes such as `tools∕registry` (U+2215) or a full-width
  slash and dot. `check --cut` is pure (no repo listing), so it cannot tell
  a real extension-less file from prose. Spec-level option: in a touches cell,
  every backtick span that is not exactly `—` must be a path token, else exit 2
  (CUT_TOUCHES_MALFORMED_PATH); prose moves to the desc cell.
```

## Applied

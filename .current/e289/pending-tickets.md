# Pending tickets — lane e289

```pending-ticket
lane_local_id: E289-NEW-1
title: docs/config.md laneProtocolAddendum section — say "first path segment is .." and recommend running render from primary
priority: P3
depends_on: [E289]
source: code-reviewer, e289 review round 1 (two optional findings)
body: |
  Two wording gaps in the new laneProtocolAddendum section of docs/config.md.
  (1) It says a value is refused when it normalizes to a path that "starts with ..";
  the code and spec mean a path whose first segment is "..", so a file name like
  "..foo" is accepted. (2) When render runs from a lane worktree's own build output,
  the agc install root is that worktree, so the generic-rules pointer becomes an
  absolute path into the worktree (as the spec designs); one sentence should tell
  integrators to run render from primary. Doc-only; no behaviour change.
```

```pending-ticket
lane_local_id: E289-NEW-2
title: fanout render — fail loudly if the prompt template no longer contains the lane-rules pointer it replaces
priority: P3
depends_on: [E289]
source: code-reviewer, e289 review round 1 (optional finding)
body: |
  render swaps the template's lane-rules pointer for the two-layer pointer with a
  plain string replace. If the template wording ever drifts from the pointer
  constant, the replace silently does nothing and the addendum disappears from the
  prompt with no error (only the key-set render test would notice). A module-load
  guard or a direct test assertion that the template contains the pointer would make
  the coupling explicit.
```

## Applied

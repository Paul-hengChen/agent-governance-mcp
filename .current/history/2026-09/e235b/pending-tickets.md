## Applied

```pending-ticket
lane_local_id: E235B-NEW-1
title: Fan-out manifest `mailbox:` header still takes an absolute path — allow a primary-relative form, as E235 did for the worktree column
priority: P3
depends_on: [E235]
source: architect, e235b blueprint (specs/e235b-relative-manifest-worktree-architecture.md, Decision Records); integrator pre-review 2 asked it be filed separately
body: |
  E235 (lane e235b) makes the manifest worktree cell primary-relative and resolves it at
  render time. The optional `mailbox:` header line is parsed the same way the worktree
  cell used to be — taken verbatim — so a manifest that sets it would leak a local
  absolute path the same way. No current manifest sets it (the integrator passes
  `--mailbox-root` to render instead; with neither, render fails MAILBOX_ROOT_ABSENT),
  so this is latent, not live.
  Fix shape: accept a primary-relative value and resolve it against the same primary
  path render already computes; keep absolute values working.
```

```pending-ticket
lane_local_id: E235B-NEW-2
title: Manifest worktree cell in Windows form (drive letter or backslash) is treated as relative on POSIX and resolves silently to a nonsense path
priority: P3
depends_on: [E235]
source: code-reviewer, e235b review round 1 (review_reports/review_T-E235B-02.md, optional finding)
body: |
  `resolveWorktree` treats only POSIX-absolute cells as absolute, so a drive-letter cell
  or a backslash-separated relative cell is joined onto the primary path and rendered
  into a dispatch prompt with no error. No AC covered this. Fix shape: reject
  drive-letter and backslash cells at render time with a row error, like the empty-cell
  and tilde-cell cases.
```

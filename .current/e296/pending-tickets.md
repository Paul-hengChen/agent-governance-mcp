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
title: extension-less root files (Dockerfile, LICENSE) cannot be named in a fan-out 擁有 cell or a ## Cut touches cell
priority: P3
depends_on: [E296]
source: code-reviewer, e296 review round 2 (R1); narrowed by pm at the round-3 re-cut
body: |
  The fail-open part of R1 is absorbed by T-E296-06 (spec AC15 cell grammar):
  a touches backtick span that is not a path token (`Dockerfile`, `LICENSE`,
  `.`, `..`, a unicode lookalike) is now exit 2 CUT_TOUCHES_MALFORMED_PATH
  instead of being dropped as prose. No unicode lookalike inside a span can
  pass CUT_PLAIN_PATH_RE or PATH_TOKEN_RE (both ASCII-only), so nothing fails
  open. What remains is a capability gap, fail closed: a path with no `/` and
  no extension is never a path token, so a lane that really owns `Dockerfile`
  cannot list it in 擁有 (read as prose there) or in touches (exit 2, the cut
  falls back to the human). Option: a small explicit allow-list of known
  extension-less root file names, applied to both cells through the shared
  helper (a manifest-format change, so not in lane e296's scope).
```

```pending-ticket
lane_local_id: E296-NEW-3
title: check --cut on a case-insensitive filesystem — a touches token that differs only in case from an unowned tracked file can match an owned * glob
priority: P3
depends_on: [E296]
source: code-reviewer, e296 review round 3 (R2)
body: |
  check --cut is pure (no repo listing) and compares tokens case-sensitively,
  so with 擁有 `tools/A*.ts` a touches token `tools/Afoo.ts` is in bounds even
  when the tracked file is `tools/afoo.ts`, which on macOS (APFS, case-
  insensitive by default) is the same file and is not owned. The post-commit
  `check <manifest> <lane>` diffs real paths and would show it as OUT, so the
  gap is limited to the pre-commit auto-approval window. Options: refuse a
  touches token that matches an 擁有 glob only via a case variant of a
  tracked path (needs a repo listing, breaking purity), or document that the
  post-commit check is the backstop on case-insensitive filesystems.
```

## Applied

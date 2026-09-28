# Pending tickets — lane e125c

## Applied

```pending-ticket
lane_local_id: E125c-NEW-1
title: finish --shipped pointer says `git log --grep <ticket>` without -i; lowercase lane names miss `E125b`-style commit subjects (X8)
priority: P3
depends_on: [E125c]
source: pm, e125c cut (bin/agc-init.mjs:1731 closedLanePointerLine)
body: |
  The composed lane_closed pointer text hard-codes `git log --grep ${ticketId}`; with ticketId lowercase
  (ticket=e125b) and commits saying E125b, the stated fallback misses. Change to `git log -i --grep`.
  bin/ is forbidden to e125c. Existing committed pointers would stay as written (append-only).
```

```pending-ticket
lane_local_id: E125c-NEW-2
title: release step 8a stages root tasks.md but not .current/_primary/tasks.md, the post-E125a _primary ledger
priority: P2
depends_on: [E125c]
source: pm, e125c cut (content/skill-release-engineer.md:42, :204, :209)
body: |
  After E125a, tw_complete_task on primary writes .current/_primary/tasks.md; step 8a's git add list and
  the artifact allowlist line still name only root tasks.md, and .current/** is excluded from staging
  except .config.json. Touches the 8a bash fence, test/release-staging pins and possibly
  scripts/verify-release.mjs METADATA list — out of e125c scope.
```

```pending-ticket
lane_local_id: E125c-NEW-3
title: constitution const-05 still carries the "PM's initial bootstrapping write" exemption for hand-creating the task list
priority: P3
depends_on: [E125c]
source: pm, e125c cut (content/const-05-core-standards.md:17)
body: |
  Post-E125a the first tw_add_task creates .current/<lane>/tasks.md, and lane-protocol §3 says never create
  the ledger by hand. The exemption is now dead/misleading. Deferred because a constitution edit moves
  every golden and most context-budget floors (human ruling R2 at e125c cut).
```

```pending-ticket
lane_local_id: E125c-NEW-4
title: docs/lane-protocol.md should mirror the ticket-id-in-commit-subject convention that release SOP 7a now states
priority: P3
depends_on: [E125c]
source: pm, e125c cut
body: |
  Lanes commit (lane-protocol §3); the convention that makes `git log -i --grep <ticket>` a universal
  fallback belongs where lane sessions read it. docs/** is integrator-owned.
```

```pending-ticket
lane_local_id: E125c-NEW-5
title: _primary reverse absorbs a hand-fabricated tasks_moved marker line in the root index instead of refusing
priority: P3
depends_on: [E125c]
source: code-reviewer, T-E125C-04 finding F2 (accepted as known residue by the integrator, to-lane#2)
body: |
  primaryIndexReceiptSha normalization strips every tasks_moved marker line before hashing, so a
  marker-shaped line hand-added to the root index passes the AC4 receipt check and is dropped by
  migratePrimaryReverse. Only a single marker-shaped line is absorbed; no task row or prose is lost,
  and any other edit still refuses. For migrateFeatReverse a fabricated marker makes the run/of
  count mismatch and refuses loudly, so it never fails silently there. Possible fix: have the
  receipt also record the marker set present at forward time.
```

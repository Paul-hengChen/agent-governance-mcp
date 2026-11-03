# Pending tickets — lane e394

## Applied

```pending-ticket
lane_local_id: E394-NEW-1
title: release.mjs — a BOM-prefixed handoff copy given as --state stops USAGE with a misleading detail
priority: P3
depends_on: [E394]
source: code-reviewer round 2 on T-E394-02 (recommended, non-blocking)
body: |
  Frontmatter detection strips a leading byte-order mark, but the temp-workspace copy is
  written from the raw text, so the canonical parser sees no frontmatter and the
  precondition reports "(got undefined, )". Safe direction (it stops), but the message
  should say the copy carries a BOM, or the copy should be written without it.
```

```pending-ticket
lane_local_id: E394-NEW-2
title: release.mjs — read-only git channel accepts any arguments; restrict writing flags such as --output
priority: P3
depends_on: [E394]
source: code-reviewer round 1 (optional O-item)
body: |
  The allow-list admits read-only git verbs with arbitrary arguments, so a writing flag
  (e.g. diff --output) would pass the read-only lane. The script never passes one today;
  an argument check would make the guard match its name.
```

```pending-ticket
lane_local_id: E394-NEW-3
title: release SOP — publish --dry-run really runs the strict CI gate and can wait on CI; say so, or skip the wait in dry-run
priority: P3
depends_on: [E394]
source: code-reviewer round 1 (optional O-item)
body: |
  The dry run of the publish phase still calls the strict CI check, which may block for the
  CI wait budget. Either document it in the SOP step that prescribes the dry run, or make the
  dry run report the CI state without waiting.
```

```pending-ticket
lane_local_id: E394-NEW-4
title: tools/handoff-parse — export a content-level handoff parser so release.mjs need not stage a temp workspace
priority: P3
depends_on: [E394]
source: lane coordinator, --state ruling (option b')
body: |
  The release script parses a pre-opening-write copy of the lane handoff by placing it in a
  temporary workspace and calling the workspace-level parser. A parse-from-text export would
  remove the temp directory and the migration write-back inside it.
```

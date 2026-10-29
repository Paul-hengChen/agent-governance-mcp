<!-- pending-tickets for lane e158 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E158-NEW-1
title: comment-scan silently narrows its subject to uncommitted work when no base ref resolves
priority: P3
depends_on: [E158]
source: pm, e158 lane cut (specs/e158-range-subject-audit.md, audit table row comment-scan)
body: |
  tools/comment-scan.ts resolveBase() tries @{upstream}, origin/main, origin/master, main and
  master, and when none resolves (or merge-base fails) it returns "HEAD". collectAdded() then diffs
  the working tree against HEAD plus untracked files, so every change already committed on the
  branch drops out of the scan without any message. The scan is advisory, so nothing passes a
  gate because of it, but its "no findings" reads the same whether it looked at the whole branch
  or only the uncommitted part. This is the E158 class (a check whose subject quietly becomes
  smaller than the caller thinks). Suggested fix: when the fallback to HEAD is taken, say so in
  the scan output (one line naming the narrowed subject), or skip the scan with a message.
  Out of the e158 lane's scope: tools/comment-scan.ts is not owned by that lane.
```

## Applied

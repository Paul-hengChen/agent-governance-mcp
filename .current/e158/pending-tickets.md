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

```pending-ticket
lane_local_id: E158-NEW-2
title: check-bookkeeping silently ignores an empty or valueless --base and falls back to origin/main
priority: P3
depends_on: [E158]
source: code-reviewer, e158 lane round 1 (review_reports/review_T-E158-01.md)
body: |
  scripts/check-bookkeeping.mjs parseArgs drops `--base=` (empty value) and a trailing `--base`
  with no value, so the run proceeds as if no base was named and falls back to origin/main, then
  main, without a message. This is the same class as the explicit-but-unresolvable --base that
  E158 made fail loud: the caller asked for a base and got a different one. Suggested fix: treat
  an empty or missing --base value as a usage error and exit 2 with one stderr line.
```

## Applied

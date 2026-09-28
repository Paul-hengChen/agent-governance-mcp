# Pending tickets — lane e178b

## Applied

```pending-ticket
lane_local_id: E178B-NEW-1
title: lane-status --watch re-arm exits 64 when a lane closes between two watches (default watch set)
priority: P3
depends_on: [E178b]
source: sr-engineer, T-E178B-01 build (2026-09-27)
body: |
  Spec AC5 makes a --baseline key that names no watched lane a usage error
  (exit 64). In the default watch set (every worktree), a lane whose worktree
  is removed in the gap between one watch's expiry and the re-arm makes the
  printed re-arm command fail with 64 instead of printing `[<lane>] gone`.
  The integrator must then drop that key by hand. Implemented as specified;
  a follow-up could treat an unknown key in the default set as "gone since
  last watch" (the --lanes set already keeps absent lanes watched, so there
  it only guards typos).
```

```pending-ticket
lane_local_id: E178B-NEW-2
title: e177b mailbox-watch AC17 and test-lock AC10 time out under full-suite load (3 s waitFor)
priority: P3
depends_on: none
source: sr-engineer, full npm test during T-E178B-03 (2026-09-27)
body: |
  One full `npm test` run in lane e178b failed 2/2754:
  test/e177b-mailbox-watch.test.mjs "AC17: a second, independent
  mailbox-watch process on the SAME file refuses to start" (waitFor: timed
  out at 3 s) and test/e177b-test-lock.test.mjs "AC10: a lock left by a DEAD
  pid is reclaimed promptly regardless of its age". Both pass in isolation
  (41/41, twice). This lane did not change either script. Likely a
  subprocess-spawn timeout that is too tight when the whole suite is running
  or another lane runs tests at the same time. Candidate fix: widen the
  waitFor budget in those tests.
```

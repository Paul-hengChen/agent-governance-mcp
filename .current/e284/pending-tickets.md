# Pending tickets — lane e284

```pending-ticket
lane_local_id: E284-NEW-1
title: Handoff absolute-path check flags a leading glob `**/a/b` after a boundary
priority: P3
depends_on: none
source: code-reviewer, e284 review round 1 (E332 probe outside the AC-E332-2 non-hit set)
body: |
  The handoff absolute-path detector treats `**` as a bold opener when it follows a line start or
  a boundary character, then checks for a POSIX path after it. A glob that starts with `**/` and has
  two or more further segments is therefore reported as HANDOFF_ABSOLUTE_PATH when it follows a
  boundary: for example a code span `` `**/node_modules/x` ``, `see **/src/a`, `x=**/a/b`.
  This matches the current rule as written (only `tools/**/a/b` is pinned as a non-hit), but a
  closed manifest whose handoff mentions such a glob fails validate. One option: a backtick
  before `**` never opens bold (a bold opener cannot sit inside a code span), so drop the backtick
  from the boundary set for the `**` case. Whitespace before `**/a/b` stays ambiguous with
  `**/Users/x/y**`, so it would need a decision.
```

```pending-ticket
lane_local_id: E284-NEW-2
title: fanout handoff does not exclude a manifest with a non-ASCII file name from the git status fact
priority: P3
depends_on: [E284]
source: code-reviewer, e284 review round 1 (recommended finding R-1)
body: |
  The handoff generator leaves the manifest itself out of the `git status` fact (and the primary
  lane-status clean/dirty), because pasting the section always changes that file. git prints a
  path with non-ASCII characters quoted and escaped unless core.quotePath is false, so for such a
  manifest name the exclusion does not match and a clean `handoff --check` right after pasting
  reports a difference. Every existing manifest name is ASCII, so nothing fails today. Fix: run
  that git status call with `-c core.quotePath=false`, plus a fixture test with a non-ASCII name.
```

## Applied

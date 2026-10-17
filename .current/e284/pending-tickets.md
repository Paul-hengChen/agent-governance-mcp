# Pending tickets — lane e284

```pending-ticket
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

## Applied

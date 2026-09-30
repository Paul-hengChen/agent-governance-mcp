# Pending tickets — lane e259

## Applied

```pending-ticket
lane_local_id: E259-NEW-1
title: Shell comment scan misses # blocks after a backslash-escaped quote outside a string
priority: P3
depends_on: [E259]
source: code-reviewer, e259 review round 1 (2026-09-30)
body: |
  In the shell table, a backslash-escaped quote in code (echo don\'t, echo \"x) opens a
  string that spans lines, so later # comment blocks are read as string and not flagged.
  Under-flag only; no crash or hang. Not in the known-misread list or docs/install.md.
  Fix: skip the character after \ in shell code mode, or list it as a known misread.
```

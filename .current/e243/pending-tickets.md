# e243 — pending tickets

## Applied

```pending-ticket
lane_local_id: E243-NEW-1
title: agc eject prints the workspace path raw — a CR/LF/ESC in a directory name splits or injects into its plan output
priority: P3
depends_on: [E243]
source: sr-engineer, T-E243-03 smoke run
body: |
  E243's AC14 escapes `<segment>` only in the two messages it rewrites (the init
  local-mode refusal and the agc check cannot-verify advisory). `agc eject` still
  interpolates the workspace path and repo-relative paths raw into its plan header
  ("agc eject — plan for <cwd> ...") and into every "(iii) host traces — <rel>" line.
  Observed during the smoke run: a workspace dir named "lf<LF>x" makes the plan
  header span two lines, and an ESC byte would reach the terminal raw. Same class
  as the E243 integrator pre-review finding, one surface further out. Candidate fix:
  reuse escapeSegmentForDisplay() (or a whole-path sibling) on the display copies
  of paths in runEject's output only. Other agc init / check messages that echo
  cwd or paths are likely in the same class and could be swept in the same pass.
```

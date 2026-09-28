# Pending tickets — lane e106

## Applied

```pending-ticket
lane_local_id: E106-NEW-1
title: agc init run from a repo subdirectory writes root-anchored exclude rules that miss the files it just created
priority: P2
depends_on: [E106]
source: code-reviewer, E106 review round 1 (review_reports/review_T-E106-01.md)
body: |
  With cwd in a subdirectory of the repo, `agc init --artifacts=local` (or the default) writes
  `/.current/`, `/tasks.md`, `/qa_reports/`, `/review_reports/` anchored at the repo root, yet the
  scaffold lands in `sub/.current/` and `sub/tasks.md`. It still records "local" and reports the
  rules as added, while `git status` shows those files untracked-but-not-ignored — the accidental
  commit path the flag exists to close. Fix shape: prefix the rules with the workspace path relative
  to the repo root (or refuse / warn when cwd is not the repo root), and make `agc check`'s drift
  predicate use the same prefix. No E106 AC covers this case.
```

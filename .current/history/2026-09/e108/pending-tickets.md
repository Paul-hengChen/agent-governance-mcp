## Applied

```pending-ticket
lane_local_id: E239-NEW-1
title: Check whether `agc feature start` can itself be invoked with cwd inside a subdirectory of the primary checkout (distinct from E239's scaffold-vs-anchor mismatch — LANE_EXCLUDE_RULES is anchored at the NEW worktree's own root, which is unaffected by E239's bug by construction; the open question is only about cwd at invocation time, not the worktree's own root)
priority: P3
depends_on: none
source: pm, E239 cut (specs/e239-init-subdir-exclude.md Out of Scope)
body: |
  E239's fix scope note: `LANE_EXCLUDE_RULES` (.env, /node_modules, /.current/**/base-sha,
  written by `bootstrapLaneEnv` during `agc feature start`) is anchored at the freshly created
  worktree's own top level, which `git worktree add <path>` always makes the worktree's root —
  so there is no scaffold-location-vs-anchor mismatch analogous to `agc init`'s bug. Not checked:
  whether `runFeatureStart(cwd, argv)` behaves correctly when invoked with `cwd` set to a
  subdirectory of the PRIMARY checkout (as opposed to the worktree it creates). Left unexamined
  as out of E239's scope; worth a narrow look before assuming it's fine.
```

```pending-ticket
lane_local_id: E239-NEW-2
title: agc init local mode does not refuse a backslash or control character (CR/LF) in the workspace path, so the written exclude rule silently misses the scaffold
priority: P3
depends_on: [E239]
source: sr-engineer + code-reviewer, E239 review round 1 (review_reports/review_T-E239-01.md)
body: |
  A backslash is a gitignore escape character: a directory named `a\b` yields the rule
  `/a\b/.current/`, which git reads as `/ab/.current/`, so the created files are untracked but
  not ignored and `agc check` stays silent. A CR/LF in a directory name would split one rule into
  several exclude lines. The current refusal set is only `* ? [ ]` (fixed verbatim in three
  user-facing messages), so widening it is a copy change as well as a code change. Not reachable
  on Windows, where the backslash is the path separator.
```

```pending-ticket
lane_local_id: E108-NEW-1
title: agc eject sends a partly tracked artifact directory wholly to the printed git rm line, so its untracked files survive both eject and the pasted command without being mentioned
priority: P3
depends_on: [E108]
source: code-reviewer, E108 review round 1 (review_reports/review_T-E108-01.md R1)
```

```pending-ticket
lane_local_id: E108-NEW-2
title: printed git rm / rm commands from agc init and agc eject do not shell-quote paths, so they break when the workspace path or home directory contains a space
priority: P3
depends_on: [E108]
source: code-reviewer, E108 review round 1 (review_reports/review_T-E108-01.md R2); same gap in the existing init already-tracked warning
```

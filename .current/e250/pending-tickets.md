# Pending tickets — lane e250

```pending-ticket
lane_local_id: E250-NEW-1
title: shared git-root helpers echo cwd / worktree paths raw in their refusal and error messages (reached by agc eject and agc feature)
priority: P3
depends_on: [E250]
source: sr-engineer, E250 implementation sweep of bin/agc-init.mjs
body: |
  E250 escapes every path runEject() prints itself, but the shared helpers it calls first still
  interpolate paths raw: resolvePrimaryRepoRoot()'s "not inside a git repository (<cwd>)" and
  "refusing to run from inside a linked git worktree (<top>) — run it from the primary checkout
  (<primary>)" messages, resolveRepoRootOrNull()'s "cannot determine the git repository for <cwd>"
  error, and repoRelativeWorkspacePrefix()'s "workspace <cwd> is not inside the git work tree at
  <repoRoot>" error. `agc eject` run from inside a linked worktree whose path holds a control
  character (LF, CR, ESC, ...) therefore still prints that byte raw on stderr. Fix shape: pass the
  interpolated paths through escapeSegmentForDisplay() at those message sites; display-only, the
  values used for git calls stay raw.
```

```pending-ticket
lane_local_id: E250-NEW-2
title: agc feature start / finish messages echo lane worktree and primary-checkout paths raw
priority: P3
depends_on: [E250]
source: sr-engineer, E250 implementation sweep of bin/agc-init.mjs
body: |
  `agc feature start` and `agc feature finish` print lane paths and repo paths unescaped in their
  success lines ("created branch <b> (from <base>) and worktree <lanePath>", "removed worktree
  <lanePath>"), refusals ("target path already exists: <lanePath>", "the primary checkout
  (<repoRoot>) has ... checked out", "could not resolve the primary checkout of <lanePath>") and
  the indented path lists under the uncommitted-change / conflict / unresolvable-symlink /
  git-ignored-at-risk refusals. A lane path from --path, or a primary checkout whose directory name
  holds a control character, can split those lines or reach the terminal raw — the same class E250
  closed for agc eject. Fix shape: escapeSegmentForDisplay() at each print site only, with any
  paste-me command lines handled the way E250 handles `git rm -r` (omit and print a note when a
  listed path holds a control character).
```

## Applied

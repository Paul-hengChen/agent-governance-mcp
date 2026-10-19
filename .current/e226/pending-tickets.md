# Pending tickets — lane e226

```pending-ticket
lane_local_id: E226-NEW-1
title: verify-release.mjs and check-bookkeeping.mjs resolve the repo from their own install, not the workspace
priority: P3
depends_on: [E226]
source: pm, e226 cut (specs/e226-integrator-sop-portable.md, Decisions made at cut)
body: |
  scripts/verify-release.mjs and scripts/check-bookkeeping.mjs set their root to the script's own
  parent directory (import.meta.url) and run git / gh there. After E226 the integrator SOP calls
  `node <agc install>/scripts/verify-release.mjs --ci-check --sha <sha>`; in an adopter workspace that
  queries the agc install's repository, not the workspace, so the generic call is not yet functional
  outside the agc checkout. The other tools the SOP calls (fanout, mailbox-watch, lane-status,
  merge-invariants, test-lock, feature-rollup) use the working directory. Decide whether verify-release
  takes the workspace from cwd (or a --repo flag); check-bookkeeping is this repo's own check and now
  sits in the repo addendum, so it may stay as is.
```

```pending-ticket
lane_local_id: E226-NEW-2
title: integrator SOP still states repo facts the E349 list did not name
priority: P3
depends_on: [E349]
source: pm, e226 cut (specs/e226-integrator-sop-portable.md, Out of Scope)
body: |
  After E226/E349 the integrator SOP still carries facts true only in the agc repository: 5a says
  ci.yml triggers on feat/** (E298); the CI flake rule points at the load-sensitive list in
  docs/backlog.md; 5b-4 restarts the primary MCP server after a merge (only meaningful when the
  workspace is the agc server itself); 5a checks root NEW-TICKETS.md untouched; the full suite is
  written as npm test. Decide which become generic wording plus an addendum line, as E349 did.
```

## Applied

# Pending tickets — lane e391

New findings from the E391 PM cut (lane-protocol §4). Full context: `specs/e391-prompt-audit-stale-facts.md` § Findings filed.

```pending-ticket
lane_local_id: E391-NEW-2
title: CLAUDE.md carries more literal counts that will go stale, and Layout omits further 4.x tools/ modules
priority: P3
depends_on: [E391]
source: pm, E391 cut (prompt-audit wave 1), 2026-11-02
body: |
  Some CLAUDE.md literals are correct today but will go stale: "221 test files" (Layout
  and Testing changes), "35 gate definitions" and "35 entries" (Layout / What this repo is).
  The Layout section also leaves out other 4.x tools/ modules: comment-*.ts,
  dispatch-log.ts, hygiene-scan.ts, merge-invariants.ts, lane-registry.ts,
  feature-rollup.ts, join-precondition.ts, lane-migrate.ts, tasks-lane-migrate.ts,
  lane-ticket-allocation.ts and evidence-lookup.ts. test/e178a-integrator-role.test.mjs
  pins some of the CLAUDE.md counts, so that test needs a re-pin if they change.
  Out of E391's scope (E391 only touches the four named findings G2-03/13/15/24).
```

## Applied

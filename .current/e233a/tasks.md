<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E233A-01 [P1] sr-engineer: rewrite ticket-id comments in tools/handoff-orchestrator.ts into plain language (id as trailing pointer), comments only | depends_on: none
- [ ] T-E233A-02 [P1] sr-engineer: rewrite ticket-id comments in tools/handoff-parse.ts, handoff-write.ts, handoff-types.ts, handoff.ts | depends_on: none
- [ ] T-E233A-03 [P1] sr-engineer: rewrite ticket-id comments in tools/tasks-file.ts, tasks-lane-migrate.ts, storage-sqlite.ts, storage.ts, config.ts | depends_on: none
- [ ] T-E233A-04 [P1] sr-engineer: rewrite ticket-id comments in tools/fanout-manifest.ts, lane-paths.ts, lane-registry.ts | depends_on: none
- [ ] T-E233A-05 [P1] sr-engineer: rewrite ticket-id comments in tools/lane-status.ts (keep line-prefix "// Watch mode (E178b" verbatim; stay // comments, no block comments), lane-ticket-allocation.ts, lane-migrate.ts | depends_on: none
- [ ] T-E233A-06 [P1] sr-engineer: rewrite ticket-id comments in tools/transitions.ts, feature-rollup.ts, drift.ts, registry.ts (comments only, never description strings), gate-stats.ts | depends_on: none
- [ ] T-E233A-07 [P1] sr-engineer: rewrite ticket-id comments in tools/join-precondition.ts, metrics.ts, stale-notify.ts, merge-invariants.ts | depends_on: none
- [ ] T-E233A-08 [P1] sr-engineer: rewrite ticket-id comments in tools/usage-accounting.ts, evidence-lookup.ts, dispatch-log.ts, hygiene-scan.ts, evidence-file.ts | depends_on: none
- [ ] T-E233A-09 [P1] sr-engineer: rewrite comments in tools/role.ts, telemetry.ts, exemptions.ts and any tools/*.ts still flagged by the bare-id check; then run spec AC1-AC6 checks, npm run build, commit dist/tools/** | depends_on: T-E233A-01,T-E233A-02,T-E233A-03,T-E233A-04,T-E233A-05,T-E233A-06,T-E233A-07,T-E233A-08

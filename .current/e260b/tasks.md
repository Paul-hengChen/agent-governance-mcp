<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E260B-01 [P0] sr-engineer: write .current/e260b/check-invariance.mjs + measure-comments.mjs per spec "Proof scripts", create specs/e260b-rationale.md skeleton, run --self-test; no tools/ edits | depends_on: none
- [x] T-E260B-02 [P1] sr-engineer: trim comments in tools/lane-migrate.ts, tools/join-precondition.ts | depends_on: T-E260B-01
- [x] T-E260B-03 [P1] sr-engineer: trim comments in tools/lane-paths.ts, tools/lane-registry.ts | depends_on: T-E260B-01
- [x] T-E260B-04 [P1] sr-engineer: trim comments in tools/lane-status.ts (keep "// Watch mode (E178b" line, // style), stale-notify.ts, merge-invariants.ts, metrics.ts | depends_on: T-E260B-01
- [x] T-E260B-05 [P1] sr-engineer: trim comments in tools/lane-ticket-allocation.ts, tools/tasks-lane-migrate.ts | depends_on: T-E260B-01
- [x] T-E260B-06 [P1] sr-engineer: trim comments in tools/tasks-file.ts, storage.ts, storage-sqlite.ts; Generic-citation sweep of tools/tasks.ts | depends_on: T-E260B-01
- [x] T-E260B-07 [P1] sr-engineer: trim comments in tools/registry.ts (comments only, no description strings), role.ts, sync.ts, telemetry.ts | depends_on: T-E260B-01
- [x] T-E260B-08 [P1] sr-engineer: trim comments in tools/transitions.ts, usage-accounting.ts, rag-coalesce.ts; Generic-citation sweep of rag.ts, skill-frontmatter.ts | depends_on: T-E260B-01
- [x] T-E260B-09 [P1] sr-engineer: close-out — npm run build, commit dist/tools/{i..z}*, fill keep-reason table in specs/e260b-rationale.md, run measure-comments.mjs + check-invariance.mjs (both exit 0), AC5-AC7/AC10/AC11 greps, clean tree | depends_on: T-E260B-02,T-E260B-03,T-E260B-04,T-E260B-05,T-E260B-06,T-E260B-07,T-E260B-08

# Pending tickets — lane e391

New findings from the E391 PM cut (lane-protocol §4). Full context: `specs/e391-prompt-audit-stale-facts.md` § Findings filed.

- **E391-NEW-2** — Some `CLAUDE.md` literals are correct today but will go stale: "221 test files" (`:122`, `:154`), "35 gate definitions" (`:88`) and "35 entries" (`:50`). The Layout section also leaves out other 4.x `tools/` modules: `comment-*.ts`, `dispatch-log.ts`, `hygiene-scan.ts`, `merge-invariants.ts`, `lane-registry.ts`, `feature-rollup.ts`, `join-precondition.ts`, `lane-migrate.ts`, `tasks-lane-migrate.ts`, `lane-ticket-allocation.ts` and `evidence-lookup.ts`. `test/e178a-integrator-role.test.mjs` pins some of the `CLAUDE.md` counts, so that test needs updating if they change.

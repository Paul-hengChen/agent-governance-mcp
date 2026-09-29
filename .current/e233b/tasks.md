<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E233B-01 [P1] sr-engineer: rewrite bare-id comments in gates/ (registry, visual, feature-lease, pipeline, ac-execution, qa-review, lease-override, stamp-provenance, evidence-schema) plus transport/ and index.ts if a rescan finds any; comments only; run AC1 proof on touched files | depends_on: none
- [ ] T-E233B-02 [P1] sr-engineer: rewrite bare-id comments in bin/ (agc-init.mjs, agent-governance-context.mjs, agent-governance-usage-hook.mjs); comments only; run AC1 proof | depends_on: none
- [ ] T-E233B-03 [P1] sr-engineer: rewrite bare-id comments in scripts/ (13 files: verify-release, check-md-tables, capture-constitution-golden, check-transitions-sync, lane-status, feature-rollup and the single-hit files); comments only; run AC1 proof | depends_on: none
- [ ] T-E233B-04 [P1] sr-engineer: rewrite bare-id comments in prompts/, schema/, guards/, lib/ (build.ts, text-transforms.ts, integrator.ts, migrations-handoff.ts, migrations-tasks.ts, session.ts, render-boundary.ts); comments only; run AC1 proof | depends_on: none
- [ ] T-E233B-05 [P2] sr-engineer: E241 — replace citations of never-existing files in CHANGELOG.md (3.27.1 entry ~2859; ~3916) and research/visual-fidelity.md header with plain descriptions or drop; no other CHANGELOG edits | depends_on: none
- [ ] T-E233B-06 [P0] sr-engineer: after 01-05, npm run build and commit the dist share only (dist/{gates,prompts,schema,guards,lib,transport}, dist/index.*; never dist/tools); run AC1 proof vs base and AC2 scan over the whole lane | depends_on: T-E233B-01,T-E233B-02,T-E233B-03,T-E233B-04,T-E233B-05

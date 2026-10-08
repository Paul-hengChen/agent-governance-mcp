<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E275-01 [P0] sr-engineer: upgrade deps per specs/e275-advisory-upgrades.md AC1-AC5, AC8, AC9 — raise sdk floor to fixed version, refresh lockfile so proxy-addr >=2.0.8 (override only if needed), overrides.sharp ^0.35.5; npm audit --audit-level=high exit 0; build clean; full suite green via node scripts/test-lock.mjs -- npm test; stop and escalate (no code/test edits) if tests go red | depends_on: none
- [ ] T-E275-02 [P0] sr-engineer: record dispositions in docs/dependency-advisories.md per spec AC6-AC7 — new §6 sdk, §7 proxy-addr, §4 Third round, §5 one-line note, heading update, one dated note in residual section (post-upgrade audit totals, no table re-tabulation) | depends_on: T-E275-01

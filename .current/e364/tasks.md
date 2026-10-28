<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E364-01 [P0] sr-engineer: zod floor ^4.6.6 + `npm update zod body-parser --package-lock-only` (lane-own node_modules via rm symlink + npm ci; no npm audit fix, no overrides); verify 7-entry lockfile delta, audit --audit-level=high exit 0, no dist/ diff, full suite green; record §8 zod / §9 body-parser + heading + 2026-10-28 residual note in docs/dependency-advisories.md (spec specs/e364-audit-high-upgrade.md AC1-AC8, AC10, AC11) | depends_on: none
- [ ] T-E364-02 [P0] qa-engineer: independently re-run AC1-AC6 + AC9 on committed HEAD (clean tree; lockfile-delta script; final `node scripts/test-lock.mjs -- npm test`); cross-check §8/§9 against both GHSA pages (AC7) and residual note vs fresh npm audit (AC8); no new test files | depends_on: T-E364-01

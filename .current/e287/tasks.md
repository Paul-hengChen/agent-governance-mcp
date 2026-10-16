<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E287-01 [P1] sr-engineer: E287 — agc feature finish warns (never silent) when .current/<lane>/pending-tickets.md is in the lane worktree but absent from the revision finish reads; target_repo findings are never allocated locally and are listed for a human ruling; per specs/e287-finish-findings-and-small-fixes.md + architecture doc (AC-E287-1..9) | depends_on: architect
- [ ] T-E324-01 [P2] sr-engineer: E324 — emitZodGateTelemetry (tools/registry.ts) skips the emit when the normalized workspace_path has any `.current` path segment; rebuild dist/tools/registry.* (AC-E324-1..3) | depends_on: none
- [ ] T-E325-01 [P2] sr-engineer: E325 — tools/drift.ts readArtifactVersion handoff branch re-reads the other layout once on a pick-then-read miss (E312 shape, local to drift.ts; tools/handoff-parse.ts untouched); rebuild dist/tools/drift.* (AC-E325-1..4) | depends_on: none
- [ ] T-E326-01 [P1] sr-engineer: E326 — scripts/verify-release.mjs polls an empty branch-scoped run list within AGC_VERIFY_CI_WAIT_SECONDS, then FAIL (--strict) / WARN (lenient) with the unchanged reason text; --sha path and gh-unavailable degradation unchanged (AC-E326-1..7) | depends_on: none
- [ ] T-E287-02 [P1] qa-engineer: E287 tests (new test/e287-*.test.mjs; re-pin owned finish tests only if needed) + lane-wide full suite via node scripts/test-lock.mjs -- npm test on final HEAD, clean tree; verdict (AC-E287-1..9, AC-LANE-1..3) | depends_on: T-E287-01, T-E324-01, T-E325-01, T-E326-01
- [ ] T-E324-02 [P2] qa-engineer: E324 tests in test/e303-zod-boundary-telemetry.test.mjs or new test/e324-*.test.mjs; verdict (AC-E324-1..3) | depends_on: T-E324-01
- [ ] T-E325-02 [P2] qa-engineer: E325 tests in new test/e325-*.test.mjs (drift-*.test.mjs only if needed); verdict (AC-E325-1..4) | depends_on: T-E325-01
- [ ] T-E326-02 [P1] qa-engineer: E326 tests in test/verify-release.test.mjs (E238 VR-22 untouched) and/or new test/e326-*.test.mjs; verdict (AC-E326-1..7) | depends_on: T-E326-01

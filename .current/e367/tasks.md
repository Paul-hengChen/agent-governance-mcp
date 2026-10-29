<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E367-01 [P1] sr (E367): add decodeEvidenceId (strict inverse of encodeEvidenceId) to tools/evidence-file.ts; tools/lane-status.ts passEvidenceIdsIn uses decodeEvidenceId(stem) ?? stem; rebuild dist/ (spec specs/e367-evidence-and-feature-path-encoding.md) | depends_on: none
- [ ] T-E368-01 [P1] sr (E368): add encodeFeatureStem (case-mirrored injective encoding, isolated-interior-dot rule) to tools/evidence-file.ts; specFilePath / expectedRedManifestPath / designFilePath use it; rewrite stale sanitiser comments; rebuild dist/ | depends_on: T-E367-01
- [ ] T-E367-02 [P1] qa (E367): new test/e367-lane-status-decode.test.mjs covering AC-E367-1..6 | depends_on: T-E367-01
- [ ] T-E368-02 [P1] qa (E368): new test/e368-feature-path-injective.test.mjs covering AC-E368-1..6 | depends_on: T-E368-01
- [ ] T-E368-03 [P1] qa (E368 re-pins + lane verification): re-pin only e136 AC-E136-7, ac-execution U6, gates-expected-red U5, visual-evidence-gate v3.14.1 AC-3; run AC-E368-7, AC-E368-8, AC-L1..L4 on final HEAD (full suite via node scripts/test-lock.mjs -- npm test) | depends_on: T-E367-02, T-E368-02

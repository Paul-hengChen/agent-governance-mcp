<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E362-01 [P0] sr-engineer: reclaimStale publishes its guard <target>.reclaim-<digest> via unique same-dir temp (prefixed <guardPath>.) + best-effort fsync + fs.linkSync, never observable empty; EEXIST -> existing inspection path; other errors return silently; temp removed in every outcome; nested guards same; E209 lock publish, payloads, exports, CLI unchanged (specs/e362-test-lock-guard.md AC-E362-2..5) | touches: scripts/test-lock.mjs | depends_on: none
- [x] T-E362-02 [P0] qa-engineer: deterministic F1 interposition repro (red on base copy 1adb50b, green on HEAD), guard temp cleanup / lost-race / non-EEXIST cases, legacy empty-guard grace case; test/e209-test-lock-publish.test.mjs unmodified (AC-E362-1..4) | touches: test/e362-*.test.mjs | depends_on: T-E362-01
- [x] T-E224-01 [P1] qa-engineer (qa-only, E221 folded): AC17 (AC17 body only), AC13b and AC10 wait budgets raised and/or env-overridable with reasons; load evidence >= 3 rounds; ## AC10 decision; then lane-wide full suite via node scripts/test-lock.mjs -- npm test after final commit (AC-E224-1..4, AC-LANE-1..3) | touches: test/e177b-test-lock.test.mjs, test/e177b-mailbox-watch.test.mjs, test/e224-*.test.mjs | depends_on: T-E362-02

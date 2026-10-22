<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E209-01 [P1] sr-engineer: scripts/test-lock.mjs acquireLock publishes the payload via a unique same-dir temp file + fs.linkSync so the lock is never observable empty; temp always removed; EEXIST path, payload shape, exports, CLI unchanged (specs/e209-test-infra-fixes.md AC-E209-2..6) | depends_on: none
- [x] T-E183-01 [P1] sr-engineer: scripts/summarize-metrics.mjs default path from dist/tools/lane-paths.js (current lane, then legacy flat with stderr note); missing/unreadable file exits 1 with clear stderr (default and explicit path); header comment + docs/gate-retro-procedure.md Success-metrics text updated (specs/e209-test-infra-fixes.md AC-E183-1..8) | depends_on: none
- [x] T-E209-02 [P1] qa-engineer: deterministic reclaimStale interposition repro (red on base copy, green on HEAD), temp-file cleanup + empty-lock grace cases in test/e209-*.test.mjs; test/e177b-test-lock.test.mjs additive only, AC10 assertions unchanged (specs/e209-test-infra-fixes.md AC-E209-1..5) | depends_on: T-E209-01
- [x] T-E183-02 [P1] qa-engineer: lane / primary / flat-fallback / loud-failure cases in test/e183-*.test.mjs (red on base where stated); re-pin E8-S4 only in test/success-metrics.test.mjs (specs/e209-test-infra-fixes.md AC-E183-1..7) | depends_on: T-E183-01
- [x] T-E182-01 [P1] qa-engineer (qa-only): test/usage-accounting.test.mjs runHook timeout raised and/or env-overridable, load evidence, '## E156 cause judgment' in qa_reports/review_T-E182-01.md; then lane-wide full suite via node scripts/test-lock.mjs -- npm test after final commit on clean tree (specs/e209-test-infra-fixes.md AC-E182-1..3, AC-LANE-1..3) | depends_on: T-E209-02, T-E183-02

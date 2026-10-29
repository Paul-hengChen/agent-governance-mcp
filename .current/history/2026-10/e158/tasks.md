<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E158-01 [P1] sr: verify-release.mjs Check 1 fails loud on a commit listing no path and on a zero-commit enumeration (--ci-check/--close-out untouched); check-bookkeeping.mjs explicit unresolvable --base exits 2, and (ruling R1 = A) no-base exits 2 — touches scripts/verify-release.mjs, scripts/check-bookkeeping.mjs (specs/e158-range-subject-audit.md AC-E158-1..4b) | depends_on: none
- [x] T-E158-02 [P1] sr: FANOUT_CODES.rangeEmpty = RANGE_EMPTY; checkLane and rangePaths return it on an empty A...B diff (exit 2); non-empty output byte-identical; rebuild + commit dist — touches tools/fanout-manifest.ts, dist/tools/fanout-manifest.* (AC-E158-5..8) | depends_on: none
- [x] T-E369-01 [P2] sr: reclaimStale returns boolean; acquireLock falls through to notify/max-wait/sleep when false (no busy spin), reclaim log at most once per observed content; move in-body comment into doc comment; publishLock doc one line ≤ 80 cols — touches scripts/test-lock.mjs (AC-E369-1..7) | depends_on: none
- [x] T-E158-03 [P1] qa: empty-subject tests with in-test fixtures (AC-E158-1/4/4b/5/6); re-pin e331 owners main...main assertion and (R1 = A) e299 ID-MONO-NO-BASE-NOTE — touches test/e158-*.test.mjs, test/e331-git-diff-failure.test.mjs, test/e299-check-bookkeeping.test.mjs | depends_on: T-E158-01, T-E158-02
- [x] T-E369-02 [P2] qa: deterministic E369 repro — live guard, corrupt-in-grace guard, unreadable guard, guard released, CLI exit 75 — with injected now() call-count bound — touches test/e369-*.test.mjs (AC-E369-1..5) | depends_on: T-E369-01
- [x] T-E370-01 [P2] qa-only: e177b AC9/AC13a load budgets with ## E370 decision rationale and >= 3 rounds of 8-way load evidence; then lane-wide full suite via test-lock on final HEAD — touches test/e177b-test-lock.test.mjs (AC-E370-1..4, AC-LANE-1..4) | depends_on: T-E369-02, T-E158-03

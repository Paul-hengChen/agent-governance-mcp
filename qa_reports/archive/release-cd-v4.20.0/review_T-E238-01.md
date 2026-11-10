covers: T-E238-01, T-E238-02, T-E238-03, T-E238-04, T-E238-05, T-E238-06

# QA review: e238-load-sensitive-tests

Single-role judge hop (test-only ticket; QA authored the test changes and verified them). Test commit: bc4a6e9.

Phase 0.5: skipped (no expected-red manifest declared).
Phase 1.5: skipped (no Visual Baselines declared).

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC1 | `node --test --test-name-pattern="VR-22" test/verify-release.test.mjs` | pass 1, fail 0, exit 0 | pass |
| AC1 | `grep -c "elapsedMs < 5000" test/verify-release.test.mjs` | 0 (no match) | pass |
| AC2a | `node --test --test-name-pattern="gap-6" test/e132-lane-registry.test.mjs` | pass 1, fail 0 | pass |
| AC2a | `grep -c "minLarge > minSmall" test/e132-lane-registry.test.mjs` | 0 (no match) | pass |
| AC2b | `node --test --test-name-pattern="gap-7" test/e132-lane-registry.test.mjs` | pass 1, fail 0 | pass |
| AC3 | `node --test --test-name-pattern="AC3b" test/teamwork-lite.test.mjs` | pass 1, fail 0 | pass |
| AC3 | `grep -c "workspace_path: PROJECT_ROOT" test/teamwork-lite.test.mjs` | 0 (no match) | pass |
| AC4 | `node --test test/feature-lease.test.mjs` | pass 67, fail 0 | pass |
| AC4 | `grep -c "freshNonSuspectStamp()" test/feature-lease.test.mjs` | 0 (no match) | pass |
| AC5 | `node --test --test-name-pattern="AC19/AC15" test/e177b-mailbox-watch.test.mjs` | pass 1, fail 0 | pass |
| AC5 | `grep -c '"0.006"' test/e177b-mailbox-watch.test.mjs` | 0 (no match) | pass |
| AC6 | diff stat of `test/usage-accounting.test.mjs` against the lane base | empty (0 lines) | pass |
| AC6 | `node --test test/usage-accounting.test.mjs` | in the combined six-file run: 214 of 215 pass; the one red was VR-20, not this file | pass |
| AC6 | `node scripts/test-lock.mjs -- npm test` on bc4a6e9 | 4058/4061 pass, 1 fail (see Outside scope) | pass with recorded rationale |

Repeat runs (AC2/AC4/AC5): e132-lane-registry, feature-lease and e177b-mailbox-watch run together 5 times, 111 pass 0 fail on every run. verify-release plus teamwork-lite: 69 pass 0 fail.

## Spec-to-test map
Each AC maps to the edited case in its own file (names unchanged): VR-22; gap-6; gap-7; AC3b; E10-AC2b, E10-AC3 and the seed helper (all 12 seeded cases); AC19/AC15. AC6 is a run-only confirmation.

## Notes
- AC4: the cause is inferred (a seeded stamp at or after the gate's own clock read gives a negative age, so the lease is not held), not reproduced. The new E10-AC2b precondition assertion names the seeded stamp if the lease ever fails to hold again.
- AC2b: wall-clock appears in the helper because the product's subprocess ceiling is not injectable from readHandoffState. A real dropped spread returns in under 200 ms and fails on the first try.

## Outside scope (not fixed, per the brief)
- Full suite on bc4a6e9: `test/e108-eject.test.mjs` "AC7: docs/backlog.md is kept by default ..." red once. Re-run in isolation several times: 35/35 pass on every re-run. Cause not identified; likely load-related. Not an E238 site.
- An earlier combined run saw VR-20 (poll-timing test in the verify-release file, not an E238 site) red once under concurrent load. It passed in isolation (7 s) and was green in the later full-suite run.
## 2026-11-09T09:08:06.013Z — PASS — by qa-engineer

suite-result: 4058/4061 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Single-role judge hop, test-only. All six ACs verified; per-AC commands and output are in the covers file (AC Execution Log). Test commit bc4a6e9. Full suite on bc4a6e9: 4058/4061, one red outside the E238 sites (test/e108-eject.test.mjs AC7), which passes 35/35 in isolation on re-run; not fixed, out of scope. AC4 root cause is inferred, not reproduced.


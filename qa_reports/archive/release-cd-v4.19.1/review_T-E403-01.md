covers: T-E403-01, T-E403-02, T-E407-01, T-E407-02, T-E407-03, T-E407-04, T-E407-05, T-E407-06

# QA review: e403-lean-dispatch-alias (E403 + E407)

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared).
Phase 3.5: the spec's `proof:` lines are the commands listed below; each was run.

## Copy audit
All six Copy/Strings entries (coord03.fallback, coord05.drift, lite.hopcap, qa.ownership, integrator.row1.can/cannot)
are asserted verbatim by the new tests; code review (review_reports/review_T-E403-01.md) confirmed byte-exactness.
Visual Tokens: N/A.

## AC to test map
| AC | test |
|---|---|
| AC1, AC2 | test/e403-lean-dispatch-alias.test.mjs (4 tests: lean and non-claude host paragraph has no `Task`; claude-code alias precedes Fallback with the same noun; alias absent from lean) |
| AC3 | test/e96-dispatch-preference.test.mjs t-fallback-genuine-unavailability re-pinned; t-fallback-self-contained green unchanged |
| AC4-AC7 | test/e407-restatement-citations.test.mjs (5 tests: exact site text, no restated mechanism, cited rule present once / present in each composition that loads the site) |
| AC8 | test/e336-portable-pull.test.mjs AC-E336-1 Permissions-row assertion re-pinned to the Constitution section 6 citation; Git operations assertion, SITES and other tests untouched |
| AC9 | code review confirmed content changes are the five files only (d9e953e); the qa commit touches test/ only |
| AC10 | capture re-run: only skill-coordinator-monolith.txt changed (45762 bytes, matches PM dry run); skill-manifest and compose-equivalence green |
| AC11 | context-budget green with 96 passing across the three golden/budget files; no cap literal edited (5723 / 21715); lean always-on re-measured about 5681 (base 5711) |
| AC12 | final suite below; dist/ clean after build |

## Budget before/after (from spec dry run, lean re-measured here)
AC2 lean 5711 -> about 5681 (cap 5723); AC8 teamwork 21515 -> within cap 21715 and the budget test is green;
integrator and qa bodies within their per-skill caps (budget test green).

## Run
- `npm test` via test-lock on the final HEAD, clean tree: 4012 passed / 4014 total, 0 failed, 2 skipped, exit 0.
- An earlier run overlapped with my own bookkeeping check and showed one red: e132-lane-registry gap-6, a wall-clock
  timing check outside this lane's files. It passed alone (22/22) and in the clean rerun. Recorded as a load-sensitive flake.
- `npm run check:bookkeeping` exit 0. `npm run build`: no dist/ diff.

## Findings
None blocking. No out-of-scope correctness issue observed beyond the reviewer's optional notes.

## AC Execution Log
One log for the round, covering all 8 ids. Each proof was run on the final HEAD.

| AC | command | result | verdict |
|---|---|---|---|
| AC1, AC2 | `node --test test/e403-lean-dispatch-alias.test.mjs` | pass 4, fail 0 | pass |
| AC2 (coord-02 untouched) | `git diff --quiet 1000517 -- content/coord-02-host-dispatch.md` | exit 0 | pass |
| AC3 | `node --test test/e96-dispatch-preference.test.mjs` | pass 7, fail 0 | pass |
| AC4 | `node --test test/e407-restatement-citations.test.mjs test/e393-builder-judge-core.test.mjs` | pass 11, fail 0 | pass |
| AC5, AC6 | `node --test test/e407-restatement-citations.test.mjs` | covered by the AC4 and AC7 runs, 5/5 green | pass |
| AC7 | `node --test test/e407-restatement-citations.test.mjs test/e178a-integrator-role.test.mjs` | pass 23, fail 0 | pass |
| AC8 | `node --test test/e336-portable-pull.test.mjs` | pass 8, fail 0 | pass |
| AC9 | `git diff --stat 1000517 -- content/ tools/ prompts/ dist/` | exactly 5 files: coord-03, coord-05, skill-coordinator-lite, skill-integrator, skill-qa-engineer (8 insertions, 16 deletions) | pass |
| AC10 | `git diff --stat 1000517 -- test/fixtures/compose-golden/`; `node --test test/skill-manifest.test.mjs test/compose-equivalence.test.mjs` | one file (skill-coordinator-monolith.txt); pass 42, fail 0 | pass |
| AC11 | `node --test test/context-budget.test.mjs`; `git diff --stat 1000517 -- test/context-budget.test.mjs` | pass 54, fail 0; no diff to the file, so no ceiling raised | pass |
| AC12 | `node scripts/test-lock.mjs -- npm test` on a clean tree | exit 0, 4012/4014 pass, 2 skipped; dist/ unchanged after build | pass |
## 2026-11-04T10:12:55.462Z — PASS — by qa-engineer

suite-result: 4012/4014 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All 8 ids verified. New tests e403 (4) and e407 (5) green; e96 and e336 re-pinned in place; only the coordinator monolith golden changed (45762 bytes); budgets green with no ceiling raised; check:bookkeeping exit 0; dist unchanged after build. Full suite on final HEAD, clean tree: 4012/4014 pass, 2 skipped, exit 0. One earlier red (e132 gap-6, wall-clock timing, outside lane) passed alone and in the clean rerun. Every spec proof was executed; see the AC Execution Log in qa_reports/review_T-E403-01.md.


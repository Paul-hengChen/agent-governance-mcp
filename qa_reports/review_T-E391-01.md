# QA review — E391 (prompt-audit stale facts)

covers: T-E391-01, T-E391-02, T-E391-04, T-E391-05, T-E391-06, T-E391-07, T-E391-08

Verdict: PASS. Commits: golden `5dc7d32` (T-E391-05), re-pins + AC test `1ea3d7f` (T-E391-06). Suite verified on that HEAD with a clean tree.

## Expected-Red Diff

Phase 0.5: clean (12/12 manifest entries confirmed green after the planned re-pin/re-capture, 0 unexplained reds). The 11 compose-equivalence golden entries are green after re-capture (T-E391-05); the qa-visual-skill-split AC-3 entry is green after the `:87` re-pin (T-E391-06). The full suite has 0 failures, so nothing outside the manifest is red.

## T-E391-05 golden hunks (`test/fixtures/compose-golden/**`)

`node scripts/capture-constitution-golden.mjs` after `npm run build`. 11 files, 23 insertions / 23 deletions; every moved line is one of three strings and nothing else (word diff checked):

| finding | line | files | change |
|---|---|---|---|
| G2-06 / G2-18 | const-08 line 2 (Cut-Approval Gate) | `constitution-monolith.txt`, `hook-full.txt` (origin tags kept), `build-full-*.txt` x4 (tags stripped) | `skill-pm.md` -> `skill-pm`; coordinator pointer now `skill-coordinator` *Cut-approval gate writer obligation* (stop-condition 6 gone) |
| G2-18 | const-08 line 4 (Manifest tier) | same 6 files | `skill-coordinator.md` -> `skill-coordinator` |
| G2-26 | const-15 line 6 (Auto-routing hop cap) | those 6 plus `build-lite-*.txt` x4 and `hook-lite.txt` (11 files) | "See ... §Auto-Routing for the full stop-condition list." -> "Stop conditions: `skill-coordinator` §Escalation Routes." |

`skill-coordinator-monolith.txt`: unchanged. No other moved line. `node --test test/compose-equivalence.test.mjs`: 14/14 pass.

## Budget (AC-BUDGET)

`node scripts/measure-context-cost.mjs` bundle lean: before (base 664e147) 5723, after 5722. Reviewer-measured after values: stripped 10593, teamwork 21588, non-design 8495. Ceilings in the unedited `test/context-budget.test.mjs`: 5723 / 10598 / 21715 / 8501 (not lowered, integrator decision); all pass. `skill-qa-engineer.md` 18371 B (cap 18500).

## T-E391-06 re-pins and AC test

- `test/qa-visual-skill-split.test.mjs` AC-3 regex now accepts an optional `<agc install>/` prefix and keeps the Read-tool clause.
- `test/compose-equivalence.test.mjs` comment refreshed (comment only).
- New `test/e391-prompt-audit-stale-facts.test.mjs` (15 tests), AC to test map: G2-02, 04, 05, 06, 07, 08, 11, 12, 18, 26 pin removed strings plus resolving targets (coord-03 `## Escalation Routes` and writer-obligation label, skill-pm Geometric-Density row, const-01 hop/fix_try/read rows); G2-03, 13, 15, 24 pin CLAUDE.md (no pass count / size literal, plain pipe, git bullet, 4 new Layout rows, check-version row, anchor-row order); plus a no-literal-count guard. Per F2 the `^-[a-z]` count is not pinned. Reads only `content/**` and `CLAUDE.md`; no base sha, no line numbers.
- Coverage note: pure text assertions; no new code to measure.

## T-E391-07 lane verification (HEAD `1ea3d7f`, `git status --porcelain` empty)

- AC-SCOPE: `node scripts/fanout.mjs check specs/fanout-e391-prompt-audit.md e391 --base 664e147` exit 0 (31 files, 0 out of bounds).
- AC-DIST: `npm run build` then `git diff --stat dist/` empty.
- AC-STAMP: `node bin/agc-init.mjs check` exit 0 (4.16.0).
- Full suite: `node scripts/test-lock.mjs -- npm test` exit 0, tests 3853, pass 3851, fail 0, skipped 2.
- The ten named guard tests are unmodified relative to base (no diff) and green inside the suite.
- Phase 1.5 skipped (no Visual Baselines). Phase 3.5: spec has `proof:` ACs; the AC proofs are executed as the pinned tests above, the AC-SCOPE/DIST/STAMP/BUDGET/GOLDEN/SUITE commands, and the grep proofs encoded in the AC test.

## AC Execution Log

| AC | command | result |
|---|---|---|
| AC-G2-02..26 grep proofs | `node --test test/e391-prompt-audit-stale-facts.test.mjs` | 15/15 pass |
| AC-GOLDEN | `node --test test/compose-equivalence.test.mjs` | 14/14 pass |
| AC-SCOPE | fanout check | exit 0, 0 out of bounds |
| AC-DIST | `npm run build; git diff --stat dist/` | empty |
| AC-STAMP | `node bin/agc-init.mjs check` | exit 0 |
| AC-BUDGET | measure-context-cost + context-budget test | lean 5722, green |
| AC-SUITE | `node scripts/test-lock.mjs -- npm test` | 3851/3853 pass (2 skipped), 0 fail |

## Observations (not FAIL)

- F1 (spec wording): `CLAUDE.md` says "the latest `qa_reports/archive/release-*/`" carries `suite-result:`. True by date (release-post-v4-w12/w13), not for the last folder by name (release-v4.6.0).
- F2: AC-G2-24 `^-[a-z]` count is 4, not 3 (the authorized G2-13 "auto-injects" line is also removed).
- NEW-2 (already filed): `CLAUDE.md` Testing changes still says "221 test files" (a literal count). The spec's "no literal counts" intent therefore cannot be pinned for test-file counts; the AC test pins gate-definition and pass-count literals only.
## 2026-11-02T05:58:27.450Z — PASS — by qa-engineer

suite-result: 3851/3853 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. Golden re-capture moves only const-08 L2/L4 and const-15 L6 strings (11 files, 23/23 lines; skill-coordinator-monolith unchanged). Bundle lean 5723 -> 5722; stripped 10593, teamwork 21588, non-design 8495, all under unedited ceilings. Re-pinned qa-visual-skill-split AC-3; added 15-test e391 AC test. Scope check exit 0, dist clean, agc check exit 0, 12/12 expected-reds green, full suite 3851/3853 (2 skipped). Observations F1 (spec wording), F2, NEW-2 recorded in qa_reports/review_T-E391-01.md (covers all seven ids).


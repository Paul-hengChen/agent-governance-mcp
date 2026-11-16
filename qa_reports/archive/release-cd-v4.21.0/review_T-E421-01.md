covers: T-E421-01, T-E421-02

# QA review: e421-e108-load-sensitive-list

## Expected-Red Diff
Phase 0.5: full suite run BEFORE any re-baseline edit: 4184 tests, 4179 pass, 3 fail. Actual reds vs manifest `qa_reports/expected-red_e421-e108-load-sensitive-list.txt` (3 entries): 3/3 manifest entries confirmed red, 0 unexplained reds.
- e349 AC-E349-2 — red because `W9` pinned the old bullet; dispositioned: re-pinned to NEW_BULLET (T-E421-02).
- e355 AC-E355-3 — red because `W9_LOAD` pinned the old bullet; dispositioned: re-pinned to NEW_BULLET.
- e355 AC-E355-4 — not predicted by the spec; red because the pin carried the `test/e108-eject.test.mjs` path prefix on the AC7 phrase, which NEW_BULLET separates by design (spec's own AC7-phrase survives unchanged). Dispositioned: line 68 re-pinned to the bare phrase (count 1) plus a new count-1 assertion for the four-test span; `named` array unchanged. Test title reworded (spec AC4 permits). Not a regression.

Phase 1: addendum line 38 equals NEW_BULLET (reviewed by code-reviewer, APPROVED). Copy audit: bullet verbatim. Visual: N/A. Phase 1.5: skipped (no Visual Baselines).
Phase 3: existing files e349 / e355 modified per the dispatch placement; no new test file.

## AC Execution Log
- AC1: `git diff --numstat main -- docs/lane-protocol-addendum.md` -> `1	1	docs/lane-protocol-addendum.md`; e349 passes. PASS.
- AC2: grep prefix counts -> `AC1: 1`, `AC15: 1`, `AC19: 1`, `AC20: 1`, `AC7 2`. PASS.
- AC3: `node --test test/e349-integrator-repo-facts.test.mjs` exit 0 (with e355: 6 pass, 0 fail). PASS.
- AC4: `node --test test/e355-integrator-generic-wording.test.mjs` exit 0. PASS.
- AC5: `git diff --name-only main -- content dist test/e108-eject.test.mjs` -> empty. PASS.
- AC6: `node scripts/test-lock.mjs -- npm test` -> see final result in the PASS evidence line.
- Also: `npm run -s check:bookkeeping` exit 0; `node bin/agc-init.mjs check` exit 0 (OK 4.20.0).
## 2026-11-10T09:15:09.521Z — PASS — by qa-engineer

suite-result: 4182/4184 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Phase 0.5 baseline: 3 reds, all on manifest (e349 AC-E349-2, e355 AC-E355-3, e355 AC-E355-4), 0 unexplained; all dispositioned by re-pinning to NEW_BULLET (e355 AC-E355-4 now asserts bare AC7 phrase x1 and four-test span x1; named array unchanged; title reworded). AC1-AC6 proofs executed and green (numstat 1/1; prefixes AC1: 1, AC15: 1, AC19: 1, AC20: 1, AC7 2; e349+e355 6/6; scope diff empty). Full suite 4182/4184 pass, 0 fail. check:bookkeeping OK, agc check OK. See qa_reports/review_T-E421-01.md (Expected-Red Diff, AC Execution Log).


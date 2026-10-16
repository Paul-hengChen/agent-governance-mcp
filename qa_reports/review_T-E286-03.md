covers: T-E286-01, T-E286-02, T-E286-03

# QA review — E286 (T-E286-01..03)

Verdict: PASS. Code review: `review_reports/review_T-E286-01.md` (round 2 APPROVED, commit 2f2094d).
Tested HEAD (full suite): a8ee86100de0bffbc270a5bbe3286f8a4e5c3b27, clean tree before and after.

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Phase 3.5: AC proofs run below.
Phase 1 (3a Copy / 3b Visual): Copy strings verified verbatim by the test (headings, conditions, deciders sentence, lp heading, E282 sentence); Visual Tokens N/A.
Phase 3 placement: dispatch brief pre-authorized `test/e286-integrator-trust-and-git.test.mjs`.

## AC → test map (test/e286-integrator-trust-and-git.test.mjs, 10 tests, all green)
- AC1: "base-fix subsection sits inside Stage 4..." ; "human owns the vehicle decision; five conditions ordered numbered list"
- AC2: "conditions 2 and 4 failing means stop..." ; "Decision rights gains the base-fix row; pinned rows kept" (+ e178a AC12 green)
- AC3: "Git operations names the base-fix merge and rules merge-tree read-only"
- AC5: "section 7 is the last section ..." ; AC6: "E282 merge-base scope sentence"
- AC7: "lane-session approval ... three-part test" (written-back-and-approved-in-lane is NOT re-asked, per revision §4 O10 table / review C1; pinned sentence unchanged; e178a AC10 green)
- AC8: deciders sentence; AC9: no `_mailbox/*/` glob, own-manifest watch, lane-status for another manifest
- AC4 / AC10: evidence only (below). Shipped-text pins also follow review C2 (`merge-invariants.mjs HEAD <worktree>`, tested via item-5 regex on `merge-invariants.mjs`) and C3 (`origin/<目標分支>...HEAD` is in the lane §7 text; test pins `...HEAD`).

## AC Execution Log
- AC4: `git diff --quiet "$(cat .current/e286/base-sha)"...HEAD -- content/const-15-core-tail.md content/constitution-rationale.md test/fixtures/compose-golden test/context-budget.test.mjs; echo exit=$?` → `exit=0`. PASS.
- AC10: `node --test test/e178a-integrator-role.test.mjs test/e177a-manifest.test.mjs test/e246-mailbox-teardown.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e297-main-protected-sop.test.mjs test/e130-lane-default.test.mjs test/e177b-mailbox-watch.test.mjs test/render-structure.test.mjs` → tests 153, pass 150, fail 0, skipped 3 (history-dependent guards). PASS, no re-pin needed.
- AC2/AC7 named-test proofs: e178a AC12 / AC10 included in the run above (17 pass, 0 fail, 1 skip in e178a).
- AC11: `node scripts/test-lock.mjs -- npm test` on HEAD a8ee861 → exit 0; tests 3195, pass 3192, fail 0, skipped 3; `git status --porcelain` empty. PASS.

## Re-pins
None. No owned test turned red.

## e178a AC6 historical (the `3c72a83` const-15 §6 added-lines guard)
Judged: needs no change. const-15 is untouched this lane (AC4 diff exit 0). In this clone `3c72a83` is not resolvable, so the guard loud-skips by design (`HISTORY-DEPENDENT AC SKIPPED`); where resolvable, the diff vs the fixed base is unaffected by this lane.

## Notes
Review round 2 left two optional trim notes only; not QA scope.
## 2026-10-16T07:19:26.786Z — PASS — by qa-engineer

PASS. AC1-AC9 pinned by test/e286-integrator-trust-and-git.test.mjs (10 tests); AC4 base-sha diff exit=0; AC10 owned tests 150 pass/0 fail/3 skip, no re-pin; full suite on a8ee861: 3192/3195 pass, 0 fail, 3 skipped (history-dependent), clean tree. e178a AC6 historical (3c72a83) needs no change: const-15 untouched. Evidence: qa_reports/review_T-E286-03.md; code review: review_reports/review_T-E286-01.md.


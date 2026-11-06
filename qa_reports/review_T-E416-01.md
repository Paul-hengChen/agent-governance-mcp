covers: T-E416-01, T-E416-02

# QA review — e416-ticket-filing-bar

## Phase 1 review
Wording diff read against the backlog row E416 (spec). Filing bar present at coord-03 (Filing bar paragraph + E179 sentence), code-reviewer Finding tiers, integrator 5c-1 / 5b-5 / 5b-8 / stage-6 step 4, lane-protocol §4 + final-report template, and the repo-only CLAUDE.md bullet. No Copy/Strings or Visual Tokens H2 applies (wording-only, no UI). Phase 1.5: skipped (no Visual Baselines declared). Phase 3.5: skipped (no proof:-annotated ACs; the spec is a backlog row).

## Expected-Red Diff
Manifest: qa_reports/expected-red_e416-ticket-filing-bar.txt (1 entry: test/skill-manifest.test.mjs | t-golden-byte-identity).
- Reds observed before re-baseline (sr/reviewer full-suite run at 96c1d88): t-golden-byte-identity (manifest entry, confirmed red); e108-eject.test.mjs:952 (not on manifest).
- t-golden-byte-identity: disposition — expected; golden diff was only the coord-03 hunk. Re-captured via `npm run build && node scripts/capture-constitution-golden.mjs`; only test/fixtures/compose-golden/skill-coordinator-monolith.txt changed (+3/-1, exactly the Filing bar paragraph + E179 sentence); the other 11 fixtures byte-identical. Now green.
- e108-eject.test.mjs:952: disposition — spawn-timeout load flake reported by the reviewer (file alone 35/35). Did NOT recur in my full run (0 fail), so classified flake, unrelated to this wording diff.
Phase 0.5: clean after disposition (1/1 manifest entries confirmed red, 0 unexplained reds).

## Teamwork bundle cap decision
Re-measured: 21526 ~tok (reviewer figure; the context-budget test passes at the unchanged cap) vs cap 21715 -> 189 ~tok headroom. The cap rule in test/context-budget.test.mjs ("exact re-measured values, zero headroom") applies when a change re-baselines a cap; the test is green, so no edit. Cap left at 21715. (The "zero headroom" claim in the E416 row refers to the cap's history, not the present margin.)

## AC -> test map (test/e416-filing-bar.test.mjs, 8 tests)
1. coord-03 Filing bar: both admit conditions, same-ticket fix, report-only notes.
2. coord-03 E179 sentence files only findings clearing the bar; bar precedes it.
3. code-reviewer Finding tiers: diff-introduced = required; non-blocking tiers report-only.
4. integrator 5c-1 full bar inline.
5. integrator 5b-5 / 5b-8 / stage-6: >= 3 "owning lane, never a new ticket" clauses + human fallback.
6. integrator no longer contains "or a new ticket".
7. lane-protocol §4 門檻 bullet + final-report line.
8. CLAUDE.md repo-only bullet.
Pins collapse whitespace and use regexes tolerant of wrapping. Coverage: tests are text pins on docs; line coverage not applicable.

## Phase 4 run
Build zero errors. `node scripts/test-lock.mjs -- npm test`: 4059/4061 passed, 0 fail, 2 skipped. `npm run check:bookkeeping` OK. `node scripts/check-md-tables.mjs` OK (0 malformed).

## Recommended / optional observations (report-only, no tickets)
- optional: the reviewer's two optional findings stay as recorded in review_reports/review_T-E416-01.md.
- optional: the cap comment in context-budget.test.mjs ("zero headroom") overstates the current margin; no action required.

Verdict: PASS.
## 2026-11-06T11:41:32.531Z — PASS — by qa-engineer

suite-result: 4059/4061 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. Golden skill-coordinator-monolith re-captured (only coord-03 hunk). Bundle 21526 <= cap 21715, cap unchanged (green, not re-baselined). 8 new pins in test/e416-filing-bar.test.mjs. Expected-Red Diff clean; e108-eject:952 flake did not recur. check:bookkeeping and check-md-tables OK. Optional observations in review doc only.


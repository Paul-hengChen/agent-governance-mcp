covers: T-E406-01, T-E406-02, T-E203-01, T-E203-02

# QA review — e406-release-and-merge-scripts (E406 + E203)

Code review round 2 APPROVED (review_reports/review_T-E203-01.md, review_reports/review_T-E406-01.md).

## Expected-Red Diff

Manifest: qa_reports/expected-red_e406-release-and-merge-scripts.txt (27 entries, all in test/e394-release-script.test.mjs).
Method note: the code reviewer recorded the pre-re-pin red set as exactly the 27 manifest entries on the implementation
commit; QA then re-pinned the e394 fixture and ran the whole file (65 tests, 0 failing). Every entry is dispositioned below.

- 25 entries (AC-R10 exit codes; AC-S2 x2; AC-S1 x2; AC-S5; AC-S6 x4; AC-S7 x5; AC-S9; L:E9; L:E14/E78/E80; L:E163; L:E297; L:E125c; L:E65; L:E45/E46; L:E49; L:E50): now green. Cause was the untracked content/foo.md no longer swept into the release commit, so the CHANGELOG citation stopped at exit 31; fixed by the re-pin (buildTemplate commits content/foo.md, workTree edits it). Safe to drop.
- AC-S3 verb allow-list and array argv: now green. ALLOW gained /^git add --update -- \S/.
- L:E71b a status path with spaces: now green. The spaced path is committed then edited, so it is a tracked change handed to `git add --update`; the unplanned-untracked variant is covered by the new E406 AC-E406-1 case.
- Extras (red but not on manifest): none. Missing (on manifest, not red): see above, all turned green by the re-pin, none by weakening an assertion.

Phase 0.5: clean after re-pin (27/27 manifest entries confirmed green, 0 unexplained reds).

## Spec-to-Test Map

| AC | test |
|---|---|
| AC-E406-1 | test/e394-release-script.test.mjs "E406 AC-E406-1 ..." (scratch repo, untracked docs/ file warned, not committed, still untracked, exit 0, one warning line) |
| AC-E406-2 | "E406 AC-E406-2 ..." (recorded argv: one add --update, one exact-path add, no directory without --update, unplanned path never passed) |
| AC-E406-3 | "E406 AC-E406-3 ..." (active spec, 7a move destination, fresh root evidence file, .current/.config.json, Multi-feature spec all committed; 8a-3 passes) |
| AC-E406-4 | "E406 AC-E406-4 ..." plus existing AC-S6 staging stops and L:E94 (unchanged, green) |
| AC-E406-5 | AC-R11 (added admitted/refused shapes) and AC-S3 (ALLOW gains add --update) |
| AC-E406-6 | "E406 AC-E406-6 ..." (dry-run: snapshot unchanged, shapes recorded, same warning) |
| AC-E406-7 | "E406 AC-E406-7 ..." (exit 13 on untracked root stray file); e166/e130/e405 pins run in the full suite |
| AC-E203-0 | proof: grep of the (c) line, verified by QA (see AC Execution Log) |
| AC-E203-1 | test/e203-merge-invariants-union.test.mjs AC-E203-1 |
| AC-E203-2 | test/e126-merge-invariants.test.mjs "R-1 5-vs-4 fixture" (unchanged, green) |
| AC-E203-3 | e203 file AC-E203-3 |
| AC-E203-4 | e203 file AC-E203-4 |
| AC-E203-5 | full e126 file green unchanged; build leaves no dist diff (see below) |
| AC-E203-6 | e203 file AC-E203-6 |
| AC-E203-7 | e203 file AC-E203-7 |

The cherry-pick-shaped false negative is an accepted spec-stated limit (human ruling); no test asserts its outcome.
Test hygiene: no historical sha pins, no fixed base-sha diff, no growing real specs/fanout-* assertions, no absolute local paths in durable text.
test/release-staging.test.mjs: unchanged (85/85 green; the pure function still fails on a plan-named leftover, so AC2 Shape 2 holds as written).

## AC Execution Log

- AC-E203-0: `grep -n "only when BOTH (i)" specs/e126-merge-invariants.md` printed line 112 (the (c) paragraph). PASS.
- AC-E203-2: `node --test --test-name-pattern "R-1 5-vs-4 fixture" test/e126-merge-invariants.test.mjs` pass 1, fail 0. PASS.
- AC-E203-1/3/4/6/7: `node --test test/e203-merge-invariants-union.test.mjs test/e126-merge-invariants.test.mjs` pass 21, fail 0. PASS.
- AC-E406-1/2/3/4/6/7 and AC-E406-5: `node --test test/e394-release-script.test.mjs` pass 65, fail 0, skipped 0. PASS.
- AC-E406-7 pins: `node --test test/e166-template-defers-staging.test.mjs test/e130-lane-default.test.mjs test/e405-release-runner.test.mjs` pass 45, fail 0. PASS.
- test/release-staging.test.mjs: pass 85, fail 0.
- Full-suite, build/dist, audit, bookkeeping and agc check results are recorded in the server-recorded qa_review section below.

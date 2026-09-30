Verdict: CHANGES_REQUESTED

# Review — integ/e258 comment check (e258a diff, SOP step 4b)

Scope: branch `integ/e258` at HEAD 94ae9a3. I applied the *Comment discipline* bullet (content/const-15-core-tail.md:29-34, as shipped) to every comment that `git diff main...feat/e258a-comment-rule -- test/` adds, and judged each `agc check — comments` warning attributable to that diff. I re-ran `node bin/agc-init.mjs check` myself and got the same 7 warnings in 3 files that the dispatch listed. The rule prose and the scan code are out of scope.

Block lengths on `main` come from counting consecutive `//` lines in `git show main:test/context-budget.test.mjs`. Each flagged context-budget block was already over the 7-line limit before e258a (37, 32, 247, 23 lines). e258a added 2-3 lines to each.

| # | Warning | Decision | Reason / trim |
|---|---|---|---|
| 1 | test/context-budget.test.mjs high-ratio 74.4% | KEEP | e258a's net addition is 8 comment lines in a 2341-line file. That barely moves a ratio that was already about 74% on main. The ratio comes from the file's long-standing budget re-baseline ledger (every past cap raise adds an entry), not from this diff. |
| 2 | test/context-budget.test.mjs:353 long-block 39 | KEEP | The block was 37 lines on main. e258a added 2 lines (:390-391) giving the WHY for the magic number 5548: what was added, the measured value, zero headroom. That is WHAT+WHY and not HOW. Commit 15cb00e's message does not carry this rationale, so no other home exists to point to. It sits in a test body, next to the assert it justifies, following the file's ledger convention. |
| 3 | test/context-budget.test.mjs:1133 long-block 35 | KEEP | The block was 32 lines on main. e258a added 3 lines (:1165-1167), again the WHY for cap 10057. The third line restates the 2098 margin arithmetic in the ledger's own format. Optional, non-blocking: drop that third line, since the saving is not asserted in this test and it repeats the entry at :2241-2243. |
| 4 | test/context-budget.test.mjs:1432 long-block 249 | KEEP | The block was 247 lines on main. e258a added 2 lines (:1679-1680), the WHY for cap 20434. The 249-line block is a pre-existing ledger problem that e258a did not create, and trimming e258a's 2 lines would not clear the warning. Consolidating the ledger into a spec is a separate backlog item, not this lane's work. |
| 5 | test/context-budget.test.mjs:2218 long-block 26 | KEEP | The block was 23 lines on main. e258a added 3 lines (:2241-2243), the WHY for cap 7959. The margin line matters here because the adjacent assert checks that saving (>= 2080). The two changed trailing comments at :2216-2217 only swap numbers in existing annotations. |
| 6 | test/e258a-comment-rule.test.mjs:1 long-block 16 | SEND BACK | The file is new, so the file's own history can't justify it. The **Spec-to-Test map (lines 4-11) points to test ids that do not exist**: `t-ac1-placement`, `t-ac2-what-why`, ..., `t-boundary-no-control-chars` match nothing in the file. The real tests are titled `"AC1: ..."`, `"AC2 clause 1: ..."`, `"boundary: ..."` (lines 43-148), so the map is inaccurate, and it repeats what the titles already say. Lines 13-16 (the WHY paragraph) are 4 lines of rationale, but line 2 already points to specs/e258a-comment-rule.md, where AC5 states the byte-exact contract. **Trim:** delete lines 3-12 (the map and the `//` spacers) and cut the WHY to one line, e.g. `// WHY: prose rules regress silently; each test pins the contract, and AC5 pins the scan prefix bytes.` That leaves 3-4 lines, under the 7-line limit. Note: a map header like this appears in 79 test files and `// Coded by @qa-engineer` in 149, so keep the authorship line. The map shape is still not the problem; its names are wrong and duplicate the titles. |
| 7 | bin/agc-init.mjs high-ratio 30.5% | NOT RE-JUDGED | Already kept with a reason in review_reports/review_T-E258B-01.md, per the dispatch. |

Other comments e258a added (not flagged by the scan), checked against the bullet:
- test/e258a-comment-rule.test.mjs:32: a one-line WHAT at the head of `bulletOf`. OK.
- test/e258a-comment-rule.test.mjs:87-88: a two-line WHAT/WHY above the `MODES` table, at module scope. OK.
- The golden fixtures under test/fixtures/compose-golden/ are regenerated prose, not code comments. N/A.

Verdict rationale: CHANGES_REQUESTED because of row 6 only. The file-header map in the new test file names test ids that don't exist, and the header is over the limit with rationale that belongs in the spec it already points to. Rows 1-5 are kept: e258a's additions there are short WHY notes on existing blocks that were already over the limit.

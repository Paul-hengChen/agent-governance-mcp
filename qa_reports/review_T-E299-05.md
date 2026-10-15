# Review — T-E299-05

covers: T-E299-01, T-E299-02, T-E299-03, T-E299-04, T-E299-05

Reviewer: qa-engineer (sonnet). code-reviewer round 2 APPROVED T-E299-01..04 in
`review_reports/review_T-E299-01.md` (commit b4894eb). This doc covers the QA pass over that approved
work plus T-E299-05 (tests) itself. Verdict: PASS.

## Expected-Red Diff

Phase 0.5: clean (14/14 manifest entries confirmed red, 0 unexplained reds). Run BEFORE any edit:
`node --test test/check-md-tables.test.mjs` gave 35 pass / 14 fail; the 14 `not ok` names are set-equal to
`qa_reports/expected-red_e299-check-bookkeeping.txt` (the only textual difference is TAP's doubling of one
backslash in CS-ESCAPED-PIPE-ADJACENT, a serialization artefact). After the re-target all 14 PASS
(49/49 in that file); none remains red.

## Phase notes

- Phase 1 copy/visual audit: every message in the spec's Copy / Strings section is asserted verbatim by a
  fixture case (see AC map); no design file, so Phase 1.5: skipped (no Visual Baselines declared).
- Phase 3 placement: dispatch brief pre-authorized `test/e299-check-bookkeeping.test.mjs` (create) and
  `test/check-md-tables.test.mjs` (modify); no other test file touched.
- Coverage: line-coverage tooling not run; every check (1)-(4), exit code 0/1/2 and (5) has a positive and a
  negative fixture case, and the real corpus is run end to end.

## Re-target of check-md-tables (AC11/AC12)

13 "still fires" cases now assert exit 1 + the stderr line `docs/backlog.md:<n> — done-mark **DONE** is buried
mid-cell in the <column> column …`; ADV-ORDER-TABLE also pins the header `check:md-tables — 1 done-mark
position violation(s) (docs/backlog.md E88):`; ADV-NONFATAL-BOTH-DIRECTIONS keeps its name (manifest entry)
but now asserts the fatal contract: mark-only tree exits 1 with only the done-mark list, mark plus malformed
table prints both lists with separate counts. All "stays silent" cases keep exit 0 and now assert the absence of
the stderr violation text (their old stdout "advisory note" negative had become vacuous). CQ-9 rewritten: exit 0,
zero violations, E145 and E39/E40/E58/E59 rows looked up by ticket id and absent from reports. The comment block
above ADV-* now describes the fatal contract. AC7 and WIRING unchanged.

## AC Execution Log

| AC | command / proof | outcome |
|---|---|---|
| AC1 | `node --test test/e299-check-bookkeeping.test.mjs` case ID-DUP | pass |
| AC2 | ID-HEADING-NOT-DUP | pass |
| AC3 | ID-MONO-LOWER, ID-MONO-HIGHER, ID-MONO-SPLIT | pass |
| AC4 | ID-MONO-NO-BASE-NOTE, ID-MONO-BASE-FLAG | pass |
| AC5 | CITE-ROOT-ARCHIVED, CITE-MISSING, CITE-AMBIGUOUS (+ CITE-ORDER-TABLE for the order-table clause) | pass |
| AC6 | CITE-PREDICTED-ARCHIVE-TOLERATED, CITE-WRONG-ARCHIVE-DIR | pass |
| AC7 | CITE-ROOT-TOLERATED, CITE-OPEN-ROW-SKIPPED, CITE-GLOB-SKIPPED, CITE-NO-CROSS-TREE | pass |
| AC8 | QUEUE-MISSING-ROW, QUEUE-SUBID-PARENT (two unrelated parents + parentless negative = generic rule), QUEUE-DASH-ROW-SKIPPED | pass |
| AC9 | QUEUE-TICKED-OPEN, QUEUE-UNTICKED-CLOSED, QUEUE-ALIGNED | pass |
| AC10 | DEC-HEADER, DEC-DATE, DEC-DECIDER-EMPTY, DEC-DECIDER-EXECUTOR, DEC-SOURCE-EMPTY, DEC-NO-SECTION-OK (also untracked manifest skipped), DEC-NO-TABLE | pass |
| AC11 | `node --test test/check-md-tables.test.mjs`: the 14 re-targeted cases + silent cases | 49/49 pass |
| AC12 | `node scripts/check-md-tables.mjs; echo exit=$?` -> `check:md-tables — OK (519 file(s) scanned, 0 malformed tables)`, `exit=0`; case CQ-9 | pass |
| AC13 | WIRING (`pkg.scripts["check:bookkeeping"] === "node scripts/check-bookkeeping.mjs"`), REAL-CORPUS | pass |
| AC14 | ROOT-FROM-SCRIPT-LOCATION (`.current/<lane>/` present, foreign cwd, exit 0) | pass |
| AC15 | EXIT-0-WITH-NOTES, EXIT-1, EXIT-2 (unreadable backlog, unreadable queue, git absent via empty PATH) | pass |
| AC16 | `node scripts/check-bookkeeping.mjs; echo exit=$?` -> `check:bookkeeping — 23 note(s) (non-blocking):` (23 note lines, none an ordering note), `check:bookkeeping — OK (344 ticket row(s), 132 queue row(s), 149 decision row(s) checked)`, `exit=0` | pass |

Extra (reviewer option F4): PREDICATE-PARITY asserts splitRow / findCodeSpanRanges / findCitationQuoteRanges /
findGenuineDoneMark and the two regex constants are identical (comments stripped) in both scripts.

## Full suite (after test commit 0c6e0bd, tree clean except `.current/e299/` sidecars)

`node scripts/test-lock.mjs -- npm test` -> exit 0; runner summary: tests 3082, pass 3079, fail 0, cancelled 0,
skipped 3 (skips pre-existing, unrelated to this feature). New suite: 37 cases, all pass.

## Not verified

- Line-coverage percentage (no tooling run).
- Behaviour in CI with `fetch-depth: 0` and a real `origin/main` ref (AC4 CI clause) — fixtures cover `main`,
  a differently-named branch and `--base`, not a remote.
- The 23-note corpus count is asserted by the AC16 command output here, not pinned in a test (by design).
- Spec AC16 "on primary" run: only the lane worktree was run.
## 2026-10-14T11:25:36.418Z — PASS — by qa-engineer

PASS. Phase 0.5 clean (14/14 expected-red confirmed, 0 unexplained). Tests committed 0c6e0bd: new test/e299-check-bookkeeping.test.mjs (37 cases, AC1-AC10, AC13-AC15 + F4 parity) and 14 check-md-tables cases re-targeted to the fatal E88 contract (CQ-9 rewritten per AC12). Full suite via test-lock: 3082 tests, 3079 pass, 0 fail, 3 skipped (pre-existing). Corpus: check-bookkeeping exit 0 with 23 notes, check-md-tables exit 0. Evidence: qa_reports/review_T-E299-05.md (covers T-E299-01..05, incl. Expected-Red Diff and AC Execution Log). Unverified: coverage %, CI origin/main fetch-depth path, primary-checkout run.


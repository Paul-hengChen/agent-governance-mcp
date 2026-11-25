# QA review — T-E448-01 (e448-judge-evidence-checks)

covers: T-E448-01, T-E448-02, T-E448-03, T-E448-04, T-E448-05, T-E448-06, T-E448-07, T-E448-08, T-E448-09, T-E448-10, T-E448-11, T-E448-12, T-E448-13, T-E448-14, T-E448-15, T-E448-16, T-E448-17, T-E448-18, T-E448-19

Judge: code-reviewer, round 1. Review report: `review_reports/review_T-E448-01.md`.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e448-judge-evidence-checks.txt`, 45 entries (no sr append). Full suite at HEAD 5635f58 (`node scripts/test-lock.mjs -- npm test`, Node 22, exit 0): 4607 tests, 4605 pass, 0 fail, 2 skipped.

- Actual reds: none. Every one of the 45 manifest entries is now green: each is a scenario or re-pin test, built by T-E448-11..17.
- Reds not on the manifest: none, so no regression.
- The 2 skips are not reds: e130 AC4 / AC14 report `HISTORY-DEPENDENT AC SKIPPED: commit 121ddc8 is not resolvable`. They are history-dependent and exist on base too.
- Negative control (base `70d34c6` sources with this branch's test files, built in a scratch copy outside the worktree): the scenario tests the manifest names go red (24 of 40 tests in e448/e451/e452/e459/e460/e434, plus both e431 AC14 tests), confirming they would fail without the fix.

## AC Execution Log

Every command below was run in the lane worktree at HEAD 5635f58 after `npm run build` (no diff against the committed `dist/`). `node --test <file> --test-name-pattern X` with the file first runs the whole file (Node passes trailing options through), so each proof run covers its target tests and their siblings. For AC17, the filtered form `node --test --test-name-pattern AC14 test/e431-…` was also run: 2/2 pass.

| AC | command | raw outcome | verdict |
|---|---|---|---|
| AC1 | `node --test test/e448-*.test.mjs --test-name-pattern "AC1:"` | tests 7, pass 7, fail 0, exit 0 (`ok 1 - AC1: file-mode code-reviewer PASS with no review_reports/ file -> MISSING_REVIEW_EVIDENCE …`) | pass |
| AC2 | `node --test test/e448-*.test.mjs --test-name-pattern "AC2:"` | tests 7, pass 7, fail 0, exit 0 (two AC2 tests ok) | pass |
| AC3 | `node --test test/e448-*.test.mjs --test-name-pattern "AC3:"` | tests 7, pass 7, fail 0, exit 0 (SQLite case ran, not skipped) | pass |
| AC4 | `node --test test/e448-*.test.mjs --test-name-pattern "AC4:"` | tests 7, pass 7, fail 0, exit 0 | pass |
| AC5 | `node --test test/e451-*.test.mjs --test-name-pattern "AC5:"` | tests 2, pass 2, fail 0, exit 0 | pass |
| AC6 | `node --test test/e451-*.test.mjs --test-name-pattern "AC6:"` | tests 2, pass 2, fail 0, exit 0 (`assertionIdle`; red on base in the negative control) | pass |
| AC7 | `node --test test/e452-*.test.mjs --test-name-pattern "AC7:"` | tests 5, pass 5, fail 0, exit 0 | pass |
| AC8 | `node --test test/e452-*.test.mjs --test-name-pattern "AC8:"` | tests 5, pass 5, fail 0, exit 0 | pass |
| AC9 | `node --test test/e452-*.test.mjs --test-name-pattern "AC9:"` | tests 5, pass 5, fail 0, exit 0 | pass |
| AC10 | `node --test test/e452-*.test.mjs --test-name-pattern "AC10:"` | tests 5, pass 5, fail 0, exit 0 | pass |
| AC11 | `node --test test/e434-reviewer-visual.test.mjs --test-name-pattern "AC7:"` | tests 12, pass 12, fail 0, exit 0 (`ok 7 - AC7: … → VISUAL_REPORT_INCOMPLETE naming it (evidence schema v3)`) | pass |
| AC12 | `node --test test/e459-*.test.mjs --test-name-pattern "AC12:"` | tests 12, pass 12, fail 0, exit 0 | pass |
| AC13 | `node --test test/e459-*.test.mjs --test-name-pattern "AC13:"` | tests 12, pass 12, fail 0, exit 0. Additional judge probe: the same qa_review-bearing PASS over a judge report with **no trailing newline** → `⛔ MISSING_EVIDENCE: T1. The last server-recorded verdict for each listed id is not PASS …` (rejected), while the same report ending in `\n` → accepted | **fail** (proof green; the scenario fails on a no-trailing-newline report, finding R1) |
| AC14 | `node --test test/e459-*.test.mjs --test-name-pattern "AC14:"` | tests 12, pass 12, fail 0, exit 0 | pass |
| AC15 | `node --test test/e459-*.test.mjs --test-name-pattern "AC15:"` | tests 12, pass 12, fail 0, exit 0 | pass |
| AC16 | `node --test test/e459-*.test.mjs --test-name-pattern "AC16:"` | tests 12, pass 12, fail 0, exit 0 | pass |
| AC17 | `node --test test/e431-test-first-server-path.test.mjs --test-name-pattern "AC14"` | tests 39, pass 39, fail 0, exit 0; filtered form: tests 2, pass 2 | pass |
| AC18 | `node --test test/e460-*.test.mjs --test-name-pattern "AC18:"` | tests 2, pass 2, fail 0, exit 0 (file and SQLite) | pass |
| AC19 | `node --test test/e448-*.test.mjs --test-name-pattern "AC19:"` | tests 7, pass 7, fail 0, exit 0. Independent script check: all 21 Copy `hint.*` rows equal `GATE_REGISTRY[*].hintStatic` (drift 0) | pass |
| AC20 | `node --test test/e448-*.test.mjs --test-name-pattern "AC20:"` | tests 7, pass 7, fail 0, exit 0. Independent scan of all 33 hints: 0 repo paths, 0 ticket ids | pass |
| AC21 | `node scripts/test-lock.mjs -- npm test; npm audit --audit-level=high; echo "exit=$?"` | suite: tests 4607, pass 4605, fail 0, skipped 2, exit 0. audit: `7 vulnerabilities (1 low, 6 moderate)`, exit=0. `wc -l CLAUDE.md` = 250. `git diff --name-only 70d34c6...HEAD` touches no content/**, compose goldens, context-budget test, tools/registry.ts, tools/transitions.ts, schema/**, prompts/templates/bin/scripts/docs, adapter stamps, README/CHANGELOG/CONTRIBUTING, and adds no tools/*.ts. The `hasDesignModeRequiringVisual` import line is unchanged. `npm run build` leaves `git status` with no dist/ change, and `npx tsc --noEmit` exit 0 | pass |

Round-1 result: AC13 fails (R1). Every other AC passes.
## 2026-11-25T08:21:05.060Z — FAIL — by code-reviewer

suite-result: 4605/4607 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Round 1 — CHANGES_REQUESTED (covers T-E448-01..T-E448-19). Review report: review_reports/review_T-E448-01.md. Judge report: qa_reports/review_T-E448-01.md.

REQUIRED R1 (test defect + implementation defect, AC13, T-E448-03 / T-E448-14). gates/qa-review.ts:139-147 recordReviewInFileUndoable appends `## <ts> — PASS — by code-reviewer` straight onto the existing report with no leading newline. The new SERVER_VERDICT_HEADING_RE (tools/evidence-file.ts) needs that heading at the start of a line. When the judge's hand-written qa_reports/review_<id>.md (Expected-Red Diff / AC Execution Log) does not end with a newline, the heading lands mid-line. The standing stays none, and step 13 refuses the PASS with `⛔ MISSING_EVIDENCE: T1. The last server-recorded verdict for each listed id is not PASS ...`. The pipeline then undoes the append, so a retry fails the same way. Reproduction on the built lane dist: report "# QA review — T1\n\nAll scenarios exercised.\n" -> accepted; the same text without the final \n -> rejected. On base the PASS was accepted, so this diff introduced the regression; lane-status reads the same predicate. Fix route: qa-engineer adds a red AC13 case in test/e459-pass-evidence-rule.test.mjs (FAIL-standing or verdict-less report with no trailing newline; PASS with qa_review + review_task_ids accepted; lane-status credits the result), then sr-engineer makes the appender in gates/qa-review.ts start its section on a new line (prefix \n when the existing non-empty file does not end with \n; the undo truncation to preSize stays correct).

Everything else is clean. All 21 Copy hint rows match verbatim (script check); AC20 scan finds 0 offenders; registry 33 / pipeline 17 in the same order; hasEvidenceInFile byte-identical; hasDesignModeRequiringVisual import untouched; scope limited to the owned set; dist matches a fresh build; tsc clean; CLAUDE.md 250 lines; E434 AC7 asserts server behaviour; the E451 test uses assertionIdle. Negative control on base sources: every primary scenario test is red. Expected-red: all 45 entries now green, no unlisted red. Optional, non-blocking: the re-pin comments in tests carry ticket ids, which follows the existing test convention.


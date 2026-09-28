# QA review — T-REL4-01 (release-v4.0.0 evidence-only release gate)

## Phase 0 — Claim
Single-role judge dispatch (Constitution §3.1), `resume_of: qa-engineer`. Cut
approved by human (`cut_approved: true` on the PM's `pm:In_Progress` write).
Re-verifying PM's own AC1-AC4 claims in `specs/release-v4.0.0.md` independently
against the committed main tree at HEAD `c42c0db`, tree clean before this
session's own governance writes.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_release-v4.0.0.txt` manifest declared;
`dispatch_mode` unset — feature mode).

## Phase 1 — Review

### Copy Audit Gate
N/A — spec's Copy/Strings table declares zero user-facing strings
(evidence-verification only ticket).

### Visual Audit Gate
N/A — spec's Visual Tokens table declares zero visual literals. **However**,
see the AC2 finding below: the markdown table carrying that very "N/A" row
(`specs/release-v4.0.0.md` line 91) is itself malformed (3 cells vs. a
4-column header) — an artifact of the spec's own authoring, caught only by
running the real-corpus test, not by reading the table by eye.

## Phase 1.5 — Visual Compare
Skipped (no `design/release-v4.0.0.md`; `## Mode` not armed per spec
Dependencies).

## Phase 3 — Tests
Skipped per dispatch brief: "T-REL4-01 is verification-only; do not create or
edit any test file." No test-coverage gap identified — the failures below were
caught by *existing* tests (`test/check-md-tables.test.mjs`,
`test/e177b-test-lock.test.mjs`), not a missing-coverage gap.

## Phase 3.5 — AC Execution Log

All four spec ACs carry `proof:` annotations. Commands re-run independently
(not trusting PM's own re-verification claim in the spec):

### AC1 — ten-lane evidence + PASS/APPROVED verdicts
For each of the ten rows in the spec's AC1 table, ran
`grep -n -i verdict <qa_reports path>` (or read the auto-appended PASS record
where the literal word "verdict" wasn't the exact match) and, where a
code-review column is not `—`, `grep -n -i verdict <review_reports path>`;
plus `grep -E '^(status|last_agent):' .current/history/2026-09/<lane>/handoff.md`
for all ten lanes. Also confirmed all twelve cited merge commits
(`75cdfd6 18c625f 9425ea6 acfdc09 663d50d 96c4123 5f9a21c fcfef80 aafa0d2
749f68f 81056a6 7a2625a`) are ancestors of HEAD via
`git merge-base --is-ancestor <c> HEAD`.

| lane | qa verdict | code-review verdict | lane handoff | result |
|---|---|---|---|---|
| e204 | PASS (`qa_reports/review_T-E204-01.md:162`) | — (no code hop, as declared) | PASS/qa-engineer | OK |
| e180 | PASS (`qa_reports/review_T-E180-05.md` `## Verdict`, covers 01-05) | APPROVED (`review_reports/review_T-E180-01.md:14`) | PASS/qa-engineer | OK |
| e177a | PASS (`qa_reports/review_T-E177A-06.md:89`, covers 01-07) | Round 1 CHANGES_REQUESTED -> Round 2 APPROVED (`review_reports/review_T-E177A-01.md`) | PASS/qa-engineer | OK |
| e177b | PASS (`qa_reports/review_T-E177B-05.md:225-227`, covers 04-06) | APPROVED (`review_reports/review_T-E177B-05.md:206-207`) | PASS/qa-engineer | OK |
| e212 | PASS (`qa_reports/review_T-E212-01.md:144-147`) | — (no code hop, as declared) | PASS/qa-engineer | OK |
| e213 | PASS (`qa_reports/review_T10.md:216`, covers T01,T02,T04,T08,T09,T10) | APPROVED (`review_reports/review_T01.md:14`) | PASS/qa-engineer | OK |
| e130 | PASS (`qa_reports/review_T-E130-09.md:7`) | APPROVED (`review_reports/review_T-E130-09.md:66`) | PASS/qa-engineer | OK |
| e178b | PASS (`qa_reports/review_T-E178B-05.md:35-37`, covers 01-05) | Round 1 CHANGES_REQUESTED -> Round 2 APPROVED (`review_reports/review_T-E178B-01.md`) | PASS/qa-engineer | OK |
| e223 | PASS (`qa_reports/review_T-E223-01.md:49-53`, covers T-E223-01/02) | APPROVED (`review_reports/review_T-E223-01.md:9`) | PASS/qa-engineer | OK |
| e178a | PASS (`qa_reports/review_T-E178A-06.md:5-7`, covers 01-07) | Round 1 CHANGES_REQUESTED (missing expected-red manifest) -> Round 2 APPROVED (`review_reports/review_T-E178A-01.md`) | PASS/qa-engineer | OK |

**AC1: PASS.** Every lane's evidence file resolves as the spec claims; every
cited merge commit is a real ancestor of HEAD.

### AC2 — full suite exits 0, zero failures
`node scripts/test-lock.mjs -- npm test` (as directed):
```
# tests 2817
# suites 1
# pass 2814
# fail 3
# cancelled 0
# duration_ms 137200.5
```
Wrapper exit code: **1**. Three failures:
1. `test/check-md-tables.test.mjs` — "AC7 (real corpus...)" — FAILS
   deterministically: `node scripts/check-md-tables.mjs` (run standalone,
   confirmed) reports `specs/release-v4.0.0.md:91 — row has 3 cell(s), header
   declares 4` — the Visual Tokens table's `N/A` row (`| N/A | — | feature has
   no visual literals |`) is missing its 4th (`source`) cell against the
   4-column header on line 89. This is a real, newly-introduced defect in
   `specs/release-v4.0.0.md` itself (committed at `c42c0db`, this ticket's own
   spec), not test-infra flake.
2. `test/check-md-tables.test.mjs` — "CQ-9 (real corpus, non-regression...)" —
   same root cause (same script invocation, same malformed table), second
   assertion in the same real-corpus run.
3. `test/e177b-test-lock.test.mjs` — "AC13b: SIGKILLing the wrapper..." —
   failed with `waitFor: timed out` under full-suite CPU contention.
   Re-ran `test/e177b-test-lock.test.mjs` in isolation (also test-lock
   wrapped): **19/19 pass, 0 fail**, including AC13b. Disposition: pre-existing,
   load-contention flake (this file's own AC13a companion test and other
   lanes' evidence, e.g. `qa_reports/review_T-E130-09.md`, explicitly track
   and check for "e177b flake" as a known phenomenon under full-suite
   parallelism) — not a regression, not dispositioned away as a pass.

**AC2: FAIL.** Two of the three failures are a genuine, reproducible defect
(malformed markdown table in the release spec itself), not a flake. The full
suite does not exit 0 with zero failures on the committed tree.

### AC3 — dist/ byte-identical to a fresh build
```
npm run build   -> exit 0
git status --porcelain dist/   -> (empty)
```
**AC3: PASS.**

### AC4 — execution-plan §9 checklist state
`docs/v4.0.0-execution-plan.md` lines 1249-1266 (`## 9. v4.0.0 的完成定義`):
counted 15 `[x]` lines followed by exactly 1 `[ ]` line — the final item
"全套測試綠、`agc check` — OK (4.0.0) exit 0、`verify-release` 六項全過"
remains unchecked, exactly as the spec claims.
**AC4: PASS.**

## Phase 4 — Run / Verdict

AC1: PASS. AC2: **FAIL**. AC3: PASS. AC4: PASS.

**Verdict: FAIL.** The release cut is not evidence-clean: `specs/release-v4.0.0.md`
line 91 (the "Visual Tokens" table's `N/A` row) is a malformed markdown table
— 3 cells against a 4-column header — which two real tests in
`test/check-md-tables.test.mjs` (AC7, CQ-9) correctly catch on the real-corpus
run. This is a defect in the spec document this very ticket introduced
(commit `c42c0db`), not in any of the ten already-shipped lanes, and not in
any test file. Per this ticket's own scope (evidence-only, no code changes),
QA does not hand-edit `specs/release-v4.0.0.md` to fix the table — that is a
one-line PM fix (add the missing 4th cell, e.g.
`| N/A | — | — | feature has no visual literals |`), followed by a clean
re-run of `npm test` before this gate can PASS. The third failure
(`test/e177b-test-lock.test.mjs` AC13b) is a confirmed, disposition-able
load-contention flake (19/19 pass in isolation) and is not itself blocking,
but is recorded here for completeness since AC2 requires zero failures on the
one full-suite invocation this ticket calls for.

No `tw_complete_task` call issued. `T-REL4-01` stays open (it was never
completed, so no rollback of a completed state was needed — it is FAILed in
place). `T-REL4-02` (doc-writer) stays open per assignment; its
`depends_on: T-REL4-01` means it should not be dispatched until this FAIL is
resolved and a subsequent PASS lands.
## 2026-09-27T11:33:48.118Z — FAIL — by qa-engineer

FAIL — AC1 PASS (all 10 lanes' qa/code-review/handoff evidence independently re-verified, all 12 merge commits confirmed ancestors of HEAD), AC3 PASS (build clean, dist/ porcelain empty), AC4 PASS (execution-plan §9: 15 [x] + 1 [ ]). AC2 FAIL: node scripts/test-lock.mjs -- npm test = 2814/2817 pass, 3 fail, exit 1. Two failures (test/check-md-tables.test.mjs AC7 + CQ-9) are a genuine, reproducible defect — specs/release-v4.0.0.md:91 (Visual Tokens table's N/A row) has 3 cells against its own 4-column header, introduced by this ticket's own PM cut (c42c0db). Confirmed standalone via node scripts/check-md-tables.mjs. The third (test/e177b-test-lock.test.mjs AC13b, waitFor timeout) is a confirmed load-contention flake, not a regression — re-ran that file alone under the same test-lock wrapper: 19/19 pass. Per this ticket's evidence-only scope, QA does not hand-edit the spec table. Fix is a one-line PM edit (add the missing 4th cell to specs/release-v4.0.0.md:91), then a clean npm test re-run, before this gate can PASS. Full detail: qa_reports/review_T-REL4-01.md.

## Round 2 — resume after PM fix (commit 7e71fc8)

### Phase 0 — Claim (round 2)
`resume_of: qa-engineer` honored via the Amend-Resume Edge
(`pm:In_Progress` → `qa-engineer:In_Progress`). Confirmed on the committed
tree: `git status` clean, HEAD = `7e71fc8`, and
`git diff --stat c42c0db..7e71fc8` shows exactly 4 touched paths —
`specs/release-v4.0.0.md` (2 lines), `qa_reports/review_T-REL4-01.md` (the
round-1 evidence file itself, +146), and the two governance bookkeeping
files (`.current/_primary/handoff.md`, `.current/_primary/dispatch.jsonl`).
`git diff c42c0db..7e71fc8 -- specs/release-v4.0.0.md`:
```
-| N/A | — | feature has no visual literals |
+| N/A | — | — | feature has no visual literals |
```
Exactly the one-line 4th-cell fix PM's `pending_notes` claimed — the
Visual Tokens `N/A` row at line 91 now has 4 cells against the 4-column
header at line 89. No other spec content changed.

### AC1, AC3, AC4 re-anchor (round 2)
Re-anchored per assignment (HEAD moved only by the one PM commit, no
lane/build-affecting content touched):
- **AC1**: unaffected by this diff (no lane evidence files, no merge-commit
  refs touched) — **PASS**, unchanged from round 1.
- **AC3**: `npm run build` → exit 0; `git status --porcelain dist/` → empty.
  **PASS**.
- **AC4**: `docs/v4.0.0-execution-plan.md` lines 1249-1266 — still 15 `[x]`
  + exactly 1 `[ ]` (the final "全套測試綠..." item). **PASS**, unchanged.

### AC2 — full suite re-run (round 2)
Standalone table check first (fast confirmation the fix landed):
```
node scripts/check-md-tables.mjs
check:md-tables — OK (353 file(s) scanned, 0 malformed tables)
exit=0
```
(The 4 pre-existing advisory notes on `docs/backlog.md` done-mark
convention are unrelated, non-blocking, and pre-date this ticket.)

Fresh full run (run 1 of round 2), per assignment:
```
node scripts/test-lock.mjs -- npm test
# tests 2817
# suites 1
# pass 2817
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 139021.395166
```
Wrapper exit code: **0**. All 2817 tests pass, including
`test/check-md-tables.test.mjs` (AC7, CQ-9 — both now green against the
fixed spec table) and `test/e177b-test-lock.test.mjs` (AC13b — the round-1
E224 load-contention flake did NOT recur under full-suite contention this
time; no second run was needed since the first run was already clean).

**AC2: PASS.**

### Phase 4 — Verdict (round 2)
AC1: PASS. AC2: PASS. AC3: PASS. AC4: PASS.

**Verdict: PASS.** PM's one-line fix at `specs/release-v4.0.0.md:91`
resolved the malformed Visual Tokens table row; the full suite now exits 0
with 0 failures (2817/2817), the build is clean with an empty `dist/`
porcelain diff, and the execution-plan §9 checklist state is unchanged
(15 `[x]` + 1 `[ ]`, as the spec claims). `T-REL4-01` is evidence-clean.
`T-REL4-02` (doc-writer, `depends_on: T-REL4-01`) is now unblocked but is
release-engineer/doc-writer's next hop, not qa-engineer's — left open,
`next_role` unset per assignment.

## 2026-09-27T11:44:25.175Z — PASS — by qa-engineer

Round 2 PASS. PM's one-line fix (specs/release-v4.0.0.md:91, commit 7e71fc8) resolved the malformed Visual Tokens N/A row (3 cells -> 4 cells). Re-anchored AC1/AC3/AC4 (unchanged from round 1: all PASS); AC2 fresh full run: node scripts/test-lock.mjs -- npm test = 2817/2817 pass, 0 fail, exit 0 (E224 flake did not recur, single run sufficed). Full detail: qa_reports/review_T-REL4-01.md Round 2 section.


# QA Review — T-E258A-02
covers: T-E258A-01, T-E258A-02

Lane e258a, feature e258a-comment-rule. Code review of T-E258A-01: APPROVED (`review_reports/review_T-E258A-01.md`).

## Expected-Red Diff
Run on the committed tree at 785b113 (clean apart from handoff bookkeeping), BEFORE any re-baseline edit: `npm test` -> 2958 tests, 2940 pass, 15 fail.
Phase 0.5: clean (15/15 manifest entries confirmed red, 0 unexplained reds).
- 11 x `test/compose-equivalence.test.mjs` (8 build goldens, 2 hook goldens, cat(15 fragments) monolith): all on the manifest.
- 4 x `test/context-budget.test.mjs` (AC2 lean, AC8 design-arm constitution, AC8 teamwork bundle, AC8 non-design): all on the manifest.
After re-baseline all 15 are green (see AC6/AC7 below).

## Phase 1 / 1.5 / 3a-3b
- Copy Audit: both Copy/Strings rows honoured (bullet lead `- **Comment discipline**:` at 6 lines; reviewer line matches the spec text verbatim). No unlisted user-facing string.
- Phase 1.5: skipped (no Visual Baselines declared). Visual Tokens / Widgets: N/A.

## Golden regeneration (AC6)
`npm run build` (via prebuild) then `node scripts/capture-constitution-golden.mjs` (scripts untouched). 12 fixtures captured; 11 changed, `skill-coordinator-monolith.txt` unchanged.
The script covers the single-file monolith that the "cat(15 manifest fragments)" test compares (`constitution-monolith.txt`), so no hand edit was needed.
`git diff -U0 test/fixtures`: 66 insertions, 0 deletions; every changed file gains exactly the same 6 lines (the Comment discipline bullet) and nothing else. No reviewer-step text appears in any golden (the reviewer SOP is not part of a constitution fixture).

## Budget ceilings (AC7, R2: zero headroom)
| test | old ceiling | new ceiling = measured | 
|---|---|---|
| AC2 lean always-on | 5415 | 5548 |
| AC8 design-arm rationale-stripped constitution | 9924 | 10057 |
| AC8 teamwork coordinator bundle | 20310 | 20434 |
| AC8 non-design constitution | 7826 | 7959 |
Measured values come from the failing assertion messages on the pre-edit tree (5548, 10057, 20434, 7959); deltas: +133, +133, +124, +133 ~tok in table order.
No other ceiling in the file was touched (only the four that failed).
Zero-headroom proof: with the new ceilings `node --test test/context-budget.test.mjs` = 54/54 pass; lowering each raised ceiling by 1 byte-token (5547, 10056, 20433, 7958), one at a time, makes exactly that one test fail (1 fail each), then restored.

## Spec-to-Test Map
| AC | test (`test/e258a-comment-rule.test.mjs` unless noted) |
|---|---|
| AC1 | AC1: bullet sits immediately after Generic citation... |
| AC2 | five tests, one per clause (AC2 clause 1..5) |
| AC3 | AC3 x4 modes via composeConstitution (lite/chain x design/non-design) + AC3 teamwork buildPromptForRole |
| AC4 | AC4: no jargon, ticket id or untracked path |
| AC5 | AC5 byte-exact prefix (em dash bytes e2 80 94, near-miss variants absent); AC5 check text |
| AC6 | `test/compose-equivalence.test.mjs` 14/14 pass |
| AC7 | `test/context-budget.test.mjs` 54/54 pass |
| AC8 | `npm test` on the clean committed tree (result below) |
| AC9 | path listing below |
Security smoke: single-bounded-paragraph check and control-character check on the bullet and the reviewer line.
Coverage: content (Markdown) only; no executable source changed, line coverage not applicable.

## AC Execution Log
- AC1: `awk '/^- \*\*Generic citation\*\*/{g=1} g&&/^- \*\*/{print NR": "substr($0,1,40)}' content/const-15-core-tail.md` -> `23: - **Generic citation**...`, `29: - **Comment discipline**...`, then section 7 bullets from 38. New bullet second. PASS.
- AC2/AC3/AC4/AC5: `node --test test/e258a-comment-rule.test.mjs` -> 16 tests, 16 pass, 0 fail. PASS.
- AC5: `grep -c 'agc check — comments' content/skill-code-reviewer.md` -> 1. PASS.
- AC6: `node --test test/compose-equivalence.test.mjs` -> 14 pass, 0 fail (spec names `compose-golden*.test.mjs`; no such file exists, the golden test is `test/compose-equivalence.test.mjs`). PASS.
- AC7: `node --test test/context-budget.test.mjs` -> 54/54; lowering each raised ceiling by 1 fails it. PASS.
- AC8: see Final run below.
- AC9: `git diff --name-only 2484ede...HEAD` at 785b113 (before this ticket's commit): `.current/e258a/{dispatch.jsonl,handoff.md,tasks.md}`, `content/const-15-core-tail.md`, `content/skill-code-reviewer.md`, `qa_reports/expected-red_e258a-comment-rule.txt`, `review_reports/review_T-E258A-01.md`, `specs/e258a-comment-rule.md`. All owned; `qa_reports/expected-red_e258a-comment-rule.txt` is a new file created by this ticket (lowercase name, outside the literal `*E258A*` glob) and is recorded as in-scope per lane-protocol section 2 "new files this ticket creates". This ticket adds `test/e258a-comment-rule.test.mjs`, `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**`, `qa_reports/review_T-E258A-02.md` (all owned/pre-authorized). No scanner code, no user docs, no rewritten comments, no other `test/**` file.

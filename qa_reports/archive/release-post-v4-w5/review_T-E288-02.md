# QA review — T-E288-02 / T-E323-02 (with T-E288-01 / T-E323-01)

covers: T-E288-01, T-E323-01, T-E288-02, T-E323-02

## Phase 1 — Review
- Code-reviewer verdict on T-E288-01 / T-E323-01: APPROVED (`review_reports/review_T-E288-01.md`, 0 required, 4 optional). QA judged each optional finding against the ACs: (1) Stage 1 `Input:` double "or" is the wording the spec prescribes; (2) the hand-off-note Decisions row not naming `裁決者` is not an AC (AC-E288-5 pins `出處` only, and `fanout.mjs validate` rejects a wrong value); (3) re-dispatch of PM to revise the cut file is covered by "ticket-cut file only"; (4) the PM row not restating bypassed gates is covered by the pinned literal. None is an AC gap; none blocks PASS.
- Copy Audit (3a): the SOP text is agent-facing; Copy literals are asserted verbatim by `test/e288-integrator-stage0.test.mjs` (`int.stage0.heading`, `int.overview.row0`, `int.stage0.skip`, `int.stage0.path`, `int.stage0.pm-only`, `int.stage0.approval`, `int.perm.row`, `int.d3.parts`, `int.d3.path`, `pm.stage0.row`) and by the existing grep for `qa.resident-hygiene`. No drift, no unlisted string.
- Visual Audit (3b) / Phase 1.5: skipped (no Visual Tokens, no Visual Baselines declared).

## Expected-Red Diff
Phase 0.5: clean (2/2 manifest entries confirmed red, 0 unexplained reds). The manifest `qa_reports/expected-red_e288-integrator-stage0-and-test-hygiene.txt` lists the skill-pm cap (4823 ~tok measured vs cap 4708) and qa-visual-skill-split AC-5 (18066 bytes vs cap 17900). Both were confirmed red by arithmetic against the unmodified caps and match the sr-engineer / code-reviewer full-suite run (exactly those 2 reds); QA then re-pinned them (T3 / T4). The final full suite on the committed HEAD is green (see the Phase 4 section).

## AC Execution Log
| AC | proof command | result |
|---|---|---|
| AC-E288-1..6 | `node --test --test-name-pattern "AC-E288-<n>:" test/e288-integrator-stage0.test.mjs` for n = 1..6 | each: 1 pass, 0 fail |
| AC-E288-7 | `node --test --test-name-pattern "skill-pm stripped token count" test/context-budget.test.mjs` | 1 pass; measured 4823 ~tok ≤ approved ceiling 4860; cap pinned at exactly 4823 (a probe with cap 4822 failed with "4823 ~tok"), zero headroom |
| AC-E288-8 | `git diff dac6069 HEAD -- content/skill-integrator.md`, minus lines; then e246, e297, e286, e295, e296, e178a test files | the only 3 removed lines are the invocation line, the Stage 1 `Input:` line and the Stage 2 paragraph (all outside `### Mid-wave base fix` and `## Stage 6`); 99 pass, 0 fail, 0 skipped |
| AC-E323-1 | `grep -nE 'BASE_SHA\|3c72a83\|"diff"' test/e178a-integrator-role.test.mjs`; `node --test test/e178a-integrator-role.test.mjs` | grep prints nothing; 18 pass, 0 fail, 0 skipped |
| AC-E323-2 | `grep -nE '"archive"\|"rev-parse"\|BASE_CODE' test/e296-manifest-tier.test.mjs`; `node --test test/e296-manifest-tier.test.mjs` | grep prints nothing; 35 pass, 0 fail, 0 skipped |
| AC-E323-3 | `grep -c 'never diff against a fixed lane base sha' content/skill-qa-engineer.md`; AC-4 pattern | prints 1; AC-4 pass |
| AC-E323-4 | `node --test --test-name-pattern "AC-5" test/qa-visual-skill-split.test.mjs` | pass; 18066 bytes ≤ re-pinned 18500 (D1) |
| goldens | `node --test test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs` | 17 pass, 0 fail; `test/fixtures/compose-golden/**` unchanged, no regeneration |

## Spec-to-Test Map
- AC-E288-1..6 → `test/e288-integrator-stage0.test.mjs` tests `AC-E288-1`..`AC-E288-6` plus a negative control (mutated in-memory copies: misplaced heading, missing overview / permission / PM row, duplicated permission row, skip sentence removed, approval sentence removed, hand-off parts reordered, PM row before the attestation row — each makes its check fail).
- AC-E288-7 → `test/context-budget.test.mjs` (cap 4708 → 4823, message names E288).
- AC-E323-1 → `test/e178a-integrator-role.test.mjs`: `AC6 (terse grant)` structural test replaces the fixed-base diff; `BASE_SHA`, `unresolvedSha`, `skipIfHistoryAbsent` removed.
- AC-E323-2 → `test/e296-manifest-tier.test.mjs`: AC10 now renders the frozen in-test manifest and asserts the lane's branch, 擁有, 禁止, `--summary`, `--reading`, `--base`, mailbox path and no bare `approval` header word; w2 control and git use dropped (D6); header comment updated.
- AC-E323-4 → `test/qa-visual-skill-split.test.mjs` cap 17900 → 18500 (D1, cap only).

## Phase 3 note
Test placement: resolved from the dispatch brief's `Test-file placement` line (creation of `test/e288-integrator-stage0.test.mjs` pre-authorized). Coverage tooling is not measured for SOP-text tests; each new assertion maps to a spec AC. The new tests use no git, no fixed sha, and no real `specs/fanout-*.md` content.

## Phase 4 — Run
See the final-suite record in `qa_reports/e288-final-suite_T-E288-02_T-E323-02.txt`.
## 2026-10-16T21:42:26.591Z — PASS — by qa-engineer

covers: T-E288-01, T-E323-01, T-E288-02, T-E323-02. PASS. AC-E288-1..8 and AC-E323-1..4 verified by executed proofs (see qa_reports/review_T-E288-02.md AC Execution Log). New test/e288-integrator-stage0.test.mjs (6 AC tests + negative control); skill-pm cap re-pinned to exact measured 4823 ~tok (ceiling 4860); e178a and e296 AC10 fixed-base tests replaced by structural assertions (no sha, no git, w2 control dropped); qa-visual-skill-split cap 17900 to 18500 (D1). Goldens unchanged. Expected-Red Diff clean (2/2). Code-reviewer optional findings judged: none is an AC gap. Final full suite on HEAD 65b12f6 clean worktree: 3237 pass / 0 fail / 2 skipped of 3239 (an earlier run on the same HEAD had 3 timing flakes under host load avg 30-45, untouched files, passed on rerun). fanout check: only D1 path out of bounds.


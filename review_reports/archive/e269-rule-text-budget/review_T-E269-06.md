# Review — T-E269-06 (E269 / E274, qa-authored test and golden edits from T-E269-05)

covers: T-E269-05, T-E269-06

## Round 1 — APPROVED — by code-reviewer

Base `main`, reviewed commit 54ce8c2 (test edits only). Clean context: inputs were the diff, `specs/e269-rule-text-budget.md` (AC5-AC9), and the expected-red manifest (step 4a carve-out). From `qa_reports/authoring_T-E269-05.md` I only grepped for golden mentions, for the AC7 existence check. Reviewer model: opus. The author was a qa-engineer session, so builder and judge are different contexts.

## Summary
- `test/context-budget.test.mjs`: the pm and sr-engineer cap titles are corrected to their asserted caps (4401, 2852; E274), and the four zero-headroom caps are re-baselined to 5567 / 10076 / 20453 / 7978. Each title, assert and message says the same number, and each message cites "E269 re-baseline".
- New `test/e269-budget-title-sync.test.mjs`: a checker that each "≤ N" / "<= N" title equals a `<= N,` cap asserted in the same test block. It has a found-zero floor and a self-test.
- 11 compose goldens changed, each by exactly one line: the §6 FORBIDDEN-list line, identical to the `content/const-15-core-tail.md` hunk. `skill-coordinator-monolith.txt` is unchanged.
- Scope: only the owned test files were touched, and `test/e178a-integrator-role.test.mjs` is untouched.
- Verdict: APPROVED, with one recommended note for the verifier about the expected-red manifest titles.

## AC Completeness
AC5 — implemented — test/context-budget.test.mjs:475 (title ≤ 4401, assert 4401), :490 (title ≤ 2852, assert 2852)
AC6 — implemented — test/e269-budget-title-sync.test.mjs:35-55. It passes on HEAD (6 titles checked), and all four negative controls run on copies outside the worktree fail loudly (see Correctness).
AC7 — implemented — `git diff main...HEAD -- test/fixtures/compose-golden` lists 11 constitution-bearing files. In each one the changed lines (−1/+1) are byte-equal to the const-15 hunk. `skill-coordinator-monolith.txt` has no §6 text and is unchanged. Running `scripts/capture-constitution-golden.mjs` in a temp copy of the worktree gives output byte-identical to the tracked fixtures (`diff -r` clean). The qa authoring report mentions the goldens (5 lines).
AC8 — implemented — I re-measured the four caps independently (scratch script copying the test's composition): lean 5567, design-arm 10076, teamwork 20453, non-design 7978. All equal the new caps, with zero headroom. No old cap number (5548/10057/20434/7959/4376/2642) is left in test/context-budget.test.mjs.
AC9 — partial (by design, not a finding) — the code-reviewer half is satisfied by this report. The separately dispatched qa verifier PASS is T-E269-07, which comes next.

## Correctness
- Test runs: `node --test test/context-budget.test.mjs test/e269-budget-title-sync.test.mjs` gave 56/56 pass, and `test/compose-equivalence.test.mjs` gave 14/14 pass.
- Negative controls (copies in scratch, pointed to by `E269_TITLE_SYNC_TARGET`, no stash):
  1. Title 2852 changed to 2642 in the sr test: FAIL, "title says 2642 but body asserts [2852]".
  2. Assert 5567 changed to 5548 in the lean test: FAIL, "title says 5567 but body asserts [5548]".
  3. Cross-block: the lean title set to 7978, which is asserted in a *different* test: FAIL. The block splitting does not leak another block's asserts.
  4. A file with no cap titles: FAIL, "found 0; the parser may have drifted".
- Block splitting: `^\s*test\(` also matches the indented loop-generated `test(` at context-budget:133, so every one of the 50 test calls starts a block. The `checked >= 6` floor equals today's exact count of 6 cap-bearing titles.
- optional — test/e269-budget-title-sync.test.mjs:22. A test whose title sits on the line after `test(` would not be seen as cap-bearing. Today the `>= 6` floor catches this only when it lowers the count. No such title exists now, so this is not a gap for AC6.

## Quality
- recommended — `agc check — comments` warns: test/e269-budget-title-sync.test.mjs:1, a long-block of 8 lines (limit 7). Kept, because the env-override sentence is load-bearing for the out-of-worktree negative-control rule (AC2/§94 of the spec). The "fixed by hand three times" clause could be trimmed on the next touch. Advisory, not blocking.
- The headers keep the file's "Coded by @qa-engineer" convention, and the messages follow the E258 "<ticket> re-baseline" precedent.

## Architecture
No architecture spec for this feature. The new check is a standalone test file that reads the target as text, with no production coupling. That matches the spec's E274 decision (AC6).

## Security
No findings. Test-only. `E269_TITLE_SYNC_TARGET` is read only as a file path for `readFileSync` in a test process.

## Performance
No findings. One file read plus a line scan, O(lines).

## Expected-red manifest (step 4a)
I sampled 3 of the 11 compose-equivalence entries (hook-lite, hook-full, the DR-1 monolith invariant at compose-equivalence:114/119/126; the 8 build-* names come from the template at :71). All are locatable.

recommended (note for the T-E269-07 verifier; do not edit the file): the four `test/context-budget.test.mjs` entries in `qa_reports/expected-red_e269-rule-text-budget.txt` name the **pre-re-baseline** titles (`<= 5548`, `≤ 10057`, `≤ 20434`, `≤ 7959`). Those titles no longer exist because each title carries its cap. This is expected and correct for an sr-time manifest. Map them by cap: 5548 → 5567, 10057 → 10076, 20434 → 20453, 7959 → 7978. Each is now green at the exact measured value.

## Verdict
APPROVED — AC5-AC8 are met and independently re-verified (caps re-measured, goldens regenerated byte-identically, negative controls fail loudly). There are no required findings.

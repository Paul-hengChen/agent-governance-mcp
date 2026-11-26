# Review — T-E425-07 (rework round)

covers: T-E425-07, T-E425-08

## Summary
- Rework after integrator lane report (spec `## Rework after lane report`, AC16, C-TF4), reviewed over `24570d90..HEAD`.
- R1: `docs/ticket-format.md:60` example reason now reads C-TF4 `stopped — vendor firmware not available yet` (example text only).
- R2: comment-only trims in `test/e425-stop-ticket-batch.test.mjs` (header 13 → 7 lines), `test/context-budget.test.mjs` (three `// E425 re-baseline:` lines removed), `test/e118-reviewer-ac-completeness.test.mjs:226-229` (E425 line folded, block 8 → 7). No assertion, expected value, cap or test title changed.
- New AC16 test added; `node bin/agc-init.mjs check` prints zero `comments` warnings.
- T-E425-01..06 not re-judged; full suite shows no regression.
- Verdict: APPROVED.

## AC Completeness
AC1–AC15 — implemented — unchanged by this round; previously APPROVED (review_reports/review_T-E425-01.md); full suite green.
AC16 — implemented — docs/ticket-format.md:60 (C-TF4 verbatim); test/e425-stop-ticket-batch.test.mjs AC16 test; `agc check` lists no comment advisory.

## Correctness
No findings.
- AC16 test (test/e425-stop-ticket-batch.test.mjs, end of file) selects exactly one `| \`stopped — <reason>\` |` row, extracts exactly one `for example \`…\`` value, asserts it does not match `/^stopped — waiting on\b/` and equals `C["C-TF4"]` (FROZEN.COPY, verbatim from the spec table). Fails on the old example (begins `stopped — waiting on`) and on any other substitute; the manifest recorded it red before T-E425-08, green now.
- R2 diffs verified line by line: only `//` lines removed or rewritten; `assert.ok(stripped <= 9336 …)`, `bundle <= 19449`, `nonDesign <= 7424`, and the e118 `AC7` size test are byte-unchanged. The removed cap rationale is preserved in the spec rework section as the spec requires.

## Quality
No findings. Trimmed comment blocks are all ≤ 7 lines; the context-budget blocks are back to base wording. The AC16 test's own WHY comment is 2 lines, within discipline. 5d: `agc check` reports no comment warnings, so nothing to keep or send back.

## Architecture
No architecture spec for this feature; change is doc text + tests only.

## Security
No findings. No code path, input boundary or secret touched.

## Performance
No findings. One added string-scan test over an already-loaded doc.

## Verdict
APPROVED — R1 and R2 are met exactly as the rework spec states, AC16 is proved by a tight test and a clean `agc check`, and the full suite is 4758/4761 pass, 0 fail.

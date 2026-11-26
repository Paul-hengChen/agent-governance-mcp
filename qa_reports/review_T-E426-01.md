# Judge report — T-E426-01

covers: T-E426-01, T-E426-02, T-E426-03, T-E426-04, T-E426-05, T-E426-06

## Round 1 — APPROVED — by code-reviewer

Feature `e426-ticket-scenarios-fixed`, branch `feat/e426-ticket-scenarios-fixed`, base `ce36112`, HEAD `f5e2319`. Full suite: `node scripts/test-lock.mjs -- npm test` run after `git status --porcelain` showed no untracked files (only the tracked `.current/e426/` state files modified). Exit 0. Result: 4778 tests, 4776 pass, 0 fail, 2 skipped (the same 2 skips as the base probe's 4766/0/2 of 4768; +10 = the new e426 tests).

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e426-ticket-scenarios-fixed.txt`, 9 entries. Actual reds in the full suite: none.

- test/e426-ticket-scenarios-fixed.test.mjs | AC1 … — scenario test, now green — built (C-PM1, T-E426-02)
- test/e426-ticket-scenarios-fixed.test.mjs | AC3 … — scenario test, now green — built (C-PM2, T-E426-02)
- test/e426-ticket-scenarios-fixed.test.mjs | AC4 … — scenario test, now green — built (C-QA1..3, T-E426-03)
- test/e426-ticket-scenarios-fixed.test.mjs | AC5 … — scenario test, now green — built (C-SR1, T-E426-04)
- test/e426-ticket-scenarios-fixed.test.mjs | AC6 … — scenario test, now green — built (C-CR1, C-CR2, T-E426-04)
- test/e426-ticket-scenarios-fixed.test.mjs | AC7 … — scenario test, now green — built (C-CO7a, T-E426-05)
- test/e426-ticket-scenarios-fixed.test.mjs | AC8 … — scenario test, now green — built (C-TF1, C-TF2, T-E426-05)
- test/e426-ticket-scenarios-fixed.test.mjs | AC9 … — scenario test, now green — built (all Copy rows present, scan clean)
- test/e422-ticket-format-doc.test.mjs | AC8 the example is generic … — re-pinned test, now green — built (C-TF2, T-E426-05)
- Reds off the manifest: none. The shared-artifact reds the spec's PM probe predicted (3 context-budget caps, skill-manifest golden byte identity, e118 AC7) are green after T-E426-06.

## AC Execution Log

- AC1 — `node --test --test-name-pattern "^AC1" test/e426-ticket-scenarios-fixed.test.mjs` — exit 0 (2 tests, 2 pass: AC1, AC10) — pass
- AC2 — `node --test --test-name-pattern "^AC2" test/e426-ticket-scenarios-fixed.test.mjs test/ac-execution.test.mjs` — exit 0 (2 tests, 2 pass) — pass
- AC3 — `node --test --test-name-pattern "^AC3" test/e426-ticket-scenarios-fixed.test.mjs` — exit 0 (1 test, 1 pass) — pass
- AC4 — `node --test --test-name-pattern "^AC4" test/e426-ticket-scenarios-fixed.test.mjs test/e425-stop-ticket-batch.test.mjs` — exit 0 (2 tests, 2 pass) — pass
- AC5 — `node --test --test-name-pattern "^AC5" test/e426-ticket-scenarios-fixed.test.mjs` exit 0 (1/1), and `node --test test/e433-test-first-rules.test.mjs test/e453-served-text-v5.test.mjs` exit 0 (39/39) — pass
- AC6 — `node --test --test-name-pattern "^AC6" test/e426-ticket-scenarios-fixed.test.mjs test/e425-stop-ticket-batch.test.mjs` — exit 0 (2 tests, 2 pass) — pass
- AC7 — `node --test --test-name-pattern "^AC7" test/e426-ticket-scenarios-fixed.test.mjs test/e5-intake-tiering.test.mjs` — exit 0 (2 tests, 2 pass) — pass
- AC8 — `node --test --test-name-pattern "^AC8" test/e426-ticket-scenarios-fixed.test.mjs test/e422-ticket-format-doc.test.mjs test/e455-ticket-checker-strict.test.mjs test/e427-ticket-format-doc.test.mjs` — exit 0 — pass
- AC9 — `node --test --test-name-pattern "^AC9" test/e426-ticket-scenarios-fixed.test.mjs test/error-code-contract.test.mjs test/e462-stale-comments-wording.test.mjs` — exit 0 — pass
- AC10 — `node --test --test-name-pattern "^AC10" test/e426-ticket-scenarios-fixed.test.mjs` — exit 0 (1 test, 1 pass) — pass
- AC11 — `node scripts/test-lock.mjs -- npm test` exit 0 (4776/4778 pass, 0 fail, 2 skipped), and `git diff --name-only ce36112 -- '*.ts' dist templates` printed nothing — pass

Supplementary runs, beyond the `proof:` lines:
- The name-pattern filter reports only the matching tests per file. So I also ran these 16 files in full, unfiltered: e422, e455, e427, e5, error-code-contract, e462, e425, ac-execution, e438, e437, e410, e413, skill-manifest, context-budget, e118, e424-per-scenario-acceptance. Result: 356/356 pass.
- `GATE_REGISTRY` length 33 and `UPDATE_STATE_GATE_PIPELINE` length 17, read from `dist/`.
- Negative controls on a scratch copy outside the worktree. 7/7 mutations turned the expected test(s) red (listed in `review_reports/review_T-E426-01.md` § Correctness).

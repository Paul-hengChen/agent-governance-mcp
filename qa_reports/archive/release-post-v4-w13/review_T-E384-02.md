covers: T-E384-01, T-E386-01, T-E346-01, T-E384-02, T-E386-02, T-E346-02, T-E384-03

# QA round 1 — e384-design-mode-and-handoff-target

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared).
Copy audit: err.target-recorded / err.target-default / err.target-flag asserted verbatim in test/e386-handoff-recorded-target.test.mjs; err.sister-not-git asserted verbatim in test/e346-sister-nested-dir.test.mjs.

## AC to test map

- AC-E384-1, 2, 3, 5, 6: test/e384-design-mode-declared.test.mjs (10 tests, both entry points per case)
- AC-E386-1..6: test/e386-handoff-recorded-target.test.mjs (11 tests)
- AC-E346-1..3: test/e346-sister-nested-dir.test.mjs (5 tests)
- AC-E384-4, AC-E386-5 (e284 part), AC-E386-7, AC-E346-4, AC-E384-7, AC-L1..L3: lane verification below

## AC Execution Log

Run on committed HEAD 9f6c68b, worktree clean (`git status --porcelain` empty).

| AC | command | result | verdict |
|---|---|---|---|
| AC-E384-1,2,3,5,6 | `node --test test/e384-design-mode-declared.test.mjs` | pass 10, fail 0 | pass |
| AC-E386-1..6 | `node --test test/e386-handoff-recorded-target.test.mjs` | pass 11, fail 0 | pass |
| AC-E346-1..3 | `node --test test/e346-sister-nested-dir.test.mjs` | pass 5, fail 0 | pass |
| AC-E384-4 | `node --test test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs` | pass 74, fail 0 | pass |
| AC-E384-4 | `git diff --quiet 35f20e2...HEAD -- <the 2 files>` | exit=0 | pass |
| AC-E386-5, AC-E386-7 | `node --test test/e284-... e285-... e283-... e292-... e339-...` (five handoff suites) | pass 57, fail 0 | pass |
| AC-E346-4 | `node --test test/e292-handoff-sister-sha.test.mjs` | pass 15, fail 0 | pass |
| regression files unmodified | `git diff --quiet 35f20e2...HEAD -- <the 7 regression files>` | exit=0 | pass (no re-pins) |
| AC-E384-7 | `git diff --quiet 35f20e2...HEAD -- gates/registry.ts content schema` | exit=0 | pass |
| AC-L2 | `git diff --quiet 35f20e2...HEAD -- tools/fanout-manifest.ts gates/registry.ts schema content package.json` | exit=0 | pass |
| AC-L1 | `node scripts/fanout.mjs check specs/fanout-post-v4-w13.md e384 --base 35f20e2` | "20 file(s) changed, 0 out of bounds", exit 0 | pass |
| AC-L3 | `node scripts/test-lock.mjs -- npm test` | exit 0; tests 3824, pass 3822, fail 0, skipped 2 | pass |

## Notes

- One QA fixture bug fixed while authoring (the fetch-based mode list in the E384 test wrongly included pdf/image/paper); not a product defect.
- Test-file placement: creation pre-authorized by the dispatch brief (Test-file placement line).
- Code-reviewer non-blocking findings (gates/visual.ts doc comment length; err.target-default hardcodes main; empty --show-toplevel on pre-2.25 git) stand as filed; none affect an AC.
## 2026-10-30T03:49:43.689Z — PASS — by qa-engineer

suite-result: 3822/3824 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All 7 tasks PASS. Full evidence, AC-to-test map and AC Execution Log in qa_reports/review_T-E384-02.md (covers all 7 ids). New tests 10/11/5 green; regression suites unmodified and green; fanout check e384 exit 0; full suite 3822/3824 (2 skipped, 0 fail) on clean committed HEAD.


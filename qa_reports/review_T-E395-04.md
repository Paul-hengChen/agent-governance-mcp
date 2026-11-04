# QA review — T-E395-04

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-04T09:58:16.659Z — PASS — by qa-engineer

suite-result: 4014/4016 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

covers: T-E395-01, T-E395-02, T-E404-01, T-E395-03, T-E404-02, T-E404-03, T-E395-04

Phase 0.5: skipped (no expected-red manifest declared). The 10 pre-existing reds from the spec Re-pin survey were all re-pinned green (e166 T-E166-01b; e392 AC8; feature-lease S4, E9A-S5, E17-S3, E17-S4; release-staging AC5, two C13-AC6/AC7, D10-AC4 verbatim hint). No other red.
Copy Audit Gate: CLAUDE.md c395.what-50, layout-91, layout-126, testing-158, testing-163 and the 11 layout rows, plus template c404.load / c404.rebaseline / RELAY, matched verbatim by the new tests. No unsourced user-facing strings. Visual: N/A, no design file (Phase 1.5 skipped).
Phase 3 tests: new test/e395-claude-md-tail.test.mjs (AC-E395-1/2/4/5/6) and test/e404-release-engineer-template.test.mjs (AC-E404-1/3/4/5/6/7); re-pins carry [E404 re-pin] markers. test/subagent-templates.test.mjs, e391, e178a unmodified and green.

## AC Execution Log
- AC-E395-1/2/4/5/6 and AC-E404-1/3/4/5/6/7: executed by the two new test files, all pass.
- AC-E395-3: grep of git diff 1000517 -- CLAUDE.md for agc-version gives 0 hits; e178a unmodified and green.
- AC-E404-8 / AC-GEN: git diff --stat 1000517...HEAD for the other 11 templates, test/fixtures, test/context-budget.test.mjs and dist is empty.
- AC-DIST: npm run build then git status --porcelain empty.
- AC-BOOK: npm run check:bookkeeping exit 0. AC-STAMP: node bin/agc-init.mjs check exit 0 (4.19.0, all adapters current). npm audit --audit-level=high exit 0.
- AC-SCOPE: git diff --stat 1000517...HEAD lists only CLAUDE.md, the template, 6 test files, the spec, review_reports, .current/e395.
- AC-SUITE: node scripts/test-lock.mjs -- npm test on committed clean HEAD 5a31021: 4016 tests, 4014 pass, 0 fail, 2 skipped. e234 hygiene and e258b comment-scan green.
No findings; code-reviewer's two optional non-blocking notes unchanged.


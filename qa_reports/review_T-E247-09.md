# QA review — T-E247-09

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-09T10:22:33.639Z — PASS — by qa-engineer

suite-result: 4072/4074 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Lane close (T-E247-08) on clean HEAD bb8135e. Full suite: 4072 pass, 0 fail, 2 skipped of 4074, exit 0.

## Expected-Red Diff
Phase 0.5: clean. The manifest qa_reports/expected-red_e247-qa-pass-unticked-gate.txt has 0 entries (comment-only); the full suite shows 0 fail, so 0 unexplained reds. The earlier repro entries (E396 U2, E396 I, AC-X) are green after 0f67342 and 4f46d8c (31/31 in test/e396-covers-expected-red.test.mjs + test/ac-execution.test.mjs); sr's 14 count/order pins were re-pinned in T-E247-10.

## AC Execution Log
- AC1 `node --test --test-name-pattern "AC1" test/e247-pass-tasks-incomplete.test.mjs`: exit 0, 1/1 pass. PASS.
- AC2 (same, pattern AC2): exit 0, 1/1. PASS.
- AC3 (pattern AC3): exit 0, 1/1. PASS.
- AC4 (pattern AC4): exit 0, 1/1. PASS.
- AC7 (pattern AC7): exit 0, 1/1. PASS.
- AC5 `node --test test/error-code-contract.test.mjs`: exit 0, 25/25. PASS.
- AC6 `node --test test/e35-pipeline-order.test.mjs`: exit 0, 7/7. PASS.
- AC8 `grep -cE "lane-paths|resolveCurrentLane|resolveLanePaths" gates/open-tasks.ts tools/handoff-orchestrator.ts`: gates/open-tasks.ts:0, tools/handoff-orchestrator.ts:0. PASS.
- AC9/AC13 `node --test test/e380-qa-suite-result-sop.test.mjs`: exit 0, 4/4; line 90 of content/skill-qa-engineer.md carries PASS_TASKS_INCOMPLETE and the qa_suite_result-on-FAIL clause. PASS.
- AC10 `grep -c "18-step\|18 steps\|35 entries" CLAUDE.md README.md docs/architecture.md`: 0 / 0 / 0. PASS.
- AC10b `sed -n 104,107p CLAUDE.md | grep -c "open-tasks"`: 1. PASS.
- AC11 qa_reports/review_T-E247-01.md has `## E396 Reproduction` naming U1 green, U2 RED, I RED, plus the after-fix table (all green). PASS.
- AC12 `node --test test/e396-covers-expected-red.test.mjs test/gates-expected-red.test.mjs test/e136-evidence-path-injective.test.mjs`: exit 0, 28/28. PASS.
- AC16 `node --test test/ac-execution.test.mjs`: exit 0, 28/28; AC-X recorded RED then green in review_T-E247-01.md. PASS.
- AC14 `wc -c < content/skill-qa-engineer.md`: 18476 (<= 18500). PASS.
- AC15 `npm run build` exit 0 and tree clean afterwards; `npm audit --audit-level=high` exit 0; `npm run check:bookkeeping` exit 0; `node bin/agc-init.mjs check` exit 0 (advisories only: gates/registry.ts:78 long-block 37 lines and :116 12 lines, both already over the limit at the lane base); dist diff vs base 2425e04 is only dist/gates/{open-tasks,registry,expected-red,ac-execution}.* and dist/tools/handoff-orchestrator.*; `git diff --stat 2425e04..HEAD` has only Cut / owned files; full suite `node scripts/test-lock.mjs -- npm test` on HEAD bb8135e: 4072/4074, 0 fail, exit 0. PASS.

R1 closed: test/e396-covers-expected-red.test.mjs header trimmed to 7 lines and reworded as a reproduction record (5b3e8b5), no logic change.


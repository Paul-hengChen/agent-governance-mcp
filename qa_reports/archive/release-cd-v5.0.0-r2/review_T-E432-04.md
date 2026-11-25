# QA review — T-E432-04

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-20T09:57:25.429Z — PASS — by qa-engineer

suite-result: 4478/4480 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

QA PASS for E432 (judge-report checks), one report for all seven ids (full detail in qa_reports/review_T-E432-01.md). Expected-Red Diff: manifest had 5 entries (test/e431-test-first-server-path.test.mjs AC1, AC5, AC6, AC7, AC10); confirmed exactly those 5 red before any re-baseline (34 pass / 5 fail in that file), 0 unexplained reds; T-E432-06 re-pinned them (no-new-test record in each fixture, assertions unchanged); final full suite has 0 failures, so all 5 entries are green and no stray red exists. AC Execution Log: AC1-AC14 proofs `node --test test/e432-*.test.mjs --test-name-pattern "AC<n>:"` each exit 0 (30 e432 tests pass; this node runs the whole file under any pattern); AC14 also e436/e395/e391 tests 27 pass 0 fail; AC15: npm run build zero errors and no dist diff after build, npm audit --audit-level=high exit 0 (7 vulns: 1 low, 6 moderate, none high), git diff --stat 5f50af1..HEAD -- dist/ holds only dist/gates/{expected-red,ac-execution,qa-review,registry}.* and dist/tools/{evidence-file,evidence-lookup,handoff-orchestrator,lane-status,registry}.* (27 files, lane-source artifacts). Final suite: node scripts/test-lock.mjs -- npm test run once after the last commit on a clean tree: 4480 tests, 4478 pass, 0 fail, 2 skipped. Base-commit replays (AC4/AC8/AC9/AC11/AC12) ran against 5f50af1 and were not skipped.


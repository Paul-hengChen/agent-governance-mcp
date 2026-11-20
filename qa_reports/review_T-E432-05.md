# QA review — T-E432-05

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-20T09:57:25.429Z — PASS — by qa-engineer

suite-result: 4478/4480 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

QA PASS for E432 (judge-report checks), one report for all seven ids (full detail in qa_reports/review_T-E432-01.md). Expected-Red Diff: manifest had 5 entries (test/e431-test-first-server-path.test.mjs AC1, AC5, AC6, AC7, AC10); confirmed exactly those 5 red before any re-baseline (34 pass / 5 fail in that file), 0 unexplained reds; T-E432-06 re-pinned them (no-new-test record in each fixture, assertions unchanged); final full suite has 0 failures, so all 5 entries are green and no stray red exists. AC Execution Log: AC1-AC14 proofs `node --test test/e432-*.test.mjs --test-name-pattern "AC<n>:"` each exit 0 (30 e432 tests pass; this node runs the whole file under any pattern); AC14 also e436/e395/e391 tests 27 pass 0 fail; AC15: npm run build zero errors and no dist diff after build, npm audit --audit-level=high exit 0 (7 vulns: 1 low, 6 moderate, none high), git diff --stat 5f50af1..HEAD -- dist/ holds only dist/gates/{expected-red,ac-execution,qa-review,registry}.* and dist/tools/{evidence-file,evidence-lookup,handoff-orchestrator,lane-status,registry}.* (27 files, lane-source artifacts). Final suite: node scripts/test-lock.mjs -- npm test run once after the last commit on a clean tree: 4480 tests, 4478 pass, 0 fail, 2 skipped. Base-commit replays (AC4/AC8/AC9/AC11/AC12) ran against 5f50af1 and were not skipped.


## 2026-11-20 addendum: CI Node 20 failure on AC12 (SQLite byte-identity)

Defect: CI run 44715287224 on f6ece2c, job `test (20)`, test "AC12: SQLite rejections ... storage files byte-identical" failed with `ENOENT ... open '/tmp/e432-base-<id>/tools/storage-sqlite.ts'`. Node 22 passed. The test reads the two base storage sources from the extracted base tree at assertion time.

Findings: at f6ece2c the `git archive` call already lists `tools/storage-sqlite.ts` and `schema/migrations-sqlite.ts`, so the premise "archive omits them" does not hold; the root cause of the missing file in CI is NOT reproduced (local Node 22 runs AC12 and passes; local Node 20 cannot load the shared better-sqlite3 binary, ERR_DLOPEN_FAILED, NODE_MODULE_VERSION 127 vs 115, so AC12 fails there before reaching the comparison; that is an ABI issue of the shared node_modules, not the defect). No other base-tree path is read from disk: every other BASE use is a dist module loaded at top level.
First attempt (268aa97, `git show <sha>:<path>`) was rejected by my own full-suite run: T-E77-02 meta-test (no test/ file may read repository history via git show) failed. Not worked around.
Fix (784c63f): read both base sources into `BASE.srcText` immediately after extraction (inside the same try as loadMods), and compare against that in-memory text; if the tree is incomplete at extraction the base replays skip loudly with a `[WARN] e432: ...` reason instead of an ENOENT later. Assertion intent (byte-identical to base) unchanged.

Results: Node 22 `node --test test/e432-judge-report-checks.test.mjs test/render-structure.test.mjs`: 45 pass, 0 fail, 0 skipped (AC12 ran, not skipped). Node 20 locally: AC12 not provable (ABI mismatch above), 29 pass 1 fail (ERR_DLOPEN_FAILED), so the Node 20 CI re-run is the confirming evidence. Full suite after commit, clean tree: `node scripts/test-lock.mjs -- npm test` 4480 tests, 4478 pass, 0 fail, 2 skipped.

# QA review — T-E291-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-17T13:10:19.693Z — PASS — by qa-engineer

PASS (QA round 1, opus, Task-spawned). Evidence: qa_reports/review_T-E291-03.md (covers all six ids; Phase 0.5 skipped no manifest; Copy Audit verbatim for all 8 e291.* rows; Phase 1.5 skipped; Spec-to-Test map; AC Execution Log). Tests added: test/e291-start-link-locations.test.mjs 38/38 (AC-E291-1..13 + usage), test/e335-symlinked-pending-harvest.test.mjs 15/15 (AC-E335-1..6). Negative control vs base bin/agc-init.mjs: 35 red (all new-behavior tests), 10/10 key-absent cases green (frozen base strings proven byte-identical). AC-E335-5 set 76/76; e246 byte-identical to 902462e and green. Owned lifecycle/config tests 87/87, unmodified. AC-LANE-2: 17/17 paths e291. AC-LANE-3: build clean, dist porcelain empty. AC-LANE-1: node scripts/test-lock.mjs -- npm test on HEAD 4bb2c44, clean tree: 3372 pass / 3374 total, 0 fail, 2 pre-existing history-dependent skips. Commit 868b28d verified comment-only (all changed lines are // comments in bin/agc-init.mjs), made after the 6f06271 APPROVED verdict. Non-blocking: dist/tools/config.js load-failure string not in the spec Copy table (templated from the base lane-paths load error) — PM may add it.


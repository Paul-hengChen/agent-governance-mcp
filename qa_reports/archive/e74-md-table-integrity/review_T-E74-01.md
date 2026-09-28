# QA review — T-E74-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-07T12:35:45.235Z — PASS — by qa-engineer

PASS. Verified scripts/check-md-tables.mjs (round-3 APPROVED, F1/F3/F4/F5/F6 all correct, Q3-1 coordinator-direct comment fix confirmed). New test/check-md-tables.test.mjs (17 tests): guard-the-guard for all 4 discriminators incl. F1 nested-fence (naive reconstructions demonstrated to red), F6 message-correctness for all 3 causes with remedy-clears-violation proof, F4 masking pinned at class scale (MASK-1/2/3), F5 ENOENT + boundary smoke tests, EDGE-1 round-3 suspect case. Real-repo pre-fix/post-fix oracle (22 sites/17 files, 21-then-1) independently re-derived by hand via git worktree at HEAD (not baked into permanent tests per T-E77-02 history-fixture guard) -- matches exactly. Build clean, 1813/1813 suite green, check:md-tables OK (241 files) exit 0. Boundaries held: test/ gains only the new file (qa-owned), skill-pm.md/skill-design-auditor.md untouched, qa_reports/ and review_reports/archive/ byte-clean. Evidence: qa_reports/review_T-E74-02.md (covers T-E74-01, T-E74-02).


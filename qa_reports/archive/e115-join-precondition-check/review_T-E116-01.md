# QA review — T-E116-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-18T12:34:35.687Z — PASS — by qa-engineer

PASS. test/e116-archive-on-feature-change.test.mjs (new, 10 cases) verifies AC1-AC5 by execution: AC1 verbatim byte-copy, AC2 the reset/carry-forward central tension, AC3 no-archive-same-feature, AC4 no-archive-first-write, AC5 charset+200-char clamp incl. the C1 233-char wedge regression, the 500-char schema max, an unconditional 10000-char clamp bypassing zod, and multi-byte replace-before-slice ordering. Plus a bonus fail-closed regression (ENOTDIR forces copyFileSync to throw; live ledger untouched, no leaked lock/tmp). AC6/AC7 verified by inspection (git diff --stat shows storage-sqlite.ts/schema/versions.ts/tools/handoff-types.ts absent). npm run build clean; npm test 2145/2145 (baseline 2135 + 10 new); npm audit --audit-level=high exit 0 (6 pre-existing lower-severity advisories, unrelated). Evidence: qa_reports/review_T-E116-04.md (covers T-E116-01, T-E116-03, T-E116-04).


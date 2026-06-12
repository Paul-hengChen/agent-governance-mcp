# QA review — T-B6-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-12T05:22:54.155Z — PASS — by qa-engineer

backlog-b6 PASS. T-B6-01 (helper): lib/tsconfig-source-dirs.ts exports getTsConfigSourceDirs(tsconfigPath): string[], no any, dir-level globs only, deduped; dist/lib/tsconfig-source-dirs.js emitted by build; code-reviewer APPROVED (review_reports/review_T-B6-01.md). T-B6-02 (test rewrite): AC-B5.5 block in test/release-staging.test.mjs now imports and calls getTsConfigSourceDirs against live tsconfig.json, adds trailing slashes, asserts every returned dir appears in FEATURE_DIRS, includes 6-dir baseline sanity check; EXCLUDED_DIRS and METADATA_PATTERNS constants fully removed; error message matches spec string S-B6-01. Gates: tsc build zero errors; npm audit --audit-level=high zero HIGH/CRITICAL (pre-existing MODERATE hono non-gating); npm test 634/634 pass 0 fail. Pre-existing 66-task drift (T470-T-SCOPE-QA) reported and not reconciled per instructions. Phase 1.5 skipped — no design/ file, non-UI feature."


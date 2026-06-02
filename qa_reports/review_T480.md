# QA review — T480

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-02T10:46:52.202Z — PASS — by qa-engineer

T478 (transport/ HTTP staging): code-reviewer APPROVED; AC-B5.5 gatekeeper now covers transport/ — ok 279 PASS. T479 (test/release-staging.test.mjs): removed transport from EXCLUDED_DIRS, added transport/ to FEATURE_DIRS — AC-B5.5 test (ok 279) now detects transport/http.ts. T480 (test/subagent-templates.test.mjs): upgraded version regex escape from dots-only to full escapeRegExp idiom — AC8 version test (ok 360) PASS. Full suite: 499 tests, 0 fail, 0 skip. npm run build ZERO errors, check-version OK (3.23.1), npm audit 0 high vulns. QA report: qa_reports/review_T478-T480.md.


# QA Review — T310

T310 (sr-engineer SOP edit to `content/skill-researcher.md`) was verified as
part of the same round as T311. Full Phase 1–4 detail in
`qa_reports/review_T311.md`.

## Verdict
PASS — the SOP edits implement AC-1..AC-4 (standalone default-deep,
`/deep-research` invocation at deep depth, manual fallback, shallow path
unchanged); each AC is covered by a passing test in
`test/researcher-deep-research.test.mjs`. Full suite 403/403 green.
## 2026-05-30T09:44:55.824Z — PASS — by qa-engineer

AC-1..AC-5 each mapped to a passing test (test/researcher-deep-research.test.mjs); copy/visual gates clear; full suite 403/403 green; build clean.


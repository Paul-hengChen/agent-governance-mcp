# QA review — T-E322-01

Verdict: PASS. See qa_reports/review_T-E283-01.md (covers: T-E316-01, T-E283-01, T-E322-01) for the shared AC Execution Log, rulings and full-suite result.

AC-E322-1..9 mapped to test/e322-owners.test.mjs (11/11 pass). Notes: `--paths -` compared on HIT lines, summary and exit code (source note differs by design); RANGE_INVALID is stricter than spec (also refuses `..` inside a side and leading/trailing `.`), accepted and pinned.
## 2026-10-16T21:49:15.344Z — PASS — by qa-engineer

PASS. New tests e316 6/6, e283 13/13, e322 11/11. Hard conditions: validate sweep of 22 manifests matches spec table; render byte-identical vs dac6069 build (62/62). Full suite on clean HEAD 155ee22: 3262 tests, 3259 pass, 0 fail, 3 pre-existing history-dependent skips. RANGE_INVALID is stricter than spec (accepted). See qa_reports/review_T-E283-01.md.


# QA review — T-E145-02

## 2026-09-25T00:00:00.000Z — PASS — by qa-engineer

PASS (re-verification, evidence-only, no code changed this hop). T-E145-02 (test authorship for
the `findCitationQuoteRanges()` exclusion fix in `scripts/check-md-tables.mjs`) shipped alongside
T-E145-01 in v3.113.0 (merge commit `43227b3`, `Merge branch 'feat/e145-md-tables-cited-donemark'`)
but its `tasks.md` ledger row (line 1027) stayed `[ ]` after the merge — the ledger entry was
lost, not the work (E150 shape). `tw_detect_drift` on this workspace confirms: no drift, but
T-E145-01/T-E145-02 listed in `fanoutAdvisory` as active-scope tasks not yet recorded complete.

**Ground truth on HEAD** (`fb9bc91`): `test/check-md-tables.test.mjs` still carries the 9
`CQ-*` cases plus the `CQ-9` row-identity non-regression case named in T-E145-02's dispatch
brief, extending the existing `mkFixtureRepo` harness (no new test file), matching the archived
review.

**Original evidence** (verified present, not re-authored):
`qa_reports/archive/e145-md-tables-cited-donemark/review_T-E145-01.md` and
`review_T-E145-02.md` — qa-engineer PASS covering both T-E145-01 and T-E145-02: all 9 named
`CQ-*` cases (CQ-CITED-MARK-SUPPRESSED, CQ-MULTI-CANDIDATE, CQ-GENUINE-OUTSIDE-QUOTE,
CQ-UNPAIRED-OPENER, CQ-CELL-START, CQ-CELL-END, CQ-ESCAPED-PIPE-IN-CITATION,
CQ-BOLD-RUN-NOT-AN-OPENER, CQ-RESIDUAL-SPAN-SWALLOW) plus CQ-9 authored, 49/49 targeted pass,
full suite green on re-run, build clean, real-corpus `npm run check:md-tables` exit 0 with
exactly the 4 true-positive advisories and the E145 row itself silent, `npm audit
--audit-level=high` clean of HIGH/CRITICAL.

**Re-run this hop** (current committed tree, HEAD `fb9bc91`, no restart of the running
pre-e125a MCP server, no code touched): `node --test test/check-md-tables.test.mjs` →
**49/49 pass**, matching the archived report's count exactly (39 pre-existing + 10 new,
including all 9 `CQ-*` cases and `CQ-9`).

Verdict: PASS. Evidence: this file plus the archived reports cited above; merge `43227b3`;
shipped v3.113.0.

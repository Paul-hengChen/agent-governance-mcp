# QA review — T-E145-01

## 2026-09-25T00:00:00.000Z — PASS — by qa-engineer

PASS (re-verification, evidence-only, no code changed this hop). T-E145-01 and T-E145-02
shipped in v3.113.0 (merge commit `43227b3`, `Merge branch 'feat/e145-md-tables-cited-donemark'`)
but their `tasks.md` ledger rows (lines 1026–1027) stayed `[ ]` after the merge — the ledger
entry was lost, not the work (E150 shape: a merged parallel lane's ledger can be discarded on
conflict). `tw_detect_drift` on this workspace confirms: no drift, but T-E145-01/T-E145-02
listed in `fanoutAdvisory` as active-scope tasks not yet recorded complete.

**Ground truth on HEAD** (`fb9bc91`): `scripts/check-md-tables.mjs` still carries E145's change —
`findGenuineDoneMark()` (line 211) calls `findCitationQuoteRanges()` (line 187) to exclude
done-marks that are only quoted inside a citation span (e.g. `*"...[x]..."*`) from the E88
buried-done-mark advisory, matching the archived review.

**Original evidence** (verified present, not re-authored):
`qa_reports/archive/e145-md-tables-cited-donemark/review_T-E145-01.md` and
`review_T-E145-02.md` — code-reviewer APPROVED T-E145-01
(`findCitationQuoteRanges()` exclusion fix), qa-engineer PASS on both, covering:
9 named `CQ-*` cases + 1 row-identity non-regression case added to
`test/check-md-tables.test.mjs`, full suite green, `npm run check:md-tables` on the real
corpus exit 0 with exactly the 4 true-positive advisories (E39/E40/E58/E59) and the E145 row
itself silent, `npm audit --audit-level=high` clean of HIGH/CRITICAL.

**Re-run this hop** (current committed tree, HEAD `fb9bc91`, no restart of the running
pre-e125a MCP server, no code touched): `node --test test/check-md-tables.test.mjs` →
**49/49 pass**, matching the archived report's count exactly (39 pre-existing + 10 new).

Verdict: PASS. Evidence: this file plus the archived reports cited above; merge `43227b3`;
shipped v3.113.0.

<!-- @code-reviewer | task_id: T-QAVBP-01 | feature_id: qa-visual-baseline-provenance | reviewed_at: 2026-06-16 -->

# Code review — T-QAVBP-01

This task id is reviewed as part of feature `qa-visual-baseline-provenance`.
Full seven-section review report (Round 1 + Round 2) lives in:
`review_reports/review_qa-visual-baseline-provenance.md`.

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Single BLOCKING defect: T-QAVBP-03 SOP edits pushed `content/skill-qa-visual.md` 1881 bytes over the 15000-byte budget (`test/qa-visual-skill-split.test.mjs:129`), turning `npm test` RED. Gate/parser logic verified correct. See consolidated report.

## Round 2 — APPROVED — by code-reviewer

Sole Round-1 blocker RESOLVED: `content/skill-qa-visual.md` = 14993 bytes (<= 15000 cap), `npm test` 634/634 green. All four machine-anchored strings survived compression verbatim (`### <surface id>` heading, `baseline:`/`diff-metric:` fields, carry-forward token, B1-fallback token) — grep + runtime confirmed. Emphasis-strip hardening in `tools/evidence-file.ts` closed the Round-1 `**baseline:**` leak without breaking the placeholder blacklist or carry-forward/fallback token matching (runtime-verified against dist/). Both Round-1 non-blocking notes addressed. `index.ts` unchanged this round (+31/-0 prior-APPROVED wiring). No acceptance criterion regressed. 2 pre-existing HIGH npm-audit advisories (esbuild/tsx, @xenova/transformers) NOT introduced by this diff — out-of-scope, do not block.

Verdict: `APPROVED`. See `review_reports/review_qa-visual-baseline-provenance.md` for the full seven-section report.

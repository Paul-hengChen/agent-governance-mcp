# QA review — T-ORM-03

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-16T11:27:58.971Z — FAIL — by qa-engineer

T-QAVBP-04: test file authored (test/evidence-provenance.test.mjs, 34 tests). 667/668 pass. 1 sentinel test fails — exposing a real parser defect in tools/evidence-file.ts. BASELINE_LINE_RE and DIFF_METRIC_LINE_RE use `.+?` as the capture group with a trailing `\s*$`. Because `\s` matches `\n`, the regex engine satisfies `(.+?)` lazily by consuming the newline via the trailing `\s*` and then capturing the NEXT line. Reproduction: body = 'baseline:   \n- diff-metric: B1 tool unavailable — LLM fallback\n' → parser captures 'B1 tool unavailable — LLM fallback' as fingerprint (not null). This silently bypasses AC-1: a B1-fallback surface with NO real baseline value would pass the gate because the diff-metric token is not in FINGERPRINT_PLACEHOLDERS. Fix required: change .+? to [^\n]+? in BOTH BASELINE_LINE_RE and DIFF_METRIC_LINE_RE in tools/evidence-file.ts (lines 593–594), then npm run build. Pre-existing 2 HIGH npm audit advisories (esbuild/tsx, @xenova/transformers) noted — NOT introduced by this feature, waiver stands.


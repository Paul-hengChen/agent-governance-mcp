# QA Review — T-CI-FIX-01: Restore green CI post v3.38.0 budget cap bump

**Date:** 2026-06-17
**Reviewer:** qa-engineer (claude-sonnet-4-6)
**Status:** PASS

## Summary

CI on `main` was red after the v3.38.0 release (commit 45f8d23). Two qa-owned budget tests
failed because intentionally shipped F0/F2 content grew past stale caps that were never
bumped before release.

## Legitimacy Verification

Both overages confirmed as legitimate, intentionally-shipped content:

- **F0 (c02372a, qa-visual-baseline-provenance-gate)**: Added VISUAL_PROVENANCE_MISSING SOP
  prose to `content/skill-qa-visual.md` — provenance metadata rules, `baseline:`/`diff-metric:`
  line conventions. Net change +182 lines (includes token-reduction tightening). `git show
  c02372a --stat` confirms `content/skill-qa-visual.md` as the primary content change; full QA
  evidence exists in `qa_reports/review_T-QAVBP-*.md`.

- **F2 (258435a, retro-sop-hardening)**: Added Step A.5 fidelity baseline scope validation guard
  to `content/skill-qa-visual.md` (+9 lines) and a scope-creep visual-fidelity example to
  `content/skill-coordinator-lite.md` (+1 long line). Full QA evidence in
  `qa_reports/review_T-RSH-QA.md`.

No accidental bloat or duplication found.

## Cap Bump Details

### Test 1: `test/qa-visual-skill-split.test.mjs:129` (AC-5)

| | Value |
|---|---|
| File | `content/skill-qa-visual.md` |
| Actual size | 15804 bytes |
| Old cap | 15000 bytes |
| Overage | +804 bytes |
| New cap | 16200 bytes |
| Headroom | ~396 bytes (consistent with ~350–550-byte convention) |
| Driver | F0 provenance SOP + F2 Step A.5 guard |

### Test 2: `test/context-budget.test.mjs:103` (AC2)

| | Value |
|---|---|
| Bundle | lean always-on (stripChainOnly constitution + skill-coordinator-lite.md) |
| Actual tokens | 2791 ~tok |
| Old cap | 2700 ~tok |
| Overage | +91 ~tok |
| New cap | 2850 ~tok |
| Headroom | ~59 tok (consistent with v3.28.0 ~59-token convention) |
| Driver | F2 scope-creep visual-fidelity example in skill-coordinator-lite.md |

Both rationale comments follow the established inline-comment style (version citation, what drove
growth, actual measurement, headroom).

## Phase 1 — Review Findings

No correctness issues. Both edits are surgical cap bumps in qa-owned test files. No content/*.md
files modified (sr-engineer domain). No schema, server, or build changes.

## Phase 1.5 — Visual Compare

Skipped — no Visual Baselines declared for this task.

## Phase 2 — Discussion

No issues found. Proceeding directly to Phase 4.

## Phase 3 — Tests

Existing tests cover the invariants. No new tests needed — the cap-bump edits ARE the test
changes. Mapping:

- AC-5 in qa-visual-skill-split.test.mjs → byte-count invariant for skill-qa-visual.md
- AC2 in context-budget.test.mjs → lean bundle token-count invariant

## Phase 4 — Run

`npm test` result: **668 tests, 668 pass, 0 fail, 0 skip**

`npm audit --audit-level=high`: 8 vulnerabilities (3 high, 5 moderate) — all pre-existing
transitive deps in `@xenova/transformers → onnxruntime-web → onnx-proto` and `esbuild` via
`tsx`/`hono`. Not introduced by this change. Waived per Constitution §6 — same rationale as
v3.37.0 and v3.38.0 releases.

## Conclusion

Overage was from legitimate, QA-PASS'd v3.38.0 content. Caps bumped to fit current sizes plus
documented headroom. CI is green.

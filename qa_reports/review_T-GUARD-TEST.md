# QA review — T-GUARD-TEST

<!-- Auto-written by qa-engineer per SOP Phase 4. -->

## Phase 1 — Spec/Copy/Visual Audit

No Copy/Strings section in spec. No Visual Baselines. Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3 — Test authorship notes

New file: `test/constitution-deliverable-guard.test.mjs`

### Spec-to-Test Map (all 7 deliverables covered)

| Deliverable | AC | Test name(s) |
|---|---|---|
| A3 (version header) | Version header ≥ v3.27, not stale v3.14.1 | t-a3-version-header |
| A1 (tw_sync pre-flight) | tw_sync in §3 pre-flight bullet | t-a1-tw-sync-preflight |
| A2 (visual schema gate) | VISUAL_REPORT_INCOMPLETE, VISUAL_ASSERTIONS_REQUIRED, all 6 section names | t-a2-visual-report-incomplete, t-a2-visual-assertions-required, t-a2-required-sections |
| A4 (wording correction) | New phrase present, old phrase absent | t-a4-new-wording-present, t-a4-old-wording-absent |
| B1 (terse carve-outs) | 'assumption gap' and 'acceptance criteria' present | t-b1-assumption-gap, t-b1-acceptance-criteria |
| B2 (design-baseline scope) | 'scope baseline' and 'fidelity defect' present | t-b2-scope-baseline, t-b2-fidelity-defect |
| B3 (intra-section priority) | Override markers, circuit-breaker phrase, inter-document priority | t-b3-override-markers, t-b3-circuit-breaker, t-b3-inter-document-priority |

### REQUIRED_VISUAL_SECTIONS sync

The test parses `REQUIRED_VISUAL_SECTIONS` directly from the source TS (`tools/evidence-file.ts:342`) via regex, so it self-syncs if the array is modified and the project is rebuilt. No hard-coded list.

### Coverage Gate

14 new tests added. All 558 total tests pass (0 fail, 0 skip, 0 cancel). Previous baseline: 544.

### Sanity-check: would the guard turn RED if a marker were removed?

Yes — every assertion uses `assert.ok(CONSTITUTION.includes(...))` or `assert.match`. Removing any of the asserted strings from `content/constitution.md` causes an immediate `AssertionError` with a message pointing to the specific deliverable.

## Phase 4 — Run results

- `npm run build`: exit 0 (tsc clean, check-version OK — v3.28.0)
- `npm test`: 558 pass / 0 fail / 0 skip
- `node scripts/check-version.mjs`: OK (3.28.0)

## Verdict

PASS
## 2026-06-08T08:49:42.327Z — PASS — by qa-engineer

T-GUARD-TEST PASS. Created test/constitution-deliverable-guard.test.mjs with 14 tests covering all 7 v3.27.0 deliverables (A1-A4, B1-B3). REQUIRED_VISUAL_SECTIONS parsed live from tools/evidence-file.ts:342 — self-syncing. npm test: 558 pass / 0 fail (was 544; +14). npm run build: exit 0. check-version.mjs: OK (3.28.0). Evidence: qa_reports/review_T-GUARD-TEST.md.


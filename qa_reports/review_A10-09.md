# QA review — A10-09

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-07T17:03:55.730Z — PASS — by qa-engineer

gate-registry (A10+A2 folded in) PASS. Rewrote test/error-code-contract.test.mjs as the generative registry-parity test (imports dist/gates/registry.js; asserts 18-in/18-out, registry<->code shape-rule harvest parity incl. gates/*.ts, doc<->registry subset in both directions, hintStatic/producer internal consistency, and DR-8: TransitionRejection[\"error\"] 12-member union subset of ALL_GATE_CODES). Verified all 8 spec-listed + 4 architecture-flagged import retargets already correct with assertions unmodified (AC-2). Phase gates: npm run build zero errors; npm audit --audit-level=high clean; npm test 872/872 pass (868+4 net new assertions); boot smoke test confirmed \"online\" on stderr. Bookkeeping: version 3.46.0->3.46.1 (package.json + index.ts, verified via scripts/check-version.mjs), CHANGELOG.md entry added, docs/backlog.md A10+A2 marked done (table rows + section headers). All 8 ACs verified — see qa_reports/review_A10-10.md.


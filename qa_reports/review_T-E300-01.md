covers: T-E300-01, T-E300-02, T-E300-03, T-E300-04

# QA review: e300-dispatch-pins-enum

Code: dc3dc7a (code-reviewer APPROVED in review_reports/review_T-E300-01.md, bb0f861). Tests: T-E300-04 (this commit).

## Expected-Red Diff

Phase 0.5: clean (12/12 manifest entries confirmed red, 0 unexplained reds). Confirmed by running the five affected files
(dispatch-pins, error-code-contract, e26-gate-stats, e35-pipeline-order, telemetry) BEFORE any edit: exactly the 12 manifest
entries failed; telemetry.test.mjs was green. Code-reviewer's full-suite run independently reported 12/3045 reds, all on the manifest.
All 12 are count/shape pins on the pre-E300 rule (33 gates, min/max zod codes, mapping comment, pipeline parity), re-baselined in the tests, code untouched.

## Spec-to-test map

- Enum accepts opus/sonnet/haiku/fable for all 8 roles: dispatch-pins E300-Z8.
- Out-of-enum (dated model id, empty, >100, wrong case) rejected; path `["dispatch_pins","<role>"]`; message names value + DISPATCH_PIN_TIER_REJECTED: Z2, Z3, E300-Z9, E300-Z11.
- One issue per bad role; good siblings unflagged: E300-Z10. Unknown key still rejected: Z1, E300-Z12.
- parseHandoff keeps out-of-enum on-disk value; empty/>100 still dropped: E300-P6, P2, P3.
- tw_get_state advisory {pins, allowed, hint}, dispatch_pins raw; clean/no pins byte-identical (===) to storage text, no advisory key: E300-R1, R2, R3.
- 34th GATE_REGISTRY entry, tool-boundary producer, in no pipeline step, documentedInProse false, "(none)" mapping row, SUFFIX_RE match, code literal in tools/registry.ts: error-code-contract (AC-1/AC-5, doc-file mapping, AC3 allowlist, three E300 tests), e35 parity + E300 test, e26 34-code coverage.
- telemetry: PRODUCER3 already round-trips every registry producer including tool-boundary; no change (a PRODUCER4 would be redundant).

## Notes

Code-reviewer notes (a) enum literal duplication, (b) stale "no gate"/"File-mode only" wording in tools/registry.ts, (d) dedup polish: non-blocking, deferred to the MODEL_TIERS wiring ticket.
Note (c) filed as E300-NEW-1 in .current/e300/pending-tickets.md: zod rejections never reach emitGateTelemetry, tw_gate_stats always shows the code as zero_fire.
Shared generated files (content/**, test/fixtures/compose-golden/**, test/context-budget.test.mjs) untouched. No `proof:` lines in the spec: Phase 3.5 skipped.

## Full-suite result

Post-commit (29db6ba, clean tree), `node scripts/test-lock.mjs -- npm test`: 3058 tests, 3055 pass, 0 fail (remainder skipped). `npm run build`: zero errors, tree stayed clean (no dist drift). `npm audit --audit-level=high`: no HIGH/CRITICAL (2 low, 6 moderate).
## 2026-10-14T11:16:47.486Z — PASS — by qa-engineer

PASS. Phase 0.5 clean: 12/12 manifest reds confirmed pre-edit, 0 unexplained. Tests re-baselined/added in dispatch-pins (enum accept/reject, issue path/message, per-role issues, parse keeps out-of-enum, tw_get_state advisory + byte-identical clean/no-pin), error-code-contract (34 entries, "(none)" mapping marker, allowlist, tool-boundary checks), e26 (34), e35 (parity minus tool-boundary + only-tool-boundary assertion). telemetry untouched (PRODUCER3 already covers it). Post-commit full suite 3058 tests / 3055 pass / 0 fail / 3 skipped; build zero errors; audit no HIGH/CRITICAL. content/**, compose-golden, context-budget untouched. Reviewer notes a/b/d deferred to the MODEL_TIERS wiring ticket; note c filed as E300-NEW-1.


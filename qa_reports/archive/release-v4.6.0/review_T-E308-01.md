# QA review — T-E308-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-15T07:43:23.667Z — PASS — by qa-engineer

covers: T-E308-01, T-E303-01, T-E308-02. Phase 0.5 skipped (no expected-red manifest). Phase 1.5 skipped (no Visual Baselines). Phase 3.5: no proof-annotated-run required beyond tests; AC proofs were executed (below).

## AC Execution Log
AC1 PASS: grep literal array in tools/handoff-parse.ts = 0; DISPATCH_PIN_TIER_VALUES === MODEL_TIERS (same reference, asserted in test/e308-single-source-tier-enum.test.mjs + test/skill-frontmatter.test.mjs).
AC2 PASS: grep 'enum: ["opus"' tools/registry.ts = 0; eight inputSchema enums deep-equal [...MODEL_TIERS], eight distinct arrays (test/dispatch-pins.test.mjs E308-S1).
AC3 PASS: rejection message === 'DISPATCH_PIN_TIER_REJECTED: "<echo>" ' + hintStatic byte-for-byte; hintStatic literal unchanged (test/error-code-contract.test.mjs E308/AC3).
AC4 PASS: no literal 'opus, sonnet, haiku, fable' in tools/handoff-orchestrator.ts; E300-R1/R2/R3 pass unmodified.
AC5 PASS: DispatchPinTier appears nowhere in tools/ or gates/ (0 hits).
AC6 PASS (scoped per reviewer ruling a): neither stale phrase in the dispatch_pins zod comment block or inputSchema description; spec gate-sentence present verbatim; DISPATCH_PIN_TIER_REJECTED count >= 3.
AC7 PASS: skill-frontmatter, e297-main-protected-sop, dispatch-pins suites green unmodified (54/54); git diff vs base on schema/ and index.ts empty.
AC8 PASS: bad tier + existing absolute temp ws appends exactly one {gate:tool-boundary,error_code:DISPATCH_PIN_TIER_REJECTED,agent_id,feature} line; agent_id/feature absent or non-string -> null; relative ws -> ZodError, nothing written; non-existent absolute ws -> nothing created; non-gate-coded ZodError (missing active_feature) -> no line (test/telemetry.test.mjs E303-T1..T5). Reviewer ruling b respected (real temp dir).
AC9 PASS: rethrown error is a ZodError with identical issues/message vs a no-emit run (T6) and vs a broken sidecar (E303-THROW; .current/_primary is a regular file). Same-instance identity is not externally observable; verified by code reading (throw err in catch).
AC10 PASS: after one rejection tw_gate_stats lists DISPATCH_PIN_TIER_REJECTED under fired count 1, absent from zero_fire; with zero telemetry stays in zero_fire (test/e303-zod-boundary-telemetry.test.mjs); test/e26-gate-stats.test.mjs unchanged and green (34).
AC11 PASS: gates/registry.ts diff vs base c392cc3 comment-only (0 non-comment changed lines); mapping line present once; (none) = 0; hintStatic line once; git diff index.ts empty (SHA lookups guarded with rev-parse --verify + loud t.skip).
AC12 PASS: 34 entries; tool-boundary is the sole DISPATCH_PIN_TIER_REJECTED producer; e35-pipeline-order and error-code-contract green unmodified.
AC13 PASS: tests added per below; full suite on clean tree.

## Tests added
test/dispatch-pins.test.mjs: +1 (E308-S1). test/skill-frontmatter.test.mjs: +1 (single-source ref). test/error-code-contract.test.mjs: +1 (AC3 byte-equality + 34). test/telemetry.test.mjs: +7 (E303-T1..T6, E303-THROW). test/e303-zod-boundary-telemetry.test.mjs: new, 2. test/e308-single-source-tier-enum.test.mjs: new, 10. e26 and e35 untouched.

## Full suite
node scripts/test-lock.mjs -- npm test on HEAD 46d3ada (clean tree, git status --porcelain empty): 3147 pass / 3150 total, 0 fail, 3 skipped (pre-existing HISTORY-DEPENDENT guards in e130 AC4/AC14 and a const-15 AC6, base shas absent; none from this lane). npm audit --audit-level=high exits 0 (6 moderate/2 low only). Shared generated files (content/**, compose-golden, context-budget) not touched by this lane and green. A trailing evidence-only commit follows HEAD 46d3ada.

## Follow-ups filed (.current/e308/pending-tickets.md)
E303-NEW-1 (reviewer C1: workspace_path=<ws>/.current emits under .current/.current/_primary). E308-NEW-1 (reviewer Q1: tier literals remain in inputSchema description and gates clearingArtifact/hintStatic; only hintStatic guarded).


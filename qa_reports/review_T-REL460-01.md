# QA review — T-REL460-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-16T05:34:54.914Z — PASS — by qa-engineer

Release regression resolved (human ruling: stop comparing with lane base c392cc3; assert on content). Only test/e308-single-source-tier-enum.test.mjs changed. E303-AC11b now asserts the gates/registry.ts mapping line is exactly one whole line '//   DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md'. E303-AC11c now asserts index.ts contains no /emit\w*Telemetry/ and tools/registry.ts contains emitZodGateTelemetry (E303 emission lives in tools/), so the Server() version-literal bump no longer trips it. BASE/baseMissing/skipIfBaseAbsent/git helper and execFileSync import removed (no other users). Verification on the bumped tree: single file 10/10 pass, 0 skipped; full npm test under test-lock exit 0: 3185 tests / 3182 pass / 0 fail / 3 skipped. Negative control in a scratch copy outside the worktree (no git stash): appending an emitGateTelemetry call to index.ts and altering the registry mapping line made AC11c, AC11b (and AC11a) fail; 7 others stayed green. Release edits untouched; nothing committed. Phase 0.5/1.5/3.5 not applicable (no manifest, baselines, or proof ACs). Next: release-engineer re-enters release flow; the test fix is uncommitted on release/v4.6.0, coordinator/release-engineer decide how it lands.


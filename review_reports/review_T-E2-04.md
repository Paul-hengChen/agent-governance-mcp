# Review — T-E2-04

covers: T-E2-01, T-E2-02, T-E2-03

Batched adversarial review of feature `e2-bugfix-repro-gate` against
`specs/e2-bugfix-repro-gate.md` (PM spec) and
`specs/e2-bugfix-repro-gate-architecture.md` (architect blueprint). Clean-context:
diff vs HEAD + the two binding specs + the sr-authored expected-red manifest
(SOP step 4a carve-out) only.

## Summary
- **T-E2-01** adds first-class handoff field `dispatch_mode?: "feature" | "bugfix"`, schema `handoff` v10→v11 (stamp-only), across `tools/handoff.ts` (type/parse/carry-forward/emit), `schema/versions.ts`, `schema/migrations-handoff.ts`, `tools/registry.ts` (zod + JSON-schema), `tools/handoff-orchestrator.ts` (pass-through), `docs/schema-versions.md`.
- **T-E2-02** adds the `REPRO_MANIFEST_MISSING` plain-text orchestrator gate (`gates/registry.ts` 25→26; `tools/handoff-orchestrator.ts` gate block); `gates/expected-red.ts` and `tools/transitions.ts` untouched, exactly per DR-2/DR-5.
- **T-E2-03** adds bugfix-mode guidance to `content/skill-{pm,sr-engineer,qa-engineer}.md`; feature-mode QA Phase 0.5 language byte-unchanged (AC5).
- Build clean (`tsc`), 1193 pass / 42 fail. All 42 fails are manifested expected-reds; zero unexplained reds. Every pinned architecture decision (DR-1…DR-8) is honored verbatim.
- Verdict: **APPROVED**.

## Correctness
No findings.
- Gate arming condition (`tools/handoff-orchestrator.ts:346-353`) matches the blueprint's Interface Contract exactly: `storage instanceof FileHandoffStorage && prevState?.dispatch_mode === "bugfix" && prevTuple.agent === "sr-engineer" && prevTuple.status === "In_Progress" && nextTuple.agent === "code-reviewer" && nextTuple.status === "In_Progress"`. All five referenced locals are in scope (`storage` = `getActiveStorage()` :95, `prevState` :96, `prevTuple` :109, `nextTuple` :113; `FileHandoffStorage` imported :22, `hasExpectedRedManifest` :46, `gate` :49).
- AC6 (never silent-skip, never throw): on manifest-absent the gate returns an `isError` result (blocks); on manifest-present it falls through; on non-bugfix it is skipped entirely. The Blocked escape edge (sr-engineer→pm) has `nextTuple.agent === "pm"`, so the gate never fires there — escalation is always available. Confirmed.
- Carry-forward (`tools/handoff.ts:883-887`) correctly mirrors the `dispatch_pins` scalar algorithm: explicit value wins; omitted + same `active_feature` carries `existing.dispatch_mode`; omitted + feature change drops to undefined (absence = feature). `dispatchModeNeedsExisting` is correctly OR-ed into the `existing`-read trigger (:838-846). No cut_approved-style re-arm clause, so PM re-entry does not silently flip the mode — matches AC4/DR intent.
- Migration `v10→v11` (`schema/migrations-handoff.ts:135-140`) is stamp-only, seeds no default — correct per DR-1/DR-8; single registration, no duplicate.
- Emit (`tools/handoff.ts:916`): `if (effectiveDispatchMode) frontmatterData.dispatch_mode = ...`. An explicit `"feature"` opt-out (AC4) is materialized, which correctly overrides a sticky on-disk `"bugfix"`; the gate only arms on `=== "bugfix"`, so a materialized `"feature"` is behaviorally identical to absence. No defect.

## Quality
No findings.
- Naming is consistent across the pre-crash (T-E2-01) and post-crash (T-E2-02/03) halves: `dispatch_mode` / `DispatchMode` / `dispatchMode` / `effectiveDispatchMode` / `DISPATCH_MODE_VALUES` used uniformly; the parser reuses the shared `parseEnumField` helper (:381) rather than a bespoke branch.
- No duplicate or half-applied edits: single `dispatch_mode?` field decl, single migration step, single gate block (the two `REPRO_MANIFEST_MISSING` hits in the orchestrator are the message string + the `gate()` lookup within one block). Frozen-order header comment (:8-15) updated additively; registry doc-map + count comments updated to 26.

## Architecture
No findings. The implementation is a faithful realization of every pinned decision: first-class handoff field (DR-1), C15 manifest reused verbatim via `hasExpectedRedManifest` with no new predicate (DR-2), orchestrator plain-text gate sited after external-refs / before review-verdict-mismatch (DR placement), `transitions.ts` untouched (DR-5), file-mode-only persistence (DR on SQLite), and feature-scoped scalar carry-forward with no PM re-arm. Gate registry entry carries `producer: "orchestrator"`, `envelope: "plain-text"`, `documentedInProse: true`, `triggerEdge`/`armCondition`/`clearingArtifact` matching the Interface Contract.

## Security
No findings. `dispatch_mode` is a closed two-value zod enum rejected at the tool boundary (`tools/registry.ts:194`); the parser defensively drops out-of-enum raw YAML (absence = feature). No new trust boundary, no injection vector, no secret. The gate reads an existing in-repo file convention only.

## Performance
No findings. The gate adds one `hasExpectedRedManifest` filesystem stat, and only on the single bugfix-mode fix-phase edge (short-circuited behind four cheap tuple comparisons on non-bugfix chains). No hot-path change, no new loop, no algorithmic regression vs base.

## Expected-Red Sample Audit (SOP 4a)
Manifest `qa_reports/expected-red_e2-bugfix-repro-gate.txt` present; 42 structured entries across Groups A–D. Sampled 10 entries spanning all four groups — every one is a real, locatable test AND red for its manifested reason:
- **Group A** (v10→v11 bump): `dispatch-pins.test.mjs` "sanity: CURRENT_VERSIONS.handoff is 10" → AssertionError expected `10` actual `11`; also confirmed `handoff-versioning` / `stale-dispatch T10` / `dispatch-pins M2` locatable.
- **Group B** (25→26 gate count): `error-code-contract.test.mjs` "GATE_REGISTRY has exactly 25 entries" → `26 !== 25`, gate list confirms `REPRO_MANIFEST_MISSING` present between `EXPECTED_RED_DIFF_MISSING` and `VISUAL_BASELINES_REQUIRED`; AC3 free-text-closure entry located.
- **Group C** (I5b heuristic): `gates-expected-red.test.mjs` "I5b: source pins the guard" → "a FileHandoffStorage guard must precede the call site" — the indexOf heuristic lands on the new compound-if guard; the production gate IS correctly `FileHandoffStorage`-guarded, so this is test-heuristic fragility for qa to disambiguate, not a regression.
- **Group D** (skill-text caps): `context-budget.test.mjs` skill-pm ≤3196 / skill-sr ≤2138 and `qa-visual-skill-split` byte-budget → all exceeded by the T-E2-03 guidance growth, for qa re-baseline.

Full-suite cross-check: 42 failing tests, `comm -23` of failing-vs-manifest = **zero** failing tests absent from the manifest. Every red is a declared, genuine consequence of the diff — no logic regression. (The manifest's apparent 43rd line is the `# Format:` header, a harmless false positive.)

## Verdict
APPROVED — the diff realizes AC1–AC6 and every pinned architecture decision with zero correctness/quality/architecture/security/performance findings; all 42 reds are manifested expected-reds with zero unexplained failures.

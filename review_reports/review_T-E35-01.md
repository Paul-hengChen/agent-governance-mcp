# Review — T-E35-01 (E35 gate-pipeline extraction)

Commit under review: `fffe3d9` on `main`. Base: `fffe3d9~1`.
Spec: docs/backlog.md E35 row (2026-07-20). Model: opus (sr-engineer was fable — cross-model review, no same-model bias risk).

## Summary
- Refactor-only: `handleUpdateStateCore`'s inline gate sequence in `tools/handoff-orchestrator.ts` becomes a declarative `export const UPDATE_STATE_GATE_PIPELINE: readonly UpdateStateGateStep[]` (18 steps, first-rejection-wins). New `gates/pipeline.ts` holds the shared contract + `runUpdateStatePipeline`. `gates/registry.ts` = comment-only. dist/ rebuilt; state bookkeeping rides along.
- **Byte-verbatim claim VERIFIED mechanically**: after stripping only the step-wrapper scaffolding and normalizing the PASS-block split, the entire ~848-line gate-logic region is **line-for-line identical** between parent and commit (`diff` empty; 848 == 848). No error code, envelope, predicate name, or condition was altered.
- **Order VERIFIED**: 18 steps enumerate in the exact frozen sequence; the logic diff preserves sequence (a reorder would surface as changed lines — none did).
- **Control-flow equivalence VERIFIED**: PASS-block split is scope-safe, all `await`-bearing steps are `async`, ctx derivation is byte-identical and (as before) front-loaded.
- Full suite **1612/1612 green**, `tsc --noEmit` clean, no dist/ drift after rebuild. Zero test-file touches (§2 honored).
- Verdict: **APPROVED**.

## Correctness
No findings.

Verification performed (spot-verify + whole-region proof):
- Extracted parent (`fffe3d9~1`, 1358 lines) and commit (1543 lines) copies of `tools/handoff-orchestrator.ts`. Isolated the gate region (old lines 157–1113 vs the new pipeline array 119–1211), removed the mechanical scaffolding (`{`, `name:`, `codes:`, `run:…=>{`, `const {…}=ctx;`, `return null;`, closers) and normalized the PASS-guard split. Result: **zero logic-line differences** — the moved bodies are byte-verbatim, confirming the sr-engineer's central claim.
- High-risk gates spot-confirmed present and unchanged in-place within that identical region: FEATURE_LEASE (E1 + E10 lease-override audit), STAMP_PROVENANCE_SUSPECT (E18), the E23 evidence-schema-pinned paths (`evidenceSchemaPin`/`evidenceSchemaLabel` threaded through ctx and consumed byte-identically in the visual + AC-log steps), REVIEWER_COMPLETED_TASKS_REJECTED (C16/E32), MISSING_REVIEW_EVIDENCE (E32 code-reviewer evidence), and the 9-code PASS_VISUAL_SUBGATES step (`VISUAL_BASELINES_REQUIRED … PIXEL_GATE_ATTESTATION_MISSING`).
- **PASS-block split (highest control-flow risk)**: the old single `if (parsed.status === "PASS" && parsed.completed_tasks.length > 0)` block (parent line 787) that wrapped evidence + visual + expected-red + AC-log was split into 4 steps, each re-establishing the same guard. Confirmed scope-safe: `ev` (evidence local) is referenced only at parent lines 788–793; `armCheck`/`visualGate` only at 805–887 — no local crosses a split boundary, so no now-out-of-scope reference. First-rejection-wins reproduces the old early-return short-circuit exactly, in the same order, with no side effects in these read-only steps.
- **Async correctness**: every step whose body contains `await` (`QA_REVIEW_RECORD`, `PASS_MISSING_EVIDENCE`, `MISSING_REVIEW_EVIDENCE`) is declared `run: async`; `runUpdateStatePipeline` does `await step.run(ctx)`, so sync and async steps are both handled and short-circuit identically.
- **Mid-pipeline side effect**: the sole side effect (`storage.recordReview` in `QA_REVIEW_RECORD`) stays at its original position (step 12, after REVIEWER_COMPLETED_TASKS_REJECTED, before QA_COMPLETION_EVIDENCE_MISSING), preserving the "record first so the evidence gate observes it" ordering.
- **ctx front-loading (#3c)**: the derivation block (prev-state parse, round/hop inputs, `feature_changed`, evidence-schema pin, prev/next tuples) is byte-identical to the parent and — as in the parent — runs before any gate. No derivation was newly hoisted ahead of a gate that could previously reject first; no new reachability on states the old code never parsed.

## Quality
No blocking findings.
- The file grew 1358 → 1543 lines (+185), entirely from the 18 step-wrapper envelopes (name/codes/run/destructure/return/braces). This is the unavoidable cost of expressing order-as-data while keeping bodies in-file. Justified — see Architecture.
- The per-step `codes: [...]` arrays are hand-maintained doc/data companions with no runtime consumer yet; they exist to be asserted by the qa-owned order-pin test. Acceptable as-is; the QA hop is expected to lock them.
- The FROZEN-order header comment now also lists the E3 AC-execution-log gate (the parent comment omitted it though the gate already existed inline) — a stale-comment fix, non-behavioral.

## Architecture
Fits the stated A10 → E35 progression (registry = gate metadata as data; pipeline = gate order as data). Import DAG stays acyclic: `gates/pipeline.ts` uses only `import type` back-edges. The decision to keep gate bodies in `tools/handoff-orchestrator.ts` rather than relocating them to `gates/pipeline.ts` is **genuinely constrained, not cosmetic**: `test/error-code-contract.test.mjs` (lines 302, 528) reads the orchestrator source and asserts every orchestrator-producer error code and armCondition predicate name appears literally in that file; `test/gates-expected-red.test.mjs:333` and `test/ac-execution.test.mjs:403` read the same source for guard byte shapes. Moving the bodies out would break these suites. The trade-off delivers the ticket's value — check order is now data (enabling a name/codes order-pin test to replace the frozen-additive comment) and every future gate gets a declarative insertion slot — so this is not a cosmetic wrapper.

## Security
No findings. No new trust boundary, no new input parsing, no secrets. Rejection envelopes are byte-identical, so no information-disclosure delta.

## Performance
No findings. Same gate work, same single ctx derivation per write (previously also once, up front). The pipeline is a linear pass over 18 steps with identical short-circuit — no added I/O, no new allocation in a hot path, no complexity-class change vs base.

## Verdict
APPROVED — refactor is behavior-preserving: whole gate region byte-verbatim, order and short-circuit semantics identical, PASS-block split scope-safe, async handling correct, transitions.ts/zod/deps untouched, no test-file edits, suite 1612/1612 green and tsc clean. The order-pin test is correctly deferred to qa-engineer per Constitution §2.

// Coded by @sr-engineer
// E35 (e35-gate-pipeline-extraction) — gate-step pipeline contract for the
// tw_update_state orchestrator. Extends the A10 registry pattern (gates/
// registry.ts: gate METADATA as data) with the E35 half: gate ORDER as data.
//
// The ordered UPDATE_STATE_GATE_PIPELINE array itself lives in
// tools/handoff-orchestrator.ts — deliberately NOT here — because the
// per-gate emit bodies are byte-verbatim relocations of the pre-E35 inline
// blocks, and the source-pin suites assert their literals (error codes, arm
// predicate names, envelope keys, even guard indentation) against THAT file:
// test/error-code-contract.test.mjs (orchestrator-producer codes + AC2
// predicate names), test/ac-execution.test.mjs I5b, and
// test/gates-expected-red.test.mjs (compound/single-line guard shapes).
// This module is the shared, dependency-light contract: the ctx shape the
// orchestrator derives once per write, the step shape, and the
// first-rejection-wins runner.
//
// Runtime near-leaf: every import below is `import type` (erased at compile
// time) and runUpdateStatePipeline itself needs none of them at runtime, so
// the import DAG stays strictly acyclic — tools/registry.ts →
// tools/handoff-orchestrator.ts → gates/pipeline.ts, with only erased
// type-only back-edges.
// First-rejection-wins runner: execute steps in array order, return the
// first non-null rejection unchanged, else null (all gates passed). The
// check order IS the array order — no reorder, no merge, no early-return
// removal (frozen-additive, now asserted as data).
export async function runUpdateStatePipeline(pipeline, ctx) {
    for (const step of pipeline) {
        const rejection = await step.run(ctx);
        if (rejection) {
            return rejection;
        }
    }
    return null;
}
//# sourceMappingURL=pipeline.js.map
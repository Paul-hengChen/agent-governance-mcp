// Coded by @sr-engineer
// Gate-step pipeline contract for tw_update_state: the per-write context, the step
// shape, and the first-rejection-wins runner. Gate order is data, but the ordered
// UPDATE_STATE_GATE_PIPELINE array lives in tools/handoff-orchestrator.ts, where
// source-pin tests assert its literals. Every import here is `import type`, so the
// runtime import graph stays acyclic.
// Rationale: specs/e260d-comment-rationale.md (gates/pipeline.ts).
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
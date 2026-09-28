// Coded by @sr-engineer
// Scope Decision Gate predicate (A2 split — verbatim relocation from
// tools/evidence-file.ts, no behavior change).
//
// Constitution §3 scope-decision gate: when design/<feature>.md declares
// mode != no-design, a transition INTO build (architect/sr-engineer:In_Progress)
// from pm:In_Progress requires a recorded scope decision. This helper reports
// whether EITHER satisfying artifact is present:
//   (a) .current/feature-split.md exists (multi-feature split recorded), OR
//   (b) handoff field scope_decision === "single-feature" (attestation recorded).
// Existence/equality only — never parses file content. Never throws. The
// handoffState is the already-parsed PREV state (the attestation must have been
// recorded by the preceding pm:In_Progress write), so this does NOT re-read
// handoff.md.
//
// Registry linkage: the SCOPE_DECISION_REQUIRED hint is emitted at the
// orchestrator emit site via gate("SCOPE_DECISION_REQUIRED").hintStatic (DR-2);
// this predicate returns a boolean only, so no registry import is added here.
import * as fs from "fs";
import * as path from "path";
export function hasScopeDecision(workspacePath, handoffState) {
    const splitPath = path.join(workspacePath, ".current", "feature-split.md");
    if (fs.existsSync(splitPath))
        return true;
    return handoffState?.scope_decision === "single-feature";
}
//# sourceMappingURL=scope-decision.js.map
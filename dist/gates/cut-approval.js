// Coded by @sr-engineer
// Cut-Approval Gate predicate (A2 split — verbatim relocation from
// tools/evidence-file.ts, no behavior change).
//
// pm-cut-approval-gate. Reports whether the PREV handoff state carries an
// explicit cut approval. Pure equality check — never touches the filesystem,
// never throws. The handoffState passed in is the already-parsed PREV state
// (the attestation must have been recorded by the preceding pm:In_Progress
// write), mirroring hasScopeDecision's prev-state contract. Strict `=== true`:
// absence (undefined) and a literal `false` both fail the gate. There is NO
// filesystem fallback (unlike hasScopeDecision, which also honors
// .current/feature-split.md) — cut approval is a pure boolean with one source
// of truth, the handoff field.
//
// Registry linkage: the CUT_APPROVAL_REQUIRED hint is emitted at the
// orchestrator emit site via gate("CUT_APPROVAL_REQUIRED").hintStatic (DR-2);
// this predicate returns a boolean only, so no registry import is added here.
export function hasCutApproval(handoffState) {
    return handoffState?.cut_approved === true;
}
//# sourceMappingURL=cut-approval.js.map
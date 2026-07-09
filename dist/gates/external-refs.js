// Coded by @sr-engineer
// External-Refs Gate predicates (b8-external-ref-ledger, B8-03).
//
// Reports whether the PREV handoff state carries an external-reference ledger
// (`external_refs`) with at least one entry still `unresolved`. Pure data
// checks — never touch the filesystem, never throw. The handoffState passed
// in is the already-parsed PREV state (the ledger must have been recorded by
// the preceding pm:In_Progress write), mirroring hasCutApproval's prev-state
// contract.
//
// POLARITY (DR-3 — inverse of cut_approved): absence, an empty array, or an
// all-resolved ledger all CLEAR the gate (return false / []). Absence means
// "PM's Resource Audit Gate found zero external references" — a legitimate,
// common, non-blocking state — NOT an unresolved sentinel. Only an entry with
// state === "unresolved" blocks.
//
// Param type is deliberately loose (`state: string`, not ExternalRefState) so
// the predicate never couples to the enum and never throws on a hand-edited
// handoff — same defensive posture as hasCutApproval's `{ cut_approved?: boolean }`.
//
// Registry linkage: the EXTERNAL_REFS_UNRESOLVED hint is emitted at the
// orchestrator emit site via gate("EXTERNAL_REFS_UNRESOLVED").hintStatic;
// these predicates return data only, so no registry import is added here.
// Returns true iff the prev state carries >=1 entry with state === "unresolved".
export function hasUnresolvedRefs(handoffState) {
    const refs = handoffState?.external_refs;
    if (!Array.isArray(refs))
        return false;
    return refs.some((r) => r?.state === "unresolved");
}
// Returns the ordered list of `ref` values whose state === "unresolved"
// (for hint interpolation). Input order preserved so the hint enumerates
// refs deterministically. Empty array when none / field absent.
export function listUnresolvedRefs(handoffState) {
    const refs = handoffState?.external_refs;
    if (!Array.isArray(refs))
        return [];
    return refs.filter((r) => r?.state === "unresolved").map((r) => r.ref);
}
//# sourceMappingURL=external-refs.js.map
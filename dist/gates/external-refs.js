// Coded by @sr-engineer
// External-refs gate predicates: does the previous handoff state carry an
// external_refs entry still "unresolved"? Pure data checks; never touch the
// filesystem, never throw. Polarity is the inverse of cut_approved: absent, empty or
// all-resolved clears the gate. The state param is a loose string so a hand-edited
// handoff cannot throw; the hint is built at the orchestrator emit site.
// Design: specs/b8-external-ref-ledger-architecture.md.
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
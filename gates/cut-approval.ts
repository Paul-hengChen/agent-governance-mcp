// Coded by @sr-engineer
// Cut-approval gate predicate: true only when the previous handoff state (the
// preceding pm:In_Progress write) carries cut_approved === true. Absence and a
// literal false both fail. Unlike hasScopeDecision there is no file fallback:
// the handoff field is the one source of truth. Pure, never throws.
// Spec: specs/pm-cut-approval-gate.md.

export function hasCutApproval(
  handoffState: { cut_approved?: boolean } | null | undefined,
): boolean {
  return handoffState?.cut_approved === true;
}

// Coded by @sr-engineer
// Lease-override classifier (E10, e10-lease-override — mechanism 1).
//
// Classifies an incoming tw_update_state write's lease-override intent so the
// orchestrator can decide bypass vs reject INSIDE its FEATURE_LEASE_HELD
// branch (architecture DR-3: an override with nothing to bypass is an inert
// no-op — this module never sees writes where the lease is not held).
//
// `lease_override: true` is a human-attested escape hatch that bypasses
// FEATURE_LEASE_HELD for the write it is set on, on ANY edge (unlike
// cut_approved's build-entry pin — the lease can fire on any incoming write).
// It mirrors the cut_approved §3.1 attested-trust mechanics in shape
// (sanctioned writer = the context that directly witnessed the human's
// chat-turn attestation), with a STRICTER audit requirement: the write MUST
// carry pending_notes[0] matching LEASE_OVERRIDE_NOTE_RE with a
// human-readable reason. An unaudited bypass is rejected loud
// (LEASE_OVERRIDE_AUDIT_MISSING), never silently accepted.
//
// The note signature mirrors E13's /^Released v/ closing-write marker
// convention (gates/feature-lease.ts) — a pending_notes[0] prefix reused as a
// load-bearing line — but here it is an AUDIT line the gate verifies, not a
// passive terminal marker the predicate trusts.
//
// TRANSIENT, write-scoped: this is a pure structural read of the INCOMING
// tool args (NOT the parsed prev-state) — the field is never persisted to
// frontmatter, never carried forward, and a later write omitting it is
// evaluated by the normal FEATURE_LEASE_HELD predicate (spec AC3; no schema
// bump, architecture DR-1). FILE-MODE only, enforced at the orchestrator call
// site (spec AC9): SQLite mode never calls this classifier.
//
// Pure, fs-free, ZERO runtime imports (the gates/cut-approval.ts /
// gates/feature-lease.ts runtime-leaf convention). Structural parameter type:
// UpdateStateInput is structurally assignable.
//
// Registry linkage: the LEASE_OVERRIDE_AUDIT_MISSING hint is emitted at the
// orchestrator emit site via gate("LEASE_OVERRIDE_AUDIT_MISSING").hintStatic;
// this classifier returns a discriminant only, so no registry import is
// added here.
// The audit-note signature the override write must carry as pending_notes[0].
export const LEASE_OVERRIDE_NOTE_RE = /^lease-override:/;
// Classifies an incoming write's lease-override intent:
//   "absent"    — lease_override !== true; no override attempted (normal path:
//                 the orchestrator emits the existing FEATURE_LEASE_HELD
//                 rejection unchanged).
//   "audited"   — lease_override === true AND pending_notes[0] matches the RE
//                 (the orchestrator bypasses the lease-held rejection for
//                 THIS write only).
//   "unaudited" — lease_override === true AND pending_notes[0] is absent or
//                 mismatched (the orchestrator rejects loud with
//                 LEASE_OVERRIDE_AUDIT_MISSING — spec AC2).
export function classifyLeaseOverride(input) {
    if (input?.lease_override !== true)
        return "absent";
    return LEASE_OVERRIDE_NOTE_RE.test(input.pending_notes?.[0] ?? "")
        ? "audited"
        : "unaudited";
}
//# sourceMappingURL=lease-override.js.map
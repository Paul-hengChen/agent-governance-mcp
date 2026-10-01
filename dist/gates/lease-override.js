// Coded by @sr-engineer
// Lease-override classifier: decides whether a write carries a human-attested
// bypass of another feature's held lease. The orchestrator calls it only inside
// its FEATURE_LEASE_HELD branch and only in file mode. The bypass needs an audit
// note as pending_notes[0]; an unaudited one is rejected loud. The field is
// transient: read from the incoming write, never persisted.
// Rationale: specs/e10-lease-override.md. Pure, fs-free, no runtime imports.
// The audit-note signature the override write must carry as pending_notes[0].
export const LEASE_OVERRIDE_NOTE_RE = /^lease-override:/;
// Classifies an incoming write's lease-override intent:
//   "absent"    — lease_override is not true; the normal FEATURE_LEASE_HELD reject.
//   "audited"   — true and pending_notes[0] matches; bypass for this write only.
//   "unaudited" — true but the note is absent or mismatched; the orchestrator
//                 rejects with LEASE_OVERRIDE_AUDIT_MISSING.
export function classifyLeaseOverride(input) {
    if (input?.lease_override !== true)
        return "absent";
    return LEASE_OVERRIDE_NOTE_RE.test(input.pending_notes?.[0] ?? "")
        ? "audited"
        : "unaudited";
}
//# sourceMappingURL=lease-override.js.map
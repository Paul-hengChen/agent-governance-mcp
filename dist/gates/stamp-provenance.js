// Coded by @sr-engineer
// Stamp-provenance predicates: block the next write over a handoff whose
// last_updated looks hand-authored (ends :00.000Z) rather than server-stamped
// (millisecond entropy). It passes only with a stamp-remediation audit note as
// pending_notes[0]; any accepted normal write restamps now() and disarms it.
// File mode only. Pure, fs-free, no runtime imports.
// Rationale: specs/e260d-comment-rationale.md (gates/stamp-provenance.ts).
// The hand-authored stamp shape, shared with the read-only advisory in tools/drift.ts.
export const HAND_AUTHORED_STAMP_RE = /T\d{2}:\d{2}:00\.000Z$/;
// True when `lastUpdated` matches the hand-authored, out-of-band edit shape
// rather than the server's millisecond-entropy write path.
export function isHandAuthoredStamp(lastUpdated) {
    return HAND_AUTHORED_STAMP_RE.test(lastUpdated);
}
// The audit-note signature a remediation write must carry as pending_notes[0]
// (the LEASE_OVERRIDE_AUDIT_MISSING style).
export const STAMP_REMEDIATION_NOTE_RE = /^stamp-remediation:/;
// True when the INCOMING write carries the audited remediation acknowledgment.
export function hasStampRemediationAudit(input) {
    return STAMP_REMEDIATION_NOTE_RE.test(input?.pending_notes?.[0] ?? "");
}
//# sourceMappingURL=stamp-provenance.js.map
// Coded by @sr-engineer
// Stamp-provenance predicates (E18, e18-write-provenance — fix a).
//
// Escalates the E9A read-only stampAdvisory (tools/drift.ts) into a blocking
// gate on the file-mode tw_update_state write path: when the CURRENT on-disk
// handoff `last_updated` matches the hand-authored stamp shape, the next
// write is rejected `STAMP_PROVENANCE_SUSPECT` unless it acknowledges the
// contamination via an audited remediation note — forcing the next writer to
// record the anomaly instead of silently overwriting the evidence. Incident
// lineage (third E9A-class): the v3.85.0 no-MCP-path release-engineer
// subagent hand-edited .current/handoff.md with fabricated zero-entropy
// stamps (2026-07-14T00:00:00.000Z; commits 5950c58/199b164, remediated in
// 70e3a35).
//
// HAND_AUTHORED_STAMP_RE is the SINGLE source of truth for the predicate —
// verbatim relocation from tools/drift.ts (which now imports it back), NOT a
// fork: the read-side advisory and the write-side gate can never drift apart.
// Every stamp produced by tw_update_state itself comes from
// `new Date().toISOString()` and therefore carries millisecond entropy. A
// stamp with seconds `00` AND milliseconds `.000` matches all confirmed
// hand-authored stamps in handoff history (round-hour / round-half-hour hits
// satisfy this as a subset) and is overwhelmingly unlikely from the server
// write path.
//
// The remediation-note signature mirrors gates/lease-override.ts's
// LEASE_OVERRIDE_NOTE_RE convention — a load-bearing pending_notes[0] audit
// line the gate verifies. NOTE-ONLY by design (no companion transient boolean
// arg): unlike lease_override — where the boolean expresses bypass INTENT
// against a legitimately-held lease and the note is the audit trail, so an
// unaudited boolean needs its own loud reject — here the gate arms from the
// ON-DISK state alone, there is no separate intent to declare, and the audit
// note is simultaneously the acknowledgment and the audit trail. A boolean
// would add zod/tool surface with zero added trust (equally attestation-based).
//
// TRANSIENT, write-scoped: hasStampRemediationAudit reads the INCOMING tool
// args only; nothing is persisted. The gate self-disarms after any accepted
// write, because writeHandoffState stamps a fresh millisecond-entropy
// `now()` (a remediation write must therefore be a NORMAL write — not
// bookkeeping_write, which would preserve the suspect stamp verbatim).
// FILE-MODE only, enforced at the orchestrator call site: SQLite/HTTP-mode
// stamps come from the DB write path, mirroring the sibling attestation
// gates. A brand-new workspace (no prevState) has nothing to distrust and is
// never gated.
//
// Pure, fs-free, ZERO runtime imports (the gates/lease-override.ts
// runtime-leaf convention). Registry linkage: the STAMP_PROVENANCE_SUSPECT
// hint is emitted at the orchestrator emit site via
// gate("STAMP_PROVENANCE_SUSPECT").hintStatic; this module returns booleans
// only, so no registry import is added here.
// The hand-authored stamp shape (verbatim from tools/drift.ts, E9A).
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
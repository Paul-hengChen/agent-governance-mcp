// Coded by @sr-engineer
// Feature-lease predicate (E1, e1-feature-scoped-state-design — option a-min).
//
// The lease is DERIVED, not stored: a pure predicate over the three oldest,
// universal handoff fields (`active_feature`, `status`, `last_updated`) that
// exist identically in file mode AND SQLite mode. No schema bump, no new
// field, no migration — that is the entire point of choosing (a-min) over
// (a-explicit)/(b) (spec Decision Records).
//
// Semantics (spec §Decision, calibrations PM-ratified 2026-07-12; terminal
// marker + negative-age guard per §Amendment (2026-07-12), E1A):
//   FEATURE_LEASE_HELD  ⇔  prevState exists
//                          ∧ prevState.active_feature ≠ incomingFeature
//                          ∧ prevState.status ∉ { "PASS" }
//                          ∧ ¬(prevState is release-engineer closing write)
//                          ∧ 0 ≤ (nowMs − Date.parse(prevState.last_updated)) < ttlMin
//
// - `Blocked` COUNTS as lease-held (ratified Open Questions): a Blocked
//   feature is still the workspace's owner awaiting human recovery, not free
//   to be clobbered. The `status !== "PASS"` clause encodes this — Blocked,
//   In_Progress, and FAIL are all non-terminal.
// - Release-engineer closing-write terminal marker (E1A item 1; third
//   conjunct broadened by E13, e13-terminal-marker-advisory): the signature
//   `last_agent === "release-engineer" ∧ status === "In_Progress" ∧
//   (next_role === "pm" ∨ pending_notes[0] =~ /^Released v/)` is terminal —
//   the feature has shipped and the chain is handed back to pm, so the lease
//   is released immediately instead of waiting out the TTL.
//   E13 rationale — the exact triple's `next_role === "pm"` conjunct failed
//   silently twice, each time re-arming a dead lease for the TTL window:
//   * first occurrence (v3.75.0 close-out): the closing write simply omitted
//     `next_role` (transient field, omission never rejected);
//   * second occurrence (v3.77.0 close-out): the closing write DID carry the
//     full triple, but a later unrelated read triggered readHandoffState's
//     migration heal-write (tools/handoff.ts), which re-passes
//     `pendingNotes` verbatim but — per `next_role`'s documented TRANSIENT
//     (AC-3) semantics — drops `next_role` by design.
//   The durable substitute signal is the closing write's pending_notes
//   signature: SOP step 12 (content/skill-release-engineer.md) always stamps
//   `pending_notes=["Released vX.Y.Z", "tag: <sha>"]`, and unlike `next_role`
//   pending_notes IS preserved by the heal-write. Strict superset: every
//   previously-terminal case (next_role === "pm") stays terminal; the
//   disjunct additionally covers both incident classes (spec AC1/AC2).
//   Still narrowly scoped by design (non-regression, spec AC3/AC5):
//   * the OPENING write (SOP step 2) never sets `next_role` AND stamps
//     `pending_notes=["release-engineer: starting release for <feature>"]` —
//     neither disjunct matches, so the in-flight release window (git
//     commit/tag/push mechanics) stays lease-held — keying on `last_agent`
//     alone would reopen the D9/D10 race (which is exactly why the literal
//     backlog option-(b) text — dropping the third conjunct entirely — was
//     corrected to this narrower relaxation instead);
//   * escalation writes route `next_role="qa-engineer"` / omit it / set
//     `status="Blocked"`, and their pending_notes never match /^Released v/
//     — none match, consistent with Blocked-counts-as-held;
//   * other roles' `next_role="pm"` handbacks fail the `last_agent` conjunct.
//   FILE-MODE-ONLY by accepted asymmetry, enforced at the ORCHESTRATOR CALL
//   SITE for the E13 disjunct: SqliteHandoffStorage never persists
//   `next_role` (absent → never matches), and although SQLite DOES persist
//   pending_notes, tools/handoff-orchestrator.ts passes `pending_notes` into
//   this predicate ONLY under FileHandoffStorage (undefined otherwise), so
//   SQLite behavior stays byte-for-byte unchanged — still TTL-bounded, no
//   terminal-marker relief (spec AC4; extending relief to SQLite mode is a
//   deliberately deferred, separate decision).
// - TTL auto-expiry (advisory, not auto-steal): a dead session cannot
//   deadlock the workspace forever; a live-but-slow one is protected within
//   the TTL. Mirrors LOCK_STALE_MS (guards/file-lock.ts) and the D5
//   stale_dispatch advisory (tools/handoff.ts).
// - An unparseable `last_updated` (Date.parse → NaN) fails the freshness
//   clause → lease NOT held. Fail-open on corrupt timestamps, matching the
//   lock's stale-self-heal posture: a lease that cannot prove freshness does
//   not block the workspace.
// - A future-dated `last_updated` (ageMs < 0 — clock skew, wrong timezone,
//   hand-edited state) likewise fails freshness → lease NOT held (E1A item 2).
//   Same fail-open posture as NaN: a stamp that cannot establish a
//   trustworthy, non-negative elapsed time does not block the workspace.
//   Zero tolerance, no skew-grace tunable — binary, matching the NaN precedent.
//
// Pure, fs-free, storage-agnostic — unit-testable without a workspace.
// Structural parameter type (the sibling gates/scope-decision.ts /
// gates/cut-approval.ts convention): HandoffState is structurally assignable,
// and this module keeps ZERO import edges (runtime leaf, like gates/registry.ts).
//
// Registry linkage: the FEATURE_LEASE_HELD hint is emitted at the orchestrator
// emit site via gate("FEATURE_LEASE_HELD").hintStatic; this predicate returns
// a boolean only, so no registry import is added here.
export function isFeatureLeaseHeld(prevState, incomingFeature, nowMs, ttlMin) {
    if (!prevState)
        return false; // fresh workspace — no incumbent, no lease
    if (prevState.active_feature === incomingFeature)
        return false; // same feature — never gates
    if (prevState.status === "PASS")
        return false; // incumbent terminal — lease released
    if (
    // E1A terminal marker: release-engineer's CLOSING write — shipped, handed
    // back to pm. The opening write matches neither third-conjunct disjunct
    // (no next_role, "starting release..." notes — in-flight release stays
    // held, D9/D10), escalations route elsewhere or set Blocked, and other
    // roles' pm-handbacks fail the last_agent test.
    prevState.last_agent === "release-engineer" &&
        prevState.status === "In_Progress" &&
        // E13: next_role is TRANSIENT (AC-3) — it can be omitted at write time
        // (first incident class) or dropped later by the migration heal-write
        // (second class). The closing write's pending_notes signature ("Released
        // vX.Y.Z" first, per SOP step 12) survives both, so accept EITHER. Strict
        // superset of the pre-E13 exact triple.
        (prevState.next_role === "pm" ||
            /^Released v/.test(prevState.pending_notes?.[0] ?? ""))) {
        return false; // incumbent shipped — lease released
    }
    const ageMs = nowMs - Date.parse(prevState.last_updated);
    // NaN (unparseable last_updated) fails the comparison → lease not held.
    // Negative age (future-dated stamp, clock skew) likewise → lease not held
    // (E1A item 2): cannot prove non-negative elapsed time, fail open.
    return ageMs >= 0 && ageMs < ttlMin * 60_000;
}
//# sourceMappingURL=feature-lease.js.map
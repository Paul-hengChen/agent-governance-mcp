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
// - Release-engineer closing-write terminal marker (E1A item 1): the exact
//   signature `last_agent === "release-engineer" ∧ status === "In_Progress"
//   ∧ next_role === "pm"` is terminal — the feature has shipped and the
//   chain is handed back to pm, so the lease is released immediately instead
//   of waiting out the TTL. Narrowly scoped by design:
//   * the OPENING write (SOP step 2) never sets `next_role`, so the in-flight
//     release window (git commit/tag/push mechanics) stays lease-held —
//     keying on `last_agent` alone would reopen the D9/D10 race;
//   * escalation writes route `next_role="qa-engineer"` / omit it / set
//     `status="Blocked"` — none match, consistent with Blocked-counts-as-held;
//   * other roles' `next_role="pm"` handbacks fail the `last_agent` conjunct.
//   FILE-MODE-ONLY by accepted asymmetry: SqliteHandoffStorage never persists
//   `next_role`, so the fields are absent there and the clause simply never
//   matches (SQLite behavior byte-for-byte unchanged — still TTL-bounded).
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

export interface FeatureLeaseFields {
  active_feature: string;
  status: string;
  last_updated: string;
  // E1A terminal-marker inputs — OPTIONAL: both are absent in SQLite mode
  // (SqliteHandoffStorage never persists next_role) and on file-mode states
  // that predate them; absence simply never matches the terminal clause.
  last_agent?: string;
  next_role?: string;
}

export function isFeatureLeaseHeld(
  prevState: FeatureLeaseFields | null | undefined,
  incomingFeature: string,
  nowMs: number,
  ttlMin: number,
): boolean {
  if (!prevState) return false; // fresh workspace — no incumbent, no lease
  if (prevState.active_feature === incomingFeature) return false; // same feature — never gates
  if (prevState.status === "PASS") return false; // incumbent terminal — lease released
  if (
    // E1A terminal marker: release-engineer's CLOSING write — shipped, handed
    // back to pm. Exact-signature match only: the opening write has no
    // next_role (in-flight release stays held), escalations route elsewhere
    // or set Blocked, and other roles' pm-handbacks fail the last_agent test.
    prevState.last_agent === "release-engineer" &&
    prevState.status === "In_Progress" &&
    prevState.next_role === "pm"
  ) {
    return false; // incumbent shipped — lease released
  }
  const ageMs = nowMs - Date.parse(prevState.last_updated);
  // NaN (unparseable last_updated) fails the comparison → lease not held.
  // Negative age (future-dated stamp, clock skew) likewise → lease not held
  // (E1A item 2): cannot prove non-negative elapsed time, fail open.
  return ageMs >= 0 && ageMs < ttlMin * 60_000;
}

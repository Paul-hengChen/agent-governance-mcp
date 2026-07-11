// Coded by @sr-engineer
// Feature-lease predicate (E1, e1-feature-scoped-state-design — option a-min).
//
// The lease is DERIVED, not stored: a pure predicate over the three oldest,
// universal handoff fields (`active_feature`, `status`, `last_updated`) that
// exist identically in file mode AND SQLite mode. No schema bump, no new
// field, no migration — that is the entire point of choosing (a-min) over
// (a-explicit)/(b) (spec Decision Records).
//
// Semantics (spec §Decision, calibrations PM-ratified 2026-07-12):
//   FEATURE_LEASE_HELD  ⇔  prevState exists
//                          ∧ prevState.active_feature ≠ incomingFeature
//                          ∧ prevState.status ∉ { "PASS" }
//                          ∧ (nowMs − Date.parse(prevState.last_updated)) < ttlMin
//
// - `Blocked` COUNTS as lease-held (ratified Open Questions): a Blocked
//   feature is still the workspace's owner awaiting human recovery, not free
//   to be clobbered. The `status !== "PASS"` clause encodes this — Blocked,
//   In_Progress, and FAIL are all non-terminal.
// - TTL auto-expiry (advisory, not auto-steal): a dead session cannot
//   deadlock the workspace forever; a live-but-slow one is protected within
//   the TTL. Mirrors LOCK_STALE_MS (guards/file-lock.ts) and the D5
//   stale_dispatch advisory (tools/handoff.ts).
// - An unparseable `last_updated` (Date.parse → NaN) fails the freshness
//   clause → lease NOT held. Fail-open on corrupt timestamps, matching the
//   lock's stale-self-heal posture: a lease that cannot prove freshness does
//   not block the workspace.
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
  const ageMs = nowMs - Date.parse(prevState.last_updated);
  // NaN (unparseable last_updated) fails the comparison → lease not held.
  return ageMs < ttlMin * 60_000;
}

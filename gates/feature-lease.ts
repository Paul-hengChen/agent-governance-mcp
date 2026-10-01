// Coded by @sr-engineer
// Feature lease: while one feature's recent in-flight state owns the workspace,
// a write for a different feature is refused. Derived, not stored: a pure,
// import-free predicate over active_feature, status and last_updated. Blocked
// counts as held; PASS, the release-engineer closing write, an unparseable or
// future-dated stamp, or an age past the TTL releases it.
// Specs: specs/e1-feature-scoped-state-design.md, specs/e13-terminal-marker-advisory.md.

export interface FeatureLeaseFields {
  active_feature: string;
  status: string;
  last_updated: string;
  // Terminal-marker inputs. Absent in SQLite mode and on older file-mode
  // states; absence never matches the terminal clause.
  last_agent?: string;
  next_role?: string;
  // Durable terminal-marker input, read as pending_notes[0]. File mode only: the
  // orchestrator passes it only under FileHandoffStorage, so SQLite lease
  // behaviour is unchanged. Absence never matches.
  pending_notes?: string[];
}

// True for the release-engineer closing write: the feature has shipped and the
// chain is handed back to pm. The single owner of this test — the lease below
// and the stale-dispatch advisory in tools/handoff-parse.ts both call it.
// Rationale: specs/e260d-comment-rationale.md (gates/feature-lease.ts).
export function isReleaseClosingWrite(
  state: Pick<FeatureLeaseFields, "last_agent" | "status" | "next_role" | "pending_notes">,
): boolean {
  return (
    // The opening write matches neither disjunct below, so an in-flight
    // release stays held; other roles' pm handbacks fail this test.
    state.last_agent === "release-engineer" &&
    state.status === "In_Progress" &&
    // next_role is transient and can be omitted or dropped by a heal-write;
    // the "Released v" first note survives both, so accept either.
    (state.next_role === "pm" ||
      /^Released v/.test(state.pending_notes?.[0] ?? ""))
  );
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
  if (isReleaseClosingWrite(prevState)) {
    return false; // incumbent shipped — lease released
  }
  const ageMs = nowMs - Date.parse(prevState.last_updated);
  // NaN (unparseable stamp) or a negative age (future-dated stamp) cannot
  // prove elapsed time, so both fail open: lease not held.
  return ageMs >= 0 && ageMs < ttlMin * 60_000;
}

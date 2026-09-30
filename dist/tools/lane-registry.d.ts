import type { LaneListResult } from "./feature-rollup.js";
/** Per-workspace feature history, best-effort, derived from the per-lane
 *  layout: every live `.current/<lane>/handoff.md` plus every closed
 *  `.current/history/<YYYY-MM>/<lane>/handoff.md`, AND every `{feature, ts}`
 *  row of the `metrics.jsonl` sitting in each of those same lane dirs — a
 *  long-lived lane such as `_primary` changes `active_feature` IN PLACE and
 *  never closes into history, so its handoff.md only ever names the current
 *  feature; each release-engineer shipped close (emitFeatureMetrics) leaves a
 *  durable metrics row that recovers the superseded predecessors.
 *  (E123, E125b)
 *  null = neither a live lane dir holding a handoff.md or metrics.jsonl nor a
 *  `.current/history/` directory exists (no lane history to report);
 *  [] = at least one source exists but yielded no parseable entry.
 *  Entries are the exact (unsanitized) active_feature / metrics `feature`
 *  strings, one combined list oldest to newest by each source's OWN
 *  timestamp (handoff `last_updated`, metrics row `ts`) — never filesystem
 *  mtime (a checkout gives every file the same mtime). Within ONE lane dir a
 *  feature appears at most once: the handoff entry wins over that dir's
 *  metrics rows for the same feature, and repeated metrics rows (e.g. two
 *  released_version values) collapse to the earliest. Separate lane dirs
 *  (a live lane and its history closures) are never merged with each other.
 *  A missing or unparseable timestamp sorts last; ties break by lane name
 *  ascending (then by path, for full determinism). The flat-era
 *  `.current/archive/` is no longer read at all.
 *
 *  KNOWN LIMITATION: a feature that was ABANDONED — never reached a
 *  release-engineer shipped close, so it has no metrics row — and was then
 *  overwritten in place by a later `active_feature` cannot be recovered.
 *  metrics.jsonl records shipped closes only; this module never claims data
 *  that was not durably recorded (degrade honestly). (E125b) */
export interface LaneFeatureHistory {
    featureHistory: string[] | null;
}
/**
 * Enumerates live and closed lane handoffs under `workspacePath/.current/`
 * (plus each lane dir's metrics.jsonl shipped-close rows) and returns their
 * feature names ordered by timestamp.
 * Strictly read-only (readdir/stat/readFile only — no lock, no migration, no
 * file or dir creation). Never throws: an unlistable dir, a malformed file,
 * missing frontmatter, or a non-string `active_feature` are skipped
 * silently. (E125b)
 */
export declare function getLaneFeatureHistory(workspacePath: string): LaneFeatureHistory;
/**
 * LaneListProvider-conformant (same signature as `localFallbackLaneList`) —
 * the provider the feature roll-up wires in (scripts/feature-rollup.mjs).
 * Delegates worktree enumeration + handoff parsing entirely to
 * `localFallbackLaneList` (no duplicated git-shelling) and additionally
 * attaches `featureHistory` per lane via `getLaneFeatureHistory`. `source`
 * reads `"lane-registry"` — the union member `tools/feature-rollup.ts`
 * reserved for this module — whenever this function, not
 * `localFallbackLaneList`, is used as the provider. (E113)
 */
export declare function laneRegistryList(repoRoot: string): LaneListResult;
/** One sibling lane as surfaced in the `tw_get_state` advisory — a minimal
 *  projection, not the full `LaneInfo` shape (no hopCount/lastUpdated/error:
 *  tw_get_state's advisory is "who else, doing what", not a full report). */
export interface LaneRegistryAdvisoryLane {
    workspace_path: string;
    active_feature: string | null;
    status: string | null;
    last_agent: string | null;
}
export interface LaneRegistryAdvisory {
    lanes: LaneRegistryAdvisoryLane[];
    degraded: boolean;
    degraded_reason?: string;
}
/**
 * Fast, cost-ceilinged summary for `tw_get_state` (DoD 3). Calls
 * `localFallbackLaneList(repoRoot, { timeoutMs })` directly — NOT
 * `laneRegistryList` — deliberately skipping the lane-history scan: `tw_get_state`
 * does not need feature history, and every lane on this path pays for every
 * sibling's extra I/O on every single read.
 *
 * Returns `null` (no advisory to report) when there are 0 or 1 worktrees
 * total (nothing to show — most workspaces are not part of a fan-out) or
 * when git is unavailable/times out with zero lanes recovered. When 2+
 * worktrees are found and at least one sibling's handoff can't be read,
 * returns the advisory with `degraded: true` and a stated reason (that lane
 * is still carried in `lanes`, never dropped).
 *
 * `opts.timeoutMs` defaults to 200 — a fixed constant for production
 * callers (same posture as `STALE_DISPATCH_THRESHOLD_MIN`/`HOP_CAP`; never
 * config-driven), exposed only so a test can shorten it. This bounds only
 * the `git worktree list` subprocess `localFallbackLaneList` shells out to
 * — the N synchronous `parseHandoff` reads (one per sibling worktree) that
 * follow are additive on top of it, not covered by the 200ms figure.
 * Wrapped in try/catch as defense-in-depth: `localFallbackLaneList` already
 * never throws, but this function must never be the reason `tw_get_state`'s
 * mandatory first-action read fails.
 */
export declare function getLaneRegistrySummary(repoRoot: string, opts?: {
    timeoutMs?: number;
}): LaneRegistryAdvisory | null;
//# sourceMappingURL=lane-registry.d.ts.map
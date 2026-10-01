import type { LaneListResult } from "./feature-rollup.js";
/** Per-workspace feature history, best-effort: every live and closed
 *  (`history/<YYYY-MM>/`) lane handoff.md plus each lane dir's metrics.jsonl
 *  rows, oldest to newest by each source's own timestamp, never mtime.
 *  null = no lane source exists; [] = sources exist but none parsed.
 *  Ordering, dedup and the abandoned-feature limitation:
 *  specs/e260b-rationale.md (tools/lane-registry.ts). (E123, E125b) */
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
 * LaneListProvider for the feature roll-up (scripts/feature-rollup.mjs):
 * `localFallbackLaneList` plus `featureHistory` per lane via
 * `getLaneFeatureHistory`, with `source` reading `"lane-registry"`. (E113)
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
 * Fast summary for `tw_get_state`: calls `localFallbackLaneList` directly,
 * skipping the lane-history scan every read would pay for. Returns null for
 * 0-1 worktrees, or git unavailable with no lanes; an unreadable sibling is
 * carried with `degraded: true` and a reason. `opts.timeoutMs` (default 200,
 * a test-only knob) bounds only the `git worktree list` call. Never throws.
 */
export declare function getLaneRegistrySummary(repoRoot: string, opts?: {
    timeoutMs?: number;
}): LaneRegistryAdvisory | null;
//# sourceMappingURL=lane-registry.d.ts.map
/** One lane's raw, lightweight state as seen by a LaneListProvider. */
export interface LaneInfo {
    workspacePath: string;
    /** Always known once `git worktree list` succeeds; null only for a
     * detached-HEAD worktree or a block this parser could not read a branch
     * line from. Not optional — every provider that derives from git
     * porcelain output has this information available. */
    branch: string | null;
    activeFeature: string | null;
    status: string | null;
    hopCount: number | null;
    lastAgent: string | null;
    lastUpdated: string | null;
    /** false when this lane's handoff could not be found/parsed. */
    readable: boolean;
    error?: string;
    /** This lane's completed_tasks, when the provider
     * already read the handoff and can populate it for free (both
     * localFallbackLaneList and lane-registry.ts's laneRegistryList do).
     * undefined = provider left it unpopulated (computeFeatureRollup falls
     * back to its own parseHandoff read for this lane, preserving prior
     * behavior for third-party providers). null is not currently produced by
     * either built-in provider but is a legal "known absent" value. (E132) */
    completedTasks?: string[] | null;
    /** This lane's past active_feature values, oldest to newest, best-effort.
     * Only laneRegistryList populates this (see tools/lane-registry.ts) —
     * localFallbackLaneList leaves it undefined, deliberately, so existing
     * callers never pay for a history scan they did not ask for. (E132) */
    featureHistory?: string[] | null;
}
/** The result of deriving the lane list for a repo. */
export interface LaneListResult {
    source: "lane-registry" | "local-fallback";
    lanes: LaneInfo[];
    /** true if derivation was partial or unavailable. */
    degraded: boolean;
    degradedReason?: string;
}
/** A pluggable lane-list data source. localFallbackLaneList is the default;
 * tools/lane-registry.ts's laneRegistryList is a drop-in replacement with the
 * same signature. */
export type LaneListProvider = (repoRoot: string) => LaneListResult;
export declare function localFallbackLaneList(repoRoot: string, opts?: {
    timeoutMs?: number;
}): LaneListResult;
/** One lane's contribution to a computed roll-up. */
export interface RollupReportLane {
    workspacePath: string;
    /** From the lane's own handoff (`active_feature`); null if unreadable or
     * never set. Used to attribute the lane to `featureId` — see
     * computeFeatureRollup. */
    activeFeature: string | null;
    ticketsCompleted: string[];
    status: string | null;
    hopCount: number | null;
    readable: boolean;
    /** Passthrough of LaneInfo.featureHistory — only populated when the caller
     * supplied a provider that computes it (laneRegistryList); undefined for
     * lanes from localFallbackLaneList. */
    featureHistory?: string[] | null;
}
export interface RollupReport {
    featureId: string;
    lanes: RollupReportLane[];
    totals: {
        hopCount: number;
        ticketCount: number;
    };
    capComparison: {
        hopCap: number;
        totalHop: number;
        overCapBy: number;
        anySingleLaneReportsOverCap: boolean;
    };
    degraded: boolean;
    /** set whenever `degraded` is true; always human-readable. */
    degradedReason?: string;
}
/**
 * Derive the lane list (via `laneListProvider`, default localFallbackLaneList)
 * and sum each lane's ticket count / hop_count against HOP_CAP_EXPORTED
 * (imported from tools/transitions.ts — never hardcoded here). Never throws:
 * a provider failure, or any individual lane's handoff being unreadable,
 * degrades the report instead of crashing the caller — see the module-level
 * comment on degrade-honestly.
 */
export declare function computeFeatureRollup(featureId: string, opts?: {
    repoRoot?: string;
    laneListProvider?: LaneListProvider;
}): RollupReport;
/**
 * Render a RollupReport as a human-readable table + verdict line, suitable
 * for pasting directly into chat in front of a human (the coord-03 obligation
 * this surface backs: "quote its output"). Degrade-honestly (AC5): whenever
 * `report.degraded` is true, the FIRST line is an explicit "ROLL-UP
 * INCOMPLETE" banner — a single-lane or partial total is never presented as
 * if it were a verified feature total.
 */
export declare function renderRollupReport(report: RollupReport): string;
//# sourceMappingURL=feature-rollup.d.ts.map
export interface FlatToLaneResult {
    lane: string;
    moved: string[];
    skipped: string[];
    merged: string[];
    alreadyMigrated: boolean;
}
export interface LaneToFlatResult {
    moved: string[];
    skipped: string[];
}
export interface FlatToLaneOptions {
    lane?: string;
    allowMissingRequired?: boolean;
}
export interface LaneToFlatOptions {
}
/**
 * Lock-free core of the flat->lane migration. The caller MUST already hold
 * `withFileLock(resolveLaneLockPath(workspacePath, lane))` and pass that lane
 * as `opts.lane` (absent, it defaults to resolveCurrentLane); calling the
 * public wrapper instead self-deadlocks. Moves the present flat LANE_FILES
 * entries into `.current/<lane>/`, handoff.md last.
 * Refusal and resume rules: specs/e260b-rationale.md (tools/lane-migrate.ts).
 */
export declare function migrateFlatToLaneLocked(workspacePath: string, opts?: FlatToLaneOptions): FlatToLaneResult;
/**
 * Own-workspace migration trigger: true iff ANY LANE_FILES entry (handoff.md
 * or a sidecar) still exists as a file at the flat `<ws>/.current/<filename>`.
 * Read-only. Shared by tools/handoff-parse.ts (readHandoffState) and
 * tools/handoff-write.ts (writeHandoffStateCore) so both entry points use the
 * same predicate before calling migrateFlatToLaneLocked on
 * resolveCurrentLane's lane. (E123)
 */
export declare function hasFlatLaneFiles(workspacePath: string): boolean;
/**
 * Public, lock-acquiring wrapper around migrateFlatToLaneLocked, for callers
 * that do not hold the lane lock (e.g. readHandoffState). `lane` defaults to
 * resolveCurrentLane(ws), i.e. "_primary" off a feat branch. Creates the lane
 * dir to host the lock and removes it again if the run is refused and the dir
 * is still empty.
 */
export declare function migrateFlatToLane(workspacePath: string, opts?: FlatToLaneOptions): Promise<FlatToLaneResult>;
/**
 * Lock-free core of the lane->flat migration (no sidecar merge this way); the
 * caller MUST hold the lane lock. Refuses, touching nothing, when the lane dir
 * is missing, lacks handoff.md, holds tasks.md, holds anything that is not a
 * lane file or tolerable debris, or a flat destination differs. Never deletes
 * the held lock, so the wrapper removes the lane dir after releasing it.
 */
export declare function migrateLaneToFlatLocked(workspacePath: string, lane: string, opts?: LaneToFlatOptions): LaneToFlatResult;
/**
 * Exact reverse of migrateFlatToLane: the lock-acquiring wrapper around
 * migrateLaneToFlatLocked. Refuses a missing lane dir before locking, and
 * removes the lane dir after the lock is released unless new content landed.
 */
export declare function migrateLaneToFlat(workspacePath: string, lane: string, opts?: LaneToFlatOptions): Promise<LaneToFlatResult>;
//# sourceMappingURL=lane-migrate.d.ts.map
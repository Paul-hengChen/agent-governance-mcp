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
 * LOCK-FREE CORE of the flat->lane migration (e123b9 spec AC12).
 *
 * CONTRACT: the caller MUST already hold
 * `withFileLock(resolveLaneLockPath(workspacePath, lane))` for the exact
 * destination lane, and MUST pass that lane as `opts.lane` (it defaults to
 * resolveCurrentLane(workspacePath) only for a caller that resolves the lane
 * the same way immediately before locking — prefer passing it). This function
 * takes NO lock itself; calling the public migrateFlatToLane while holding
 * the lane lock would self-deadlock until LOCK_MAX_WAIT_MS and then fail,
 * because withFileLock is not re-entrant. Intended caller:
 * tools/handoff-write.ts's writeHandoffStateCore (T-E123B9-02), from inside
 * its own per-lane locked section, BEFORE it resolves handoffPath for the
 * write. The lane directory already exists (it hosts the held lock).
 *
 * Behaviour: moves every present flat LANE_FILES entry into
 * `.current/<lane>/`, sidecars first and handoff.md last (amendment AC17).
 * The required entry must be present at the flat source (throws otherwise,
 * nothing moved), except:
 *   - absent at the source and already in the lane (a completed or
 *     interrupted migration): any leftover flat sidecars are swept in via
 *     the AC15 merge/resume rule (amendment AC18); with none left over it is
 *     the loser of a concurrent race (AC-MIG-3) — `alreadyMigrated: true`,
 *     nothing touched;
 *   - absent at both paths with `opts.allowMissingRequired` (amendment
 *     AC19): the sidecars are moved, no throw.
 * Absent optional entries are skipped silently. An optional JSONL sidecar
 * already present in the lane is merged (flat lines first) — spec AC15; a
 * non-JSONL optional entry (pending-tickets.md) with different bytes at both
 * ends refuses instead, nothing moved (e179 AC10). handoff.md
 * at both paths with different bytes throws (dual presence is surfaced one
 * layer up as HANDOFF_LAYOUT_CONFLICT by T-E123B9-02; this is the backstop).
 */
export declare function migrateFlatToLaneLocked(workspacePath: string, opts?: FlatToLaneOptions): FlatToLaneResult;
/**
 * e123b9 amendment AC16: the own-workspace migration trigger — true iff ANY
 * LANE_FILES entry (handoff.md or a sidecar) still exists as a file at the
 * flat `<ws>/.current/<filename>`. Read-only. Shared by tools/handoff-parse.ts
 * (readHandoffState) and tools/handoff-write.ts (writeHandoffStateCore) so
 * both entry points use the same predicate.
 */
export declare function hasFlatLaneFiles(workspacePath: string): boolean;
/**
 * Move the flat `.current/` lane files into `.current/<lane>/`, where `lane`
 * is `opts.lane` or, by default, resolveCurrentLane(workspacePath) — the
 * checked-out branch's lane, PRIMARY_LANE ("_primary") on a non-feat branch
 * (spec AC2). Public, LOCK-ACQUIRING wrapper (spec AC12): takes the per-lane
 * lock `.current/<lane>/.handoff.lock` (spec AC5), creating the lane
 * directory first to host it, then runs migrateFlatToLaneLocked. For a caller
 * that does NOT already hold that lock (e.g. readHandoffState). See the core
 * for behaviour.
 *
 * If the run is refused and the lane directory was created only to host the
 * lock, the (then empty) directory is removed again after the lock releases.
 */
export declare function migrateFlatToLane(workspacePath: string, opts?: FlatToLaneOptions): Promise<FlatToLaneResult>;
/**
 * LOCK-FREE CORE of the lane->flat migration (e123b9 spec AC12).
 *
 * CONTRACT: the caller MUST already hold
 * `withFileLock(resolveLaneLockPath(workspacePath, lane))`. This function
 * takes NO lock itself (withFileLock is not re-entrant — see
 * migrateFlatToLaneLocked). Because that held lockfile lives INSIDE the lane
 * directory, the core never deletes it and so cannot remove the lane
 * directory while it is held: it removes the directory only if it is already
 * empty, and otherwise leaves it holding just the lock for the caller to
 * remove after releasing (the public wrapper does exactly that).
 *
 * Behaviour (unchanged by e123b9 AC15 — no sidecar merge in this direction):
 * moves `.current/<lane>/`'s lane files back to flat `.current/`. Refuses
 * (throws, touches nothing) when the lane directory is missing, lacks the
 * required entry, holds anything that is not a LANE_FILES entry or tolerable
 * debris (a HANDOFF_LOCK_FILENAME regular file, a `tasks.md.lock` regular
 * file, a stale `<lane file>.<pid>.<ms>.tmp`), or a flat destination exists
 * with different content — and (e125a spec AC2) whenever the lane dir holds
 * tasks.md. Stale tmp debris and a stale tasks.md.lock are removed after the
 * moves; the held .handoff.lock and a live tasks.md.lock never are.
 */
export declare function migrateLaneToFlatLocked(workspacePath: string, lane: string, opts?: LaneToFlatOptions): LaneToFlatResult;
/**
 * Exact reverse of migrateFlatToLane: move `.current/<lane>/`'s lane files
 * back to flat `.current/`, then remove the now-empty `.current/<lane>/`.
 * Public, LOCK-ACQUIRING wrapper (spec AC12): takes the per-lane lock
 * `.current/<lane>/.handoff.lock` (spec AC5) and runs migrateLaneToFlatLocked;
 * once the lock is released (its file gone) it removes the lane directory,
 * leaving it in place only if something new landed there concurrently. A
 * missing lane directory is refused BEFORE locking, so a refused run never
 * creates one. See the core for the refusal rules.
 */
export declare function migrateLaneToFlat(workspacePath: string, lane: string, opts?: LaneToFlatOptions): Promise<LaneToFlatResult>;
//# sourceMappingURL=lane-migrate.d.ts.map
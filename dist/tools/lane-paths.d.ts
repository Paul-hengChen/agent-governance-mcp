export interface LaneFileEntry {
    readonly key: string;
    readonly filename: string;
    readonly required: boolean;
    readonly noFlatCounterpart?: true;
}
export declare const LANE_FILES: readonly [{
    readonly key: "handoff";
    readonly filename: "handoff.md";
    readonly required: true;
}, {
    readonly key: "telemetry";
    readonly filename: "telemetry.jsonl";
    readonly required: false;
}, {
    readonly key: "metrics";
    readonly filename: "metrics.jsonl";
    readonly required: false;
}, {
    readonly key: "usage";
    readonly filename: "usage.jsonl";
    readonly required: false;
}, {
    readonly key: "dispatch";
    readonly filename: "dispatch.jsonl";
    readonly required: false;
}, {
    readonly key: "pendingTickets";
    readonly filename: "pending-tickets.md";
    readonly required: false;
}, {
    readonly key: "tasks";
    readonly filename: "tasks.md";
    readonly required: false;
    readonly noFlatCounterpart: true;
}, {
    readonly key: "baseSha";
    readonly filename: "base-sha";
    readonly required: false;
}];
export type LaneFileKey = (typeof LANE_FILES)[number]["key"];
export interface LanePaths {
    handoffPath: string;
    telemetryPath: string;
    metricsPath: string;
    usagePath: string;
    dispatchLogPath: string;
    pendingTicketsPath: string;
    tasksPath: string;
    baseShaPath: string;
}
export declare function laneFile(key: LaneFileKey): LaneFileEntry;
export declare const HANDOFF_LOCK_FILENAME = ".handoff.lock";
export declare const LEGACY_LANE = "_legacy";
export declare const PRIMARY_LANE = "_primary";
/**
 * Derive a lane name from a handoff's active_feature: the lowercased leading
 * ticket-id token, else LEGACY_LANE. MUST NEVER return PRIMARY_LANE; branch
 * resolution belongs to resolveCurrentLane below. The flat->lane migration
 * does not use this; kept for lookups, no production caller today. (E123)
 */
export declare function resolveLaneName(activeFeature: string | undefined): string;
/** true iff `lane` is a single safe path segment (see SAFE_LANE_RE). */
export declare function isSafeLaneName(lane: unknown): lane is string;
/** `<workspacePath>/.current/<lane>` — the directory holding a lane's files. */
export declare function resolveLaneDir(workspacePath: string, lane: string): string;
/**
 * The `.current/history/<bucket>/` month bucket for a lane closed at `now`:
 * the UTC year-month, `YYYY-MM`. Always satisfies HISTORY_BUCKET_RE. (E125b)
 */
export declare function resolveHistoryBucket(now?: Date): string;
/**
 * `<workspacePath>/.current/history/<bucket>/<lane>` — where a closed lane's
 * `.current/<lane>/` directory lands. Throws on a `bucket` that is not
 * exactly `YYYY-MM` (HISTORY_BUCKET_RE) or an unsafe `lane` (not a single
 * path segment), so it can never return a path outside
 * `.current/history/<bucket>/`. Pure path logic — creates nothing. (E125b)
 */
export declare function resolveHistoryLaneDir(workspacePath: string, bucket: string, lane: string): string;
/**
 * true iff some `.current/history/<bucket>/<lane>/<filename>` exists as a
 * regular file, for any HISTORY_BUCKET_RE bucket — i.e. lane `lane` has
 * closed with that file in its history. Read-only (readdir / stat); never
 * throws — an unlistable dir, an unsafe lane or filename, or an fs error all
 * read as false (like enumerateLaneSidecarSources). (E125b)
 */
export declare function hasHistoryLedger(workspacePath: string, lane: string, filename: string): boolean;
/**
 * Lane-scoped paths: returns `<workspacePath>/.current/<lane>/<filename>`
 * for every LANE_FILES entry. The shape is derived by iterating LANE_FILES —
 * the filenames are never restated here. Throws on an unsafe `lane` (not a
 * single path segment); every lane the resolvers in this module produce is
 * safe by construction, so production callers (all via
 * resolveCurrentLanePaths) never hit that throw. (E123)
 */
export declare function resolveLanePaths(workspacePath: string, lane: string): LanePaths;
/**
 * Per-lane handoff lock path `.current/<lane>/${HANDOFF_LOCK_FILENAME}`, the
 * single composer of it, so the migration runners and a live writer of the
 * SAME lane serialize on the SAME lockfile. Pure path logic: the lock
 * acquirer creates the lane directory. (E123)
 */
export declare function resolveLaneLockPath(workspacePath: string, lane: string): string;
/**
 * LIVE lane resolver, by pure fs (no git subprocess): `feat/<rest>` whose
 * `<rest>` starts with a ticket-id token -> the lowercased id
 * (`feat/e123b1-core-write-path` -> `e123b1`); anything else (main, integ/*,
 * a feat/ branch with no id, detached HEAD, missing or malformed .git) ->
 * PRIMARY_LANE. NEVER throws. (E123)
 */
export declare function resolveCurrentLane(workspacePath: string): string;
/**
 * The current lane's paths: resolveLanePaths over resolveCurrentLane. It
 * returns lane-scoped `.current/<lane>/<filename>` paths —
 * `.current/_primary/...` on a primary checkout, `.current/<ticket-id>/...`
 * on a `feat/<id>-*` lane. (E123)
 */
export declare function resolveCurrentLanePaths(workspacePath: string): LanePaths;
/**
 * Legacy flat paths: `<workspacePath>/.current/<filename>` for every
 * LANE_FILES entry — the old layout a not-yet-migrated workspace still
 * holds. Read-only fallbacks (tools/drift.ts's skew precheck,
 * bin/agent-governance-usage-hook.mjs, enumerateLaneSidecarSources) resolve
 * the flat copy through this one composer instead of restating a filename.
 * No live writer targets these paths. (E123)
 */
export declare function resolveFlatLanePaths(workspacePath: string): LanePaths;
/**
 * true iff `candidate`'s bytes are identical to, or a prefix of,
 * `authority`'s bytes. THE one byte-prefix predicate for "already counted":
 * tools/lane-migrate.ts's flat->lane resume check (a flat sidecar whose bytes
 * already lead the lane file = a merge that published but died before
 * unlinking the flat source) and enumerateLaneSidecarSources's read-side
 * dedup both use it, so the migrator and the aggregating readers agree on
 * what "already counted" means. (E123)
 */
export declare function isBytePrefix(candidate: Buffer, authority: Buffer): boolean;
export declare const NON_LANE_DIRS: ReadonlySet<string>;
export declare const HISTORY_BUCKET_RE: RegExp;
export type LaneSidecarSourceKind = "live" | "history" | "flat";
export interface LaneSidecarSource {
    path: string;
    kind: LaneSidecarSourceKind;
    lane: string | null;
    bytes: Buffer;
}
export interface SkippedLaneSidecarSource {
    path: string;
    kind: "history" | "flat";
    lane: string | null;
    authorityPath: string;
}
export interface LaneSidecarSources {
    sources: LaneSidecarSource[];
    skipped: SkippedLaneSidecarSource[];
}
/**
 * Every copy of one lane sidecar in this workspace's own `.current/` tree
 * (live lane dirs, `history/<YYYY-MM>/<lane>/`, legacy flat), deduplicated by
 * CONTENT, never by name: a copy that is a byte prefix of a counted copy is a
 * half-finished move or merge and is skipped. Read-only; never throws.
 * Why: specs/e260b-rationale.md (this file's section)
 */
export declare function enumerateLaneSidecarSources(workspacePath: string, key: LaneFileKey): LaneSidecarSources;
//# sourceMappingURL=lane-paths.d.ts.map
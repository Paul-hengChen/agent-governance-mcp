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
 * active_feature-derived lane name (e123a spec AC4, D1's original wording):
 * derive a lane name from a handoff's active_feature. Returns the lowercased
 * leading ticket-id token, else LEGACY_LANE.
 *
 * e123b9 J2 (spec AC2, Decision 1, human 2026-09-23): the flat->lane
 * migration NO LONGER uses this — it targets the branch-based live resolver
 * instead. Kept exported for "what lane would this active_feature imply"
 * lookups; no production caller today.
 *
 * MUST NEVER return PRIMARY_LANE ("_primary") — the branch-based resolution
 * (feat/<id>-*) and its PRIMARY_LANE fallback belong to the LIVE resolver
 * (resolveCurrentLane below), not this function. Shares TICKET_ID_RE with it
 * (e123b0 spec AC3).
 */
export declare function resolveLaneName(activeFeature: string | undefined): string;
/** true iff `lane` is a single safe path segment (see SAFE_LANE_RE). */
export declare function isSafeLaneName(lane: unknown): lane is string;
/** `<workspacePath>/.current/<lane>` — the directory holding a lane's files. */
export declare function resolveLaneDir(workspacePath: string, lane: string): string;
/**
 * The `.current/history/<bucket>/` month bucket for a lane closed at `now`
 * (e125b spec AC1): the UTC year-month, `YYYY-MM`. Always satisfies
 * HISTORY_BUCKET_RE.
 */
export declare function resolveHistoryBucket(now?: Date): string;
/**
 * `<workspacePath>/.current/history/<bucket>/<lane>` — where a closed lane's
 * `.current/<lane>/` directory lands (e125b spec AC1/AC6). Throws on a
 * `bucket` that is not exactly `YYYY-MM` (HISTORY_BUCKET_RE) or an unsafe
 * `lane` (not a single path segment), so it can never return a path outside
 * `.current/history/<bucket>/`. Pure path logic — creates nothing.
 */
export declare function resolveHistoryLaneDir(workspacePath: string, bucket: string, lane: string): string;
/**
 * true iff some `.current/history/<bucket>/<lane>/<filename>` exists as a
 * regular file, for any HISTORY_BUCKET_RE bucket (e125b spec AC8, X7) — i.e.
 * lane `lane` has closed with that file in its history. Read-only (readdir /
 * stat); never throws — an unlistable dir, an unsafe lane or filename, or an
 * fs error all read as false (the enumerateLaneSidecarSources posture).
 */
export declare function hasHistoryLedger(workspacePath: string, lane: string, filename: string): boolean;
/**
 * Lane-scoped paths (e123b9 J2, spec AC1): returns
 * `<workspacePath>/.current/<lane>/<filename>` for every LANE_FILES entry.
 * The shape is derived by iterating LANE_FILES — the filenames are never
 * restated here (e123a AC15 lineage). Throws on an unsafe `lane` (not a
 * single path segment); every lane the resolvers in this module produce is
 * safe by construction, so production callers (all via
 * resolveCurrentLanePaths) never hit that throw.
 */
export declare function resolveLanePaths(workspacePath: string, lane: string): LanePaths;
/**
 * Per-lane handoff lock path (e123b9 J2, spec AC5, Decision 2):
 * `<workspacePath>/.current/<lane>/${HANDOFF_LOCK_FILENAME}`. The single
 * composer of the lock path: tools/lane-migrate.ts's runners use it for the
 * migration's destination lane, and a live writer (tools/handoff-write.ts,
 * T-E123B9-02) uses it for the current branch's lane, so the migration and a
 * live writer of the SAME lane serialize on the SAME lockfile. Pure path
 * logic — does not create the lane directory; the lock acquirer does that
 * (withFileLock mkdirs the lock's parent before its O_EXCL open).
 */
export declare function resolveLaneLockPath(workspacePath: string, lane: string): string;
/**
 * LIVE lane resolver (e123b0 spec AC2, D1): name the lane of the branch
 * currently checked out in `workspacePath`, by pure fs (no git subprocess, no
 * network — the tools/drift.ts precedent).
 *
 * `feat/<rest>` where `<rest>` starts with a ticket-id token -> the lowercased
 * id (`feat/e123b1-core-write-path` -> `e123b1`). Anything else — `main`,
 * `integ/*`, `fix/*`, a `feat/` branch with no id token, a detached HEAD, a
 * missing `.git`, an unreadable or malformed `.git`/HEAD — -> PRIMARY_LANE.
 *
 * NEVER throws. Production callers reach it through resolveCurrentLanePaths
 * (see the file header for the list).
 */
export declare function resolveCurrentLane(workspacePath: string): string;
/**
 * The current lane's paths (e123b0 spec AC4): resolveLanePaths over
 * resolveCurrentLane. Since the e123b9 J2 flip this returns genuinely
 * lane-scoped `.current/<lane>/<filename>` paths — `.current/_primary/...`
 * on a primary checkout, `.current/<ticket-id>/...` on a `feat/<id>-*` lane.
 */
export declare function resolveCurrentLanePaths(workspacePath: string): LanePaths;
/**
 * Legacy flat paths (e123c, E123 F2): `<workspacePath>/.current/<filename>`
 * for every LANE_FILES entry — the pre-E123 layout a not-yet-migrated
 * workspace still holds. Read-only fallbacks (tools/drift.ts's skew
 * precheck, bin/agent-governance-usage-hook.mjs, enumerateLaneSidecarSources)
 * resolve the flat copy through this one composer instead of restating a
 * filename. No live writer targets these paths.
 */
export declare function resolveFlatLanePaths(workspacePath: string): LanePaths;
/**
 * true iff `candidate`'s bytes are identical to, or a prefix of,
 * `authority`'s bytes. THE one byte-prefix predicate (e123c spec, "Double-
 * count rule", human amendment 2026-09-24): tools/lane-migrate.ts's
 * flat->lane resume check (a flat sidecar whose bytes already lead the lane
 * file = a merge that published but died before unlinking the flat source)
 * and enumerateLaneSidecarSources's read-side dedup both use it, so the
 * migrator and the aggregating readers agree on what "already counted"
 * means.
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
 * Every copy of one lane sidecar (`telemetry` / `metrics` / `usage` / ...)
 * a workspace's own `.current/` tree holds, deduplicated by CONTENT (e123c
 * spec, "Design — the dedup rule"; human amendment 2026-09-24). Scope is
 * this workspace only — never a sibling worktree.
 *
 * Sources:
 *   live    `.current/<lane>/<file>` for each safe lane dir other than
 *           NON_LANE_DIRS;
 *   history `.current/history/<YYYY-MM>/<lane>/<file>` — two buckets holding
 *           the same lane name are distinct closures, both kept;
 *   flat    the legacy `.current/<file>`.
 *
 * Dedup (never by name alone — a long-lived lane such as `_primary` keeps
 * its live dir AND its history dirs):
 *   - a history copy of lane L is skipped iff isBytePrefix(history, live L)
 *     — a mid-move copy (spec AC4);
 *   - the flat file is skipped iff isBytePrefix(flat, X) for some counted
 *     lane copy X (live first, then history) — the shape an interrupted
 *     mergeSidecar leaves: `flat ++ lane` published at the lane path, flat
 *     not yet unlinked (spec AC5b). Any lane is checked, not only the
 *     current branch's: the branch may have changed since the migration, and
 *     the lane may since have closed into history.
 * Empty files are never skipped (they contribute zero records either way).
 *
 * Strictly read-only; never throws — an unlistable dir or unreadable file is
 * simply not a source.
 */
export declare function enumerateLaneSidecarSources(workspacePath: string, key: LaneFileKey): LaneSidecarSources;
//# sourceMappingURL=lane-paths.d.ts.map
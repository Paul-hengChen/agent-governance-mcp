type FileKind = "handoff" | "tasks";
export declare function markStateRead(workspacePath: string): void;
/**
 * Snapshot an arbitrary freshness token (e.g. SQLite row's last_updated).
 * Used by non-file storage backends where mtime comparison doesn't apply.
 */
export declare function snapshotExtra(workspacePath: string, key: string, value: string | null): void;
/**
 * Verify that the current value matches the snapshotted value for the given key.
 * Throws if drift is detected. No-op if the session has no record (enforcePreFlight
 * should already have rejected the call in that case).
 */
export declare function verifyExtra(workspacePath: string, key: string, currentValue: string | null): void;
export declare function hasReadState(workspacePath: string): boolean;
export declare function enforcePreFlight(workspacePath: string, toolName: string): void;
/**
 * Compare the on-disk mtime to the snapshot taken at tw_get_state time.
 * If they diverge, another process (or a human editor) changed the file —
 * the caller's mental model is stale and writes must be rejected.
 */
export declare function verifyFreshness(workspacePath: string, filePath: string, kind: FileKind): void;
/**
 * Update the snapshot mtime after a successful write so subsequent writes in
 * the same session don't trip the freshness check on their own changes.
 */
export declare function refreshSnapshotFor(workspacePath: string, filePath: string, kind: FileKind): void;
export declare function resetSession(workspacePath: string): void;
export declare function cleanupStaleSessions(maxAgeMs: number): void;
export {};
//# sourceMappingURL=session.d.ts.map
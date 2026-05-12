type FileKind = "handoff" | "tasks";
export declare function markStateRead(workspacePath: string): void;
export declare function hasReadState(workspacePath: string): boolean;
export declare function enforcePreFlight(workspacePath: string, toolName: string): void;
/**
 * Compare the on-disk mtime to the snapshot taken at sdd_get_state time.
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
export {};
//# sourceMappingURL=session.d.ts.map
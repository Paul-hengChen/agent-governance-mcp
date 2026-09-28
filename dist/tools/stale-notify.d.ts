export interface StaleDispatchAdvisory {
    role: string;
    dispatched_at: string;
    elapsed_minutes: number;
    threshold_minutes: number;
    message: string;
}
export interface StaleNotifyOutcome {
    emitted: boolean;
    path?: string;
    skipped_duplicate?: boolean;
    error?: string;
}
/**
 * Emit the stale-dispatch advisory to the workspace's opt-in watch-file.
 * Returns null when the workspace has not armed `staleDispatchNotifyFile`
 * (the default — caller surfaces nothing). NEVER throws — see module header.
 */
export declare function notifyStaleDispatch(workspacePath: string, advisory: StaleDispatchAdvisory): StaleNotifyOutcome | null;
//# sourceMappingURL=stale-notify.d.ts.map
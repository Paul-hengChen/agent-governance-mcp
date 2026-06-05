export interface ReconcileReport {
    ok: boolean;
    synced: string[];
    refusedVibeDrift: string[];
    message: string;
}
export declare function reconcileTasks(workspacePath: string): Promise<string>;
//# sourceMappingURL=sync.d.ts.map
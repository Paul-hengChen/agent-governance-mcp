import type { ToolResult, WorkspaceOnlyInput } from "./registry.js";
export interface ReconcileReport {
    ok: boolean;
    synced: string[];
    refusedVibeDrift: string[];
    message: string;
}
export declare function reconcileTasks(workspacePath: string): Promise<string>;
export declare function handleSync(args: WorkspaceOnlyInput): Promise<ToolResult>;
//# sourceMappingURL=sync.d.ts.map
import "../schema/migrations-config.js";
export interface CutApprovalAutoTier {
    maxFiles: number;
    maxPriority: string;
    allowSchemaChange: boolean;
    allowDesignArmed: boolean;
}
export declare const CUT_APPROVAL_AUTO_TIER_DEFAULTS: Readonly<CutApprovalAutoTier>;
export interface WorkspaceConfig {
    taskPattern?: string;
    taskPaths?: string[];
    driftBaselineIds?: string[];
    tokenBudgetPerFeature?: number;
    host?: string;
    cutApprovalAutoTier?: CutApprovalAutoTier;
    staleDispatchNotifyFile?: string;
}
export declare const DEFAULT_TASK_REGEX: RegExp;
export declare function loadConfig(workspacePath: string): WorkspaceConfig;
export declare function resolveTaskPaths(workspacePath: string): string[];
export declare function findTasksFile(workspacePath: string): string | null;
/**
 * Returns the active task-line regex. Either:
 *   - config.taskPattern (caller-supplied), or
 *   - the generic markdown-checkbox default.
 *
 * Contract for any pattern (custom or default): group 1 is the checkmark,
 * group 2 is the task ID, group 3+ are joined as the description.
 */
export declare function resolveTaskRegex(workspacePath: string): RegExp;
//# sourceMappingURL=config.d.ts.map
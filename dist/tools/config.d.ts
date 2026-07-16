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
/**
 * Typed workspace config view. Absent file OR any config-file fatality
 * (unreadable, unparseable, non-object root, future schema_version) returns
 * the empty config — defaults in effect. NEVER throws (E31): the failure is
 * surfaced via getConfigError(), not a pre-flight-blocking exception.
 */
export declare function loadConfig(workspacePath: string): WorkspaceConfig;
/**
 * Loud config-load error for the workspace, or null when the config loaded
 * clean or is simply absent (E31). Non-null means loadConfig() is currently
 * serving defaults IN PLACE OF a config file that exists but cannot be used —
 * the message names the config path and the parse/read problem. Surfaced as
 * `config_error` on every tw_get_state envelope so the degradation is never
 * silent. Same mtime-cached core as loadConfig — no extra I/O on the happy
 * path.
 */
export declare function getConfigError(workspacePath: string): string | null;
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
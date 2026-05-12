export interface SddConfig {
    taskPattern?: string;
    taskPaths?: string[];
}
export declare const SPECKIT_TASK_REGEX: RegExp;
export declare function loadConfig(workspacePath: string): SddConfig;
export declare function resolveTaskPaths(workspacePath: string): string[];
export declare function findTasksFile(workspacePath: string): string | null;
/**
 * Returns the active task-line regex.
 *   - If config.taskPattern is set, use it (must define at least groups 1 = checkmark, 2 = ID).
 *   - Otherwise return the Speckit-flavored default with full group breakdown.
 *
 * The boolean `isCustom` lets callers know whether to use the rich Speckit
 * field extraction or a minimal "checkmark + ID + rest" fallback.
 */
export declare function resolveTaskRegex(workspacePath: string): {
    regex: RegExp;
    isCustom: boolean;
};
//# sourceMappingURL=config.d.ts.map
/**
 * Get the next incomplete task from tasks.md.
 */
export declare function getNextTask(workspacePath: string): string;
/**
 * Mark a task as completed in tasks.md.
 */
export declare function completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
/**
 * Rollback a task: mark [x] → [ ] with reason.
 */
export declare function rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
//# sourceMappingURL=tasks.d.ts.map
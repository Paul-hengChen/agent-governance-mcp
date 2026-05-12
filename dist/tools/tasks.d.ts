/**
 * Get the next incomplete task from the task list.
 */
export declare function getNextTask(workspacePath: string): string;
/**
 * Mark a task as completed.
 */
export declare function completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
/**
 * Rollback a task: mark [x] → [ ] with reason.
 */
export declare function rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
//# sourceMappingURL=tasks.d.ts.map
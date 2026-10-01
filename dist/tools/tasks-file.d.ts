import "../schema/migrations-tasks.js";
export interface TaskRecord {
    id: string;
    description: string;
    section: string;
    completed: boolean;
}
export declare function parseTasksFromFile(workspacePath: string): TaskRecord[] | null;
export declare function getNextTaskFromFile(workspacePath: string): string;
export declare function completeTaskInFile(workspacePath: string, taskId: string, note?: string): Promise<string>;
export declare function rollbackTaskInFile(workspacePath: string, taskId: string, reason: string): Promise<string>;
/**
 * Void a task with the `- [-] <id>` marker, which the `[ x]` checkbox class
 * cannot match, so the row vanishes from every parseTasksFromFile consumer
 * (E117). A voided id can never be re-cut: evidence is keyed by id alone
 * (E120). Only an open row may be voided, checked against tasks.md AND
 * `handoff.completed_tasks`; a post-write re-parse under the configured
 * taskPattern refuses a void that would leave the id parseable.
 * Why: specs/e260b-rationale.md (tools/tasks-file.ts)
 */
export declare function voidTaskInFile(workspacePath: string, taskId: string, reason: string): Promise<string>;
/**
 * Append a new task to the current lane's ledger `.current/<lane>/tasks.md`,
 * creating it with a minimal scaffold if absent. Never writes a legacy task
 * file. (E125a)
 */
export declare function addTaskInFile(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
//# sourceMappingURL=tasks-file.d.ts.map
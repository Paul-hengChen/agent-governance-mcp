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
 * Append a new task to the active task list. If no task file exists yet, create
 * the first candidate path with a minimal scaffold.
 */
export declare function addTaskInFile(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
//# sourceMappingURL=tasks-file.d.ts.map
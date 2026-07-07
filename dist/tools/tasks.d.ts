import type { ToolResult, WorkspaceOnlyInput, CompleteTaskInput, RollbackTaskInput, AddTaskInput } from "./registry.js";
export declare function getNextTask(workspacePath: string): string;
export declare function completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
export declare function rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
export declare function addTask(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
export declare function handleGetNextTask(args: WorkspaceOnlyInput): Promise<ToolResult>;
export declare function handleCompleteTask(parsed: CompleteTaskInput): Promise<ToolResult>;
export declare function handleRollbackTask(parsed: RollbackTaskInput): Promise<ToolResult>;
export declare function handleAddTask(parsed: AddTaskInput): Promise<ToolResult>;
//# sourceMappingURL=tasks.d.ts.map
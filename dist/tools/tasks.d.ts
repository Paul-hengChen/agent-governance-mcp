export declare function getNextTask(workspacePath: string): string;
export declare function completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
export declare function rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
export declare function addTask(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
//# sourceMappingURL=tasks.d.ts.map
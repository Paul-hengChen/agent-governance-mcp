import type { HandoffStorage, HandoffState, TaskRecord } from "./storage.js";
export declare class SqliteHandoffStorage implements HandoffStorage {
    private db;
    private selectStmt;
    private selectLastUpdatedStmt;
    private upsertStmt;
    private txUpsert;
    private listTasksStmt;
    private maxSortStmt;
    private insertTaskStmt;
    private selectTaskStmt;
    private completeTaskStmt;
    private rollbackTaskStmt;
    constructor(dbPath: string);
    private fetchRow;
    private fetchLastUpdated;
    parse(workspacePath: string): HandoffState | null;
    readState(workspacePath: string): string;
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
    listTasks(workspacePath: string): TaskRecord[] | null;
    getNextTask(workspacePath: string): string;
    completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
    rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
    addTask(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
    close(): void;
}
//# sourceMappingURL=storage-sqlite.d.ts.map
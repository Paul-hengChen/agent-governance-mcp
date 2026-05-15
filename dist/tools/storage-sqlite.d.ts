import type { HandoffStorage, HandoffState } from "./storage.js";
export declare class SqliteHandoffStorage implements HandoffStorage {
    private db;
    private selectStmt;
    private selectLastUpdatedStmt;
    private upsertStmt;
    private txUpsert;
    constructor(dbPath: string);
    private fetchRow;
    private fetchLastUpdated;
    parse(workspacePath: string): HandoffState | null;
    readState(workspacePath: string): string;
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
    close(): void;
}
//# sourceMappingURL=storage-sqlite.d.ts.map
import { type HandoffState } from "./handoff.js";
import { type TaskRecord } from "./tasks-file.js";
export type { HandoffState, TaskRecord };
export interface HandoffStorage {
    readState(workspacePath: string): string;
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
    parse(workspacePath: string): HandoffState | null;
    listTasks(workspacePath: string): TaskRecord[] | null;
    getNextTask(workspacePath: string): string;
    completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
    rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
    addTask(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
}
export declare class FileHandoffStorage implements HandoffStorage {
    readState(workspacePath: string): string;
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
    parse(workspacePath: string): HandoffState | null;
    listTasks(workspacePath: string): TaskRecord[] | null;
    getNextTask(workspacePath: string): string;
    completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
    rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
    addTask(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
}
export declare function getActiveStorage(): HandoffStorage;
export declare function setActiveStorage(storage: HandoffStorage): void;
//# sourceMappingURL=storage.d.ts.map
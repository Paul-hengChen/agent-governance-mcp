import { type HandoffState } from "./handoff.js";
export type { HandoffState };
export interface HandoffStorage {
    readState(workspacePath: string): string;
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
    parse(workspacePath: string): HandoffState | null;
}
export declare class FileHandoffStorage implements HandoffStorage {
    readState(workspacePath: string): string;
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
    parse(workspacePath: string): HandoffState | null;
}
export declare function getActiveStorage(): HandoffStorage;
export declare function setActiveStorage(storage: HandoffStorage): void;
//# sourceMappingURL=storage.d.ts.map
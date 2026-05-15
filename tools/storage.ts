import { parseHandoff, readHandoffState, writeHandoffState, type HandoffState } from "./handoff.js";

export type { HandoffState };

export interface HandoffStorage {
  readState(workspacePath: string): string;
  writeState(
    workspacePath: string,
    activeFeature: string,
    status: string,
    completedTasks: string[],
    pendingNotes: string[],
    blockingReason?: string,
    lastAgent?: string,
  ): Promise<string>;
  parse(workspacePath: string): HandoffState | null;
}

export class FileHandoffStorage implements HandoffStorage {
  readState(workspacePath: string): string {
    return readHandoffState(workspacePath);
  }

  writeState(
    workspacePath: string,
    activeFeature: string,
    status: string,
    completedTasks: string[],
    pendingNotes: string[],
    blockingReason?: string,
    lastAgent?: string,
  ): Promise<string> {
    return writeHandoffState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent);
  }

  parse(workspacePath: string): HandoffState | null {
    return parseHandoff(workspacePath);
  }
}

let active: HandoffStorage = new FileHandoffStorage();

export function getActiveStorage(): HandoffStorage {
  return active;
}

export function setActiveStorage(storage: HandoffStorage): void {
  active = storage;
}

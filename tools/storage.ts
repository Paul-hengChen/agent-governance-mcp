// Coded by @sr-engineer
// Storage abstraction for handoff state AND task list operations.
// FileHandoffStorage is the stdio default (markdown + filesystem).
// SqliteHandoffStorage (HTTP mode) implements the same interface against a DB
// so remote / containerized deployments need no mounted workspace files.

import { parseHandoff, readHandoffState, writeHandoffState, type HandoffState } from "./handoff.js";
import {
  parseTasksFromFile,
  getNextTaskFromFile,
  completeTaskInFile,
  rollbackTaskInFile,
  addTaskInFile,
  type TaskRecord,
} from "./tasks-file.js";

export type { HandoffState, TaskRecord };

export interface HandoffStorage {
  // --- Handoff state ---
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

  // --- Task list ---
  listTasks(workspacePath: string): TaskRecord[] | null;
  getNextTask(workspacePath: string): string;
  completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
  rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
  addTask(
    workspacePath: string,
    taskId: string,
    description: string,
    section?: string,
  ): Promise<string>;
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

  listTasks(workspacePath: string): TaskRecord[] | null {
    return parseTasksFromFile(workspacePath);
  }

  getNextTask(workspacePath: string): string {
    return getNextTaskFromFile(workspacePath);
  }

  completeTask(workspacePath: string, taskId: string, note?: string): Promise<string> {
    return completeTaskInFile(workspacePath, taskId, note);
  }

  rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string> {
    return rollbackTaskInFile(workspacePath, taskId, reason);
  }

  addTask(
    workspacePath: string,
    taskId: string,
    description: string,
    section?: string,
  ): Promise<string> {
    return addTaskInFile(workspacePath, taskId, description, section);
  }
}

let active: HandoffStorage = new FileHandoffStorage();

export function getActiveStorage(): HandoffStorage {
  return active;
}

export function setActiveStorage(storage: HandoffStorage): void {
  active = storage;
}

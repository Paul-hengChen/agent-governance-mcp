// Coded by @sr-engineer
// Public task-list API. Delegates through the active storage adapter
// (FileHandoffStorage by default; SqliteHandoffStorage in HTTP mode).
// The file-system implementation lives in tools/tasks-file.ts and is consumed
// by FileHandoffStorage so callers never depend on filesystem layout directly.

import { getActiveStorage } from "./storage.js";

export function getNextTask(workspacePath: string): string {
  return getActiveStorage().getNextTask(workspacePath);
}

export function completeTask(
  workspacePath: string,
  taskId: string,
  note?: string,
): Promise<string> {
  return getActiveStorage().completeTask(workspacePath, taskId, note);
}

export function rollbackTask(
  workspacePath: string,
  taskId: string,
  reason: string,
): Promise<string> {
  return getActiveStorage().rollbackTask(workspacePath, taskId, reason);
}

export function addTask(
  workspacePath: string,
  taskId: string,
  description: string,
  section?: string,
): Promise<string> {
  return getActiveStorage().addTask(workspacePath, taskId, description, section);
}

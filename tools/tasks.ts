// Coded by @sr-engineer
// Public task-list API. Delegates through the active storage adapter
// (FileHandoffStorage by default; SqliteHandoffStorage in HTTP mode).
// The file-system implementation lives in tools/tasks-file.ts and is consumed
// by FileHandoffStorage so callers never depend on filesystem layout directly.

import { getActiveStorage } from "./storage.js";
import { enforcePreFlight } from "../guards/session.js";
import { requireQaEngineer } from "./transitions.js";
import type {
  ToolResult,
  WorkspaceOnlyInput,
  CompleteTaskInput,
  RollbackTaskInput,
  AddTaskInput,
} from "./registry.js";

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

// ==========================================
// MCP tool handlers (registry-pattern) — verbatim relocations of the
// index.ts dispatcher cases for tw_get_next_task, tw_complete_task,
// tw_rollback_task, tw_add_task. args arrive pre-parsed by
// tools/registry.ts defineTool.run (type imports erase at compile).
// ==========================================

// --- No guard: getting next task is read-only ---
export async function handleGetNextTask(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const { workspace_path } = args;
  const result = getNextTask(workspace_path);
  return { content: [{ type: "text" as const, text: result }] };
}

export async function handleCompleteTask(parsed: CompleteTaskInput): Promise<ToolResult> {
  enforcePreFlight(parsed.workspace_path, "tw_complete_task");
  const gate = requireQaEngineer(parsed.agent_id, "tw_complete_task");
  if (!gate.ok) {
    return { content: [{ type: "text" as const, text: gate.message ?? "blocked" }] };
  }
  const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
  return { content: [{ type: "text" as const, text: result }] };
}

export async function handleRollbackTask(parsed: RollbackTaskInput): Promise<ToolResult> {
  enforcePreFlight(parsed.workspace_path, "tw_rollback_task");
  const result = await rollbackTask(parsed.workspace_path, parsed.task_id, parsed.reason);
  return { content: [{ type: "text" as const, text: result }] };
}

export async function handleAddTask(parsed: AddTaskInput): Promise<ToolResult> {
  enforcePreFlight(parsed.workspace_path, "tw_add_task");
  const result = await addTask(
    parsed.workspace_path,
    parsed.task_id,
    parsed.description,
    parsed.section,
  );
  return { content: [{ type: "text" as const, text: result }] };
}

// Coded by @sr-engineer
// Public task-list API. Delegates through the active storage adapter
// (FileHandoffStorage by default; SqliteHandoffStorage in HTTP mode).
// The file-system implementation lives in tools/tasks-file.ts and is consumed
// by FileHandoffStorage so callers never depend on filesystem layout directly.
import { getActiveStorage } from "./storage.js";
import { enforcePreFlight } from "../guards/session.js";
import { requireQaEngineer } from "./transitions.js";
export function getNextTask(workspacePath) {
    return getActiveStorage().getNextTask(workspacePath);
}
export function completeTask(workspacePath, taskId, note) {
    return getActiveStorage().completeTask(workspacePath, taskId, note);
}
export function rollbackTask(workspacePath, taskId, reason) {
    return getActiveStorage().rollbackTask(workspacePath, taskId, reason);
}
export function addTask(workspacePath, taskId, description, section) {
    return getActiveStorage().addTask(workspacePath, taskId, description, section);
}
// ==========================================
// MCP tool handlers (registry-pattern) — verbatim relocations of the
// index.ts dispatcher cases for tw_get_next_task, tw_complete_task,
// tw_rollback_task, tw_add_task. args arrive pre-parsed by
// tools/registry.ts defineTool.run (type imports erase at compile).
// ==========================================
// --- No guard: getting next task is read-only ---
export async function handleGetNextTask(args) {
    const { workspace_path } = args;
    const result = getNextTask(workspace_path);
    return { content: [{ type: "text", text: result }] };
}
export async function handleCompleteTask(parsed) {
    enforcePreFlight(parsed.workspace_path, "tw_complete_task");
    const gate = requireQaEngineer(parsed.agent_id, "tw_complete_task");
    if (!gate.ok) {
        return { content: [{ type: "text", text: gate.message ?? "blocked" }] };
    }
    const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
    return { content: [{ type: "text", text: result }] };
}
export async function handleRollbackTask(parsed) {
    enforcePreFlight(parsed.workspace_path, "tw_rollback_task");
    const result = await rollbackTask(parsed.workspace_path, parsed.task_id, parsed.reason);
    return { content: [{ type: "text", text: result }] };
}
export async function handleAddTask(parsed) {
    enforcePreFlight(parsed.workspace_path, "tw_add_task");
    const result = await addTask(parsed.workspace_path, parsed.task_id, parsed.description, parsed.section);
    return { content: [{ type: "text", text: result }] };
}
//# sourceMappingURL=tasks.js.map
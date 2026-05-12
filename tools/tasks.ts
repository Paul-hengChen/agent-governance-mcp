// Tools: tasks.md manipulation — complete, rollback, get-next.
//
// The Speckit task format is the *default*, not a hard requirement. Workspaces
// can override the parser regex and search paths via .current/.config.json
// (see tools/config.ts). For task completion/rollback the file must still use
// standard markdown checkbox syntax (`- [ ]` / `- [x]`) — that's universal.

import * as fs from "fs";
import { verifyFreshness, refreshSnapshotFor } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { findTasksFile, resolveTaskRegex } from "./config.js";

interface TaskInfo {
  id: string;
  description: string;
  file: string | null;       // only populated for Speckit-format tasks
  phase: string;
  parallel: boolean;          // only meaningful for Speckit-format tasks
  userStory: string | null;   // only populated for Speckit-format tasks
  completed: boolean;
}

function parseTaskLine(
  line: string,
  phase: string,
  regex: RegExp,
  isCustom: boolean
): TaskInfo | null {
  const match = line.match(regex);
  if (!match) return null;

  if (isCustom) {
    // Custom pattern contract: group 1 = checkmark, group 2 = task ID.
    // Everything after group 2 is concatenated as the description.
    const checkmark = match[1];
    const id = match[2];
    if (checkmark === undefined || id === undefined) return null;
    const rest = match.slice(3).filter(Boolean).join(" ").trim();
    return {
      id,
      completed: checkmark === "x",
      description: rest || id,
      file: null,
      phase,
      parallel: false,
      userStory: null,
    };
  }

  // Speckit default: rich field extraction.
  return {
    id: match[2],
    completed: match[1] === "x",
    parallel: !!match[3],
    userStory: match[4]?.replace(/[\[\]]/g, "") ?? null,
    file: match[5].trim(),
    description: match[6].trim(),
    phase,
  };
}

function parseTasks(
  workspacePath: string
): { tasks: TaskInfo[]; filePath: string } | null {
  const filePath = findTasksFile(workspacePath);
  if (!filePath) return null;

  const { regex, isCustom } = resolveTaskRegex(workspacePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const tasks: TaskInfo[] = [];
  let currentPhase = "Unknown";

  for (const line of lines) {
    const phaseMatch = line.match(/^## Phase (\d+|99): (.+)/);
    if (phaseMatch) {
      currentPhase = `Phase ${phaseMatch[1]}: ${phaseMatch[2]}`;
      continue;
    }
    const task = parseTaskLine(line.trim(), currentPhase, regex, isCustom);
    if (task) tasks.push(task);
  }

  return { tasks, filePath };
}

/**
 * Get the next incomplete task from tasks.md.
 */
export function getNextTask(workspacePath: string): string {
  const result = parseTasks(workspacePath);
  if (!result) {
    return JSON.stringify({ error: "No tasks.md found in workspace." });
  }

  const next = result.tasks.find((t) => !t.completed);
  if (!next) {
    return JSON.stringify({ allComplete: true, totalTasks: result.tasks.length });
  }

  const currentPhaseIdx = result.tasks.indexOf(next);
  const prevTask = currentPhaseIdx > 0 ? result.tasks[currentPhaseIdx - 1] : null;
  const isCheckpoint = prevTask && prevTask.phase !== next.phase;

  return JSON.stringify({
    next,
    isCheckpoint,
    progress: {
      completed: result.tasks.filter((t) => t.completed).length,
      total: result.tasks.length,
    },
  });
}

function atomicWrite(filePath: string, content: string): void {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mark a task as completed in tasks.md.
 */
export async function completeTask(
  workspacePath: string,
  taskId: string,
  note?: string
): Promise<string> {
  const probe = parseTasks(workspacePath);
  if (!probe) {
    return JSON.stringify({ error: "No tasks.md found." });
  }
  const lockPath = `${probe.filePath}.lock`;

  return withFileLock(lockPath, () => {
    verifyFreshness(workspacePath, probe.filePath, "tasks");

    const result = parseTasks(workspacePath);
    if (!result) {
      return JSON.stringify({ error: "No tasks.md found." });
    }

    const task = result.tasks.find((t) => t.id === taskId);
    if (!task) {
      return JSON.stringify({ error: `Task ${taskId} not found.` });
    }
    if (task.completed) {
      return JSON.stringify({ error: `Task ${taskId} is already completed.` });
    }

    let content = fs.readFileSync(result.filePath, "utf-8");
    const suffix = note ? ` (${note})` : "";
    // Flip the standard markdown checkbox for this task id. Works for any
    // format that uses `- [ ] <taskId> ...` line syntax (universal).
    const oldPattern = new RegExp(`- \\[ \\] ${escapeRegExp(taskId)}(\\s.+)$`, "m");
    if (!oldPattern.test(content)) {
      return JSON.stringify({
        error: `Could not find an unchecked checkbox line for ${taskId}. ` +
          `Task lines must use markdown checkbox syntax: "- [ ] ${taskId} ...".`,
      });
    }
    content = content.replace(oldPattern, `- [x] ${taskId}$1${suffix}`);

    atomicWrite(result.filePath, content);
    refreshSnapshotFor(workspacePath, result.filePath, "tasks");

    return JSON.stringify({
      success: true,
      taskId,
      marked: "completed",
      note: note || null,
    });
  });
}

/**
 * Rollback a task: mark [x] → [ ] with reason.
 */
export async function rollbackTask(
  workspacePath: string,
  taskId: string,
  reason: string
): Promise<string> {
  const probe = parseTasks(workspacePath);
  if (!probe) {
    return JSON.stringify({ error: "No tasks.md found." });
  }
  const lockPath = `${probe.filePath}.lock`;

  return withFileLock(lockPath, () => {
    verifyFreshness(workspacePath, probe.filePath, "tasks");

    const result = parseTasks(workspacePath);
    if (!result) {
      return JSON.stringify({ error: "No tasks.md found." });
    }

    const task = result.tasks.find((t) => t.id === taskId);
    if (!task) {
      return JSON.stringify({ error: `Task ${taskId} not found.` });
    }
    if (!task.completed) {
      return JSON.stringify({ error: `Task ${taskId} is not completed, cannot rollback.` });
    }

    let content = fs.readFileSync(result.filePath, "utf-8");
    const oldPattern = new RegExp(
      `- \\[x\\] ${escapeRegExp(taskId)}(\\s.+?)(?:\\s*\\(.*\\))?$`,
      "m"
    );
    if (!oldPattern.test(content)) {
      return JSON.stringify({
        error: `Could not find a checked checkbox line for ${taskId}.`,
      });
    }
    content = content.replace(oldPattern, `- [ ] ${taskId}$1 (reverted: ${reason})`);

    atomicWrite(result.filePath, content);
    refreshSnapshotFor(workspacePath, result.filePath, "tasks");

    return JSON.stringify({ success: true, taskId, marked: "reverted", reason });
  });
}

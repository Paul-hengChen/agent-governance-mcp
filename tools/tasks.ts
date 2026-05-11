// Coded by @sr-engineer
// Tools: tasks.md manipulation — complete, rollback, get-next

import * as fs from "fs";
import * as path from "path";

interface TaskInfo {
  id: string;
  description: string;
  file: string;
  phase: string;
  parallel: boolean;
  userStory: string | null;
  completed: boolean;
}

function findTasksFile(workspacePath: string): string | null {
  // Search common locations for tasks.md
  const candidates = [
    path.join(workspacePath, ".current", "tasks.md"),
    path.join(workspacePath, ".specify", "tasks.md"),
    path.join(workspacePath, "specs", "tasks.md"),
    path.join(workspacePath, "tasks.md"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function parseTaskLine(line: string, phase: string): TaskInfo | null {
  // Match: - [ ] T01 [P] [US1] src/auth.ts: Implement JWT
  // or:    - [x] T01 src/auth.ts: Implement JWT
  const match = line.match(
    /^- \[([ x])\] (T\d+)\s*(\[P\])?\s*(\[US\d+\])?\s*(.+?):\s*(.+)$/
  );
  if (!match) return null;

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

function parseTasks(workspacePath: string): { tasks: TaskInfo[]; filePath: string } | null {
  const filePath = findTasksFile(workspacePath);
  if (!filePath) return null;

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
    const task = parseTaskLine(line.trim(), currentPhase);
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

  // Check if we're at a checkpoint
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

/**
 * Mark a task as completed in tasks.md.
 */
export function completeTask(
  workspacePath: string,
  taskId: string,
  note?: string
): string {
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
  // Replace the exact checkbox line
  const oldPattern = new RegExp(
    `- \\[ \\] ${taskId}(\\s.+)$`,
    "m"
  );
  content = content.replace(oldPattern, `- [x] ${taskId}$1${suffix}`);

  fs.writeFileSync(result.filePath, content, "utf-8");
  return JSON.stringify({ success: true, taskId, marked: "completed", note: note || null });
}

/**
 * Rollback a task: mark [x] → [ ] with reason.
 */
export function rollbackTask(
  workspacePath: string,
  taskId: string,
  reason: string
): string {
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
    `- \\[x\\] ${taskId}(\\s.+?)(?:\\s*\\(.*\\))?$`,
    "m"
  );
  content = content.replace(oldPattern, `- [ ] ${taskId}$1 (reverted: ${reason})`);

  fs.writeFileSync(result.filePath, content, "utf-8");
  return JSON.stringify({ success: true, taskId, marked: "reverted", reason });
}

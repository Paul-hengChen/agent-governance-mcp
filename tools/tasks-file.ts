// Coded by @sr-engineer
// File-system implementation of task-list operations.
// Consumed by FileHandoffStorage. Stays format-agnostic via .current/.config.json
// override of taskPattern / taskPaths.

import * as fs from "fs";
import * as path from "path";
import { verifyFreshness, refreshSnapshotFor } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { findTasksFile, resolveTaskPaths, resolveTaskRegex } from "./config.js";

export interface TaskRecord {
  id: string;
  description: string;
  section: string;
  completed: boolean;
}

function parseTaskLine(line: string, section: string, regex: RegExp): TaskRecord | null {
  const match = line.match(regex);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  const description = match.slice(3).filter(Boolean).join(" ").trim();
  return {
    id: match[2],
    completed: match[1] === "x",
    description: description || match[2],
    section,
  };
}

interface ParseResult {
  tasks: TaskRecord[];
  filePath: string;
}

function parseTasks(workspacePath: string): ParseResult | null {
  const filePath = findTasksFile(workspacePath);
  if (!filePath) return null;

  const regex = resolveTaskRegex(workspacePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const tasks: TaskRecord[] = [];
  let currentSection = "Unknown";

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }
    const task = parseTaskLine(line.trim(), currentSection, regex);
    if (task) tasks.push(task);
  }

  return { tasks, filePath };
}

export function parseTasksFromFile(workspacePath: string): TaskRecord[] | null {
  const result = parseTasks(workspacePath);
  return result ? result.tasks : null;
}

export function getNextTaskFromFile(workspacePath: string): string {
  const result = parseTasks(workspacePath);
  if (!result) {
    return JSON.stringify({ error: "No task list file found in workspace." });
  }

  const next = result.tasks.find((t) => !t.completed);
  if (!next) {
    return JSON.stringify({ allComplete: true, totalTasks: result.tasks.length });
  }

  const currentIdx = result.tasks.indexOf(next);
  const prevTask = currentIdx > 0 ? result.tasks[currentIdx - 1] : null;
  const isCheckpoint = prevTask && prevTask.section !== next.section;

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

export async function completeTaskInFile(
  workspacePath: string,
  taskId: string,
  note?: string,
): Promise<string> {
  const filePath = findTasksFile(workspacePath);
  if (!filePath) {
    return JSON.stringify({ error: "No task list file found." });
  }
  const lockPath = `${filePath}.lock`;

  return withFileLock(lockPath, () => {
    verifyFreshness(workspacePath, filePath, "tasks");

    const result = parseTasks(workspacePath);
    if (!result) {
      return JSON.stringify({ error: "No task list file found." });
    }

    const task = result.tasks.find((t) => t.id === taskId);
    if (!task) {
      return JSON.stringify({ error: `Task ${taskId} not found.` });
    }
    if (task.completed) {
      return JSON.stringify({ error: `Task ${taskId} is already completed.` });
    }

    let content = fs.readFileSync(result.filePath, "utf-8");
    const suffix = note ? ` (note: ${note})` : "";
    const oldPattern = new RegExp(`- \\[ \\] ${escapeRegExp(taskId)}(\\s.+)$`, "m");
    if (!oldPattern.test(content)) {
      return JSON.stringify({
        error:
          `Could not find an unchecked checkbox line for ${taskId}. ` +
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

export async function rollbackTaskInFile(
  workspacePath: string,
  taskId: string,
  reason: string,
): Promise<string> {
  const filePath = findTasksFile(workspacePath);
  if (!filePath) {
    return JSON.stringify({ error: "No task list file found." });
  }
  const lockPath = `${filePath}.lock`;

  return withFileLock(lockPath, () => {
    verifyFreshness(workspacePath, filePath, "tasks");

    const result = parseTasks(workspacePath);
    if (!result) {
      return JSON.stringify({ error: "No task list file found." });
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
      `- \\[x\\] ${escapeRegExp(taskId)}(\\s.+?)(?:\\s+\\((?:note|reverted):[^)]*\\))?$`,
      "m",
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

/**
 * Append a new task to the active task list. If no task file exists yet, create
 * the first candidate path with a minimal scaffold.
 */
export async function addTaskInFile(
  workspacePath: string,
  taskId: string,
  description: string,
  section?: string,
): Promise<string> {
  const existing = findTasksFile(workspacePath);
  const targetPath = existing ?? resolveTaskPaths(workspacePath)[0];
  if (!targetPath) {
    return JSON.stringify({ error: "Could not resolve a target task file path." });
  }
  const lockPath = `${targetPath}.lock`;

  return withFileLock(lockPath, () => {
    if (existing) {
      verifyFreshness(workspacePath, existing, "tasks");
    } else {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    const targetSection = section?.trim() || "Active";
    let content = existing ? fs.readFileSync(existing, "utf-8") : `# Tasks\n\n## ${targetSection}\n`;

    if (existing) {
      const regex = resolveTaskRegex(workspacePath);
      const match = content.match(regex);
      if (match && match[2] === taskId) {
        return JSON.stringify({ error: `Task ${taskId} already exists.` });
      }
      // Re-scan for duplicate IDs across all lines (not just first match).
      for (const line of content.split("\n")) {
        const m = line.trim().match(regex);
        if (m && m[2] === taskId) {
          return JSON.stringify({ error: `Task ${taskId} already exists.` });
        }
      }
    }

    const newLine = `- [ ] ${taskId} ${description}`;
    const sectionHeading = `## ${targetSection}`;
    const headingIdx = content.indexOf(sectionHeading);

    if (headingIdx === -1) {
      // Section missing — append a new section block.
      const trimmed = content.endsWith("\n") ? content : `${content}\n`;
      content = `${trimmed}\n${sectionHeading}\n${newLine}\n`;
    } else {
      // Insert directly after the heading line, before the next blank line or next ## heading.
      const afterHeading = content.indexOf("\n", headingIdx) + 1;
      const rest = content.slice(afterHeading);
      const nextSectionIdx = rest.search(/(^|\n)##\s/);
      if (nextSectionIdx === -1) {
        content = `${content.slice(0, afterHeading)}${rest.replace(/\s*$/, "")}\n${newLine}\n`;
      } else {
        const sectionBlock = rest.slice(0, nextSectionIdx).replace(/\s*$/, "");
        const tail = rest.slice(nextSectionIdx);
        content = `${content.slice(0, afterHeading)}${sectionBlock}\n${newLine}\n${tail}`;
      }
    }

    atomicWrite(targetPath, content);
    refreshSnapshotFor(workspacePath, targetPath, "tasks");

    return JSON.stringify({
      success: true,
      taskId,
      section: targetSection,
      storage: "file",
      path: targetPath,
    });
  });
}

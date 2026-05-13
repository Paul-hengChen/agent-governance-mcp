// Tools: task-list manipulation — complete, rollback, get-next.
//
// Format-agnostic by design. The default is a generic markdown checkbox
// (`- [ ] <id> <description>`); any methodology with a different ID space
// or paths can override via .current/.config.json. The complete/rollback
// operations only require standard markdown checkbox syntax for the flip.
import * as fs from "fs";
import { verifyFreshness, refreshSnapshotFor } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { findTasksFile, resolveTaskRegex } from "./config.js";
function parseTaskLine(line, section, regex) {
    const match = line.match(regex);
    if (!match || match[1] === undefined || match[2] === undefined)
        return null;
    const description = match.slice(3).filter(Boolean).join(" ").trim();
    return {
        id: match[2],
        completed: match[1] === "x",
        description: description || match[2],
        section,
    };
}
function parseTasks(workspacePath) {
    const filePath = findTasksFile(workspacePath);
    if (!filePath)
        return null;
    const regex = resolveTaskRegex(workspacePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const tasks = [];
    let currentSection = "Unknown";
    for (const line of lines) {
        // Any `## heading` resets the current section. Methodology-agnostic.
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            continue;
        }
        const task = parseTaskLine(line.trim(), currentSection, regex);
        if (task)
            tasks.push(task);
    }
    return { tasks, filePath };
}
/**
 * Get the next incomplete task from the task list.
 */
export function getNextTask(workspacePath) {
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
function atomicWrite(filePath, content) {
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, filePath);
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Mark a task as completed.
 */
export async function completeTask(workspacePath, taskId, note) {
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
export async function rollbackTask(workspacePath, taskId, reason) {
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
        // Strip only known annotation suffixes `(note: ...)` or `(reverted: ...)` — not arbitrary
        // description parens like `fix(auth)` — to avoid stripping content from task descriptions.
        const oldPattern = new RegExp(`- \\[x\\] ${escapeRegExp(taskId)}(\\s.+?)(?:\\s+\\((?:note|reverted):[^)]*\\))?$`, "m");
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
//# sourceMappingURL=tasks.js.map
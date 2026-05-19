// Coded by @sr-engineer
// File-system implementation of task-list operations.
// Consumed by FileHandoffStorage. Stays format-agnostic via .current/.config.json
// override of taskPattern / taskPaths.
import * as fs from "fs";
import * as path from "path";
import { verifyFreshness, refreshSnapshotFor } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { findTasksFile, resolveTaskPaths, resolveTaskRegex } from "./config.js";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
import "../schema/migrations-tasks.js";
// Leading HTML comment that carries the on-disk schema_version for tasks.md.
// Must be line 1. Re-emitted by atomicWrite on every mutation so the file
// heals on the first write after a server upgrade.
const SENTINEL_RE = /^<!--\s*schema_version:\s*(\d+)\s*-->\s*\r?\n/;
function stripSentinel(content) {
    const match = content.match(SENTINEL_RE);
    if (!match)
        return { body: content };
    const version = Number(match[1]);
    if (!Number.isFinite(version))
        return { body: content };
    return { version: Math.floor(version), body: content.slice(match[0].length) };
}
function prependSentinel(body) {
    return `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n${body}`;
}
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
    const rawContent = fs.readFileSync(filePath, "utf-8");
    // Strip the leading version sentinel (if any), then run schema migrations
    // on the envelope. Lazy migrate-on-read (Phase 4) — throws refuse-loud when
    // the on-disk version exceeds CURRENT_VERSIONS.tasks.
    const stripped = stripSentinel(rawContent);
    const migration = runMigrations("tasks", {
        schema_version: stripped.version,
        body: stripped.body,
    });
    const migratedBody = migration.payload.body;
    const migrationApplied = migration.applied.length > 0;
    const lines = migratedBody.split("\n");
    const tasks = [];
    let currentSection = "Unknown";
    for (const line of lines) {
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            continue;
        }
        const task = parseTaskLine(line.trim(), currentSection, regex);
        if (task)
            tasks.push(task);
    }
    return { tasks, filePath, migratedBody, migrationApplied };
}
export function parseTasksFromFile(workspacePath) {
    const result = parseTasks(workspacePath);
    return result ? result.tasks : null;
}
export function getNextTaskFromFile(workspacePath) {
    const result = parseTasks(workspacePath);
    if (!result) {
        return JSON.stringify({ error: "No task list file found in workspace." });
    }
    // Heal-on-read for tasks.md: if the schema migration upgraded the in-memory
    // body, persist the upgraded file with sentinel via atomicWrite. Best-effort
    // (synchronous; failures here surface as a thrown error rather than fire-
    // and-forget because we have no file lock here and atomicWrite is sync).
    if (result.migrationApplied) {
        try {
            atomicWrite(result.filePath, result.migratedBody);
        }
        catch {
            /* swallowed — in-memory tasks already at CURRENT for the caller */
        }
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
// Always prepends the schema_version sentinel at CURRENT before publishing.
// Callers pass the body without sentinel; atomicWrite owns the stamping.
function atomicWrite(filePath, content) {
    const stripped = stripSentinel(content);
    const stamped = prependSentinel(stripped.body);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, stamped, "utf-8");
    fs.renameSync(tmpPath, filePath);
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export async function completeTaskInFile(workspacePath, taskId, note) {
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
export async function rollbackTaskInFile(workspacePath, taskId, reason) {
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
/**
 * Append a new task to the active task list. If no task file exists yet, create
 * the first candidate path with a minimal scaffold.
 */
export async function addTaskInFile(workspacePath, taskId, description, section) {
    const existing = findTasksFile(workspacePath);
    const targetPath = existing ?? resolveTaskPaths(workspacePath)[0];
    if (!targetPath) {
        return JSON.stringify({ error: "Could not resolve a target task file path." });
    }
    const lockPath = `${targetPath}.lock`;
    return withFileLock(lockPath, () => {
        if (existing) {
            verifyFreshness(workspacePath, existing, "tasks");
        }
        else {
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
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
        }
        else {
            // Insert directly after the heading line, before the next blank line or next ## heading.
            const afterHeading = content.indexOf("\n", headingIdx) + 1;
            const rest = content.slice(afterHeading);
            const nextSectionIdx = rest.search(/(^|\n)##\s/);
            if (nextSectionIdx === -1) {
                content = `${content.slice(0, afterHeading)}${rest.replace(/\s*$/, "")}\n${newLine}\n`;
            }
            else {
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
//# sourceMappingURL=tasks-file.js.map
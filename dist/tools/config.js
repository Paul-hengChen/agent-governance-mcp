// Per-workspace SDD config loader.
// All fields optional — absent file means "use Speckit-flavored defaults".
//
// .current/.config.json shape:
//   {
//     "taskPattern": "<JS regex source string>",   // matched against trimmed line; group 1 = " "|"x" checkmark, group 2 = task ID
//     "taskPaths": ["tasks.md", "TODO.md"]          // workspace-relative candidate paths, tried in order
//   }
import * as fs from "fs";
import * as path from "path";
const SPECKIT_DEFAULT_TASK_PATHS = [
    ".current/tasks.md",
    ".specify/tasks.md",
    "specs/tasks.md",
    "tasks.md",
];
// Default Speckit-flavored regex. Captures:
//   1: checkmark, 2: T-ID, 3: [P] parallel, 4: [US..] story, 5: file, 6: description
export const SPECKIT_TASK_REGEX = /^- \[([ x])\] (T\d+)\s*(\[P\])?\s*(\[US\d+\])?\s*(.+?):\s*(.+)$/;
export function loadConfig(workspacePath) {
    const configPath = path.join(workspacePath, ".current", ".config.json");
    if (!fs.existsSync(configPath))
        return {};
    let raw;
    try {
        raw = fs.readFileSync(configPath, "utf-8");
    }
    catch (err) {
        throw new Error(`Failed to read ${configPath}: ${err.message}`);
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("config must be a JSON object");
        }
        return parsed;
    }
    catch (err) {
        throw new Error(`Failed to parse ${configPath}: ${err.message}`);
    }
}
export function resolveTaskPaths(workspacePath) {
    const config = loadConfig(workspacePath);
    const rels = config.taskPaths?.length ? config.taskPaths : SPECKIT_DEFAULT_TASK_PATHS;
    return rels.map((p) => path.join(workspacePath, p));
}
export function findTasksFile(workspacePath) {
    return resolveTaskPaths(workspacePath).find((p) => fs.existsSync(p)) ?? null;
}
/**
 * Returns the active task-line regex.
 *   - If config.taskPattern is set, use it (must define at least groups 1 = checkmark, 2 = ID).
 *   - Otherwise return the Speckit-flavored default with full group breakdown.
 *
 * The boolean `isCustom` lets callers know whether to use the rich Speckit
 * field extraction or a minimal "checkmark + ID + rest" fallback.
 */
export function resolveTaskRegex(workspacePath) {
    const config = loadConfig(workspacePath);
    if (config.taskPattern) {
        try {
            return { regex: new RegExp(config.taskPattern), isCustom: true };
        }
        catch (err) {
            throw new Error(`Invalid taskPattern in .current/.config.json: ${err.message}`);
        }
    }
    return { regex: SPECKIT_TASK_REGEX, isCustom: false };
}
//# sourceMappingURL=config.js.map
// Per-workspace config loader for the agent-governance-mcp server.
// All fields optional — absent file means "use the generic markdown-checkbox defaults".
//
// .current/.config.json shape:
//   {
//     "taskPattern": "<JS regex source string>",   // matched against trimmed line; group 1 = " "|"x" checkmark, group 2 = task ID, group 3 = description
//     "taskPaths": ["tasks.md", "TODO.md"],         // workspace-relative candidate paths, tried in order
//     "driftBaselineIds": ["T470", "T471"],         // task IDs acknowledged as shipped+reconciled; excluded from vibe-coding drift (tw_detect_drift)
//     "tokenBudgetPerFeature": 500000               // opt-in coordinator token-spend ceiling (raw summed usage.* tokens); non-positive/non-finite values treated as absent
//   }
import * as fs from "fs";
import * as path from "path";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
// Side-effect import: registers the config v0→v1 migration on module load.
import "../schema/migrations-config.js";
// Methodology-agnostic defaults. Common task-list filenames in workspace root
// or under .current/. No project-management-tool-specific paths.
const DEFAULT_TASK_PATHS = [
    ".current/tasks.md",
    "tasks.md",
    "TODO.md",
];
// Generic markdown-checkbox regex.
//   Group 1: checkmark (" " or "x")
//   Group 2: task ID (any non-whitespace token immediately after the checkbox)
//   Group 3: description (everything after the ID)
// Matches lines like:
//   - [ ] T01 build login flow
//   - [x] PROJ-42 fix race
//   - [ ] auth-refactor write migration
export const DEFAULT_TASK_REGEX = /^- \[([ x])\] (\S+)\s+(.+)$/;
const configCache = new Map();
// Current mtimeMs of the config file, or null when it does not exist.
// Non-ENOENT stat errors propagate (refuse-loud, same spirit as read errors).
function statConfigMtime(configPath) {
    try {
        return fs.statSync(configPath).mtimeMs;
    }
    catch (err) {
        if (err.code === "ENOENT")
            return null;
        throw new Error(`Failed to stat ${configPath}: ${err.message}`);
    }
}
export function loadConfig(workspacePath) {
    const configPath = path.join(workspacePath, ".current", ".config.json");
    // Re-stat on every call (C18): a cache hit is only served when the on-disk
    // state (existence + mtimeMs) still matches what was recorded at cache
    // time. Existence flips and mtime bumps both fall through to a re-read.
    const currentMtime = statConfigMtime(configPath);
    const cached = configCache.get(workspacePath);
    if (cached !== undefined && cached.mtimeMs === currentMtime) {
        return cached.config;
    }
    if (currentMtime === null) {
        configCache.set(workspacePath, { config: {}, mtimeMs: null });
        return {};
    }
    let raw;
    try {
        raw = fs.readFileSync(configPath, "utf-8");
    }
    catch (err) {
        throw new Error(`Failed to read ${configPath}: ${err.message}`);
    }
    let parsed;
    try {
        const decoded = JSON.parse(raw);
        if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
            throw new Error("config must be a JSON object");
        }
        parsed = decoded;
    }
    catch (err) {
        throw new Error(`Failed to parse ${configPath}: ${err.message}`);
    }
    // Schema-versioning lazy migrate-on-read (Phase 4). Bumps an absent or
    // older schema_version up to CURRENT_VERSIONS.config. Throws refuse-loud
    // on future versions — propagates intentionally (AC-4).
    const migration = runMigrations("config", parsed);
    if (migration.applied.length > 0) {
        // Best-effort heal-on-read: persist the upgraded JSON. Failures here
        // (concurrent writer, permission flap) are non-fatal; the in-memory shape
        // returned below is already at CURRENT.
        try {
            atomicWriteConfig(configPath, migration.payload);
        }
        catch {
            /* swallowed — caller still receives migrated shape */
        }
    }
    // Strip schema_version from the typed view so downstream callers stay on
    // the existing WorkspaceConfig shape. Only known fields are surfaced;
    // unknown keys are dropped from the typed result but preserved on disk.
    const result = {};
    const taskPattern = migration.payload.taskPattern;
    if (typeof taskPattern === "string")
        result.taskPattern = taskPattern;
    const taskPaths = migration.payload.taskPaths;
    if (Array.isArray(taskPaths)) {
        const filtered = taskPaths.filter((p) => typeof p === "string");
        if (filtered.length > 0)
            result.taskPaths = filtered;
    }
    // Additive-optional field (no schema_version bump — same precedent as
    // taskPattern/taskPaths: absence == empty, no transform required).
    const driftBaselineIds = migration.payload.driftBaselineIds;
    if (Array.isArray(driftBaselineIds)) {
        const filtered = driftBaselineIds.filter((p) => typeof p === "string");
        if (filtered.length > 0)
            result.driftBaselineIds = filtered;
    }
    // Additive-optional field (no schema_version bump — same precedent as
    // driftBaselineIds). Non-fatal filter: only a positive finite number is
    // surfaced; strings, negatives, zero, NaN, Infinity are treated as absent
    // (brake disabled) rather than throwing.
    const tokenBudgetPerFeature = migration.payload.tokenBudgetPerFeature;
    if (typeof tokenBudgetPerFeature === "number" &&
        Number.isFinite(tokenBudgetPerFeature) &&
        tokenBudgetPerFeature > 0) {
        result.tokenBudgetPerFeature = tokenBudgetPerFeature;
    }
    // Cache under the pre-read mtime. If the migration heal-on-read above
    // rewrote the file, the recorded mtime is already stale — the NEXT call's
    // stat will mismatch and trigger one redundant (but correct) re-read,
    // which is preferable to racing a post-write re-stat against concurrent
    // writers/deleters.
    configCache.set(workspacePath, { config: result, mtimeMs: currentMtime });
    return result;
}
function atomicWriteConfig(configPath, payload) {
    // Re-stamp at CURRENT regardless of what the input carried, so the file
    // converges even if an upstream migration forgot to set the field.
    const stamped = { ...payload, schema_version: CURRENT_VERSIONS.config };
    const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(stamped, null, 2)}\n`, "utf-8");
    fs.renameSync(tmpPath, configPath);
}
export function resolveTaskPaths(workspacePath) {
    const config = loadConfig(workspacePath);
    const rels = config.taskPaths?.length ? config.taskPaths : DEFAULT_TASK_PATHS;
    return rels.map((p) => path.join(workspacePath, p));
}
export function findTasksFile(workspacePath) {
    return resolveTaskPaths(workspacePath).find((p) => fs.existsSync(p)) ?? null;
}
/**
 * Returns the active task-line regex. Either:
 *   - config.taskPattern (caller-supplied), or
 *   - the generic markdown-checkbox default.
 *
 * Contract for any pattern (custom or default): group 1 is the checkmark,
 * group 2 is the task ID, group 3+ are joined as the description.
 */
export function resolveTaskRegex(workspacePath) {
    const config = loadConfig(workspacePath);
    if (config.taskPattern) {
        try {
            return new RegExp(config.taskPattern);
        }
        catch (err) {
            throw new Error(`Invalid taskPattern in .current/.config.json: ${err.message}`);
        }
    }
    return DEFAULT_TASK_REGEX;
}
//# sourceMappingURL=config.js.map
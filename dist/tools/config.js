// Per-workspace config loader for the agent-governance-mcp server.
// All fields optional — absent file means "use the generic markdown-checkbox defaults".
//
// .current/.config.json shape:
//   {
//     "taskPattern": "<JS regex source string>",   // matched against trimmed line; group 1 = " "|"x" checkmark, group 2 = task ID, group 3 = description
//     "taskPaths": ["tasks.md", "TODO.md"],         // workspace-relative candidate paths, tried in order
//     "driftBaselineIds": ["T470", "T471"],         // task IDs acknowledged as shipped+reconciled; excluded from vibe-coding drift (tw_detect_drift)
//     "tokenBudgetPerFeature": 500000,              // opt-in coordinator token-spend ceiling (raw summed usage.* tokens); non-positive/non-finite values treated as absent
//     "cutApprovalAutoTier": {                      // opt-in §3.1 cut-approval auto-tier threshold; key PRESENT (even {}) = tier armed, absent = disabled
//       "maxFiles": 2,                              //   omitted fields take these conservative defaults
//       "maxPriority": "P3",
//       "allowSchemaChange": false,
//       "allowDesignArmed": false
//     },
//     "staleDispatchNotifyFile": ".current/stale-dispatch.notify", // opt-in stale-dispatch watch-file emit; absent = disarmed
//     "artifacts": "local"                          // "local" | "repo": declared git posture for governance runtime artifacts; absent = undeclared
//   }
//
// tokenBudgetPerFeature accounting: the ceiling is backed by the durable
// .current/usage.jsonl sidecar — appended per dispatch by the opt-in
// PostToolUse hook (bin/agent-governance-usage-hook.mjs) and summed per
// feature by tools/usage-accounting.ts — rather than the coordinator's
// in-memory arithmetic. The coordinator falls back to hand-summing the
// agent-*.jsonl transcripts only when the sidecar is absent (hook not
// wired). (D2)
import * as fs from "fs";
import * as path from "path";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
// Side-effect import: registers the config v0→v1 migration on module load.
import "../schema/migrations-config.js";
import { resolveCurrentLanePaths } from "./lane-paths.js";
// Conservative defaults, starting small on purpose. Applied per field when
// the arming key is present but a field is omitted or invalid. The tier
// itself is opt-in: these defaults never arm it. (E5)
export const CUT_APPROVAL_AUTO_TIER_DEFAULTS = {
    maxFiles: 2,
    maxPriority: "P3",
    allowSchemaChange: false,
    allowDesignArmed: false,
};
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
// Shared non-fatal load core. Returns the typed config view plus the loud
// load error, serving/refreshing the mtime cache. NEVER throws on a bad
// config file — every failure becomes
// { config: {}, error: <message naming the path + problem> }. (E31)
function loadConfigEntry(workspacePath) {
    const configPath = path.join(workspacePath, ".current", ".config.json");
    // Re-stat on every call (C18): a cache hit is only served when the on-disk
    // state (existence + mtimeMs) still matches what was recorded at cache
    // time. Existence flips and mtime bumps both fall through to a re-read.
    // Non-ENOENT stat errors (permission flap on .current/) are non-fatal but
    // deliberately UNCACHED — mtime cannot witness a chmod, so re-stat every
    // call until the flap clears.
    let currentMtime;
    try {
        currentMtime = fs.statSync(configPath).mtimeMs;
    }
    catch (err) {
        if (err.code !== "ENOENT") {
            return {
                config: {},
                mtimeMs: null,
                error: `Failed to stat ${configPath}: ${err.message} — config IGNORED, defaults in effect.`,
            };
        }
        currentMtime = null;
    }
    const cached = configCache.get(workspacePath);
    if (cached !== undefined && cached.mtimeMs === currentMtime) {
        return cached;
    }
    if (currentMtime === null) {
        const entry = { config: {}, mtimeMs: null, error: null };
        configCache.set(workspacePath, entry);
        return entry;
    }
    let raw;
    try {
        raw = fs.readFileSync(configPath, "utf-8");
    }
    catch (err) {
        // Exists but unreadable: loud, defaults in effect. UNCACHED for the same
        // chmod-invisible-to-mtime reason as the stat branch above.
        return {
            config: {},
            mtimeMs: null,
            error: `Failed to read ${configPath}: ${err.message} — config IGNORED, defaults in effect.`,
        };
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
        // Content-derived failure: cache under the corrupt file's mtime (a fix
        // necessarily bumps it, invalidating the cached error).
        const entry = {
            config: {},
            mtimeMs: currentMtime,
            error: `Failed to parse ${configPath}: ${err.message} — config IGNORED, defaults in effect.`,
        };
        configCache.set(workspacePath, entry);
        return entry;
    }
    // Lazy migrate-on-read. Bumps an absent or older schema_version up to
    // CURRENT_VERSIONS.config. A FUTURE on-disk version throws inside
    // runMigrations (refuse loudly) — that refusal is caught as a loud
    // config_error instead of propagating into the pre-flight read: a shape
    // this server does not understand is still refused, but the refusal does
    // not block tw_get_state. (E31)
    let migration;
    try {
        migration = runMigrations("config", parsed);
    }
    catch (err) {
        const entry = {
            config: {},
            mtimeMs: currentMtime,
            error: `Failed to load ${configPath}: ${err.message} — config IGNORED, defaults in effect.`,
        };
        configCache.set(workspacePath, entry);
        return entry;
    }
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
    // Additive-optional field (no schema_version bump — same precedent as
    // driftBaselineIds/tokenBudgetPerFeature). Non-fatal filter: only a
    // non-empty string is surfaced; anything else is treated as absent, which
    // downstream maps to the lean { taskTool: false } capability profile.
    const host = migration.payload.host;
    if (typeof host === "string" && host.length > 0) {
        result.host = host;
    }
    // Additive-optional field (no schema_version bump — same precedent as
    // driftBaselineIds/tokenBudgetPerFeature). Opt-in arming key for the §3.1
    // cut-approval auto-tier: the key's PRESENCE as a JSON object (even {})
    // arms the tier; absence disables it. Non-fatal per-field filter: an
    // omitted or invalid field falls back to the conservative default; a
    // non-object value is treated as absent (tier disabled), not an error.
    const autoTier = migration.payload.cutApprovalAutoTier;
    if (autoTier && typeof autoTier === "object" && !Array.isArray(autoTier)) {
        const tier = autoTier;
        result.cutApprovalAutoTier = {
            maxFiles: typeof tier.maxFiles === "number" &&
                Number.isFinite(tier.maxFiles) &&
                tier.maxFiles > 0
                ? Math.floor(tier.maxFiles)
                : CUT_APPROVAL_AUTO_TIER_DEFAULTS.maxFiles,
            maxPriority: typeof tier.maxPriority === "string" && /^P\d+$/.test(tier.maxPriority)
                ? tier.maxPriority
                : CUT_APPROVAL_AUTO_TIER_DEFAULTS.maxPriority,
            // Strict === true: anything else (absent, truthy junk) stays false —
            // schema-change / design-armed cuts never auto-approve by accident.
            allowSchemaChange: tier.allowSchemaChange === true,
            allowDesignArmed: tier.allowDesignArmed === true,
        };
    }
    // Additive-optional field (no schema_version bump — same precedent as
    // host/driftBaselineIds). Non-fatal filter: only a non-empty string is
    // surfaced; anything else is treated as absent (notify channel disarmed),
    // never an error.
    const staleDispatchNotifyFile = migration.payload.staleDispatchNotifyFile;
    if (typeof staleDispatchNotifyFile === "string" && staleDispatchNotifyFile.length > 0) {
        result.staleDispatchNotifyFile = staleDispatchNotifyFile;
    }
    // Introduced by config schema v2 (stamp-only migration, nothing seeded).
    // Narrow filter: only the two exact strings pass; any other value is
    // treated as undeclared rather than an error, matching how `agc check`
    // reads the same key.
    const artifacts = migration.payload.artifacts;
    if (artifacts === "local" || artifacts === "repo") {
        result.artifacts = artifacts;
    }
    // Cache under the pre-read mtime. If the migration heal-on-read above
    // rewrote the file, the recorded mtime is already stale — the NEXT call's
    // stat will mismatch and trigger one redundant (but correct) re-read,
    // which is preferable to racing a post-write re-stat against concurrent
    // writers/deleters.
    const entry = { config: result, mtimeMs: currentMtime, error: null };
    configCache.set(workspacePath, entry);
    return entry;
}
/**
 * Typed workspace config view. Absent file OR any unusable config file
 * (unreadable, unparseable, non-object root, future schema_version) returns
 * the empty config — defaults in effect. NEVER throws: the failure is
 * reported via getConfigError(), not a pre-flight-blocking exception. (E31)
 */
export function loadConfig(workspacePath) {
    return loadConfigEntry(workspacePath).config;
}
/**
 * Loud config-load error for the workspace, or null when the config loaded
 * clean or is simply absent. Non-null means loadConfig() is currently
 * serving defaults IN PLACE OF a config file that exists but cannot be used —
 * the message names the config path and the parse/read problem. Returned as
 * `config_error` on every tw_get_state envelope so the fallback is never
 * silent. Same mtime-cached core as loadConfig — no extra I/O on the happy
 * path. (E31)
 */
export function getConfigError(workspacePath) {
    return loadConfigEntry(workspacePath).error;
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
/**
 * The current lane's ledger `.current/<lane>/tasks.md` when it exists, else
 * the legacy file (findLegacyTasksFile). Side-effect-free — no write, no
 * migration, ever: guards/session.ts's markStateRead snapshots this path at
 * tw_get_state time. It is NOT the ledger reader: tools/tasks-file.ts reads
 * only the lane path; this fallback serves the freshness snapshot and
 * index-only readers (tools/drift.ts's schema-skew check). (E125a)
 */
export function findTasksFile(workspacePath) {
    const lanePath = resolveCurrentLanePaths(workspacePath).tasksPath;
    return fs.existsSync(lanePath) ? lanePath : findLegacyTasksFile(workspacePath);
}
/**
 * The legacy task file: the first resolveTaskPaths() candidate that exists
 * AND is not nested inside a `.current/<dir>/` (a lane-local ledger never
 * counts as legacy; flat `.current/tasks.md` does). Pure, read-only. Used by
 * tools/tasks-lane-migrate.ts (the forward/reverse migration) and, via
 * findTasksFile's fallback, by index-only readers. (E125a)
 */
export function findLegacyTasksFile(workspacePath) {
    const currentDir = path.join(workspacePath, ".current");
    return (resolveTaskPaths(workspacePath).find((p) => {
        const rel = path.relative(currentDir, p);
        const segs = rel.split(path.sep);
        const nestedInCurrent = !path.isAbsolute(rel) && segs[0] !== ".." && segs.length > 1;
        return !nestedInCurrent && fs.existsSync(p);
    }) ?? null);
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
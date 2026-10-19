// Per-workspace config loader. Every .current/.config.json field is optional;
// an absent file means the generic markdown-checkbox defaults. Fields without
// a comment in WorkspaceConfig: taskPattern (regex source; groups: checkmark,
// task id, description), taskPaths (candidate task files, tried in order),
// driftBaselineIds (ids excluded from vibe-coding drift) and
// tokenBudgetPerFeature (opt-in token ceiling; non-positive values = absent).
// Why: specs/e260a-tools-a-h-rationale.md, "tools/config.ts — config file".
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
    manifest: false,
};
// Same character class as bin/agc-init.mjs GITIGNORE_UNSAFE_SEGMENT_RE: each
// location becomes a `/<loc>/node_modules` exclude rule.
const NODE_MODULES_LINK_UNSAFE_RE = /[*?[\]\\\x00-\x1f\x7f]/;
function normalizeNodeModulesLink(entry) {
    if (typeof entry !== "string" || entry.length === 0)
        return null;
    if (entry.startsWith("/") || /^[A-Za-z]:/.test(entry))
        return null;
    const loc = entry.endsWith("/") ? entry.slice(0, -1) : entry;
    if (loc === ".")
        return loc;
    const ok = loc.split("/").every((seg) => seg.length > 0 && seg !== "." && seg !== ".." && !NODE_MODULES_LINK_UNSAFE_RE.test(seg));
    return ok ? loc : null;
}
/**
 * The one validation definition for the `nodeModulesLinks` key (E291 D2).
 * Returns null when `value` is not an array (null included). Otherwise
 * every entry is either kept (one trailing "/" stripped; first occurrence
 * wins on duplicates) or listed in `rejected`, both in list order. Never throws.
 */
export function parseNodeModulesLinks(value) {
    if (!Array.isArray(value))
        return null;
    const links = [];
    const rejected = [];
    for (const entry of value) {
        const loc = normalizeNodeModulesLink(entry);
        if (loc === null)
            rejected.push(entry);
        else if (!links.includes(loc))
            links.push(loc);
    }
    return { links, rejected };
}
const SISTER_REPO_NAME_RE = /^[A-Za-z0-9_.-]+$/;
function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}
// Absolute in POSIX, Windows (rooted or UNC) or drive form, or "~"-relative.
function isRejectedSisterPath(p) {
    return (path.posix.isAbsolute(p) ||
        path.win32.isAbsolute(p) ||
        /^[A-Za-z]:/.test(p) ||
        p.startsWith("~"));
}
function normalizeSisterRepo(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
        return null;
    const { name, path: repoPath, owns, backlog, contracts } = entry;
    if (typeof name !== "string" || !SISTER_REPO_NAME_RE.test(name) || name === "." || name === "..") {
        return null;
    }
    if (!isNonEmptyString(repoPath) || isRejectedSisterPath(repoPath))
        return null;
    if (!isNonEmptyString(owns))
        return null;
    const repo = { name, path: repoPath, owns };
    if (isNonEmptyString(backlog))
        repo.backlog = backlog;
    if (Array.isArray(contracts)) {
        const kept = contracts.filter(isNonEmptyString);
        if (kept.length > 0)
            repo.contracts = kept;
    }
    return repo;
}
/**
 * The one validation definition for the `sisterRepos` key (E292 D1).
 * Returns the valid entries in list order (an entry whose name was already
 * kept is dropped), or null when `value` is not an array or holds no valid
 * entry. Invalid entries are dropped silently. Never throws.
 */
export function parseSisterRepos(value) {
    if (!Array.isArray(value))
        return null;
    const repos = [];
    for (const entry of value) {
        const repo = normalizeSisterRepo(entry);
        if (repo !== null && !repos.some((r) => r.name === repo.name))
            repos.push(repo);
    }
    return repos.length > 0 ? repos : null;
}
// Methodology-agnostic defaults. Common task-list filenames in workspace root
// or under .current/. No project-management-tool-specific paths.
const DEFAULT_TASK_PATHS = [
    ".current/tasks.md",
    "tasks.md",
    "TODO.md",
];
// Generic markdown-checkbox regex: group 1 checkmark (" " or "x"), group 2
// task id (the token after the checkbox), group 3 description. Matches
// `- [ ] T01 build login flow` and `- [x] PROJ-42 fix race`.
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
            // Anything but `true` leaves only the threshold tier armed.
            manifest: tier.manifest === true,
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
    // Additive-optional field (no schema_version bump — same precedent as
    // host/driftBaselineIds). Surfaced only for an array value; invalid
    // entries are dropped here, never an error (E291).
    const nodeModulesLinks = parseNodeModulesLinks(migration.payload.nodeModulesLinks);
    if (nodeModulesLinks !== null) {
        result.nodeModulesLinks = nodeModulesLinks.links;
    }
    // Additive-optional field (no schema_version bump — same precedent as
    // staleDispatchNotifyFile). Non-fatal filter: only a non-empty string is
    // surfaced, byte-verbatim; anything else is treated as absent (render keeps
    // its single generic pointer), never an error.
    const laneProtocolAddendum = migration.payload.laneProtocolAddendum;
    if (typeof laneProtocolAddendum === "string" && laneProtocolAddendum.length > 0) {
        result.laneProtocolAddendum = laneProtocolAddendum;
    }
    // Additive-optional field (no schema_version bump — same precedent as
    // laneProtocolAddendum/nodeModulesLinks). Non-fatal filter: invalid
    // entries are dropped, never an error (E292).
    const sisterRepos = parseSisterRepos(migration.payload.sisterRepos);
    if (sisterRepos !== null) {
        result.sisterRepos = sisterRepos;
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
 * silent. Same mtime-cached core as loadConfig — no extra I/O on the happy path.
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
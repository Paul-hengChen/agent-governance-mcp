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
//     "staleDispatchNotifyFile": ".current/stale-dispatch.notify"  // opt-in E22 stale-dispatch watch-file emit; absent = disarmed
//   }
//
// tokenBudgetPerFeature accounting (d2-server-brake-accounting): the ceiling
// is now backed by the durable .current/usage.jsonl sidecar — appended per
// dispatch by the opt-in PostToolUse hook (bin/agent-governance-usage-hook.mjs)
// and summed feature-scoped via tools/usage-accounting.ts — rather than the
// coordinator's in-memory model arithmetic. The coordinator falls back to the
// B9 agent-*.jsonl hand-sum only when the sidecar is absent (hook not wired).

import * as fs from "fs";
import * as path from "path";
import { CURRENT_VERSIONS, runMigrations, type MigrationResult } from "../schema/versions.js";
// Side-effect import: registers the config v0→v1 migration on module load.
import "../schema/migrations-config.js";

// Threshold shape for the Constitution §3.1 Cut-Approval Auto-Tier
// (e5-intake-tiering). Advisory surface only: the server parses and exposes
// it, but never enforces the tier — the coordinator/PM reads the config and
// applies it (the same attestation trust model as cut_approved itself).
export interface CutApprovalAutoTier {
  // Cut may touch at most this many files.
  maxFiles: number;
  // Least-urgent bound on ticket priority ("P<n>"): a ticket qualifies only
  // if its priority is this or lower-urgency (numerically >=). Default "P3"
  // means P2/P1/P0 tickets never auto-approve.
  maxPriority: string;
  // Whether a cut containing a schema change may auto-approve.
  allowSchemaChange: boolean;
  // Whether a design-armed cut (design source detected) may auto-approve.
  allowDesignArmed: boolean;
}

// Conservative defaults per the E5 backlog risk note ("start conservative").
// Applied per-field when the arming key is present but a field is omitted
// or invalid. The tier itself is opt-in: these defaults never arm it.
export const CUT_APPROVAL_AUTO_TIER_DEFAULTS: Readonly<CutApprovalAutoTier> = {
  maxFiles: 2,
  maxPriority: "P3",
  allowSchemaChange: false,
  allowDesignArmed: false,
};

export interface WorkspaceConfig {
  taskPattern?: string;
  taskPaths?: string[];
  driftBaselineIds?: string[];
  tokenBudgetPerFeature?: number;
  // Workspace host declaration (d6 host-capability compose axis), e.g.
  // "claude-code". Drives prompts/skill-manifest.ts hostCapabilitiesFor():
  // absent/empty/unrecognized ⇒ the lean no-capability profile
  // ({ taskTool: false }) — host-tagged skill fragments are excluded.
  host?: string;
  // §3.1 Cut-Approval Auto-Tier arming key (e5-intake-tiering). PRESENCE of
  // the key in .config.json (any JSON object, even {}) arms the tier;
  // absence = disabled — every cut halts for human approval. When surfaced
  // here it is fully normalized: omitted/invalid fields are already filled
  // with CUT_APPROVAL_AUTO_TIER_DEFAULTS.
  cutApprovalAutoTier?: CutApprovalAutoTier;
  // E22 stale-dispatch notify watch-file (opt-in). Workspace-relative (or
  // absolute) path the server writes the stale_dispatch advisory payload to
  // when the tw_get_state read-time threshold check fires — an external
  // watcher turns the mtime bump into a desktop notification / webhook.
  // Absent = fully disarmed (the pre-E22 pull-only behavior). Consumed by
  // tools/stale-notify.ts; file-mode read path only.
  staleDispatchNotifyFile?: string;
}

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

// Cache entry records the config file's mtime at cache time (null = file did
// not exist) so loadConfig can invalidate on any on-disk change within the
// same long-lived server process (v3.58.0, C18). Without this, post-release
// driftBaselineIds appends were invisible to tw_detect_drift until restart.
//
// E31 (e31-config-nonfatal): the entry also records the load error (null =
// loaded clean or file absent). A corrupt/unparseable/unreadable/future-schema
// config used to throw out of loadConfig, which sat on the mandatory
// tw_get_state pre-flight path (guards/session.ts markStateRead →
// findTasksFile → resolveTaskPaths → loadConfig) and blocked the one call
// everything else depends on. Config-file fatality now degrades
// loudly-but-readable (the tools/exemptions.ts posture): defaults in effect,
// the error cached here and surfaced via getConfigError() on every
// tw_get_state envelope (`config_error`) — never silently swallowed, never a
// pre-flight throw.
interface ConfigCacheEntry {
  config: WorkspaceConfig;
  mtimeMs: number | null;
  error: string | null;
}

const configCache = new Map<string, ConfigCacheEntry>();

// Shared non-fatal load core (E31). Returns the typed config view plus the
// loud load error, serving/refreshing the mtime cache. NEVER throws on
// config-file fatality — every failure mode collapses to
// { config: {}, error: <message naming the path + problem> }.
function loadConfigEntry(workspacePath: string): ConfigCacheEntry {
  const configPath = path.join(workspacePath, ".current", ".config.json");

  // Re-stat on every call (C18): a cache hit is only served when the on-disk
  // state (existence + mtimeMs) still matches what was recorded at cache
  // time. Existence flips and mtime bumps both fall through to a re-read.
  // Non-ENOENT stat errors (permission flap on .current/) are non-fatal but
  // deliberately UNCACHED — mtime cannot witness a chmod, so re-stat every
  // call until the flap clears.
  let currentMtime: number | null;
  try {
    currentMtime = fs.statSync(configPath).mtimeMs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      return {
        config: {},
        mtimeMs: null,
        error: `Failed to stat ${configPath}: ${(err as Error).message} — config IGNORED, defaults in effect.`,
      };
    }
    currentMtime = null;
  }
  const cached = configCache.get(workspacePath);
  if (cached !== undefined && cached.mtimeMs === currentMtime) {
    return cached;
  }

  if (currentMtime === null) {
    const entry: ConfigCacheEntry = { config: {}, mtimeMs: null, error: null };
    configCache.set(workspacePath, entry);
    return entry;
  }
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf-8");
  } catch (err) {
    // Exists but unreadable: loud, defaults in effect. UNCACHED for the same
    // chmod-invisible-to-mtime reason as the stat branch above.
    return {
      config: {},
      mtimeMs: null,
      error: `Failed to read ${configPath}: ${(err as Error).message} — config IGNORED, defaults in effect.`,
    };
  }
  let parsed: Record<string, unknown>;
  try {
    const decoded = JSON.parse(raw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("config must be a JSON object");
    }
    parsed = decoded as Record<string, unknown>;
  } catch (err) {
    // Content-derived failure: cache under the corrupt file's mtime (a fix
    // necessarily bumps it, invalidating the cached error).
    const entry: ConfigCacheEntry = {
      config: {},
      mtimeMs: currentMtime,
      error: `Failed to parse ${configPath}: ${(err as Error).message} — config IGNORED, defaults in effect.`,
    };
    configCache.set(workspacePath, entry);
    return entry;
  }

  // Schema-versioning lazy migrate-on-read (Phase 4). Bumps an absent or
  // older schema_version up to CURRENT_VERSIONS.config. A FUTURE on-disk
  // version throws inside runMigrations (refuse-loud, AC-4) — since E31 that
  // refusal is captured as a loud config_error instead of propagating into
  // the pre-flight read: guessing at a shape this server does not understand
  // is still refused, but the refusal no longer blocks tw_get_state.
  let migration: MigrationResult<Record<string, unknown>>;
  try {
    migration = runMigrations<Record<string, unknown>>("config", parsed);
  } catch (err) {
    const entry: ConfigCacheEntry = {
      config: {},
      mtimeMs: currentMtime,
      error: `Failed to load ${configPath}: ${(err as Error).message} — config IGNORED, defaults in effect.`,
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
    } catch {
      /* swallowed — caller still receives migrated shape */
    }
  }

  // Strip schema_version from the typed view so downstream callers stay on
  // the existing WorkspaceConfig shape. Only known fields are surfaced;
  // unknown keys are dropped from the typed result but preserved on disk.
  const result: WorkspaceConfig = {};
  const taskPattern = migration.payload.taskPattern;
  if (typeof taskPattern === "string") result.taskPattern = taskPattern;
  const taskPaths = migration.payload.taskPaths;
  if (Array.isArray(taskPaths)) {
    const filtered = taskPaths.filter((p): p is string => typeof p === "string");
    if (filtered.length > 0) result.taskPaths = filtered;
  }
  // Additive-optional field (no schema_version bump — same precedent as
  // taskPattern/taskPaths: absence == empty, no transform required).
  const driftBaselineIds = migration.payload.driftBaselineIds;
  if (Array.isArray(driftBaselineIds)) {
    const filtered = driftBaselineIds.filter((p): p is string => typeof p === "string");
    if (filtered.length > 0) result.driftBaselineIds = filtered;
  }
  // Additive-optional field (no schema_version bump — same precedent as
  // driftBaselineIds). Non-fatal filter: only a positive finite number is
  // surfaced; strings, negatives, zero, NaN, Infinity are treated as absent
  // (brake disabled) rather than throwing.
  const tokenBudgetPerFeature = migration.payload.tokenBudgetPerFeature;
  if (
    typeof tokenBudgetPerFeature === "number" &&
    Number.isFinite(tokenBudgetPerFeature) &&
    tokenBudgetPerFeature > 0
  ) {
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
    const tier = autoTier as Record<string, unknown>;
    result.cutApprovalAutoTier = {
      maxFiles:
        typeof tier.maxFiles === "number" &&
        Number.isFinite(tier.maxFiles) &&
        tier.maxFiles > 0
          ? Math.floor(tier.maxFiles)
          : CUT_APPROVAL_AUTO_TIER_DEFAULTS.maxFiles,
      maxPriority:
        typeof tier.maxPriority === "string" && /^P\d+$/.test(tier.maxPriority)
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
  // Cache under the pre-read mtime. If the migration heal-on-read above
  // rewrote the file, the recorded mtime is already stale — the NEXT call's
  // stat will mismatch and trigger one redundant (but correct) re-read,
  // which is preferable to racing a post-write re-stat against concurrent
  // writers/deleters.
  const entry: ConfigCacheEntry = { config: result, mtimeMs: currentMtime, error: null };
  configCache.set(workspacePath, entry);
  return entry;
}

/**
 * Typed workspace config view. Absent file OR any config-file fatality
 * (unreadable, unparseable, non-object root, future schema_version) returns
 * the empty config — defaults in effect. NEVER throws (E31): the failure is
 * surfaced via getConfigError(), not a pre-flight-blocking exception.
 */
export function loadConfig(workspacePath: string): WorkspaceConfig {
  return loadConfigEntry(workspacePath).config;
}

/**
 * Loud config-load error for the workspace, or null when the config loaded
 * clean or is simply absent (E31). Non-null means loadConfig() is currently
 * serving defaults IN PLACE OF a config file that exists but cannot be used —
 * the message names the config path and the parse/read problem. Surfaced as
 * `config_error` on every tw_get_state envelope so the degradation is never
 * silent. Same mtime-cached core as loadConfig — no extra I/O on the happy
 * path.
 */
export function getConfigError(workspacePath: string): string | null {
  return loadConfigEntry(workspacePath).error;
}

function atomicWriteConfig(configPath: string, payload: Record<string, unknown>): void {
  // Re-stamp at CURRENT regardless of what the input carried, so the file
  // converges even if an upstream migration forgot to set the field.
  const stamped = { ...payload, schema_version: CURRENT_VERSIONS.config };
  const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(stamped, null, 2)}\n`, "utf-8");
  fs.renameSync(tmpPath, configPath);
}

export function resolveTaskPaths(workspacePath: string): string[] {
  const config = loadConfig(workspacePath);
  const rels = config.taskPaths?.length ? config.taskPaths : DEFAULT_TASK_PATHS;
  return rels.map((p) => path.join(workspacePath, p));
}

export function findTasksFile(workspacePath: string): string | null {
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
export function resolveTaskRegex(workspacePath: string): RegExp {
  const config = loadConfig(workspacePath);
  if (config.taskPattern) {
    try {
      return new RegExp(config.taskPattern);
    } catch (err) {
      throw new Error(
        `Invalid taskPattern in .current/.config.json: ${(err as Error).message}`
      );
    }
  }
  return DEFAULT_TASK_REGEX;
}

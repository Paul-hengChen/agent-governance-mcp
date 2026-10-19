import "../schema/migrations-config.js";
export interface CutApprovalAutoTier {
    maxFiles: number;
    maxPriority: string;
    allowSchemaChange: boolean;
    allowDesignArmed: boolean;
    manifest: boolean;
}
export declare const CUT_APPROVAL_AUTO_TIER_DEFAULTS: Readonly<CutApprovalAutoTier>;
export interface WorkspaceConfig {
    taskPattern?: string;
    taskPaths?: string[];
    driftBaselineIds?: string[];
    tokenBudgetPerFeature?: number;
    host?: string;
    cutApprovalAutoTier?: CutApprovalAutoTier;
    staleDispatchNotifyFile?: string;
    artifacts?: WorkspaceArtifactsMode;
    nodeModulesLinks?: string[];
    laneProtocolAddendum?: string;
    sisterRepos?: SisterRepo[];
}
export interface SisterRepo {
    name: string;
    path: string;
    owns: string;
    backlog?: string;
    contracts?: string[];
}
export type WorkspaceArtifactsMode = "local" | "repo";
export interface NodeModulesLinksParse {
    links: string[];
    rejected: unknown[];
}
/**
 * The one validation definition for the `nodeModulesLinks` key (E291 D2).
 * Returns null when `value` is not an array (null included). Otherwise
 * every entry is either kept (one trailing "/" stripped; first occurrence
 * wins on duplicates) or listed in `rejected`, both in list order. Never throws.
 */
export declare function parseNodeModulesLinks(value: unknown): NodeModulesLinksParse | null;
/**
 * The one validation definition for the `sisterRepos` key (E292 D1).
 * Returns the valid entries in list order (an entry whose name was already
 * kept is dropped), or null when `value` is not an array or holds no valid
 * entry. Invalid entries are dropped silently. Never throws.
 */
export declare function parseSisterRepos(value: unknown): SisterRepo[] | null;
export declare const DEFAULT_TASK_REGEX: RegExp;
/**
 * Typed workspace config view. Absent file OR any unusable config file
 * (unreadable, unparseable, non-object root, future schema_version) returns
 * the empty config — defaults in effect. NEVER throws: the failure is
 * reported via getConfigError(), not a pre-flight-blocking exception. (E31)
 */
export declare function loadConfig(workspacePath: string): WorkspaceConfig;
/**
 * Loud config-load error for the workspace, or null when the config loaded
 * clean or is simply absent. Non-null means loadConfig() is currently
 * serving defaults IN PLACE OF a config file that exists but cannot be used —
 * the message names the config path and the parse/read problem. Returned as
 * `config_error` on every tw_get_state envelope so the fallback is never
 * silent. Same mtime-cached core as loadConfig — no extra I/O on the happy path.
 */
export declare function getConfigError(workspacePath: string): string | null;
export declare function resolveTaskPaths(workspacePath: string): string[];
/**
 * The current lane's ledger `.current/<lane>/tasks.md` when it exists, else
 * the legacy file (findLegacyTasksFile). Side-effect-free — no write, no
 * migration, ever: guards/session.ts's markStateRead snapshots this path at
 * tw_get_state time. It is NOT the ledger reader: tools/tasks-file.ts reads
 * only the lane path; this fallback serves the freshness snapshot and
 * index-only readers (tools/drift.ts's schema-skew check). (E125a)
 */
export declare function findTasksFile(workspacePath: string): string | null;
/**
 * The legacy task file: the first resolveTaskPaths() candidate that exists
 * AND is not nested inside a `.current/<dir>/` (a lane-local ledger never
 * counts as legacy; flat `.current/tasks.md` does). Pure, read-only. Used by
 * tools/tasks-lane-migrate.ts (the forward/reverse migration) and, via
 * findTasksFile's fallback, by index-only readers. (E125a)
 */
export declare function findLegacyTasksFile(workspacePath: string): string | null;
/**
 * Returns the active task-line regex. Either:
 *   - config.taskPattern (caller-supplied), or
 *   - the generic markdown-checkbox default.
 *
 * Contract for any pattern (custom or default): group 1 is the checkmark,
 * group 2 is the task ID, group 3+ are joined as the description.
 */
export declare function resolveTaskRegex(workspacePath: string): RegExp;
//# sourceMappingURL=config.d.ts.map
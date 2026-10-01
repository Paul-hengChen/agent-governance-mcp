export declare const SECTION_HEADING_RE: RegExp;
/**
 * The lane ledger is absent but the legacy file proves one must exist — a
 * `_primary` v2+ index, `tasks_moved` markers for this feat lane, or a
 * newer-server schema. Thrown instead of reporting an empty task list. `.code` stays outside the error-code-contract harvest.
 */
export declare class TasksLedgerAbsentError extends Error {
    readonly code = "TASKS_LEDGER_ABSENT";
    constructor(lane: string, lanePath: string, legacyPath: string, reason: string);
}
export declare class TasksMigrationBusyError extends Error {
    readonly code = "TASKS_MIGRATION_BUSY";
    constructor(lockPath: string);
}
/**
 * The `_primary` reverse-run receipt sha: sha256(normalizeIndexBody(body)).
 * Shared by the forward stamp, the reverse check and the one-off index
 * compaction, so the allowed root edits after a forward run (`agc feature
 * finish --shipped` removing a lane's markers and appending a Closed Lanes
 * pointer) never break the reverse. Pure. (E125c, E195)
 */
export declare function primaryIndexReceiptSha(body: string): string;
/**
 * true iff `git check-ignore -q <lanePath>` exits 0 in `workspacePath`
 * (read-only; stderr suppressed, the tools/feature-rollup.ts precedent).
 * Exit 1, no `.git`, no git binary, exit 128 or any error: NOT ignored.
 */
export declare function isLanePathIgnored(workspacePath: string, lanePath: string): boolean;
/**
 * The file tw_* reads and writes as the task ledger: the lane ledger, except
 * in a workspace whose absent lane path is git-ignored — there the legacy
 * file stays the ledger (or, with none yet, the first taskPaths candidate).
 * (E125a)
 */
export declare function resolveTasksLedgerPath(workspacePath: string, laneTasksPath: string): string;
/** The one-line option-A advisory (Copy `tasks.ignored-lane-advisory`), or null. */
export declare function tasksLaneAdvisory(workspacePath: string): string | null;
/**
 * CORE: the caller MUST hold `${laneTasksPath}.lock`, where `laneTasksPath` is
 * `resolveCurrentLanePaths(ws).tasksPath` resolved ONCE by the caller, so the
 * lock held and the ledger written never diverge (spec AC1 routes every caller
 * through resolveCurrentLanePaths). Takes only the inner legacy-file lock.
 * True iff THIS call migrated; false on an existing ledger, no legacy file, a
 * git-ignored lane path or nothing to move. Throws TasksLedgerAbsentError and
 * TasksMigrationBusyError.
 */
export declare function ensureTasksMigratedLocked(workspacePath: string, laneTasksPath: string): boolean;
/**
 * Self-acquiring wrapper for callers holding NO lock (parseTasksFromFile,
 * getNextTaskFromFile). Steady state (lane ledger present, nothing to
 * migrate, or an ignored lane path) touches no lock. Otherwise takes the
 * lane's tasks lock, then delegates to ensureTasksMigratedLocked. Returns
 * true iff this call migrated. Throws TasksLedgerAbsentError (AC6b) and
 * TasksMigrationBusyError (D14) — callers let both propagate.
 */
export declare function ensureTasksMigrated(workspacePath: string): boolean;
/**
 * `_primary` reverse. Refuses, touching nothing, unless the legacy file is a
 * v2+ index with TASKS_INDEX_NOTICE whose body matches the receipt's
 * bodySha256 (normalized by primaryIndexReceiptSha, or raw for an older
 * receipt). Then legacy := v1 sentinel + the ledger's CURRENT body (see
 * restoredPrimaryBody), and the ledger and receipt are deleted. A v0 original
 * round-trips under a v1 sentinel, not byte-identically. (E125c, E195)
 */
export declare function migratePrimaryReverse(workspacePath: string): void;
/**
 * Feat reverse for `lane`. The lane's legacy-file markers must be runs 1..N
 * in document order, all with the same `of=<N>` and exactly N of them
 * (missing, duplicated, out-of-order or malformed refuses). Each marker takes
 * back the ledger's next `sections=<n>` `## ` blocks; leftover lane-local
 * sections go after the last run (or at EOF when N = 0). The legacy sentinel
 * line is kept verbatim; the ledger is deleted.
 */
export declare function migrateFeatReverse(workspacePath: string, lane: string): void;
//# sourceMappingURL=tasks-lane-migrate.d.ts.map
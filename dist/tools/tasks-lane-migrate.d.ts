export declare const SECTION_HEADING_RE: RegExp;
/**
 * AC6b (review round 1, C1): the lane ledger is absent but the legacy file
 * proves one must exist — a `_primary` v2+ index, `tasks_moved` markers for
 * this feat lane, or a newer-server schema. Thrown instead of reporting an
 * empty task list. `.code` stays outside the error-code-contract harvest.
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
 * CORE (architecture Interface Contracts): the caller MUST already hold
 * `${laneTasksPath}.lock`, where `laneTasksPath` is
 * `resolveCurrentLanePaths(ws).tasksPath` resolved ONCE by the caller (the
 * four tools/tasks-file.ts mutators, via withFileLock) — so the lock held
 * and the ledger written can never diverge. The lane is that path's parent
 * directory name. (Deviation from the blueprint's `(ws, lane)` signature:
 * spec AC1 routes every tools/ caller through resolveCurrentLanePaths.)
 * Takes only the inner legacy-file lock. Returns true iff THIS call wrote a
 * migration (R-1). No-op (false) when the lane ledger exists, no legacy file
 * exists, the lane path is git-ignored (AC4b), or there is nothing to move
 * (D13). Throws TasksLedgerAbsentError (AC6b) and TasksMigrationBusyError.
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
 * v2+ index carrying TASKS_INDEX_NOTICE AND the receipt's bodySha256 equals
 * primaryIndexReceiptSha(its trailing body) — or, for a receipt stamped
 * before index normalization existed, sha256 of that raw body. A missing or
 * unreadable receipt refuses too. Normalization allows exactly two root
 * edits after the forward run: removed `tasks_moved` markers and a `##
 * Closed Lanes` section; any other change refuses. (E125c, E195)
 * Then: legacy := v1 sentinel + the lane ledger's CURRENT body, minus the
 * ledger marker lines no longer in the root, with the root's Closed Lanes
 * section(s) carried to the end in place of the ledger's own, and
 * `.current/_primary/tasks.md` + the receipt are deleted. With no Closed
 * Lanes section on either side the ledger body is kept verbatim.
 * The restored root always carries a v1 sentinel, so a v0 (sentinel-less)
 * original, e.g. the `agc init` scaffold, round-trips to its body under a
 * v1 sentinel, not byte-identically.
 */
export declare function migratePrimaryReverse(workspacePath: string): void;
/**
 * D-E feat reverse for `lane`. The lane's markers in the legacy file must be
 * runs 1..N in document order, every one carrying the same `of=<N>`, with
 * exactly N markers (C2: a missing LAST marker refuses too; missing /
 * duplicated / out-of-order / malformed refuses). The ledger's `## ` blocks are handed back in order:
 * each marker takes the next `sections=<n>` blocks; any leftover content
 * (sections added lane-locally) goes right after the last marker's run, or
 * at the end of the file when N = 0. The legacy sentinel line is kept
 * verbatim; the ledger is deleted.
 */
export declare function migrateFeatReverse(workspacePath: string, lane: string): void;
//# sourceMappingURL=tasks-lane-migrate.d.ts.map
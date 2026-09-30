import "../schema/migrations-tasks.js";
export interface TaskRecord {
    id: string;
    description: string;
    section: string;
    completed: boolean;
}
export declare function parseTasksFromFile(workspacePath: string): TaskRecord[] | null;
export declare function getNextTaskFromFile(workspacePath: string): string;
export declare function completeTaskInFile(workspacePath: string, taskId: string, note?: string): Promise<string>;
export declare function rollbackTaskInFile(workspacePath: string, taskId: string, reason: string): Promise<string>;
/**
 * Void a task: mark it as never-should-have-existed rather than "done, then
 * reverted". Reuses the checkbox-line format with a marker char, `-`, that
 * DEFAULT_TASK_REGEX's `[ x]` character class (and any custom taskPattern
 * following the same "space or x" convention) cannot match — so a voided
 * line is invisible to parseTaskLine and therefore to every consumer of
 * parseTasksFromFile: getNextTaskFromFile (a voided row is never offered
 * again), tw_detect_drift (never counted as completed or incomplete, never
 * flagged as drift), and tw_sync (never a reconcile or refused-drift
 * candidate). (E117)
 *
 * A voided id can NOT be reused by a re-cut. review_reports/review_<id>.md
 * and qa_reports/review_<id>.md are existence-based and keyed only by id, so
 * a re-cut of a voided id would silently inherit the voided task's
 * review/QA evidence and pass both gates for work nobody reviewed.
 * addTaskInFile therefore scans for the fixed `- [-] <id>` void-marker
 * format directly (see the voidedPattern check there) and refuses the
 * re-cut outright: a re-cut is different work, and refusing removes the
 * state in which the problem can occur instead of adding a version field
 * every future evidence reader would have to honour. The voided marker line
 * itself stays on disk, still invisible to parseTaskLine. (E120)
 *
 * Only a currently-incomplete (`[ ]`) row may be voided; an already-completed
 * (`[x]`) row is refused. Completion is checked against BOTH the tasks.md
 * mirror and the authoritative `handoff.completed_tasks` ledger — tasks.md
 * can lag the ledger (the exact state tw_sync exists to repair), and voiding
 * in that window would delete the row a completion check depends on, making
 * the drift permanently unreachable (tools/drift.ts builds its id
 * vocabulary from tasks.md alone). A task id that is already voided is
 * reported differently from one that never existed — the voided line,
 * marker included, is still on disk and nothing is gained by hiding it.
 *
 * Before committing the write, the POST-WRITE invariant — "after this
 * write, taskId must not parse as a task" — is asserted against the REAL
 * content about to be written (not a hand-rebuilt replacement line, which
 * can miss both a newline and a `$`-expansion escape). The candidate content
 * is produced by the exact same String.replace call used for the actual
 * write, then re-parsed line by line — as parseTasks() itself parses the
 * file — against the WORKSPACE'S CONFIGURED taskPattern, not just the
 * default regex the paragraph above assumes. The void is refused if taskId
 * still comes back as a task anywhere in the resulting file (live or
 * "completed", on the voided line or on a line planted elsewhere by the
 * reason text). A custom taskPattern using a different completion
 * convention than the default's `[ x]` class could otherwise accept the
 * write and report success while the row keeps being offered — a silent
 * no-op is worse than a loud refusal here.
 */
export declare function voidTaskInFile(workspacePath: string, taskId: string, reason: string): Promise<string>;
/**
 * Append a new task to the current lane's ledger `.current/<lane>/tasks.md`,
 * creating it with a minimal scaffold if absent. Never writes a legacy task
 * file. (E125a)
 */
export declare function addTaskInFile(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
//# sourceMappingURL=tasks-file.d.ts.map
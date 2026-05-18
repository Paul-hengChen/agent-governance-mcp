// Coded by @sr-engineer
// SQLite-backed storage for handoff state + task list. Used in HTTP/remote mode
// where a process-shared DB beats per-workspace markdown files. Freshness for
// handoff is enforced via the row's `last_updated` column rather than file mtime;
// task operations rely on per-row CHECK semantics inside transactions.
import Database from "better-sqlite3";
import { markStateRead, snapshotExtra, verifyExtra, } from "../guards/session.js";
const SCHEMA = `
CREATE TABLE IF NOT EXISTS handoff_state (
  workspace_path  TEXT PRIMARY KEY,
  active_feature  TEXT NOT NULL,
  status          TEXT NOT NULL,
  last_updated    TEXT NOT NULL,
  blocking_reason TEXT,
  last_agent      TEXT,
  completed       TEXT NOT NULL DEFAULT '[]',
  pending         TEXT NOT NULL DEFAULT '[]',
  qa_round        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  workspace_path  TEXT NOT NULL,
  task_id         TEXT NOT NULL,
  section         TEXT NOT NULL DEFAULT 'Active',
  description     TEXT NOT NULL,
  completed       INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  reverted_reason TEXT,
  sort_order      INTEGER NOT NULL,
  PRIMARY KEY (workspace_path, task_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_order
  ON tasks (workspace_path, sort_order);

CREATE TABLE IF NOT EXISTS reports (
  workspace_path TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  reviewer       TEXT NOT NULL,
  notes          TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (workspace_path, task_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_reports_ws_task
  ON reports (workspace_path, task_id, status);
`;
const SNAPSHOT_KEY = "sqlite:handoff.last_updated";
export class SqliteHandoffStorage {
    db;
    selectStmt;
    selectLastUpdatedStmt;
    upsertStmt;
    txUpsert;
    listTasksStmt;
    maxSortStmt;
    insertTaskStmt;
    selectTaskStmt;
    completeTaskStmt;
    rollbackTaskStmt;
    insertReportStmt;
    selectReportsByTaskStmt;
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.db.pragma("foreign_keys = ON");
        this.db.exec(SCHEMA);
        // Idempotent additive migration: pre-v3.2.0 DBs lack qa_round column. The
        // ALTER throws if the column already exists; swallow that one error only.
        try {
            this.db.exec("ALTER TABLE handoff_state ADD COLUMN qa_round INTEGER NOT NULL DEFAULT 0");
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/duplicate column name/i.test(msg))
                throw err;
        }
        this.selectStmt = this.db.prepare("SELECT * FROM handoff_state WHERE workspace_path = ?");
        this.selectLastUpdatedStmt = this.db.prepare("SELECT last_updated FROM handoff_state WHERE workspace_path = ?");
        this.upsertStmt = this.db.prepare(`INSERT OR REPLACE INTO handoff_state
        (workspace_path, active_feature, status, last_updated, blocking_reason, last_agent, completed, pending, qa_round)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        this.txUpsert = this.db.transaction((workspacePath, activeFeature, status, now, blockingReason, lastAgent, completed, pending, qaRound, expectedLastUpdated) => {
            const row = this.selectLastUpdatedStmt.get(workspacePath);
            const actual = row?.last_updated ?? null;
            if (actual !== expectedLastUpdated) {
                throw new Error(`⛔ STATE DRIFT: handoff row changed between freshness check and write ` +
                    `(expected last_updated=${expectedLastUpdated}, actual=${actual}). Retry after tw_get_state.`);
            }
            this.upsertStmt.run(workspacePath, activeFeature, status, now, blockingReason, lastAgent, completed, pending, qaRound);
        });
        this.listTasksStmt = this.db.prepare(`SELECT task_id, description, section, completed, note, reverted_reason, sort_order
       FROM tasks WHERE workspace_path = ? ORDER BY sort_order ASC`);
        this.maxSortStmt = this.db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM tasks WHERE workspace_path = ?");
        this.insertTaskStmt = this.db.prepare(`INSERT INTO tasks (workspace_path, task_id, section, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`);
        this.selectTaskStmt = this.db.prepare("SELECT * FROM tasks WHERE workspace_path = ? AND task_id = ?");
        // Reverted suffix preserved on description so completion history mirrors the
        // file-mode "(reverted: ...)" trail and survives subsequent list reads.
        this.completeTaskStmt = this.db.prepare(`UPDATE tasks SET completed = 1, note = ?, reverted_reason = NULL
       WHERE workspace_path = ? AND task_id = ? AND completed = 0`);
        this.rollbackTaskStmt = this.db.prepare(`UPDATE tasks SET completed = 0, reverted_reason = ?, note = NULL
       WHERE workspace_path = ? AND task_id = ? AND completed = 1`);
        this.insertReportStmt = this.db.prepare(`INSERT INTO reports (workspace_path, task_id, status, reviewer, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`);
        // PASS-status reports satisfy hasEvidence() in SQLite mode. File mode is
        // laxer (any file is enough) because pass/fail isn't decodable from disk.
        this.selectReportsByTaskStmt = this.db.prepare(`SELECT DISTINCT task_id FROM reports
       WHERE workspace_path = ? AND status = 'PASS' AND task_id IN (SELECT value FROM json_each(?))`);
    }
    // ---------- handoff state ----------
    fetchRow(workspacePath) {
        return this.selectStmt.get(workspacePath);
    }
    fetchLastUpdated(workspacePath) {
        const row = this.selectLastUpdatedStmt.get(workspacePath);
        return row?.last_updated ?? null;
    }
    parse(workspacePath) {
        const row = this.fetchRow(workspacePath);
        if (!row)
            return null;
        const qaRoundRaw = row.qa_round;
        const qa_round = typeof qaRoundRaw === "number" && Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0
            ? Math.floor(qaRoundRaw)
            : 0;
        return {
            active_feature: row.active_feature,
            status: row.status,
            last_updated: row.last_updated,
            ...(row.blocking_reason ? { blocking_reason: row.blocking_reason } : {}),
            ...(row.last_agent ? { last_agent: row.last_agent } : {}),
            completed_tasks: JSON.parse(row.completed),
            pending_notes: JSON.parse(row.pending),
            qa_round,
        };
    }
    readState(workspacePath) {
        markStateRead(workspacePath);
        const state = this.parse(workspacePath);
        snapshotExtra(workspacePath, SNAPSHOT_KEY, state?.last_updated ?? null);
        if (!state) {
            return JSON.stringify({
                exists: false,
                message: "No handoff state found. Initialize by calling tw_update_state.",
            });
        }
        const LIMIT = 50;
        const truncated = state.completed_tasks.length > LIMIT;
        const view = {
            ...state,
            completed_tasks: truncated ? state.completed_tasks.slice(-LIMIT) : state.completed_tasks,
            ...(truncated && {
                completed_tasks_truncated: { showing: LIMIT, total: state.completed_tasks.length },
            }),
        };
        return JSON.stringify({ exists: true, ...view });
    }
    writeState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent, qaRound) {
        const currentLastUpdated = this.fetchLastUpdated(workspacePath);
        verifyExtra(workspacePath, SNAPSHOT_KEY, currentLastUpdated);
        const normalisedRound = Number.isFinite(qaRound) && qaRound >= 0 ? Math.floor(qaRound) : 0;
        const now = new Date().toISOString();
        this.txUpsert(workspacePath, activeFeature, status, now, blockingReason ?? null, lastAgent ?? null, JSON.stringify(completedTasks), JSON.stringify(pendingNotes), normalisedRound, currentLastUpdated);
        snapshotExtra(workspacePath, SNAPSHOT_KEY, now);
        return Promise.resolve(JSON.stringify({ success: true, storage: "sqlite", updated_at: now }));
    }
    // ---------- task list ----------
    listTasks(workspacePath) {
        const rows = this.listTasksStmt.all(workspacePath);
        if (rows.length === 0)
            return null;
        return rows.map((r) => ({
            id: r.task_id,
            description: r.reverted_reason
                ? `${r.description} (reverted: ${r.reverted_reason})`
                : r.note
                    ? `${r.description} (note: ${r.note})`
                    : r.description,
            section: r.section,
            completed: r.completed === 1,
        }));
    }
    getNextTask(workspacePath) {
        const tasks = this.listTasks(workspacePath);
        if (!tasks) {
            return JSON.stringify({ error: "No task list found for workspace." });
        }
        const next = tasks.find((t) => !t.completed);
        if (!next) {
            return JSON.stringify({ allComplete: true, totalTasks: tasks.length });
        }
        const idx = tasks.indexOf(next);
        const prev = idx > 0 ? tasks[idx - 1] : null;
        const isCheckpoint = prev && prev.section !== next.section;
        return JSON.stringify({
            next,
            isCheckpoint,
            progress: {
                completed: tasks.filter((t) => t.completed).length,
                total: tasks.length,
            },
        });
    }
    completeTask(workspacePath, taskId, note) {
        const existing = this.selectTaskStmt.get(workspacePath, taskId);
        if (!existing) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} not found.` }));
        }
        if (existing.completed === 1) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} is already completed.` }));
        }
        const info = this.completeTaskStmt.run(note ?? null, workspacePath, taskId);
        if (info.changes === 0) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} could not be marked complete (race).` }));
        }
        return Promise.resolve(JSON.stringify({
            success: true,
            taskId,
            marked: "completed",
            storage: "sqlite",
            note: note ?? null,
        }));
    }
    rollbackTask(workspacePath, taskId, reason) {
        const existing = this.selectTaskStmt.get(workspacePath, taskId);
        if (!existing) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} not found.` }));
        }
        if (existing.completed === 0) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} is not completed, cannot rollback.` }));
        }
        const info = this.rollbackTaskStmt.run(reason, workspacePath, taskId);
        if (info.changes === 0) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} could not be rolled back (race).` }));
        }
        return Promise.resolve(JSON.stringify({ success: true, taskId, marked: "reverted", storage: "sqlite", reason }));
    }
    addTask(workspacePath, taskId, description, section) {
        const existing = this.selectTaskStmt.get(workspacePath, taskId);
        if (existing) {
            return Promise.resolve(JSON.stringify({ error: `Task ${taskId} already exists.` }));
        }
        const maxSortRow = this.maxSortStmt.get(workspacePath);
        const nextSort = (maxSortRow?.max_sort ?? 0) + 1;
        this.insertTaskStmt.run(workspacePath, taskId, section?.trim() || "Active", description, nextSort);
        return Promise.resolve(JSON.stringify({
            success: true,
            taskId,
            section: section?.trim() || "Active",
            storage: "sqlite",
        }));
    }
    // ---------- QA evidence ----------
    recordReview(workspacePath, taskIds, status, reviewer, notes) {
        const now = new Date().toISOString();
        // Insert per id in a single implicit transaction. Duplicate (ws, id,
        // created_at) is theoretically possible if called twice in the same ms;
        // the PRIMARY KEY constraint then throws — caller's retry path.
        const insertMany = this.db.transaction((ids) => {
            for (const id of ids) {
                this.insertReportStmt.run(workspacePath, id, status, reviewer, notes, now);
            }
        });
        insertMany(taskIds);
        return Promise.resolve();
    }
    hasEvidence(workspacePath, taskIds) {
        if (taskIds.length === 0)
            return Promise.resolve({ present: [], missing: [] });
        const rows = this.selectReportsByTaskStmt.all(workspacePath, JSON.stringify(taskIds));
        const presentSet = new Set(rows.map((r) => r.task_id));
        const present = [];
        const missing = [];
        for (const id of taskIds) {
            if (presentSet.has(id))
                present.push(id);
            else
                missing.push(id);
        }
        return Promise.resolve({ present, missing });
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=storage-sqlite.js.map
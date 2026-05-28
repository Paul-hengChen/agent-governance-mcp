// Coded by @sr-engineer
// SQLite-backed storage for handoff state + task list. Used in HTTP/remote mode
// where a process-shared DB beats per-workspace markdown files. Freshness for
// handoff is enforced via the row's `last_updated` column rather than file mtime;
// task operations rely on per-row CHECK semantics inside transactions.
import * as fs from "node:fs";
import Database from "better-sqlite3";
import { markStateRead, snapshotExtra, verifyExtra, } from "../guards/session.js";
import { cosineSim, embedText, DEFAULT_EMBEDDING_MODEL, } from "./rag.js";
import { runSqliteMigrations } from "../schema/migrations-sqlite.js";
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
  qa_round        INTEGER NOT NULL DEFAULT 0,
  prd_path        TEXT,
  review_round    INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS code_review_reports (
  workspace_path TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  verdict        TEXT NOT NULL CHECK (verdict IN ('APPROVED', 'CHANGES_REQUESTED')),
  reviewer       TEXT NOT NULL,
  notes          TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (workspace_path, task_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_code_review_reports_ws_task
  ON code_review_reports (workspace_path, task_id, verdict);

CREATE TABLE IF NOT EXISTS prd_chunks (
  workspace_path   TEXT NOT NULL,
  chunk_id         TEXT NOT NULL,
  section          TEXT NOT NULL,
  text             TEXT NOT NULL,
  embedding        TEXT NOT NULL,
  prd_path         TEXT NOT NULL,
  prd_mtime        INTEGER NOT NULL,
  chunker_version  TEXT NOT NULL,
  embedding_model  TEXT NOT NULL,
  PRIMARY KEY (workspace_path, chunk_id)
);
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
    insertCodeReviewStmt;
    selectCodeReviewByTaskStmt;
    deleteChunksStmt;
    insertChunkStmt;
    listChunksStmt;
    getChunkMetaStmt;
    listChunkWorkspacesStmt;
    // Lazy tombstone-sweep guard: runs at most once per process lifetime, on
    // the first RAG operation. Cheaper than constructor-time scan for users
    // who don't use RAG.
    _tombstoneSwept = false;
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.db.pragma("foreign_keys = ON");
        this.db.exec(SCHEMA);
        // Idempotent additive migrations: ALTER throws if the column already
        // exists; swallow that one error only.
        const addColumnIfMissing = (sql) => {
            try {
                this.db.exec(sql);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (!/duplicate column name/i.test(msg))
                    throw err;
            }
        };
        addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN qa_round INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN prd_path TEXT");
        addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN review_round INTEGER NOT NULL DEFAULT 0");
        // Schema-versioning lazy migrate (Phase 4). Creates schema_meta, stamps
        // the sqlite version row, and runs any registered v(N)→v(N+1) DDL steps
        // inside per-step transactions. Refuse-loud on a future on-disk version
        // — propagates so the caller (HTTP boot) sees the error rather than
        // operating against a half-understood DB.
        runSqliteMigrations(this.db);
        this.selectStmt = this.db.prepare("SELECT * FROM handoff_state WHERE workspace_path = ?");
        this.selectLastUpdatedStmt = this.db.prepare("SELECT last_updated FROM handoff_state WHERE workspace_path = ?");
        this.upsertStmt = this.db.prepare(`INSERT OR REPLACE INTO handoff_state
        (workspace_path, active_feature, status, last_updated, blocking_reason, last_agent, completed, pending, qa_round, prd_path, review_round)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        this.txUpsert = this.db.transaction((workspacePath, activeFeature, status, now, blockingReason, lastAgent, completed, pending, qaRound, prdPath, reviewRound, expectedLastUpdated) => {
            const row = this.selectLastUpdatedStmt.get(workspacePath);
            const actual = row?.last_updated ?? null;
            if (actual !== expectedLastUpdated) {
                throw new Error(`⛔ STATE DRIFT: handoff row changed between freshness check and write ` +
                    `(expected last_updated=${expectedLastUpdated}, actual=${actual}). Retry after tw_get_state.`);
            }
            this.upsertStmt.run(workspacePath, activeFeature, status, now, blockingReason, lastAgent, completed, pending, qaRound, prdPath, reviewRound);
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
        this.insertCodeReviewStmt = this.db.prepare(`INSERT INTO code_review_reports (workspace_path, task_id, verdict, reviewer, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`);
        // APPROVED rows satisfy hasCodeReviewEvidence() (parallel to qa PASS gating).
        this.selectCodeReviewByTaskStmt = this.db.prepare(`SELECT DISTINCT task_id FROM code_review_reports
       WHERE workspace_path = ? AND verdict = 'APPROVED' AND task_id IN (SELECT value FROM json_each(?))`);
        this.deleteChunksStmt = this.db.prepare("DELETE FROM prd_chunks WHERE workspace_path = ?");
        this.insertChunkStmt = this.db.prepare(`INSERT OR REPLACE INTO prd_chunks
         (workspace_path, chunk_id, section, text, embedding, prd_path, prd_mtime, chunker_version, embedding_model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        this.listChunksStmt = this.db.prepare("SELECT chunk_id, section, text, embedding, prd_path, prd_mtime, chunker_version, embedding_model FROM prd_chunks WHERE workspace_path = ?");
        this.getChunkMetaStmt = this.db.prepare("SELECT prd_mtime, chunker_version, embedding_model FROM prd_chunks WHERE workspace_path = ? LIMIT 1");
        this.listChunkWorkspacesStmt = this.db.prepare("SELECT DISTINCT workspace_path FROM prd_chunks");
    }
    // Run-once tombstone sweep: drop chunks whose workspace directory no longer
    // exists on disk. Lazily fired by the first RAG operation in the process.
    // Errors are swallowed because RAG is best-effort — a sweep failure must
    // never break the calling query.
    ensureTombstoneSwept() {
        if (this._tombstoneSwept)
            return;
        this._tombstoneSwept = true;
        try {
            const rows = this.listChunkWorkspacesStmt.all();
            for (const r of rows) {
                if (!fs.existsSync(r.workspace_path)) {
                    this.deleteChunksStmt.run(r.workspace_path);
                }
            }
        }
        catch {
            // best-effort: swallow
        }
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
        const reviewRoundRaw = row.review_round;
        const review_round = typeof reviewRoundRaw === "number" && Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0
            ? Math.floor(reviewRoundRaw)
            : 0;
        return {
            active_feature: row.active_feature,
            status: row.status,
            last_updated: row.last_updated,
            ...(row.blocking_reason ? { blocking_reason: row.blocking_reason } : {}),
            ...(row.last_agent ? { last_agent: row.last_agent } : {}),
            ...(row.prd_path ? { prd_path: row.prd_path } : {}),
            completed_tasks: JSON.parse(row.completed),
            pending_notes: JSON.parse(row.pending),
            qa_round,
            review_round,
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
    writeState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent, qaRound, prdPath, reviewRound) {
        const currentLastUpdated = this.fetchLastUpdated(workspacePath);
        verifyExtra(workspacePath, SNAPSHOT_KEY, currentLastUpdated);
        const normalisedRound = Number.isFinite(qaRound) && qaRound >= 0 ? Math.floor(qaRound) : 0;
        const normalisedReviewRound = Number.isFinite(reviewRound) && reviewRound >= 0
            ? Math.floor(reviewRound)
            : 0;
        // Preserve prd_path across writes that don't explicitly set it (PM sets
        // once; downstream roles call writeState without re-passing the field).
        let effectivePrdPath = prdPath ?? null;
        if (effectivePrdPath === null) {
            const existing = this.fetchRow(workspacePath);
            effectivePrdPath = existing?.prd_path ?? null;
        }
        const now = new Date().toISOString();
        this.txUpsert(workspacePath, activeFeature, status, now, blockingReason ?? null, lastAgent ?? null, JSON.stringify(completedTasks), JSON.stringify(pendingNotes), normalisedRound, effectivePrdPath, normalisedReviewRound, currentLastUpdated);
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
    recordCodeReview(workspacePath, taskIds, verdict, reviewer, notes) {
        const now = new Date().toISOString();
        const insertMany = this.db.transaction((ids) => {
            for (const id of ids) {
                this.insertCodeReviewStmt.run(workspacePath, id, verdict, reviewer, notes, now);
            }
        });
        insertMany(taskIds);
        return Promise.resolve();
    }
    hasCodeReviewEvidence(workspacePath, taskIds) {
        if (taskIds.length === 0)
            return Promise.resolve({ present: [], missing: [] });
        const rows = this.selectCodeReviewByTaskStmt.all(workspacePath, JSON.stringify(taskIds));
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
    // ---------- RAG: prd_chunks ----------
    upsertPrdChunks(workspacePath, chunks) {
        this.ensureTombstoneSwept();
        const run = this.db.transaction((rows) => {
            this.deleteChunksStmt.run(workspacePath);
            for (const c of rows) {
                this.insertChunkStmt.run(workspacePath, c.chunk_id, c.section, c.text, JSON.stringify(c.embedding), c.prd_path, c.prd_mtime, c.chunker_version, c.embedding_model);
            }
        });
        run(chunks);
    }
    // GC primitive for the PASS-cleanup hook in index.ts:tw_update_state.
    // Returns the number of rows deleted so callers can log / report.
    deletePrdChunks(workspacePath) {
        const info = this.deleteChunksStmt.run(workspacePath);
        return info.changes;
    }
    listPrdChunks(workspacePath) {
        this.ensureTombstoneSwept();
        const rows = this.listChunksStmt.all(workspacePath);
        return rows.map(r => ({
            chunk_id: r.chunk_id,
            section: r.section,
            text: r.text,
            embedding: JSON.parse(r.embedding),
            prd_path: r.prd_path,
            prd_mtime: r.prd_mtime,
            chunker_version: r.chunker_version,
            embedding_model: r.embedding_model,
        }));
    }
    getPrdIndexMeta(workspacePath) {
        this.ensureTombstoneSwept();
        const row = this.getChunkMetaStmt.get(workspacePath);
        if (!row)
            return null;
        return { prd_mtime: row.prd_mtime, chunker_version: row.chunker_version, embedding_model: row.embedding_model };
    }
    async queryPrdSpec(workspacePath, query, topK = 5) {
        this.ensureTombstoneSwept();
        const chunks = this.listPrdChunks(workspacePath);
        if (chunks.length === 0)
            return "";
        const model = chunks[0].embedding_model ?? DEFAULT_EMBEDDING_MODEL;
        const qVec = await embedText(query, model);
        if (!qVec)
            return "";
        return chunks
            .map(c => ({ c, score: cosineSim(qVec, c.embedding) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(({ c }) => `### ${c.section}\n${c.text}`)
            .join("\n\n---\n\n");
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=storage-sqlite.js.map
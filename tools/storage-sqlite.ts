// Coded by @sr-engineer
// SQLite-backed storage for handoff state + task list. Used in HTTP/remote mode
// where a process-shared DB beats per-workspace markdown files. Freshness for
// handoff is enforced via the row's `last_updated` column rather than file mtime;
// task operations rely on per-row CHECK semantics inside transactions.

import * as fs from "node:fs";
import Database from "better-sqlite3";
import {
  markStateRead,
  snapshotExtra,
  verifyExtra,
} from "../guards/session.js";
import type { HandoffStorage, HandoffState, TaskRecord, EvidenceCheck } from "./storage.js";
import type { WriteHandoffStateOptions } from "./handoff.js";
import {
  cosineSim,
  embedText,
  CHUNKER_VERSION,
  DEFAULT_EMBEDDING_MODEL,
  type PrdChunk,
  type InvalidationKey,
} from "./rag.js";
import { runSqliteMigrations } from "../schema/migrations-sqlite.js";

interface HandoffRow {
  active_feature: string;
  status: string;
  last_updated: string;
  blocking_reason: string | null;
  last_agent: string | null;
  completed: string;
  pending: string;
  qa_round: number | null;
  prd_path: string | null;
  review_round: number | null;
  visual_round: number | null;
  scope_decision: string | null;
  scope_decision_why: string | null;
}

interface TaskRow {
  task_id: string;
  description: string;
  section: string;
  completed: number;
  note: string | null;
  reverted_reason: string | null;
  sort_order: number;
}

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
  review_round    INTEGER NOT NULL DEFAULT 0,
  visual_round    INTEGER NOT NULL DEFAULT 0,
  scope_decision      TEXT,
  scope_decision_why  TEXT
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

export class SqliteHandoffStorage implements HandoffStorage {
  private db: Database.Database;
  private selectStmt: Database.Statement<[string]>;
  private selectLastUpdatedStmt: Database.Statement<[string]>;
  private upsertStmt: Database.Statement<[string, string, string, string, string | null, string | null, string, string, number, string | null, number, number, string | null, string | null]>;
  private txUpsert: (
    workspacePath: string,
    activeFeature: string,
    status: string,
    now: string,
    blockingReason: string | null,
    lastAgent: string | null,
    completed: string,
    pending: string,
    qaRound: number,
    prdPath: string | null,
    reviewRound: number,
    visualRound: number,
    scopeDecision: string | null,
    scopeDecisionWhy: string | null,
    expectedLastUpdated: string | null,
  ) => void;

  private listTasksStmt: Database.Statement<[string]>;
  private maxSortStmt: Database.Statement<[string]>;
  private insertTaskStmt: Database.Statement<[string, string, string, string, number]>;
  private selectTaskStmt: Database.Statement<[string, string]>;
  private completeTaskStmt: Database.Statement<[string | null, string, string]>;
  private rollbackTaskStmt: Database.Statement<[string, string, string]>;

  private insertReportStmt: Database.Statement<[string, string, string, string, string, string]>;
  private selectReportsByTaskStmt: Database.Statement<[string, string]>;
  private insertCodeReviewStmt: Database.Statement<[string, string, string, string, string, string]>;
  private selectCodeReviewByTaskStmt: Database.Statement<[string, string]>;

  private deleteChunksStmt: Database.Statement<[string]>;
  private insertChunkStmt: Database.Statement<[string, string, string, string, string, string, number, string, string]>;
  private listChunksStmt: Database.Statement<[string]>;
  private getChunkMetaStmt: Database.Statement<[string]>;
  private listChunkWorkspacesStmt: Database.Statement<[]>;
  // Lazy tombstone-sweep guard: runs at most once per process lifetime, on
  // the first RAG operation. Cheaper than constructor-time scan for users
  // who don't use RAG.
  private _tombstoneSwept = false;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
    // Idempotent additive migrations: ALTER throws if the column already
    // exists; swallow that one error only.
    const addColumnIfMissing = (sql: string): void => {
      try {
        this.db.exec(sql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/duplicate column name/i.test(msg)) throw err;
      }
    };
    addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN qa_round INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN prd_path TEXT");
    addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN review_round INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN visual_round INTEGER NOT NULL DEFAULT 0");
    // v4 — scope-decision attestation (server-scope-decision-gate). Nullable,
    // no default — absence is meaningful (no attestation → gate may fire).
    addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN scope_decision TEXT");
    addColumnIfMissing("ALTER TABLE handoff_state ADD COLUMN scope_decision_why TEXT");

    // Schema-versioning lazy migrate (Phase 4). Creates schema_meta, stamps
    // the sqlite version row, and runs any registered v(N)→v(N+1) DDL steps
    // inside per-step transactions. Refuse-loud on a future on-disk version
    // — propagates so the caller (HTTP boot) sees the error rather than
    // operating against a half-understood DB.
    runSqliteMigrations(this.db);

    this.selectStmt = this.db.prepare<[string]>(
      "SELECT * FROM handoff_state WHERE workspace_path = ?",
    );
    this.selectLastUpdatedStmt = this.db.prepare<[string]>(
      "SELECT last_updated FROM handoff_state WHERE workspace_path = ?",
    );
    this.upsertStmt = this.db.prepare<[string, string, string, string, string | null, string | null, string, string, number, string | null, number, number, string | null, string | null]>(
      `INSERT OR REPLACE INTO handoff_state
        (workspace_path, active_feature, status, last_updated, blocking_reason, last_agent, completed, pending, qa_round, prd_path, review_round, visual_round, scope_decision, scope_decision_why)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.txUpsert = this.db.transaction(
      (
        workspacePath: string,
        activeFeature: string,
        status: string,
        now: string,
        blockingReason: string | null,
        lastAgent: string | null,
        completed: string,
        pending: string,
        qaRound: number,
        prdPath: string | null,
        reviewRound: number,
        visualRound: number,
        scopeDecision: string | null,
        scopeDecisionWhy: string | null,
        expectedLastUpdated: string | null,
      ) => {
        const row = this.selectLastUpdatedStmt.get(workspacePath) as { last_updated: string } | undefined;
        const actual = row?.last_updated ?? null;
        if (actual !== expectedLastUpdated) {
          throw new Error(
            `⛔ STATE DRIFT: handoff row changed between freshness check and write ` +
              `(expected last_updated=${expectedLastUpdated}, actual=${actual}). Retry after tw_get_state.`,
          );
        }
        this.upsertStmt.run(
          workspacePath,
          activeFeature,
          status,
          now,
          blockingReason,
          lastAgent,
          completed,
          pending,
          qaRound,
          prdPath,
          reviewRound,
          visualRound,
          scopeDecision,
          scopeDecisionWhy,
        );
      },
    );

    this.listTasksStmt = this.db.prepare<[string]>(
      `SELECT task_id, description, section, completed, note, reverted_reason, sort_order
       FROM tasks WHERE workspace_path = ? ORDER BY sort_order ASC`,
    );
    this.maxSortStmt = this.db.prepare<[string]>(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM tasks WHERE workspace_path = ?",
    );
    this.insertTaskStmt = this.db.prepare<[string, string, string, string, number]>(
      `INSERT INTO tasks (workspace_path, task_id, section, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.selectTaskStmt = this.db.prepare<[string, string]>(
      "SELECT * FROM tasks WHERE workspace_path = ? AND task_id = ?",
    );
    // Reverted suffix preserved on description so completion history mirrors the
    // file-mode "(reverted: ...)" trail and survives subsequent list reads.
    this.completeTaskStmt = this.db.prepare<[string | null, string, string]>(
      `UPDATE tasks SET completed = 1, note = ?, reverted_reason = NULL
       WHERE workspace_path = ? AND task_id = ? AND completed = 0`,
    );
    this.rollbackTaskStmt = this.db.prepare<[string, string, string]>(
      `UPDATE tasks SET completed = 0, reverted_reason = ?, note = NULL
       WHERE workspace_path = ? AND task_id = ? AND completed = 1`,
    );

    this.insertReportStmt = this.db.prepare<[string, string, string, string, string, string]>(
      `INSERT INTO reports (workspace_path, task_id, status, reviewer, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    // PASS-status reports satisfy hasEvidence() in SQLite mode. File mode is
    // laxer (any file is enough) because pass/fail isn't decodable from disk.
    this.selectReportsByTaskStmt = this.db.prepare<[string]>(
      `SELECT DISTINCT task_id FROM reports
       WHERE workspace_path = ? AND status = 'PASS' AND task_id IN (SELECT value FROM json_each(?))`,
    );

    this.insertCodeReviewStmt = this.db.prepare<[string, string, string, string, string, string]>(
      `INSERT INTO code_review_reports (workspace_path, task_id, verdict, reviewer, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    // APPROVED rows satisfy hasCodeReviewEvidence() (parallel to qa PASS gating).
    this.selectCodeReviewByTaskStmt = this.db.prepare<[string]>(
      `SELECT DISTINCT task_id FROM code_review_reports
       WHERE workspace_path = ? AND verdict = 'APPROVED' AND task_id IN (SELECT value FROM json_each(?))`,
    );

    this.deleteChunksStmt = this.db.prepare<[string]>(
      "DELETE FROM prd_chunks WHERE workspace_path = ?",
    );
    this.insertChunkStmt = this.db.prepare<[string, string, string, string, string, string, number, string, string]>(
      `INSERT OR REPLACE INTO prd_chunks
         (workspace_path, chunk_id, section, text, embedding, prd_path, prd_mtime, chunker_version, embedding_model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.listChunksStmt = this.db.prepare<[string]>(
      "SELECT chunk_id, section, text, embedding, prd_path, prd_mtime, chunker_version, embedding_model FROM prd_chunks WHERE workspace_path = ?",
    );
    this.getChunkMetaStmt = this.db.prepare<[string]>(
      "SELECT prd_mtime, chunker_version, embedding_model FROM prd_chunks WHERE workspace_path = ? LIMIT 1",
    );
    this.listChunkWorkspacesStmt = this.db.prepare<[]>(
      "SELECT DISTINCT workspace_path FROM prd_chunks",
    );
  }

  // Run-once tombstone sweep: drop chunks whose workspace directory no longer
  // exists on disk. Lazily fired by the first RAG operation in the process.
  // Errors are swallowed because RAG is best-effort — a sweep failure must
  // never break the calling query.
  private ensureTombstoneSwept(): void {
    if (this._tombstoneSwept) return;
    this._tombstoneSwept = true;
    try {
      const rows = this.listChunkWorkspacesStmt.all() as Array<{ workspace_path: string }>;
      for (const r of rows) {
        if (!fs.existsSync(r.workspace_path)) {
          this.deleteChunksStmt.run(r.workspace_path);
        }
      }
    } catch {
      // best-effort: swallow
    }
  }

  // ---------- handoff state ----------

  private fetchRow(workspacePath: string): HandoffRow | undefined {
    return this.selectStmt.get(workspacePath) as HandoffRow | undefined;
  }

  private fetchLastUpdated(workspacePath: string): string | null {
    const row = this.selectLastUpdatedStmt.get(workspacePath) as { last_updated: string } | undefined;
    return row?.last_updated ?? null;
  }

  parse(workspacePath: string): HandoffState | null {
    const row = this.fetchRow(workspacePath);
    if (!row) return null;
    const qaRoundRaw = row.qa_round;
    const qa_round =
      typeof qaRoundRaw === "number" && Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0
        ? Math.floor(qaRoundRaw)
        : 0;
    const reviewRoundRaw = row.review_round;
    const review_round =
      typeof reviewRoundRaw === "number" && Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0
        ? Math.floor(reviewRoundRaw)
        : 0;
    const visualRoundRaw = row.visual_round;
    const visual_round =
      typeof visualRoundRaw === "number" && Number.isFinite(visualRoundRaw) && visualRoundRaw >= 0
        ? Math.floor(visualRoundRaw)
        : 0;
    return {
      active_feature: row.active_feature,
      status: row.status,
      last_updated: row.last_updated,
      ...(row.blocking_reason ? { blocking_reason: row.blocking_reason } : {}),
      ...(row.last_agent ? { last_agent: row.last_agent } : {}),
      ...(row.prd_path ? { prd_path: row.prd_path } : {}),
      ...(row.scope_decision ? { scope_decision: row.scope_decision } : {}),
      ...(row.scope_decision_why ? { scope_decision_why: row.scope_decision_why } : {}),
      completed_tasks: JSON.parse(row.completed) as string[],
      pending_notes: JSON.parse(row.pending) as string[],
      qa_round,
      review_round,
      visual_round,
    };
  }

  readState(workspacePath: string): string {
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

  writeState(opts: WriteHandoffStateOptions): Promise<string>;
  /** @deprecated v3.15.0: prefer the options-object overload. */
  writeState(
    workspacePath: string,
    activeFeature: string,
    status: string,
    completedTasks: string[],
    pendingNotes: string[],
    blockingReason?: string,
    lastAgent?: string,
    qaRound?: number,
    prdPath?: string,
    reviewRound?: number,
    visualRound?: number,
  ): Promise<string>;
  writeState(
    workspacePathOrOpts: string | WriteHandoffStateOptions,
    activeFeature?: string,
    status?: string,
    completedTasks?: string[],
    pendingNotes?: string[],
    blockingReason?: string,
    lastAgent?: string,
    qaRound?: number,
    prdPath?: string,
    reviewRound?: number,
    visualRound?: number,
  ): Promise<string> {
    // v3.15.0 dual API: discriminate by first-arg shape.
    let workspacePath: string;
    let scopeDecision: string | undefined;
    let scopeDecisionWhy: string | undefined;
    if (typeof workspacePathOrOpts === "object" && !Array.isArray(workspacePathOrOpts)) {
      const o = workspacePathOrOpts;
      workspacePath = o.workspacePath;
      activeFeature = o.activeFeature;
      status = o.status;
      completedTasks = o.completedTasks ?? [];
      pendingNotes = o.pendingNotes ?? [];
      blockingReason = o.blockingReason;
      lastAgent = o.lastAgent;
      qaRound = o.qaRound;
      prdPath = o.prdPath;
      reviewRound = o.reviewRound;
      visualRound = o.visualRound;
      scopeDecision = o.scopeDecision;
      scopeDecisionWhy = o.scopeDecisionWhy;
    } else {
      workspacePath = workspacePathOrOpts as string;
      completedTasks = completedTasks ?? [];
      pendingNotes = pendingNotes ?? [];
    }
    const _activeFeature: string = activeFeature as string;
    const _status: string = status as string;
    const _completedTasks: string[] = completedTasks;
    const _pendingNotes: string[] = pendingNotes;
    const currentLastUpdated = this.fetchLastUpdated(workspacePath);
    verifyExtra(workspacePath, SNAPSHOT_KEY, currentLastUpdated);

    const normalisedRound =
      Number.isFinite(qaRound) && (qaRound as number) >= 0 ? Math.floor(qaRound as number) : 0;
    const normalisedReviewRound =
      Number.isFinite(reviewRound) && (reviewRound as number) >= 0
        ? Math.floor(reviewRound as number)
        : 0;
    const normalisedVisualRound =
      Number.isFinite(visualRound) && (visualRound as number) >= 0
        ? Math.floor(visualRound as number)
        : 0;

    // Preserve prd_path AND the scope_decision attestation across writes that
    // don't explicitly set them (PM sets each once; downstream roles call
    // writeState without re-passing the fields). One existing read services all.
    let effectivePrdPath: string | null = prdPath ?? null;
    let effectiveScopeDecision: string | null = scopeDecision ?? null;
    let effectiveScopeDecisionWhy: string | null = scopeDecisionWhy ?? null;
    if (
      effectivePrdPath === null ||
      effectiveScopeDecision === null ||
      effectiveScopeDecisionWhy === null
    ) {
      const existing = this.fetchRow(workspacePath);
      if (effectivePrdPath === null) effectivePrdPath = existing?.prd_path ?? null;
      if (effectiveScopeDecision === null) effectiveScopeDecision = existing?.scope_decision ?? null;
      if (effectiveScopeDecisionWhy === null) effectiveScopeDecisionWhy = existing?.scope_decision_why ?? null;
    }

    const now = new Date().toISOString();
    this.txUpsert(
      workspacePath,
      _activeFeature,
      _status,
      now,
      blockingReason ?? null,
      lastAgent ?? null,
      JSON.stringify(_completedTasks),
      JSON.stringify(_pendingNotes),
      normalisedRound,
      effectivePrdPath,
      normalisedReviewRound,
      normalisedVisualRound,
      effectiveScopeDecision,
      effectiveScopeDecisionWhy,
      currentLastUpdated,
    );

    snapshotExtra(workspacePath, SNAPSHOT_KEY, now);
    return Promise.resolve(JSON.stringify({ success: true, storage: "sqlite", updated_at: now }));
  }

  // ---------- task list ----------

  listTasks(workspacePath: string): TaskRecord[] | null {
    const rows = this.listTasksStmt.all(workspacePath) as TaskRow[];
    if (rows.length === 0) return null;
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

  getNextTask(workspacePath: string): string {
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

  completeTask(workspacePath: string, taskId: string, note?: string): Promise<string> {
    const existing = this.selectTaskStmt.get(workspacePath, taskId) as TaskRow | undefined;
    if (!existing) {
      return Promise.resolve(JSON.stringify({ error: `Task ${taskId} not found.` }));
    }
    if (existing.completed === 1) {
      return Promise.resolve(JSON.stringify({ error: `Task ${taskId} is already completed.` }));
    }
    const info = this.completeTaskStmt.run(note ?? null, workspacePath, taskId);
    if (info.changes === 0) {
      return Promise.resolve(
        JSON.stringify({ error: `Task ${taskId} could not be marked complete (race).` }),
      );
    }
    return Promise.resolve(
      JSON.stringify({
        success: true,
        taskId,
        marked: "completed",
        storage: "sqlite",
        note: note ?? null,
      }),
    );
  }

  rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string> {
    const existing = this.selectTaskStmt.get(workspacePath, taskId) as TaskRow | undefined;
    if (!existing) {
      return Promise.resolve(JSON.stringify({ error: `Task ${taskId} not found.` }));
    }
    if (existing.completed === 0) {
      return Promise.resolve(
        JSON.stringify({ error: `Task ${taskId} is not completed, cannot rollback.` }),
      );
    }
    const info = this.rollbackTaskStmt.run(reason, workspacePath, taskId);
    if (info.changes === 0) {
      return Promise.resolve(
        JSON.stringify({ error: `Task ${taskId} could not be rolled back (race).` }),
      );
    }
    return Promise.resolve(
      JSON.stringify({ success: true, taskId, marked: "reverted", storage: "sqlite", reason }),
    );
  }

  addTask(
    workspacePath: string,
    taskId: string,
    description: string,
    section?: string,
  ): Promise<string> {
    const existing = this.selectTaskStmt.get(workspacePath, taskId) as TaskRow | undefined;
    if (existing) {
      return Promise.resolve(JSON.stringify({ error: `Task ${taskId} already exists.` }));
    }
    const maxSortRow = this.maxSortStmt.get(workspacePath) as { max_sort: number };
    const nextSort = (maxSortRow?.max_sort ?? 0) + 1;
    this.insertTaskStmt.run(workspacePath, taskId, section?.trim() || "Active", description, nextSort);
    return Promise.resolve(
      JSON.stringify({
        success: true,
        taskId,
        section: section?.trim() || "Active",
        storage: "sqlite",
      }),
    );
  }

  // ---------- QA evidence ----------

  recordReview(
    workspacePath: string,
    taskIds: string[],
    status: "PASS" | "FAIL",
    reviewer: string,
    notes: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    // Insert per id in a single implicit transaction. Duplicate (ws, id,
    // created_at) is theoretically possible if called twice in the same ms;
    // the PRIMARY KEY constraint then throws — caller's retry path.
    const insertMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        this.insertReportStmt.run(workspacePath, id, status, reviewer, notes, now);
      }
    });
    insertMany(taskIds);
    return Promise.resolve();
  }

  hasEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck> {
    if (taskIds.length === 0) return Promise.resolve({ present: [], missing: [] });
    const rows = this.selectReportsByTaskStmt.all(workspacePath, JSON.stringify(taskIds)) as Array<{
      task_id: string;
    }>;
    const presentSet = new Set(rows.map((r) => r.task_id));
    const present: string[] = [];
    const missing: string[] = [];
    for (const id of taskIds) {
      if (presentSet.has(id)) present.push(id);
      else missing.push(id);
    }
    return Promise.resolve({ present, missing });
  }

  recordCodeReview(
    workspacePath: string,
    taskIds: string[],
    verdict: "APPROVED" | "CHANGES_REQUESTED",
    reviewer: string,
    notes: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const insertMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        this.insertCodeReviewStmt.run(workspacePath, id, verdict, reviewer, notes, now);
      }
    });
    insertMany(taskIds);
    return Promise.resolve();
  }

  hasCodeReviewEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck> {
    if (taskIds.length === 0) return Promise.resolve({ present: [], missing: [] });
    const rows = this.selectCodeReviewByTaskStmt.all(workspacePath, JSON.stringify(taskIds)) as Array<{
      task_id: string;
    }>;
    const presentSet = new Set(rows.map((r) => r.task_id));
    const present: string[] = [];
    const missing: string[] = [];
    for (const id of taskIds) {
      if (presentSet.has(id)) present.push(id);
      else missing.push(id);
    }
    return Promise.resolve({ present, missing });
  }

  // ---------- RAG: prd_chunks ----------

  upsertPrdChunks(workspacePath: string, chunks: PrdChunk[]): void {
    this.ensureTombstoneSwept();
    const run = this.db.transaction((rows: PrdChunk[]) => {
      this.deleteChunksStmt.run(workspacePath);
      for (const c of rows) {
        this.insertChunkStmt.run(
          workspacePath,
          c.chunk_id,
          c.section,
          c.text,
          JSON.stringify(c.embedding),
          c.prd_path,
          c.prd_mtime,
          c.chunker_version,
          c.embedding_model,
        );
      }
    });
    run(chunks);
  }

  // GC primitive for the PASS-cleanup hook in index.ts:tw_update_state.
  // Returns the number of rows deleted so callers can log / report.
  deletePrdChunks(workspacePath: string): number {
    const info = this.deleteChunksStmt.run(workspacePath);
    return info.changes;
  }

  listPrdChunks(workspacePath: string): PrdChunk[] {
    this.ensureTombstoneSwept();
    interface ChunkRow {
      chunk_id: string; section: string; text: string; embedding: string;
      prd_path: string; prd_mtime: number; chunker_version: string; embedding_model: string;
    }
    const rows = this.listChunksStmt.all(workspacePath) as ChunkRow[];
    return rows.map(r => ({
      chunk_id: r.chunk_id,
      section: r.section,
      text: r.text,
      embedding: JSON.parse(r.embedding) as number[],
      prd_path: r.prd_path,
      prd_mtime: r.prd_mtime,
      chunker_version: r.chunker_version,
      embedding_model: r.embedding_model,
    }));
  }

  getPrdIndexMeta(workspacePath: string): InvalidationKey | null {
    this.ensureTombstoneSwept();
    interface MetaRow { prd_mtime: number; chunker_version: string; embedding_model: string; }
    const row = this.getChunkMetaStmt.get(workspacePath) as MetaRow | undefined;
    if (!row) return null;
    return { prd_mtime: row.prd_mtime, chunker_version: row.chunker_version, embedding_model: row.embedding_model };
  }

  async queryPrdSpec(workspacePath: string, query: string, topK: number = 5): Promise<string> {
    this.ensureTombstoneSwept();
    const chunks = this.listPrdChunks(workspacePath);
    if (chunks.length === 0) return "";
    const model = chunks[0].embedding_model ?? DEFAULT_EMBEDDING_MODEL;
    const qVec = await embedText(query, model);
    if (!qVec) return "";
    return chunks
      .map(c => ({ c, score: cosineSim(qVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ c }) => `### ${c.section}\n${c.text}`)
      .join("\n\n---\n\n");
  }

  close(): void {
    this.db.close();
  }
}

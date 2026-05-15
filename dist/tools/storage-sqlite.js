// Coded by @sr-engineer
// SQLite-backed handoff storage. Used in HTTP/remote mode where a process-shared
// DB beats per-workspace markdown files. Freshness is enforced via the row's
// `last_updated` column rather than file mtime.
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
  pending         TEXT NOT NULL DEFAULT '[]'
)`;
const SNAPSHOT_KEY = "sqlite:handoff.last_updated";
export class SqliteHandoffStorage {
    db;
    selectStmt;
    selectLastUpdatedStmt;
    upsertStmt;
    txUpsert;
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.db.exec(SCHEMA);
        this.selectStmt = this.db.prepare("SELECT * FROM handoff_state WHERE workspace_path = ?");
        this.selectLastUpdatedStmt = this.db.prepare("SELECT last_updated FROM handoff_state WHERE workspace_path = ?");
        this.upsertStmt = this.db.prepare(`INSERT OR REPLACE INTO handoff_state
        (workspace_path, active_feature, status, last_updated, blocking_reason, last_agent, completed, pending)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        // Re-check last_updated inside the transaction so concurrent writers can't
        // race past the session-snapshot freshness gate.
        this.txUpsert = this.db.transaction((workspacePath, activeFeature, status, now, blockingReason, lastAgent, completed, pending, expectedLastUpdated) => {
            const row = this.selectLastUpdatedStmt.get(workspacePath);
            const actual = row?.last_updated ?? null;
            if (actual !== expectedLastUpdated) {
                throw new Error(`⛔ STATE DRIFT: handoff row changed between freshness check and write ` +
                    `(expected last_updated=${expectedLastUpdated}, actual=${actual}). Retry after tw_get_state.`);
            }
            this.upsertStmt.run(workspacePath, activeFeature, status, now, blockingReason, lastAgent, completed, pending);
        });
    }
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
        return {
            active_feature: row.active_feature,
            status: row.status,
            last_updated: row.last_updated,
            ...(row.blocking_reason ? { blocking_reason: row.blocking_reason } : {}),
            ...(row.last_agent ? { last_agent: row.last_agent } : {}),
            completed: JSON.parse(row.completed),
            pending: JSON.parse(row.pending),
        };
    }
    readState(workspacePath) {
        markStateRead(workspacePath);
        const state = this.parse(workspacePath);
        // Snapshot the row's last_updated (or null if no row yet) so subsequent
        // writeState calls can detect concurrent modification.
        snapshotExtra(workspacePath, SNAPSHOT_KEY, state?.last_updated ?? null);
        if (!state) {
            return JSON.stringify({
                exists: false,
                message: "No handoff state found. Initialize by calling tw_update_state.",
            });
        }
        return JSON.stringify({ exists: true, ...state });
    }
    writeState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent) {
        // Two-layer freshness: (1) session-level snapshot vs current DB row,
        // (2) re-check inside the SQLite transaction to close the read-then-write race.
        const currentLastUpdated = this.fetchLastUpdated(workspacePath);
        verifyExtra(workspacePath, SNAPSHOT_KEY, currentLastUpdated);
        const now = new Date().toISOString();
        this.txUpsert(workspacePath, activeFeature, status, now, blockingReason ?? null, lastAgent ?? null, JSON.stringify(completedTasks), JSON.stringify(pendingNotes), currentLastUpdated);
        // Refresh snapshot so the same session can write again without re-reading.
        snapshotExtra(workspacePath, SNAPSHOT_KEY, now);
        return Promise.resolve(JSON.stringify({ success: true, storage: "sqlite", updated_at: now }));
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=storage-sqlite.js.map
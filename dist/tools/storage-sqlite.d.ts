import type { HandoffStorage, HandoffState, TaskRecord, EvidenceCheck } from "./storage.js";
import type { WriteHandoffStateOptions } from "./handoff.js";
import { type PrdChunk, type InvalidationKey } from "./rag.js";
export declare class SqliteHandoffStorage implements HandoffStorage {
    private db;
    private selectStmt;
    private selectLastUpdatedStmt;
    private upsertStmt;
    private txUpsert;
    private listTasksStmt;
    private maxSortStmt;
    private insertTaskStmt;
    private selectTaskStmt;
    private completeTaskStmt;
    private rollbackTaskStmt;
    private insertReportStmt;
    private selectReportsByTaskStmt;
    private insertCodeReviewStmt;
    private selectCodeReviewByTaskStmt;
    private deleteChunksStmt;
    private insertChunkStmt;
    private listChunksStmt;
    private getChunkMetaStmt;
    private listChunkWorkspacesStmt;
    private _tombstoneSwept;
    constructor(dbPath: string);
    private ensureTombstoneSwept;
    private fetchRow;
    private fetchLastUpdated;
    parse(workspacePath: string): HandoffState | null;
    readState(workspacePath: string): string;
    writeState(opts: WriteHandoffStateOptions): Promise<string>;
    /** @deprecated v3.15.0: prefer the options-object overload. */
    writeState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string, qaRound?: number, prdPath?: string, reviewRound?: number, visualRound?: number): Promise<string>;
    /**
     * Real implementation (E36 Option-A convergence). Both writeState overloads
     * bottom out here via the thin dispatcher above — options-object shape
     * only, no more first-arg discrimination in the body.
     * NOTE (DR-5 precedent): the file-mode-only frontmatter fields —
     * cutApproved (handoff v5), externalRefs (v6), nextRole / resumeOf /
     * reviewVerdict (v7), and dispatchPins (v8, c14-dispatch-pins AC-5) — are
     * deliberately NOT destructured here and never round-trip in SQLite. The
     * gates that consume them either read the incoming write args or are
     * file-mode only; no DDL change, sqlite schema_version unchanged.
     */
    private writeStateCore;
    listTasks(workspacePath: string): TaskRecord[] | null;
    getNextTask(workspacePath: string): string;
    completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
    rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
    addTask(workspacePath: string, taskId: string, description: string, section?: string): Promise<string>;
    recordReview(workspacePath: string, taskIds: string[], status: "PASS" | "FAIL", reviewer: string, notes: string): Promise<void>;
    hasEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck>;
    recordCodeReview(workspacePath: string, taskIds: string[], verdict: "APPROVED" | "CHANGES_REQUESTED", reviewer: string, notes: string): Promise<void>;
    hasCodeReviewEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck>;
    upsertPrdChunks(workspacePath: string, chunks: PrdChunk[]): void;
    deletePrdChunks(workspacePath: string): number;
    listPrdChunks(workspacePath: string): PrdChunk[];
    getPrdIndexMeta(workspacePath: string): InvalidationKey | null;
    queryPrdSpec(workspacePath: string, query: string, topK?: number): Promise<string>;
    close(): void;
}
//# sourceMappingURL=storage-sqlite.d.ts.map
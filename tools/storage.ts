// Coded by @sr-engineer
// Storage abstraction for handoff state AND task list operations.
// FileHandoffStorage is the stdio default (markdown + filesystem).
// SqliteHandoffStorage (HTTP mode) implements the same interface against a DB
// so remote / containerized deployments need no mounted workspace files.

import {
  parseHandoff,
  readHandoffState,
  writeHandoffState,
  type HandoffState,
  type WriteHandoffStateOptions,
} from "./handoff.js";
import {
  parseTasksFromFile,
  getNextTaskFromFile,
  completeTaskInFile,
  rollbackTaskInFile,
  voidTaskInFile,
  addTaskInFile,
  type TaskRecord,
} from "./tasks-file.js";
import {
  recordReviewInFile,
  hasEvidenceInFile,
} from "../gates/qa-review.js";
import {
  recordCodeReviewInFile,
  hasCodeReviewEvidenceInFile,
} from "../gates/code-review.js";

export type { HandoffState, TaskRecord };

export interface EvidenceCheck {
  present: string[];
  missing: string[];
}

export interface HandoffStorage {
  // --- Handoff state ---
  readState(workspacePath: string): string;
  // v3.15.0 dual API: prefer the options-object overload; positional is
  // @deprecated and slated for removal in v4.0.0.
  writeState(opts: WriteHandoffStateOptions): Promise<string>;
  /**
   * @deprecated v3.15.0: prefer the options-object overload
   * `writeState({ workspacePath, activeFeature, status, ... })`.
   * Positional signature retained for backwards-compat; planned removal in v4.0.0.
   */
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
  parse(workspacePath: string): HandoffState | null;

  // --- Task list ---
  listTasks(workspacePath: string): TaskRecord[] | null;
  getNextTask(workspacePath: string): string;
  completeTask(workspacePath: string, taskId: string, note?: string): Promise<string>;
  rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
  // Void a task (E117): marks a row as "should never have existed" rather
  // than "done, then reverted". Legal only on an incomplete row; an
  // already-completed row is refused. A voided (or unknown) task id is
  // invisible to getNextTask, listTasks, tw_detect_drift, and tw_sync — none
  // of them distinguish the two, both simply don't exist to them, so a
  // voided row is never re-offered, never counted as completed/incomplete,
  // and never flagged as drift. voidTask itself is the one exception, and
  // only in FILE mode: re-voiding an already-voided id returns a distinct
  // `alreadyVoided: true` flag rather than a bare not-found, because the
  // voided marker line is still literally on disk to scan for. SQLite/HTTP
  // mode reports both cases uniformly as not-found — no alreadyVoided
  // distinction there (reason is not persisted; see C3).
  voidTask(workspacePath: string, taskId: string, reason: string): Promise<string>;
  addTask(
    workspacePath: string,
    taskId: string,
    description: string,
    section?: string,
  ): Promise<string>;

  // --- QA evidence ---
  recordReview(
    workspacePath: string,
    taskIds: string[],
    status: "PASS" | "FAIL",
    reviewer: string,
    notes: string,
  ): Promise<void>;
  hasEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck>;

  // --- Code-reviewer evidence (mirrors QA pair; gates sr ↔ code-reviewer → qa) ---
  recordCodeReview(
    workspacePath: string,
    taskIds: string[],
    verdict: "APPROVED" | "CHANGES_REQUESTED",
    reviewer: string,
    notes: string,
  ): Promise<void>;
  hasCodeReviewEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck>;
}

export class FileHandoffStorage implements HandoffStorage {
  readState(workspacePath: string): string {
    return readHandoffState(workspacePath);
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
    // E36 Option-A: dual-dispatch body collapses to "if object → options
    // path; else pack positionals → options → call" — targeting the ONE real
    // options-object writeHandoffState implementation directly (not its own
    // positional overload, which is itself just this same packing).
    if (typeof workspacePathOrOpts === "object" && !Array.isArray(workspacePathOrOpts)) {
      return writeHandoffState(workspacePathOrOpts);
    }
    return writeHandoffState({
      workspacePath: workspacePathOrOpts as string,
      activeFeature: activeFeature as string,
      status: status as string,
      completedTasks: completedTasks ?? [],
      pendingNotes: pendingNotes ?? [],
      blockingReason,
      lastAgent,
      qaRound,
      prdPath,
      reviewRound,
      visualRound,
    });
  }

  parse(workspacePath: string): HandoffState | null {
    return parseHandoff(workspacePath);
  }

  listTasks(workspacePath: string): TaskRecord[] | null {
    return parseTasksFromFile(workspacePath);
  }

  getNextTask(workspacePath: string): string {
    return getNextTaskFromFile(workspacePath);
  }

  completeTask(workspacePath: string, taskId: string, note?: string): Promise<string> {
    return completeTaskInFile(workspacePath, taskId, note);
  }

  rollbackTask(workspacePath: string, taskId: string, reason: string): Promise<string> {
    return rollbackTaskInFile(workspacePath, taskId, reason);
  }

  voidTask(workspacePath: string, taskId: string, reason: string): Promise<string> {
    return voidTaskInFile(workspacePath, taskId, reason);
  }

  addTask(
    workspacePath: string,
    taskId: string,
    description: string,
    section?: string,
  ): Promise<string> {
    return addTaskInFile(workspacePath, taskId, description, section);
  }

  recordReview(
    workspacePath: string,
    taskIds: string[],
    status: "PASS" | "FAIL",
    reviewer: string,
    notes: string,
  ): Promise<void> {
    return recordReviewInFile(workspacePath, taskIds, status, reviewer, notes);
  }

  hasEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck> {
    return Promise.resolve(hasEvidenceInFile(workspacePath, taskIds));
  }

  recordCodeReview(
    workspacePath: string,
    taskIds: string[],
    verdict: "APPROVED" | "CHANGES_REQUESTED",
    reviewer: string,
    notes: string,
  ): Promise<void> {
    return recordCodeReviewInFile(workspacePath, taskIds, verdict, reviewer, notes);
  }

  hasCodeReviewEvidence(workspacePath: string, taskIds: string[]): Promise<EvidenceCheck> {
    return Promise.resolve(hasCodeReviewEvidenceInFile(workspacePath, taskIds));
  }
}

let active: HandoffStorage = new FileHandoffStorage();

export function getActiveStorage(): HandoffStorage {
  return active;
}

export function setActiveStorage(storage: HandoffStorage): void {
  active = storage;
}

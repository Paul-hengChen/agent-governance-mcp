// Coded by @sr-engineer
// Storage abstraction for handoff state AND task list operations.
// FileHandoffStorage is the stdio default (markdown + filesystem).
// SqliteHandoffStorage (HTTP mode) implements the same interface against a DB
// so remote / containerized deployments need no mounted workspace files.

import { parseHandoff, readHandoffState, writeHandoffState, type HandoffState } from "./handoff.js";
import {
  parseTasksFromFile,
  getNextTaskFromFile,
  completeTaskInFile,
  rollbackTaskInFile,
  addTaskInFile,
  type TaskRecord,
} from "./tasks-file.js";
import {
  recordReviewInFile,
  hasEvidenceInFile,
  recordCodeReviewInFile,
  hasCodeReviewEvidenceInFile,
} from "./evidence-file.js";

export type { HandoffState, TaskRecord };

export interface EvidenceCheck {
  present: string[];
  missing: string[];
}

export interface HandoffStorage {
  // --- Handoff state ---
  readState(workspacePath: string): string;
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
  ): Promise<string> {
    return writeHandoffState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent, qaRound, prdPath, reviewRound, visualRound);
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

// Coded by @sr-engineer
// Session guard: tracks per-session tool call state for pre-flight enforcement
// and per-file mtime snapshots for cross-process freshness checks.

import * as fs from "fs";
import * as path from "path";
import { findTasksFile } from "../tools/config.js";

type FileKind = "handoff" | "tasks";

interface SessionSnapshot {
  hasReadState: boolean;
  lastReadAt: string;
  handoffMtimeMs: number | null;
  tasksPath: string | null;
  tasksMtimeMs: number | null;
}

const activeSessions = new Map<string, SessionSnapshot>();

function statMtime(p: string): number | null {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

export function markStateRead(workspacePath: string): void {
  const handoffPath = path.join(workspacePath, ".current", "handoff.md");
  const tasksPath = findTasksFile(workspacePath);
  activeSessions.set(workspacePath, {
    hasReadState: true,
    lastReadAt: new Date().toISOString(),
    handoffMtimeMs: statMtime(handoffPath),
    tasksPath,
    tasksMtimeMs: tasksPath ? statMtime(tasksPath) : null,
  });
}

export function hasReadState(workspacePath: string): boolean {
  return activeSessions.get(workspacePath)?.hasReadState ?? false;
}

export function enforcePreFlight(workspacePath: string, toolName: string): void {
  if (!hasReadState(workspacePath)) {
    throw new Error(
      `⛔ BLOCKED: You must call sdd_get_state("${workspacePath}") before calling ${toolName}. ` +
        `This ensures you are working with current project state, not guessing.`
    );
  }
}

/**
 * Compare the on-disk mtime to the snapshot taken at sdd_get_state time.
 * If they diverge, another process (or a human editor) changed the file —
 * the caller's mental model is stale and writes must be rejected.
 */
export function verifyFreshness(
  workspacePath: string,
  filePath: string,
  kind: FileKind
): void {
  const session = activeSessions.get(workspacePath);
  if (!session) return; // enforcePreFlight should have caught this already
  const currentMtime = statMtime(filePath);
  const snapshotMtime =
    kind === "handoff" ? session.handoffMtimeMs : session.tasksMtimeMs;
  if (currentMtime !== snapshotMtime) {
    throw new Error(
      `⛔ STATE DRIFT: ${kind} file (${filePath}) was modified since you called ` +
        `sdd_get_state (snapshot mtime=${snapshotMtime}, current mtime=${currentMtime}). ` +
        `Call sdd_get_state again to refresh, then retry.`
    );
  }
}

/**
 * Update the snapshot mtime after a successful write so subsequent writes in
 * the same session don't trip the freshness check on their own changes.
 */
export function refreshSnapshotFor(
  workspacePath: string,
  filePath: string,
  kind: FileKind
): void {
  const session = activeSessions.get(workspacePath);
  if (!session) return;
  const mtime = statMtime(filePath);
  if (kind === "handoff") {
    session.handoffMtimeMs = mtime;
  } else {
    session.tasksMtimeMs = mtime;
    session.tasksPath = filePath;
  }
}

export function resetSession(workspacePath: string): void {
  activeSessions.delete(workspacePath);
}

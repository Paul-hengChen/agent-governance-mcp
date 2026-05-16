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
  // Non-file freshness tokens (used by SQLite storage to snapshot a row's last_updated)
  extra: Map<string, string | null>;
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
  // In SQLite/HTTP mode the workspace path may not exist on this host; the
  // mtime/tasksPath fields are meaningless there and verifyExtra() carries
  // freshness via SNAPSHOT_KEY instead. Skip the fs scan when the workspace
  // directory isn't present locally — avoids wasted syscalls and EACCES noise.
  const workspaceExists = (() => {
    try {
      return fs.statSync(workspacePath).isDirectory();
    } catch {
      return false;
    }
  })();
  const handoffPath = workspaceExists ? path.join(workspacePath, ".current", "handoff.md") : null;
  const tasksPath = workspaceExists ? findTasksFile(workspacePath) : null;
  const prev = activeSessions.get(workspacePath);
  activeSessions.set(workspacePath, {
    hasReadState: true,
    lastReadAt: new Date().toISOString(),
    handoffMtimeMs: handoffPath ? statMtime(handoffPath) : null,
    tasksPath,
    tasksMtimeMs: tasksPath ? statMtime(tasksPath) : null,
    // Preserve any extra tokens written by non-file storage between marks.
    extra: prev?.extra ?? new Map(),
  });
}

/**
 * Snapshot an arbitrary freshness token (e.g. SQLite row's last_updated).
 * Used by non-file storage backends where mtime comparison doesn't apply.
 */
export function snapshotExtra(
  workspacePath: string,
  key: string,
  value: string | null
): void {
  const session = activeSessions.get(workspacePath);
  if (!session) return;
  session.extra.set(key, value);
}

/**
 * Verify that the current value matches the snapshotted value for the given key.
 * Throws if drift is detected. No-op if the session has no record (enforcePreFlight
 * should already have rejected the call in that case).
 */
export function verifyExtra(
  workspacePath: string,
  key: string,
  currentValue: string | null
): void {
  const session = activeSessions.get(workspacePath);
  if (!session) return;
  if (!session.extra.has(key)) return; // never snapshotted — first write, allow.
  const snapshot = session.extra.get(key) ?? null;
  if (snapshot !== currentValue) {
    throw new Error(
      `⛔ STATE DRIFT: ${key} changed since you called tw_get_state ` +
        `(snapshot=${snapshot}, current=${currentValue}). Call tw_get_state again, then retry.`
    );
  }
}

export function hasReadState(workspacePath: string): boolean {
  return activeSessions.get(workspacePath)?.hasReadState ?? false;
}

export function enforcePreFlight(workspacePath: string, toolName: string): void {
  if (!hasReadState(workspacePath)) {
    throw new Error(
      `⛔ BLOCKED: You must call tw_get_state("${workspacePath}") before calling ${toolName}. ` +
        `This ensures you are working with current project state, not guessing.`
    );
  }
}

/**
 * Compare the on-disk mtime to the snapshot taken at tw_get_state time.
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
        `tw_get_state (snapshot mtime=${snapshotMtime}, current mtime=${currentMtime}). ` +
        `Call tw_get_state again to refresh, then retry.`
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
  // Reset idle timer so long-running sessions aren't evicted mid-flight by cleanupStaleSessions
  session.lastReadAt = new Date().toISOString();
}

export function resetSession(workspacePath: string): void {
  activeSessions.delete(workspacePath);
}

export function cleanupStaleSessions(maxAgeMs: number): void {
  const now = Date.now();
  for (const [key, session] of activeSessions.entries()) {
    if (now - new Date(session.lastReadAt).getTime() > maxAgeMs) {
      activeSessions.delete(key);
    }
  }
}

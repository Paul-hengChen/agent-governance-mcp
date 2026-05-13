// Coded by @sr-engineer
// Session guard: tracks per-session tool call state for pre-flight enforcement
// and per-file mtime snapshots for cross-process freshness checks.
import * as fs from "fs";
import * as path from "path";
import { findTasksFile } from "../tools/config.js";
const activeSessions = new Map();
function statMtime(p) {
    try {
        return fs.statSync(p).mtimeMs;
    }
    catch {
        return null;
    }
}
export function markStateRead(workspacePath) {
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
export function hasReadState(workspacePath) {
    return activeSessions.get(workspacePath)?.hasReadState ?? false;
}
export function enforcePreFlight(workspacePath, toolName) {
    if (!hasReadState(workspacePath)) {
        throw new Error(`⛔ BLOCKED: You must call tw_get_state("${workspacePath}") before calling ${toolName}. ` +
            `This ensures you are working with current project state, not guessing.`);
    }
}
/**
 * Compare the on-disk mtime to the snapshot taken at tw_get_state time.
 * If they diverge, another process (or a human editor) changed the file —
 * the caller's mental model is stale and writes must be rejected.
 */
export function verifyFreshness(workspacePath, filePath, kind) {
    const session = activeSessions.get(workspacePath);
    if (!session)
        return; // enforcePreFlight should have caught this already
    const currentMtime = statMtime(filePath);
    const snapshotMtime = kind === "handoff" ? session.handoffMtimeMs : session.tasksMtimeMs;
    if (currentMtime !== snapshotMtime) {
        throw new Error(`⛔ STATE DRIFT: ${kind} file (${filePath}) was modified since you called ` +
            `tw_get_state (snapshot mtime=${snapshotMtime}, current mtime=${currentMtime}). ` +
            `Call tw_get_state again to refresh, then retry.`);
    }
}
/**
 * Update the snapshot mtime after a successful write so subsequent writes in
 * the same session don't trip the freshness check on their own changes.
 */
export function refreshSnapshotFor(workspacePath, filePath, kind) {
    const session = activeSessions.get(workspacePath);
    if (!session)
        return;
    const mtime = statMtime(filePath);
    if (kind === "handoff") {
        session.handoffMtimeMs = mtime;
    }
    else {
        session.tasksMtimeMs = mtime;
        session.tasksPath = filePath;
    }
}
export function resetSession(workspacePath) {
    activeSessions.delete(workspacePath);
}
//# sourceMappingURL=session.js.map
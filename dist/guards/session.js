// Coded by @sr-engineer
// Session guard: tracks per-session tool call state for pre-flight enforcement
/**
 * Tracks which workspace paths have called sdd_get_state in this session.
 * Used to enforce the Pre-Flight Check: agents MUST read state before modifying it.
 */
const activeSessions = new Map();
export function markStateRead(workspacePath) {
    activeSessions.set(workspacePath, {
        hasReadState: true,
        lastReadAt: new Date().toISOString(),
    });
}
export function hasReadState(workspacePath) {
    return activeSessions.get(workspacePath)?.hasReadState ?? false;
}
export function enforcePreFlight(workspacePath, toolName) {
    if (!hasReadState(workspacePath)) {
        throw new Error(`⛔ BLOCKED: You must call sdd_get_state("${workspacePath}") before calling ${toolName}. ` +
            `This ensures you are working with current project state, not guessing.`);
    }
}
export function resetSession(workspacePath) {
    activeSessions.delete(workspacePath);
}
//# sourceMappingURL=session.js.map
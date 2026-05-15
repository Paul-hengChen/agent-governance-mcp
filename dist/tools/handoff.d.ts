export interface HandoffState {
    active_feature: string;
    status: string;
    last_updated: string;
    blocking_reason?: string;
    last_agent?: string;
    completed: string[];
    pending: string[];
}
/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist.
 */
export declare function parseHandoff(workspacePath: string): HandoffState | null;
/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 */
export declare function readHandoffState(workspacePath: string): string;
/**
 * Write handoff state with enforced formatting.
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
export declare function writeHandoffState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string): Promise<string>;
//# sourceMappingURL=handoff.d.ts.map
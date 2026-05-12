interface HandoffState {
    active_feature: string;
    status: string;
    last_updated: string;
    completed: string[];
    pending: string[];
}
/**
 * Parse handoff.md YAML frontmatter + checkbox content into structured JSON.
 * Returns null if file doesn't exist.
 */
export declare function parseHandoff(workspacePath: string): HandoffState | null;
/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 */
export declare function readHandoffState(workspacePath: string): string;
/**
 * Write handoff state with enforced formatting.
 * Guarantees valid YAML frontmatter + Markdown checkbox structure.
 */
export declare function writeHandoffState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[]): Promise<string>;
export {};
//# sourceMappingURL=handoff.d.ts.map
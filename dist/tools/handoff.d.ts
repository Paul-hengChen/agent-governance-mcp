import "../schema/migrations-handoff.js";
export interface HandoffState {
    active_feature: string;
    status: string;
    last_updated: string;
    blocking_reason?: string;
    last_agent?: string;
    completed_tasks: string[];
    pending_notes: string[];
    qa_round: number;
    review_round: number;
    visual_round: number;
    prd_path?: string;
}
/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist. Runs schema migrations in-memory; does
 * NOT write back (callers that need persistence go through readHandoffState).
 */
export declare function parseHandoff(workspacePath: string): HandoffState | null;
/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 * Triggers a fire-and-forget write-back when schema migrations were applied,
 * so the on-disk file heals to CURRENT on the first read.
 */
export declare function readHandoffState(workspacePath: string): string;
/**
 * Write handoff state with enforced formatting.
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
export declare function writeHandoffState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string, qaRound?: number, prdPath?: string, reviewRound?: number, visualRound?: number): Promise<string>;
//# sourceMappingURL=handoff.d.ts.map
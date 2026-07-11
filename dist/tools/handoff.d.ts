import type { ToolResult, WorkspaceOnlyInput } from "./registry.js";
import type { AgentName } from "./transitions.js";
import "../schema/migrations-handoff.js";
export type ExternalRefState = "fetched" | "indexed" | "user-confirmed-ignorable" | "unresolved";
export interface ExternalRef {
    ref: string;
    state: ExternalRefState;
}
export type ResumeOfTarget = "code-reviewer" | "qa-engineer";
export type ReviewVerdict = "APPROVED" | "CHANGES_REQUESTED";
export type DispatchMode = "feature" | "bugfix";
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
    hop_count: number;
    prd_path?: string;
    scope_decision?: string;
    scope_decision_why?: string;
    cut_approved?: boolean;
    external_refs?: ExternalRef[];
    next_role?: AgentName;
    dispatched_at?: string;
    resume_of?: ResumeOfTarget;
    review_verdict?: ReviewVerdict;
    dispatch_pins?: Partial<Record<AgentName, string>>;
    dispatch_mode?: DispatchMode;
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
 * v3.15.0 options-object shape for writeHandoffState's modern overload.
 * Prefer this form at all new call sites. The legacy positional signature
 * is retained for backwards-compat until v4.0.0.
 */
export interface WriteHandoffStateOptions {
    workspacePath: string;
    activeFeature: string;
    status: string;
    completedTasks?: string[];
    pendingNotes?: string[];
    blockingReason?: string;
    lastAgent?: string;
    qaRound?: number;
    prdPath?: string;
    reviewRound?: number;
    visualRound?: number;
    hopCount?: number;
    scopeDecision?: string;
    scopeDecisionWhy?: string;
    cutApproved?: boolean;
    externalRefs?: ExternalRef[];
    nextRole?: AgentName;
    resumeOf?: ResumeOfTarget;
    reviewVerdict?: ReviewVerdict;
    dispatchPins?: Partial<Record<AgentName, string>>;
    dispatchMode?: DispatchMode;
}
/**
 * Write handoff state. v3.15.0 dual API:
 *   - Modern (preferred): `writeHandoffState(options)` — pass a
 *     {@link WriteHandoffStateOptions} object. New call sites should use this
 *     form.
 *   - Legacy (deprecated): `writeHandoffState(workspacePath, activeFeature, …)`
 *     — 11 positional params. Retained for backwards-compat with v3.14.x
 *     callers; planned removal in v4.0.0.
 *
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
export declare function writeHandoffState(opts: WriteHandoffStateOptions): Promise<string>;
/**
 * @deprecated v3.15.0: prefer the options-object overload
 * `writeHandoffState({ workspacePath, activeFeature, status, ... })`.
 * Positional signature retained for backwards-compat; planned removal in v4.0.0.
 */
export declare function writeHandoffState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string, qaRound?: number, prdPath?: string, reviewRound?: number, visualRound?: number, hopCount?: number): Promise<string>;
export declare function handleGetState(args: WorkspaceOnlyInput): Promise<ToolResult>;
//# sourceMappingURL=handoff.d.ts.map
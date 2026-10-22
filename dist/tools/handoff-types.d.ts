import type { AgentName } from "./transitions.js";
/** Prefix of every synthetic entry the tw_get_state read view may emit
 *  (marker.prefix, U+27E6 … U+27E7). Emitted by tools/handoff-parse.ts,
 *  refused on write-back by tools/registry.ts. The ONLY copy of the literal
 *  in tools/ source. (specs/e135-handoff-notes-ledger.md AC10) */
export declare const READ_VIEW_MARKER_PREFIX = "\u27E6agc read-view\u27E7";
/** View-only sibling key of pending_notes, present only when the read view
 *  elided notes. (E138 AC9) */
export interface PendingNotesTruncated {
    /** Sum of on-disk note lengths. */
    total_chars: number;
    /** PENDING_NOTES_CHAR_LIMIT. */
    limit: number;
    /** Count of elided notes. */
    omitted_notes: number;
}
export type ExternalRefState = "fetched" | "indexed" | "user-confirmed-ignorable" | "unresolved";
export interface ExternalRef {
    ref: string;
    state: ExternalRefState;
}
export type ResumeOfTarget = "code-reviewer" | "qa-engineer";
export type ReviewVerdict = "APPROVED" | "CHANGES_REQUESTED";
export type DispatchMode = "feature" | "bugfix";
export type DispatchMechanism = "task" | "switch_role" | "inline";
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
    qa_rounds_total?: number;
    review_rounds_total?: number;
    visual_rounds_total?: number;
    prd_path?: string;
    scope_decision?: string;
    scope_decision_why?: string;
    cut_approved?: boolean;
    cut_approved_source?: string;
    external_refs?: ExternalRef[];
    next_role?: AgentName;
    dispatched_at?: string;
    resume_of?: ResumeOfTarget;
    review_verdict?: ReviewVerdict;
    dispatch_pins?: Partial<Record<AgentName, string>>;
    dispatch_mode?: DispatchMode;
    evidence_schema?: number;
    dispatch_mechanism?: DispatchMechanism;
    dispatch_mechanism_tier?: string;
}
//# sourceMappingURL=handoff-types.d.ts.map
import type { AgentName } from "./transitions.js";
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
    qa_rounds_total?: number;
    review_rounds_total?: number;
    visual_rounds_total?: number;
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
    evidence_schema?: number;
}
//# sourceMappingURL=handoff-types.d.ts.map
export type AgentName = "pm" | "researcher" | "design-auditor" | "architect" | "sr-engineer" | "code-reviewer" | "qa-engineer" | "release-engineer";
export type StatusName = "In_Progress" | "PASS" | "FAIL" | "Blocked";
export interface AgentGateResult {
    ok: boolean;
    message?: string;
}
export interface TransitionTuple {
    agent: AgentName | null;
    status: StatusName | null;
}
export interface TransitionRequest {
    prev: TransitionTuple;
    next: TransitionTuple;
    prev_review_round: number;
    prev_visual_round?: number;
    next_resume_of?: "code-reviewer";
    prev_hop_count?: number;
    feature_changed?: boolean;
    prev_sr_return_count?: number;
}
export interface TransitionRejection {
    error: "TRANSITION_REJECTED" | "REVIEW_ROUND_EXCEEDED" | "VISUAL_ROUND_EXCEEDED" | "HOP_CAP_EXCEEDED" | "SR_RETURN_CAP_EXCEEDED" | "VISUAL_WIDGETS_UNVERIFIED" | "VISUAL_BASELINES_REQUIRED" | "VISUAL_REPORT_INCOMPLETE" | "VISUAL_ASSERTIONS_REQUIRED" | "SCOPE_DECISION_REQUIRED" | "PIXEL_GATE_ATTESTATION_MISSING" | "CUT_APPROVAL_REQUIRED" | "EXTERNAL_REFS_UNRESOLVED" | "SOURCE_CREDIBILITY_UNVERIFIED" | "FEATURE_LEASE_HELD" | "AGENT_ID_REQUIRED";
    attempted: {
        prev_agent: string | null;
        prev_status: string | null;
        new_agent: string | null;
        new_status: string | null;
        visual_round?: number;
    };
    allowed: Array<{
        new_agent: AgentName;
        new_status: StatusName;
        requires?: {
            resume_of: "code-reviewer";
        };
    }>;
    hint: string;
}
/** The chain's one judge: writes PASS / FAIL, completed_tasks and tw_complete_task. (E435) */
export declare const JUDGE_ROLE: "code-reviewer";
export type JudgeRole = typeof JUDGE_ROLE;
export declare const MIGRATION_HINT = " If this feature started on the pre-v5 chain, docs/migration-v5.md says how to finish or restart it.";
/** Judge gate: only code-reviewer passes, on every feature. (E435) */
export declare function requireJudge(agentId: string | undefined, toolName: string): AgentGateResult;
export type AllowedNext = ReadonlyArray<{
    agent: AgentName;
    status: StatusName;
}>;
export declare const ALLOWED_TRANSITIONS: ReadonlyMap<string, AllowedNext>;
export declare const PASS_IDENTITY_REFINE_MESSAGE = "status=\"PASS\" requires agent_id=\"code-reviewer\"";
export declare const QA_PASS_REFINE_MESSAGE: string;
/**
 * Steps the pre-v5 chain allowed and E435 removed (S1-S5). A rejection of one
 * of them appends its hint plus MIGRATION_HINT; keyed on the step only.
 */
export declare const REMOVED_OLD_PATH_STEPS: ReadonlyArray<{
    prev: TransitionTuple | "any";
    next: TransitionTuple;
    hint: string;
}>;
/** The in-flight hint for a removed old-path step, else null. */
export declare function oldPathStepHint(prev: TransitionTuple, next: TransitionTuple): string | null;
/** Successors of a matrix key (empty for an unknown key). */
export declare function allowedSuccessors(key: string): AllowedNext;
/**
 * Validate a (prev -> next) transition against the routing matrix: null on
 * accept, else a rejection envelope the caller surfaces as MCP error content.
 * Precedence: 1 agent_id required; 2 round-cap override; 2.5 hop-cap
 * override (only the pm landing passes; landing does not reset the count);
 * 2.6 sr-return cap (one edge); 3 self-loop fast path (two named pairs); 3.5
 * Amend-Resume edge; 4 table lookup (a removed old-path step gets the
 * migration hint).
 */
export declare function validateTransition(req: TransitionRequest): TransitionRejection | null;
/**
 * New round counters from the prior counters and the incoming and prev
 * tuples, returned together so callers persist them as one. The per-cycle
 * review/visual rounds tick on their FAIL (visual only with a `visual_fail:`
 * note) and reset when their cycle closes or on (pm, In_Progress); hop_count
 * ticks on a role change; the *_rounds_total mirrors and hop_count reset only
 * on feature change. No qa round since E435.
 * Full table: specs/e260b-rationale.md (tools/transitions.ts)
 */
export declare function computeNewRound(prev_review_round: number, prev_visual_round: number, next: TransitionTuple, prev?: TransitionTuple, next_pending_notes?: ReadonlyArray<string>, prev_hop_count?: number, feature_changed?: boolean, prev_review_rounds_total?: number, prev_visual_rounds_total?: number): {
    review_round: number;
    visual_round: number;
    hop_count: number;
    review_rounds_total: number;
    visual_rounds_total: number;
};
/**
 * New sr_return_count (E431): sr-engineer:In_Progress -> qa-engineer:In_Progress
 * returns. Base is 0 on feature change; (pm, In_Progress) resets to 0; the
 * return pair adds 1; anything else carries. Kept out of computeNewRound.
 */
export declare function computeSrReturnCount(prev_sr_return_count: number, prev: TransitionTuple, next: TransitionTuple, feature_changed: boolean): number;
export declare const REVIEW_ROUND_CAP_EXPORTED = 4;
export declare const VISUAL_ROUND_CAP_EXPORTED = 6;
export declare const HOP_CAP_EXPORTED = 14;
export declare const SR_RETURN_CAP_EXPORTED = 2;
//# sourceMappingURL=transitions.d.ts.map
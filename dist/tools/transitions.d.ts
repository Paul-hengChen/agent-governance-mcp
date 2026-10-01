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
    prev_qa_round: number;
    prev_review_round: number;
    prev_visual_round?: number;
    next_resume_of?: "code-reviewer" | "qa-engineer";
    prev_hop_count?: number;
    feature_changed?: boolean;
}
export interface TransitionRejection {
    error: "TRANSITION_REJECTED" | "QA_ROUND_EXCEEDED" | "REVIEW_ROUND_EXCEEDED" | "VISUAL_ROUND_EXCEEDED" | "HOP_CAP_EXCEEDED" | "VISUAL_WIDGETS_UNVERIFIED" | "VISUAL_BASELINES_REQUIRED" | "VISUAL_REPORT_INCOMPLETE" | "VISUAL_ASSERTIONS_REQUIRED" | "SCOPE_DECISION_REQUIRED" | "PIXEL_GATE_ATTESTATION_MISSING" | "CUT_APPROVAL_REQUIRED" | "EXTERNAL_REFS_UNRESOLVED" | "SOURCE_CREDIBILITY_UNVERIFIED" | "FEATURE_LEASE_HELD" | "AGENT_ID_REQUIRED";
    attempted: {
        prev_agent: string | null;
        prev_status: string | null;
        new_agent: string | null;
        new_status: string | null;
        qa_round: number;
        visual_round?: number;
    };
    allowed: Array<{
        new_agent: AgentName;
        new_status: StatusName;
    }>;
    hint: string;
}
export declare function requireQaEngineer(agentId: string | undefined, toolName: string): AgentGateResult;
type AllowedNext = ReadonlyArray<{
    agent: AgentName;
    status: StatusName;
}>;
export declare const ALLOWED_TRANSITIONS: ReadonlyMap<string, AllowedNext>;
/**
 * Validate a (prev -> next) transition against the routing matrix: null on
 * accept, else a rejection envelope the caller surfaces as MCP error content.
 * Precedence: 1 agent_id required; 2 round-cap override; 2.5 hop-cap override
 * (only the pm landing passes; landing does not reset the count); 3 self-loop
 * fast path (two named pairs); 3.5 Amend-Resume edge; 4 table lookup.
 */
export declare function validateTransition(req: TransitionRequest): TransitionRejection | null;
/**
 * New round counters from the prior counters and the incoming and prev
 * tuples, returned together so callers persist them as one. The per-cycle
 * qa/review/visual rounds tick on their FAIL (visual only with a
 * `visual_fail:` note) and reset when their cycle closes or on
 * (pm, In_Progress); hop_count ticks on a role change; the *_rounds_total
 * mirrors and hop_count reset only on feature change.
 * Full table: specs/e260b-rationale.md (tools/transitions.ts)
 */
export declare function computeNewRound(prev_qa_round: number, prev_review_round: number, prev_visual_round: number, next: TransitionTuple, prev?: TransitionTuple, next_pending_notes?: ReadonlyArray<string>, prev_hop_count?: number, feature_changed?: boolean, prev_qa_rounds_total?: number, prev_review_rounds_total?: number, prev_visual_rounds_total?: number): {
    qa_round: number;
    review_round: number;
    visual_round: number;
    hop_count: number;
    qa_rounds_total: number;
    review_rounds_total: number;
    visual_rounds_total: number;
};
export declare const ROUND_CAP_EXPORTED = 4;
export declare const REVIEW_ROUND_CAP_EXPORTED = 4;
export declare const VISUAL_ROUND_CAP_EXPORTED = 6;
export declare const HOP_CAP_EXPORTED = 10;
export {};
//# sourceMappingURL=transitions.d.ts.map
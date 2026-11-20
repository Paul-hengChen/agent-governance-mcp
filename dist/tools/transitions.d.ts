import type { ChainPath } from "./handoff-types.js";
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
    prev_chain_path?: ChainPath;
    next_chain_path?: ChainPath;
    prev_sr_return_count?: number;
}
export interface TransitionRejection {
    error: "TRANSITION_REJECTED" | "QA_ROUND_EXCEEDED" | "REVIEW_ROUND_EXCEEDED" | "VISUAL_ROUND_EXCEEDED" | "HOP_CAP_EXCEEDED" | "SR_RETURN_CAP_EXCEEDED" | "VISUAL_WIDGETS_UNVERIFIED" | "VISUAL_BASELINES_REQUIRED" | "VISUAL_REPORT_INCOMPLETE" | "VISUAL_ASSERTIONS_REQUIRED" | "SCOPE_DECISION_REQUIRED" | "PIXEL_GATE_ATTESTATION_MISSING" | "CUT_APPROVAL_REQUIRED" | "EXTERNAL_REFS_UNRESOLVED" | "SOURCE_CREDIBILITY_UNVERIFIED" | "FEATURE_LEASE_HELD" | "AGENT_ID_REQUIRED";
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
        requires?: {
            resume_of: "code-reviewer" | "qa-engineer";
        };
    }>;
    hint: string;
}
export declare function requireQaEngineer(agentId: string | undefined, toolName: string): AgentGateResult;
export type AllowedNext = ReadonlyArray<{
    agent: AgentName;
    status: StatusName;
}>;
export declare const ALLOWED_TRANSITIONS: ReadonlyMap<string, AllowedNext>;
export declare const TEST_FIRST_OVERLAY: {
    readonly opens: ReadonlyMap<string, AllowedNext>;
    readonly closes: ReadonlyMap<string, AllowedNext>;
};
export declare const PASS_IDENTITY_REFINE_MESSAGE = "status=\"PASS\" requires agent_id=\"qa-engineer\"";
/**
 * The writes that may carry chain_path on a feature not yet marked: (i) any
 * pm write, or (ii) the entry write pm:In_Progress / architect:In_Progress ->
 * qa-engineer:In_Progress.
 */
export declare function isChainPathSetPoint(prev: TransitionTuple, next: TransitionTuple): boolean;
/**
 * Effective successors of a matrix key. Unmarked (chainPath undefined): the
 * ALLOWED entry itself, as today. Test-first: the ALLOWED entries minus the
 * overlay's closes (ALLOWED order kept), then its opens in overlay order.
 */
export declare function allowedSuccessors(key: string, chainPath?: ChainPath): AllowedNext;
/**
 * Validate a (prev -> next) transition against the routing matrix: null on
 * accept, else a rejection envelope the caller surfaces as MCP error content.
 * Precedence: 1 agent_id required; 1.5 test-first marker check; 2 round-cap
 * override; 2.5 hop-cap override (only the pm landing passes; landing does
 * not reset the count); 2.6 sr-return cap (test-first only, one edge); 3
 * self-loop fast path (two named pairs); 3.5 Amend-Resume edge; 4 table
 * lookup (with the test-first overlay on a marked feature).
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
/**
 * New sr_return_count (E431): sr-engineer:In_Progress -> qa-engineer:In_Progress
 * returns on a test-first feature. Base is 0 on feature change; (pm,
 * In_Progress) resets to 0; the return pair adds 1; anything else carries.
 * Pure and marker-free: the return edge is reachable only on a marked feature
 * (validateTransition step 4 rejects it otherwise). Kept out of
 * computeNewRound so that function's return shape is unchanged.
 */
export declare function computeSrReturnCount(prev_sr_return_count: number, prev: TransitionTuple, next: TransitionTuple, feature_changed: boolean): number;
export declare const ROUND_CAP_EXPORTED = 4;
export declare const REVIEW_ROUND_CAP_EXPORTED = 4;
export declare const VISUAL_ROUND_CAP_EXPORTED = 6;
export declare const HOP_CAP_EXPORTED = 14;
export declare const SR_RETURN_CAP_EXPORTED = 2;
//# sourceMappingURL=transitions.d.ts.map
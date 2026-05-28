export type AgentName = "pm" | "researcher" | "design-auditor" | "architect" | "sr-engineer" | "code-reviewer" | "qa-engineer";
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
}
export interface TransitionRejection {
    error: "TRANSITION_REJECTED" | "QA_ROUND_EXCEEDED" | "REVIEW_ROUND_EXCEEDED" | "AGENT_ID_REQUIRED";
    attempted: {
        prev_agent: string | null;
        prev_status: string | null;
        new_agent: string | null;
        new_status: string | null;
        qa_round: number;
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
 * Validate a (prev → next) transition against the routing chain matrix.
 * Returns null on accept. Returns a rejection envelope on reject — the
 * caller surfaces it as the MCP error content (JSON-stringified).
 *
 * Precedence (highest → lowest):
 *   1. agent_id required when next.status is non-null
 *   2. round-cap override (qa_round >= 4 → only (pm, In_Progress))
 *   3. self-loop fast path on same-agent In_Progress→In_Progress
 *   4. table lookup
 */
export declare function validateTransition(req: TransitionRequest): TransitionRejection | null;
/**
 * Compute new round counters from prior counters + incoming tuple + prev tuple.
 * Returns both qa_round and review_round so callers can persist them together.
 *
 * qa_round:
 *   - (qa-engineer, FAIL)         → prev + 1
 *   - (qa-engineer, PASS)         → 0
 *   - (pm, In_Progress)           → 0
 *   - everything else             → prev_qa_round
 *
 * review_round:
 *   - (code-reviewer, FAIL)       → prev + 1
 *   - (qa-engineer, In_Progress) when prev was (code-reviewer, In_Progress) → 0
 *   - (pm, In_Progress)           → 0
 *   - everything else             → prev_review_round
 */
export declare function computeNewRound(prev_qa_round: number, prev_review_round: number, next: TransitionTuple, prev?: TransitionTuple): {
    qa_round: number;
    review_round: number;
};
export declare const ROUND_CAP_EXPORTED = 4;
export declare const REVIEW_ROUND_CAP_EXPORTED = 4;
export {};
//# sourceMappingURL=transitions.d.ts.map
// Coded by @sr-engineer
// Pure state-machine logic for routing-chain enforcement.
// See specs/qa-flow-enforcement-architecture.md §ALLOWED_TRANSITIONS for the
// authoritative matrix. Any change here MUST be mirrored in the design doc.
// ----- agent-id helper (shared with handler-side defense) -----
export function requireQaEngineer(agentId, toolName) {
    if (agentId === "qa-engineer")
        return { ok: true };
    const who = agentId ? `"${agentId}"` : "unidentified agent (agent_id not set)";
    return {
        ok: false,
        message: `⛔ BLOCKED: ${toolName} is reserved for qa-engineer. Called by ${who}. ` +
            `Hand off to qa-engineer and pass agent_id="qa-engineer".`,
    };
}
function keyOf(t) {
    return `${t.agent ?? "null"}:${t.status ?? "null"}`;
}
const ALLOWED = new Map([
    ["null:null", [
            { agent: "pm", status: "In_Progress" },
            { agent: "pm", status: "Blocked" },
            { agent: "researcher", status: "In_Progress" },
            { agent: "researcher", status: "Blocked" },
            { agent: "design-auditor", status: "In_Progress" },
            { agent: "design-auditor", status: "Blocked" },
        ]],
    ["researcher:In_Progress", [
            { agent: "pm", status: "In_Progress" },
            { agent: "pm", status: "Blocked" },
            { agent: "researcher", status: "Blocked" },
            { agent: "design-auditor", status: "In_Progress" },
        ]],
    ["researcher:Blocked", [
            { agent: "researcher", status: "In_Progress" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["design-auditor:In_Progress", [
            { agent: "pm", status: "In_Progress" },
            { agent: "design-auditor", status: "Blocked" },
        ]],
    ["design-auditor:Blocked", [
            { agent: "design-auditor", status: "In_Progress" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["pm:In_Progress", [
            { agent: "architect", status: "In_Progress" },
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "researcher", status: "In_Progress" },
            { agent: "design-auditor", status: "In_Progress" },
            { agent: "pm", status: "Blocked" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["pm:Blocked", [
            { agent: "pm", status: "In_Progress" },
            { agent: "pm", status: "Blocked" },
        ]],
    ["architect:In_Progress", [
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "architect", status: "Blocked" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["architect:Blocked", [
            { agent: "pm", status: "In_Progress" },
            { agent: "architect", status: "In_Progress" },
        ]],
    ["sr-engineer:In_Progress", [
            { agent: "qa-engineer", status: "In_Progress" },
            { agent: "sr-engineer", status: "Blocked" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["sr-engineer:Blocked", [
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["qa-engineer:In_Progress", [
            { agent: "qa-engineer", status: "PASS" },
            { agent: "qa-engineer", status: "FAIL" },
            { agent: "qa-engineer", status: "Blocked" },
        ]],
    ["qa-engineer:Blocked", [
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "qa-engineer", status: "In_Progress" },
        ]],
    ["qa-engineer:FAIL", [
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["qa-engineer:PASS", [
            { agent: "pm", status: "In_Progress" },
            { agent: "researcher", status: "In_Progress" },
        ]],
]);
export const ALLOWED_TRANSITIONS = ALLOWED;
const ROUND_CAP = 4;
function isStatus(s) {
    return s === "In_Progress" || s === "PASS" || s === "FAIL" || s === "Blocked";
}
function isAgent(a) {
    return a === "pm" || a === "researcher" || a === "design-auditor" || a === "architect" || a === "sr-engineer" || a === "qa-engineer";
}
function rejection(req, error, allowed, hint) {
    return {
        error,
        attempted: {
            prev_agent: req.prev.agent,
            prev_status: req.prev.status,
            new_agent: req.next.agent,
            new_status: req.next.status,
            qa_round: req.prev_qa_round,
        },
        allowed: allowed.map((c) => ({ new_agent: c.agent, new_status: c.status })),
        hint,
    };
}
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
export function validateTransition(req) {
    // 1. agent_id required
    if (req.next.agent === null) {
        return rejection(req, "AGENT_ID_REQUIRED", [], "All state writes must declare agent_id.");
    }
    if (!isAgent(req.next.agent)) {
        return rejection(req, "AGENT_ID_REQUIRED", [], `Unknown agent_id "${req.next.agent}".`);
    }
    if (!isStatus(req.next.status)) {
        return rejection(req, "TRANSITION_REJECTED", [], `Unknown status "${req.next.status}".`);
    }
    // 2. round-cap override
    if (req.prev_qa_round >= ROUND_CAP) {
        const onlyAllowed = [{ agent: "pm", status: "In_Progress" }];
        const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
        if (ok)
            return null;
        return rejection(req, "QA_ROUND_EXCEEDED", onlyAllowed, `qa_round=${req.prev_qa_round} exceeds cap. Only (pm, In_Progress) allowed to reset.`);
    }
    // 3. self-loop fast path
    if (req.prev.agent !== null &&
        req.prev.agent === req.next.agent &&
        req.prev.status === "In_Progress" &&
        req.next.status === "In_Progress") {
        return null;
    }
    // 4. table lookup
    const key = keyOf(req.prev);
    const allowed = ALLOWED.get(key) ?? [];
    const accepted = allowed.some((c) => c.agent === req.next.agent && c.status === req.next.status);
    if (accepted)
        return null;
    return rejection(req, "TRANSITION_REJECTED", allowed, `No edge ${key} → ${keyOf(req.next)} in ALLOWED_TRANSITIONS. See specs/qa-flow-enforcement-architecture.md.`);
}
/**
 * Compute the new qa_round from prior round + incoming tuple.
 *   - (qa-engineer, FAIL)         → prev + 1
 *   - (qa-engineer, PASS)         → 0
 *   - (pm, In_Progress)            → 0  (PM re-entry resets the counter)
 *   - everything else              → prev (hold steady)
 */
export function computeNewRound(prev_qa_round, next) {
    if (next.agent === "qa-engineer" && next.status === "FAIL")
        return prev_qa_round + 1;
    if (next.agent === "qa-engineer" && next.status === "PASS")
        return 0;
    if (next.agent === "pm" && next.status === "In_Progress")
        return 0;
    return prev_qa_round;
}
export const ROUND_CAP_EXPORTED = ROUND_CAP;
//# sourceMappingURL=transitions.js.map
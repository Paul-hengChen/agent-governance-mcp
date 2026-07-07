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
            { agent: "code-reviewer", status: "In_Progress" },
            { agent: "sr-engineer", status: "Blocked" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["sr-engineer:Blocked", [
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["code-reviewer:In_Progress", [
            { agent: "code-reviewer", status: "FAIL" },
            { agent: "code-reviewer", status: "Blocked" },
            { agent: "qa-engineer", status: "In_Progress" },
        ]],
    ["code-reviewer:FAIL", [
            { agent: "sr-engineer", status: "In_Progress" },
            { agent: "pm", status: "In_Progress" },
        ]],
    ["code-reviewer:Blocked", [
            { agent: "code-reviewer", status: "In_Progress" },
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
    ["release-engineer:PASS", [
            { agent: "pm", status: "In_Progress" },
            { agent: "researcher", status: "In_Progress" },
        ]],
]);
export const ALLOWED_TRANSITIONS = ALLOWED;
const ROUND_CAP = 4;
const REVIEW_ROUND_CAP = 4;
// v3.14.0 — visual_round caps at 6 (5 failed pixel iterations then lock to
// pm) — symmetric to ROUND_CAP=4 (3 fails then Round 4 lock). Constitution
// §3.1 documents the user-visible "5 rounds" framing; cap=6 reflects the
// off-by-one between "rounds completed" and "next write index".
const VISUAL_ROUND_CAP = 6;
function isStatus(s) {
    return s === "In_Progress" || s === "PASS" || s === "FAIL" || s === "Blocked";
}
function isAgent(a) {
    return (a === "pm" ||
        a === "researcher" ||
        a === "design-auditor" ||
        a === "architect" ||
        a === "sr-engineer" ||
        a === "code-reviewer" ||
        a === "qa-engineer" ||
        a === "release-engineer");
}
// Amend-Resume Edge (C1). Pure, fs-free. Returns true iff `notes` contains a
// single trimmed entry exactly equal to `resume_of: <target>`. Trust class of
// scope_decision_why: client-attested, not server-verified.
function resumeMarkerNames(notes, target) {
    if (!notes)
        return false;
    const want = `resume_of: ${target}`;
    return notes.some((n) => typeof n === "string" && n.trim() === want);
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
            ...(req.prev_visual_round !== undefined && { visual_round: req.prev_visual_round }),
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
 *   3.5 Amend-Resume Edge (C1): pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress
 *       iff next_pending_notes self-attests `resume_of: <that exact role>`
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
    if (req.prev_review_round >= REVIEW_ROUND_CAP) {
        const onlyAllowed = [{ agent: "pm", status: "In_Progress" }];
        const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
        if (ok)
            return null;
        return rejection(req, "REVIEW_ROUND_EXCEEDED", onlyAllowed, `review_round=${req.prev_review_round} exceeds cap. Only (pm, In_Progress) allowed to reset.`);
    }
    // v3.14.0 — visual_round cap. Symmetric to qa_round / review_round.
    // Only fires when prev_visual_round is provided AND has reached cap; the
    // counter is opt-in for callers that pre-date v3.14.0.
    const prev_visual_round = req.prev_visual_round ?? 0;
    if (prev_visual_round >= VISUAL_ROUND_CAP) {
        const onlyAllowed = [{ agent: "pm", status: "In_Progress" }];
        const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
        if (ok)
            return null;
        return rejection(req, "VISUAL_ROUND_EXCEEDED", onlyAllowed, `visual_round=${prev_visual_round} exceeds cap. Only (pm, In_Progress) allowed for pixel/widget rebudget.`);
    }
    // 3. self-loop fast path
    if (req.prev.agent !== null &&
        req.prev.agent === req.next.agent &&
        req.prev.status === "In_Progress" &&
        req.next.status === "In_Progress") {
        return null;
    }
    // 3.5 Amend-Resume Edge (C1). Additive: opens pm:In_Progress →
    // {code-reviewer,qa-engineer}:In_Progress ONLY when the incoming write
    // self-attests `resume_of: <that exact role>` in pending_notes. The static
    // table has no such entry, so absent/mismatched markers fall through to the
    // unchanged TRANSITION_REJECTED. "Was actually stranded" is PM-attested (SOP);
    // the server checks only marker⟺target consistency. Pure (reads only
    // prev/next/pending_notes) — no fs, no schema field, works in every storage mode.
    if (req.prev.agent === "pm" &&
        req.prev.status === "In_Progress" &&
        req.next.status === "In_Progress" &&
        (req.next.agent === "code-reviewer" || req.next.agent === "qa-engineer") &&
        resumeMarkerNames(req.next_pending_notes, req.next.agent)) {
        return null; // accept
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
 * Compute new round counters from prior counters + incoming tuple + prev tuple.
 * Returns qa_round, review_round AND visual_round (v3.14.0) so callers can
 * persist them together.
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
 *
 * visual_round (v3.14.0):
 *   - (qa-engineer, FAIL) AND pending_notes contains `visual_fail:` → prev + 1
 *     (distinguishes pixel/widget drift from test-logic FAIL; only the former
 *     ticks the visual counter)
 *   - (qa-engineer, PASS)         → 0
 *   - (pm, In_Progress)           → 0
 *   - everything else             → prev_visual_round
 */
export function computeNewRound(prev_qa_round, prev_review_round, prev_visual_round, next, prev, next_pending_notes) {
    let qa_round = prev_qa_round;
    let review_round = prev_review_round;
    let visual_round = prev_visual_round;
    if (next.agent === "qa-engineer" && next.status === "FAIL")
        qa_round = prev_qa_round + 1;
    else if (next.agent === "qa-engineer" && next.status === "PASS")
        qa_round = 0;
    else if (next.agent === "pm" && next.status === "In_Progress")
        qa_round = 0;
    if (next.agent === "code-reviewer" && next.status === "FAIL")
        review_round = prev_review_round + 1;
    else if (next.agent === "qa-engineer" &&
        next.status === "In_Progress" &&
        prev?.agent === "code-reviewer" &&
        prev.status === "In_Progress") {
        review_round = 0;
    }
    else if (next.agent === "pm" && next.status === "In_Progress") {
        review_round = 0;
    }
    // v3.14.0 visual_round logic. Only ticks on qa-engineer FAIL accompanied by
    // a `visual_fail:` token in pending_notes; pure test-logic FAILs leave the
    // counter untouched.
    const hasVisualFailToken = Array.isArray(next_pending_notes) &&
        next_pending_notes.some((n) => typeof n === "string" && n.trim().startsWith("visual_fail:"));
    if (next.agent === "qa-engineer" && next.status === "FAIL" && hasVisualFailToken) {
        visual_round = prev_visual_round + 1;
    }
    else if (next.agent === "qa-engineer" && next.status === "PASS") {
        visual_round = 0;
    }
    else if (next.agent === "pm" && next.status === "In_Progress") {
        visual_round = 0;
    }
    return { qa_round, review_round, visual_round };
}
export const ROUND_CAP_EXPORTED = ROUND_CAP;
export const REVIEW_ROUND_CAP_EXPORTED = REVIEW_ROUND_CAP;
export const VISUAL_ROUND_CAP_EXPORTED = VISUAL_ROUND_CAP;
//# sourceMappingURL=transitions.js.map
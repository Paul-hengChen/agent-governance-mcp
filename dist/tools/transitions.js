// Coded by @sr-engineer
// Pure state-machine logic for routing-chain enforcement.
// See specs/qa-flow-enforcement-architecture.md §ALLOWED_TRANSITIONS for the
// authoritative matrix. Any change here MUST be mirrored in the design doc.
import { gate } from "../gates/registry.js";
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
            // v3.49.0 (C13) — release-engineer's legal opening write. Closes the
            // wedge where post-PASS release work had no entry edge and subagents
            // fell back to mis-stamping agent_id="pm" or hand-editing handoff.md.
            { agent: "release-engineer", status: "In_Progress" },
        ]],
    // v3.49.0 (C13) — release-engineer's legal closing write. Hands back to pm
    // ONLY (its SOP routes nowhere else); same-agent multi-step progress is
    // covered by the generic self-loop fast path in validateTransition.
    ["release-engineer:In_Progress", [
            { agent: "pm", status: "In_Progress" },
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
// v9 (d2-server-brake-accounting) — const-01 Limits: `hop` cap — max
// auto-routing role transitions per feature. Unlike the three round caps
// above, hop_count is feature-scoped: it resets ONLY on active_feature
// change, never on PM re-entry (DR-6), so after the gate fires autonomous
// dispatch stays frozen at the (pm, In_Progress) landing until a human
// re-scopes into a new feature.
const HOP_CAP = 10;
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
 *   2.5 hop-cap override (v9: hop_count >= 10 on a counted role transition →
 *       only the (pm, In_Progress) landing; landing does NOT reset the count)
 *   3. self-loop fast path on same-agent In_Progress→In_Progress
 *   3.5 Amend-Resume Edge (C1): pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress
 *       iff the structured next_resume_of field names that exact role (v7)
 *   4. table lookup
 */
export function validateTransition(req) {
    // 1. agent_id required
    if (req.next.agent === null) {
        return rejection(req, "AGENT_ID_REQUIRED", [], gate("AGENT_ID_REQUIRED").hintStatic);
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
        return rejection(req, "QA_ROUND_EXCEEDED", onlyAllowed, `qa_round=${req.prev_qa_round}${gate("QA_ROUND_EXCEEDED").hintStatic}`);
    }
    if (req.prev_review_round >= REVIEW_ROUND_CAP) {
        const onlyAllowed = [{ agent: "pm", status: "In_Progress" }];
        const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
        if (ok)
            return null;
        return rejection(req, "REVIEW_ROUND_EXCEEDED", onlyAllowed, `review_round=${req.prev_review_round}${gate("REVIEW_ROUND_EXCEEDED").hintStatic}`);
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
        return rejection(req, "VISUAL_ROUND_EXCEEDED", onlyAllowed, `visual_round=${prev_visual_round}${gate("VISUAL_ROUND_EXCEEDED").hintStatic}`);
    }
    // 2.5 hop-cap override (v9, d2-server-brake-accounting). Fourth round-style
    // override — AFTER the qa/review/visual overrides (so their outputs stay
    // byte-identical, AC-8) and BEFORE the self-loop fast path. Fires only when
    // the feature's persisted hop_count is already at/over HOP_CAP AND the
    // incoming write is a counted role transition (next.agent !== prev.agent,
    // DR-9 — self-loops and same-agent status changes are NOT role transitions,
    // so they fall through and are never hop-blocked) AND it is not the
    // (pm, In_Progress) landing edge. A feature change resets the count (AC-3),
    // so feature_changed=true bypasses the gate. The landing write does NOT
    // reset hop_count (DR-6) — only an active_feature change does.
    const prev_hop_count = req.prev_hop_count ?? 0;
    if (!req.feature_changed &&
        prev_hop_count >= HOP_CAP &&
        req.next.agent !== req.prev.agent &&
        !(req.next.agent === "pm" && req.next.status === "In_Progress")) {
        const onlyAllowed = [{ agent: "pm", status: "In_Progress" }];
        return rejection(req, "HOP_CAP_EXCEEDED", onlyAllowed, `hop_count=${prev_hop_count}${gate("HOP_CAP_EXCEEDED").hintStatic}`);
    }
    // 3. self-loop fast path
    if (req.prev.agent !== null &&
        req.prev.agent === req.next.agent &&
        req.prev.status === "In_Progress" &&
        req.next.status === "In_Progress") {
        return null;
    }
    // 3.5 Amend-Resume Edge (C1, rewired by c9-protocol-fields AC-4). Additive:
    // opens pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress ONLY when
    // the incoming write's structured resume_of field (threaded here as
    // next_resume_of by the orchestrator) names that exact role. The static
    // table has no such entry, so absent/mismatched fields fall through to the
    // unchanged TRANSITION_REJECTED. Legacy `resume_of: <role>` pending_notes
    // lines are INERT (DR-2 — not honored, not rejected). "Was actually
    // stranded" is PM-attested (SOP, trust class of scope_decision_why); the
    // server checks only field⟺target consistency. Pure (reads only
    // prev/next/next_resume_of) — no fs, storage-agnostic.
    if (req.prev.agent === "pm" &&
        req.prev.status === "In_Progress" &&
        req.next.status === "In_Progress" &&
        (req.next.agent === "code-reviewer" || req.next.agent === "qa-engineer") &&
        req.next_resume_of === req.next.agent) {
        return null; // accept
    }
    // 4. table lookup
    const key = keyOf(req.prev);
    const allowed = ALLOWED.get(key) ?? [];
    const accepted = allowed.some((c) => c.agent === req.next.agent && c.status === req.next.status);
    if (accepted)
        return null;
    return rejection(req, "TRANSITION_REJECTED", allowed, `No edge ${key} → ${keyOf(req.next)}${gate("TRANSITION_REJECTED").hintStatic}`);
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
 *
 * hop_count (v9, d2-server-brake-accounting):
 *   - feature_changed             → base resets to 0 (AC-3; the ONLY reset —
 *     (pm, In_Progress) does NOT reset it, unlike the three rounds — DR-6)
 *   - role transition (next.agent !== prev.agent) → base + 1 (DR-9)
 *   - everything else (self-loops, same-agent status changes) → base
 *
 * qa_rounds_total / review_rounds_total / visual_rounds_total (v12,
 * e8-success-telemetry): cumulative mirrors of the per-cycle counters. Each
 * total ticks in lock-step with its per-cycle counter's FAIL branch (the FAIL
 * predicates are copied verbatim so total and cycle counters can never diverge
 * on which event counts), but NEVER resets except on feature change — NOT on
 * QA PASS, NOT on (pm, In_Progress) re-entry (hop_count's reset rule, AC8).
 */
export function computeNewRound(prev_qa_round, prev_review_round, prev_visual_round, next, prev, next_pending_notes, prev_hop_count = 0, feature_changed = false, prev_qa_rounds_total = 0, prev_review_rounds_total = 0, prev_visual_rounds_total = 0) {
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
    // v9 hop_count logic (DR-6/DR-9). Feature change resets the base; a counted
    // role transition (next.agent !== prev.agent, including the very first write
    // where prev.agent is null) increments it; self-loops and same-agent status
    // changes carry it forward unchanged. The (pm, In_Progress) landing after a
    // HOP_CAP_EXCEEDED fire is itself a role transition and increments — it does
    // NOT reset (only active_feature change resets).
    const isRoleTransition = !!next.agent && next.agent !== (prev?.agent ?? null);
    const hopBase = feature_changed ? 0 : prev_hop_count;
    const hop_count = isRoleTransition ? hopBase + 1 : hopBase;
    // v12 cumulative totals (e8-success-telemetry). Base is
    // `feature_changed ? 0 : prev_total` (hop_count's reset rule); each FAIL
    // predicate is copied verbatim from the per-cycle branches above
    // (qa_round / review_round / visual_round) so the two families can never
    // diverge on which event counts.
    const qaTotBase = feature_changed ? 0 : prev_qa_rounds_total;
    const qa_rounds_total = next.agent === "qa-engineer" && next.status === "FAIL" ? qaTotBase + 1 : qaTotBase;
    const revTotBase = feature_changed ? 0 : prev_review_rounds_total;
    const review_rounds_total = next.agent === "code-reviewer" && next.status === "FAIL" ? revTotBase + 1 : revTotBase;
    const visTotBase = feature_changed ? 0 : prev_visual_rounds_total;
    const visual_rounds_total = next.agent === "qa-engineer" && next.status === "FAIL" && hasVisualFailToken
        ? visTotBase + 1
        : visTotBase;
    return {
        qa_round,
        review_round,
        visual_round,
        hop_count,
        qa_rounds_total,
        review_rounds_total,
        visual_rounds_total,
    };
}
export const ROUND_CAP_EXPORTED = ROUND_CAP;
export const REVIEW_ROUND_CAP_EXPORTED = REVIEW_ROUND_CAP;
export const VISUAL_ROUND_CAP_EXPORTED = VISUAL_ROUND_CAP;
// v9 (d2-server-brake-accounting) — consumed by the T-D2-01B orchestrator
// sentinel (hop-cap-cross pending note) and by tests.
export const HOP_CAP_EXPORTED = HOP_CAP;
//# sourceMappingURL=transitions.js.map
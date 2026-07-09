// Coded by @sr-engineer
// Pure state-machine logic for routing-chain enforcement.
// See specs/qa-flow-enforcement-architecture.md §ALLOWED_TRANSITIONS for the
// authoritative matrix. Any change here MUST be mirrored in the design doc.

import { gate } from "../gates/registry.js";

export type AgentName =
  | "pm"
  | "researcher"
  | "design-auditor"
  | "architect"
  | "sr-engineer"
  | "code-reviewer"
  | "qa-engineer"
  | "release-engineer";

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
  // v3.14.0 — pixel-fidelity sub-loop counter. Caller defaults to 0 if absent
  // for backwards-compat with pre-v3.14 callers (handoff schema v2).
  prev_visual_round?: number;
  // v7 (c9-protocol-fields, AC-4) — structured Amend-Resume declaration from
  // the incoming write (parsed.resume_of at the orchestrator). Replaces the
  // former next_pending_notes substring grep (`resume_of: <target>` line),
  // which was removed with no fallback — legacy pending_notes tokens are
  // inert (DR-2/DR-6). computeNewRound still takes pending_notes as its own
  // separate parameter for the visual_fail: check; that path is unrelated.
  next_resume_of?: "code-reviewer" | "qa-engineer";
}

export interface TransitionRejection {
  error:
    | "TRANSITION_REJECTED"
    | "QA_ROUND_EXCEEDED"
    | "REVIEW_ROUND_EXCEEDED"
    | "VISUAL_ROUND_EXCEEDED"
    | "VISUAL_WIDGETS_UNVERIFIED"   // v3.15.0 — emitted by index.ts handler when
                                    // qa_reports/visual_<id>.md contains unchecked
                                    // `## Widget Shape Verification` rows. NOT produced
                                    // by validateTransition; the union extension is for
                                    // handler-side type narrowing + envelope consistency.
    | "VISUAL_BASELINES_REQUIRED"   // v3.16.0 — emitted by index.ts PASS gate when
                                    // design mode != no-design but ## Visual Baselines
                                    // is absent. NOT produced by validateTransition;
                                    // union extension is for handler-side narrowing +
                                    // envelope consistency (mirrors VISUAL_WIDGETS_UNVERIFIED).
    | "VISUAL_REPORT_INCOMPLETE"    // v3.26.0 — emitted by index.ts PASS gate when the
                                    // design declares ## Visual Structural Assertions but
                                    // qa_reports/visual_<id>.md is missing a required
                                    // section, has a failed/unverified canonical-state or
                                    // structural-assertion row, or lacks a PASS verdict.
                                    // Handler-side only (like the two above).
    | "VISUAL_ASSERTIONS_REQUIRED"  // v3.27.0 — emitted by index.ts PASS gate when the
                                    // visual gate is armed (mode != no-design) but the design
                                    // omits ## Visual Structural Assertions. Hard error, not a
                                    // silent fallback (Codex review #3). Handler-side only.
    | "SCOPE_DECISION_REQUIRED"     // v3.30.0 — emitted by the index.ts tw_update_state guard at the
                                    // pm → {architect,sr-engineer}:In_Progress edge when the design is
                                    // armed (mode != no-design) but neither .current/feature-split.md
                                    // nor handoff scope_decision === "single-feature" is present. NOT
                                    // produced by validateTransition (it reads fs + handoff state);
                                    // union extension is for handler-side narrowing + envelope
                                    // consistency (mirrors VISUAL_BASELINES_REQUIRED).
    | "PIXEL_GATE_ATTESTATION_MISSING" // v3.42.0 — emitted by the index.ts PASS gate (seventh
                                    // visual sub-gate) when an armed, provenance-bearing visual
                                    // report has a non-carry-forward surface lacking
                                    // `pixel_gate_complete: true`. NOT produced by
                                    // validateTransition; union extension is for handler-side
                                    // narrowing + envelope consistency (mirrors VISUAL_BASELINES_REQUIRED).
    | "CUT_APPROVAL_REQUIRED"       // v5 — emitted by the index.ts tw_update_state guard at the
                                    // pm → {architect,sr-engineer}:In_Progress edge when the prev
                                    // handoff state lacks cut_approved === true. Unconditional (not
                                    // arm-gated); file-storage mode only. NOT produced by
                                    // validateTransition (it reads handoff state + storage kind);
                                    // union extension is for handler-side narrowing + envelope
                                    // consistency (mirrors SCOPE_DECISION_REQUIRED).
    | "EXTERNAL_REFS_UNRESOLVED"    // v6 — emitted by the handoff-orchestrator gate at the
                                    // pm → {architect,sr-engineer}:In_Progress edge when the prev
                                    // handoff state carries >=1 external_refs entry with
                                    // state === "unresolved". Unconditional (not arm-gated);
                                    // file-storage mode only. NOT produced by validateTransition
                                    // (it reads handoff state + storage kind); union extension is
                                    // for handler-side narrowing + envelope consistency (mirrors
                                    // CUT_APPROVAL_REQUIRED).
    | "AGENT_ID_REQUIRED";
  attempted: {
    prev_agent: string | null;
    prev_status: string | null;
    new_agent: string | null;
    new_status: string | null;
    qa_round: number;
    visual_round?: number;
  };
  allowed: Array<{ new_agent: AgentName; new_status: StatusName }>;
  hint: string;
}

// ----- agent-id helper (shared with handler-side defense) -----

export function requireQaEngineer(
  agentId: string | undefined,
  toolName: string,
): AgentGateResult {
  if (agentId === "qa-engineer") return { ok: true };
  const who = agentId ? `"${agentId}"` : "unidentified agent (agent_id not set)";
  return {
    ok: false,
    message:
      `⛔ BLOCKED: ${toolName} is reserved for qa-engineer. Called by ${who}. ` +
      `Hand off to qa-engineer and pass agent_id="qa-engineer".`,
  };
}

// ----- transition matrix -----

type AllowedNext = ReadonlyArray<{ agent: AgentName; status: StatusName }>;

function keyOf(t: TransitionTuple): string {
  return `${t.agent ?? "null"}:${t.status ?? "null"}`;
}

const ALLOWED: ReadonlyMap<string, AllowedNext> = new Map<string, AllowedNext>([
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

function isStatus(s: string | null): s is StatusName {
  return s === "In_Progress" || s === "PASS" || s === "FAIL" || s === "Blocked";
}

function isAgent(a: string | null): a is AgentName {
  return (
    a === "pm" ||
    a === "researcher" ||
    a === "design-auditor" ||
    a === "architect" ||
    a === "sr-engineer" ||
    a === "code-reviewer" ||
    a === "qa-engineer" ||
    a === "release-engineer"
  );
}

function rejection(
  req: TransitionRequest,
  error: TransitionRejection["error"],
  allowed: AllowedNext,
  hint: string,
): TransitionRejection {
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
 *       iff the structured next_resume_of field names that exact role (v7)
 *   4. table lookup
 */
export function validateTransition(req: TransitionRequest): TransitionRejection | null {
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
    const onlyAllowed: AllowedNext = [{ agent: "pm", status: "In_Progress" }];
    const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
    if (ok) return null;
    return rejection(
      req,
      "QA_ROUND_EXCEEDED",
      onlyAllowed,
      `qa_round=${req.prev_qa_round}${gate("QA_ROUND_EXCEEDED").hintStatic}`,
    );
  }
  if (req.prev_review_round >= REVIEW_ROUND_CAP) {
    const onlyAllowed: AllowedNext = [{ agent: "pm", status: "In_Progress" }];
    const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
    if (ok) return null;
    return rejection(
      req,
      "REVIEW_ROUND_EXCEEDED",
      onlyAllowed,
      `review_round=${req.prev_review_round}${gate("REVIEW_ROUND_EXCEEDED").hintStatic}`,
    );
  }
  // v3.14.0 — visual_round cap. Symmetric to qa_round / review_round.
  // Only fires when prev_visual_round is provided AND has reached cap; the
  // counter is opt-in for callers that pre-date v3.14.0.
  const prev_visual_round = req.prev_visual_round ?? 0;
  if (prev_visual_round >= VISUAL_ROUND_CAP) {
    const onlyAllowed: AllowedNext = [{ agent: "pm", status: "In_Progress" }];
    const ok = req.next.agent === "pm" && req.next.status === "In_Progress";
    if (ok) return null;
    return rejection(
      req,
      "VISUAL_ROUND_EXCEEDED",
      onlyAllowed,
      `visual_round=${prev_visual_round}${gate("VISUAL_ROUND_EXCEEDED").hintStatic}`,
    );
  }

  // 3. self-loop fast path
  if (
    req.prev.agent !== null &&
    req.prev.agent === req.next.agent &&
    req.prev.status === "In_Progress" &&
    req.next.status === "In_Progress"
  ) {
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
  if (
    req.prev.agent === "pm" &&
    req.prev.status === "In_Progress" &&
    req.next.status === "In_Progress" &&
    (req.next.agent === "code-reviewer" || req.next.agent === "qa-engineer") &&
    req.next_resume_of === req.next.agent
  ) {
    return null; // accept
  }

  // 4. table lookup
  const key = keyOf(req.prev);
  const allowed = ALLOWED.get(key) ?? [];
  const accepted = allowed.some((c) => c.agent === req.next.agent && c.status === req.next.status);
  if (accepted) return null;
  return rejection(
    req,
    "TRANSITION_REJECTED",
    allowed,
    `No edge ${key} → ${keyOf(req.next)}${gate("TRANSITION_REJECTED").hintStatic}`,
  );
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
export function computeNewRound(
  prev_qa_round: number,
  prev_review_round: number,
  prev_visual_round: number,
  next: TransitionTuple,
  prev?: TransitionTuple,
  next_pending_notes?: ReadonlyArray<string>,
): { qa_round: number; review_round: number; visual_round: number } {
  let qa_round = prev_qa_round;
  let review_round = prev_review_round;
  let visual_round = prev_visual_round;
  if (next.agent === "qa-engineer" && next.status === "FAIL") qa_round = prev_qa_round + 1;
  else if (next.agent === "qa-engineer" && next.status === "PASS") qa_round = 0;
  else if (next.agent === "pm" && next.status === "In_Progress") qa_round = 0;

  if (next.agent === "code-reviewer" && next.status === "FAIL") review_round = prev_review_round + 1;
  else if (
    next.agent === "qa-engineer" &&
    next.status === "In_Progress" &&
    prev?.agent === "code-reviewer" &&
    prev.status === "In_Progress"
  ) {
    review_round = 0;
  } else if (next.agent === "pm" && next.status === "In_Progress") {
    review_round = 0;
  }

  // v3.14.0 visual_round logic. Only ticks on qa-engineer FAIL accompanied by
  // a `visual_fail:` token in pending_notes; pure test-logic FAILs leave the
  // counter untouched.
  const hasVisualFailToken =
    Array.isArray(next_pending_notes) &&
    next_pending_notes.some((n) => typeof n === "string" && n.trim().startsWith("visual_fail:"));
  if (next.agent === "qa-engineer" && next.status === "FAIL" && hasVisualFailToken) {
    visual_round = prev_visual_round + 1;
  } else if (next.agent === "qa-engineer" && next.status === "PASS") {
    visual_round = 0;
  } else if (next.agent === "pm" && next.status === "In_Progress") {
    visual_round = 0;
  }
  return { qa_round, review_round, visual_round };
}

export const ROUND_CAP_EXPORTED = ROUND_CAP;
export const REVIEW_ROUND_CAP_EXPORTED = REVIEW_ROUND_CAP;
export const VISUAL_ROUND_CAP_EXPORTED = VISUAL_ROUND_CAP;

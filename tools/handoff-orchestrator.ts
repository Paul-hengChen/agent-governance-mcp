// Coded by @sr-engineer
// tw_update_state gate-policy orchestration. The handoff read/write path and
// its lock → freshness → atomic write contract live in tools/handoff.ts.
// The check order is frozen and additive: UPDATE_STATE_GATE_PIPELINE below is
// the order, and a test pins it. Insert new checks; never reorder or merge.
// Do not re-indent gate bodies: some tests pin their exact byte shape.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-orchestrator.ts — check order".

import type { ToolResult, UpdateStateInput, WorkspaceOnlyInput } from "./registry.js";
import { enforcePreFlight } from "../guards/session.js";
import { getActiveStorage, FileHandoffStorage } from "./storage.js";
import {
  requireQaEngineer,
  validateTransition,
  computeNewRound,
  ALLOWED_TRANSITIONS,
  HOP_CAP_EXPORTED,
  type AgentName,
  type StatusName,
  type TransitionTuple,
} from "./transitions.js";
import {
  hasVisualBaselinesInDesign,
  hasVisualEvidenceInFile,
  visualEvidencePath,
  hasUncheckedWidgets,
  hasDesignModeRequiringVisual,
  designDeclaresStructuralAssertions,
  validateVisualReports,
  checkVisualProvenance,
  checkBaselineManifest,
  checkPixelGateAttestation,
  checkSourceCredibility,
} from "../gates/visual.js";
import { hasScopeDecision } from "../gates/scope-decision.js";
import { isFeatureLeaseHeld } from "../gates/feature-lease.js";
import { hasExpectedRedManifest, hasExpectedRedDisposition } from "../gates/expected-red.js";
import { hasProofAnnotatedAC, hasAcExecutionLogDisposition } from "../gates/ac-execution.js";
import { hasCutApproval } from "../gates/cut-approval.js";
import { EVIDENCE_SCHEMA_CURRENT } from "../gates/evidence-schema.js";
import { classifyLeaseOverride } from "../gates/lease-override.js";
import { isHandAuthoredStamp, hasStampRemediationAudit } from "../gates/stamp-provenance.js";
import { hasEvidenceInFile, qaEvidencePath } from "../gates/qa-review.js";
import { hasUnresolvedRefs, listUnresolvedRefs } from "../gates/external-refs.js";
import { gate, TRANSITION_GATE_CODES } from "../gates/registry.js";
import { awaitAllInflightFor } from "./rag-coalesce.js";
import { emitGateTelemetry, extractGateCodeFromText } from "./telemetry.js";
import { emitFeatureMetrics } from "./metrics.js";
import { appendDispatchRecord } from "./dispatch-log.js";
import {
  runUpdateStatePipeline,
  type UpdateStateGateContext,
  type UpdateStateGateStep,
} from "../gates/pipeline.js";

// ==========================================
// tw_get_state tool handler. Lives next to its sibling handleUpdateState
// because both are MCP tool handlers for the same handoff.md surface (read
// vs. write); they are not part of the parse/write library code that
// tools/handoff.ts re-exports. registry.ts imports both from this module.
// ==========================================

// --- No guard: reading state IS the pre-flight check ---
export async function handleGetState(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const { workspace_path } = args;
  const result = getActiveStorage().readState(workspace_path);
  return { content: [{ type: "text" as const, text: result }] };
}

// Feature-lease TTL: how long an unfinished feature keeps exclusive hold of
// the workspace before another feature may take over. A fixed constant, not
// a config knob (like STALE_DISPATCH_THRESHOLD_MIN in tools/handoff-parse.ts
// and HOP_CAP): expiring a stale lease is a safety self-heal, not policy.
// 30 min is deliberately longer than the 15-min dispatch-staleness
// threshold, because a whole feature legitimately has longer idle gaps than
// a single dispatch. Changing it needs a spec amendment. (E1)
const LEASE_TTL_MIN = 30;

// Thin telemetry wrapper: the one place every GATE_REGISTRY rejection is
// recorded, so the check-order body in handleUpdateStateCore stays free of
// telemetry code. emitGateTelemetry swallows its own errors, so a telemetry
// failure never changes or hides the returned ToolResult.
// enforcePreFlight's thrown session-guard exceptions propagate through
// unmodified — they are not a GateErrorCode. (D3)
export async function handleUpdateState(parsed: UpdateStateInput): Promise<ToolResult> {
  const result = await handleUpdateStateCore(parsed);
  if (result.isError) {
    const first = result.content[0];
    const text = first && first.type === "text" ? first.text : "";
    const errorCode = extractGateCodeFromText(text);
    if (errorCode) {
      emitGateTelemetry(parsed.workspace_path, errorCode, parsed.agent_id, parsed.active_feature);
    }
  }
  return result;
}

// The tw_update_state gate pipeline: this array IS the frozen, additive check
// order. Add a gate by inserting a step at its position, never by editing a
// neighbour's body. One step per gate family; the PASS-path visual sub-gates
// share derived state (armCheck/visualGate) and stay one step. The qa_review
// auto-record, the only side effect mid-sequence, keeps its own step.
export const UPDATE_STATE_GATE_PIPELINE: readonly UpdateStateGateStep[] = [
  {
    name: "TRANSITION_VALIDATION",
    codes: TRANSITION_GATE_CODES,
    run: (ctx) => {
      const { parsed, prevTuple, nextTuple, prev_qa_round, prev_review_round, prev_visual_round, prev_hop_count, feature_changed } = ctx;
        const rejection = validateTransition({
          prev: prevTuple,
          next: nextTuple,
          prev_qa_round,
          prev_review_round,
          prev_visual_round,
          // v7 (c9-protocol-fields AC-4) — structured Amend-Resume field.
          // Replaces the former next_pending_notes token grep; legacy
          // `resume_of: <role>` pending_notes lines are inert (DR-2).
          next_resume_of: parsed.resume_of,
          // v9 — hop-cap inputs (d2-server-brake-accounting). Arms the
          // HOP_CAP_EXCEEDED override: fires when the feature's persisted
          // hop_count is at/over cap on a counted role transition that is not
          // the (pm, In_Progress) landing; feature_changed=true bypasses.
          prev_hop_count,
          feature_changed,
        });
        if (rejection) {
          return {
            content: [{ type: "text" as const, text: `⛔ ${rejection.error}\n${JSON.stringify(rejection, null, 2)}` }],
            isError: true,
          };
        }
      return null;
    },
  },
  {
    name: "STAMP_PROVENANCE_SUSPECT",
    codes: ["STAMP_PROVENANCE_SUSPECT"],
    run: (ctx) => {
      const { parsed, storage, prevState } = ctx;
        // Stamp-provenance gate: when the on-disk last_updated looks hand-authored,
        // reject any write whose pending_notes[0] does not start with
        // "stamp-remediation:". Runs before the feature-lease gate, which trusts
        // last_updated. No prevState (a new workspace) means nothing to distrust.
        // Self-clearing: the accepted remediation write stamps a fresh now().
        // File mode only.
        // Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-orchestrator.ts — STAMP_PROVENANCE_SUSPECT".
        if (
          storage instanceof FileHandoffStorage &&
          prevState &&
          isHandAuthoredStamp(prevState.last_updated) &&
          !hasStampRemediationAudit(parsed)
        ) {
          const hint = gate("STAMP_PROVENANCE_SUSPECT").hintStatic;
          const envelope = {
            error: "STAMP_PROVENANCE_SUSPECT",
            attempted_feature: parsed.active_feature,
            incumbent: {
              active_feature: prevState.active_feature,
              status: prevState.status,
              last_updated: prevState.last_updated,
            },
            hint,
          };
          return {
            content: [{
              type: "text" as const,
              text: `⛔ STAMP_PROVENANCE_SUSPECT\n${JSON.stringify(envelope, null, 2)}`,
            }],
            isError: true,
          };
        }
      return null;
    },
  },
  {
    name: "FEATURE_LEASE",
    codes: ["FEATURE_LEASE_HELD", "LEASE_OVERRIDE_AUDIT_MISSING"],
    run: (ctx) => {
      const { parsed, storage, prevState, prevTuple, nextTuple } = ctx;
        // Feature-lease gate: reject a write with a different active_feature while
        // the incumbent feature is unfinished (status != PASS; Blocked still holds)
        // and fresh (last_updated within LEASE_TTL_MIN), so a workspace holds at
        // most one unfinished feature. Runs before the build-entry attestation
        // gates. pending_notes is passed only in file mode, on purpose.
        // Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-orchestrator.ts — FEATURE_LEASE".
        const leaseFields = prevState
          ? {
              active_feature: prevState.active_feature,
              status: prevState.status,
              last_updated: prevState.last_updated,
              last_agent: prevState.last_agent,
              next_role: prevState.next_role,
              // File mode only — undefined for SQLite/HTTP storage. (E13)
              pending_notes:
                storage instanceof FileHandoffStorage
                  ? prevState.pending_notes
                  : undefined,
            }
          : null;
        if (leaseFields && isFeatureLeaseHeld(leaseFields, parsed.active_feature, Date.now(), LEASE_TTL_MIN)) {
          // Human-attested lease override, file mode only (SQLite ignores
          // lease_override and falls through to the unchanged
          // FEATURE_LEASE_HELD reject). Read from the incoming tool args, so
          // it applies to this write only. The audit check lives inside this
          // lease-held branch on purpose: an override with nothing to bypass
          // does nothing, so an unaudited lease_override on an unheld lease is
          // never rejected. (E10)
          const leaseFileMode = storage instanceof FileHandoffStorage;
          const overrideClass = classifyLeaseOverride(parsed);
          if (leaseFileMode && overrideClass === "audited") {
            // BYPASS — fall through to the remaining gates; the lease-held
            // rejection is suppressed for THIS write only.
          } else if (leaseFileMode && overrideClass === "unaudited") {
            // AC2 — an unaudited bypass is rejected loud with its own code,
            // never silently accepted and never silently downgraded to the
            // plain FEATURE_LEASE_HELD envelope.
            const hint = gate("LEASE_OVERRIDE_AUDIT_MISSING").hintStatic;
            const envelope = {
              error: "LEASE_OVERRIDE_AUDIT_MISSING",
              attempted_feature: parsed.active_feature,
              incumbent: {
                active_feature: leaseFields.active_feature,
                status: leaseFields.status,
                last_updated: leaseFields.last_updated,
                lease_ttl_min: LEASE_TTL_MIN,
              },
              hint,
            };
            return {
              content: [{
                type: "text" as const,
                text: `⛔ LEASE_OVERRIDE_AUDIT_MISSING\n${JSON.stringify(envelope, null, 2)}`,
              }],
              isError: true,
            };
          } else {
            const hint =
              `Feature lease held by "${leaseFields.active_feature}" ` +
              `(status=${leaseFields.status}, last_updated=${leaseFields.last_updated}, ` +
              `TTL=${LEASE_TTL_MIN}min). ` +
              gate("FEATURE_LEASE_HELD").hintStatic;
            const envelope = {
              error: "FEATURE_LEASE_HELD",
              attempted: {
                prev_agent: prevTuple.agent,
                prev_status: prevTuple.status,
                new_agent: nextTuple.agent,
                new_status: nextTuple.status,
              },
              incumbent: {
                active_feature: leaseFields.active_feature,
                status: leaseFields.status,
                last_updated: leaseFields.last_updated,
                lease_ttl_min: LEASE_TTL_MIN,
              },
              attempted_feature: parsed.active_feature,
              hint,
            };
            return {
              content: [{
                type: "text" as const,
                text: `⛔ FEATURE_LEASE_HELD\n${JSON.stringify(envelope, null, 2)}`,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE",
    codes: ["BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE"],
    run: (ctx) => {
      const { parsed, storage, prevState, feature_changed } = ctx;
        // A bookkeeping_write must keep the same feature (file mode only; a fresh
        // workspace with no prevState passes). Rejected rather than downgraded to
        // a normal write: calling a new feature's first claim "bookkeeping" would
        // keep the old last_updated and make its lease look older than it is,
        // letting another feature take the slot.
        if (
          storage instanceof FileHandoffStorage &&
          parsed.bookkeeping_write === true &&
          prevState &&
          feature_changed
        ) {
          const hint = gate("BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE").hintStatic;
          const envelope = {
            error: "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE",
            attempted_feature: parsed.active_feature,
            incumbent: {
              active_feature: prevState.active_feature,
              status: prevState.status,
              last_updated: prevState.last_updated,
            },
            hint,
          };
          return {
            content: [{
              type: "text" as const,
              text: `⛔ BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE\n${JSON.stringify(envelope, null, 2)}`,
            }],
            isError: true,
          };
        }
      return null;
    },
  },
  {
    name: "SCOPE_DECISION_REQUIRED",
    codes: ["SCOPE_DECISION_REQUIRED"],
    run: (ctx) => {
      const { parsed, prevState, prevTuple, nextTuple } = ctx;
        // Scope-decision gate: on the build-entry edge (pm:In_Progress →
        // {architect,sr-engineer}:In_Progress), reject when the design is armed
        // (mode != no-design) and no scope decision is recorded. Pinning prev=pm
        // keeps re-entry safe: architect→sr-engineer and the sr-engineer
        // self-loop are never gated. Kept out of transitions.ts, which stays pure.
        if (
          (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
          nextTuple.status === "In_Progress" &&
          prevTuple.agent === "pm" &&
          prevTuple.status === "In_Progress"
        ) {
          const arm = hasDesignModeRequiringVisual(parsed.workspace_path, parsed.active_feature);
          if (arm.required && !hasScopeDecision(parsed.workspace_path, prevState)) {
            const hint = gate("SCOPE_DECISION_REQUIRED").hintStatic;
            const envelope = {
              error: "SCOPE_DECISION_REQUIRED",
              attempted: {
                prev_agent: prevTuple.agent,
                prev_status: prevTuple.status,
                new_agent: nextTuple.agent,
                new_status: nextTuple.status,
              },
              allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
                new_agent: c.agent,
                new_status: c.status,
              })),
              hint,
            };
            return {
              content: [{
                type: "text" as const,
                text: `⛔ SCOPE_DECISION_REQUIRED\n${JSON.stringify(envelope, null, 2)}`,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "CUT_APPROVAL_REQUIRED",
    codes: ["CUT_APPROVAL_REQUIRED"],
    run: (ctx) => {
      const { prevState, prevTuple, nextTuple } = ctx;
        // Cut-approval gate: same build-entry edge as the scope-decision gate, but
        // unconditional — a human approves the ticket cut before any build role
        // gets the handoff. Its own error code, not a merged envelope, so each
        // hint stays actionable. File mode only: cut_approved lives in the handoff
        // frontmatter, so under SQLite/HTTP the gate would always fire.
        if (
          getActiveStorage() instanceof FileHandoffStorage &&
          (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
          nextTuple.status === "In_Progress" &&
          prevTuple.agent === "pm" &&
          prevTuple.status === "In_Progress"
        ) {
          if (!hasCutApproval(prevState)) {
            const hint = gate("CUT_APPROVAL_REQUIRED").hintStatic;
            const envelope = {
              error: "CUT_APPROVAL_REQUIRED",
              attempted: {
                prev_agent: prevTuple.agent,
                prev_status: prevTuple.status,
                new_agent: nextTuple.agent,
                new_status: nextTuple.status,
              },
              allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
                new_agent: c.agent,
                new_status: c.status,
              })),
              hint,
            };
            return {
              content: [{
                type: "text" as const,
                text: `⛔ CUT_APPROVAL_REQUIRED\n${JSON.stringify(envelope, null, 2)}`,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "EXTERNAL_REFS_UNRESOLVED",
    codes: ["EXTERNAL_REFS_UNRESOLVED"],
    run: (ctx) => {
      const { prevState, prevTuple, nextTuple } = ctx;
        // External-refs gate: third attestation gate on the build-entry edge.
        // Fires only when prevState.external_refs has an entry with state
        // "unresolved"; absent or empty means PM's resource audit found none.
        // Pinning prev=pm keeps a ledger from an earlier PM write from
        // re-blocking later hops. File mode only: the ledger lives in the
        // handoff frontmatter.
        if (
          getActiveStorage() instanceof FileHandoffStorage &&
          (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
          nextTuple.status === "In_Progress" &&
          prevTuple.agent === "pm" &&
          prevTuple.status === "In_Progress"
        ) {
          if (hasUnresolvedRefs(prevState)) {
            const refs = listUnresolvedRefs(prevState).join(", ");
            const hint =
              `External reference(s) unresolved: ${refs}.` +
              gate("EXTERNAL_REFS_UNRESOLVED").hintStatic;
            const envelope = {
              error: "EXTERNAL_REFS_UNRESOLVED",
              attempted: {
                prev_agent: prevTuple.agent,
                prev_status: prevTuple.status,
                new_agent: nextTuple.agent,
                new_status: nextTuple.status,
              },
              allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
                new_agent: c.agent,
                new_status: c.status,
              })),
              hint,
            };
            return {
              content: [{
                type: "text" as const,
                text: `⛔ EXTERNAL_REFS_UNRESOLVED\n${JSON.stringify(envelope, null, 2)}`,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "SOURCE_CREDIBILITY_UNVERIFIED",
    codes: ["SOURCE_CREDIBILITY_UNVERIFIED"],
    run: (ctx) => {
      const { parsed, prevTuple, nextTuple } = ctx;
        // Source-Credibility Gate: the fourth build-entry attestation check on
        // the pm:In_Progress -> {architect,sr-engineer}:In_Progress edge, after
        // scope-decision / cut-approval / external-refs. Unlike those three
        // (file mode only, reading handoff YAML), it reads
        // design/<feature>.md directly via fs, so it works in every storage
        // mode — no `getActiveStorage() instanceof FileHandoffStorage` guard.
        // It arms on the fetch-based-mode inclusion list inside
        // checkSourceCredibility, not the broader
        // hasDesignModeRequiringVisual exclusion. Requiring prev=pm keeps
        // resume and re-entry safe: architect->sr-engineer and the sr
        // self-loop have a non-pm predecessor and are never gated. Kept out of
        // transitions.ts, which stays pure and fs-free (like
        // SCOPE_DECISION_REQUIRED). Independent of the PASS-time
        // baseline-manifest gates: different edge, different check. (E4)
        if (
          (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
          nextTuple.status === "In_Progress" &&
          prevTuple.agent === "pm" &&
          prevTuple.status === "In_Progress"
        ) {
          const cred = checkSourceCredibility(parsed.workspace_path, parsed.active_feature);
          if (!cred.ok) {
            const rows = cred.offendingRows.join(", ");
            const hint =
              `Source-credibility attestation missing or unverified for: ${rows}.` +
              gate("SOURCE_CREDIBILITY_UNVERIFIED").hintStatic;
            const envelope = {
              error: "SOURCE_CREDIBILITY_UNVERIFIED",
              attempted: {
                prev_agent: prevTuple.agent,
                prev_status: prevTuple.status,
                new_agent: nextTuple.agent,
                new_status: nextTuple.status,
              },
              allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
                new_agent: c.agent,
                new_status: c.status,
              })),
              hint,
            };
            return {
              content: [{
                type: "text" as const,
                text: `⛔ SOURCE_CREDIBILITY_UNVERIFIED\n${JSON.stringify(envelope, null, 2)}`,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "REPRO_MANIFEST_MISSING",
    codes: ["REPRO_MANIFEST_MISSING"],
    run: (ctx) => {
      const { parsed, storage, prevState, prevTuple, nextTuple } = ctx;
        // Repro-First Gate, bugfix mode only. On the fix-phase handoff
        // sr-engineer:In_Progress → code-reviewer:In_Progress, when the
        // feature is dispatch_mode="bugfix" but no repro manifest
        // (qa_reports/expected-red_<feature>.txt) exists, the write is
        // blocked — never silently skipped, never thrown. The Blocked escape
        // edge (sr-engineer → pm) is not checked here, so escalation always
        // stays available. Reuses hasExpectedRedManifest(): a repro test is
        // just a declared-red test recorded in the same manifest, so there is
        // no new file and no new predicate. File mode only: the manifest is a
        // qa_reports/ file and dispatch_mode lives only in the handoff YAML
        // frontmatter (SQLite never carries it), matching the cut-approval /
        // external-refs / expected-red guards. Placed after the external-refs
        // gate and before the review-verdict/status-mismatch gate; it guards
        // a different edge (sr→code-reviewer, not pm→build), so no existing
        // gate moves. Kept out of transitions.ts: this plain-text gate family
        // is not in the TransitionRejection union. (E2)
        if (
          storage instanceof FileHandoffStorage &&
          prevState?.dispatch_mode === "bugfix" &&
          prevTuple.agent === "sr-engineer" &&
          prevTuple.status === "In_Progress" &&
          nextTuple.agent === "code-reviewer" &&
          nextTuple.status === "In_Progress"
        ) {
          const manifest = hasExpectedRedManifest(parsed.workspace_path, parsed.active_feature);
          if (!manifest.present) {
            return {
              content: [{
                type: "text" as const,
                text:
                  `⛔ REPRO_MANIFEST_MISSING: ${parsed.active_feature}. ` +
                  `Expected repro manifest at ${manifest.manifestPath}. ` +
                  gate("REPRO_MANIFEST_MISSING").hintStatic,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "REVIEW_VERDICT_STATUS_MISMATCH",
    codes: ["REVIEW_VERDICT_STATUS_MISMATCH"],
    run: (ctx) => {
      const { parsed } = ctx;
        // v7 — Review-Verdict/Status Mismatch Gate (c9-protocol-fields AC-5).
        // Plain-text envelope, modeled on MISSING_EVIDENCE /
        // MISSING_REVIEW_EVIDENCE (DR-3): NOT threaded through
        // TransitionRejection["error"] (that union stays at 13 members).
        // Fires ONLY when a code-reviewer write carries a review_verdict AND
        // it disagrees with status — absence never fires (a code-reviewer
        // FAIL write with no verdict field is legal). Polarity (DR-8):
        // APPROVED pairs with In_Progress (code-reviewer:In_Progress → qa);
        // CHANGES_REQUESTED pairs with FAIL (code-reviewer:FAIL → sr) —
        // matches the existing transition matrix + review_round semantics.
        // Keys only on the INCOMING write args, so it is storage-agnostic
        // (DR-5) — no FileHandoffStorage guard, unlike cut-approval /
        // external-refs which read prev-state from disk.
        if (parsed.agent_id === "code-reviewer" && parsed.review_verdict) {
          const mismatch =
            (parsed.review_verdict === "APPROVED" && parsed.status !== "In_Progress") ||
            (parsed.review_verdict === "CHANGES_REQUESTED" && parsed.status !== "FAIL");
          if (mismatch) {
            return {
              content: [{
                type: "text" as const,
                text:
                  `⛔ REVIEW_VERDICT_STATUS_MISMATCH: review_verdict=${parsed.review_verdict} ` +
                  `with status=${parsed.status}. ` +
                  gate("REVIEW_VERDICT_STATUS_MISMATCH").hintStatic,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "REVIEWER_COMPLETED_TASKS_REJECTED",
    codes: ["REVIEWER_COMPLETED_TASKS_REJECTED", "NON_QA_COMPLETED_TASKS_REJECTED"],
    run: (ctx) => {
      const { parsed } = ctx;
        // Reviewer completed_tasks Gate. Sibling of
        // REVIEW_VERDICT_STATUS_MISMATCH above — plain-text envelope, keyed
        // only on the incoming parsed args (no FileHandoffStorage guard, so it
        // applies the same in file mode and SQLite/HTTP mode). Rejects ANY
        // code-reviewer-stamped write carrying a non-empty completed_tasks: a
        // reviewer must not mark tasks done, and nothing downstream would
        // catch it (MISSING_REVIEW_EVIDENCE only reads the manifest when
        // nextTuple.agent === "qa-engineer"). Legitimate writes are
        // untouched: the APPROVED handoff stamps agent_id="qa-engineer" and
        // carries the review scope in the transient review_task_ids field
        // (completed_tasks stays empty there; growth is rejected by
        // QA_COMPLETION_EVIDENCE_MISSING below), and the claim write carries
        // completed_tasks=[] (zod default) so it never fires. The envelope for
        // agent_id="code-reviewer" is kept byte-identical: it is published,
        // cited in skill-code-reviewer.md, and pinned by
        // test/reviewer-completed-tasks-gate.test.mjs. (C16, E32)
        if (parsed.agent_id === "code-reviewer" && parsed.completed_tasks.length > 0) {
          return {
            content: [{
              type: "text" as const,
              text:
                `⛔ REVIEWER_COMPLETED_TASKS_REJECTED: completed_tasks=` +
                `[${parsed.completed_tasks.join(", ")}] on an agent_id=code-reviewer write. ` +
                gate("REVIEWER_COMPLETED_TASKS_REJECTED").hintStatic,
            }],
            isError: true,
          };
        }
        // Extends the reviewer-only check above to EVERY identity other than
        // qa-engineer. QA_COMPLETION_EVIDENCE_MISSING below only diffs an
        // incoming qa-engineer write's completed_tasks against the ON-DISK
        // set, so ids some other role already persisted before any qa-engineer
        // write add zero difference and escape the per-id evidence check. So
        // this predicate is strict, deliberately NOT a set difference (the
        // set difference is exactly the gap being closed): any non-empty
        // completed_tasks on a write whose agent_id is present and is neither
        // "qa-engineer" (the evidence-backed completion path) nor
        // "code-reviewer" (handled by the branch above) is rejected, whatever
        // the ids. `parsed.agent_id &&` stops an absent agent_id from
        // matching; validateTransition (AGENT_ID_REQUIRED, step 1 of this
        // pipeline) already rejects such writes, so this is only a backstop.
        // No exemptions: an exemption on this kind of check has reopened the
        // hole before. tw_complete_task is untouched — it has its own evidence
        // path and never goes through tw_update_state. (E40)
        if (
          parsed.agent_id &&
          parsed.agent_id !== "qa-engineer" &&
          parsed.agent_id !== "code-reviewer" &&
          parsed.completed_tasks.length > 0
        ) {
          return {
            content: [{
              type: "text" as const,
              text:
                `⛔ NON_QA_COMPLETED_TASKS_REJECTED: completed_tasks=` +
                `[${parsed.completed_tasks.join(", ")}] on an agent_id=${parsed.agent_id} write. ` +
                gate("NON_QA_COMPLETED_TASKS_REJECTED").hintStatic,
            }],
            isError: true,
          };
        }
      return null;
    },
  },
  {
    name: "QA_REVIEW_RECORD",
    codes: ["QA_REVIEW_TARGET_REQUIRED"],
    run: async (ctx) => {
      const { parsed, storage } = ctx;
        // Evidence record FIRST so the PASS gate below can observe the row /
        // file just written. Only fires when QA attaches qa_review on a
        // PASS or FAIL write.
        // d9-qa-review-scoped-append — scoped target resolution: the review
        // stamp lands on review_task_ids (if non-empty), else completed_tasks
        // (the unchanged PASS back-compat path, AC2). The former "every
        // incomplete task in the workspace" fallback is DELETED (AC1): it
        // fired on every FAIL write (completed_tasks is legitimately empty
        // there per the Escalation call format) and fanned the stamp into
        // every open task's evidence file — the D8 incident polluted 11
        // unrelated review files. Both empty now rejects loud with
        // QA_REVIEW_TARGET_REQUIRED before anything is recorded (AC3) —
        // never forge evidence, never silently drop it. Keys ONLY on the
        // incoming parsed args, so it is storage-agnostic (file + SQLite).
        if (
          parsed.qa_review &&
          parsed.agent_id === "qa-engineer" &&
          (parsed.status === "PASS" || parsed.status === "FAIL")
        ) {
          const ids =
            parsed.review_task_ids && parsed.review_task_ids.length > 0
              ? parsed.review_task_ids
              : parsed.completed_tasks;
          if (ids.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text:
                  `⛔ QA_REVIEW_TARGET_REQUIRED: qa_review on a ${parsed.status} write with ` +
                  `review_task_ids and completed_tasks both empty. ` +
                  gate("QA_REVIEW_TARGET_REQUIRED").hintStatic,
              }],
              isError: true,
            };
          }
          await storage.recordReview(parsed.workspace_path, ids, parsed.status, "qa-engineer", parsed.qa_review);
        }
      return null;
    },
  },
  {
    name: "QA_COMPLETION_EVIDENCE_MISSING",
    codes: ["QA_COMPLETION_EVIDENCE_MISSING"],
    run: (ctx) => {
      const { parsed, storage, prevState } = ctx;
        // QA Completion-Evidence Gate. Closes the identity-swap side door
        // that REVIEWER_COMPLETED_TASKS_REJECTED cannot see: another agent
        // writing with agent_id="qa-engineer" to pre-fill completed_tasks
        // before any real QA ran, with no evidence on disk. Any
        // qa-engineer-stamped write whose completed_tasks adds ids NOT already
        // in the on-disk handoff's completed set must have per-id QA evidence
        // on disk via the gates/qa-review.ts convention (hasEvidenceInFile,
        // reused; a per-id file or a covers: line). Only new ids are checked,
        // so the normal cumulative flow still works: ids already on disk need
        // no fresh evidence when QA passes the full list back. Placed after
        // the qa_review auto-record above, the same way the PASS
        // MISSING_EVIDENCE gate sees the row just written, so a legitimate
        // PASS/FAIL write carrying qa_review satisfies this gate with its own
        // freshly recorded evidence; an evidence-less pre-fill (In_Progress,
        // no qa_review) has nothing on disk and is rejected, naming the ids.
        // No exemptions, including the APPROVED handoff
        // (code-reviewer:In_Progress → qa-engineer:In_Progress): a forged
        // manifest write is byte-identical to a real one, so no predicate can
        // tell them apart, and ids persisted that way would poison the on-disk
        // baseline so later carry-forwards pass unchecked. Instead, review
        // scope on an APPROVED handoff travels ONLY in the transient
        // review_task_ids field (per skill-code-reviewer.md;
        // MISSING_REVIEW_EVIDENCE below reads it), and completed_tasks on ANY
        // agent_id=qa-engineer write is reserved for evidence-backed QA
        // completions. So ANY qa-engineer-stamped write that GROWS
        // completed_tasks vs the on-disk set without per-id QA evidence is
        // rejected, whatever the status, review_verdict, or previous tuple.
        // Carry-forward (no new ids) never gates by design; ledgers polluted
        // before this rule are documented, not chased. bookkeeping_write
        // touches don't grow the ledger; other identities are
        // REVIEWER_COMPLETED_TASKS_REJECTED's job. tw_complete_task is
        // untouched (its own evidence path). No prevState guard: on a
        // brand-new workspace every claimed id is new, and a first-write
        // completion claim with no evidence is exactly what this rejects.
        // File mode only, like the sibling attestation gates (SQLite's
        // hasEvidence path is reports-row-based and out of scope). (E18, E32)
        if (
          storage instanceof FileHandoffStorage &&
          parsed.agent_id === "qa-engineer" &&
          parsed.completed_tasks.length > 0
        ) {
          const onDiskCompleted = new Set(prevState?.completed_tasks ?? []);
          const newIds = parsed.completed_tasks.filter((id) => !onDiskCompleted.has(id));
          if (newIds.length > 0) {
            const ev = hasEvidenceInFile(parsed.workspace_path, newIds);
            if (ev.missing.length > 0) {
              // Name the exact expected evidence file per offending id — the
              // same sanitised path hasEvidenceInFile checked — plus the
              // covers: fallback, so the writer knows precisely which file
              // clears the gate (like VISUAL_EVIDENCE_MISSING's expectedPaths
              // listing). (E32, E23)
              const expectedPaths = ev.missing
                .map((id) => qaEvidencePath(parsed.workspace_path, id))
                .join(", ");
              return {
                content: [{
                  type: "text" as const,
                  text:
                    `⛔ QA_COMPLETION_EVIDENCE_MISSING: ${ev.missing.join(", ")}. ` +
                    `Expected evidence file(s): ${expectedPaths} ` +
                    `(or an existing qa_reports/ report covering the id via a covers: line). ` +
                    gate("QA_COMPLETION_EVIDENCE_MISSING").hintStatic,
                }],
                isError: true,
              };
            }
          }
        }
      return null;
    },
  },
  {
    name: "PASS_MISSING_EVIDENCE",
    codes: ["MISSING_EVIDENCE"],
    run: async (ctx) => {
      const { parsed, storage } = ctx;
        // Evidence gate for PASS path
        if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
          const ev = await storage.hasEvidence(parsed.workspace_path, parsed.completed_tasks);
          if (ev.missing.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text: `⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. ${gate("MISSING_EVIDENCE").hintStatic}`,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
  {
    name: "PASS_VISUAL_SUBGATES",
    codes: ["VISUAL_BASELINES_REQUIRED", "VISUAL_EVIDENCE_MISSING", "VISUAL_WIDGETS_UNVERIFIED", "VISUAL_ASSERTIONS_REQUIRED", "VISUAL_REPORT_INCOMPLETE", "VISUAL_PROVENANCE_MISSING", "BASELINE_MANIFEST_MISSING", "BASELINE_PROVENANCE_INCOMPLETE", "PIXEL_GATE_ATTESTATION_MISSING"],
    run: (ctx) => {
      const { parsed, evidenceSchemaPin, evidenceSchemaLabel } = ctx;
        if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
          // v3.16.0 — Visual gate self-arming (visual-fidelity-gate-hardening, AC-1).
          // Arming moved off "## Visual Baselines present" onto "design mode != no-design".
          // STEP 1 (arm-check) fires BEFORE the evidence-file lookup; the two paths are
          // mutually exclusive (D2): an armed-but-baseline-less workspace gets the single
          // actionable VISUAL_BASELINES_REQUIRED error, never the confusing evidence-missing
          // error for a section that doesn't exist. STEP 2 (the v3.14.0 gate below) is
          // unchanged and reached only when ## Visual Baselines IS present.
          const armCheck = hasDesignModeRequiringVisual(parsed.workspace_path, parsed.active_feature);
          const visualGate = hasVisualBaselinesInDesign(parsed.workspace_path, parsed.active_feature);

          // STEP 1 — armed (mode != no-design) but no baselines section → block (NEW path).
          if (armCheck.required && !visualGate.present) {
            return {
              content: [{
                type: "text" as const,
                text:
                  `⛔ VISUAL_BASELINES_REQUIRED: design/<feature>.md declares mode != no-design ` +
                  `(mode=${armCheck.mode}, at ${armCheck.designPath}) but ## Visual Baselines is absent. ` +
                  gate("VISUAL_BASELINES_REQUIRED").hintStatic,
              }],
              isError: true,
            };
          }

          // STEP 2 — v3.14.0 Visual evidence gate (Constitution §3.1), UNCHANGED.
          // Reached only when `## Visual Baselines` is present; non-UI workspaces
          // (no design file, or mode = no-design) fall straight through here.
          if (visualGate.present) {
            const visEv = hasVisualEvidenceInFile(parsed.workspace_path, parsed.completed_tasks);
            if (visEv.missing.length > 0) {
              // Name the exact expected file path per missing id and the
              // evidence-schema version the check ran under (this is an
              // existence check — the version is context, not a match input).
              // (E23)
              const expectedPaths = visEv.missing
                .map((id) => visualEvidencePath(parsed.workspace_path, id))
                .join(", ");
              return {
                content: [{
                  type: "text" as const,
                  text:
                    `⛔ VISUAL_EVIDENCE_MISSING: ${visEv.missing.join(", ")}. ` +
                    `design/<feature>.md declares ## Visual Baselines (at ${visualGate.designPath}) ` +
                    `but qa_reports/visual_<task-id>.md is absent for the listed task(s). ` +
                    `Expected file(s): ${expectedPaths}. ` +
                    `Evidence schema: ${evidenceSchemaLabel}. ` +
                    gate("VISUAL_EVIDENCE_MISSING").hintStatic,
                }],
                isError: true,
              };
            }
            // v3.15.0 — R6 server-enforced Widget Shape Verification gate.
            // The previous gate confirmed every required visual_<id>.md exists.
            // This gate now verifies the contents: any unchecked `[ ]` row in
            // `## Widget Shape Verification` rejects PASS with the full list
            // (per AC-4: one round-trip to surface every offending widget).
            // Backwards-compat: visual reports without the `## Widget Shape
            // Verification` section pass through (per AC-2/AC-3 — pre-v3.15.0
            // reports didn't have the section, so absence = no claim).
            const widgetsCheck = hasUncheckedWidgets(parsed.workspace_path, parsed.completed_tasks);
            if (!widgetsCheck.ok) {
              const listing = Object.entries(widgetsCheck.uncheckedByTaskId)
                .map(([taskId, widgets]) => `${taskId}: [${widgets.join(", ")}]`)
                .join("; ");
              return {
                content: [{
                  type: "text" as const,
                  text:
                    `⛔ VISUAL_WIDGETS_UNVERIFIED: ${listing}. ` +
                    gate("VISUAL_WIDGETS_UNVERIFIED").hintStatic,
                }],
                isError: true,
              };
            }
            // v3.27.0 — Visual report SCHEMA validation (Constitution §3.2).
            // Existence + widget-shape was insufficient: a prior rollout shipped a bad
            // UI under a nominal PASS because the report carried no canonical-state
            // or structural-assertion claims. MANDATORY when the visual gate is
            // armed (mode != no-design): the design MUST declare
            // `## Visual Structural Assertions`. Missing it is NOT a silent
            // backwards-compatible fallback (the v3.26.0 bug Codex flagged) — it
            // is its own hard error VISUAL_ASSERTIONS_REQUIRED, mirroring how a
            // missing `## Visual Baselines` blocks at v3.16.0.
            if (armCheck.required) {
              if (!designDeclaresStructuralAssertions(parsed.workspace_path, parsed.active_feature)) {
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ VISUAL_ASSERTIONS_REQUIRED: design/<feature>.md declares mode != no-design ` +
                      `(mode=${armCheck.mode}, at ${armCheck.designPath}) but ## Visual Structural ` +
                      `Assertions is absent. ` +
                      gate("VISUAL_ASSERTIONS_REQUIRED").hintStatic,
                  }],
                  isError: true,
                };
              }
              // The report validator runs under the feature's pinned evidence
              // schema: pin 1 replays the exact-anchored heading match; pin >=2
              // or no pin uses a normalized "contains" match. (E23)
              const schema = validateVisualReports(
                parsed.workspace_path,
                parsed.completed_tasks,
                evidenceSchemaPin,
              );
              if (!schema.ok) {
                // Each failing task names the exact missing section heading(s)
                // or failed row(s), the report file path checked, and (below)
                // the evidence-schema version the check ran under. (E23)
                const listing = Object.entries(schema.byTaskId)
                  .map(([taskId, v]) => {
                    const reasons: string[] = [];
                    if (v.missingSections.length) reasons.push(`missing section(s): ${v.missingSections.map((s) => `## ${s}`).join(", ")}`);
                    if (v.failedCanonicalStates.length) reasons.push(`canonical-state fail: ${v.failedCanonicalStates.join("/")}`);
                    if (v.failedStructuralAssertions.length) reasons.push(`structural fail: ${v.failedStructuralAssertions.join("/")}`);
                    if (v.failedRegionDiffs.length) reasons.push(`region-diff fail: ${v.failedRegionDiffs.join("/")}`);
                    if (!v.verdictPass) reasons.push("verdict != PASS");
                    return `${taskId} (at ${visualEvidencePath(parsed.workspace_path, taskId)}) {${reasons.join("; ")}}`;
                  })
                  .join(" | ");
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ VISUAL_REPORT_INCOMPLETE: ${listing}. ` +
                      `Evidence schema: ${evidenceSchemaLabel}. ` +
                      gate("VISUAL_REPORT_INCOMPLETE").hintStatic,
                  }],
                  isError: true,
                };
              }
              // v3.38.0 — Baseline provenance gate (qa-visual-baseline-provenance, AC-1/AC-2).
              // The v3.27 schema gate confirmed the report's STRUCTURE is complete and every
              // row reads pass/accepted; it could NOT confirm the agent diffed a real baseline.
              // This gate parses each per-surface prose sub-section under ## Region Diff and
              // rejects PASS when a diffed (non-carry-forward) surface lacks a baseline:
              // fingerprint or a diff-metric: value. Opt-in (D2): dormant for reports with no
              // baseline: line anywhere (legacy/pre-provenance). Carry-forward surfaces are
              // exempt (AC-3); a "B1 tool unavailable — LLM fallback" note satisfies the
              // metric requirement (AC-4). FIFTH and LAST visual sub-gate — runs only on an
              // otherwise-clean, armed report.
              const prov = checkVisualProvenance(parsed.workspace_path, parsed.completed_tasks);
              if (!prov.ok) {
                const listing = Object.entries(prov.offendingByTaskId)
                  .map(([taskId, offenses]) => `${taskId} {${offenses.join("; ")}}`)
                  .join(" | ");
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ VISUAL_PROVENANCE_MISSING: ${listing}. ` +
                      gate("VISUAL_PROVENANCE_MISSING").hintStatic,
                  }],
                  isError: true,
                };
              }

              // v3.40.0 — Baseline manifest gate (figma-baseline-manifest-gate).
              // SIXTH and LAST visual sub-gate. The v3.38 provenance gate confirmed
              // each diffed surface carries a real baseline+diff; this gate confirms
              // the design-auditor FROZE the baseline node-id selection in the
              // design file's ## Source manifest (step 2c) rather than eyeball-picking
              // or re-deriving it. Opt-in (AC-N3): dormant when ## Source is absent
              // (pre-v3.40 designs). Single-surface (1 audited row) is exempt from
              // the provenance-section requirement (AC-3); multi-surface (>=2) must
              // record filter-conditions + exclusion-reasons in
              // ## Baseline Selection Provenance (AC-2).
              const manifest = checkBaselineManifest(parsed.workspace_path, parsed.active_feature);
              if (!manifest.ok) {
                const text = manifest.code === "BASELINE_MANIFEST_MISSING"
                  ? gate("BASELINE_MANIFEST_MISSING").hintStatic
                  : gate("BASELINE_PROVENANCE_INCOMPLETE").hintStatic;
                return { content: [{ type: "text" as const, text }], isError: true };
              }

              // v3.42.0 — Pixel-gate attestation (qa-visual-pixel-gate-attestation,
              // AC-2/AC-5). SEVENTH and LAST visual sub-gate. The v3.38 provenance
              // gate (now tightened by DIFF_METRIC_PLACEHOLDERS, AC-1) confirms each
              // diffed surface carries a REAL baseline + non-placeholder diff-metric;
              // this gate confirms qa-visual POSITIVELY attested the pixel gate ran
              // to completion (`pixel_gate_complete: true`) per surface. Closes the
              // F2 false-pass: a skipped diff can no longer ride structural assertions
              // to PASS. Opt-in (mirrors provenance D2): dormant for reports with no
              // baseline: line anywhere. Carry-forward surfaces are exempt (AC-4);
              // the B1 LLM-fallback path STILL requires the attestation (AC-5).
              const attestation = checkPixelGateAttestation(
                parsed.workspace_path,
                parsed.completed_tasks,
              );
              if (!attestation.ok) {
                const listing = Object.entries(attestation.offendingByTaskId)
                  .map(([taskId, offenses]) => {
                    const surfaces = offenses
                      .map((o) => o.replace(/^missing-attestation:/, ""))
                      .join(", ");
                    return `${taskId} {${surfaces}}`;
                  })
                  .join(" | ");
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ PIXEL_GATE_ATTESTATION_MISSING: ${listing}. ` +
                      gate("PIXEL_GATE_ATTESTATION_MISSING").hintStatic,
                  }],
                  isError: true,
                };
              }
            }
          }
        }
      return null;
    },
  },
  {
    name: "PASS_EXPECTED_RED_DIFF",
    codes: ["EXPECTED_RED_DIFF_MISSING"],
    run: (ctx) => {
      const { parsed, storage } = ctx;
        if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
          // v3.57.0 — Expected-Red Diff gate (c15-expected-red-manifest, AC-4).
          // Mirrors VISUAL_EVIDENCE_MISSING's arming polarity: dormant unless
          // sr-engineer declared qa_reports/expected-red_<feature>.txt (absence
          // = "no expected reds", zero cost — the external_refs/dispatch_pins
          // precedent). When armed, at least ONE qa_reports/review_<id>.md for
          // the PASS'd ids (or a file covering one of them via the c3 covers:
          // convention) must contain a ## Expected-Red Diff H2 recording QA's
          // Phase 0.5 suite-vs-manifest diff disposition. Existence-of-section
          // only — the server does NOT run the test suite or validate the diff
          // content (same trust boundary as MISSING_EVIDENCE). FILE-MODE ONLY
          // (AC-5): the manifest is a qa_reports/ file convention; SQLite/HTTP
          // mode has no equivalent — skip explicitly, mirroring the
          // cut-approval / external-refs guards.
          if (storage instanceof FileHandoffStorage) {
            const manifest = hasExpectedRedManifest(parsed.workspace_path, parsed.active_feature);
            if (manifest.present) {
              const disposition = hasExpectedRedDisposition(parsed.workspace_path, parsed.completed_tasks);
              if (!disposition.present) {
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ EXPECTED_RED_DIFF_MISSING: ${parsed.completed_tasks.join(", ")}. ` +
                      `Expected-red manifest exists (at ${manifest.manifestPath}) but no ` +
                      `## Expected-Red Diff section was found for the listed task(s). ` +
                      gate("EXPECTED_RED_DIFF_MISSING").hintStatic,
                  }],
                  isError: true,
                };
              }
            }
          }
        }
      return null;
    },
  },
  {
    name: "PASS_AC_EXECUTION_LOG",
    codes: ["AC_EXECUTION_LOG_MISSING"],
    run: (ctx) => {
      const { parsed, storage, evidenceSchemaPin, evidenceSchemaLabel } = ctx;
        if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
          // AC-Execution-Log gate. Sibling of EXPECTED_RED_DIFF_MISSING: arms
          // when the spec has at least one `proof:` acceptance criterion, and
          // clears on a `## AC Execution Log` H2 in a PASS'd review file (or a
          // covers: file). Trusts existence only. File mode only. (E3)
          if (storage instanceof FileHandoffStorage) {
            const arm = hasProofAnnotatedAC(parsed.workspace_path, parsed.active_feature);
            if (arm.armed) {
              // The disposition heading match runs under the feature's pinned
              // evidence schema: under pin >=2 or no pin, a heading such as
              // `## Phase 3.5 — AC Execution Log` also clears; pin 1 keeps the
              // exact anchor. (E23)
              const disposition = hasAcExecutionLogDisposition(
                parsed.workspace_path, parsed.completed_tasks, evidenceSchemaPin,
              );
              if (!disposition.present) {
                // Name the expected heading, every review file path inspected,
                // and the evidence-schema version the check ran under. (E23)
                const inspected =
                  disposition.checkedPaths.length > 0
                    ? disposition.checkedPaths.join(", ")
                    : "(none — no review file resolved for the listed task(s))";
                return {
                  content: [{ type: "text" as const,
                    text:
                      `⛔ AC_EXECUTION_LOG_MISSING: ${parsed.completed_tasks.join(", ")}. ` +
                      `Spec ${arm.specPath} declares ≥1 proof:-annotated AC but no ` +
                      `## AC Execution Log section was found for the listed task(s). ` +
                      `Expected heading: "## AC Execution Log". ` +
                      `Inspected: ${inspected}. ` +
                      `Evidence schema: ${evidenceSchemaLabel}. ` +
                      gate("AC_EXECUTION_LOG_MISSING").hintStatic,
                  }],
                  isError: true,
                };
              }
            }
          }
        }
      return null;
    },
  },
  {
    name: "MISSING_REVIEW_EVIDENCE",
    codes: ["MISSING_REVIEW_EVIDENCE"],
    run: async (ctx) => {
      const { parsed, storage, prevTuple, nextTuple } = ctx;
        // Code-reviewer evidence gate. Mirrors the PASS gate above for the
        // sr ↔ code-reviewer → qa handoff. Only fires when the previous tuple
        // is (code-reviewer, In_Progress) AND the next tuple hands off to qa.
        // The review-scope manifest travels in the transient review_task_ids
        // field; completed_tasks on the APPROVED handoff is no longer used
        // for it (any growth there is rejected upstream by
        // QA_COMPLETION_EVIDENCE_MISSING). Resolution follows the qa_review
        // rule: review_task_ids if non-empty, else completed_tasks (so
        // carry-forward ids on an older-style write still get their review
        // evidence checked here). (C16, E32)
        const reviewScopeIds =
          parsed.review_task_ids && parsed.review_task_ids.length > 0
            ? parsed.review_task_ids
            : parsed.completed_tasks;
        if (
          prevTuple.agent === "code-reviewer" &&
          prevTuple.status === "In_Progress" &&
          nextTuple.agent === "qa-engineer" &&
          nextTuple.status === "In_Progress" &&
          reviewScopeIds.length > 0
        ) {
          const ev = await storage.hasCodeReviewEvidence(parsed.workspace_path, reviewScopeIds);
          if (ev.missing.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text:
                  `⛔ MISSING_REVIEW_EVIDENCE: ${ev.missing.join(", ")}. ` +
                  gate("MISSING_REVIEW_EVIDENCE").hintStatic,
              }],
              isError: true,
            };
          }
        }
      return null;
    },
  },
];

// Full agent/status enumeration used by effectiveAllowedSuccessors below.
// Advisory only: never touches the gate pipeline above, never rejects, no
// GATE_REGISTRY entry. (E38)
const ALL_AGENT_NAMES: readonly AgentName[] = [
  "pm",
  "researcher",
  "design-auditor",
  "architect",
  "sr-engineer",
  "code-reviewer",
  "qa-engineer",
  "release-engineer",
];
const ALL_STATUS_NAMES: readonly StatusName[] = ["In_Progress", "PASS", "FAIL", "Blocked"];

// Computes the ACTUAL set of states allowed to follow a given state
// (typically the state a write just landed on), by calling validateTransition
// itself for every (agent, status) pair rather than re-deriving a second,
// divergent notion of "allowed" from the static ALLOWED table. This is the
// only way to correctly honor the three edges that sit OUTSIDE that table:
//   (a) the Amend-Resume `resume_of` edge: pm:In_Progress →
//       {code-reviewer, qa-engineer}:In_Progress, legal only when a write
//       sets resume_of to that exact role. A future write's resume_of value
//       is unknowable from here, so by default this function ASSUMES it
//       would be set to match — treating the edge as reachable, never as
//       illegal. When unsure, stay silent: a false warning on a legal
//       routing directive is worse than a missed one. Pass
//       `assumeResumeOf: false` to get the strict (resume_of-independent)
//       set instead — the caller uses it to tell conditional edges apart
//       from unconditional ones in the printed message.
//   (b) the round/hop-cap overrides, which collapse the allowed set to
//       {pm: In_Progress} alone once a round counter is at cap. The three
//       round-cap overrides in validateTransition (tools/transitions.ts)
//       have no feature_changed term — each returns null for
//       (pm,In_Progress) unconditionally — so passing the post-write round
//       counters here reproduces the exact collapse the next real
//       transition attempt will see. The hop-cap override in the same
//       function is DIFFERENT: it reads feature_changed and a future write
//       that opens a new feature (`true`) bypasses the gate entirely, so
//       whether a next-feature write is legal at hop cap is unknowable from
//       here — the same "unknowable input" shape as (a). This function
//       therefore unions BOTH feature_changed branches per candidate: a
//       candidate counts as reachable if EITHER accepts it. Below the hop
//       cap the branches are identical, so this changes nothing there;
//       at/above it, it trades a false warning on an illegal same-feature
//       next_role (the accepted under-warn direction — the
//       hop-cap-cross sentinel below, guarded by `new_hop_count >=
//       HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED`, already
//       covers that writer) for never warning on a legal next-feature one.
//   (c) the self-loop fast path (same agent, In_Progress → In_Progress),
//       which bypasses the static table entirely.
// Pure / fs-free (like transitions.ts itself): 64 in-memory calls, no I/O.
// (E38)
function effectiveAllowedSuccessors(
  prev: TransitionTuple,
  counters: {
    qa_round: number;
    review_round: number;
    visual_round: number;
    hop_count: number;
  },
  options: { assumeResumeOf?: boolean; featureChanged?: boolean } = {},
): Array<{ agent: AgentName; status: StatusName }> {
  const { assumeResumeOf = true, featureChanged } = options;
  // `featureChanged` lets a caller pin the union to one branch instead of
  // trying both. Used to compute the same-feature-only subset
  // (featureChanged: false) so entries reachable only through the hop-cap
  // union can be told apart from unconditional ones. Default (undefined)
  // tries both branches. (E38)
  const featureChangedBranches = featureChanged === undefined ? [false, true] : [featureChanged];
  const out: Array<{ agent: AgentName; status: StatusName }> = [];
  for (const agent of ALL_AGENT_NAMES) {
    for (const status of ALL_STATUS_NAMES) {
      const accepted = featureChangedBranches.some(
        (feature_changed) =>
          validateTransition({
            prev,
            next: { agent, status },
            prev_qa_round: counters.qa_round,
            prev_review_round: counters.review_round,
            prev_visual_round: counters.visual_round,
            prev_hop_count: counters.hop_count,
            feature_changed,
            next_resume_of:
              assumeResumeOf && (agent === "code-reviewer" || agent === "qa-engineer")
                ? agent
                : undefined,
          }) === null,
      );
      if (accepted) out.push({ agent, status });
    }
  }
  return out;
}

// --- GUARDED: must call tw_get_state first ---
async function handleUpdateStateCore(parsed: UpdateStateInput): Promise<ToolResult> {
        enforcePreFlight(parsed.workspace_path, "tw_update_state");

        // Defense-in-depth: zod refine already enforces this on PASS, but a
        // client that bypasses zod still hits this guard.
        if (parsed.status === "PASS") {
          const gate = requireQaEngineer(parsed.agent_id, "tw_update_state(status=PASS)");
          if (!gate.ok) {
            return { content: [{ type: "text" as const, text: gate.message ?? "blocked" }] };
          }
        }

        const storage = getActiveStorage();
        const prevState = storage.parse(parsed.workspace_path);
        const prev_qa_round = prevState?.qa_round ?? 0;
        const prev_review_round = prevState?.review_round ?? 0;
        const prev_visual_round = prevState?.visual_round ?? 0;
        // v9 (d2-server-brake-accounting) — hop-cap inputs, derived HERE so
        // transitions.ts stays pure / fs-free (it never reads active_feature
        // itself, only the boolean computed from prevState + the incoming
        // write). No prevState (fresh workspace) counts as a feature change:
        // the counter starts from a 0 base either way.
        const prev_hop_count = prevState?.hop_count ?? 0;
        // Cumulative-total inputs, derived the same way as prev_hop_count:
        // transitions.ts stays pure and fs-free, so the orchestrator reads the
        // persisted totals and passes them in. File-mode-only fields:
        // SqliteHandoffStorage.parse never sets them, so `?? 0` gives SQLite
        // mode a harmless 0 base. (E8, handoff schema v12)
        const prev_qa_rounds_total = prevState?.qa_rounds_total ?? 0;
        const prev_review_rounds_total = prevState?.review_rounds_total ?? 0;
        const prev_visual_rounds_total = prevState?.visual_rounds_total ?? 0;
        const feature_changed = prevState
          ? prevState.active_feature !== parsed.active_feature
          : true;
        // Evidence-schema pin. Same-feature writes run the evidence gates under
        // the feature's persisted pin; a feature started before pins existed
        // has none and falls back to the v2 normalized-contains rules. A
        // feature-change write IS the stamping write, so its checks run under
        // EVIDENCE_SCHEMA_CURRENT, the exact value stamped below. Never
        // client-supplied — resolved only from prevState + feature_changed
        // (tw_update_state has no zod arg for it). (E23)
        const evidenceSchemaPin = feature_changed
          ? EVIDENCE_SCHEMA_CURRENT
          : prevState?.evidence_schema;
        // D3 — the version string the rejection envelopes cite. An absent pin
        // is named as such (not silently rendered as v2) so the reader knows
        // the feature predates pinning and got the default.
        const evidenceSchemaLabel =
          evidenceSchemaPin !== undefined
            ? `v${evidenceSchemaPin}`
            : "absent pin (v2 normalized-contains default)";
        const prevTuple: TransitionTuple = {
          agent: (prevState?.last_agent as AgentName | undefined) ?? null,
          status: (prevState?.status as StatusName | undefined) ?? null,
        };
        const nextTuple: TransitionTuple = {
          agent: (parsed.agent_id as AgentName | undefined) ?? null,
          status: parsed.status,
        };

        // Everything above this line builds the context: prev-state
        // derivation, round/hop inputs, feature_changed, and the
        // evidence-schema pin are resolved ONCE here, never inside a gate
        // step. The pipeline then runs the frozen check order as data, and
        // the first rejection's envelope is returned unchanged. (E35)
        const ctx: UpdateStateGateContext = {
          parsed,
          storage,
          prevState,
          prevTuple,
          nextTuple,
          prev_qa_round,
          prev_review_round,
          prev_visual_round,
          prev_hop_count,
          feature_changed,
          evidenceSchemaPin,
          evidenceSchemaLabel,
        };
        const pipelineRejection = await runUpdateStatePipeline(UPDATE_STATE_GATE_PIPELINE, ctx);
        if (pipelineRejection) {
          return pipelineRejection;
        }

        const {
          qa_round: new_qa_round,
          review_round: new_review_round,
          visual_round: new_visual_round,
          // v9 — server-computed hop counter (DR-9: +1 on role transitions
          // only; DR-6: reset only on feature change, pm landing does NOT
          // reset). Persisted via storage.writeState below.
          hop_count: new_hop_count,
          // Cumulative per-feature totals. They tick in step with the
          // per-cycle FAIL branches inside computeNewRound and reset ONLY on a
          // feature change (the same rule as hop_count). Persisted via
          // storage.writeState below (file-mode frontmatter only). (E8, v12)
          qa_rounds_total: new_qa_rounds_total,
          review_rounds_total: new_review_rounds_total,
          visual_rounds_total: new_visual_rounds_total,
        } = computeNewRound(
          prev_qa_round,
          prev_review_round,
          prev_visual_round,
          nextTuple,
          prevTuple,
          parsed.pending_notes,
          prev_hop_count,
          feature_changed,
          prev_qa_rounds_total,
          prev_review_rounds_total,
          prev_visual_rounds_total,
        );
        const pending = [...parsed.pending_notes];
        // v3.15.0 — symmetric cap-cross predicate fix.
        // v3.14.0 used `=== 4 && === 3` which would skip the sentinel when
        // prev_round arrived at the handler at a value already past 3
        // (migration / hand-edit). v3.14.1 fixed visual_round; v3.15.0 brings
        // qa_round and review_round in line. Predicate: `new >= 4 && prev < 4`
        // fires exactly once per cap-cross from any prior value.
        if (new_qa_round >= 4 && prev_qa_round < 4) {
          pending.unshift("⛔ Round 4: forced rollback to pm — no further QA allowed until PM resets.");
        }
        if (new_review_round >= 4 && prev_review_round < 4) {
          pending.unshift("⛔ Review Round 4: forced rollback to pm — no further code-review allowed until PM resets.");
        }
        // v3.14.0 — visual_round Round 6 lock (5 visual FAILs accumulated).
        // Symmetric to qa_round / review_round Round 4 lock.
        // v3.14.1 — fire on every cap-cross, not only the exact 5→6 step.
        // Earlier v3.14.0 used `=== 6 && === 5`, which skipped the sentinel
        // when the prior counter was already at cap due to migration or
        // hand-edit. `>=6 && <6` is the correct cap-cross predicate.
        if (new_visual_round >= 6 && prev_visual_round < 6) {
          pending.unshift("⛔ Visual Round 6: forced rollback to pm — no further pixel iteration allowed until PM rebudgets scope or threshold.");
        }
        // v9 (d2-server-brake-accounting) — hop-cap-cross sentinel. Same
        // `new >= cap && prev < cap` predicate as the three round sentinels
        // above: fires exactly once per cap-cross from any prior value. This
        // write itself is still accepted (the counter only REACHED cap here);
        // the NEXT counted role transition trips HOP_CAP_EXCEEDED in
        // validateTransition, which admits only the (pm, In_Progress) landing
        // — and that landing does NOT reset hop_count (DR-6): only an
        // active_feature change does.
        if (new_hop_count >= HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED) {
          pending.unshift(
            `⛔ Hop cap reached (hop_count=${new_hop_count}/${HOP_CAP_EXPORTED}): ` +
              "next role transition will be rejected (HOP_CAP_EXCEEDED) — only (pm, In_Progress) may land. " +
              "Halt autonomous dispatch and surface to human; only an active_feature change resets the counter.",
          );
        }

        // v3.15.0 — call site uses the new options-object overload of
        // storage.writeState. Each field is named, eliminating the
        // 11-positional risk that motivated the refactor. The positional
        // overload remains @deprecated for backwards-compat callers.
        const result = await storage.writeState({
          workspacePath: parsed.workspace_path,
          activeFeature: parsed.active_feature,
          status: parsed.status,
          completedTasks: parsed.completed_tasks,
          pendingNotes: pending,
          blockingReason: parsed.blocking_reason,
          lastAgent: parsed.agent_id,
          qaRound: new_qa_round,
          prdPath: parsed.prd_path,
          reviewRound: new_review_round,
          visualRound: new_visual_round,
          // v9 — server-computed hop counter; persisted in BOTH storage modes
          // (file frontmatter + sqlite hop_count column, DR-2) unlike the
          // file-mode-only attestation fields below.
          hopCount: new_hop_count,
          // Cumulative totals, computed by computeNewRound alongside
          // hop_count and persisted in file-mode frontmatter ONLY:
          // SqliteHandoffStorage.writeState ignores all three, because their
          // only consumer, the release-close metrics emit, runs only under
          // FileHandoffStorage. (E8, v12)
          qaRoundsTotal: new_qa_rounds_total,
          reviewRoundsTotal: new_review_rounds_total,
          visualRoundsTotal: new_visual_rounds_total,
          scopeDecision: parsed.scope_decision,
          scopeDecisionWhy: parsed.scope_decision_why,
          cutApproved: parsed.cut_approved,
          externalRefs: parsed.external_refs,
          // v7 — protocol fields (c9-protocol-fields). Transient, write-scoped
          // (AC-3): persisted only when set on this write. File-mode only
          // (DR-5): SqliteHandoffStorage.writeState ignores all three.
          nextRole: parsed.next_role,
          resumeOf: parsed.resume_of,
          reviewVerdict: parsed.review_verdict,
          // v8 — dispatch_pins (c14-dispatch-pins). Pass-through only:
          // advisory bookkeeping like next_role (AC-5) — NOT cross-checked
          // against ALLOWED_TRANSITIONS, no gate, no GateErrorCode. REPLACE
          // wholesale when provided; the feature-scoped carry-forward for
          // omitting writes lives in writeHandoffState. File-mode only:
          // SqliteHandoffStorage.writeState ignores it.
          dispatchPins: parsed.dispatch_pins,
          // dispatch_mode, passed straight through: a feature-scoped scalar
          // like dispatchPins (carry-forward for writes that omit it lives in
          // writeHandoffState). File mode only: SqliteHandoffStorage.writeState
          // ignores it. (E2, v11)
          dispatchMode: parsed.dispatch_mode,
          // evidence_schema, stamped by the server. SET here on the first
          // accepted write of a new active_feature (feature_changed includes
          // the fresh-workspace case); OMITTED on same-feature writes so
          // writeHandoffState's feature-scoped carry keeps the existing pin
          // exactly — including having no pin, for features started before
          // pins existed (the migration invents none). Never client-supplied:
          // `parsed` has no such field. File mode only:
          // SqliteHandoffStorage.writeState ignores it. (E23, v13)
          evidenceSchema: feature_changed ? EVIDENCE_SCHEMA_CURRENT : undefined,
          // cut_approved_source, passed straight through: a feature-scoped
          // scalar using the same carry-forward as dispatch_mode (carry-forward
          // for writes that omit it lives in writeHandoffState). Set by the
          // client (parsed.cut_approved_source comes straight from the zod
          // arg), unlike the server-stamped evidenceSchema above. No gate reads
          // it. File mode only: SqliteHandoffStorage.writeState ignores it.
          // (E114, v14)
          cutApprovedSource: parsed.cut_approved_source,
          // dispatch_mechanism / dispatch_mechanism_tier, passed straight
          // through and self-reported by the writer. They apply to this hop
          // only, like nextRole/reviewVerdict: writeHandoffState emits them
          // only when set on THIS write and never carries them forward. For
          // the record only — no gate reads either. File mode only:
          // SqliteHandoffStorage.writeState ignores both. (E99, v15)
          dispatchMechanism: parsed.dispatch_mechanism,
          dispatchMechanismTier: parsed.dispatch_mechanism_tier,
          // bookkeeping_write attestation, passed straight through:
          // writeHandoffState's same-feature-guarded branch uses it to keep
          // the existing last_updated (a second line of defence); the
          // different-feature reject already fired above. Applies to this
          // write only: never persisted to frontmatter, no schema bump. File
          // mode only: SqliteHandoffStorage.writeState ignores it. (E10)
          bookkeepingWrite: parsed.bookkeeping_write,
        });

        // Append one line per hop to the dispatch-mechanism sidecar so the
        // record survives later state rewrites. Reached only AFTER the state
        // write above succeeded (a throwing writeState never gets here), and
        // only when this write carried dispatch_mechanism: a write without it
        // appends nothing. appendDispatchRecord never throws (the same
        // contract as emitGateTelemetry), so the ToolResult below is
        // identical with or without this hook. It writes only its own
        // sidecar — never the metrics or gate-fire telemetry streams. (E99)
        if (parsed.dispatch_mechanism) {
          appendDispatchRecord(parsed.workspace_path, {
            feature: parsed.active_feature,
            agent_id: parsed.agent_id,
            dispatch_mechanism: parsed.dispatch_mechanism,
            dispatch_mechanism_tier: parsed.dispatch_mechanism_tier,
          });
        }

        // GC hook: when QA flips a feature to PASS, drop the workspace's RAG
        // chunks so the next feature starts clean. Await any concurrent lazy
        // reindex first so DELETE cannot race with INSERT.
        // Best-effort: a failure here MUST NOT undo the successful state write.
        if (
          parsed.status === "PASS" &&
          parsed.agent_id === "qa-engineer" &&
          "deletePrdChunks" in storage &&
          typeof (storage as Record<string, unknown>).deletePrdChunks === "function"
        ) {
          try {
            await awaitAllInflightFor(parsed.workspace_path);
            (storage as unknown as { deletePrdChunks(wp: string): number }).deletePrdChunks(
              parsed.workspace_path,
            );
          } catch {
            // swallow — state write is the source of truth; cleanup is opportunistic
          }
        }

        // Release-close metrics emit. Fires on the terminal-marker signature
        // (the same "feature has shipped" predicate gates/feature-lease.ts
        // trusts): the release-engineer's closing self-loop routing back to
        // pm. File mode only — the marker keys on next_role, which
        // SqliteHandoffStorage never persists. Totals are read from
        // prevState: the closing write is a release-engineer self-loop, so
        // computeNewRound carries them over unchanged and prevState is
        // authoritative. emitFeatureMetrics never throws, so the ToolResult
        // below is identical with or without this hook. (E8)
        if (
          storage instanceof FileHandoffStorage &&
          parsed.agent_id === "release-engineer" &&
          parsed.status === "In_Progress" &&
          parsed.next_role === "pm"
        ) {
          emitFeatureMetrics({
            workspacePath: parsed.workspace_path,
            feature: parsed.active_feature,
            qaRoundsTotal: prevState?.qa_rounds_total ?? 0,
            reviewRoundsTotal: prevState?.review_rounds_total ?? 0,
            visualRoundsTotal: prevState?.visual_rounds_total ?? 0,
            hops: prevState?.hop_count ?? 0,
          });
        }

        // Shrink warning for fields a write replaces wholesale (dispatch_pins
        // and external_refs). A writer that skips read-before-write silently
        // drops entries. When THIS write supplied one of them and the supplied
        // set drops any prior entry (same-feature writes only — a feature
        // change legitimately drops both feature-scoped fields), append an
        // advisory `warnings` array to the success envelope naming the dropped
        // entries. Detection compares entry identity — dispatch_pins by key,
        // external_refs by ref string — not counts, so a same-size (or even
        // growing) set that swaps out a prior entry warns too. Warn-only:
        // never rejects, no new arg, no schema bump, and any failure here
        // leaves the original envelope untouched (the state write already
        // succeeded). A pin whose VALUE changes but whose key survives is not
        // a drop (values are free-text tiers, and re-pinning a role is normal
        // use); the same holds for an external_refs entry whose state advances
        // under an unchanged ref. (E28, E33)
        const shrinkWarnings: string[] = [];
        if (prevState && !feature_changed) {
          if (parsed.dispatch_pins) {
            const prevPinKeys = Object.keys(prevState.dispatch_pins ?? {});
            const nextPinKeys = new Set(Object.keys(parsed.dispatch_pins));
            const dropped = prevPinKeys.filter((k) => !nextPinKeys.has(k));
            if (dropped.length > 0) {
              shrinkWarnings.push(
                `dispatch_pins REPLACES wholesale, not merges: this write kept ` +
                  `${prevPinKeys.length - dropped.length} of ${prevPinKeys.length} prior entries — dropped: ` +
                  `${dropped.join(", ")}. If unintended, read the previous state and ` +
                  `re-write the FULL map including every still-wanted pin.`,
              );
            }
          }
          if (parsed.external_refs) {
            const prevRefs = prevState.external_refs ?? [];
            const nextRefSet = new Set(parsed.external_refs.map((r) => r.ref));
            const dropped = prevRefs.filter((r) => !nextRefSet.has(r.ref)).map((r) => r.ref);
            if (dropped.length > 0) {
              shrinkWarnings.push(
                `external_refs REPLACES wholesale, not merges: this write kept ` +
                  `${prevRefs.length - dropped.length} of ${prevRefs.length} prior entries — dropped: ` +
                  `${dropped.join(", ")}. If unintended, read the previous state and ` +
                  `re-write the FULL ledger including every still-wanted entry.`,
              );
            }
          }
        }
        // next_role lookahead at write time. next_role is documented at the
        // tool boundary as "advisory metadata only — enum-validated but NOT
        // cross-checked against ALLOWED_TRANSITIONS", so a legal write can
        // name a next_role that the very next hop is certain to
        // TRANSITION_REJECT (for example qa-engineer:FAIL written with
        // next_role="design-auditor", whose allowed set is {sr-engineer, pm}).
        // This warns ONLY when parsed.next_role is set AND names an agent
        // outside the effective allowed-successor set of nextTuple (the state
        // THIS write just landed on) under the post-write round/hop counters
        // — the exact counters the next real transition will be checked
        // against. Deliberately advisory: it only decorates the envelope
        // after the write — no GATE_REGISTRY entry, no new error code, no
        // pipeline step that can reject this write. (E38)
        const nextRoleWarnings: string[] = [];
        if (parsed.next_role) {
          const counters = {
            qa_round: new_qa_round,
            review_round: new_review_round,
            visual_round: new_visual_round,
            hop_count: new_hop_count,
          };
          const effective = effectiveAllowedSuccessors(nextTuple, counters);
          const isLegalSuccessor = effective.some((e) => e.agent === parsed.next_role);
          if (!isLegalSuccessor) {
            // Q2 fix (round 3, C2) — the printed remedy list must not
            // (1) advertise a resume_of-conditional edge as unconditional
            // routing advice, (2) advertise a hop-cap union-only edge (legal
            // only if the next write opens a NEW feature, N1) as legal
            // same-feature, or (3) exclude a same-agent STATUS CHANGE
            // (qa:In_Progress -> qa:PASS/FAIL/Blocked, sr:In_Progress ->
            // sr:Blocked) merely because it shares an agent with the state
            // just written. Round 2's `e.agent === nextTuple.agent` filter
            // conflated (3) with the genuine In_Progress->In_Progress
            // self-loop fast path in validateTransition
            // (tools/transitions.ts) and emptied the remedy list on
            // qa-engineer:In_Progress and pm:Blocked, whose
            // successors are ALL same-agent — resurrecting the categorically
            // false "(none - ...)" fallback as live output. Excluding only
            // the exact (agent, status) PAIR that was just written keeps
            // that fallback dead (round-1 proof: no reachable state has an
            // empty ALLOWED row) while still surfacing same-agent status
            // changes as the genuinely actionable answer. Printing
            // `agent:status` pairs (rather than deduped bare agent names)
            // is what makes the narrowed filter informative instead of
            // ambiguous.
            const strict = effectiveAllowedSuccessors(nextTuple, counters, {
              assumeResumeOf: false,
            });
            const strictKeys = new Set(strict.map((e) => `${e.agent}:${e.status}`));
            // N1 (round 3, non-blocking) — the C1 union's mirror cost: at
            // hop cap, `effective` includes edges legal ONLY because
            // feature_changed=true bypasses the hop-cap override in
            // validateTransition (tools/transitions.ts). Recomputing with
            // featureChanged pinned to false isolates the same-feature-legal
            // subset; below the hop cap the two sets are identical
            // (feature_changed is inert there, per the C1 fix's own
            // comment), so this never annotates off-cap.
            const sameFeatureOnly = effectiveAllowedSuccessors(nextTuple, counters, {
              featureChanged: false,
            });
            const sameFeatureKeys = new Set(sameFeatureOnly.map((e) => `${e.agent}:${e.status}`));
            const allowedPairs = effective
              .filter((e) => !(e.agent === nextTuple.agent && e.status === nextTuple.status))
              .map((e) => {
                const pairKey = `${e.agent}:${e.status}`;
                const clauses: string[] = [];
                if (!strictKeys.has(pairKey)) {
                  clauses.push(`only legal with resume_of="${e.agent}"`);
                }
                if (!sameFeatureKeys.has(pairKey)) {
                  clauses.push("only legal if the next write opens a new feature");
                }
                return clauses.length > 0 ? `${pairKey} (${clauses.join("; ")})` : pairKey;
              });
            nextRoleWarnings.push(
              `next_role="${parsed.next_role}" does not match any allowed successor of the state ` +
                `just written (${nextTuple.agent}:${nextTuple.status}). Actual allowed next ` +
                `(agent:status) pair(s): ${
                  allowedPairs.length > 0
                    ? allowedPairs.join(", ")
                    : "(none — no successor is currently reachable from this state)"
                }. ` +
                `next_role is advisory-only and this write was NOT rejected, but a next hop that follows ` +
                `next_role as given will be rejected — re-route to one of the allowed pair(s) ` +
                `above, or omit next_role and let the acting role decide.`,
            );
          }
        }

        let responseText = result;
        if (shrinkWarnings.length > 0 || nextRoleWarnings.length > 0) {
          try {
            const envelope = JSON.parse(result) as Record<string, unknown>;
            envelope.warnings = [
              ...(Array.isArray(envelope.warnings) ? (envelope.warnings as string[]) : []),
              ...shrinkWarnings,
              ...nextRoleWarnings,
            ];
            responseText = JSON.stringify(envelope);
          } catch {
            // Advisory only — an unparseable success payload keeps its original text.
          }
        }

        return { content: [{ type: "text" as const, text: responseText }] };
}

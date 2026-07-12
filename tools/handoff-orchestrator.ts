// Coded by @sr-engineer
// tw_update_state gate-policy orchestration (registry-pattern, T-REG-04).
// Verbatim relocation of the index.ts `tw_update_state` dispatcher case body
// (pre-refactor index.ts:722-1197). Kept SEPARATE from tools/handoff.ts to
// avoid conflating "read/write handoff state" with "gate policy orchestration"
// (this module imports tools/transitions.ts + tools/evidence-file.ts; handoff.ts
// does not) — and to scope the future A2 gates/ extraction cleanly.
//
// Check order is FROZEN (spec AC-5/AC-8): preflight → PASS/qa-engineer gate →
// transition validation → feature-lease gate (E1) → scope-decision gate → cut-approval gate →
// external-refs gate → source-credibility gate (E4) → repro-first gate (E2, bugfix-mode) → review-verdict/status mismatch gate → reviewer
// completed_tasks gate (v3.58.0, C16) → QA evidence record → PASS evidence
// gate → visual sub-gates → expected-red diff gate →
// code-reviewer evidence gate → round-cap sentinels → storage.writeState →
// PASS RAG GC hook. No reorder, no merge, no early-return removal.
//
// The 4-step mutating-tool contract (lock → freshness → atomic write → refresh
// snapshot) lives inside tools/handoff.ts writeState — NOT here (spec finding #5).

import type { ToolResult, UpdateStateInput } from "./registry.js";
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
import { hasUnresolvedRefs, listUnresolvedRefs } from "../gates/external-refs.js";
import { gate } from "../gates/registry.js";
import { awaitAllInflightFor } from "./rag-coalesce.js";
import { emitGateTelemetry, extractGateCodeFromText } from "./telemetry.js";
import { emitFeatureMetrics } from "./metrics.js";

// E1 (e1-feature-scoped-state-design) — feature-lease TTL. Fixed constant,
// NOT config-driven (mirrors STALE_DISPATCH_THRESHOLD_MIN in tools/handoff.ts
// and HOP_CAP's fixed-constant posture): stale-lease auto-expiry is a safety
// self-heal, not a tunable policy knob. 30 min — deliberately LONGER than the
// 15-min dispatch-staleness threshold, since a whole feature legitimately
// spans longer gaps than a single dispatch (PM-ratified calibration,
// 2026-07-12; any change requires a PM spec amendment).
const LEASE_TTL_MIN = 30;

// D3 (d3-gate-fire-telemetry) — thin telemetry wrapper, the ONE emit point
// for all 22 GATE_REGISTRY rejections. Zero changes to the frozen check-order
// body below (handleUpdateStateCore is the pre-D3 handleUpdateState,
// byte-identical). emitGateTelemetry swallows internally (AC-4): the returned
// ToolResult is never masked or altered by a telemetry failure.
// enforcePreFlight's thrown session-guard exceptions propagate through
// unmodified — not a GateErrorCode, out of scope.
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
        // v12 (e8-success-telemetry) — cumulative-total inputs, same derivation
        // posture as prev_hop_count: transitions.ts stays pure / fs-free; the
        // orchestrator reads the persisted totals and threads them through.
        // File-mode-only fields (DR-1): SqliteHandoffStorage.parse never
        // constructs them, so `?? 0` keeps SQLite mode at a harmless 0 base.
        const prev_qa_rounds_total = prevState?.qa_rounds_total ?? 0;
        const prev_review_rounds_total = prevState?.review_rounds_total ?? 0;
        const prev_visual_rounds_total = prevState?.visual_rounds_total ?? 0;
        const feature_changed = prevState
          ? prevState.active_feature !== parsed.active_feature
          : true;
        const prevTuple: TransitionTuple = {
          agent: (prevState?.last_agent as AgentName | undefined) ?? null,
          status: (prevState?.status as StatusName | undefined) ?? null,
        };
        const nextTuple: TransitionTuple = {
          agent: (parsed.agent_id as AgentName | undefined) ?? null,
          status: parsed.status,
        };

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

        // E1 — Feature-Lease Gate (e1-feature-scoped-state-design, option a-min).
        // Converts the silent second-feature clobber (D5/D9/D10 incident class)
        // into a loud, governed rejection: a write carrying a DIFFERENT
        // active_feature is rejected while the incumbent feature is non-terminal
        // (status != PASS — Blocked counts as held, PM-ratified) and fresh
        // (last_updated within LEASE_TTL_MIN). Per-workspace mutual exclusion:
        // at most one non-terminal feature per workspace_path; the release path
        // is serial by construction. Same-feature writes NEVER gate
        // (feature_changed false short-circuits inside the predicate). Runs
        // FIRST among the state-reading gates — after validateTransition
        // accepts, before the build-entry attestation gates — so the "can this
        // feature take the slot at all?" question is answered before any
        // per-edge attestation is evaluated. BOTH storage modes (unlike
        // cut-approval / external-refs): the core clauses read the three
        // universal fields (active_feature/status/last_updated), which exist
        // identically in the SQLite row; the E1A release-engineer closing-write
        // terminal marker additionally reads last_agent/next_role, which are
        // optional and file-mode-only (SQLite never persists next_role) — the
        // clause simply never matches there (accepted asymmetry, spec
        // §Amendment 2026-07-12). NOT in transitions.ts (that stays
        // pure / fs-free; mirrors SCOPE_DECISION_REQUIRED).
        if (prevState && isFeatureLeaseHeld(prevState, parsed.active_feature, Date.now(), LEASE_TTL_MIN)) {
          const hint =
            `Feature lease held by "${prevState.active_feature}" ` +
            `(status=${prevState.status}, last_updated=${prevState.last_updated}, ` +
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
              active_feature: prevState.active_feature,
              status: prevState.status,
              last_updated: prevState.last_updated,
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

        // v3.30.0 — Scope Decision Gate (server-scope-decision-gate). Fires on
        // the build-entry edge (pm:In_Progress → {architect,sr-engineer}:In_Progress)
        // when the design is armed (mode != no-design) but no scope decision is
        // recorded. Pinning prev=pm makes re-entry/resume safe: the
        // architect→sr-engineer and sr-engineer self-loop edges have a non-pm
        // predecessor and are never gated. Structurally independent of the visual
        // gate (different edge, different artifacts; shares only the arm helper).
        // Placed here — after validateTransition accepts, before the evidence
        // blocks — so all transition-shaped rejects read first. NOT in
        // transitions.ts (that stays pure / fs-free; mirrors VISUAL_BASELINES_REQUIRED).
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

        // v5 — Cut-Approval Gate (pm-cut-approval-gate). Fires on the same
        // build-entry edge (pm:In_Progress → {architect,sr-engineer}:In_Progress)
        // as the scope-decision gate, but is UNCONDITIONAL (not arm-gated): a
        // human must approve the ticket cut before ANY build role receives the
        // handoff, visual feature or not. Runs SECOND, directly after the
        // scope-decision gate (D1): independent error code, no merged envelope,
        // so each hint stays actionable and tests assert each in isolation.
        // Pinning prev=pm keeps resume/re-entry safe — architect→sr-engineer and
        // the sr self-loop have a non-pm predecessor and are never gated.
        // FILE-MODE ONLY (D5): cut_approved lives in the handoff YAML frontmatter
        // only; in SQLite/HTTP mode the parsed prev-state never carries it, so
        // the gate would always fire. Skip the gate unless the active storage is
        // the file implementation. NOT in transitions.ts (that stays pure /
        // fs-free; mirrors SCOPE_DECISION_REQUIRED).
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

        // v6 — External-Refs Gate (b8-external-ref-ledger). THIRD build-entry
        // attestation gate, back-to-back after scope-decision and cut-approval
        // on the same pm:In_Progress → {architect,sr-engineer}:In_Progress edge.
        // Unconditional (not arm-gated on design mode); the gate only FIRES when
        // the prev state's external_refs ledger carries >=1 entry with
        // state === "unresolved". INVERSE polarity to cut_approved (DR-3):
        // absence / empty / all-resolved falls straight through (AC-2) —
        // absence means "PM's Resource Audit Gate found zero external refs".
        // Pinning prev=pm keeps resume/re-entry safe (AC-3): architect→sr and
        // the sr self-loop have a non-pm predecessor and are never re-blocked
        // by a ledger populated on an earlier PM write. FILE-MODE ONLY (AC-5):
        // external_refs lives in the handoff YAML frontmatter only; in
        // SQLite/HTTP mode prevState never carries it, so skip explicitly
        // rather than gate on an always-empty read. NOT in transitions.ts
        // (that stays pure / fs-free; mirrors CUT_APPROVAL_REQUIRED).
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

        // E4 — Source-Credibility Gate (e4-design-source-credibility-gate). FOURTH
        // build-entry attestation gate on the pm:In_Progress -> {architect,sr-engineer}
        // :In_Progress edge, after scope-decision / cut-approval / external-refs.
        // UNLIKE those three (file-mode only, read handoff YAML), this gate reads
        // design/<feature>.md directly via fs, so it is STORAGE-MODE-AGNOSTIC (AC-7) —
        // NO `getActiveStorage() instanceof FileHandoffStorage` guard. Arm is the
        // fetch-based-mode INCLUSION list inside checkSourceCredibility, NOT the broad
        // hasDesignModeRequiringVisual exclusion. Pinned to prev=pm keeps resume/re-entry
        // safe (AC-6): architect->sr-engineer and the sr self-loop have a non-pm
        // predecessor and are never gated. NOT in transitions.ts (that stays pure /
        // fs-free; mirrors SCOPE_DECISION_REQUIRED). Independent of the PASS-time
        // baseline-manifest gates (AC-5): different edge, different check.
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

        // E2 — Repro-First Gate (e2-bugfix-repro-gate, AC2/AC6). Bugfix-mode
        // only. Fires on the fix-phase handoff sr-engineer:In_Progress →
        // code-reviewer:In_Progress when the incumbent feature is
        // dispatch_mode="bugfix" but no repro manifest
        // (qa_reports/expected-red_<feature>.txt) exists. Blocks the write —
        // never a silent skip, never a throw (AC6). The Blocked escape edge
        // (sr-engineer → pm) is NOT keyed here, so escalation is always
        // available. Reuses the existing hasExpectedRedManifest() predicate —
        // a repro test is a "declared red" recorded in the same C15 manifest
        // (DR-2), no new file, no new predicate. FILE-MODE ONLY: the manifest
        // is a qa_reports/ file convention and dispatch_mode lives in the
        // handoff YAML frontmatter only (SQLite never carries it) — so gate
        // only under FileHandoffStorage, mirroring the cut-approval /
        // external-refs / expected-red guards. Placed AFTER the external-refs
        // gate and BEFORE the review-verdict/status-mismatch gate: a disjoint
        // edge (sr→code-reviewer, not pm→build), so it reorders no existing
        // gate; check order stays frozen-additive. NOT in transitions.ts (this
        // plain-text gate family is not in the TransitionRejection union —
        // DR-5).
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

        // v3.58.0 — Reviewer completed_tasks Gate (c16-c10-role-boundary AC-3).
        // Sibling of REVIEW_VERDICT_STATUS_MISMATCH above — same family:
        // plain-text envelope, keys ONLY on the incoming parsed args (no
        // FileHandoffStorage guard, so it applies uniformly in file mode AND
        // SQLite/HTTP mode). Fires on ANY code-reviewer-stamped write carrying
        // a non-empty completed_tasks (the C16 ledger-pollution class: the
        // CHANGES_REQUESTED row feeds no gate — MISSING_REVIEW_EVIDENCE only
        // reads the manifest when nextTuple.agent === "qa-engineer"). The
        // legitimate uses are untouched: the APPROVED row stamps
        // agent_id="qa-engineer" (this gate keys on agent_id, not on which
        // role authored the call), and the Phase-2 claim write carries
        // completed_tasks=[] (zod default) so it never fires.
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
              return {
                content: [{
                  type: "text" as const,
                  text:
                    `⛔ VISUAL_EVIDENCE_MISSING: ${visEv.missing.join(", ")}. ` +
                    `design/<feature>.md declares ## Visual Baselines (at ${visualGate.designPath}) ` +
                    `but qa_reports/visual_<task-id>.md is absent for the listed task(s). ` +
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
            // Existence + widget-shape was insufficient: CDE-OOBE shipped a bad
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
              const schema = validateVisualReports(parsed.workspace_path, parsed.completed_tasks);
              if (!schema.ok) {
                const listing = Object.entries(schema.byTaskId)
                  .map(([taskId, v]) => {
                    const reasons: string[] = [];
                    if (v.missingSections.length) reasons.push(`missing: ${v.missingSections.join("/")}`);
                    if (v.failedCanonicalStates.length) reasons.push(`canonical-state fail: ${v.failedCanonicalStates.join("/")}`);
                    if (v.failedStructuralAssertions.length) reasons.push(`structural fail: ${v.failedStructuralAssertions.join("/")}`);
                    if (v.failedRegionDiffs.length) reasons.push(`region-diff fail: ${v.failedRegionDiffs.join("/")}`);
                    if (!v.verdictPass) reasons.push("verdict != PASS");
                    return `${taskId} {${reasons.join("; ")}}`;
                  })
                  .join(" | ");
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ VISUAL_REPORT_INCOMPLETE: ${listing}. ` +
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

          // E3 — AC-Execution-Log gate (e3-outcome-shaped-acceptance, AC4/AC5). Sibling
          // of EXPECTED_RED_DIFF_MISSING: arms on spec content (≥1 proof: AC), clears on a
          // `## AC Execution Log` H2 in a PASS'd review file (or a covers: file).
          // Existence-only trust boundary. FILE-MODE ONLY.
          if (storage instanceof FileHandoffStorage) {
            const arm = hasProofAnnotatedAC(parsed.workspace_path, parsed.active_feature);
            if (arm.armed) {
              const disposition = hasAcExecutionLogDisposition(
                parsed.workspace_path, parsed.completed_tasks,
              );
              if (!disposition.present) {
                return {
                  content: [{ type: "text" as const,
                    text:
                      `⛔ AC_EXECUTION_LOG_MISSING: ${parsed.completed_tasks.join(", ")}. ` +
                      `Spec ${arm.specPath} declares ≥1 proof:-annotated AC but no ` +
                      `## AC Execution Log section was found for the listed task(s). ` +
                      gate("AC_EXECUTION_LOG_MISSING").hintStatic,
                  }],
                  isError: true,
                };
              }
            }
          }
        }

        // Code-reviewer evidence gate. Mirrors the PASS gate above for the
        // sr ↔ code-reviewer → qa handoff. Only fires when the previous tuple
        // is (code-reviewer, In_Progress) AND the next tuple hands off to qa.
        if (
          prevTuple.agent === "code-reviewer" &&
          prevTuple.status === "In_Progress" &&
          nextTuple.agent === "qa-engineer" &&
          nextTuple.status === "In_Progress" &&
          parsed.completed_tasks.length > 0
        ) {
          const ev = await storage.hasCodeReviewEvidence(parsed.workspace_path, parsed.completed_tasks);
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

        const {
          qa_round: new_qa_round,
          review_round: new_review_round,
          visual_round: new_visual_round,
          // v9 — server-computed hop counter (DR-9: +1 on role transitions
          // only; DR-6: reset only on feature change, pm landing does NOT
          // reset). Persisted via storage.writeState below.
          hop_count: new_hop_count,
          // v12 — cumulative per-feature totals (e8-success-telemetry). Tick in
          // lock-step with the per-cycle FAIL branches inside computeNewRound;
          // reset ONLY on feature change (hop_count's rule). Persisted via
          // storage.writeState below (file-mode frontmatter only, DR-1).
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
          // v12 — cumulative totals (e8-success-telemetry). Server-computed by
          // computeNewRound alongside hop_count; persisted in file-mode
          // frontmatter ONLY (DR-1: SqliteHandoffStorage.writeState ignores
          // all three — their sole consumer, the release-close metrics emit,
          // fires only under FileHandoffStorage).
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
          // v11 — dispatch_mode (e2-bugfix-repro-gate). Pass-through only:
          // feature-scoped scalar sibling of dispatchPins (carry-forward for
          // omitting writes lives in writeHandoffState). File-mode only:
          // SqliteHandoffStorage.writeState ignores it.
          dispatchMode: parsed.dispatch_mode,
        });

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

        // E8 (e8-success-telemetry, T-E8-03) — release-close metrics emit.
        // Fires on the E1A terminal-marker signature (the same "feature has
        // shipped" predicate gates/feature-lease.ts trusts): release-engineer
        // closing self-loop routing back to pm. File-mode only (DR-1) — the
        // marker keys on next_role, which SqliteHandoffStorage never persists.
        // Totals are read from prevState (DR: the closing write is a
        // release-engineer self-loop, so computeNewRound carries them
        // unchanged — prevState is authoritative and already in scope).
        // emitFeatureMetrics never throws (AC2): the ToolResult below is
        // byte-identical with or without this hook.
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

        return { content: [{ type: "text" as const, text: result }] };
}

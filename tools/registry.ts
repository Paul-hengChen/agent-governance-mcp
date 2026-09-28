// Coded by @sr-engineer
// Registry pattern (registry-pattern, backlog A1): single declarative registry
// per surface (tools, prompts). index.ts iterates TOOL_REGISTRY /
// PROMPT_REGISTRY instead of maintaining three independent registration sites
// per tool (JSON Schema literal, zod const, dispatcher case) and two per
// prompt (metadata array, if-chain). Adding a tool/prompt is one entry here.
//
// Placement is load-bearing (AC-7): this file lives under tools/ so
// test/error-code-contract.test.mjs's CODE_SOURCE_FILES glob scans it
// automatically. Do NOT move it to a top-level registry/ directory.

import * as path from "node:path";
import { z } from "zod";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleDetectDrift } from "./drift.js";
import { isInsideWorkspace } from "./handoff-parse.js";
import { handleSync } from "./sync.js";
import { handleSwitchRole } from "./role.js";
import {
  handleGetNextTask,
  handleCompleteTask,
  handleRollbackTask,
  handleVoidTask,
  handleAddTask,
} from "./tasks.js";
import { handleUpdateState, handleGetState } from "./handoff-orchestrator.js";
import { handleIndexPrd, handleClearPrdChunks, DEFAULT_EMBEDDING_MODEL } from "./rag.js";
import { handleGateStats } from "./gate-stats.js";

// ==========================================
// Registry entry types (T-REG-01)
// ==========================================

// Handler return type = the SDK's own CallToolResult. Using the SDK type
// (not a hand-narrowed alias) guarantees the index.ts dispatch loop's
// `return await entry.run(args)` satisfies the setRequestHandler signature
// with zero assignability friction, and every relocated `{ content: [...],
// isError?: true }` literal is assignable to it.
export type ToolResult = CallToolResult;

export interface ToolRegistryEntry {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"]; // the hand-written JSON Schema, verbatim
  run: (rawArgs: unknown) => Promise<ToolResult>; // parses internally, then dispatches
}

export interface PromptRegistryEntry {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
  // Declarative skill-file reference (C6 DR-2): the GetPrompt handler in
  // index.ts calls buildPromptForRole(entry.skillFile, …) directly so the
  // resolution-source and omit-constitution params are passed at one call
  // site. The prompts/<role>.ts wrapper functions stay exported for tests
  // but are no longer referenced here.
  skillFile: string; // e.g. "skill-architect.md"
}

export function defineTool<TSchema extends z.ZodTypeAny>(spec: {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  zodSchema: TSchema;
  handler: (args: z.infer<TSchema>) => Promise<ToolResult>;
}): ToolRegistryEntry {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    // spec.zodSchema is the CONCRETE TSchema (not the erased z.ZodTypeAny),
    // so .parse() returns z.infer<TSchema> — NOT `any` — and feeds a handler
    // typed for exactly that. Erasure to (unknown)=>Promise happens at the
    // `run` boundary. No cast, no `any`, at any point.
    run: (rawArgs: unknown) => spec.handler(spec.zodSchema.parse(rawArgs)),
  };
}

// ==========================================
// Runtime validation schemas (zod)
// ==========================================
const absoluteWorkspacePath = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p), { message: "workspace_path must be an absolute path" });

const WorkspaceOnly = z.object({
  workspace_path: absoluteWorkspacePath,
});

// E86 (e92-e86-handoff-write-boundary AC1/AC2) — reject a free-text field
// whose TRIMMED TAIL is leftover tool-call tag markup: a malformed
// multi-argument tw_update_state/tw_add_task call bleeding a sibling
// argument's literal tag fragment onto this field's tail (docs/backlog.md
// E86: `<parameter name="pending_notes">` / `</scope_decision_why></invoke>`
// tails observed live).
//
// Round-1 finding (F1, review_reports/review_T-E86-01.md): tail POSITION
// ALONE is not narrow enough. agc's own documentation dialect routinely ends
// sentences on a bare `<placeholder>` token (`<role>`, `<feature>`,
// `<task-id>`, `<field>`, a byte-verbatim line of
// content/coord-01-core-head.md's `(<N> units) ... <which fired>`) and
// ordinary TypeScript prose does the same (`Promise<void>`, `Array<string>`).
// A position-only check fires on all of them (AC2/AC5 violation). So the
// predicate is now narrowed by BOTH tail position AND a genuine tool-call
// signal — an attribute assignment (`name="..."`) or a close-tag slash
// (`</...`) — neither of which a bare placeholder or a TS generic carries.
// The same fragment quoted mid-string, with further prose following it, is
// ordinary prose and MUST be accepted regardless (AC2; the E74
// false-positive lesson) — this backlog row's own E86 paragraph, which
// quotes such fragments as prose followed by more sentence, is a worked
// counter-example the predicate must not flag, and it doesn't: the fragment
// isn't at the tail.
//
// Implementation: find the LAST "<" in the trimmed value; require everything
// from there to the end of the string to be consumed by a tag-shaped
// fragment (open or close, complete with a closing ">" or truncated
// mid-attribute) AND require that fragment to carry the tool-call signal
// above.
//
// Round-2 finding (F4, review_reports/review_T-E86-01.md): the attribute
// value alternative is split in two, and only one of the two halves
// actually forces the tag to be the tail. The TERMINATED half
// (`"[^"]*"`) matches a complete `"value"` and MAY have arbitrary prose
// after it elsewhere in the string, but that prose is what pushed the "<"
// this match started from out of tail position in the first place — this
// half never needs to reach end-of-string on its own, the outer
// `\s*\/?>?$` anchor still does that job. The UNTERMINATED half
// (`"[^"\s]*$`), which fires when the closing quote is missing, is where
// the tail invariant actually has to be enforced explicitly: without the
// `[^"\s]` exclusion and its own `$`, a greedy `[^"]*` would swallow
// everything to end of string INCLUDING spaces and further sentences,
// which is exactly what let a mid-string fragment like
// `<parameter name="pending_notes and then three more sentences...`
// reject in round 2 (AC2 violation — that fragment is not at the tail and
// must be accepted). Excluding whitespace from the truncated value means
// prose after the truncation point can no longer be absorbed, so the
// match — and therefore the fire — only succeeds when the fragment
// genuinely IS the tail.
//
// What this predicate knowingly still does NOT catch (accepted, not
// blocking, per round-2 coordinator scope decision — filed as NEW-3, a
// purely-additive tag-name-vocabulary OR-branch, not implemented here):
// a bare open tag with no attribute and no slash (`<parameter>`,
// `<invoke>`, `<function_calls>`), a truncated attribute name with no `=`
// yet (`<parameter name`), a self-closing tag with no attribute
// (`<br/>`), and a single-quoted attribute (`<parameter name='x'>`, F3,
// round 1). These are structurally indistinguishable from a bare
// placeholder (`<role>`, `<div>`) without a tag-name vocabulary check,
// which the design deliberately declines (see the F1 note above) —
// widening this hole is the accepted price of closing F1 without
// reintroducing it.
const TRAILING_TAG_FRAGMENT_RE =
  /<\/?[A-Za-z_][\w.:-]*(?:\s+[A-Za-z_][\w.:-]*(?:\s*=\s*(?:"[^"]*"|"[^"\s]*$))?)*\s*\/?>?$/;

// A genuine tool-call signal: a close-tag slash, or an attribute assignment
// (`name="value"`, optionally with the closing quote truncated away).
function hasToolCallSignal(tagFragment: string): boolean {
  return tagFragment.startsWith("</") || /=\s*"/.test(tagFragment);
}

function hasTrailingTagFragment(value: string): boolean {
  // Trailing trim strips U+200B (zero width space, escaped rather than
  // embedded literally — an invisible literal in source is one silent
  // autofix/edit away from disappearing with no visible diff, NEW-2 nit)
  // alongside ordinary whitespace: plain `trimEnd()` leaves a trailing ZWS
  // in place, which would otherwise let a tag fragment hide past the tail
  // check (NEW-2, filed in round 1; folded in here since it's the same
  // predicate).
  const trimmed = value.replace(/[\s\u200B]+$/, "");
  const lastLt = trimmed.lastIndexOf("<");
  if (lastLt === -1) return false;
  const tail = trimmed.slice(lastLt);
  if (!TRAILING_TAG_FRAGMENT_RE.test(tail)) return false;
  return hasToolCallSignal(tail);
}

// e86.rejection_message (specs/e92-e86-handoff-write-boundary.md Copy/Strings
// table — quoted verbatim except for the "<field>" substitution the table
// itself declares).
function trailingTagFragmentMessage(field: string): string {
  return `Field "${field}" appears to end with leftover tool-call markup (a trailing tag fragment) — this usually means a malformed multi-argument call bled into this field. Re-issue the call with each argument in its own tag.`;
}

const UpdateStateArgs = z
  .object({
    workspace_path: absoluteWorkspacePath,
    active_feature: z.string().min(1).max(500),
    status: z.enum(["In_Progress", "PASS", "FAIL", "Blocked"]),
    completed_tasks: z.array(z.string().max(500)).max(200).optional().default([]),
    pending_notes: z.array(z.string().max(1000)).max(50).optional().default([]),
    blocking_reason: z.string().max(2000).optional(),
    agent_id: z.string().max(200).optional(),
    // QA review notes attached when (status in {PASS, FAIL}) and
    // (agent_id === "qa-engineer"). Storage records the review to
    // qa_reports/review_<id>.md (file mode) or the reports table (SQLite).
    qa_review: z.string().max(10000).optional(),
    // Optional absolute path to this workspace's PRD. PM typically sets it
    // once; downstream roles can omit it (storage preserves the prior value).
    // Consumed by the RAG lazy-reindex hook (prompts/build.ts:appendSpecContext).
    prd_path: z
      .string()
      .min(1)
      .refine((p) => path.isAbsolute(p), { message: "prd_path must be absolute" })
      .optional(),
    // v4 — scope-decision attestation (server-scope-decision-gate). The PM sets
    // scope_decision: "single-feature" on its pm:In_Progress write to clear the
    // SCOPE_DECISION_REQUIRED gate; scope_decision_why is optional free text.
    scope_decision: z.enum(["single-feature"]).optional(),
    scope_decision_why: z.string().max(2000).optional(),
    // v5 — cut-approval attestation (pm-cut-approval-gate). PM sets
    // cut_approved: true on its pm:In_Progress write AFTER inline cut draft +
    // human approval, to clear the CUT_APPROVAL_REQUIRED gate on the
    // pm:In_Progress → {architect,sr-engineer}:In_Progress build-entry edge.
    cut_approved: z.boolean().optional(),
    // v6 — external-reference ledger (b8-external-ref-ledger). PM records one
    // entry per external artifact its spec references during the Resource Audit
    // Gate. Passing the field REPLACES the whole array (wholesale, like
    // completed_tasks — never merged). Closed state enum (AC-9): an out-of-enum
    // state is rejected by zod before the gate runs, no server error code.
    external_refs: z
      .array(
        z.object({
          ref: z.string().min(1).max(1000),
          state: z.enum(["fetched", "indexed", "user-confirmed-ignorable", "unresolved"]),
        }),
      )
      .max(200)
      .optional(),
    // v7 — protocol fields (c9-protocol-fields). Closed enums (AC-2): an
    // out-of-enum value is rejected here, at the tool boundary, before any
    // gate runs (mirrors external_refs.state). All three are TRANSIENT,
    // write-scoped (AC-3): storage emits them only when set on THIS write —
    // never preserved across omitting writes.
    // next_role: advisory single-hop routing directive; enum-shape validation
    // ONLY — deliberately NOT cross-checked against ALLOWED_TRANSITIONS (AC-6).
    next_role: z
      .enum([
        "pm",
        "researcher",
        "design-auditor",
        "architect",
        "sr-engineer",
        "code-reviewer",
        "qa-engineer",
        "release-engineer",
      ])
      .optional(),
    // resume_of: Amend-Resume target; consumed by validateTransition via
    // TransitionRequest.next_resume_of (AC-4). Restricted to the exact two
    // roles the Amend-Resume Edge allows.
    resume_of: z.enum(["code-reviewer", "qa-engineer"]).optional(),
    // review_verdict: code-reviewer verdict; checked against status by the
    // REVIEW_VERDICT_STATUS_MISMATCH orchestrator gate (AC-5).
    review_verdict: z.enum(["APPROVED", "CHANGES_REQUESTED"]).optional(),
    // v8 — dispatch_pins map (c14-dispatch-pins). CLOSED KEYS, OPEN VALUES
    // (AC-2): keys are the same 8 AgentName literals next_role validates
    // against — an unknown key is rejected here, at the tool boundary, before
    // any gate runs (`.strict()`, mirrors the next_role closed-enum
    // precedent). Values are bounded free text (non-empty, ≤ 100 chars)
    // naming the pinned model tier — deliberately NOT closed-enum: the legal
    // model-tier vocabulary is not owned by this server and evolves
    // independently; a typo'd model name is a client-side error the server
    // does not gate on (same trust class as scope_decision_why). DURABLE,
    // feature-scoped (AC-3/AC-4): REPLACES the whole map when provided (never
    // merged key-by-key); carried forward across same-feature writes that
    // omit it; dropped on active_feature change. File-mode only, no gate
    // (AC-5).
    dispatch_pins: z
      .object({
        pm: z.string().min(1).max(100).optional(),
        researcher: z.string().min(1).max(100).optional(),
        "design-auditor": z.string().min(1).max(100).optional(),
        architect: z.string().min(1).max(100).optional(),
        "sr-engineer": z.string().min(1).max(100).optional(),
        "code-reviewer": z.string().min(1).max(100).optional(),
        "qa-engineer": z.string().min(1).max(100).optional(),
        "release-engineer": z.string().min(1).max(100).optional(),
      })
      .strict()
      .optional(),
    // v11 — dispatch_mode (e2-bugfix-repro-gate). Closed two-value enum:
    // an out-of-enum value is rejected here, at the tool boundary, before any
    // gate runs (the next_role closed-enum precedent). Absence === "feature"
    // (the default) — the field is OPTIONAL and never seeded. DURABLE,
    // feature-scoped (the dispatch_pins/external_refs lifetime, but scalar):
    // carried forward across same-feature writes that omit it; dropped on
    // active_feature change; NOT re-armed on PM re-entry. "bugfix" arms the
    // file-mode repro-first gate (REPRO_MANIFEST_MISSING) on the
    // sr-engineer:In_Progress → code-reviewer:In_Progress fix-phase edge; it
    // never gates a transition edge itself. File-mode only.
    dispatch_mode: z.enum(["feature", "bugfix"]).optional(),
    // v14 — cut_approved_source (e114-cut-approval-inheritance). CLIENT-
    // SETTABLE string, NOT closed-enum and NOT shape-validated at this
    // boundary (contrast dispatch_mode's z.enum immediately above) — the
    // server cannot verify a cross-workspace inheritance claim, so it accepts
    // the writer's attestation here and defensively drops (never throws) any
    // value that does not match the "inherited:<parent-feature>" shape at
    // parse time (tools/handoff-parse.ts), mirroring dispatch_mode's
    // defensive-drop posture rather than rejecting at this zod boundary.
    // Contrast evidence_schema: server-stamped, deliberately NO zod arg here.
    // DURABLE, feature-scoped (the dispatch_mode scalar algorithm): carried
    // forward across same-feature writes that omit it; dropped on
    // active_feature change; NOT re-armed on PM re-entry. Recording-only —
    // never wired to a gate (AC9). File-mode only.
    cut_approved_source: z.string().max(200).optional(),
    // v15 — per-hop dispatch-mechanism attestation (e123a-lane-layout-
    // migration, E99 option (i) + self-reported tier). dispatch_mechanism is a
    // closed three-value enum rejected here, at the tool boundary, before any
    // gate runs (the dispatch_mode / review_verdict closed-enum precedent).
    // dispatch_mechanism_tier is bounded free text — the model-tier vocabulary
    // is not owned by this server (the dispatch_pins value precedent).
    // Attested, NOT verified. TRANSIENT, write-scoped (the next_role /
    // review_verdict lifetime): persisted on THIS write only, never carried
    // forward. Recording-only — no gate, no GateErrorCode, no predicate reads
    // either field. File-mode only.
    dispatch_mechanism: z.enum(["task", "switch_role", "inline"]).optional(),
    dispatch_mechanism_tier: z.string().max(40).optional(),
    // E10 (e10-lease-override) — two attested booleans, NO schema bump
    // (architecture DR-1): neither is ever emitted to or read back from
    // frontmatter. Both are TRANSIENT, write-scoped (the next_role/resume_of/
    // review_verdict precedent, NOT the durable cut_approved/dispatch_mode
    // precedent) and FILE-MODE only (spec AC9: SQLite mode ignores both).
    // lease_override: human-attested FEATURE_LEASE_HELD bypass, any edge.
    // Consumed ONLY at the orchestrator lease gate from the incoming args;
    // requires a pending_notes[0] audit line matching /^lease-override:/
    // (LEASE_OVERRIDE_AUDIT_MISSING otherwise — gates/lease-override.ts).
    lease_override: z.boolean().optional(),
    // bookkeeping_write: non-substantive-write attestation. Consumed ONLY as
    // a writeHandoffState option selecting last_updated (preserve the
    // incumbent's stamp instead of now()); valid on same-active_feature
    // writes only (BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE otherwise, AC6).
    bookkeeping_write: z.boolean().optional(),
    // v9 — d9-qa-review-scoped-append. Task id(s) the qa_review evidence
    // auto-record targets (agent_id=qa-engineer, status PASS/FAIL). Same
    // shape/limits as completed_tasks. TRANSIENT, write-scoped (c9-protocol-
    // fields convention, like next_role/resume_of/review_verdict): consumed
    // ONLY by the id-resolution in handoff-orchestrator.ts — never persisted,
    // never carried across writes. Resolution: review_task_ids if non-empty,
    // else completed_tasks; both empty on a qa_review-bearing write is
    // rejected with QA_REVIEW_TARGET_REQUIRED (the old "every open task"
    // fan-out fallback is deleted — D8 incident).
    review_task_ids: z.array(z.string().max(500)).max(200).optional(),
  })
  .refine((d) => d.status !== "PASS" || d.agent_id === "qa-engineer", {
    message: 'status="PASS" requires agent_id="qa-engineer"',
    path: ["agent_id"],
  })
  // Mirror tw_index_prd's path-traversal guard: if prd_path is given it MUST
  // resolve inside workspace_path.
  .refine(
    (d) => {
      if (!d.prd_path) return true;
      return isInsideWorkspace(d.workspace_path, path.resolve(d.workspace_path, d.prd_path));
    },
    { message: "prd_path must be inside workspace_path (no traversal)", path: ["prd_path"] },
  )
  // Reject a workspace_path that points at the .current state directory rather
  // than the workspace root. The server resolves every state file under this
  // path's .current/ tree (lane-scoped .current/<lane>/handoff.md, sidecars,
  // the flat legacy fallback, .current/history/); a basename of ".current"
  // would nest all of it under .current/.current/ instead of failing loud.
  .refine((d) => path.basename(d.workspace_path) !== ".current", {
    message: "workspace_path must be the workspace root, not the .current state directory",
    path: ["workspace_path"],
  })
  // Reject the canonical JS object-stringification sentinel. When a caller
  // passes active_feature as an object, the MCP transport stringifies it to
  // "[object Object]" before Zod sees it; persisting that verbatim corrupts
  // the handoff. Exact-string equality is the only check possible here — the
  // object is already stringified before this layer runs.
  .refine((d) => d.active_feature !== "[object Object]", {
    message: "active_feature must be a plain string id, not a serialised object",
    path: ["active_feature"],
  })
  // E86 (AC1/AC2) — see hasTrailingTagFragment above. Checked against every
  // free-text field named in the spec's Problem Statement as a historically
  // affected field (pending_notes, scope_decision_why, qa_review,
  // blocking_reason). Deliberately NOT a gate (gates/*.ts is L-GATE-owned) —
  // this is a zod-level input-schema check, same layer as the
  // "[object Object]" sentinel refine immediately above.
  .superRefine((d, ctx) => {
    const scalarChecks: Array<{ field: string; value: string | undefined }> = [
      { field: "scope_decision_why", value: d.scope_decision_why },
      { field: "qa_review", value: d.qa_review },
      { field: "blocking_reason", value: d.blocking_reason },
    ];
    for (const { field, value } of scalarChecks) {
      if (value !== undefined && hasTrailingTagFragment(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: trailingTagFragmentMessage(field),
          path: [field],
        });
      }
    }
    (d.pending_notes ?? []).forEach((note, i) => {
      if (hasTrailingTagFragment(note)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: trailingTagFragmentMessage(`pending_notes[${i}]`),
          path: ["pending_notes", i],
        });
      }
    });
  });

const CompleteTaskArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  task_id: z.string().min(1),
  note: z.string().optional(),
  agent_id: z.string().max(200).optional(),
});

const RollbackTaskArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  task_id: z.string().min(1),
  reason: z.string().min(1),
});

const VoidTaskArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  task_id: z.string().min(1),
  reason: z.string().min(1),
});

const AddTaskArgs = z
  .object({
    workspace_path: absoluteWorkspacePath,
    task_id: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    section: z.string().min(1).max(200).optional(),
  })
  // E86 (AC1/AC2) — the spec's Problem Statement names tw_add_task's
  // `description` alongside pending_notes/scope_decision_why/qa_review as a
  // free-text field the same malformed-call class can bleed into.
  .superRefine((d, ctx) => {
    if (hasTrailingTagFragment(d.description)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: trailingTagFragmentMessage("description"),
        path: ["description"],
      });
    }
  });

const SwitchRoleArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  role: z.enum(["pm", "researcher", "design-auditor", "sr-engineer", "code-reviewer", "qa-engineer", "architect", "doc-writer", "release-engineer"]),
});

// Model name allowlist regex: HuggingFace-style "namespace/model-name" with
// alphanumerics, dot, underscore, dash, slash. Bounds user-supplied input
// before it reaches the dynamic loader.
const EMBEDDING_MODEL_RE = /^[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-]+$/;

// v3.14.1 — explicit allowlist on top of the format regex.
// Background: regex-only validation let any HF Hub repo through. A client
// passing `embedding_model: "attacker/evil-model"` would download a crafted
// .onnx, parsed by onnxruntime-web → protobufjs (CVE-2026-41242 / RCE).
// Closing the schema attack surface by trusting only Xenova-org-hosted models.
// See research/xenova-reachability.md for the full reachability trace.
// To add a model: open a PR amending this set + spot-checking the .onnx
// provenance (HF commit history + Xenova-org membership).
const ALLOWED_EMBEDDING_MODELS = new Set<string>([
  "Xenova/all-MiniLM-L6-v2",       // DEFAULT — small, English, 384-d
  "Xenova/bge-small-en-v1.5",      // alternative — BGE small English
  "Xenova/multilingual-e5-small",  // alternative — multilingual small
]);

const IndexPrdArgs = z
  .object({
    workspace_path: absoluteWorkspacePath,
    prd_path: z
      .string()
      .min(1)
      .refine((p) => path.isAbsolute(p), { message: "prd_path must be absolute" }),
    embedding_model: z
      .string()
      .max(200)
      .regex(EMBEDDING_MODEL_RE, { message: "embedding_model must match 'namespace/name' format" })
      .refine(
        (m) => ALLOWED_EMBEDDING_MODELS.has(m),
        {
          message:
            "embedding_model must be one of: " +
            [...ALLOWED_EMBEDDING_MODELS].join(", ") +
            ". Open an issue to request additions (the allowlist guards against the protobufjs RCE chain — see research/xenova-reachability.md).",
        },
      )
      .optional(),
  })
  // Path-traversal guard: prd_path MUST resolve inside workspace_path.
  // Without this, a remote HTTP caller could index /etc/passwd or ~/.ssh/config.
  .refine(
    (d) => isInsideWorkspace(d.workspace_path, path.resolve(d.workspace_path, d.prd_path)),
    { message: "prd_path must be inside workspace_path (no traversal)", path: ["prd_path"] },
  );

// ==========================================
// Inferred type aliases — consumed `import type`-only by handler modules,
// so the runtime dependency graph stays one-directional
// (registry.ts → handler modules; type-only back-imports erase at compile).
// ==========================================
export type WorkspaceOnlyInput = z.infer<typeof WorkspaceOnly>;
export type UpdateStateInput = z.infer<typeof UpdateStateArgs>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskArgs>;
export type RollbackTaskInput = z.infer<typeof RollbackTaskArgs>;
export type VoidTaskInput = z.infer<typeof VoidTaskArgs>;
export type AddTaskInput = z.infer<typeof AddTaskArgs>;
export type SwitchRoleInput = z.infer<typeof SwitchRoleArgs>;
export type IndexPrdInput = z.infer<typeof IndexPrdArgs>;

// ==========================================
// TOOL_REGISTRY (T-REG-05) — one defineTool(...) per tool, pairing the
// verbatim-moved hand-written JSON Schema (NOT regenerated from zod —
// Decision 7, AC-1 byte-identical tools/list) with the tool's zod schema
// and its relocated handler. Array order is FROZEN to the pre-refactor
// ListToolsRequestSchema output order (AC-1).
// ==========================================

export const TOOL_REGISTRY: ToolRegistryEntry[] = [
  defineTool({
    name: "tw_get_state",
    description: "Read handoff state JSON. MANDATORY FIRST ACTION. Other tw_* writes blocked if skipped.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
      },
      required: ["workspace_path"],
    },
    zodSchema: WorkspaceOnly,
    handler: handleGetState,
  }),
  defineTool({
    name: "tw_update_state",
    description:
      "Atomic write handoff state. Run at END of task. Subject to ALLOWED_TRANSITIONS — see specs/qa-flow-enforcement-architecture.md.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
        active_feature: {
          type: "string",
          description: "Current ticket/feature",
        },
        status: {
          type: "string",
          enum: ["In_Progress", "PASS", "FAIL", "Blocked"],
          description: 'Execution status. status="PASS" requires agent_id="qa-engineer".',
        },
        completed_tasks: {
          type: "array",
          items: { type: "string" },
          description: "Tasks completed now",
        },
        pending_notes: {
          type: "array",
          items: { type: "string" },
          description: "Notes for next agent",
        },
        blocking_reason: {
          type: "string",
          description: "Required when status=Blocked/FAIL",
        },
        agent_id: {
          type: "string",
          description:
            'Agent name. Validated against ALLOWED_TRANSITIONS. PASS reserved for "qa-engineer".',
        },
        qa_review: {
          type: "string",
          description:
            "Review notes. Recorded as evidence when agent_id=qa-engineer and status in {PASS, FAIL}.",
        },
        review_task_ids: {
          type: "array",
          items: { type: "string" },
          description:
            "Task id(s) under review — the target(s) the qa_review evidence auto-record stamps (file mode: qa_reports/review_<id>.md; SQLite: reports rows). Resolution: review_task_ids if non-empty, else completed_tasks; a qa_review-bearing PASS/FAIL write with both empty is rejected with QA_REVIEW_TARGET_REQUIRED — the server never falls back to \"every open task\". Transient: applies to THIS write only, never persisted (c9-protocol-fields convention). Required in practice on FAIL writes, where completed_tasks is legitimately empty.",
        },
        prd_path: {
          type: "string",
          description:
            "Optional absolute path to the workspace's PRD/spec file. Consumed by the RAG lazy-reindex hook.",
        },
        scope_decision: {
          type: "string",
          enum: ["single-feature"],
          description:
            'Scope attestation. PM sets "single-feature" on its pm:In_Progress write to clear the SCOPE_DECISION_REQUIRED gate when the feature is appropriately scoped as-is (vs creating .current/feature-split.md for a multi-feature split).',
        },
        scope_decision_why: {
          type: "string",
          description:
            "Optional free-text rationale for scope_decision. Recorded for the audit trail; not validated by the server.",
        },
        cut_approved: {
          type: "boolean",
          description:
            "Ticket-cut approval attestation. PM sets cut_approved: true on its pm:In_Progress write AFTER presenting the ticket cut inline in chat and obtaining human approval, to clear the CUT_APPROVAL_REQUIRED gate before routing to architect/sr-engineer. Feature-scoped: re-armed on every PM In_Progress re-entry and on any active_feature change.",
        },
        external_refs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ref: { type: "string" },
              state: {
                type: "string",
                enum: ["fetched", "indexed", "user-confirmed-ignorable", "unresolved"],
              },
            },
            required: ["ref", "state"],
          },
          description:
            "External-reference ledger (file-mode only). Array of {ref, state} entries; state ∈ {fetched, indexed, user-confirmed-ignorable, unresolved}. PM populates this during the Resource Audit Gate — one entry per external artifact the spec references. Passing it REPLACES the array wholesale (not merged). Any entry left unresolved blocks the pm:In_Progress → {architect,sr-engineer}:In_Progress build-entry hop (EXTERNAL_REFS_UNRESOLVED). Absence/empty = zero external refs found = non-blocking. Feature-scoped: preserved across same-feature writes, dropped on active_feature change.",
        },
        next_role: {
          type: "string",
          enum: [
            "pm",
            "researcher",
            "design-auditor",
            "architect",
            "sr-engineer",
            "code-reviewer",
            "qa-engineer",
            "release-engineer",
          ],
          description:
            "Single-hop routing directive: which role should act next. Advisory metadata only — enum-validated but NOT cross-checked against ALLOWED_TRANSITIONS. Transient: applies to THIS write only, never carried forward across writes that omit it. Replaces the legacy 'next_role: <role>' pending_notes line (handoff schema v7).",
        },
        resume_of: {
          type: "string",
          enum: ["code-reviewer", "qa-engineer"],
          description:
            "Amend-Resume declaration: which stranded role a PM mid-chain amendment resumes. The pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress resume edge is accepted ONLY when this field names the exact target role. Transient: applies to THIS write only. Replaces the legacy 'resume_of: <role>' pending_notes line (handoff schema v7).",
        },
        review_verdict: {
          type: "string",
          enum: ["APPROVED", "CHANGES_REQUESTED"],
          description:
            "Code-reviewer verdict. Server-checked for consistency against status (REVIEW_VERDICT_STATUS_MISMATCH): APPROVED requires status=In_Progress; CHANGES_REQUESTED requires status=FAIL. Optional even on code-reviewer writes — absence never fires the gate. Transient: applies to THIS write only. Replaces the legacy 'review: APPROVED|CHANGES_REQUESTED' pending_notes line (handoff schema v7).",
        },
        dispatch_pins: {
          type: "object",
          properties: {
            pm: { type: "string" },
            researcher: { type: "string" },
            "design-auditor": { type: "string" },
            architect: { type: "string" },
            "sr-engineer": { type: "string" },
            "code-reviewer": { type: "string" },
            "qa-engineer": { type: "string" },
            "release-engineer": { type: "string" },
          },
          additionalProperties: false,
          description:
            "Human model-tier pins per role (file-mode only). Object whose keys are the 8 role names (unknown keys rejected) and whose values are free-text model-tier strings (non-empty, ≤100 chars; e.g. \"fable\", \"opus\", or a fully-qualified model id — NOT validated against a model vocabulary). Passing it REPLACES the map wholesale (not merged) — read the existing pins first and include every still-wanted entry. Feature-scoped: preserved across same-feature writes that omit it, dropped on active_feature change, NOT re-armed on PM re-entry. Advisory bookkeeping — no gate. Replaces the legacy 'dispatch_pins: <role>=<model>' pending_notes convention (handoff schema v8).",
        },
        dispatch_mode: {
          type: "string",
          enum: ["feature", "bugfix"],
          description:
            "Ticket dispatch-mode classification (file-mode only). PM sets \"bugfix\" at cut time to mark a repro-first bug-fix ticket: the server then BLOCKS the sr-engineer:In_Progress → code-reviewer:In_Progress fix-phase handoff with REPRO_MANIFEST_MISSING until qa_reports/expected-red_<feature>.txt records the failing reproduction test(s), and QA's Phase 0.5 expected-red disposition becomes load-bearing for PASS. Absence === \"feature\" (the default) — feature-mode chains are unaffected. Feature-scoped: preserved across same-feature writes that omit it, dropped on active_feature change, NOT re-armed on PM re-entry; opt back into the full chain by explicitly setting \"feature\". Never gates a transition edge itself (handoff schema v11).",
        },
        cut_approved_source: {
          type: "string",
          description:
            "Cut-approval inheritance attestation (handoff schema v14, e114-cut-approval-inheritance). Client-settable: the writer's own honest claim that this workspace's cut_approved: true was NOT witnessed in this workspace's own conversation turn but inherited from a parent feature's human approval. Shape: inherited:<parent-feature> — malformed values (missing prefix, empty feature name) are dropped defensively at parse time, never rejected at the boundary. Does NOT satisfy CUT_APPROVAL_REQUIRED or any other gate by itself — recording-only (see spec Out of Scope). Feature-scoped: preserved across same-feature writes that omit it (the dispatch_mode scalar algorithm), dropped on active_feature change, NOT re-armed on PM re-entry. Absence === non-inherited (the safe direction).",
        },
        dispatch_mechanism: {
          type: "string",
          enum: ["task", "switch_role", "inline"],
          description:
            "Per-hop dispatch-mechanism self-attestation (handoff schema v15, file-mode only): which mechanism carried THIS hop — \"task\" (Task-spawned subagent), \"switch_role\" (in-context tw_switch_role), or \"inline\". Attested, not verified. Transient: applies to THIS write only, never carried forward. Recording-only — gates nothing.",
        },
        dispatch_mechanism_tier: {
          type: "string",
          description:
            "Self-reported model tier for THIS hop (handoff schema v15, file-mode only; free text ≤40 chars, e.g. \"fable\", \"opus\" — not validated against a model vocabulary). Companion to dispatch_mechanism; makes a pin-vs-actual mismatch against dispatch_pins visible in the record. Transient: applies to THIS write only. Recording-only — gates nothing.",
        },
        lease_override: {
          type: "boolean",
          description:
            "Human-attested FEATURE_LEASE_HELD bypass (file-mode only, e10-lease-override). Set true ONLY by the context that directly witnessed the human's chat-turn attestation that the incumbent lease is dead (same-context dispatch: the acting role; Task-subagent dispatch: the coordinator — the cut_approved §3.1 trust mechanics, but usable on ANY edge, not build-entry-pinned). The write MUST also carry pending_notes[0] matching /^lease-override:/ with a human-readable reason, or it is rejected with LEASE_OVERRIDE_AUDIT_MISSING. Transient: applies to THIS write only, never persisted, never carried forward — a later write omitting it is evaluated by the normal lease predicate. Ignored in SQLite/HTTP mode.",
        },
        bookkeeping_write: {
          type: "boolean",
          description:
            "Non-substantive-write attestation (file-mode only, e10-lease-override). Set true on a failure-record / administrative-note touch that records no forward progress: the server PRESERVES the existing on-disk last_updated verbatim instead of stamping now(), so the incumbent feature's lease age keeps reflecting the last REAL write. Valid ONLY when this write's active_feature equals the existing on-disk active_feature — a differing-feature combination is rejected with BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE. Transient: applies to THIS write only, never persisted. Ignored in SQLite/HTTP mode.",
        },
      },
      required: ["workspace_path", "active_feature", "status"],
    },
    zodSchema: UpdateStateArgs,
    handler: handleUpdateState,
  }),
  defineTool({
    name: "tw_get_next_task",
    description: "Read next uncompleted task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
      },
      required: ["workspace_path"],
    },
    zodSchema: WorkspaceOnly,
    handler: handleGetNextTask,
  }),
  defineTool({
    name: "tw_complete_task",
    description:
      'Mark task completed [x]. Reserved for qa-engineer — pass agent_id="qa-engineer".',
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
        task_id: {
          type: "string",
          description: "Task ID",
        },
        note: {
          type: "string",
          description: "Optional note",
        },
        agent_id: {
          type: "string",
          description: 'Must be "qa-engineer". Other values rejected.',
        },
      },
      required: ["workspace_path", "task_id"],
    },
    zodSchema: CompleteTaskArgs,
    handler: handleCompleteTask,
  }),
  defineTool({
    name: "tw_add_task",
    description:
      "Append a task to the active task list. Works in both stdio (markdown) and HTTP/SQLite modes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
        task_id: {
          type: "string",
          description: "Unique task ID (e.g. T01, JIRA-42)",
        },
        description: {
          type: "string",
          description: "Task description",
        },
        section: {
          type: "string",
          description: "Optional section heading (defaults to 'Active')",
        },
      },
      required: ["workspace_path", "task_id", "description"],
    },
    zodSchema: AddTaskArgs,
    handler: handleAddTask,
  }),
  defineTool({
    name: "tw_rollback_task",
    description: "Mark task uncompleted [ ]. Require reason.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
        task_id: {
          type: "string",
          description: "Task ID",
        },
        reason: {
          type: "string",
          description: "Rollback reason",
        },
      },
      required: ["workspace_path", "task_id", "reason"],
    },
    zodSchema: RollbackTaskArgs,
    handler: handleRollbackTask,
  }),
  defineTool({
    name: "tw_void_task",
    description:
      "Void a task: mark it as never-should-have-existed (E117), not 'done, then reverted'. " +
      "Only legal on an incomplete [ ] row — an already-completed [x] row is refused (roll it " +
      "back first). A voided row disappears from tw_get_next_task, tw_detect_drift, and tw_sync " +
      "as though it never existed. Its id becomes structurally reusable in a re-cut, but review/QA " +
      "evidence gates are existence-based and not void-aware: a re-cut under the SAME id can inherit " +
      "the voided row's stale evidence artifacts and skip real review. Prefer a fresh id for unrelated work. " +
      "File mode only: re-voiding an already-voided id is refused with an `alreadyVoided: true` flag " +
      "distinguishing it from a plain not-found (the voided marker line is still on disk); SQLite/HTTP mode " +
      "reports both cases as a uniform not-found, with no alreadyVoided distinction.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
        task_id: {
          type: "string",
          description: "Task ID",
        },
        reason: {
          type: "string",
          description: "Why this row should never have existed",
        },
      },
      required: ["workspace_path", "task_id", "reason"],
    },
    zodSchema: VoidTaskArgs,
    handler: handleVoidTask,
  }),
  defineTool({
    name: "tw_detect_drift",
    description: "Check state vs tasks drift. Run after get_state.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
      },
      required: ["workspace_path"],
    },
    zodSchema: WorkspaceOnly,
    handler: handleDetectDrift,
  }),
  defineTool({
    name: "tw_sync",
    description:
      "Reconcile tasks.md checkboxes to the authoritative handoff.completed_tasks " +
      "(handoff → tasks only). Use after background/parallel subagents or inline-coordinator " +
      "execution leaves drift (run tw_detect_drift first). NEVER promotes a tasks.md-only " +
      "completion into handoff (that needs a qa-engineer PASS); vibe-drift is reported, not synced.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
      },
      required: ["workspace_path"],
    },
    zodSchema: WorkspaceOnly,
    handler: handleSync,
  }),
  defineTool({
    name: "tw_switch_role",
    description:
      "Return the named role's SOP text for the agent to read. " +
      "CONTEXT LOADING ONLY — the server does NOT enforce a role swap or block other tools; " +
      "the agent must voluntarily follow the returned SOP. Coordinator calls this to route complex tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
        role: {
          type: "string",
          enum: ["pm", "researcher", "design-auditor", "sr-engineer", "code-reviewer", "qa-engineer", "architect", "doc-writer", "release-engineer"],
          description: "Target role to switch into",
        },
      },
      required: ["workspace_path", "role"],
    },
    zodSchema: SwitchRoleArgs,
    handler: handleSwitchRole,
  }),
  defineTool({
    name: "tw_index_prd",
    description: "Chunk and embed a PRD file into the SQLite RAG index. SQLite mode only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: { type: "string", description: "Absolute workspace path" },
        prd_path: { type: "string", description: "Absolute path to the PRD/spec file to index" },
        embedding_model: { type: "string", description: `Embedding model name (default: ${DEFAULT_EMBEDDING_MODEL})` },
      },
      required: ["workspace_path", "prd_path"],
    },
    zodSchema: IndexPrdArgs,
    handler: handleIndexPrd,
  }),
  defineTool({
    name: "tw_clear_prd_chunks",
    description:
      "Drop all RAG chunks for a workspace. Ops escape hatch for manual GC. SQLite mode only; no-op (informational) in file mode.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: { type: "string", description: "Absolute workspace path" },
      },
      required: ["workspace_path"],
    },
    zodSchema: WorkspaceOnly,
    handler: handleClearPrdChunks,
  }),
  defineTool({
    name: "tw_gate_stats",
    description:
      "Aggregate telemetry.jsonl (gate fires) + metrics.jsonl (per-feature outcomes) across every copy in the " +
      "workspace's .current/ tree (live lanes, closed history lanes, legacy flat; content-duplicate copies skipped, disclosed in caveats) " +
      "into per-gate/per-error-code counts for the E6 rule-retirement retro (docs/gate-retro-procedure.md). " +
      "Read-only; full GATE_REGISTRY coverage (fired + zero-fire). Counts prove GATE-BACKED rules only — " +
      "prose-behavioral rules (§5 read cap, §1 terse cap, dispatch_pins, token brake) are listed separately " +
      "with fires=null: zero fires here NEVER means a prose rule is dead (transcript sampling required).",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_path: {
          type: "string",
          description: "Absolute workspace path",
        },
      },
      required: ["workspace_path"],
    },
    zodSchema: WorkspaceOnly,
    handler: handleGateStats,
  }),
];

// ==========================================
// PROMPT_REGISTRY (T-REG-07) — single source of truth per prompt id:
// feeds BOTH prompts/list (metadata map) and prompts/get (find + build) in
// index.ts, replacing the metadata array and the 11-branch if-chain.
// Order and descriptions are FROZEN to the pre-refactor
// ListPromptsRequestSchema output (AC-4 byte-identical), including the
// `teamwork` / `teamwork-lite` backwards-compat ids mapped to the
// coordinator skill files. Entries are declarative (C6 DR-2): `skillFile`
// names the content/skill-*.md the handler feeds to buildPromptForRole.
// ==========================================

const PROMPT_WORKSPACE_ARG = {
  name: "workspace_path",
  description: "Absolute workspace path (optional — defaults to current project dir)",
  required: false,
} as const;

export const PROMPT_REGISTRY: PromptRegistryEntry[] = [
  {
    name: "sr-engineer",
    description: "Load constitution, skill, state. Run first.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-sr-engineer.md",
  },
  {
    name: "researcher",
    description: "Deep research. Load constitution, skill, state.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-researcher.md",
  },
  {
    name: "pm",
    description: "PM role. Write specs, break down tasks, sync state.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-pm.md",
  },
  {
    name: "qa-engineer",
    description: "QA role. Verify code, write tests, rollback bugs.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-qa-engineer.md",
  },
  {
    name: "teamwork",
    description: "Agent Governance Coordinator. Route tasks or execute them.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-coordinator.md",
  },
  {
    name: "teamwork-lite",
    description: "Coordinator (lite). Solo-dev mode: direct execution, no chain, no state writes.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-coordinator-lite.md",
  },
  {
    name: "architect",
    description: "Architect role. Write system design, interface contracts.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-architect.md",
  },
  {
    name: "design-auditor",
    description: "Design audit. Extract Copy / Visual tokens from any design source.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-design-auditor.md",
  },
  {
    name: "code-reviewer",
    description: "Code review role — clean-context diff judge between sr-engineer and qa-engineer.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-code-reviewer.md",
  },
  {
    name: "doc-writer",
    description: "Documentation maintainer — keeps README / CHANGELOG / docs in sync after PASS.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-doc-writer.md",
  },
  {
    name: "release-engineer",
    description: "Release engineer — owns version bumps, CHANGELOG, git tag, and gh release after PASS.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-release-engineer.md",
  },
  {
    name: "integrator",
    description: "Integrator — plan parallel lanes, pre-review cuts, verify lane reports, merge, tear down. Cross-lane; writes no handoff state.",
    arguments: [PROMPT_WORKSPACE_ARG],
    skillFile: "skill-integrator.md",
  },
];

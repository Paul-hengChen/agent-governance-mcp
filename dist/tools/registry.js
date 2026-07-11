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
import { handleGetState } from "./handoff.js";
import { handleDetectDrift } from "./drift.js";
import { handleSync } from "./sync.js";
import { handleSwitchRole } from "./role.js";
import { handleGetNextTask, handleCompleteTask, handleRollbackTask, handleAddTask, } from "./tasks.js";
import { handleUpdateState } from "./handoff-orchestrator.js";
import { handleIndexPrd, handleClearPrdChunks, DEFAULT_EMBEDDING_MODEL } from "./rag.js";
export function defineTool(spec) {
    return {
        name: spec.name,
        description: spec.description,
        inputSchema: spec.inputSchema,
        // spec.zodSchema is the CONCRETE TSchema (not the erased z.ZodTypeAny),
        // so .parse() returns z.infer<TSchema> — NOT `any` — and feeds a handler
        // typed for exactly that. Erasure to (unknown)=>Promise happens at the
        // `run` boundary. No cast, no `any`, at any point.
        run: (rawArgs) => spec.handler(spec.zodSchema.parse(rawArgs)),
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
        .array(z.object({
        ref: z.string().min(1).max(1000),
        state: z.enum(["fetched", "indexed", "user-confirmed-ignorable", "unresolved"]),
    }))
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
    .refine((d) => {
    if (!d.prd_path)
        return true;
    const rel = path.relative(d.workspace_path, d.prd_path);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}, { message: "prd_path must be inside workspace_path (no traversal)", path: ["prd_path"] })
    // Reject a workspace_path that points at the .current state directory rather
    // than the workspace root. The server appends ".current/handoff.md" to this
    // path; a basename of ".current" would write a doubly-nested
    // .current/.current/handoff.md instead of failing loud.
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
const AddTaskArgs = z.object({
    workspace_path: absoluteWorkspacePath,
    task_id: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    section: z.string().min(1).max(200).optional(),
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
const ALLOWED_EMBEDDING_MODELS = new Set([
    "Xenova/all-MiniLM-L6-v2", // DEFAULT — small, English, 384-d
    "Xenova/bge-small-en-v1.5", // alternative — BGE small English
    "Xenova/multilingual-e5-small", // alternative — multilingual small
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
        .refine((m) => ALLOWED_EMBEDDING_MODELS.has(m), {
        message: "embedding_model must be one of: " +
            [...ALLOWED_EMBEDDING_MODELS].join(", ") +
            ". Open an issue to request additions (the allowlist guards against the protobufjs RCE chain — see research/xenova-reachability.md).",
    })
        .optional(),
})
    // Path-traversal guard: prd_path MUST resolve inside workspace_path.
    // Without this, a remote HTTP caller could index /etc/passwd or ~/.ssh/config.
    .refine((d) => {
    const rel = path.relative(d.workspace_path, d.prd_path);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}, { message: "prd_path must be inside workspace_path (no traversal)", path: ["prd_path"] });
// ==========================================
// TOOL_REGISTRY (T-REG-05) — one defineTool(...) per tool, pairing the
// verbatim-moved hand-written JSON Schema (NOT regenerated from zod —
// Decision 7, AC-1 byte-identical tools/list) with the tool's zod schema
// and its relocated handler. Array order is FROZEN to the pre-refactor
// ListToolsRequestSchema output order (AC-1).
// ==========================================
export const TOOL_REGISTRY = [
    defineTool({
        name: "tw_get_state",
        description: "Read handoff state JSON. MANDATORY FIRST ACTION. Other tw_* writes blocked if skipped.",
        inputSchema: {
            type: "object",
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
        description: "Atomic write handoff state. Run at END of task. Subject to ALLOWED_TRANSITIONS — see specs/qa-flow-enforcement-architecture.md.",
        inputSchema: {
            type: "object",
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
                    description: 'Agent name. Validated against ALLOWED_TRANSITIONS. PASS reserved for "qa-engineer".',
                },
                qa_review: {
                    type: "string",
                    description: "Review notes. Recorded as evidence when agent_id=qa-engineer and status in {PASS, FAIL}.",
                },
                review_task_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Task id(s) under review — the target(s) the qa_review evidence auto-record stamps (file mode: qa_reports/review_<id>.md; SQLite: reports rows). Resolution: review_task_ids if non-empty, else completed_tasks; a qa_review-bearing PASS/FAIL write with both empty is rejected with QA_REVIEW_TARGET_REQUIRED — the server never falls back to \"every open task\". Transient: applies to THIS write only, never persisted (c9-protocol-fields convention). Required in practice on FAIL writes, where completed_tasks is legitimately empty.",
                },
                prd_path: {
                    type: "string",
                    description: "Optional absolute path to the workspace's PRD/spec file. Consumed by the RAG lazy-reindex hook.",
                },
                scope_decision: {
                    type: "string",
                    enum: ["single-feature"],
                    description: 'Scope attestation. PM sets "single-feature" on its pm:In_Progress write to clear the SCOPE_DECISION_REQUIRED gate when the feature is appropriately scoped as-is (vs creating .current/feature-split.md for a multi-feature split).',
                },
                scope_decision_why: {
                    type: "string",
                    description: "Optional free-text rationale for scope_decision. Recorded for the audit trail; not validated by the server.",
                },
                cut_approved: {
                    type: "boolean",
                    description: "Ticket-cut approval attestation. PM sets cut_approved: true on its pm:In_Progress write AFTER presenting the ticket cut inline in chat and obtaining human approval, to clear the CUT_APPROVAL_REQUIRED gate before routing to architect/sr-engineer. Feature-scoped: re-armed on every PM In_Progress re-entry and on any active_feature change.",
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
                    description: "External-reference ledger (file-mode only). Array of {ref, state} entries; state ∈ {fetched, indexed, user-confirmed-ignorable, unresolved}. PM populates this during the Resource Audit Gate — one entry per external artifact the spec references. Passing it REPLACES the array wholesale (not merged). Any entry left unresolved blocks the pm:In_Progress → {architect,sr-engineer}:In_Progress build-entry hop (EXTERNAL_REFS_UNRESOLVED). Absence/empty = zero external refs found = non-blocking. Feature-scoped: preserved across same-feature writes, dropped on active_feature change.",
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
                    description: "Single-hop routing directive: which role should act next. Advisory metadata only — enum-validated but NOT cross-checked against ALLOWED_TRANSITIONS. Transient: applies to THIS write only, never carried forward across writes that omit it. Replaces the legacy 'next_role: <role>' pending_notes line (handoff schema v7).",
                },
                resume_of: {
                    type: "string",
                    enum: ["code-reviewer", "qa-engineer"],
                    description: "Amend-Resume declaration: which stranded role a PM mid-chain amendment resumes. The pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress resume edge is accepted ONLY when this field names the exact target role. Transient: applies to THIS write only. Replaces the legacy 'resume_of: <role>' pending_notes line (handoff schema v7).",
                },
                review_verdict: {
                    type: "string",
                    enum: ["APPROVED", "CHANGES_REQUESTED"],
                    description: "Code-reviewer verdict. Server-checked for consistency against status (REVIEW_VERDICT_STATUS_MISMATCH): APPROVED requires status=In_Progress; CHANGES_REQUESTED requires status=FAIL. Optional even on code-reviewer writes — absence never fires the gate. Transient: applies to THIS write only. Replaces the legacy 'review: APPROVED|CHANGES_REQUESTED' pending_notes line (handoff schema v7).",
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
                    description: "Human model-tier pins per role (file-mode only). Object whose keys are the 8 role names (unknown keys rejected) and whose values are free-text model-tier strings (non-empty, ≤100 chars; e.g. \"fable\", \"opus\", or a fully-qualified model id — NOT validated against a model vocabulary). Passing it REPLACES the map wholesale (not merged) — read the existing pins first and include every still-wanted entry. Feature-scoped: preserved across same-feature writes that omit it, dropped on active_feature change, NOT re-armed on PM re-entry. Advisory bookkeeping — no gate. Replaces the legacy 'dispatch_pins: <role>=<model>' pending_notes convention (handoff schema v8).",
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
            type: "object",
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
        description: 'Mark task completed [x]. Reserved for qa-engineer — pass agent_id="qa-engineer".',
        inputSchema: {
            type: "object",
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
        description: "Append a task to the active task list. Works in both stdio (markdown) and HTTP/SQLite modes.",
        inputSchema: {
            type: "object",
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
            type: "object",
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
        name: "tw_detect_drift",
        description: "Check state vs tasks drift. Run after get_state.",
        inputSchema: {
            type: "object",
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
        description: "Reconcile tasks.md checkboxes to the authoritative handoff.completed_tasks " +
            "(handoff → tasks only). Use after background/parallel subagents or inline-coordinator " +
            "execution leaves drift (run tw_detect_drift first). NEVER promotes a tasks.md-only " +
            "completion into handoff (that needs a qa-engineer PASS); vibe-drift is reported, not synced.",
        inputSchema: {
            type: "object",
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
        description: "Return the named role's SOP text for the agent to read. " +
            "CONTEXT LOADING ONLY — the server does NOT enforce a role swap or block other tools; " +
            "the agent must voluntarily follow the returned SOP. Coordinator calls this to route complex tasks.",
        inputSchema: {
            type: "object",
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
            type: "object",
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
        description: "Drop all RAG chunks for a workspace. Ops escape hatch for manual GC. SQLite mode only; no-op (informational) in file mode.",
        inputSchema: {
            type: "object",
            properties: {
                workspace_path: { type: "string", description: "Absolute workspace path" },
            },
            required: ["workspace_path"],
        },
        zodSchema: WorkspaceOnly,
        handler: handleClearPrdChunks,
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
};
export const PROMPT_REGISTRY = [
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
];
//# sourceMappingURL=registry.js.map
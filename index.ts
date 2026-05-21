#!/usr/bin/env node
// Agent Governance MCP — 3-Layer Defense Architecture
// Layer 1: MCP Prompts (auto-inject constitution + skill + state)
// Layer 2: Structured Tools (8 tw_* tools for state/task/drift/role)
// Layer 3: Server-side Guards (pre-flight check enforcement)
// Methodology-agnostic: defaults to a generic markdown checkbox task format;
// teams override task pattern / paths / constitution via <workspace>/.current/.

import * as path from "node:path";
import * as fs from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHttpTransport } from "./transport/http.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { getNextTask, completeTask, rollbackTask, addTask } from "./tools/tasks.js";
import { detectDrift } from "./tools/drift.js";
import { enforcePreFlight, cleanupStaleSessions } from "./guards/session.js";
import { getActiveStorage, setActiveStorage } from "./tools/storage.js";
import { buildSrEngineerPrompt } from "./prompts/sr-engineer.js";
import { buildResearcherPrompt } from "./prompts/researcher.js";
import { buildPmPrompt } from "./prompts/pm.js";
import { buildQaEngineerPrompt } from "./prompts/qa-engineer.js";
import { buildCoordinatorPrompt } from "./prompts/coordinator.js";
import { buildCoordinatorLitePrompt } from "./prompts/coordinator-lite.js";
import { buildArchitectPrompt } from "./prompts/architect.js";
import { switchRole, type RoleName } from "./tools/role.js";
import { appendSpecContext } from "./prompts/build.js";
import { buildPrdChunks, CHUNKER_VERSION, DEFAULT_EMBEDDING_MODEL } from "./tools/rag.js";
import {
  getInflightKey,
  getInflight,
  setInflight,
  deleteInflight,
  awaitAllInflightFor,
} from "./tools/rag-coalesce.js";
import {
  requireQaEngineer,
  validateTransition,
  computeNewRound,
  type AgentName,
  type StatusName,
  type TransitionTuple,
} from "./tools/transitions.js";

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
      const rel = path.relative(d.workspace_path, d.prd_path);
      return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    },
    { message: "prd_path must be inside workspace_path (no traversal)", path: ["prd_path"] },
  );

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
  role: z.enum(["pm", "researcher", "sr-engineer", "qa-engineer", "architect"]),
});

// Model name allowlist regex: HuggingFace-style "namespace/model-name" with
// alphanumerics, dot, underscore, dash, slash. Bounds user-supplied input
// before it reaches the dynamic loader.
const EMBEDDING_MODEL_RE = /^[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-]+$/;

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
      .optional(),
  })
  // Path-traversal guard: prd_path MUST resolve inside workspace_path.
  // Without this, a remote HTTP caller could index /etc/passwd or ~/.ssh/config.
  .refine(
    (d) => {
      const rel = path.relative(d.workspace_path, d.prd_path);
      return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    },
    { message: "prd_path must be inside workspace_path (no traversal)", path: ["prd_path"] },
  );

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

// In-flight indexing coalesce map is now in tools/rag-coalesce.ts so both
// tw_index_prd and the lazy reindex in appendSpecContext share it.

// ==========================================
// 1. Initialize Server (Tools + Prompts)
// ==========================================
// Storage adapter defaults to FileHandoffStorage; HTTP-mode boot switches it via setActiveStorage().
const server = new Server(
  { name: "agent-governance-mcp", version: "3.7.4" },
  { capabilities: { tools: {}, prompts: {} } }
);

// ==========================================
// 2. Register Prompts (Layer 1: Auto-inject constitution)
// ==========================================
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "sr-engineer",
        description: "Load constitution, skill, state. Run first.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
      {
        name: "researcher",
        description: "Deep research. Load constitution, skill, state.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
      {
        name: "pm",
        description: "PM role. Write specs, break down tasks, sync state.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
      {
        name: "qa-engineer",
        description: "QA role. Verify code, write tests, rollback bugs.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
      {
        name: "teamwork",
        description: "Agent Governance Coordinator. Route tasks or execute them.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
      {
        name: "teamwork-lite",
        description: "Coordinator (lite). Solo-dev mode: direct execution, no chain, no state writes.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
      {
        name: "architect",
        description: "Architect role. Write system design, interface contracts.",
        arguments: [
          {
            name: "workspace_path",
            description: "Absolute workspace path (optional — defaults to current project dir)",
            required: false,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Fallback: CLAUDE_PROJECT_DIR (set by Claude Code) or cwd
  const resolvedPath =
    (typeof args?.workspace_path === "string" && args.workspace_path) ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd();

  let promptResult;
  if (name === "sr-engineer") {
    promptResult = buildSrEngineerPrompt(resolvedPath);
  } else if (name === "researcher") {
    promptResult = buildResearcherPrompt(resolvedPath);
  } else if (name === "pm") {
    promptResult = buildPmPrompt(resolvedPath);
  } else if (name === "qa-engineer") {
    promptResult = buildQaEngineerPrompt(resolvedPath);
  } else if (name === "teamwork") {
    promptResult = buildCoordinatorPrompt(resolvedPath);
  } else if (name === "teamwork-lite") {
    promptResult = buildCoordinatorLitePrompt(resolvedPath);
  } else if (name === "architect") {
    promptResult = buildArchitectPrompt(resolvedPath);
  } else {
    throw new Error(`Prompt not found: ${name}`);
  }
  return appendSpecContext(promptResult, resolvedPath, name);
});

// ==========================================
// 3. Register Tools (Layer 2: Structured APIs)
// ==========================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
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
      },
      {
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
            prd_path: {
              type: "string",
              description:
                "Optional absolute path to the workspace's PRD/spec file. Consumed by the RAG lazy-reindex hook.",
            },
          },
          required: ["workspace_path", "active_feature", "status"],
        },
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
              enum: ["pm", "researcher", "sr-engineer", "qa-engineer", "architect"],
              description: "Target role to switch into",
            },
          },
          required: ["workspace_path", "role"],
        },
      },
      {
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
      },
      {
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
      },
    ],
  };
});

// ==========================================
// 4. Tool Execution (Layer 3: Server-side Guards)
// ==========================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // --- No guard: reading state IS the pre-flight check ---
      case "tw_get_state": {
        const { workspace_path } = WorkspaceOnly.parse(args);
        const result = getActiveStorage().readState(workspace_path);
        return { content: [{ type: "text" as const, text: result }] };
      }

      // --- No guard: drift detection is read-only ---
      case "tw_detect_drift": {
        const { workspace_path } = WorkspaceOnly.parse(args);
        const result = detectDrift(workspace_path);
        return { content: [{ type: "text" as const, text: result }] };
      }

      // --- No guard: role switching is read-only ---
      case "tw_switch_role": {
        const { workspace_path, role } = SwitchRoleArgs.parse(args);
        const result = switchRole(role as RoleName, workspace_path);
        return { content: [{ type: "text" as const, text: result }] };
      }

      // --- No guard: getting next task is read-only ---
      case "tw_get_next_task": {
        const { workspace_path } = WorkspaceOnly.parse(args);
        const result = getNextTask(workspace_path);
        return { content: [{ type: "text" as const, text: result }] };
      }

      // --- GUARDED: must call tw_get_state first ---
      case "tw_update_state": {
        const parsed = UpdateStateArgs.parse(args);
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
        const prevTuple: TransitionTuple = {
          agent: (prevState?.last_agent as AgentName | undefined) ?? null,
          status: (prevState?.status as StatusName | undefined) ?? null,
        };
        const nextTuple: TransitionTuple = {
          agent: (parsed.agent_id as AgentName | undefined) ?? null,
          status: parsed.status,
        };

        const rejection = validateTransition({ prev: prevTuple, next: nextTuple, prev_qa_round });
        if (rejection) {
          return {
            content: [{ type: "text" as const, text: `⛔ ${rejection.error}\n${JSON.stringify(rejection, null, 2)}` }],
            isError: true,
          };
        }

        // Evidence record FIRST so the PASS gate below can observe the row /
        // file just written. Only fires when QA attaches qa_review on a
        // PASS or FAIL write.
        if (
          parsed.qa_review &&
          parsed.agent_id === "qa-engineer" &&
          (parsed.status === "PASS" || parsed.status === "FAIL")
        ) {
          let ids = parsed.completed_tasks;
          if (ids.length === 0) {
            const all = storage.listTasks(parsed.workspace_path);
            ids = all ? all.filter((t) => !t.completed).map((t) => t.id) : [];
          }
          if (ids.length > 0) {
            await storage.recordReview(parsed.workspace_path, ids, parsed.status, "qa-engineer", parsed.qa_review);
          }
        }

        // Evidence gate for PASS path
        if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
          const ev = await storage.hasEvidence(parsed.workspace_path, parsed.completed_tasks);
          if (ev.missing.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text: `⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. Provide qa_review or write qa_reports/review_<id>.md (file mode) / insert reports row (SQLite) before PASS.`,
              }],
              isError: true,
            };
          }
        }

        const new_qa_round = computeNewRound(prev_qa_round, nextTuple);
        const pending = [...parsed.pending_notes];
        if (new_qa_round === 4 && prev_qa_round === 3) {
          pending.unshift("⛔ Round 4: forced rollback to pm — no further QA allowed until PM resets.");
        }

        const result = await storage.writeState(
          parsed.workspace_path,
          parsed.active_feature,
          parsed.status,
          parsed.completed_tasks,
          pending,
          parsed.blocking_reason,
          parsed.agent_id,
          new_qa_round,
          parsed.prd_path,
        );

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

        return { content: [{ type: "text" as const, text: result }] };
      }

      case "tw_complete_task": {
        const parsed = CompleteTaskArgs.parse(args);
        enforcePreFlight(parsed.workspace_path, "tw_complete_task");
        const gate = requireQaEngineer(parsed.agent_id, "tw_complete_task");
        if (!gate.ok) {
          return { content: [{ type: "text" as const, text: gate.message ?? "blocked" }] };
        }
        const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
        return { content: [{ type: "text" as const, text: result }] };
      }

      case "tw_rollback_task": {
        const parsed = RollbackTaskArgs.parse(args);
        enforcePreFlight(parsed.workspace_path, "tw_rollback_task");
        const result = await rollbackTask(parsed.workspace_path, parsed.task_id, parsed.reason);
        return { content: [{ type: "text" as const, text: result }] };
      }

      case "tw_add_task": {
        const parsed = AddTaskArgs.parse(args);
        enforcePreFlight(parsed.workspace_path, "tw_add_task");
        const result = await addTask(
          parsed.workspace_path,
          parsed.task_id,
          parsed.description,
          parsed.section,
        );
        return { content: [{ type: "text" as const, text: result }] };
      }

      case "tw_index_prd": {
        const parsed = IndexPrdArgs.parse(args);
        const storage = getActiveStorage();
        if (!("upsertPrdChunks" in storage) || typeof (storage as Record<string, unknown>).upsertPrdChunks !== "function") {
          return { content: [{ type: "text" as const, text: "❌ tw_index_prd requires SQLite mode (--port flag). Not available in stdio/file mode." }], isError: true };
        }
        const model = parsed.embedding_model ?? DEFAULT_EMBEDDING_MODEL;
        const ragStorage = storage as unknown as {
          getPrdIndexMeta(wp: string): { prd_mtime: number; chunker_version: string; embedding_model: string } | null;
          upsertPrdChunks(wp: string, chunks: import("./tools/rag.js").PrdChunk[]): void;
        };

        // Concurrency guard: coalesce duplicate in-flight indexings for the
        // same (workspace, prd_path). Without this, two parallel HTTP calls
        // both run the slow embedding pipeline and race on DELETE+INSERT.
        // The registry is also shared with prompts/build.ts:appendSpecContext
        // so its lazy reindex coalesces with explicit tw_index_prd calls.
        const inflightKey = getInflightKey(parsed.workspace_path, parsed.prd_path);
        const existing = getInflight(inflightKey);
        if (existing) {
          const text = await existing;
          return { content: [{ type: "text" as const, text }] };
        }

        const run = (async (): Promise<string> => {
          const currentMtime = fs.existsSync(parsed.prd_path)
            ? Math.floor(fs.statSync(parsed.prd_path).mtimeMs)
            : -1;
          const existingMeta = ragStorage.getPrdIndexMeta(parsed.workspace_path);
          if (
            existingMeta &&
            existingMeta.prd_mtime === currentMtime &&
            existingMeta.chunker_version === CHUNKER_VERSION &&
            existingMeta.embedding_model === model
          ) {
            return JSON.stringify({ upToDate: true, message: "Index is current — no reindex needed." });
          }
          const result = await buildPrdChunks(parsed.prd_path, model);
          if ("error" in result) {
            return `❌ ${result.error}`;
          }
          ragStorage.upsertPrdChunks(parsed.workspace_path, result);
          return JSON.stringify({ indexed: true, chunks: result.length, model, chunker_version: CHUNKER_VERSION });
        })();

        setInflight(inflightKey, run);
        try {
          const text = await run;
          return {
            content: [{ type: "text" as const, text }],
            ...(text.startsWith("❌") ? { isError: true } : {}),
          };
        } finally {
          deleteInflight(inflightKey);
        }
      }

      case "tw_clear_prd_chunks": {
        const { workspace_path } = WorkspaceOnly.parse(args);
        const storage = getActiveStorage();
        if (
          !("deletePrdChunks" in storage) ||
          typeof (storage as Record<string, unknown>).deletePrdChunks !== "function"
        ) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                supported: false,
                message: "tw_clear_prd_chunks requires SQLite mode (--port flag). No chunks in file mode.",
              }),
            }],
          };
        }
        // Await any in-flight reindex for this workspace so DELETE cannot
        // race with a concurrent INSERT inside upsertPrdChunks.
        await awaitAllInflightFor(workspace_path);
        const ragStorage = storage as unknown as { deletePrdChunks(wp: string): number };
        const deleted = ragStorage.deletePrdChunks(workspace_path);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ supported: true, cleared: true, deleted_rows: deleted }),
          }],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `❌ Tool not found: ${name}` }],
          isError: true,
        };
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        content: [
          { type: "text" as const, text: `❌ Invalid arguments for ${name}: ${formatZodError(error)}` },
        ],
        isError: true,
      };
    }
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
});

// ==========================================
// 5. Start Server
// ==========================================
// Evict sessions idle for more than 1 hour to prevent unbounded memory growth
setInterval(() => cleanupStaleSessions(60 * 60 * 1000), 30 * 60 * 1000).unref();

(async () => {
  try {
    const portArgIndex = process.argv.indexOf("--port");
    const portRaw = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : undefined;

    if (portRaw !== undefined) {
      // --port was given — fail fast on bad input rather than silently falling back to stdio.
      if (!/^\d+$/.test(portRaw)) {
        throw new Error(`Invalid --port value: "${portRaw}". Must be an integer 1–65535.`);
      }
      const port = parseInt(portRaw, 10);
      if (port < 1 || port > 65535) {
        throw new Error(`Invalid --port value: ${port}. Must be 1–65535.`);
      }

      const dbArgIndex = process.argv.indexOf("--db");
      const dbPath = dbArgIndex !== -1 ? process.argv[dbArgIndex + 1] : path.join(process.cwd(), "agc.db");
      // Lazy load: HTTP mode is the only path that needs better-sqlite3 (a
      // native module). Stdio users on machines without build tools shouldn't
      // pay for it, hence it's an optionalDependency + dynamic import.
      let SqliteHandoffStorage: typeof import("./tools/storage-sqlite.js").SqliteHandoffStorage;
      try {
        ({ SqliteHandoffStorage } = await import("./tools/storage-sqlite.js"));
      } catch (err) {
        throw new Error(
          "HTTP mode requires better-sqlite3 but it is not installed. " +
            "Reinstall with `npm install better-sqlite3` (needs Python + C++ toolchain on first build). " +
            `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const sqliteStorage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(sqliteStorage);

      const authToken = process.env.TW_AUTH_TOKEN?.trim() || undefined;
      const allowedOrigins =
        process.env.TW_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

      if (!authToken) {
        console.error(
          "⚠️  WARNING: HTTP mode started with no TW_AUTH_TOKEN. " +
            "The /mcp endpoint is unauthenticated — anyone reaching this port can read/write " +
            "handoff state for any workspace_path. Set TW_AUTH_TOKEN before exposing beyond localhost.",
        );
      }

      const { transport, listen, close } = createHttpTransport(port, { authToken, allowedOrigins });
      await listen();
      await server.connect(transport);
      console.error(`🛡️ Agent Governance MCP is online (HTTP :${port}). MCP endpoint: http://localhost:${port}/mcp`);
      console.error(`   Storage: SQLite → ${dbPath}`);
      console.error(`   Auth: ${authToken ? "Bearer token required" : "DISABLED"}`);
      console.error(`   Allowed Origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(", ") : "(any)"}`);

      let shuttingDown = false;
      const shutdown = (signal: NodeJS.Signals): void => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.error(`\n📴 Received ${signal}, shutting down…`);
        // Hard-cap shutdown at 10s so a stuck SSE stream or DB checkpoint
        // can't keep the process alive past the supervisor's grace period.
        const forceExit = setTimeout(() => {
          console.error("⏱️  Shutdown timed out after 10s, forcing exit.");
          process.exit(1);
        }, 10_000);
        forceExit.unref();

        close()
          .catch((err: unknown) => console.error("HTTP close error:", err))
          .finally(() => {
            try {
              sqliteStorage.close();
            } catch (err: unknown) {
              console.error("SQLite close error:", err);
            }
            clearTimeout(forceExit);
            process.exit(0);
          });
      };
      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
    } else {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("🛡️ Agent Governance MCP is online. (Tools + Prompts + Guards)");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error("❌ Agent Governance MCP failed to start:", message);
    process.exit(1);
  }
})();

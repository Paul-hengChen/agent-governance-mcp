#!/usr/bin/env node
// Teamwork MCP Server — 3-Layer Defense Architecture
// Layer 1: MCP Prompts (auto-inject constitution + skill + state)
// Layer 2: Structured Tools (6 tools for state/task/drift)
// Layer 3: Server-side Guards (pre-flight check enforcement)
// Methodology-agnostic: defaults to a generic markdown checkbox task format;
// teams override task pattern / paths / constitution via <workspace>/.current/.

import * as path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { readHandoffState, writeHandoffState } from "./tools/handoff.js";
import { getNextTask, completeTask, rollbackTask } from "./tools/tasks.js";
import { detectDrift } from "./tools/drift.js";
import { enforcePreFlight, cleanupStaleSessions } from "./guards/session.js";
import { buildSrEngineerPrompt } from "./prompts/sr-engineer.js";
import { buildResearcherPrompt } from "./prompts/researcher.js";
import { buildPmPrompt } from "./prompts/pm.js";
import { buildQaEngineerPrompt } from "./prompts/qa-engineer.js";
import { buildTeamworkPrompt } from "./prompts/teamwork.js";
import { switchRole, type RoleName } from "./tools/role.js";

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

const UpdateStateArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  active_feature: z.string().min(1).max(500),
  status: z.enum(["In_Progress", "PASS", "FAIL", "Blocked"]),
  completed_tasks: z.array(z.string()).optional().default([]),
  pending_notes: z.array(z.string()).optional().default([]),
  blocking_reason: z.string().max(2000).optional(),
  agent_id: z.string().max(200).optional(),
});

const CompleteTaskArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  task_id: z.string().min(1),
  note: z.string().optional(),
});

const RollbackTaskArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  task_id: z.string().min(1),
  reason: z.string().min(1),
});

const SwitchRoleArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  role: z.enum(["pm", "researcher", "sr-engineer", "qa-engineer"]),
});

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

// ==========================================
// 1. Initialize Server (Tools + Prompts)
// ==========================================
const server = new Server(
  { name: "teamwork-mcp-server", version: "3.0.0" },
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
        description: "Teamwork Coordinator. Route tasks or execute them.",
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

  if (name === "sr-engineer") {
    return buildSrEngineerPrompt(resolvedPath);
  } else if (name === "researcher") {
    return buildResearcherPrompt(resolvedPath);
  } else if (name === "pm") {
    return buildPmPrompt(resolvedPath);
  } else if (name === "qa-engineer") {
    return buildQaEngineerPrompt(resolvedPath);
  } else if (name === "teamwork") {
    return buildTeamworkPrompt(resolvedPath);
  }

  throw new Error(`Prompt not found: ${name}`);
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
        description: "Atomic write handoff state. Run at END of task.",
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
              description: "Execution status",
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
              description: "Agent ID",
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
        description: "Mark task completed [x].",
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
          },
          required: ["workspace_path", "task_id"],
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
              enum: ["pm", "researcher", "sr-engineer", "qa-engineer"],
              description: "Target role to switch into",
            },
          },
          required: ["workspace_path", "role"],
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
        const result = readHandoffState(workspace_path);
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
        const result = await writeHandoffState(
          parsed.workspace_path,
          parsed.active_feature,
          parsed.status,
          parsed.completed_tasks,
          parsed.pending_notes,
          parsed.blocking_reason,
          parsed.agent_id,
        );
        return { content: [{ type: "text" as const, text: result }] };
      }

      case "tw_complete_task": {
        const parsed = CompleteTaskArgs.parse(args);
        enforcePreFlight(parsed.workspace_path, "tw_complete_task");
        const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
        return { content: [{ type: "text" as const, text: result }] };
      }

      case "tw_rollback_task": {
        const parsed = RollbackTaskArgs.parse(args);
        enforcePreFlight(parsed.workspace_path, "tw_rollback_task");
        const result = await rollbackTask(parsed.workspace_path, parsed.task_id, parsed.reason);
        return { content: [{ type: "text" as const, text: result }] };
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

const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => {
    console.error("🛡️ Teamwork MCP Server is online. (Tools + Prompts + Guards)");
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error("❌ Teamwork MCP Server failed to start:", message);
    process.exit(1);
  });

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
import { ListToolsRequestSchema, CallToolRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
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
function formatZodError(err) {
    return err.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
}
// ==========================================
// 1. Initialize Server (Tools + Prompts)
// ==========================================
const server = new Server({ name: "teamwork-mcp-server", version: "2.0.0" }, { capabilities: { tools: {}, prompts: {} } });
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
                        description: "Absolute workspace path",
                        required: true,
                    },
                ],
            },
            {
                name: "researcher",
                description: "Deep research. Load constitution, skill, state.",
                arguments: [
                    {
                        name: "workspace_path",
                        description: "Absolute workspace path",
                        required: true,
                    },
                ],
            },
            {
                name: "pm",
                description: "PM role. Write specs, break down tasks, sync state.",
                arguments: [
                    {
                        name: "workspace_path",
                        description: "Absolute workspace path",
                        required: true,
                    },
                ],
            },
            {
                name: "qa-engineer",
                description: "QA role. Verify code, write tests, rollback bugs.",
                arguments: [
                    {
                        name: "workspace_path",
                        description: "Absolute workspace path",
                        required: true,
                    },
                ],
            },
            {
                name: "teamwork",
                description: "Teamwork Coordinator. Route tasks or execute them.",
                arguments: [
                    {
                        name: "workspace_path",
                        description: "Absolute workspace path",
                        required: true,
                    },
                ],
            },
        ],
    };
});
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "sr-engineer") {
        const workspacePath = args?.workspace_path;
        if (!workspacePath || typeof workspacePath !== "string") {
            throw new Error("workspace_path is required for sr-engineer prompt.");
        }
        return buildSrEngineerPrompt(workspacePath);
    }
    else if (name === "researcher") {
        const workspacePath = args?.workspace_path;
        if (!workspacePath || typeof workspacePath !== "string") {
            throw new Error("workspace_path is required for researcher prompt.");
        }
        return buildResearcherPrompt(workspacePath);
    }
    else if (name === "pm") {
        const workspacePath = args?.workspace_path;
        if (!workspacePath || typeof workspacePath !== "string") {
            throw new Error("workspace_path is required for pm prompt.");
        }
        return buildPmPrompt(workspacePath);
    }
    else if (name === "qa-engineer") {
        const workspacePath = args?.workspace_path;
        if (!workspacePath || typeof workspacePath !== "string") {
            throw new Error("workspace_path is required for qa-engineer prompt.");
        }
        return buildQaEngineerPrompt(workspacePath);
    }
    else if (name === "teamwork") {
        const workspacePath = args?.workspace_path;
        if (!workspacePath || typeof workspacePath !== "string") {
            throw new Error("workspace_path is required for teamwork prompt.");
        }
        return buildTeamworkPrompt(workspacePath);
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
                    type: "object",
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
                    type: "object",
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
                    },
                    required: ["workspace_path", "task_id"],
                },
            },
            {
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
            },
            {
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
                return { content: [{ type: "text", text: result }] };
            }
            // --- No guard: drift detection is read-only ---
            case "tw_detect_drift": {
                const { workspace_path } = WorkspaceOnly.parse(args);
                const result = detectDrift(workspace_path);
                return { content: [{ type: "text", text: result }] };
            }
            // --- No guard: getting next task is read-only ---
            case "tw_get_next_task": {
                const { workspace_path } = WorkspaceOnly.parse(args);
                const result = getNextTask(workspace_path);
                return { content: [{ type: "text", text: result }] };
            }
            // --- GUARDED: must call tw_get_state first ---
            case "tw_update_state": {
                const parsed = UpdateStateArgs.parse(args);
                enforcePreFlight(parsed.workspace_path, "tw_update_state");
                const result = await writeHandoffState(parsed.workspace_path, parsed.active_feature, parsed.status, parsed.completed_tasks, parsed.pending_notes, parsed.blocking_reason, parsed.agent_id);
                return { content: [{ type: "text", text: result }] };
            }
            case "tw_complete_task": {
                const parsed = CompleteTaskArgs.parse(args);
                enforcePreFlight(parsed.workspace_path, "tw_complete_task");
                const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
                return { content: [{ type: "text", text: result }] };
            }
            case "tw_rollback_task": {
                const parsed = RollbackTaskArgs.parse(args);
                enforcePreFlight(parsed.workspace_path, "tw_rollback_task");
                const result = await rollbackTask(parsed.workspace_path, parsed.task_id, parsed.reason);
                return { content: [{ type: "text", text: result }] };
            }
            default:
                return {
                    content: [{ type: "text", text: `❌ Tool not found: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return {
                content: [
                    { type: "text", text: `❌ Invalid arguments for ${name}: ${formatZodError(error)}` },
                ],
                isError: true,
            };
        }
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        return {
            content: [{ type: "text", text: message }],
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
    .catch((err) => {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error("❌ Teamwork MCP Server failed to start:", message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
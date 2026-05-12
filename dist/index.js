#!/usr/bin/env node
// Teamwork MCP Server — 3-Layer Defense Architecture
// Layer 1: MCP Prompts (auto-inject constitution + skill + state)
// Layer 2: Structured Tools (6 tools for state/task/drift)
// Layer 3: Server-side Guards (pre-flight check enforcement)
// Methodology-agnostic: defaults to a generic markdown checkbox task format;
// teams override task pattern / paths / constitution via <workspace>/.current/.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readHandoffState, writeHandoffState } from "./tools/handoff.js";
import { getNextTask, completeTask, rollbackTask } from "./tools/tasks.js";
import { detectDrift } from "./tools/drift.js";
import { enforcePreFlight } from "./guards/session.js";
import { buildSrEngineerPrompt } from "./prompts/sr-engineer.js";
// ==========================================
// Runtime validation schemas (zod)
// ==========================================
const WorkspaceOnly = z.object({
    workspace_path: z.string().min(1, "workspace_path must be a non-empty string"),
});
const UpdateStateArgs = z.object({
    workspace_path: z.string().min(1),
    active_feature: z.string().min(1),
    status: z.enum(["In_Progress", "PASS", "FAIL", "Blocked"]),
    completed_tasks: z.array(z.string()).optional().default([]),
    pending_notes: z.array(z.string()).optional().default([]),
});
const CompleteTaskArgs = z.object({
    workspace_path: z.string().min(1),
    task_id: z.string().min(1),
    note: z.string().optional(),
});
const RollbackTaskArgs = z.object({
    workspace_path: z.string().min(1),
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
                description: "Activate sr-engineer mode. Auto-loads the workspace constitution, skill definition, and current project state. Use this at the start of any coding session.",
                arguments: [
                    {
                        name: "workspace_path",
                        description: "Absolute path to the project workspace",
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
    throw new Error(`Prompt not found: ${name}`);
});
// ==========================================
// 3. Register Tools (Layer 2: Structured APIs)
// ==========================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "sdd_get_state",
                description: "Read the current project handoff state (.current/handoff.md) as structured JSON. " +
                    "MUST be called as your VERY FIRST ACTION before any code modification. " +
                    "If you skip this, subsequent state-modifying tools will be BLOCKED.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspace_path: {
                            type: "string",
                            description: "Absolute path to the project workspace",
                        },
                    },
                    required: ["workspace_path"],
                },
            },
            {
                name: "sdd_update_state",
                description: "Atomically update the project handoff state. Format is enforced server-side — " +
                    "no matter what you pass, the output will be valid YAML frontmatter + Markdown checkboxes. " +
                    "Call this at the END of every task execution.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspace_path: {
                            type: "string",
                            description: "Absolute path to the project workspace",
                        },
                        active_feature: {
                            type: "string",
                            description: "Current feature or ticket (e.g., 'Ticket #123' or 'auth-module')",
                        },
                        status: {
                            type: "string",
                            enum: ["In_Progress", "PASS", "FAIL", "Blocked"],
                            description: "Current execution status",
                        },
                        completed_tasks: {
                            type: "array",
                            items: { type: "string" },
                            description: "Tasks completed in this session (e.g., ['T03 src/auth.ts: JWT validation'])",
                        },
                        pending_notes: {
                            type: "array",
                            items: { type: "string" },
                            description: "Handoff notes for next agent (e.g., ['T04 blocked: missing API key'])",
                        },
                    },
                    required: ["workspace_path", "active_feature", "status"],
                },
            },
            {
                name: "sdd_get_next_task",
                description: "Get the next incomplete task from tasks.md. Returns task ID, file path, phase, " +
                    "dependencies, and whether a checkpoint is reached. Use this to determine what to work on next.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspace_path: {
                            type: "string",
                            description: "Absolute path to the project workspace",
                        },
                    },
                    required: ["workspace_path"],
                },
            },
            {
                name: "sdd_complete_task",
                description: "Mark a specific task as completed [x] in tasks.md. Optionally add a note (e.g., 'via vibe coding'). " +
                    "This is an atomic operation — the checkbox format is guaranteed correct.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspace_path: {
                            type: "string",
                            description: "Absolute path to the project workspace",
                        },
                        task_id: {
                            type: "string",
                            description: "Task ID to complete (e.g., 'T03')",
                        },
                        note: {
                            type: "string",
                            description: "Optional note to append (e.g., 'via vibe coding')",
                        },
                    },
                    required: ["workspace_path", "task_id"],
                },
            },
            {
                name: "sdd_rollback_task",
                description: "Revert a completed task back to incomplete: [x] → [ ] (reverted: reason). " +
                    "Use when a later task discovers the earlier implementation is broken.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspace_path: {
                            type: "string",
                            description: "Absolute path to the project workspace",
                        },
                        task_id: {
                            type: "string",
                            description: "Task ID to rollback (e.g., 'T03')",
                        },
                        reason: {
                            type: "string",
                            description: "Why this task is being reverted (e.g., 'breaks T05 contract')",
                        },
                    },
                    required: ["workspace_path", "task_id", "reason"],
                },
            },
            {
                name: "sdd_detect_drift",
                description: "Compare handoff.md state against tasks.md checkboxes to detect inconsistencies. " +
                    "Returns structured drift report. Call this after sdd_get_state to verify synchronization.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workspace_path: {
                            type: "string",
                            description: "Absolute path to the project workspace",
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
            case "sdd_get_state": {
                const { workspace_path } = WorkspaceOnly.parse(args);
                const result = readHandoffState(workspace_path);
                return { content: [{ type: "text", text: result }] };
            }
            // --- No guard: drift detection is read-only ---
            case "sdd_detect_drift": {
                const { workspace_path } = WorkspaceOnly.parse(args);
                const result = detectDrift(workspace_path);
                return { content: [{ type: "text", text: result }] };
            }
            // --- No guard: getting next task is read-only ---
            case "sdd_get_next_task": {
                const { workspace_path } = WorkspaceOnly.parse(args);
                const result = getNextTask(workspace_path);
                return { content: [{ type: "text", text: result }] };
            }
            // --- GUARDED: must call sdd_get_state first ---
            case "sdd_update_state": {
                const parsed = UpdateStateArgs.parse(args);
                enforcePreFlight(parsed.workspace_path, "sdd_update_state");
                const result = await writeHandoffState(parsed.workspace_path, parsed.active_feature, parsed.status, parsed.completed_tasks, parsed.pending_notes);
                return { content: [{ type: "text", text: result }] };
            }
            case "sdd_complete_task": {
                const parsed = CompleteTaskArgs.parse(args);
                enforcePreFlight(parsed.workspace_path, "sdd_complete_task");
                const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
                return { content: [{ type: "text", text: result }] };
            }
            case "sdd_rollback_task": {
                const parsed = RollbackTaskArgs.parse(args);
                enforcePreFlight(parsed.workspace_path, "sdd_rollback_task");
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
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: message }],
            isError: true,
        };
    }
});
// ==========================================
// 5. Start Server
// ==========================================
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
#!/usr/bin/env node
// Agent Governance MCP — 3-Layer Defense Architecture
// Layer 1: MCP Prompts (auto-inject constitution + skill + state)
// Layer 2: Structured Tools (8 tw_* tools for state/task/drift/role)
// Layer 3: Server-side Guards (pre-flight check enforcement)
// Methodology-agnostic: defaults to a generic markdown checkbox task format;
// teams override task pattern / paths / constitution via <workspace>/.current/.
import * as path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHttpTransport } from "./transport/http.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { cleanupStaleSessions } from "./guards/session.js";
import { setActiveStorage } from "./tools/storage.js";
import { TOOL_REGISTRY, PROMPT_REGISTRY } from "./tools/registry.js";
import { appendSpecContext } from "./prompts/build.js";
// Runtime validation schemas (zod) now live in tools/registry.ts, paired with
// each tool's JSON Schema + handler via defineTool (registry-pattern, T-REG-06).
function formatZodError(err) {
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
const server = new Server({ name: "agent-governance-mcp", version: "3.45.0" }, { capabilities: { tools: {}, prompts: {} } });
// ==========================================
// 2. Register Prompts (Layer 1: Auto-inject constitution)
// ==========================================
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPT_REGISTRY.map((e) => ({
        name: e.name, description: e.description, arguments: e.arguments,
    })),
}));
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // Fallback: CLAUDE_PROJECT_DIR (set by Claude Code) or cwd
    const resolvedPath = (typeof args?.workspace_path === "string" && args.workspace_path) ||
        process.env.CLAUDE_PROJECT_DIR ||
        process.cwd();
    const entry = PROMPT_REGISTRY.find((e) => e.name === name);
    if (!entry)
        throw new Error(`Prompt not found: ${name}`);
    return appendSpecContext(entry.build(resolvedPath), resolvedPath, name);
});
// ==========================================
// 3. Register Tools (Layer 2: Structured APIs)
// ==========================================
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_REGISTRY.map((e) => ({
        name: e.name, description: e.description, inputSchema: e.inputSchema,
    })),
}));
// ==========================================
// 4. Tool Execution (Layer 3: Server-side Guards)
// ==========================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const entry = TOOL_REGISTRY.find((e) => e.name === name);
        if (!entry) {
            return {
                content: [{ type: "text", text: `❌ Tool not found: ${name}` }],
                isError: true,
            };
        }
        return await entry.run(args);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return {
                content: [{ type: "text", text: `❌ Invalid arguments for ${name}: ${formatZodError(error)}` }],
                isError: true,
            };
        }
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        return { content: [{ type: "text", text: message }], isError: true };
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
            let SqliteHandoffStorage;
            try {
                ({ SqliteHandoffStorage } = await import("./tools/storage-sqlite.js"));
            }
            catch (err) {
                throw new Error("HTTP mode requires better-sqlite3 but it is not installed. " +
                    "Reinstall with `npm install better-sqlite3` (needs Python + C++ toolchain on first build). " +
                    `Underlying error: ${err instanceof Error ? err.message : String(err)}`);
            }
            const sqliteStorage = new SqliteHandoffStorage(dbPath);
            setActiveStorage(sqliteStorage);
            const authToken = process.env.TW_AUTH_TOKEN?.trim() || undefined;
            const allowedOrigins = process.env.TW_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
            if (!authToken) {
                console.error("⚠️  WARNING: HTTP mode started with no TW_AUTH_TOKEN. " +
                    "The /mcp endpoint is unauthenticated — anyone reaching this port can read/write " +
                    "handoff state for any workspace_path. Set TW_AUTH_TOKEN before exposing beyond localhost.");
            }
            const { transport, listen, close } = createHttpTransport(port, { authToken, allowedOrigins });
            await listen();
            await server.connect(transport);
            console.error(`🛡️ Agent Governance MCP is online (HTTP :${port}). MCP endpoint: http://localhost:${port}/mcp`);
            console.error(`   Storage: SQLite → ${dbPath}`);
            console.error(`   Auth: ${authToken ? "Bearer token required" : "DISABLED"}`);
            console.error(`   Allowed Origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(", ") : "(any)"}`);
            let shuttingDown = false;
            const shutdown = (signal) => {
                if (shuttingDown)
                    return;
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
                    .catch((err) => console.error("HTTP close error:", err))
                    .finally(() => {
                    try {
                        sqliteStorage.close();
                    }
                    catch (err) {
                        console.error("SQLite close error:", err);
                    }
                    clearTimeout(forceExit);
                    process.exit(0);
                });
            };
            process.on("SIGTERM", shutdown);
            process.on("SIGINT", shutdown);
        }
        else {
            const transport = new StdioServerTransport();
            await server.connect(transport);
            console.error("🛡️ Agent Governance MCP is online. (Tools + Prompts + Guards)");
        }
    }
    catch (err) {
        const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
        console.error("❌ Agent Governance MCP failed to start:", message);
        process.exit(1);
    }
})();
//# sourceMappingURL=index.js.map
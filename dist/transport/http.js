// Coded by @sr-engineer
// HTTP transport for MCP Streamable HTTP mode. Includes:
//   - Bearer-token auth (when TW_AUTH_TOKEN is set)
//   - Origin allowlist (defends against DNS rebinding per MCP spec guidance)
//   - 1 MiB body cap
//   - /healthz for container liveness probes
import * as http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
const MAX_BODY_BYTES = 1_048_576; // 1 MiB — MCP messages are small; reject anything larger.
function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        let bytes = 0;
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
            bytes += Buffer.byteLength(chunk, "utf8");
            if (bytes > MAX_BODY_BYTES) {
                req.destroy();
                reject(new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`));
                return;
            }
            raw += chunk;
        });
        req.on("end", () => {
            try {
                resolve(raw.length > 0 ? JSON.parse(raw) : undefined);
            }
            catch {
                reject(new Error("Invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}
function constantTimeEqual(a, b) {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
        // timingSafeEqual throws on length mismatch — compare against self to keep timing flat.
        timingSafeEqual(bufA, bufA);
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}
function extractBearer(authHeader) {
    if (!authHeader)
        return null;
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    return match ? match[1].trim() : null;
}
function normalizeOrigin(origin) {
    return origin.trim().toLowerCase().replace(/\/$/, "");
}
function isOriginAllowed(originHeader, allowlist) {
    if (!originHeader)
        return true; // No Origin → not a browser-driven request; allow.
    if (allowlist.length === 0)
        return true; // No allowlist configured → allow.
    const normalized = normalizeOrigin(originHeader);
    return allowlist.some((allowed) => normalizeOrigin(allowed) === normalized);
}
export function createHttpTransport(port, options = {}) {
    const { authToken, allowedOrigins = [] } = options;
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
    });
    const httpServer = http.createServer((req, res) => {
        const url = req.url ?? "";
        // Liveness probe — bypass auth/origin so platform health checks work.
        if (req.method === "GET" && (url === "/healthz" || url === "/health")) {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("ok");
            return;
        }
        // Origin allowlist (DNS rebinding defense, per MCP spec).
        if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end("Forbidden: Origin not allowed");
            return;
        }
        // Bearer-token auth.
        if (authToken) {
            const presented = extractBearer(req.headers.authorization);
            if (!presented || !constantTimeEqual(presented, authToken)) {
                res.writeHead(401, {
                    "Content-Type": "text/plain",
                    "WWW-Authenticate": 'Bearer realm="teamwork-mcp"',
                });
                res.end("Unauthorized");
                return;
            }
        }
        if (url === "/mcp" || url.startsWith("/mcp?") || url.startsWith("/mcp/")) {
            const handle = async () => {
                const body = req.method === "POST" ? await readBody(req) : undefined;
                await transport.handleRequest(req, res, body);
            };
            handle().catch((err) => {
                if (!res.headersSent) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                }
                res.end(err instanceof Error ? err.message : String(err));
            });
        }
        else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not found. MCP endpoint is /mcp");
        }
    });
    const listen = () => new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, () => resolve());
    });
    const close = () => new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
        // Don't wait on lingering keep-alive sockets — actively close them so
        // shutdown completes within the supervisor's grace period.
        httpServer.closeAllConnections?.();
    });
    return { transport, listen, close };
}
//# sourceMappingURL=http.js.map
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
export interface HttpTransportOptions {
    /** Required Bearer token. If undefined, auth is disabled (NOT recommended outside localhost). */
    authToken?: string;
    /**
     * Allowed Origin header values (exact match, case-insensitive on scheme+host).
     * Requests with an Origin header not in this list are rejected with 403.
     * Requests with no Origin header (e.g. server-to-server) are allowed.
     */
    allowedOrigins?: string[];
}
export declare function createHttpTransport(port: number, options?: HttpTransportOptions): {
    transport: StreamableHTTPServerTransport;
    listen: () => Promise<void>;
    close: () => Promise<void>;
};
//# sourceMappingURL=http.d.ts.map
// Coded by @sr-engineer
// Append-only gate-fire telemetry sidecar: observability, not authoritative
// state, so deliberately outside the handoff 4-step mutating-tool contract
// (like the best-effort lock-free append in gates/qa-review.ts). Emits ONLY
// the 5 gate-fire fields below; per-dispatch token usage lives in
// tools/usage-accounting.ts and its own `.current/usage.jsonl`. (D3)
import * as fs from "fs";
import * as path from "path";
import { gate } from "../gates/registry.js";
import { resolveCurrentLanePaths } from "./lane-paths.js";
// Sidecar location comes only from the lane resolver: the lane-scoped
// <ws>/.current/<lane>/telemetry.jsonl. (E123)
function telemetryPath(workspacePath) {
    return resolveCurrentLanePaths(workspacePath).telemetryPath;
}
// Extracts the gate code from the `⛔ <CODE>` prefix every rejection site in
// tools/handoff-orchestrator.ts emits (verified format, see spec Dependencies).
// Returns null for non-rejection text.
const GATE_TEXT_RE = /^⛔\s+([A-Z_]+)/;
export function extractGateCodeFromText(text) {
    const m = GATE_TEXT_RE.exec(text.trim());
    return m ? m[1] : null;
}
// Best-effort, lock-free append. NEVER throws — a telemetry failure must
// never alter or mask the real tool response (spec AC-4).
export function emitGateTelemetry(workspacePath, errorCode, agentId, feature) {
    try {
        const file = telemetryPath(workspacePath);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        let producer = "unknown";
        try {
            producer = gate(errorCode).producer;
        }
        catch {
            // error_code not in GATE_REGISTRY — keep "unknown", never throw.
        }
        const event = {
            ts: new Date().toISOString(),
            gate: producer,
            error_code: errorCode,
            agent_id: agentId ?? null,
            feature: feature ?? null,
        };
        fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf-8");
    }
    catch {
        // Best-effort observability sidecar — swallow, never propagate.
    }
}
//# sourceMappingURL=telemetry.js.map
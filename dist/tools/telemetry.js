// Coded by @sr-engineer
// Append-only gate-fire telemetry sidecar (D3). Observability, not
// authoritative state — deliberately NOT governed by the handoff.ts 4-step
// mutating-tool contract (lock → freshness → atomic write → refresh
// snapshot). Mirrors the existing best-effort, lock-free append precedent
// in gates/qa-review.ts's recordReviewInFile (spec AC-7).
//
// D2 non-preclusion (spec AC-9): the exported TelemetryEvent type + this
// module boundary are the extension point for D2's future hop/token fields.
// D3 itself emits ONLY the 5 fields below.
import * as fs from "fs";
import * as path from "path";
import { gate } from "../gates/registry.js";
function telemetryPath(workspacePath) {
    return path.join(workspacePath, ".current", "telemetry.jsonl");
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
        const dir = path.join(workspacePath, ".current");
        fs.mkdirSync(dir, { recursive: true });
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
        fs.appendFileSync(telemetryPath(workspacePath), JSON.stringify(event) + "\n", "utf-8");
    }
    catch {
        // Best-effort observability sidecar — swallow, never propagate.
    }
}
//# sourceMappingURL=telemetry.js.map
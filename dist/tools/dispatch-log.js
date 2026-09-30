// Coded by @sr-engineer
// Append-only per-hop dispatch-mechanism sidecar. (E99)
//
// The handoff file keeps only the LAST hop, so the transient dispatch_mechanism /
// dispatch_mechanism_tier fields (handoff schema v15) are overwritten by the
// next write. This module durably records every hop that attested them: one
// JSON line {ts, feature, agent_id, dispatch_mechanism, dispatch_mechanism_tier}
// per accepted tw_update_state write that CARRIED dispatch_mechanism.
//
// Mirrors tools/telemetry.ts's emitGateTelemetry contract exactly:
// observability, not authoritative state — best-effort, lock-free append,
// NEVER throws, never alters the caller's ToolResult. Deliberately NOT
// governed by the handoff 4-step mutating-tool contract.
//
// Separate stream: this module writes ONLY its own sidecar. It never
// touches the per-shipped-feature metrics sidecar (tools/metrics.ts, deduped
// per feature by tw_gate_stats — a per-hop record would corrupt that
// invariant) nor the gate-fire telemetry sidecar (tools/telemetry.ts).
//
// Raw and unconsumed for now: no aggregator, drift check, or gate reads it.
//
// Path: resolveCurrentLanePaths(<absolute ws>).dispatchLogPath — the lane
// resolver owns both the filename (LANE_FILES) and the directory, so this
// sidecar lives in the current lane next to its handoff:
// `.current/<lane>/dispatch.jsonl`. (E123)
import * as fs from "fs";
import * as path from "path";
import { resolveCurrentLanePaths } from "./lane-paths.js";
// path.resolve makes the result absolute for a relative workspacePath (the
// tools/handoff-write.ts getHandoffPath precedent); byte-identical to the
// former flat join for an absolute one.
export function dispatchLogPath(workspacePath) {
    return resolveCurrentLanePaths(path.resolve(workspacePath)).dispatchLogPath;
}
// Best-effort, lock-free append of exactly ONE line. NEVER throws — a sidecar
// failure must never alter or mask the real tool response (the emitGateTelemetry
// contract). Callers invoke this ONLY when the accepted write carried
// dispatch_mechanism; there is no empty/null record path (AC13).
export function appendDispatchRecord(workspacePath, input) {
    try {
        const logPath = dispatchLogPath(workspacePath);
        // Parent dir derived from the resolved path, not a hard-coded `.current`,
        // so a lane sub-directory is created once the resolver goes lane-aware.
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        const record = {
            ts: new Date().toISOString(),
            feature: input.feature ?? null,
            agent_id: input.agent_id ?? null,
            dispatch_mechanism: input.dispatch_mechanism,
            dispatch_mechanism_tier: input.dispatch_mechanism_tier ?? null,
        };
        fs.appendFileSync(logPath, JSON.stringify(record) + "\n", "utf-8");
    }
    catch {
        // Best-effort observability sidecar — swallow, never propagate.
    }
}
//# sourceMappingURL=dispatch-log.js.map
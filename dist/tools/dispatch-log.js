// Coded by @sr-engineer
// Append-only per-hop dispatch-mechanism sidecar: one JSON line {ts, feature,
// agent_id, dispatch_mechanism, dispatch_mechanism_tier} per accepted write
// carrying dispatch_mechanism, since the handoff keeps only the last hop.
// Best-effort, lock-free, never throws; writes only its own sidecar, at
// resolveCurrentLanePaths(<absolute ws>).dispatchLogPath.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/dispatch-log.ts — sidecar".
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
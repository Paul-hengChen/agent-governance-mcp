// Coded by @sr-engineer
// Release-close success-metrics sidecar (e8-success-telemetry). One JSON line
// per SHIPPED feature, appended to .current/metrics.jsonl at the
// release-engineer terminal-marker write (E1A signature — see the single call
// site in tools/handoff-orchestrator.ts). Observability, not authoritative
// state — deliberately NOT governed by the handoff.ts 4-step mutating-tool
// contract. Fully separate stream + module from tools/telemetry.ts's
// gate-fire telemetry.jsonl (AC6): disjoint key sets, writers, lifecycles —
// the D2 usage.jsonl / D3 telemetry.jsonl stream-separation precedent.
import * as fs from "fs";
import * as path from "path";
function metricsPath(workspacePath) {
    return path.join(workspacePath, ".current", "metrics.jsonl");
}
// Single code-level definition of the <CODE> convention (AC4). The
// release-engineer SOP step 7a's shell grep is the human-prose mirror of this
// helper — one convention, cannot drift.
export function deriveTicketCode(feature) {
    return feature.split("-")[0].toUpperCase();
}
// Best-effort, lock-free append. NEVER throws — a metrics failure must never
// block or alter the real tw_update_state ToolResult (AC2, the D3
// emitGateTelemetry discipline verbatim).
export function emitFeatureMetrics(args) {
    try {
        const code = deriveTicketCode(args.feature);
        // tickets = completed checkbox lines for this feature's ticket code in
        // the workspace-root tasks.md (read fresh; matches release-engineer SOP
        // step 7a's grep — config taskPaths intentionally NOT consulted, the SOP
        // grep does not consult it either).
        const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ticketLine = new RegExp(`^\\s*-\\s*\\[x\\]\\s*T-${escapedCode}-`);
        const tasksText = fs.readFileSync(path.join(args.workspacePath, "tasks.md"), "utf-8");
        const tickets = tasksText.split("\n").filter((line) => ticketLine.test(line)).length;
        // released_version: null if package.json is unreadable/unparseable (AC7)
        // — inner try/catch so an unreadable manifest degrades the FIELD, not the
        // whole record (the telemetry.ts producer-lookup inner-catch precedent).
        let released_version = null;
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(args.workspacePath, "package.json"), "utf-8"));
            released_version = typeof pkg.version === "string" ? pkg.version : null;
        }
        catch {
            // unreadable package.json — record ships with released_version: null.
        }
        // Idempotency guard (E12): skip the append when a record with the same
        // (feature, released_version) pair already exists. The PAIR is the key —
        // released_version === null is a valid key value, NOT a wildcard, so a
        // second null-version emit for the same feature is also deduped (AC9). An
        // existing record with an absent/non-string released_version normalizes to
        // null so it compares equal to a computed null. Defensive read: a missing
        // file means "no existing records" so the append proceeds (AC10); a
        // malformed line is skipped without crashing (AC10); and any failure of the
        // read itself fails OPEN — fall through to append rather than drop a
        // legitimate record (AC11) — never throwing, per this module's contract.
        let alreadyEmitted = false;
        try {
            const existing = fs.readFileSync(metricsPath(args.workspacePath), "utf-8");
            for (const line of existing.split("\n")) {
                if (line.trim() === "")
                    continue;
                let parsed;
                try {
                    parsed = JSON.parse(line);
                }
                catch {
                    continue; // malformed line — skip, do not crash the read (AC10)
                }
                const parsedVersion = typeof parsed.released_version === "string" ? parsed.released_version : null;
                if (parsed.feature === args.feature && parsedVersion === released_version) {
                    alreadyEmitted = true;
                    break;
                }
            }
        }
        catch {
            // File missing (AC10) or unreadable mid-read (AC11): fail open — leave
            // alreadyEmitted false and fall through to append.
        }
        if (alreadyEmitted)
            return;
        const record = {
            ts: new Date().toISOString(),
            feature: args.feature,
            tickets,
            qa_rounds: args.qaRoundsTotal,
            review_rounds: args.reviewRoundsTotal,
            visual_rounds: args.visualRoundsTotal,
            hops: args.hops,
            one_pass: args.qaRoundsTotal === 0 && args.reviewRoundsTotal === 0 && args.visualRoundsTotal === 0,
            released_version,
        };
        fs.mkdirSync(path.join(args.workspacePath, ".current"), { recursive: true });
        fs.appendFileSync(metricsPath(args.workspacePath), JSON.stringify(record) + "\n", "utf-8");
    }
    catch {
        // Best-effort observability sidecar — swallow, never propagate (AC2).
    }
}
//# sourceMappingURL=metrics.js.map
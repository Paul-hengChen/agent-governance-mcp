// Coded by @sr-engineer
// Release-close success-metrics sidecar. One JSON line per SHIPPED feature,
// appended to .current/metrics.jsonl at the release-engineer terminal-marker
// write (see the single call site in tools/handoff-orchestrator.ts).
// Observability, not authoritative state — deliberately NOT governed by the
// handoff.ts 4-step mutating-tool contract. A stream and module fully
// separate from tools/telemetry.ts's gate-fire telemetry.jsonl: disjoint key
// sets, writers, and lifecycles, like the usage.jsonl / telemetry.jsonl
// split. (E8)
import * as fs from "fs";
import * as path from "path";
import { enumerateLaneSidecarSources, resolveCurrentLanePaths } from "./lane-paths.js";
// Sidecar location comes only from the lane resolver: the lane-scoped
// <ws>/.current/<lane>/metrics.jsonl. (E123)
function metricsPath(workspacePath) {
    return resolveCurrentLanePaths(workspacePath).metricsPath;
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
        // tickets = DISTINCT completed task ids for this feature's ticket code
        // across the workspace-root tasks.md (read fresh; config taskPaths
        // intentionally NOT consulted, matching release-engineer SOP step 7a's
        // grep) plus every live and history-bucket lane ledger. Deduplicated by
        // id, so a stale copy of a row in `_primary`'s ledger, or a row still
        // echoed in the root index, never counts twice. (E125a)
        const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ticketLine = new RegExp(`^\\s*-\\s*\\[x\\]\\s*(T-${escapedCode}-\\S*)`);
        const ids = new Set();
        const collect = (text) => {
            for (const line of text.split("\n")) {
                const m = ticketLine.exec(line);
                if (m)
                    ids.add(m[1]);
            }
        };
        collect(fs.readFileSync(path.join(args.workspacePath, "tasks.md"), "utf-8"));
        for (const src of enumerateLaneSidecarSources(args.workspacePath, "tasks").sources) {
            if (src.kind !== "flat")
                collect(src.bytes.toString("utf-8"));
        }
        const tickets = ids.size;
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
        // Idempotency guard: skip the append when a record with the same
        // (feature, released_version) pair already exists. The PAIR is the key —
        // released_version === null is a valid key value, NOT a wildcard, so a
        // second null-version emit for the same feature is also deduped. An
        // existing record with an absent/non-string released_version normalizes
        // to null so it compares equal to a computed null. Defensive read: a
        // missing file means "no existing records" so the append proceeds; a
        // malformed line is skipped without crashing; and any failure of the read
        // itself fails OPEN — fall through to append rather than drop a
        // legitimate record — never throwing, per this module's contract.
        // Resolved once per emit (one HEAD read), reused for the read + append.
        // (E12)
        const file = metricsPath(args.workspacePath);
        let alreadyEmitted = false;
        try {
            const existing = fs.readFileSync(file, "utf-8");
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
            // Zero rework of any kind (AC3) — see ROUND SEMANTICS above for why a
            // first-pass-APPROVED round is not counted into these totals.
            one_pass: args.qaRoundsTotal === 0 && args.reviewRoundsTotal === 0 && args.visualRoundsTotal === 0,
            released_version,
        };
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf-8");
    }
    catch {
        // Best-effort observability sidecar — swallow, never propagate (AC2).
    }
}
//# sourceMappingURL=metrics.js.map
// Coded by @sr-engineer
// Per-dispatch token-usage accounting sidecar (D2). Sibling module of
// tools/telemetry.ts — same best-effort, lock-free, never-throw append
// discipline, distinct concern (DR-4). Records live in usage.jsonl, a
// SEPARATE file from D3's telemetry.jsonl; the two streams are
// unambiguously distinguishable by disjoint key sets (AC-7):
//   usage.jsonl     → { ts, feature, dispatch, usage{…} }
//   telemetry.jsonl → { ts, gate, error_code, agent_id, feature }
// Writer: bin/agent-governance-usage-hook.mjs (PostToolUse hook on Task,
// opt-in-gated on config tokenBudgetPerFeature — AC-9). Reader: the
// coordinator's Token Budget Brake via sumUsageForFeature (feature-scoped,
// DR-5). Observability/accounting, not authoritative state — deliberately
// NOT governed by the handoff.ts 4-step mutating-tool contract.
//
// LANE-AWARE (e123c, E123 F2): appendUsageRecord writes the CURRENT lane's
// `.current/<lane>/usage.jsonl`; sumUsageForFeature sums every copy this
// workspace's `.current/` tree holds (live lanes, closed history lanes, a
// not-yet-migrated flat file) through tools/lane-paths.ts's
// enumerateLaneSidecarSources — the same content-based dedup tw_gate_stats
// applies, silently (a single number has no caveats channel).
import * as fs from "fs";
import * as path from "path";
import { enumerateLaneSidecarSources, resolveCurrentLanePaths } from "./lane-paths.js";
// The four canonical cost-attribution fields (skill-coordinator §Subagent
// Token Observability) — summed together by sumUsageForFeature.
const USAGE_KEYS = [
    "input_tokens",
    "output_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
];
// The legacy FLAT path (pre-E123 layout). Kept exported and unchanged: it is
// now only the flat source sumUsageForFeature still reads (via
// enumerateLaneSidecarSources) — no writer targets it any more.
export function usagePath(workspacePath) {
    return path.join(workspacePath, ".current", "usage.jsonl");
}
// Best-effort, lock-free append. NEVER throws — an accounting failure must
// never alter or mask the real tool result (tools/telemetry.ts discipline).
// Target: the current lane's usage.jsonl (e123c AC7), never the flat path.
export function appendUsageRecord(workspacePath, record) {
    try {
        const target = resolveCurrentLanePaths(workspacePath).usagePath;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, JSON.stringify(record) + "\n", "utf-8");
    }
    catch {
        // Best-effort accounting sidecar — swallow, never propagate.
    }
}
// Feature-scoped running total (DR-5): Σ of the four usage.* fields over
// usage.jsonl lines where line.feature === feature, across every counted
// copy (e123c AC6). Returns 0 when no copy exists (hook not wired / no
// dispatches yet — AC-9), or all are empty / unparseable; malformed lines
// are skipped, not fatal. Never throws.
export function sumUsageForFeature(workspacePath, feature) {
    // enumerateLaneSidecarSources never throws; an absent copy is not a source.
    let total = 0;
    for (const source of enumerateLaneSidecarSources(workspacePath, "usage").sources) {
        total += sumUsageInText(source.bytes.toString("utf-8"), feature);
    }
    return total;
}
function sumUsageInText(raw, feature) {
    let total = 0;
    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            continue; // skip unparseable lines (torn concurrent append etc.)
        }
        if (!parsed || typeof parsed !== "object")
            continue;
        const rec = parsed;
        if (rec.feature !== feature)
            continue;
        if (!rec.usage || typeof rec.usage !== "object")
            continue;
        const usage = rec.usage;
        for (const key of USAGE_KEYS) {
            const value = usage[key];
            if (typeof value === "number" && Number.isFinite(value))
                total += value;
        }
    }
    return total;
}
//# sourceMappingURL=usage-accounting.js.map
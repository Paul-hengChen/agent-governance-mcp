// Coded by @sr-engineer
// Per-dispatch token-usage sidecar, the sibling of tools/telemetry.ts (same
// best-effort, lock-free, never-throw append; disjoint key sets, separate
// usage.jsonl). Writer: bin/agent-governance-usage-hook.mjs; reader:
// sumUsageForFeature, summing every lane copy via tools/lane-paths.ts's
// enumerateLaneSidecarSources dedup. Not authoritative state. (D2, E123)
// Why: specs/e260b-rationale.md (tools/usage-accounting.ts)
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
// The legacy FLAT path (the layout before per-lane directories). Kept
// exported and unchanged: it is now only the flat source sumUsageForFeature
// still reads (via enumerateLaneSidecarSources) — no writer targets it.
// (E123)
export function usagePath(workspacePath) {
    return path.join(workspacePath, ".current", "usage.jsonl");
}
// Best-effort, lock-free append. NEVER throws — an accounting failure must
// never alter or mask the real tool result (tools/telemetry.ts discipline).
// Target: the current lane's usage.jsonl, never the flat path. (E123)
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
// Feature-scoped running total: Σ of the four usage.* fields over
// usage.jsonl lines where line.feature === feature, across every counted
// copy. Returns 0 when no copy exists (hook not wired / no dispatches yet),
// or all are empty / unparseable; malformed lines are skipped, not fatal.
// Never throws. (D2, E123)
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
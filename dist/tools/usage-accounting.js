// Coded by @sr-engineer
// Per-dispatch token-usage accounting sidecar (D2). Sibling module of
// tools/telemetry.ts — same best-effort, lock-free, never-throw append
// discipline, distinct concern (DR-4). Records live in .current/usage.jsonl,
// a SEPARATE file from D3's .current/telemetry.jsonl; the two streams are
// unambiguously distinguishable by disjoint key sets (AC-7):
//   usage.jsonl     → { ts, feature, dispatch, usage{…} }
//   telemetry.jsonl → { ts, gate, error_code, agent_id, feature }
// Writer: bin/agent-governance-usage-hook.mjs (PostToolUse hook on Task,
// opt-in-gated on config tokenBudgetPerFeature — AC-9). Reader: the
// coordinator's Token Budget Brake via sumUsageForFeature (feature-scoped,
// DR-5). Observability/accounting, not authoritative state — deliberately
// NOT governed by the handoff.ts 4-step mutating-tool contract.
import * as fs from "fs";
import * as path from "path";
// The four canonical cost-attribution fields (skill-coordinator §Subagent
// Token Observability) — summed together by sumUsageForFeature.
const USAGE_KEYS = [
    "input_tokens",
    "output_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
];
export function usagePath(workspacePath) {
    return path.join(workspacePath, ".current", "usage.jsonl");
}
// Best-effort, lock-free append. NEVER throws — an accounting failure must
// never alter or mask the real tool result (tools/telemetry.ts discipline).
export function appendUsageRecord(workspacePath, record) {
    try {
        fs.mkdirSync(path.join(workspacePath, ".current"), { recursive: true });
        fs.appendFileSync(usagePath(workspacePath), JSON.stringify(record) + "\n", "utf-8");
    }
    catch {
        // Best-effort accounting sidecar — swallow, never propagate.
    }
}
// Feature-scoped running total (DR-5): Σ of the four usage.* fields over
// usage.jsonl lines where line.feature === feature. Returns 0 when the file
// is absent, empty, or unparseable; malformed lines are skipped, not fatal.
// Never throws.
export function sumUsageForFeature(workspacePath, feature) {
    let raw;
    try {
        raw = fs.readFileSync(usagePath(workspacePath), "utf-8");
    }
    catch {
        return 0; // absent file (hook not wired / no dispatches yet) — AC-9.
    }
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
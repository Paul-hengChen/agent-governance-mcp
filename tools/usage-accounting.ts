// Coded by @sr-engineer
// Per-dispatch token-usage accounting sidecar. Sibling module of
// tools/telemetry.ts — same best-effort, lock-free, never-throw append
// discipline, different concern. Records live in usage.jsonl, a SEPARATE
// file from telemetry.jsonl; the two streams are told apart by their
// disjoint key sets:
//   usage.jsonl     → { ts, feature, dispatch, usage{…} }
//   telemetry.jsonl → { ts, gate, error_code, agent_id, feature }
// Writer: bin/agent-governance-usage-hook.mjs (PostToolUse hook on Task,
// active only when config tokenBudgetPerFeature is set). Reader: the
// coordinator's Token Budget Brake via sumUsageForFeature (feature-scoped).
// Observability/accounting, not authoritative state — deliberately NOT
// governed by the handoff.ts 4-step mutating-tool contract. (D2)
//
// LANE-AWARE: appendUsageRecord writes the CURRENT lane's
// `.current/<lane>/usage.jsonl`; sumUsageForFeature sums every copy this
// workspace's `.current/` tree holds (live lanes, closed history lanes, a
// not-yet-migrated flat file) through tools/lane-paths.ts's
// enumerateLaneSidecarSources — the same content-based dedup tw_gate_stats
// applies, silently (a single number has no caveats channel). (E123)

import * as fs from "fs";
import * as path from "path";
import { enumerateLaneSidecarSources, resolveCurrentLanePaths } from "./lane-paths.js";

export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface UsageRecord {
  ts: string; // ISO-8601
  feature: string | null; // active_feature at dispatch time
  dispatch: string | null; // subagent_type / role dispatched to
  usage: UsageTotals;
}

// The four canonical cost-attribution fields (skill-coordinator §Subagent
// Token Observability) — summed together by sumUsageForFeature.
const USAGE_KEYS: readonly (keyof UsageTotals)[] = [
  "input_tokens",
  "output_tokens",
  "cache_read_input_tokens",
  "cache_creation_input_tokens",
];

// The legacy FLAT path (the layout before per-lane directories). Kept
// exported and unchanged: it is now only the flat source sumUsageForFeature
// still reads (via enumerateLaneSidecarSources) — no writer targets it.
// (E123)
export function usagePath(workspacePath: string): string {
  return path.join(workspacePath, ".current", "usage.jsonl");
}

// Best-effort, lock-free append. NEVER throws — an accounting failure must
// never alter or mask the real tool result (tools/telemetry.ts discipline).
// Target: the current lane's usage.jsonl, never the flat path. (E123)
export function appendUsageRecord(workspacePath: string, record: UsageRecord): void {
  try {
    const target = resolveCurrentLanePaths(workspacePath).usagePath;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Best-effort accounting sidecar — swallow, never propagate.
  }
}

// Feature-scoped running total: Σ of the four usage.* fields over
// usage.jsonl lines where line.feature === feature, across every counted
// copy. Returns 0 when no copy exists (hook not wired / no dispatches yet),
// or all are empty / unparseable; malformed lines are skipped, not fatal.
// Never throws. (D2, E123)
export function sumUsageForFeature(workspacePath: string, feature: string): number {
  // enumerateLaneSidecarSources never throws; an absent copy is not a source.
  let total = 0;
  for (const source of enumerateLaneSidecarSources(workspacePath, "usage").sources) {
    total += sumUsageInText(source.bytes.toString("utf-8"), feature);
  }
  return total;
}

function sumUsageInText(raw: string, feature: string): number {
  let total = 0;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // skip unparseable lines (torn concurrent append etc.)
    }
    if (!parsed || typeof parsed !== "object") continue;
    const rec = parsed as { feature?: unknown; usage?: unknown };
    if (rec.feature !== feature) continue;
    if (!rec.usage || typeof rec.usage !== "object") continue;
    const usage = rec.usage as Record<string, unknown>;
    for (const key of USAGE_KEYS) {
      const value = usage[key];
      if (typeof value === "number" && Number.isFinite(value)) total += value;
    }
  }
  return total;
}

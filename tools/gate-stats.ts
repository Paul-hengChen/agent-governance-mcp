// Coded by @sr-engineer
// tw_gate_stats — per-gate fire-count coverage reader (E26, 104447-F0 §4-D).
// Aggregates the two observability sidecars the E6 rule-retirement retro
// (docs/gate-retro-procedure.md) consumes, so the retro runs on data instead
// of raw `jq` + hand-categorization (the 2026-07-13 / 2026-07-15 retros both
// hand-tallied; the second one confirmed this ticket's shape):
//
//   .current/telemetry.jsonl  — one line per GATE_REGISTRY-cataloged rejection
//                               (tools/telemetry.ts, D3): {ts, gate,
//                               error_code, agent_id, feature}
//   .current/metrics.jsonl    — one line per SHIPPED feature (tools/metrics.ts,
//                               E8): {ts, feature, tickets, qa_rounds,
//                               review_rounds, visual_rounds, hops, one_pass,
//                               released_version}
//
// CATEGORY BOUNDARY (the load-bearing E26 requirement): telemetry can prove a
// *gate-backed* rule dead or alive — every enforcement path emits a
// GATE_REGISTRY error code, so zero fires over a window is real evidence
// (though it may still mean deterrence or an unexercised edge, never
// auto-retirement). Prose-behavioral rules (§5 read cap, §1 terse cap,
// dispatch_pins honoring, the coordinator token-budget brake, et al.) have NO
// server gate and therefore NO telemetry: zero fires for them is absence of
// measurement, not absence of violations. The output makes this structural —
// prose-behavioral rows live in a separate array whose `fires` is `null`
// (never 0), so a reader cannot conflate "not measured" with "never fired".
//
// Never throws (the tools/exemptions.ts loader posture): this is a read-only
// reporting tool — a missing sidecar is the normal young-workspace case
// (zero counts + a note), a malformed line is skipped and counted loudly
// (the scripts/summarize-metrics.mjs discipline; an interleaved line under
// concurrent lock-free appends is an accepted cost per
// docs/gate-retro-procedure.md), and no failure mode may block a retro.

import * as fs from "fs";
import * as path from "path";
import { GATE_REGISTRY, type GateProducer } from "../gates/registry.js";
import type { ToolResult, WorkspaceOnlyInput } from "./registry.js";

// ==========================================
// Output shape
// ==========================================

export interface GateFireStat {
  error_code: string;
  category: "gate-backed";
  producer: GateProducer;
  fires: number;
  by_feature: Record<string, number>;
  by_agent: Record<string, number>;
  first_ts: string | null;
  last_ts: string | null;
}

export interface UnregisteredFireStat {
  error_code: string;
  // NOT resolvable against today's GATE_REGISTRY — a gate added/removed
  // mid-window. Per docs/gate-retro-procedure.md: investigate, don't count.
  category: "unregistered";
  fires: number;
  by_feature: Record<string, number>;
  first_ts: string | null;
  last_ts: string | null;
}

export interface ProseBehavioralRule {
  rule: string;
  category: "prose-behavioral";
  where: string; // where the prose lives
  // Always null, never 0: this tool has no measurement channel for the rule.
  fires: null;
  adjudication: string; // how to actually judge it
}

export interface FeatureOutcome {
  feature: string;
  released_version: string | null;
  tickets: number;
  qa_rounds: number;
  review_rounds: number;
  visual_rounds: number;
  hops: number;
  one_pass: boolean;
}

export interface GateStatsReport {
  category_boundary: string;
  telemetry: {
    path: string;
    exists: boolean;
    lines_total: number;
    lines_malformed: number;
    total_fires: number;
    first_ts: string | null;
    last_ts: string | null;
  };
  // Registry codes with >= 1 fire, sorted by fires desc (retro step 3 "rank
  // by fire count"), ties in catalog order.
  fired: GateFireStat[];
  // Registry codes with zero fires, in catalog order. Together with `fired`
  // this covers the ENTIRE GATE_REGISTRY — the "coverage reader" contract:
  // the retro adjudicates zero-fire codes, so they must be enumerated, not
  // omitted.
  zero_fire: string[];
  unregistered: UnregisteredFireStat[];
  prose_behavioral: ProseBehavioralRule[];
  metrics: {
    path: string;
    exists: boolean;
    lines_total: number;
    lines_malformed: number;
    // Records dropped by the (feature, released_version) idempotency key —
    // the same E12 key tools/metrics.ts dedupes on at append time; pre-E12
    // double-appends (e.g. the e8 pair) are healed here at read time.
    duplicates_skipped: number;
    features: number;
    one_pass_count: number;
    one_pass_rate: number | null; // null when zero features (no fake 0%)
    mean_qa_rounds: number | null;
    mean_review_rounds: number | null;
    mean_visual_rounds: number | null;
    mean_hops: number | null;
    per_feature: FeatureOutcome[];
  };
  caveats: string[];
}

// ==========================================
// Prose-behavioral catalog
// ==========================================
// The rules the 104447 retro's dead-rule table names that CANNOT be
// adjudicated from this tool's data (backlog E26: "token brake,
// dispatch_pins, read cap, terse cap et al."). Deliberately illustrative,
// not exhaustive — most constitution prose is un-gated; these are the ones
// retros have already tried (and failed) to judge by gate-fire counts.
const TRANSCRIPT_SAMPLING =
  "Transcript sampling — inspect real session transcripts for compliance; " +
  "this tool carries NO signal for this rule.";

export const PROSE_BEHAVIORAL_RULES: readonly ProseBehavioralRule[] = [
  {
    rule: "§1 terse cap (default chat replies ≤ 15 words)",
    category: "prose-behavioral",
    where: "content/const-01-core-head.md",
    fires: null,
    adjudication: TRANSCRIPT_SAMPLING,
  },
  {
    rule: "§5 read cap (max 3 file reads per target, anti-loop)",
    category: "prose-behavioral",
    where: "content/const-01-core-head.md caps table + const-15-core-tail.md",
    fires: null,
    adjudication: TRANSCRIPT_SAMPLING,
  },
  {
    rule: "dispatch_pins honoring (roles run on the human-pinned model tier)",
    category: "prose-behavioral",
    where:
      "advisory handoff field, no gate (tools/registry.ts dispatch_pins; gates/registry.ts has no code for it)",
    fires: null,
    adjudication:
      "Transcript sampling (watermark model-tier suffix vs pinned tier); " +
      "this tool carries NO signal for this rule.",
  },
  {
    rule: "coordinator token-budget brake (prose-side spend discipline)",
    category: "prose-behavioral",
    where: "skill-coordinator.md §Token Budget Brake",
    fires: null,
    adjudication:
      "Read .current/usage.jsonl (D2 sidecar — a SEPARATE stream this tool " +
      "does not aggregate) plus transcript sampling; the gate-backed half of " +
      "D2 is HOP_CAP_EXCEEDED, which IS counted above.",
  },
];

// ==========================================
// Sidecar readers (never throw)
// ==========================================

interface JsonlRead {
  exists: boolean;
  linesTotal: number;
  linesMalformed: number;
  records: Record<string, unknown>[];
}

function readJsonlSidecar(filePath: string): JsonlRead {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch {
    // ENOENT is the normal young-workspace case; any other read failure also
    // degrades to "no data" — this reporting tool never blocks on I/O.
    return { exists: false, linesTotal: 0, linesMalformed: 0, records: [] };
  }
  const records: Record<string, unknown>[] = [];
  let linesTotal = 0;
  let linesMalformed = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue; // blank lines are not malformed
    linesTotal++;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        linesMalformed++;
        continue;
      }
      records.push(parsed as Record<string, unknown>);
    } catch {
      linesMalformed++;
    }
  }
  return { exists: true, linesTotal, linesMalformed, records };
}

// Field coercion — tolerate hand-edited/partial records (the
// summarize-metrics.mjs posture): non-numeric counters read 0, one_pass is
// strict-boolean-true only, strings must be strings.
function num(v: unknown): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ==========================================
// Aggregation
// ==========================================

interface FireAccumulator {
  fires: number;
  byFeature: Record<string, number>;
  byAgent: Record<string, number>;
  firstTs: string | null;
  lastTs: string | null;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function computeGateStats(workspacePath: string): GateStatsReport {
  const telemetryPath = path.join(workspacePath, ".current", "telemetry.jsonl");
  const metricsPath = path.join(workspacePath, ".current", "metrics.jsonl");

  // ---- telemetry.jsonl → per-error-code fire counts ----
  const tel = readJsonlSidecar(telemetryPath);
  const byCode = new Map<string, FireAccumulator>();
  let totalFires = 0;
  let windowFirst: string | null = null;
  let windowLast: string | null = null;

  for (const rec of tel.records) {
    const code = str(rec.error_code);
    if (!code) {
      // A JSON object without an error_code is not a gate-fire event.
      continue;
    }
    totalFires++;
    const feature = str(rec.feature) ?? "(none)";
    const agent = str(rec.agent_id) ?? "(none)";
    const ts = str(rec.ts);

    let acc = byCode.get(code);
    if (!acc) {
      acc = { fires: 0, byFeature: {}, byAgent: {}, firstTs: null, lastTs: null };
      byCode.set(code, acc);
    }
    acc.fires++;
    acc.byFeature[feature] = (acc.byFeature[feature] ?? 0) + 1;
    acc.byAgent[agent] = (acc.byAgent[agent] ?? 0) + 1;
    if (ts) {
      // ISO-8601 strings order lexicographically.
      if (acc.firstTs === null || ts < acc.firstTs) acc.firstTs = ts;
      if (acc.lastTs === null || ts > acc.lastTs) acc.lastTs = ts;
      if (windowFirst === null || ts < windowFirst) windowFirst = ts;
      if (windowLast === null || ts > windowLast) windowLast = ts;
    }
  }

  // Full-registry coverage: every cataloged code lands in exactly one of
  // `fired` / `zero_fire`. Catalog order is the GATE_REGISTRY array order.
  const fired: GateFireStat[] = [];
  const zeroFire: string[] = [];
  const registryCodes = new Set<string>();
  for (const def of GATE_REGISTRY) {
    registryCodes.add(def.errorCode);
    const acc = byCode.get(def.errorCode);
    if (!acc) {
      zeroFire.push(def.errorCode);
      continue;
    }
    fired.push({
      error_code: def.errorCode,
      category: "gate-backed",
      producer: def.producer,
      fires: acc.fires,
      by_feature: acc.byFeature,
      by_agent: acc.byAgent,
      first_ts: acc.firstTs,
      last_ts: acc.lastTs,
    });
  }
  // Rank by fire count (retro step 3); stable sort keeps catalog order on ties.
  fired.sort((a, b) => b.fires - a.fires);

  const unregistered: UnregisteredFireStat[] = [];
  for (const [code, acc] of byCode) {
    if (registryCodes.has(code)) continue;
    unregistered.push({
      error_code: code,
      category: "unregistered",
      fires: acc.fires,
      by_feature: acc.byFeature,
      first_ts: acc.firstTs,
      last_ts: acc.lastTs,
    });
  }
  unregistered.sort((a, b) => b.fires - a.fires);

  // ---- metrics.jsonl → per-feature outcomes ----
  const met = readJsonlSidecar(metricsPath);
  const perFeature: FeatureOutcome[] = [];
  const seenOutcomes = new Set<string>();
  let duplicatesSkipped = 0;
  for (const rec of met.records) {
    const feature = str(rec.feature) ?? "(unknown)";
    const releasedVersion = str(rec.released_version); // non-string → null (E12 normalization)
    // Read-time dedupe on the E12 idempotency key: JSON.stringify of the
    // tuple is collision-safe (a raw `${feature}|${version}` join is not —
    // "a|b"+null vs "a"+"b|null").
    const key = JSON.stringify([feature, releasedVersion]);
    if (seenOutcomes.has(key)) {
      duplicatesSkipped++;
      continue;
    }
    seenOutcomes.add(key);
    perFeature.push({
      feature,
      released_version: releasedVersion,
      tickets: num(rec.tickets),
      qa_rounds: num(rec.qa_rounds),
      review_rounds: num(rec.review_rounds),
      visual_rounds: num(rec.visual_rounds),
      hops: num(rec.hops),
      one_pass: rec.one_pass === true,
    });
  }

  const featureCount = perFeature.length;
  const onePassCount = perFeature.filter((f) => f.one_pass).length;
  const mean = (field: "qa_rounds" | "review_rounds" | "visual_rounds" | "hops"): number | null =>
    featureCount === 0
      ? null
      : round2(perFeature.reduce((sum, f) => sum + f[field], 0) / featureCount);

  const caveats = [
    "Zero fires ≠ dead rule: a gate-backed zero can mean the gate deters perfectly or its edge was never exercised in the window (e.g. the visual family without a design-armed feature). Categorize per docs/gate-retro-procedure.md step 5; retirement is always a human decision via an ordinary ticket.",
    "Rejection-only counts: successful writes are not recorded, so these are raw fire counts with no denominator — never firing *rates*.",
    "Lifetime aggregation: counts span the whole sidecar, not a retro window. Window the sidecar externally (or truncate per the retention caveat) when adjudicating 'zero fires across the last N shipped features'.",
    "Unregistered codes mean the sidecar and today's GATE_REGISTRY disagree (gate added/removed mid-window) — investigate rather than count.",
  ];
  if (!tel.exists) caveats.push(`No telemetry yet: ${telemetryPath} not found.`);
  if (!met.exists) caveats.push(`No metrics yet: ${metricsPath} not found.`);

  return {
    category_boundary:
      "Telemetry proves GATE-BACKED rules only. Rules in `fired`/`zero_fire` have a server gate " +
      "that emits a GATE_REGISTRY error code — their counts are evidence. Rules in " +
      "`prose_behavioral` have NO gate and NO telemetry: their `fires` is null, not 0, because " +
      "zero-here means 'not measured', never 'dead' — adjudicate them by transcript sampling.",
    telemetry: {
      path: telemetryPath,
      exists: tel.exists,
      lines_total: tel.linesTotal,
      lines_malformed: tel.linesMalformed,
      total_fires: totalFires,
      first_ts: windowFirst,
      last_ts: windowLast,
    },
    fired,
    zero_fire: zeroFire,
    unregistered,
    prose_behavioral: [...PROSE_BEHAVIORAL_RULES],
    metrics: {
      path: metricsPath,
      exists: met.exists,
      lines_total: met.linesTotal,
      lines_malformed: met.linesMalformed,
      duplicates_skipped: duplicatesSkipped,
      features: featureCount,
      one_pass_count: onePassCount,
      one_pass_rate: featureCount === 0 ? null : round2(onePassCount / featureCount),
      mean_qa_rounds: mean("qa_rounds"),
      mean_review_rounds: mean("review_rounds"),
      mean_visual_rounds: mean("visual_rounds"),
      mean_hops: mean("hops"),
      per_feature: perFeature,
    },
    caveats,
  };
}

// ==========================================
// MCP tool handler (registry-pattern)
// ==========================================

// --- No guard: gate-stats is read-only (the handleDetectDrift posture) ---
export async function handleGateStats(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const report = computeGateStats(args.workspace_path);
  return { content: [{ type: "text" as const, text: JSON.stringify(report) }] };
}

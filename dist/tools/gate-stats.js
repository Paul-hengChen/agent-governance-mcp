// Coded by @sr-engineer
// tw_gate_stats — per-gate fire-count coverage reader (E26, 104447-F0 §4-D).
// Aggregates the two observability sidecars the E6 rule-retirement retro
// (docs/gate-retro-procedure.md) consumes, so the retro runs on data instead
// of raw `jq` + hand-categorization (the 2026-07-13 / 2026-07-15 retros both
// hand-tallied; the second one confirmed this ticket's shape):
//
//   telemetry.jsonl  — one line per GATE_REGISTRY-cataloged rejection
//                      (tools/telemetry.ts, D3): {ts, gate, error_code,
//                      agent_id, feature}
//   metrics.jsonl    — one line per SHIPPED feature (tools/metrics.ts, E8):
//                      {ts, feature, tickets, qa_rounds, review_rounds,
//                      visual_rounds, hops, one_pass, released_version}
//
// LANE-AWARE (e123c, E123 F2): since the E123 lane flip the writers append to
// `.current/<lane>/<file>`, so each sidecar is read from EVERY copy this
// workspace's `.current/` tree holds — live lanes, closed
// `.current/history/<YYYY-MM>/<lane>/` lanes, and a not-yet-migrated flat
// `.current/<file>` — via tools/lane-paths.ts's enumerateLaneSidecarSources,
// which drops a copy only when its bytes are a prefix of / identical to
// another counted copy (a mid-move history copy, a half-merged flat file).
// Every such skip is disclosed in `caveats`. Scope is this workspace only.
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
import { GATE_REGISTRY } from "../gates/registry.js";
import { enumerateLaneSidecarSources, resolveCurrentLanePaths, resolveFlatLanePaths, } from "./lane-paths.js";
// ==========================================
// Prose-behavioral catalog
// ==========================================
// The rules the 104447 retro's dead-rule table names that CANNOT be
// adjudicated from this tool's data (backlog E26: "token brake,
// dispatch_pins, read cap, terse cap et al."). Deliberately illustrative,
// not exhaustive — most constitution prose is un-gated; these are the ones
// retros have already tried (and failed) to judge by gate-fire counts.
const TRANSCRIPT_SAMPLING = "Transcript sampling — inspect real session transcripts for compliance; " +
    "this tool carries NO signal for this rule.";
export const PROSE_BEHAVIORAL_RULES = [
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
        where: "advisory handoff field, no gate (tools/registry.ts dispatch_pins; gates/registry.ts has no code for it)",
        fires: null,
        adjudication: "Transcript sampling (watermark model-tier suffix vs pinned tier); " +
            "this tool carries NO signal for this rule.",
    },
    {
        rule: "coordinator token-budget brake (prose-side spend discipline)",
        category: "prose-behavioral",
        where: "skill-coordinator.md §Token Budget Brake",
        fires: null,
        adjudication: "Read usage.jsonl (D2 sidecar, lane-scoped like the two above — a SEPARATE stream this tool " +
            "does not aggregate) plus transcript sampling; the gate-backed half of " +
            "D2 is HOP_CAP_EXCEEDED, which IS counted above.",
    },
];
// Parse every counted copy of one sidecar and concatenate (e123c). A missing
// sidecar everywhere is the normal young-workspace case (exists: false); an
// unreadable copy is simply not a source — this reporting tool never blocks
// on I/O.
function readJsonlSidecar(workspacePath, key) {
    const { sources, skipped } = enumerateLaneSidecarSources(workspacePath, key);
    const out = {
        // A skipped copy always has a counted authority, so sources suffices.
        exists: sources.length > 0,
        linesTotal: 0,
        linesMalformed: 0,
        records: [],
        sources: sources.map((s) => s.path),
        skipped,
    };
    for (const source of sources) {
        const parsed = parseJsonl(source.bytes.toString("utf-8"));
        out.linesTotal += parsed.linesTotal;
        out.linesMalformed += parsed.linesMalformed;
        for (const rec of parsed.records)
            out.records.push(rec);
    }
    return out;
}
function parseJsonl(text) {
    const records = [];
    let linesTotal = 0;
    let linesMalformed = 0;
    for (const line of text.split("\n")) {
        if (line.trim() === "")
            continue; // blank lines are not malformed
        linesTotal++;
        try {
            const parsed = JSON.parse(line);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                linesMalformed++;
                continue;
            }
            records.push(parsed);
        }
        catch {
            linesMalformed++;
        }
    }
    return { linesTotal, linesMalformed, records };
}
function skipCaveat(file, skip) {
    const why = skip.kind === "flat"
        ? "a half-merged flat sidecar (an interrupted flat->lane merge published flat++lane at the lane path before unlinking the flat file)"
        : "a mid-move closed-history copy of a live lane";
    return (`Skipped ${file} copy ${skip.path}: its bytes are identical to or a prefix of ` +
        `${skip.authorityPath} — ${why}; its records are counted once, from ${skip.authorityPath}.`);
}
function noDataCaveat(label, filename, lanePath, flatPath) {
    return (`No ${label} yet: ${flatPath} not found, nor ${lanePath}, nor any other ` +
        `.current/<lane>/${filename} or .current/history/<YYYY-MM>/<lane>/${filename}.`);
}
// Field coercion — tolerate hand-edited/partial records (the
// summarize-metrics.mjs posture): non-numeric counters read 0, one_pass is
// strict-boolean-true only, strings must be strings.
function num(v) {
    return Number.isFinite(Number(v)) ? Number(v) : 0;
}
function str(v) {
    return typeof v === "string" && v.length > 0 ? v : null;
}
function round2(x) {
    return Math.round(x * 100) / 100;
}
export function computeGateStats(workspacePath) {
    const lanePaths = resolveCurrentLanePaths(workspacePath);
    const flatPaths = resolveFlatLanePaths(workspacePath);
    // ---- telemetry.jsonl (every lane copy) → per-error-code fire counts ----
    const tel = readJsonlSidecar(workspacePath, "telemetry");
    const byCode = new Map();
    let totalFires = 0;
    let windowFirst = null;
    let windowLast = null;
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
            if (acc.firstTs === null || ts < acc.firstTs)
                acc.firstTs = ts;
            if (acc.lastTs === null || ts > acc.lastTs)
                acc.lastTs = ts;
            if (windowFirst === null || ts < windowFirst)
                windowFirst = ts;
            if (windowLast === null || ts > windowLast)
                windowLast = ts;
        }
    }
    // Full-registry coverage: every cataloged code lands in exactly one of
    // `fired` / `zero_fire`. Catalog order is the GATE_REGISTRY array order.
    const fired = [];
    const zeroFire = [];
    const registryCodes = new Set();
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
    const unregistered = [];
    for (const [code, acc] of byCode) {
        if (registryCodes.has(code))
            continue;
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
    // ---- metrics.jsonl (every lane copy) → per-feature outcomes ----
    // The E12 dedupe below runs over the CONCATENATION of every source, so it
    // also heals the same shipped-feature record appearing in two copies.
    const met = readJsonlSidecar(workspacePath, "metrics");
    const perFeature = [];
    const seenOutcomes = new Set();
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
    const mean = (field) => featureCount === 0
        ? null
        : round2(perFeature.reduce((sum, f) => sum + f[field], 0) / featureCount);
    const caveats = [
        "Zero fires ≠ dead rule: a gate-backed zero can mean the gate deters perfectly or its edge was never exercised in the window (e.g. the visual family without a design-armed feature). Categorize per docs/gate-retro-procedure.md step 5; retirement is always a human decision via an ordinary ticket.",
        "Rejection-only counts: successful writes are not recorded, so these are raw fire counts with no denominator — never firing *rates*.",
        "Lifetime aggregation: counts span every copy of each sidecar in this workspace's .current/ tree (live lanes, closed .current/history/ lanes, and a not-yet-migrated flat file), not a retro window. Window the sidecars externally (or truncate per the retention caveat) when adjudicating 'zero fires across the last N shipped features'. Sibling worktrees' .current/ trees are NOT read.",
        "Unregistered codes mean the sidecar and today's GATE_REGISTRY disagree (gate added/removed mid-window) — investigate rather than count.",
    ];
    if (!tel.exists) {
        caveats.push(noDataCaveat("telemetry", "telemetry.jsonl", lanePaths.telemetryPath, flatPaths.telemetryPath));
    }
    if (!met.exists) {
        caveats.push(noDataCaveat("metrics", "metrics.jsonl", lanePaths.metricsPath, flatPaths.metricsPath));
    }
    for (const skip of tel.skipped)
        caveats.push(skipCaveat("telemetry.jsonl", skip));
    for (const skip of met.skipped)
        caveats.push(skipCaveat("metrics.jsonl", skip));
    return {
        category_boundary: "Telemetry proves GATE-BACKED rules only. Rules in `fired`/`zero_fire` have a server gate " +
            "that emits a GATE_REGISTRY error code — their counts are evidence. Rules in " +
            "`prose_behavioral` have NO gate and NO telemetry: their `fires` is null, not 0, because " +
            "zero-here means 'not measured', never 'dead' — adjudicate them by transcript sampling.",
        telemetry: {
            path: lanePaths.telemetryPath,
            sources: tel.sources,
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
            path: lanePaths.metricsPath,
            sources: met.sources,
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
export async function handleGateStats(args) {
    const report = computeGateStats(args.workspace_path);
    return { content: [{ type: "text", text: JSON.stringify(report) }] };
}
//# sourceMappingURL=gate-stats.js.map
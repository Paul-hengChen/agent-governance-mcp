// Coded by @sr-engineer
// Release-close success-metrics sidecar: one JSON line per SHIPPED feature in
// the lane's metrics.jsonl, appended at the release-engineer terminal-marker
// write (single call site in tools/handoff-orchestrator.ts). Observability,
// not governed state, and separate from the gate-fire telemetry stream. (E8)

import * as fs from "fs";
import * as path from "path";
import { enumerateLaneSidecarSources, resolveCurrentLanePaths } from "./lane-paths.js";

// ROUND SEMANTICS: the three *_rounds fields count REWORK ONLY (QA FAIL,
// CHANGES_REQUESTED, visual FAIL), so a review approved first time records
// `review_rounds: 0`, the same as no review, by design. Read them as "how much
// rework", never "how many rounds ran". Why the terminal round is not folded
// in: specs/e260b-rationale.md (tools/metrics.ts). (E52, E85)
export interface FeatureMetricRecord {
  ts: string; // ISO-8601 emit time == the release-close moment (DR-4)
  feature: string;
  tickets: number;
  qa_rounds: number; // rework only — cumulative QA FAILs (prevState.qa_rounds_total)
  review_rounds: number; // rework only — cumulative CHANGES_REQUESTED (prevState.review_rounds_total)
  visual_rounds: number; // rework only — cumulative visual FAILs (prevState.visual_rounds_total)
  hops: number; // from prevState.hop_count (AC5 — no new field)
  one_pass: boolean; // zero rework in all three families (AC3) — NOT "exactly one round ran"
  released_version: string | null; // package.json version at emit time, null if unreadable (AC7)
}

// Sidecar location comes only from the lane resolver: the lane-scoped
// <ws>/.current/<lane>/metrics.jsonl. (E123)
function metricsPath(workspacePath: string): string {
  return resolveCurrentLanePaths(workspacePath).metricsPath;
}

// Single code-level definition of the <CODE> convention (AC4). The
// release-engineer SOP step 7a's shell grep is the human-prose mirror of this
// helper — one convention, cannot drift.
export function deriveTicketCode(feature: string): string {
  return feature.split("-")[0].toUpperCase();
}

// Best-effort, lock-free append. NEVER throws — a metrics failure must never
// block or alter the real tw_update_state ToolResult (AC2, the D3
// emitGateTelemetry discipline verbatim).
export function emitFeatureMetrics(args: {
  workspacePath: string;
  feature: string;
  qaRoundsTotal: number;
  reviewRoundsTotal: number;
  visualRoundsTotal: number;
  hops: number;
}): void {
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
    const ids = new Set<string>();
    const collect = (text: string): void => {
      for (const line of text.split("\n")) {
        const m = ticketLine.exec(line);
        if (m) ids.add(m[1]);
      }
    };
    collect(fs.readFileSync(path.join(args.workspacePath, "tasks.md"), "utf-8"));
    for (const src of enumerateLaneSidecarSources(args.workspacePath, "tasks").sources) {
      if (src.kind !== "flat") collect(src.bytes.toString("utf-8"));
    }
    const tickets = ids.size;

    // released_version: null if package.json is unreadable/unparseable (AC7)
    // — inner try/catch so an unreadable manifest degrades the FIELD, not the
    // whole record (the telemetry.ts producer-lookup inner-catch precedent).
    let released_version: string | null = null;
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(args.workspacePath, "package.json"), "utf-8"),
      ) as { version?: unknown };
      released_version = typeof pkg.version === "string" ? pkg.version : null;
    } catch {
      // unreadable package.json — record ships with released_version: null.
    }

    // Idempotency: skip the append when a record with the same (feature,
    // released_version) pair exists; null is a key value, not a wildcard, and
    // an absent version normalizes to null. The read fails OPEN (append rather
    // than drop a record) and never throws. Path resolved once per emit. (E12)
    const file = metricsPath(args.workspacePath);
    let alreadyEmitted = false;
    try {
      const existing = fs.readFileSync(file, "utf-8");
      for (const line of existing.split("\n")) {
        if (line.trim() === "") continue;
        let parsed: { feature?: unknown; released_version?: unknown };
        try {
          parsed = JSON.parse(line) as { feature?: unknown; released_version?: unknown };
        } catch {
          continue; // malformed line — skip, do not crash the read (AC10)
        }
        const parsedVersion =
          typeof parsed.released_version === "string" ? parsed.released_version : null;
        if (parsed.feature === args.feature && parsedVersion === released_version) {
          alreadyEmitted = true;
          break;
        }
      }
    } catch {
      // File missing (AC10) or unreadable mid-read (AC11): fail open — leave
      // alreadyEmitted false and fall through to append.
    }
    if (alreadyEmitted) return;

    const record: FeatureMetricRecord = {
      ts: new Date().toISOString(),
      feature: args.feature,
      tickets,
      qa_rounds: args.qaRoundsTotal,
      review_rounds: args.reviewRoundsTotal,
      visual_rounds: args.visualRoundsTotal,
      hops: args.hops,
      // Zero rework of any kind (AC3) — see ROUND SEMANTICS above for why a
      // first-pass-APPROVED round is not counted into these totals.
      one_pass:
        args.qaRoundsTotal === 0 && args.reviewRoundsTotal === 0 && args.visualRoundsTotal === 0,
      released_version,
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Best-effort observability sidecar — swallow, never propagate (AC2).
  }
}

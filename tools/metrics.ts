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

export interface FeatureMetricRecord {
  ts: string; // ISO-8601 emit time == the release-close moment (DR-4)
  feature: string;
  tickets: number;
  qa_rounds: number; // from prevState.qa_rounds_total
  review_rounds: number; // from prevState.review_rounds_total
  visual_rounds: number; // from prevState.visual_rounds_total
  hops: number; // from prevState.hop_count (AC5 — no new field)
  one_pass: boolean; // qa_rounds===0 && review_rounds===0 && visual_rounds===0 (AC3)
  released_version: string | null; // package.json version at emit time, null if unreadable (AC7)
}

function metricsPath(workspacePath: string): string {
  return path.join(workspacePath, ".current", "metrics.jsonl");
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
    let released_version: string | null = null;
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(args.workspacePath, "package.json"), "utf-8"),
      ) as { version?: unknown };
      released_version = typeof pkg.version === "string" ? pkg.version : null;
    } catch {
      // unreadable package.json — record ships with released_version: null.
    }

    const record: FeatureMetricRecord = {
      ts: new Date().toISOString(),
      feature: args.feature,
      tickets,
      qa_rounds: args.qaRoundsTotal,
      review_rounds: args.reviewRoundsTotal,
      visual_rounds: args.visualRoundsTotal,
      hops: args.hops,
      one_pass:
        args.qaRoundsTotal === 0 && args.reviewRoundsTotal === 0 && args.visualRoundsTotal === 0,
      released_version,
    };
    fs.mkdirSync(path.join(args.workspacePath, ".current"), { recursive: true });
    fs.appendFileSync(metricsPath(args.workspacePath), JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Best-effort observability sidecar — swallow, never propagate (AC2).
  }
}

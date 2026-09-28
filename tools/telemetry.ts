// Coded by @sr-engineer
// Append-only gate-fire telemetry sidecar (D3). Observability, not
// authoritative state — deliberately NOT governed by the handoff.ts 4-step
// mutating-tool contract (lock → freshness → atomic write → refresh
// snapshot). Mirrors the existing best-effort, lock-free append precedent
// in gates/qa-review.ts's recordReviewInFile (spec AC-7).
//
// D2 consumer (this module's spec AC-9, resolved by D2 AC-7/DR-4): per-dispatch
// token-usage cost records live in the SIBLING module tools/usage-accounting.ts
// and its SEPARATE sidecar file .current/usage.jsonl — two files, two modules,
// disjoint key sets ({ts, feature, dispatch, usage{…}} vs this module's
// {ts, gate, error_code, agent_id, feature}). This module remains gate-fire
// telemetry ONLY and emits ONLY the 5 fields below; D2's hop-cap gate fires
// (HOP_CAP_EXCEEDED) flow through here unchanged.

import * as fs from "fs";
import * as path from "path";
import { gate, type GateErrorCode } from "../gates/registry.js";
import { resolveCurrentLanePaths } from "./lane-paths.js";

export interface TelemetryEvent {
  ts: string;
  gate: string; // gate(errorCode).producer: "validateTransition" | "orchestrator" | "unknown"
  error_code: string;
  agent_id: string | null;
  feature: string | null;
}

// Sidecar location comes only from the lane resolver (E123 F1 L2). It still
// returns the flat <ws>/.current/telemetry.jsonl until J flips the seam.
function telemetryPath(workspacePath: string): string {
  return resolveCurrentLanePaths(workspacePath).telemetryPath;
}

// Extracts the gate code from the `⛔ <CODE>` prefix every rejection site in
// tools/handoff-orchestrator.ts emits (verified format, see spec Dependencies).
// Returns null for non-rejection text.
const GATE_TEXT_RE = /^⛔\s+([A-Z_]+)/;
export function extractGateCodeFromText(text: string): string | null {
  const m = GATE_TEXT_RE.exec(text.trim());
  return m ? m[1] : null;
}

// Best-effort, lock-free append. NEVER throws — a telemetry failure must
// never alter or mask the real tool response (spec AC-4).
export function emitGateTelemetry(
  workspacePath: string,
  errorCode: string,
  agentId: string | null | undefined,
  feature: string | null | undefined,
): void {
  try {
    const file = telemetryPath(workspacePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let producer = "unknown";
    try {
      producer = gate(errorCode as GateErrorCode).producer;
    } catch {
      // error_code not in GATE_REGISTRY — keep "unknown", never throw.
    }
    const event: TelemetryEvent = {
      ts: new Date().toISOString(),
      gate: producer,
      error_code: errorCode,
      agent_id: agentId ?? null,
      feature: feature ?? null,
    };
    fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf-8");
  } catch {
    // Best-effort observability sidecar — swallow, never propagate.
  }
}

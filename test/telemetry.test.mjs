// Coded by @qa-engineer
// Tests for specs/d3-gate-fire-telemetry.md — T-D3-05.
//
// Spec-to-Test map:
//   AC-1 (rejection emits exactly one 5-key line)              -> INT1
//   AC-2 (pass-through emits nothing)                          -> NE1
//   AC-3 (dir auto-created, no crash, one line)                -> SHAPE1 (implicit — every
//                                                                  emitGateTelemetry call
//                                                                  below starts from a
//                                                                  workspace with no .current/)
//   AC-4 (telemetry throw never masks/alters the real ToolResult) -> THROW1, THROW2
//   AC-5 (`gate` sourced from GATE_REGISTRY producer, not re-derived) -> SHAPE1, PRODUCER1, PRODUCER2, UNKNOWN1
//   AC-6 (fixed 5-key shape; nulls not omitted, never "undefined") -> SHAPE1, NULL1, NULL2, BOUNDARY1
//   AC-7 (best-effort append, no lock — not independently testable
//         via a unit test; verified by code inspection per
//         review_reports/review_T-D3-04.md)                    -> n/a
//   extractGateCodeFromText helper (Mechanism §1)               -> EXTRACT1..EXTRACT4
//
// WHY this file exists: T-D3-05's task row (human-approved cut) explicitly
// directs authoring this file — no prior telemetry test coverage existed for
// the D3 emit point (tools/telemetry.ts, wired into tools/handoff-orchestrator.ts's
// handleUpdateState wrapper). Each test below encodes a spec AC's invariant,
// not just the current code shape, so a future refactor that silently drops a
// guarantee (e.g. re-introduces a throw path, or omits a null field) fails loud.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { emitGateTelemetry, extractGateCodeFromText } from "../dist/tools/telemetry.js";
import { gate, GATE_REGISTRY } from "../dist/gates/registry.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

function mkWorkspace(prefix = "telemetry-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function telemetryPath(ws) {
  return path.join(ws, ".current", "telemetry.jsonl");
}

function readLines(ws) {
  const text = fs.readFileSync(telemetryPath(ws), "utf-8");
  return text.split("\n").filter((l) => l.length > 0);
}

const FIVE_KEYS = ["ts", "gate", "error_code", "agent_id", "feature"].sort();

// ---------------------------------------------------------------------------
// extractGateCodeFromText — the `⛔ <CODE>` parser
// ---------------------------------------------------------------------------

test("EXTRACT1: extracts the code from a well-formed '⛔ CODE\\n...' rejection text", () => {
  assert.equal(
    extractGateCodeFromText("⛔ TRANSITION_REJECTED\n{\"error\":\"TRANSITION_REJECTED\"}"),
    "TRANSITION_REJECTED",
  );
});

test("EXTRACT2: tolerates leading/trailing whitespace around the text", () => {
  assert.equal(extractGateCodeFromText("  \n⛔ CUT_APPROVAL_REQUIRED\nhint text  \n"), "CUT_APPROVAL_REQUIRED");
});

test("EXTRACT3: returns null for text with no ⛔ prefix (a success message)", () => {
  assert.equal(extractGateCodeFromText("some ordinary success text"), null);
  assert.equal(extractGateCodeFromText(""), null);
});

test("EXTRACT4: every real GATE_REGISTRY code round-trips through the exact '⛔ <CODE>' shape", () => {
  for (const def of GATE_REGISTRY) {
    assert.equal(
      extractGateCodeFromText(`⛔ ${def.errorCode}\n{"error":"${def.errorCode}"}`),
      def.errorCode,
      `round-trip failed for ${def.errorCode}`,
    );
  }
});

// ---------------------------------------------------------------------------
// SHAPE1 / PRODUCER — AC-5/AC-6: exactly 5 keys, `gate` sourced from the
// registry's producer field (not re-derived / hardcoded).
// ---------------------------------------------------------------------------

test("SHAPE1: emitGateTelemetry appends exactly one line with exactly the 5 keys {ts, gate, error_code, agent_id, feature}", () => {
  const ws = mkWorkspace("telemetry-shape1-");
  emitGateTelemetry(ws, "CUT_APPROVAL_REQUIRED", "sr-engineer", "shape1-feature");
  const lines = readLines(ws);
  assert.equal(lines.length, 1, "exactly one line must be appended");
  const obj = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(obj).sort(), FIVE_KEYS, "line must carry exactly the 5 documented keys, no more, no fewer");
  assert.equal(obj.error_code, "CUT_APPROVAL_REQUIRED");
  assert.equal(obj.agent_id, "sr-engineer");
  assert.equal(obj.feature, "shape1-feature");
  assert.equal(typeof obj.ts, "string");
  assert.ok(!Number.isNaN(Date.parse(obj.ts)), "ts must be a parseable ISO timestamp");
});

test("PRODUCER1: gate field equals gate(error_code).producer for an orchestrator-family code", () => {
  const ws = mkWorkspace("telemetry-prod1-");
  emitGateTelemetry(ws, "MISSING_EVIDENCE", "qa-engineer", "prod1-feature");
  const obj = JSON.parse(readLines(ws)[0]);
  assert.equal(obj.gate, gate("MISSING_EVIDENCE").producer);
  assert.equal(obj.gate, "orchestrator");
});

test("PRODUCER2: gate field equals gate(error_code).producer for a validateTransition-family code", () => {
  const ws = mkWorkspace("telemetry-prod2-");
  emitGateTelemetry(ws, "TRANSITION_REJECTED", "sr-engineer", "prod2-feature");
  const obj = JSON.parse(readLines(ws)[0]);
  assert.equal(obj.gate, gate("TRANSITION_REJECTED").producer);
  assert.equal(obj.gate, "validateTransition");
});

test("PRODUCER3 (AC-5, no parallel enum): every GATE_REGISTRY entry's producer is reproduced verbatim by emitGateTelemetry, not re-derived by a second classification", () => {
  const ws = mkWorkspace("telemetry-prod3-");
  for (const def of GATE_REGISTRY) {
    fs.rmSync(telemetryPath(ws), { force: true });
    emitGateTelemetry(ws, def.errorCode, "sr-engineer", "prod3-feature");
    const obj = JSON.parse(readLines(ws)[0]);
    assert.equal(obj.gate, def.producer, `mismatch for ${def.errorCode}`);
  }
});

test("UNKNOWN1: an error_code absent from GATE_REGISTRY yields gate:'unknown' and never throws", () => {
  const ws = mkWorkspace("telemetry-unknown1-");
  assert.doesNotThrow(() => emitGateTelemetry(ws, "NOT_A_REAL_GATE_CODE", "sr-engineer", "unknown1-feature"));
  const obj = JSON.parse(readLines(ws)[0]);
  assert.equal(obj.gate, "unknown");
  assert.equal(obj.error_code, "NOT_A_REAL_GATE_CODE");
});

// ---------------------------------------------------------------------------
// NULL — AC-6: missing agent_id/active_feature are JSON null, never omitted,
// never the literal string "undefined".
// ---------------------------------------------------------------------------

test("NULL1: agent_id=null, feature=undefined both serialize as JSON null (present, not omitted)", () => {
  const ws = mkWorkspace("telemetry-null1-");
  emitGateTelemetry(ws, "AGENT_ID_REQUIRED", null, undefined);
  const raw = readLines(ws)[0];
  assert.ok(!raw.includes("undefined"), `must never contain the literal string "undefined"; got: ${raw}`);
  const obj = JSON.parse(raw);
  assert.deepEqual(Object.keys(obj).sort(), FIVE_KEYS);
  assert.strictEqual(obj.agent_id, null);
  assert.strictEqual(obj.feature, null);
});

test("NULL2: agent_id=undefined, feature=null both serialize as JSON null (present, not omitted)", () => {
  const ws = mkWorkspace("telemetry-null2-");
  emitGateTelemetry(ws, "AGENT_ID_REQUIRED", undefined, null);
  const obj = JSON.parse(readLines(ws)[0]);
  assert.strictEqual(obj.agent_id, null);
  assert.strictEqual(obj.feature, null);
});

// ---------------------------------------------------------------------------
// BOUNDARY — Phase 3d security smoke: special characters / oversized payload.
// ---------------------------------------------------------------------------

test("BOUNDARY1: unicode + special characters in agent_id/feature round-trip byte-exact through JSON", () => {
  const ws = mkWorkspace("telemetry-boundary1-");
  const weirdAgent = "sr-engineer\"; DROP TABLE x;--\n嵌套";
  const weirdFeature = "feature/with\\backslash\tand\"quote";
  emitGateTelemetry(ws, "TRANSITION_REJECTED", weirdAgent, weirdFeature);
  const obj = JSON.parse(readLines(ws)[0]);
  assert.equal(obj.agent_id, weirdAgent);
  assert.equal(obj.feature, weirdFeature);
});

test("BOUNDARY2: oversized feature string (10k chars) does not truncate or corrupt the line", () => {
  const ws = mkWorkspace("telemetry-boundary2-");
  const big = "x".repeat(10_000);
  emitGateTelemetry(ws, "TRANSITION_REJECTED", "sr-engineer", big);
  const lines = readLines(ws);
  assert.equal(lines.length, 1);
  const obj = JSON.parse(lines[0]);
  assert.equal(obj.feature.length, 10_000);
});

test("BOUNDARY3 (documents current behavior, not a spec violation): empty-string inputs are NOT nullified — only null/undefined are (?? operator semantics)", () => {
  // Note for the record (not a FAIL — QA scope is coverage/tests, not
  // correctness/architecture per skill-qa-engineer Hard Rules): AC-6's prose
  // says "absent/empty" collapses to null, but `agentId ?? null` only
  // nullifies null/undefined, so an explicit "" survives as "". This is a
  // real code path only for hand-built handleUpdateState calls (like these
  // tests) — the production zod schema enforces active_feature.min(1), so ""
  // can never reach this function via the real tw_update_state dispatch.
  const ws = mkWorkspace("telemetry-boundary3-");
  emitGateTelemetry(ws, "TRANSITION_REJECTED", "", "");
  const obj = JSON.parse(readLines(ws)[0]);
  assert.strictEqual(obj.agent_id, "");
  assert.strictEqual(obj.feature, "");
});

// ---------------------------------------------------------------------------
// NE1 — AC-2: pass-through (non-error) handleUpdateState calls emit nothing.
// ---------------------------------------------------------------------------

test("NE1: a successful (non-rejected) handleUpdateState call appends no telemetry line", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("telemetry-ne1-");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "ne1-feature",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["seed"],
  });
  assert.ok(!result.isError, `expected an accepted (null->pm:In_Progress) transition; got: ${result.content?.[0]?.text}`);
  assert.equal(fs.existsSync(telemetryPath(ws)), false, "no telemetry.jsonl should exist after a pass-through write");
});

// ---------------------------------------------------------------------------
// INT1 — AC-1: a real rejection fired through the full handleUpdateState
// wrapper lands the exact expected line in .current/telemetry.jsonl.
// ---------------------------------------------------------------------------

test("INT1: a real TRANSITION_REJECTED fired via handleUpdateState lands exactly one matching line in .current/telemetry.jsonl", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("telemetry-int1-");
  resetSession(ws);
  markStateRead(ws);
  // Fresh workspace: prev = (null, null). null -> (sr-engineer, In_Progress)
  // is an illegal edge (must start at pm/researcher/design-auditor) — see
  // test/qa-flow.test.mjs's identical scenario for the underlying
  // validateTransition contract this reuses.
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "int1-feature",
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: [],
  });
  assert.ok(result.isError, "illegal null->sr-engineer transition must be rejected");
  assert.ok(result.content[0].text.includes("TRANSITION_REJECTED"));

  const lines = readLines(ws);
  assert.equal(lines.length, 1, "exactly one telemetry line must land for this single rejection");
  const obj = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(obj).sort(), FIVE_KEYS);
  assert.equal(obj.error_code, "TRANSITION_REJECTED");
  assert.equal(obj.gate, gate("TRANSITION_REJECTED").producer);
  assert.equal(obj.agent_id, "sr-engineer");
  assert.equal(obj.feature, "int1-feature");
  assert.ok(!Number.isNaN(Date.parse(obj.ts)));
});

// ---------------------------------------------------------------------------
// THROW — AC-4: telemetry failure (mkdir/append throws) never masks or
// alters the real gate ToolResult. Reproduced with a REAL filesystem throw
// (no fs mocking): workspace_path points at a plain file, so
// fs.mkdirSync(path.join(workspacePath, ".current"), {recursive:true}) inside
// emitGateTelemetry hits ENOTDIR.
// ---------------------------------------------------------------------------

test("THROW1: emitGateTelemetry itself never throws even when mkdirSync fails (ENOTDIR)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "telemetry-throw1-"));
  const notADir = path.join(dir, "im-a-file.txt");
  fs.writeFileSync(notADir, "not a directory");
  assert.doesNotThrow(() => emitGateTelemetry(notADir, "TRANSITION_REJECTED", "sr-engineer", "throw1-feature"));
});

test("THROW2: when emitGateTelemetry's internal append fails, handleUpdateState's returned ToolResult is byte-identical to the same rejection on a healthy workspace", async () => {
  setActiveStorage(new FileHandoffStorage());

  // Control: real workspace, real telemetry append succeeds.
  const goodWs = mkWorkspace("telemetry-throw2-good-");
  resetSession(goodWs);
  markStateRead(goodWs);
  const goodResult = await handleUpdateState({
    workspace_path: goodWs,
    active_feature: "throw2-feature",
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: [],
  });
  assert.ok(fs.existsSync(telemetryPath(goodWs)), "control run must have actually appended telemetry");

  // Experiment: workspace_path is a plain file — parseHandoff/markStateRead
  // degrade gracefully to "no prior state" (fs.existsSync/statSync swallow
  // ENOTDIR and return false/null), so the SAME illegal transition is
  // evaluated identically; only emitGateTelemetry's mkdirSync hits ENOTDIR
  // and must swallow it internally per AC-4.
  const badDir = fs.mkdtempSync(path.join(os.tmpdir(), "telemetry-throw2-bad-"));
  const badWs = path.join(badDir, "im-a-file-not-a-workspace.txt");
  fs.writeFileSync(badWs, "not a directory");
  resetSession(badWs);
  markStateRead(badWs);
  const badResult = await handleUpdateState({
    workspace_path: badWs,
    active_feature: "throw2-feature",
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: [],
  });

  assert.equal(badResult.isError, goodResult.isError, "isError must be identical regardless of telemetry success/failure");
  assert.deepEqual(
    badResult.content,
    goodResult.content,
    "the returned ToolResult content must be byte-identical whether or not telemetry succeeded — a telemetry throw must never mask or alter the real gate response",
  );
});

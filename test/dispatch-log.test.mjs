// Coded by @qa-engineer
// Tests for the dispatch-log sidecar: append on write, isolation from the other sidecars, and where its
// filename comes from (specs/e123a-lane-layout-migration.md AC13/AC14/AC15; T-E123A3-08, covering
// T-E123A3-04). Spec-to-Test map: specs/e260e-comment-rationale.md (dispatch-log.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { appendDispatchRecord, dispatchLogPath } from "../dist/tools/dispatch-log.js";
import { laneFile, resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

function mkWorkspace(prefix = "dispatch-log-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Sidecars are LANE_FILES entries — resolve through the lane-aware resolver
// (these fixture workspaces carry no `.git`, so this resolves to
// `.current/_primary/`), matching tools/telemetry.ts / tools/metrics.ts
// (e123b9 J2, spec AC1/AC9).
function telemetryPath(ws) {
  return resolveCurrentLanePaths(ws).telemetryPath;
}

function metricsPath(ws) {
  return resolveCurrentLanePaths(ws).metricsPath;
}

function readLines(p) {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf-8")
    .split("\n")
    .filter((l) => l.length > 0);
}

const FIVE_KEYS = ["ts", "feature", "agent_id", "dispatch_mechanism", "dispatch_mechanism_tier"].sort();

// ============================================================================
// AC15 — the sidecar filename is imported FROM LANE_FILES, not a second
// hardcoded literal.
// ============================================================================

test("NAME1 (e123b9 J2, spec AC1 — FLIPPED): dispatchLogPath(ws) resolves to <ws>/.current/_primary/<LANE_FILES' dispatch entry filename> — not a second hardcoded literal", () => {
  const ws = "/some/workspace";
  assert.equal(dispatchLogPath(ws), resolveCurrentLanePaths(ws).dispatchLogPath);
  assert.equal(dispatchLogPath(ws), path.join(ws, ".current", "_primary", laneFile("dispatch").filename));
  assert.equal(laneFile("dispatch").filename, "dispatch.jsonl");
});

test("NAME2: grep -n dispatch\\.jsonl tools/dispatch-log.ts shows no second string-literal declaration outside a comment (AC15 qa-checkable grep, scoped to this one file)", () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), "tools", "dispatch-log.ts"), "utf-8");
  const codeLines = src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .filter((line) => /["']dispatch\.jsonl["']/.test(line));
  assert.equal(codeLines.length, 0, `tools/dispatch-log.ts must not hardcode the literal "dispatch.jsonl" anywhere outside a comment — found: ${JSON.stringify(codeLines)}`);
});

// ============================================================================
// AC13 — exactly 1 line appended when dispatch_mechanism is carried; 0 when
// omitted. Best-effort, never throws, never alters the ToolResult.
// ============================================================================

test("INT1: a real tw_update_state write carrying dispatch_mechanism appends exactly 1 line to .current/dispatch.jsonl, with the correct 5-key shape", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("dispatch-log-int1-");
  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: "int1-feat",
    status: "In_Progress",
    agent_id: "pm", // fresh workspace: null -> pm:In_Progress is a legal starting transition
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "task",
    dispatch_mechanism_tier: "fable",
  });
  assert.ok(!res.isError, `expected an accepted write: ${res.content?.[0]?.text}`);

  const lines = readLines(dispatchLogPath(ws));
  assert.equal(lines.length, 1, "exactly one dispatch-log line must land for this single dispatch_mechanism-carrying write");
  const obj = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(obj).sort(), FIVE_KEYS, "the record must have exactly the 5 documented keys");
  assert.equal(obj.dispatch_mechanism, "task");
  assert.equal(obj.dispatch_mechanism_tier, "fable");
  assert.equal(obj.agent_id, "pm");
  assert.equal(obj.feature, "int1-feat");
  assert.ok(!Number.isNaN(Date.parse(obj.ts)), "ts must be a valid ISO timestamp");
});

test("INT2: a real tw_update_state write that OMITS dispatch_mechanism appends NO line — no empty/null records", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("dispatch-log-int2-");
  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: "int2-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [],
    // dispatch_mechanism intentionally omitted.
  });
  assert.ok(!res.isError, `expected an accepted write: ${res.content?.[0]?.text}`);
  assert.equal(fs.existsSync(dispatchLogPath(ws)), false, "no dispatch.jsonl should exist after a write that never carried dispatch_mechanism");
});

test("INT3: a REJECTED write (illegal transition) carrying dispatch_mechanism appends NO line — the append only fires after storage.writeState succeeds", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("dispatch-log-int3-");
  resetSession(ws);
  markStateRead(ws);
  // Fresh workspace: null -> sr-engineer:In_Progress is an illegal starting
  // edge (must start at pm/researcher/design-auditor) — the exact scenario
  // test/telemetry.test.mjs's INT1 uses to force TRANSITION_REJECTED.
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: "int3-feat",
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "task",
    dispatch_mechanism_tier: "fable",
  });
  assert.ok(res.isError, "illegal null -> sr-engineer transition must be rejected");
  assert.equal(fs.existsSync(dispatchLogPath(ws)), false, "a rejected write must never append a dispatch-log line, even if it carried dispatch_mechanism");
});

test("INT4: a second write on the same feature that omits dispatch_mechanism does not append a second line (line count stays at 1)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("dispatch-log-int4-");
  resetSession(ws);
  markStateRead(ws);
  await handleUpdateState({
    workspace_path: ws,
    active_feature: "int4-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "inline",
  });
  assert.equal(readLines(dispatchLogPath(ws)).length, 1, "sanity: first write appended exactly 1 line");

  resetSession(ws);
  markStateRead(ws);
  await handleUpdateState({
    workspace_path: ws,
    active_feature: "int4-feat",
    status: "In_Progress",
    agent_id: "architect",
    completed_tasks: [],
    pending_notes: [],
    // dispatch_mechanism omitted on this second write.
  });
  assert.equal(readLines(dispatchLogPath(ws)).length, 1, "an omitting write must not append a second line — the sidecar only grows on writes that CARRY dispatch_mechanism");
});

// ---------------------------------------------------------------------------
// THROW — AC13: best-effort append never throws and never alters the real
// ToolResult, even when the append itself fails (a REAL filesystem throw:
// dispatch.jsonl's path is occupied by a directory, so appendFileSync hits
// EISDIR). Mirrors test/telemetry.test.mjs's THROW1/THROW2 convention.
// ---------------------------------------------------------------------------

test("THROW1: appendDispatchRecord itself never throws even when the target path is a directory (EISDIR) or the workspace path is bogus (ENOTDIR)", () => {
  const ws = mkWorkspace("dispatch-log-throw1-");
  fs.mkdirSync(dispatchLogPath(ws), { recursive: true }); // occupy the sidecar path with a directory (lane dir first)
  assert.doesNotThrow(() =>
    appendDispatchRecord(ws, { feature: "throw1-feat", agent_id: "pm", dispatch_mechanism: "task", dispatch_mechanism_tier: undefined }),
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dispatch-log-throw1b-"));
  const notADir = path.join(dir, "im-a-file.txt");
  fs.writeFileSync(notADir, "not a directory");
  assert.doesNotThrow(() =>
    appendDispatchRecord(notADir, { feature: "throw1b-feat", agent_id: "pm", dispatch_mechanism: "task", dispatch_mechanism_tier: undefined }),
  );
});

test("THROW2: when the dispatch-log append fails (EISDIR), handleUpdateState's returned ToolResult has the identical shape/success as the same write on a healthy workspace — only the workspace-specific path/timestamp legitimately differ", async () => {
  setActiveStorage(new FileHandoffStorage());

  // Control: real workspace, real dispatch-log append succeeds.
  const goodWs = mkWorkspace("dispatch-log-throw2-good-");
  resetSession(goodWs);
  markStateRead(goodWs);
  const goodResult = await handleUpdateState({
    workspace_path: goodWs,
    active_feature: "throw2-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "task",
    dispatch_mechanism_tier: "fable",
  });
  assert.ok(fs.existsSync(dispatchLogPath(goodWs)), "control run must have actually appended a dispatch-log line");

  // Experiment: pre-create dispatch.jsonl AS A DIRECTORY so the real
  // appendFileSync call inside appendDispatchRecord hits EISDIR. The handoff
  // write itself must still succeed identically.
  const badWs = mkWorkspace("dispatch-log-throw2-bad-");
  fs.mkdirSync(dispatchLogPath(badWs), { recursive: true });
  resetSession(badWs);
  markStateRead(badWs);
  const badResult = await handleUpdateState({
    workspace_path: badWs,
    active_feature: "throw2-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "task",
    dispatch_mechanism_tier: "fable",
  });

  assert.equal(badResult.isError, goodResult.isError, "isError must be identical regardless of dispatch-log append success/failure");
  // path/updated_at are inherently workspace- and time-specific (different
  // tmpdir, different wall-clock instant) — normalize those two volatile
  // fields out before comparing, so the assertion isolates exactly the
  // invariant under test (AC13): the dispatch-log append's success/failure
  // must never leak into the tool's own response shape.
  const goodPayload = JSON.parse(goodResult.content[0].text);
  const badPayload = JSON.parse(badResult.content[0].text);
  assert.equal(badPayload.success, goodPayload.success, "success must be identical regardless of dispatch-log append success/failure");
  assert.deepEqual(
    Object.keys(badPayload).sort(),
    Object.keys(goodPayload).sort(),
    "the response shape (key set) must be identical whether or not the dispatch-log append succeeded — a sidecar failure must never mask or alter the real write response",
  );
});

// ============================================================================
// AC14 — sidecar isolation: metrics.jsonl/telemetry.jsonl are NEVER written
// to by the dispatch-log append path.
// ============================================================================

test("ISO1: a dispatch-log append never creates or modifies .current/metrics.jsonl or .current/telemetry.jsonl", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("dispatch-log-iso1-");
  // Pre-seed both OTHER sidecars with known, unrelated content so we can
  // assert they are byte-unchanged afterward (not just "still absent"). The
  // lane dir (.current/_primary) doesn't exist yet on a fresh workspace.
  fs.mkdirSync(path.dirname(telemetryPath(ws)), { recursive: true });
  fs.writeFileSync(telemetryPath(ws), '{"ts":"seed","gate":"seed","error_code":"seed","agent_id":"seed","feature":"seed"}\n');
  fs.writeFileSync(metricsPath(ws), '{"ts":"seed","feature":"seed"}\n');
  const telemetryBefore = fs.readFileSync(telemetryPath(ws), "utf-8");
  const metricsBefore = fs.readFileSync(metricsPath(ws), "utf-8");

  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: "iso1-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "switch_role",
    dispatch_mechanism_tier: "opus",
  });
  assert.ok(!res.isError, `expected an accepted write: ${res.content?.[0]?.text}`);
  assert.equal(readLines(dispatchLogPath(ws)).length, 1, "sanity: the dispatch-log append itself did fire");

  assert.equal(fs.readFileSync(telemetryPath(ws), "utf-8"), telemetryBefore, "telemetry.jsonl must be byte-unchanged by a dispatch-log append");
  assert.equal(fs.readFileSync(metricsPath(ws), "utf-8"), metricsBefore, "metrics.jsonl must be byte-unchanged by a dispatch-log append");
});

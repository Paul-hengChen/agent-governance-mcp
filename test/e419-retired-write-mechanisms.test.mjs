// Coded by @qa-engineer
// E419: the Bookkeeping-Write and Stamp-Provenance mechanisms are retired. These tests pin the
// retirement contract: the gate codes are gone from the registry and pipeline, the tool boundary
// drops a stale `bookkeeping_write` key without rejecting the write, a hand-written-shaped
// `last_updated` no longer blocks a write, and the drift report carries no `stampAdvisory`.
// Spec: specs/e419-retire-bookkeeping-stamp.md (AC1, AC2, AC3, AC7, AC8).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { GATE_REGISTRY } from "../dist/gates/registry.js";
import { UPDATE_STATE_GATE_PIPELINE } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { detectDrift } from "../dist/tools/drift.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { forceSeedStamp, nonSuspectStampAt, SAFE_SEED_STAMP } from "./e148-seed-stamp.mjs";

const RETIRED_CODES = ["BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE", "STAMP_PROVENANCE_SUSPECT"];
const updateState = TOOL_REGISTRY.find((t) => t.name === "tw_update_state");
const HAND_WRITTEN_STAMP = "2026-01-01T00:00:00.000Z";

function mkWs(prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Seed a file-mode handoff for `feature`, then pin its last_updated to `stamp`.
async function seed(ws, feature, stamp) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "sr-engineer",
  });
  forceSeedStamp(ws, stamp);
  resetSession(ws);
  markStateRead(ws);
}

// Drives the tool entry (zod parse included), so a dropped key is observed as a client would see it.
const write = (ws, extra) =>
  updateState.run({
    workspace_path: ws,
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm continuing"],
    cut_approved: true,
    ...extra,
  });

test("AC1: tw_update_state's inputSchema has no bookkeeping_write property", () => {
  assert.equal("bookkeeping_write" in updateState.inputSchema.properties, false);
});

test("AC2: GATE_REGISTRY and UPDATE_STATE_GATE_PIPELINE exclude both retired codes", () => {
  const registryCodes = GATE_REGISTRY.map((g) => g.errorCode);
  const pipelineCodes = UPDATE_STATE_GATE_PIPELINE.flatMap((s) => s.codes);
  for (const code of RETIRED_CODES) {
    assert.ok(!registryCodes.includes(code), `${code} must not be registered`);
    assert.ok(!pipelineCodes.includes(code), `${code} must not be a pipeline step`);
  }
});

test("AC2: the registry has 35 gates and the pipeline 17 steps", () => {
  assert.equal(GATE_REGISTRY.length, 35);
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, 17);
});

test("AC3: a stale same-feature bookkeeping_write:true is dropped at the boundary; the write is accepted with a fresh stamp", async () => {
  const ws = mkWs("e419-ac3a-");
  await seed(ws, "e419-feat", SAFE_SEED_STAMP);
  const result = await write(ws, { active_feature: "e419-feat", bookkeeping_write: true });
  assert.ok(!result.isError, `a stale bookkeeping_write must not reject the write: ${result.content?.[0]?.text}`);
  assert.notEqual(parseHandoff(ws).last_updated, SAFE_SEED_STAMP, "the write must refresh last_updated, not preserve the old stamp");
});

test("AC3: bookkeeping_write:true on a different feature gets the ordinary FEATURE_LEASE_HELD result, no bookkeeping-specific error", async () => {
  const ws = mkWs("e419-ac3b-");
  await seed(ws, "e419-incumbent", nonSuspectStampAt(-60_000));
  const result = await write(ws, { active_feature: "e419-other", bookkeeping_write: true });
  assert.ok(result.isError, "a live incumbent still holds the lease against another feature");
  const text = result.content[0].text;
  assert.match(text, /FEATURE_LEASE_HELD/);
  assert.doesNotMatch(text, /BOOKKEEPING/i);
});

test("AC7: a hand-written-shaped on-disk last_updated no longer blocks a same-feature write", async () => {
  const ws = mkWs("e419-ac7a-");
  await seed(ws, "e419-feat", HAND_WRITTEN_STAMP);
  const result = await write(ws, { active_feature: "e419-feat" });
  assert.ok(!result.isError, `a :00.000Z stamp must not reject the write: ${result.content?.[0]?.text}`);
  assert.doesNotMatch(result.content?.[0]?.text ?? "", /STAMP_PROVENANCE/);
});

test("AC7: a stamp-remediation: note gets no special treatment and is kept as an ordinary pending note", async () => {
  const ws = mkWs("e419-ac7b-");
  await seed(ws, "e419-feat", HAND_WRITTEN_STAMP);
  const note = "stamp-remediation: ordinary note";
  const result = await write(ws, { active_feature: "e419-feat", pending_notes: [note] });
  assert.ok(!result.isError, `the write must be accepted: ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).pending_notes[0], note);
});

test("AC8: the drift report has no stampAdvisory key, on a hand-written-stamp handoff and on a fresh project", async () => {
  const ws = mkWs("e419-ac8a-");
  await seed(ws, "e419-feat", HAND_WRITTEN_STAMP);
  assert.equal("stampAdvisory" in JSON.parse(detectDrift(ws)), false);
  const empty = mkWs("e419-ac8b-");
  assert.equal("stampAdvisory" in JSON.parse(detectDrift(empty)), false);
});

test("AC8: the tw_detect_drift description does not name stampAdvisory", () => {
  const drift = TOOL_REGISTRY.find((t) => t.name === "tw_detect_drift");
  assert.doesNotMatch(drift.description, /stampAdvisory/);
});

test("boundary: an empty active_feature on a stale bookkeeping_write is still validated normally (no silent acceptance)", async () => {
  const ws = mkWs("e419-bound-");
  await seed(ws, "e419-feat", SAFE_SEED_STAMP);
  let rejected = false;
  try {
    const r = await write(ws, { active_feature: "", bookkeeping_write: true });
    rejected = Boolean(r.isError);
  } catch {
    rejected = true;
  }
  assert.ok(rejected, "an invalid payload must not be rescued by the dropped key");
});

// Coded by @qa-engineer
// E324 (T-E324-02): a zod-boundary rejection emits NO telemetry when workspace_path is any directory
// at or below a `.current` segment (E317 only covered the bare `.current` dir). WHY: emitting there
// creates a stray nested <...>/.current/**/telemetry tree under the lane/history dir. The guard is a
// whole-segment test on the normalized path, so a name merely containing the text still emits and a
// path that normalizes out of `.current` is judged after normalization. Spec AC-E324-1/2.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { handleGateStats } from "../dist/tools/gate-stats.js";

const UPDATE = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

async function rejectWithError(ws) {
  try {
    await UPDATE.run({
      workspace_path: ws,
      active_feature: "f",
      status: "In_Progress",
      agent_id: "pm",
      dispatch_pins: { pm: "claude-opus-4-1" },
    });
  } catch (err) {
    return err;
  }
  assert.fail("expected rejection");
}

const firedCount = async (ws) => {
  const report = JSON.parse((await handleGateStats({ workspace_path: ws })).content[0].text);
  return report.fired.filter((f) => f.error_code === "DISPATCH_PIN_TIER_REJECTED").length;
};
const mkWs = (prefix = "e324-") => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test("AC-E324-1: workspace_path = <ws>/.current/<lane> + bad tier -> original error, no <lane>/.current tree", async () => {
  const ws = mkWs();
  const lane = path.join(ws, ".current", "e9");
  fs.mkdirSync(lane, { recursive: true });
  const err = await rejectWithError(lane);
  assert.match(String(err?.message ?? err), /DISPATCH_PIN_TIER_REJECTED/);
  assert.equal(fs.existsSync(path.join(lane, ".current")), false);
  assert.equal(fs.existsSync(path.join(ws, ".current", ".current")), false);
});

test("AC-E324-1: a deeper directory (<ws>/.current/history/<bucket>) emits nothing either", async () => {
  const ws = mkWs();
  const deep = path.join(ws, ".current", "history", "2026-10");
  fs.mkdirSync(deep, { recursive: true });
  const err = await rejectWithError(deep);
  assert.match(String(err?.message ?? err), /DISPATCH_PIN_TIER_REJECTED/);
  assert.equal(fs.existsSync(path.join(deep, ".current")), false);
  assert.equal(fs.existsSync(path.join(ws, ".current", "_primary")), false, "no sidecar anywhere under the ws");
});

test("AC-E324-1: trailing slash on a lane dir is normalized and still skipped", async () => {
  const ws = mkWs();
  const lane = path.join(ws, ".current", "e9");
  fs.mkdirSync(lane, { recursive: true });
  await rejectWithError(lane + path.sep);
  assert.equal(fs.existsSync(path.join(lane, ".current")), false);
});

test("AC-E324-2: a workspace dir merely containing the text (my.current-ws) still emits once", async () => {
  const parent = mkWs();
  const ws = path.join(parent, "my.current-ws");
  fs.mkdirSync(ws);
  await rejectWithError(ws);
  assert.equal(await firedCount(ws), 1);
});

test("AC-E324-2: a path that normalizes out of .current (<ws>/.current/..) is judged after normalization and emits", async () => {
  const ws = mkWs();
  fs.mkdirSync(path.join(ws, ".current"));
  await rejectWithError(path.join(ws, ".current", ".."));
  assert.equal(await firedCount(ws), 1);
});

test("AC-E324-2: a segment like .currentx or x.current is not `.current` and emits", async () => {
  for (const name of [".currentx", "x.current"]) {
    const ws = path.join(mkWs(), name);
    fs.mkdirSync(ws);
    await rejectWithError(ws);
    assert.equal(await firedCount(ws), 1, name);
  }
});

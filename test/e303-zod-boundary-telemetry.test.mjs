// Coded by @qa-engineer
// E303 AC10 end-to-end: a zod-boundary rejection (DISPATCH_PIN_TIER_REJECTED)
// reaches the telemetry sidecar and tw_gate_stats lists it under `fired`, not
// `zero_fire`. WHY: before E303 the code was invisible to the E6 retro forever.
// Spec: specs/e308-tier-enum-and-zod-telemetry.md (AC8, AC10).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { handleGateStats } from "../dist/tools/gate-stats.js";

const UPDATE = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

async function reject(ws) {
  try {
    await UPDATE.run({
      workspace_path: ws,
      active_feature: "f",
      status: "In_Progress",
      agent_id: "pm",
      dispatch_pins: { pm: "claude-opus-4-1" },
    });
  } catch {
    return;
  }
  assert.fail("expected rejection");
}

test("E303-E2E1: after one rejected write, tw_gate_stats lists DISPATCH_PIN_TIER_REJECTED under fired (count 1), not zero_fire", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e303-e2e-"));
  await reject(ws);
  const out = await handleGateStats({ workspace_path: ws });
  const report = JSON.parse(out.content[0].text);
  const hit = report.fired.filter((f) => f.error_code === "DISPATCH_PIN_TIER_REJECTED");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].fires, 1);
  assert.ok(!report.zero_fire.includes("DISPATCH_PIN_TIER_REJECTED"));
});

test("E303-E2E2: with zero telemetry the code stays under zero_fire", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e303-e2e0-"));
  const out = await handleGateStats({ workspace_path: ws });
  const report = JSON.parse(out.content[0].text);
  assert.ok(report.zero_fire.includes("DISPATCH_PIN_TIER_REJECTED"));
  assert.equal(report.fired.length, 0);
});

// E317: a workspace_path that IS the `.current` directory must emit no telemetry
// (it would land in <ws>/.current/.current/<lane>/telemetry.jsonl). The original
// validation error must still reach the caller unchanged.
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

for (const [label, suffix] of [["bare", ""], ["trailing slash", "/"]]) {
  test(`E317 AC-E317-1: workspace_path = <ws>/.current${suffix} (${label}) + bad tier -> original error, no .current/.current tree`, async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e317-"));
    fs.mkdirSync(path.join(ws, ".current"));
    const err = await rejectWithError(path.join(ws, ".current") + suffix);
    assert.match(String(err?.message ?? err), /DISPATCH_PIN_TIER_REJECTED/);
    assert.equal(fs.existsSync(path.join(ws, ".current", ".current")), false);
  });
}

test("E317 AC-E317-2: a normal workspace still emits (one DISPATCH_PIN_TIER_REJECTED under fired)", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e317-ok-"));
  await reject(ws);
  const report = JSON.parse((await handleGateStats({ workspace_path: ws })).content[0].text);
  assert.equal(report.fired.filter((f) => f.error_code === "DISPATCH_PIN_TIER_REJECTED").length, 1);
});

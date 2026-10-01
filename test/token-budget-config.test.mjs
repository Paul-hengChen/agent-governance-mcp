// Coded by @qa-engineer
// Tests for the optional tokenBudgetPerFeature field in tools/config.ts
// (specs/b9-token-budget-brake.md AC1, AC4, AC6). The brake is advisory, with no
// server gate, so the contract is loadConfig's filter: an invalid or absent
// budget must look exactly like a workspace that never heard of the feature.
// Each test uses a fresh tmp workspace so the config cache keys do not collide.
// Spec-to-test map and why NaN is not tested: specs/e260h-comment-rationale.md (test/token-budget-config.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { loadConfig } from "../dist/tools/config.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twcfgbudget-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function configPathOf(ws) {
  return path.join(ws, ".current", ".config.json");
}

// Writes raw (already-serialized) JSON text, so callers can embed numeric
// literals (like `1e400`) that JSON.stringify would not reproduce verbatim.
function writeRawConfig(ws, jsonText) {
  fs.writeFileSync(configPathOf(ws), jsonText);
}

function writeConfig(ws, body) {
  writeRawConfig(ws, JSON.stringify(body));
}

// ---------- an absent key or file leaves the brake disabled (AC1) ----------

test("T-B9-03 AC1: config file exists with other fields but no tokenBudgetPerFeature key -> field absent", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["tasks.md"] });
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.tokenBudgetPerFeature,
    undefined,
    "brake must be disabled (field absent) when the key is simply not present",
  );
});

test("T-B9-03 AC1: .current/.config.json does not exist at all -> field absent", () => {
  const ws = mkWorkspace();
  // No writeConfig call — file was never created.
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.tokenBudgetPerFeature,
    undefined,
    "brake must be disabled when the config file doesn't exist",
  );
  assert.deepEqual(cfg, {}, "no-file workspace still returns the empty WorkspaceConfig shape");
});

// ---------- invalid values are filtered to absent, without failing (AC4) ----------

test("T-B9-03 AC4: string value is filtered to absent", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: "500000" });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, undefined);
});

test("T-B9-03 AC4: negative value is filtered to absent", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: -100 });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, undefined);
});

test("T-B9-03 AC4: zero is filtered to absent (must be a positive number, not just non-negative)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: 0 });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, undefined);
});

test("T-B9-03 AC4: numeric-literal overflow (Infinity via valid JSON) is filtered to absent", () => {
  const ws = mkWorkspace();
  // `1e400` is valid JSON number syntax; JS numeric overflow parses it to
  // Infinity. This is the one way Infinity can reach loadConfig through an
  // otherwise-valid JSON document (see file-level WHY comment above).
  writeRawConfig(ws, '{"tokenBudgetPerFeature": 1e400}');
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, undefined);
});

test("T-B9-03 AC4 boundary: null is filtered to absent", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: null });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, undefined);
});

test("T-B9-03 AC4 boundary: empty string is filtered to absent", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: "" });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, undefined);
});

test("T-B9-03 AC4 boundary: numeric-looking / special-character string is filtered to absent (typeof gate, no coercion)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: "1e5 tokens!!" });
  const cfg = loadConfig(ws);
  assert.equal(
    cfg.tokenBudgetPerFeature,
    undefined,
    "loadConfig must not coerce numeric-looking strings — typeof !== 'number' fails outright",
  );
});

test("T-B9-03 AC4 positive control: a genuinely positive finite number IS surfaced (guards against an over-broad filter)", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, 500000);
});

test("T-B9-03 AC4 boundary: large-but-finite value is accepted, not mistaken for overflow", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { tokenBudgetPerFeature: Number.MAX_SAFE_INTEGER });
  const cfg = loadConfig(ws);
  assert.equal(cfg.tokenBudgetPerFeature, Number.MAX_SAFE_INTEGER);
});

// ---------- workspaces without the key behave byte-identically to before (AC6) ----------

test("T-B9-03 AC6: existing config fields are untouched when tokenBudgetPerFeature is absent", () => {
  const ws = mkWorkspace();
  writeConfig(ws, {
    taskPattern: "^- \\[([ x])\\] (\\S+)\\s+(.+)$",
    taskPaths: ["a.md", "b.md"],
    driftBaselineIds: ["T1", "T2"],
  });
  const cfg = loadConfig(ws);
  assert.equal(cfg.taskPattern, "^- \\[([ x])\\] (\\S+)\\s+(.+)$");
  assert.deepEqual(cfg.taskPaths, ["a.md", "b.md"]);
  assert.deepEqual(cfg.driftBaselineIds, ["T1", "T2"]);
  assert.equal(
    cfg.tokenBudgetPerFeature,
    undefined,
    "adding this feature must not manufacture a budget out of thin air for workspaces that never set one",
  );
  assert.deepEqual(
    Object.keys(cfg).sort(),
    ["driftBaselineIds", "taskPattern", "taskPaths"].sort(),
    "typed view must carry exactly the pre-feature key set — no stray tokenBudgetPerFeature key even as undefined",
  );
});

test("T-B9-03 AC6: a workspace that has never created .current/.config.json sees byte-identical (pre-feature) behavior", () => {
  const ws = mkWorkspace();
  const cfgPath = configPathOf(ws);
  assert.equal(fs.existsSync(cfgPath), false, "precondition: file genuinely does not exist");

  const cfg = loadConfig(ws);
  assert.deepEqual(cfg, {}, "no-file behavior is the same empty object pre- and post-feature");
  assert.equal(
    fs.existsSync(cfgPath),
    false,
    "a read must never materialize the file — no-file heal-write is a different (existing-file-only) code path",
  );
});

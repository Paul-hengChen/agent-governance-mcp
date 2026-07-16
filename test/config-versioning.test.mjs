// Coded by @qa-engineer
// T31: .current/.config.json schema-versioning. Imports compiled dist/.
// Each test uses a fresh tmp workspace so the module-level configCache key
// (workspacePath) doesn't collide.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { loadConfig, getConfigError } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twcfgver-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeConfig(ws, body) {
  const p = path.join(ws, ".current", ".config.json");
  fs.writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
  return p;
}

function readConfigRaw(ws) {
  return fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8");
}

// ---------- AC-1: schema_version stamped on heal-write ----------

test("T31 AC-1: heal-on-read stamps schema_version on a legacy config", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["custom/tasks.md"] });
  loadConfig(ws);
  const raw = JSON.parse(readConfigRaw(ws));
  assert.equal(raw.schema_version, CURRENT_VERSIONS.config);
  assert.deepEqual(raw.taskPaths, ["custom/tasks.md"]);
});

test("T31 AC-1: returned WorkspaceConfig view does NOT carry schema_version", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPattern: "^- \\[([ x])\\] (\\S+)\\s+(.+)$" });
  const cfg = loadConfig(ws);
  assert.equal(cfg.schema_version, undefined, "typed view should hide schema_version");
  assert.equal(typeof cfg.taskPattern, "string");
});

// ---------- AC-2: lazy migrate on read ----------

test("T31 AC-2 heal: legacy v0 config (no schema_version) heals to v1 on disk", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["tasks.md"] });
  // Pre-condition: no schema_version on disk.
  assert.equal(JSON.parse(readConfigRaw(ws)).schema_version, undefined);
  loadConfig(ws);
  // Post-condition: schema_version present at CURRENT.
  assert.equal(JSON.parse(readConfigRaw(ws)).schema_version, CURRENT_VERSIONS.config);
});

test("T31 AC-2 fast-path: v1 config triggers no write-back (mtime unchanged)", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, { schema_version: 1, taskPaths: ["tasks.md"] });
  const cfgPath = path.join(ws, ".current", ".config.json");
  const mtimeBefore = fs.statSync(cfgPath).mtimeMs;

  // Allow filesystem mtime resolution gap so a write would be detectable.
  await new Promise((r) => setTimeout(r, 20));

  loadConfig(ws);

  const mtimeAfter = fs.statSync(cfgPath).mtimeMs;
  assert.equal(mtimeAfter, mtimeBefore, "no write-back when already at CURRENT");
});

test("T31 AC-2: missing config returns empty WorkspaceConfig (no crash)", () => {
  const ws = mkWorkspace();
  const cfg = loadConfig(ws);
  assert.deepEqual(cfg, {});
});

// ---------- AC-4: refuse-loud on future versions ----------

test("T31 AC-4 (re-pinned E31): future schema_version degrades non-fatally — loadConfig returns {} and getConfigError() names the refuse-loud reason, no throw", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { schema_version: 99, taskPaths: ["tasks.md"] });
  let cfg;
  assert.doesNotThrow(() => {
    cfg = loadConfig(ws);
  }, "E31: a future-schema config must never throw out of loadConfig");
  assert.deepEqual(cfg, {}, "defaults in effect when the on-disk schema can't be understood");
  const err = getConfigError(ws);
  assert.ok(typeof err === "string" && err.length > 0, "the refusal must surface via getConfigError, not silence");
  assert.match(err, /config on-disk version 99 > server max 1/);
});

// ---------- Field round-trip ----------

test("T31 round-trip: taskPattern and taskPaths survive migration", () => {
  const ws = mkWorkspace();
  writeConfig(ws, {
    taskPattern: "^- \\[([ x])\\] (\\S+)\\s+(.+)$",
    taskPaths: ["a.md", "b.md"],
  });
  const cfg = loadConfig(ws);
  assert.equal(cfg.taskPattern, "^- \\[([ x])\\] (\\S+)\\s+(.+)$");
  assert.deepEqual(cfg.taskPaths, ["a.md", "b.md"]);
});

test("T31 round-trip: unknown JSON keys preserved on disk but stripped from typed view", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: ["x.md"], futureField: "value", anotherUnknown: 42 });
  const cfg = loadConfig(ws);
  // Typed view drops unknown keys.
  assert.equal(cfg.futureField, undefined);
  assert.equal(cfg.anotherUnknown, undefined);
  // On disk, the heal-write preserves the unknown keys for forward-compat.
  const raw = JSON.parse(readConfigRaw(ws));
  assert.equal(raw.futureField, "value");
  assert.equal(raw.anotherUnknown, 42);
});

// ---------- Boundary inputs ----------

test("T31 boundary (re-pinned E31): malformed JSON degrades non-fatally — {} config + getConfigError() names the parse problem, no throw", () => {
  const ws = mkWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), "{not valid json");
  let cfg;
  assert.doesNotThrow(() => {
    cfg = loadConfig(ws);
  }, "E31: malformed JSON must never throw out of loadConfig");
  assert.deepEqual(cfg, {});
  const err = getConfigError(ws);
  assert.ok(typeof err === "string" && err.length > 0);
  assert.match(err, /Failed to parse/);
});

test("T31 boundary (re-pinned E31): JSON array (non-object) degrades non-fatally — {} config + getConfigError() names the root-shape problem, no throw", () => {
  const ws = mkWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), "[1,2,3]");
  let cfg;
  assert.doesNotThrow(() => {
    cfg = loadConfig(ws);
  }, "E31: a non-object root must never throw out of loadConfig");
  assert.deepEqual(cfg, {});
  const err = getConfigError(ws);
  assert.ok(typeof err === "string" && err.length > 0);
  assert.match(err, /must be a JSON object/);
});

test("T31 boundary: empty taskPaths array is dropped from typed view", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPaths: [] });
  const cfg = loadConfig(ws);
  // An empty-array taskPaths is meaningless (no candidates to search); the
  // typed view should fall back to undefined so resolveTaskPaths uses defaults.
  assert.equal(cfg.taskPaths, undefined);
});

test("T31 boundary: non-string entries in taskPaths are filtered out", () => {
  const ws = mkWorkspace();
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify({ taskPaths: ["valid.md", 42, null, "also-valid.md"] }),
  );
  const cfg = loadConfig(ws);
  assert.deepEqual(cfg.taskPaths, ["valid.md", "also-valid.md"]);
});

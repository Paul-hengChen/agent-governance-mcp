// Coded by @qa-engineer
// Tests that loadConfig NEVER throws on a corrupt, unparseable, unreadable,
// non-object or future-schema .current/.config.json: the tw_get_state pre-flight
// read goes through it, so a throw there blocks every other call. getConfigError(ws)
// reports the failure while defaults are served in place of an unusable config file.
// Known and accepted: the task-mutation tools degrade to default task paths silently.
// Rationale: specs/e260g-comment-rationale.md (test/e31-config-nonfatal.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { loadConfig, getConfigError } from "../dist/tools/config.js";
import { readHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import {
  parseTasksFromFile,
  completeTaskInFile,
  addTaskInFile,
} from "../dist/tools/tasks-file.js";

function mkWorkspace(prefix = "e31-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeConfig(ws, body) {
  const p = path.join(ws, ".current", ".config.json");
  fs.writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf-8");
  return p;
}

function writeMinimalHandoff(ws, active_feature = "e31-fixture") {
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
active_feature: "${active_feature}"
status: "In_Progress"
last_updated: "${new Date().toISOString()}"
qa_round: 0
review_round: 0
visual_round: 0
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
    "utf-8",
  );
}

function isRoot() {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

// ============================================================================
// Envelope purity: clean/absent config must add NO key (byte-identical to
// the envelope shape before config errors were surfaced, E31).
// ============================================================================

test("E31 envelope purity: no .config.json at all + no handoff.md -> exists:false envelope carries no config_error key", () => {
  const ws = mkWorkspace();
  resetSession(ws);
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.exists, false);
  assert.ok(!("config_error" in parsed), "absent config must never add a config_error key");
});

test("E31 envelope purity: no .config.json at all + handoff.md present -> exists:true envelope carries no config_error key", () => {
  const ws = mkWorkspace();
  resetSession(ws);
  writeMinimalHandoff(ws);
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.exists, true);
  assert.ok(!("config_error" in parsed), "absent config must never add a config_error key");
});

test("E31 envelope purity: a clean/valid .config.json -> envelope carries no config_error key", () => {
  const ws = mkWorkspace();
  resetSession(ws);
  writeConfig(ws, { host: "claude-code", taskPaths: ["tasks.md"] });
  writeMinimalHandoff(ws);
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.exists, true);
  assert.ok(!("config_error" in parsed), "a clean config must never add a config_error key");
});

test("E31 envelope purity: clean config on the exists:false shape (fresh project, config predates handoff) also carries no config_error key", () => {
  const ws = mkWorkspace();
  resetSession(ws);
  writeConfig(ws, { host: "claude-code" });
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.exists, false);
  assert.ok(!("config_error" in parsed));
});

// ============================================================================
// Error message content: getConfigError() must name the config path AND the
// specific problem for every fatality mode.
// ============================================================================

test("E31 error message: unparseable JSON names the path and the parse problem", () => {
  const ws = mkWorkspace();
  const cfgPath = writeConfig(ws, "{ not valid json at all");
  let cfg;
  assert.doesNotThrow(() => {
    cfg = loadConfig(ws);
  });
  assert.deepEqual(cfg, {});
  const err = getConfigError(ws);
  assert.ok(err.includes(cfgPath), "error must name the exact config file path");
  assert.match(err, /Failed to parse/);
  assert.match(err, /defaults in effect/);
});

test("E31 error message: JSON array (non-object root) names the path and the shape problem", () => {
  const ws = mkWorkspace();
  const cfgPath = writeConfig(ws, "[1,2,3]");
  const cfg = loadConfig(ws);
  assert.deepEqual(cfg, {});
  const err = getConfigError(ws);
  assert.ok(err.includes(cfgPath));
  assert.match(err, /must be a JSON object/);
});

test("E31 error message: future schema_version names the path and the version numbers", () => {
  const ws = mkWorkspace();
  const cfgPath = writeConfig(ws, { schema_version: 4242, taskPaths: ["tasks.md"] });
  const cfg = loadConfig(ws);
  assert.deepEqual(cfg, {});
  const err = getConfigError(ws);
  assert.ok(err.includes(cfgPath));
  assert.match(err, /4242/, "error must name the offending on-disk version");
  assert.match(err, /server max/);
});

test(
  "E31 error message: unreadable file (chmod 000) names the path and the read problem",
  { skip: isRoot() ? "running as root — permission bits are bypassed" : false },
  () => {
    const ws = mkWorkspace();
    const cfgPath = writeConfig(ws, { host: "claude-code" });
    fs.chmodSync(cfgPath, 0o000);
    try {
      const cfg = loadConfig(ws);
      assert.deepEqual(cfg, {});
      const err = getConfigError(ws);
      assert.ok(err.includes(cfgPath));
      assert.match(err, /Failed to read/);
    } finally {
      fs.chmodSync(cfgPath, 0o644);
    }
  },
);

// ============================================================================
// mtime-cache invalidation: fixing the corrupt file must clear the cached
// error on the NEXT call (self-heal, no server restart).
// ============================================================================

test("E31 cache invalidation: fixing a corrupt config file clears the cached config_error", async () => {
  const ws = mkWorkspace();
  const cfgPath = writeConfig(ws, "{ broken");
  assert.ok(getConfigError(ws), "precondition: corrupt config produces a cached error");
  assert.deepEqual(loadConfig(ws), {});

  // Allow filesystem mtime resolution gap so the fix is detectable as a
  // distinct mtime (mirrors T31 AC-2's fast-path test convention).
  await new Promise((r) => setTimeout(r, 20));
  fs.writeFileSync(cfgPath, JSON.stringify({ host: "claude-code" }), "utf-8");

  assert.equal(getConfigError(ws), null, "a fixed file must clear the cached error on the next read");
  assert.deepEqual(loadConfig(ws), { host: "claude-code" });
});

test("E31 cache invalidation: breaking a previously-clean config file (mtime bump) surfaces the error on the very next call", async () => {
  const ws = mkWorkspace();
  const cfgPath = writeConfig(ws, { host: "claude-code" });
  assert.equal(getConfigError(ws), null, "precondition: clean config has no cached error");
  assert.deepEqual(loadConfig(ws), { host: "claude-code" });

  await new Promise((r) => setTimeout(r, 20));
  fs.writeFileSync(cfgPath, "{ now broken", "utf-8");

  assert.deepEqual(loadConfig(ws), {}, "a freshly-broken file must degrade on the very next call");
  assert.match(getConfigError(ws), /Failed to parse/);
});

// ============================================================================
// Task-mutation tools silently fall back to DEFAULT_TASK_PATHS /
// DEFAULT_TASK_REGEX under a corrupt config. These tests document that
// by-design behavior; they do not change it. ("QA probe 1", raised in code
// review)
// ============================================================================

const CUSTOM_TASK_PATTERN = "^\\* (DONE|TODO) (\\S+) (.+)$";
const CUSTOM_TASK_REL = "custom-tasks.md";

function writeCustomTasksFile(ws) {
  fs.writeFileSync(
    path.join(ws, CUSTOM_TASK_REL),
    "## Active\n* TODO CUSTOM-1 build the custom-format thing\n",
    "utf-8",
  );
}

test("E31 QA probe 1 baseline: a clean config with custom taskPattern+taskPaths parses the custom-format task file correctly", () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPattern: CUSTOM_TASK_PATTERN, taskPaths: [CUSTOM_TASK_REL] });
  writeCustomTasksFile(ws);

  const tasks = parseTasksFromFile(ws);
  assert.ok(tasks, "custom-format task file must be discovered via the custom taskPaths");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "CUSTOM-1");
  assert.equal(tasks[0].completed, false);
});

test("E31 QA probe 1: corrupting the SAME workspace's config after the precondition read already migrated the task file into the lane ledger leaves it discoverable — e125a's lane ledger no longer depends on config taskPaths once migrated", () => {
// The precondition read is the first task-list access, so it migrates the custom
// task file into the lane ledger (lane "_primary", no .git here); after that config
// taskPaths no longer affect discovery. The never-migrated case is the addTaskInFile
// probe below (specs/e125a-lane-local-ledgers.md AC13).
  const ws = mkWorkspace();
  writeConfig(ws, { taskPattern: CUSTOM_TASK_PATTERN, taskPaths: [CUSTOM_TASK_REL] });
  writeCustomTasksFile(ws);
  assert.ok(parseTasksFromFile(ws), "precondition: custom config resolves the file (and, e125a, migrates it into the lane-local ledger)");

  // Corrupt the config in place.
  writeConfig(ws, "{ this breaks the custom taskPattern/taskPaths config");

  let tasks;
  assert.doesNotThrow(() => {
    tasks = parseTasksFromFile(ws);
  }, "E31: a corrupt config must never throw out of the task-parsing path either");
  assert.ok(
    tasks,
    "with the lane-local ledger already established by the precondition read, config corruption must NOT un-discover the task FILE (spec D-F/AC9 — tw_* reads only the lane copy from then on); tasks must be an array, never null",
  );
  // The FILE stays discoverable (the assertion above), but the custom
  // taskPattern is lost along with the rest of the corrupted config — with
  // resolveTaskRegex() back to DEFAULT_TASK_REGEX, the custom-format row
  // ("* TODO CUSTOM-1 ...") no longer matches, so the row itself silently
  // stops parsing. Two independent degradations compose here: the FILE path
  // one, which the lane-local ledger removes (above), and the ROW PATTERN
  // one, documented as by-design; both are non-fatal. (E31, e125a)
  assert.equal(tasks.length, 0, "the custom-format row no longer parses under the reverted DEFAULT_TASK_REGEX — non-fatal, not a crash");
  // The degradation is still loudly recorded.
  assert.ok(getConfigError(ws), "the corrupt config is still loudly recorded via getConfigError, for the tw_get_state envelope to surface");
});

test("E31 QA probe 1: completeTaskInFile against a config-degraded workspace returns a loud JSON error, never throws, never mis-completes a task", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, { taskPattern: CUSTOM_TASK_PATTERN, taskPaths: [CUSTOM_TASK_REL] });
  writeCustomTasksFile(ws);
  writeConfig(ws, "{ broken");

  let raw;
  await assert.doesNotReject(async () => {
    raw = await completeTaskInFile(ws, "CUSTOM-1");
  }, "E31: completeTaskInFile must never throw when the config degrades");
  const result = JSON.parse(raw);
  assert.equal(result.error, "No task list file found.", "with DEFAULT_TASK_PATHS in effect, the custom task file is unreachable — a loud, honest error, not a silent no-op success");
});

test("E31 QA probe 1: addTaskInFile against a config-degraded workspace silently targets the lane-local ledger instead of the workspace's custom taskPaths (documented fallback, not fixed — e125a moved the fallback destination itself)", async () => {
// No lane ledger and no legacy file exist yet (the "migration never happened" case),
// so addTaskInFile falls back to the current lane's ledger `.current/<lane>/tasks.md`,
// never a config-resolved path, and the configured custom path stays unused while
// config is corrupt (specs/e125a-lane-local-ledgers.md AC13).
  const ws = mkWorkspace();
  writeConfig(ws, { taskPattern: CUSTOM_TASK_PATTERN, taskPaths: [CUSTOM_TASK_REL] });
  // No pre-existing task file this time — addTaskInFile creates one.
  writeConfig(ws, { schema_version: 999999, taskPattern: CUSTOM_TASK_PATTERN, taskPaths: [CUSTOM_TASK_REL] });

  let raw;
  await assert.doesNotReject(async () => {
    raw = await addTaskInFile(ws, "NEW-1", "some new task");
  });
  const result = JSON.parse(raw);
  assert.equal(result.success, true);
  assert.equal(result.path, path.join(ws, ".current", "_primary", "tasks.md"));
  assert.equal(fs.existsSync(path.join(ws, CUSTOM_TASK_REL)), false, "the workspace's configured custom path must NOT have been created");
  assert.equal(
    fs.existsSync(path.join(ws, ".current", "tasks.md")),
    false,
    "the pre-e125a flat fallback path (.current/tasks.md) must not have been created either — the fallback itself is now lane-local",
  );
  assert.ok(getConfigError(ws), "the degradation remains discoverable via getConfigError / the tw_get_state envelope");
});

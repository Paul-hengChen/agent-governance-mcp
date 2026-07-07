// Coded by @qa-engineer
// C4-05: drift-baseline-exemption — AC-1 through AC-7.
//
// Contract under test: task IDs listed in `.current/.config.json` →
// `driftBaselineIds` are acknowledged as already-shipped-and-reconciled and
// therefore exempt from the vibe-coding-drift direction ONLY. The baseline
// must never mute the handoff-ahead or FAIL/Blocked drift directions, and an
// absent/empty baseline must be byte-identical to pre-feature behavior.
//
// Tests import detectDrift from the compiled dist (dist/tools/drift.js) and
// construct synthetic file-mode workspaces on tmpfs, mirroring
// test/drift-archived-tasks.test.mjs. They do NOT call the live
// tw_detect_drift MCP tool — the running server may hold a stale pre-rebuild
// dist. Each test uses a fresh mkdtemp workspace, so the per-path
// loadConfig() memoization cache can never serve a stale config.
//
// tasks.md MUST begin with "<!-- schema_version: 1 -->" so that
// checkVersionSkew and parseTasks() do not short-circuit before reaching the
// baseline filter logic.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { detectDrift } from "../dist/tools/drift.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { loadConfig } from "../dist/tools/config.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";
import { resetSession } from "../dist/guards/session.js";

// ---------------------------------------------------------------------------
// Helpers (mirroring drift-archived-tasks.test.mjs)
// ---------------------------------------------------------------------------

/** Create a fresh tmp workspace with .current/ ready. */
function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twdrift-base-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

/**
 * Write a handoff.md with the given completed_tasks list. Performs the
 * mandatory parseHandoff() pre-seed so writeHandoffState does not trip the
 * freshness guard on a pristine workspace.
 */
async function seedHandoff(ws, completedTasks = [], status = "In_Progress") {
  resetSession();
  parseHandoff(ws); // pre-seed snapshot
  await writeHandoffState(ws, "feat", status, completedTasks, [], undefined, "pm", 0);
}

/** Write tasks.md with the schema_version sentinel on line 1. */
function writeTasks(ws, body) {
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    `<!-- schema_version: 1 -->\n${body}`,
    "utf-8",
  );
}

/** Write .current/.config.json. Pass undefined to omit driftBaselineIds. */
function writeConfig(ws, driftBaselineIds) {
  const cfg = { schema_version: 1 };
  if (driftBaselineIds !== undefined) cfg.driftBaselineIds = driftBaselineIds;
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify(cfg, null, 2),
    "utf-8",
  );
}

const vibeLine = (id) => `Task list shows ${id} completed, but handoff state doesn't mention it. Possible vibe-coding drift.`;
const handoffAheadLine = (id) => `Handoff says ${id} completed, but task list shows it as incomplete.`;

/** True if any (possibly compressed) drift detail mentions the task id. */
function detailsMention(report, id) {
  return report.details.some((d) => new RegExp(`\\b${id}\\b`).test(d));
}

// ---------------------------------------------------------------------------
// AC-1 — baselined ID suppresses vibe-coding drift and leaves tasksCompleted
// ---------------------------------------------------------------------------

test("AC-1: baselined [x] id not in handoff emits no vibe drift and is absent from tasksCompleted", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T470"]);
  writeTasks(ws, "- [x] T470 shipped long ago\n");
  await seedHandoff(ws, []);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false, "baseline-only completion must not count as drift");
  assert.ok(!detailsMention(report, "T470"), "no drift line may name the baselined id");
  assert.ok(!report.tasksCompleted.includes("T470"), "baselined id must be suppressed from tasksCompleted (AC-1)");
});

// ---------------------------------------------------------------------------
// AC-2 — non-baselined IDs still surface
// ---------------------------------------------------------------------------

test("AC-2: non-baselined [x] id still fires vibe drift alongside a baselined one", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T470"]);
  writeTasks(ws, "- [x] T470 shipped long ago\n- [x] T999 fresh unreconciled work\n");
  await seedHandoff(ws, []);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "the non-baselined completion is genuine drift and must surface");
  assert.ok(detailsMention(report, "T999"), "T999 must be reported");
  assert.ok(!detailsMention(report, "T470"), "T470 stays exempt in the same run");
  assert.ok(report.tasksCompleted.includes("T999"), "non-baselined id stays in tasksCompleted");
});

// ---------------------------------------------------------------------------
// AC-3 — absent key / absent file / empty array: pre-feature behavior
// ---------------------------------------------------------------------------

test("AC-3: config file present without driftBaselineIds — vibe drift fires as before", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, undefined);
  writeTasks(ws, "- [x] T470 shipped long ago\n");
  await seedHandoff(ws, []);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.deepEqual(report.details, [vibeLine("T470")], "absent key must be byte-identical to pre-feature output");
  assert.ok(report.tasksCompleted.includes("T470"));
});

test("AC-3: driftBaselineIds: [] — empty array behaves exactly like absent key", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, []);
  writeTasks(ws, "- [x] T470 shipped long ago\n");
  await seedHandoff(ws, []);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.deepEqual(report.details, [vibeLine("T470")]);
});

test("AC-3/AC-7: no .config.json at all (SQLite/HTTP-mode analog) — no crash, pre-feature behavior", async () => {
  const ws = mkWorkspace();
  // deliberately no writeConfig
  writeTasks(ws, "- [x] T470 shipped long ago\n");
  await seedHandoff(ws, []);

  assert.deepEqual(loadConfig(ws), {}, "missing config must load as {} (graceful no-op)");

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  assert.deepEqual(report.details, [vibeLine("T470")]);
});

// ---------------------------------------------------------------------------
// AC-4 — composes with the archived-section (## Completed) filter
// ---------------------------------------------------------------------------

test("AC-4: archived-section filter and baseline filter apply independently", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T-BASE"]);
  writeTasks(
    ws,
    [
      "## Active",
      "- [x] T-BASE baselined active-scope completion",
      "- [x] T-LIVE genuine unreconciled completion",
      "",
      "## Completed",
      "- [x] T-ARCHIVED ancient archived completion",
      "",
    ].join("\n"),
  );
  await seedHandoff(ws, []);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "T-LIVE must still be drift");
  assert.ok(detailsMention(report, "T-LIVE"), "non-baselined active task fires");
  assert.ok(!detailsMention(report, "T-BASE"), "baselined active task exempt (baseline filter)");
  assert.ok(!detailsMention(report, "T-ARCHIVED"), "archived task exempt (archived-section filter, unchanged)");
  assert.deepEqual(report.tasksCompleted, ["T-LIVE"], "report shows only the genuinely drifting id");
});

// ---------------------------------------------------------------------------
// AC-5 — handoff-ahead and FAIL/Blocked directions are never muted
// ---------------------------------------------------------------------------

test("AC-5: baselined id recorded in handoff but [ ] in tasks.md still fires handoff-ahead drift", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T470"]);
  // The load-bearing invariant: the handoff-ahead comparison must use the
  // UNFILTERED completed set — baselining T470 must not stop the detector
  // from noticing the handoff claims it done while tasks.md says it isn't.
  writeTasks(ws, "- [ ] T470 reopened after handoff recorded it\n");
  await seedHandoff(ws, ["T470"]);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "handoff-ahead drift must survive baselining");
  assert.ok(
    report.details.includes(handoffAheadLine("T470")),
    "the handoff-ahead line for the baselined id must be emitted verbatim",
  );
});

test("AC-5: FAIL status with incomplete tasks still reports, baseline notwithstanding", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T470"]);
  writeTasks(ws, "- [x] T470 baselined done\n- [ ] T471 still open\n");
  await seedHandoff(ws, [], "FAIL");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.ok(
    report.details.some((d) => d.includes("Handoff status is FAIL")),
    "FAIL/Blocked incomplete-tasks drift direction is untouched by the baseline",
  );
});

// ---------------------------------------------------------------------------
// AC-6 — no schema bump; malformed entries filtered like taskPaths precedent
// ---------------------------------------------------------------------------

test("AC-6: CURRENT_VERSIONS.config stays 1 and a pre-feature config loads unmigrated", async () => {
  const ws = mkWorkspace();
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify({ schema_version: 1, taskPattern: "^- \\[([ x])\\] (\\S+)\\s+(.+)$" }),
    "utf-8",
  );

  assert.equal(CURRENT_VERSIONS.config, 1, "feature must not bump the config schema");
  const cfg = loadConfig(ws);
  assert.equal(cfg.driftBaselineIds, undefined, "absent field stays absent — no migration writes");

  const raw = JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));
  assert.equal(raw.schema_version, 1, "on-disk file untouched by loadConfig");
});

test("AC-6: non-string entries in driftBaselineIds are filtered out, not fatal", async () => {
  const ws = mkWorkspace();
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify({ schema_version: 1, driftBaselineIds: ["T470", 42, null, "T471"] }),
    "utf-8",
  );
  writeTasks(ws, "- [x] T470 baselined\n- [x] T471 baselined\n");
  await seedHandoff(ws, []);

  const cfg = loadConfig(ws);
  assert.deepEqual(cfg.driftBaselineIds, ["T470", "T471"], "string filter mirrors the taskPaths precedent");

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, false, "both surviving string ids are exempt");
});

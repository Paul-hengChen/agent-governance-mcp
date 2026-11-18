// Coded by @qa-engineer
// E441 (specs/e436-stale-paths-tool-contracts): six tool descriptions are contracts with exact text;
// tw_get_state's blocked list equals the set of tools whose handlers call enforcePreFlight.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { TOOL_REGISTRY } = await import(pathToFileURL(path.join(ROOT, "dist", "tools", "registry.js")).href);

const EXPECTED = {
  tw_get_state:
    "Read the workspace's handoff state: JSON { exists: true, ...state }, or { exists: false, message } " +
    "when no state exists; either may add advisory keys. File mode fails on an unparseable handoff file " +
    "or one a newer server wrote. Until it has run for the same workspace_path in this server process, " +
    "tw_update_state, tw_complete_task, tw_rollback_task, tw_void_task, tw_add_task and tw_sync fail " +
    "with ⛔ BLOCKED.",
  tw_update_state:
    "Atomically write the workspace's handoff state at the end of a role step. Returns JSON " +
    "{ success: true, updated_at, ... }, with warnings when an advisory applies. Each write is checked " +
    "against the role-transition matrix (ALLOWED_TRANSITIONS) and the gate pipeline; a rejection writes " +
    "no state and returns text starting with ⛔ and the error code, plus a hint. Also fails with " +
    "⛔ BLOCKED before tw_get_state, or ⛔ STATE DRIFT if the state changed since that read.",
  tw_get_next_task:
    "Return the first unchecked, non-voided task as JSON { next: { id, description, section, " +
    "completed }, isCheckpoint, progress: { completed, total } }; isCheckpoint is true when the task " +
    "before it is in another section. Returns { allComplete: true, totalTasks } when none is left, " +
    "or { error } when there is no task list.",
  tw_rollback_task:
    "Turn a checked task back to unchecked and record `(reverted: <reason>)` on it. Returns JSON " +
    "{ success: true, taskId, marked: \"reverted\", reason }, or { error } when there is no task list, " +
    "the task is unknown or unchecked, or (file mode) task_id or reason has a line break. Touches the " +
    "task list only, not the handoff state or its completed_tasks. ⛔ BLOCKED before tw_get_state.",
  tw_void_task:
    "Void an unchecked task that should never have existed (not one done and then undone). Returns " +
    "JSON { success: true, taskId, marked: \"voided\", reason }, or { error } when the task is checked " +
    "or in the handoff's completed_tasks (the message names the fix), unknown, already voided " +
    "(alreadyVoided: true), or (file mode) task_id or reason has a line break. A voided task drops out " +
    "of tw_get_next_task, tw_detect_drift and tw_sync, and tw_add_task refuses its id. ⛔ BLOCKED " +
    "before tw_get_state.",
  tw_detect_drift:
    "Compare the handoff state with the task list. Returns JSON { driftDetected, details, " +
    "handoffLastTask, tasksCompleted, tasksIncomplete, stampAdvisory, fanoutAdvisory, " +
    "evidenceBackedIds }; details has one line per finding, and the advisories are null or a note " +
    "that never sets driftDetected. State written by a newer server is reported as drift. Repairs " +
    "nothing (tw_sync copies handoff completions to the task list). Run it after tw_get_state.",
};

const byName = (n) => TOOL_REGISTRY.find((t) => t.name === n);

test("AC3: the six descriptions equal the spec strings exactly", () => {
  for (const [name, text] of Object.entries(EXPECTED)) {
    assert.ok(byName(name), `${name} registered`);
    assert.equal(byName(name).description, text, name);
  }
});

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

test("AC5: tw_get_state's blocked list equals the tools whose handlers call enforcePreFlight", () => {
  // Call sites are `enforcePreFlight(<workspace>, "<tool>")`; the definition has a typed parameter list.
  const guarded = new Set();
  const re = /enforcePreFlight\(([^)]*)\)/g;
  for (const f of walk(path.join(ROOT, "tools"))) {
    const src = fs.readFileSync(f, "utf-8");
    for (const m of src.matchAll(re)) {
      const lit = m[1].match(/["'](tw_[a-z_]+)["']/);
      if (lit) guarded.add(lit[1]);
    }
  }
  assert.ok(guarded.size >= 6, `found guarded tools: ${[...guarded].join(",")}`);
  const d = byName("tw_get_state").description;
  const tail = d.slice(d.indexOf("tw_update_state"), d.indexOf(" fail with"));
  const listed = new Set(tail.match(/tw_[a-z_]+/g));
  assert.deepEqual([...listed].sort(), [...guarded].sort());
});

test("AC6: none of the six contains specs/, MANDATORY, a ticket id, or the stale void claims", () => {
  for (const name of Object.keys(EXPECTED)) {
    const d = byName(name).description;
    assert.ok(!d.includes("specs/"), `${name}: specs/`);
    assert.ok(!d.includes("MANDATORY"), `${name}: MANDATORY`);
    assert.ok(!/\(E\d/.test(d), `${name}: ticket id`);
    assert.ok(!d.includes("uniform not-found"), `${name}: uniform not-found`);
    assert.ok(!d.includes("structurally reusable"), `${name}: structurally reusable`);
  }
});

// Coded by @qa-engineer
// R10 — tw_sync / reconcileTasks: mirror tasks.md checkboxes to the authoritative
// handoff.completed_tasks (handoff → tasks only). Verifies the SAFE direction
// flips, the REFUSED direction (vibe drift) is never promoted, idempotence, and
// the no-handoff guard. Tests drive the rebuilt dist directly (same convention as
// drift-archived-tasks.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { reconcileTasks } from "../dist/tools/sync.js";
import { detectDrift } from "../dist/tools/drift.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twsync-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}
async function seedHandoff(ws, completedTasks = []) {
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "feat", "In_Progress", completedTasks, [], undefined, "pm", 0);
}
function writeTasks(ws, body) {
  fs.writeFileSync(path.join(ws, "tasks.md"), `<!-- schema_version: 1 -->\n${body}`, "utf-8");
}

test("AC-1: handoff-ahead tasks get their tasks.md checkbox flipped (synced)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, ["T01", "T02"]);
  writeTasks(ws, "## Active\n- [ ] T01 [P0] alpha | depends_on: none\n- [ ] T02 [P0] beta | depends_on: none\n- [ ] T03 [P1] gamma | depends_on: none\n");

  const r = JSON.parse(await reconcileTasks(ws));
  assert.equal(r.ok, true);
  assert.deepEqual(r.synced.sort(), ["T01", "T02"]);
  assert.deepEqual(r.refusedVibeDrift, []);

  // Drift for T01/T02 (handoff-ahead) must be gone after reconcile.
  const drift = JSON.parse(detectDrift(ws));
  assert.ok(drift.tasksCompleted.includes("T01"), "T01 now completed in tasks");
  assert.ok(drift.tasksCompleted.includes("T02"), "T02 now completed in tasks");
});

test("AC-2: tasks.md-only completion (vibe drift) is REFUSED, never promoted", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []); // handoff acknowledges nothing
  writeTasks(ws, "## Active\n- [x] T09 [P0] done-without-qa | depends_on: none\n- [ ] T10 [P0] todo | depends_on: none\n");

  const r = JSON.parse(await reconcileTasks(ws));
  assert.equal(r.ok, true);
  assert.deepEqual(r.synced, [], "nothing to sync — handoff is empty");
  assert.deepEqual(r.refusedVibeDrift, ["T09"], "T09 vibe drift reported, not promoted");

  // Handoff must remain unchanged (T09 still absent from completed_tasks).
  const handoff = parseHandoff(ws);
  assert.ok(!handoff.completed_tasks.some((c) => /\bT09\b/.test(c)), "handoff NOT mutated");
});

test("AC-3: already in sync → synced empty, ok", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [ ] T01 [P0] a | depends_on: none\n");
  const r = JSON.parse(await reconcileTasks(ws));
  assert.equal(r.ok, true);
  assert.deepEqual(r.synced, []);
  assert.deepEqual(r.refusedVibeDrift, []);
});

test("AC-4: no handoff state → ok:false, nothing synced", async () => {
  const ws = mkWorkspace();
  writeTasks(ws, "## Active\n- [ ] T01 [P0] a | depends_on: none\n");
  const r = JSON.parse(await reconcileTasks(ws));
  assert.equal(r.ok, false);
  assert.deepEqual(r.synced, []);
});

test("AC-5: idempotent — second reconcile is a no-op", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, ["T01"]);
  writeTasks(ws, "## Active\n- [ ] T01 [P0] a | depends_on: none\n");
  const first = JSON.parse(await reconcileTasks(ws));
  assert.deepEqual(first.synced, ["T01"]);
  const second = JSON.parse(await reconcileTasks(ws));
  assert.deepEqual(second.synced, [], "already reconciled");
});

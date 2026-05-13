// Coded by @sr-engineer
// Tests for tools/tasks.ts — completeTask, rollbackTask, getNextTask.
// Covers regex-escape correctness, annotation-suffix handling, and the
// section-boundary checkpoint flag. Run via `node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { completeTask, rollbackTask, getNextTask } from "../dist/tools/tasks.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";

function mkWorkspaceWithTasks(taskBody) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twtasks-"));
  fs.writeFileSync(path.join(ws, "tasks.md"), taskBody);
  resetSession(ws);
  markStateRead(ws);
  return ws;
}

function readTasks(ws) {
  return fs.readFileSync(path.join(ws, "tasks.md"), "utf-8");
}

test("getNextTask returns the first unchecked task with progress counts", () => {
  const ws = mkWorkspaceWithTasks(
    `## Phase 1\n- [x] T01 done\n- [ ] T02 todo\n- [ ] T03 todo\n`
  );
  const result = JSON.parse(getNextTask(ws));
  assert.equal(result.next.id, "T02");
  assert.equal(result.next.section, "Phase 1");
  assert.deepEqual(result.progress, { completed: 1, total: 3 });
});

test("getNextTask flags a checkpoint when the section changes", () => {
  const ws = mkWorkspaceWithTasks(
    `## Phase 1\n- [x] T01 done\n\n## Phase 2\n- [ ] T02 next\n`
  );
  const result = JSON.parse(getNextTask(ws));
  assert.equal(result.next.id, "T02");
  assert.equal(result.isCheckpoint, true);
});

test("getNextTask reports allComplete when nothing is pending", () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T01 a\n- [x] T02 b\n`);
  const result = JSON.parse(getNextTask(ws));
  assert.equal(result.allComplete, true);
  assert.equal(result.totalTasks, 2);
});

test("getNextTask returns an error when no task file is found", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twtasks-"));
  const result = JSON.parse(getNextTask(ws));
  assert.match(result.error, /No task list/);
});

test("completeTask flips the checkbox and appends the note", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T01 build login\n`);
  const result = JSON.parse(await completeTask(ws, "T01", "passes ci"));
  assert.equal(result.success, true);
  assert.match(readTasks(ws), /- \[x\] T01 build login \(note: passes ci\)/);
});

test("completeTask returns an error for an unknown task id", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T01 a\n`);
  const result = JSON.parse(await completeTask(ws, "T99"));
  assert.match(result.error, /T99 not found/);
});

test("completeTask returns an error when the task is already completed", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T01 a\n`);
  const result = JSON.parse(await completeTask(ws, "T01"));
  assert.match(result.error, /already completed/);
});

test("completeTask escapes regex metacharacters in the task id", async () => {
  // T.1 must not match T_1, T+1, etc. The escape function is the only thing
  // standing between us and a cross-task false match.
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T_1 wrong target\n- [ ] T.1 right target\n`);
  const result = JSON.parse(await completeTask(ws, "T.1"));
  assert.equal(result.success, true);
  const body = readTasks(ws);
  assert.match(body, /- \[x\] T\.1 right target/);
  assert.match(body, /- \[ \] T_1 wrong target/, "the regex-meta neighbour must stay untouched");
});

test("rollbackTask flips [x] back to [ ] and appends the reason", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T01 build login\n`);
  const result = JSON.parse(await rollbackTask(ws, "T01", "fails smoke"));
  assert.equal(result.success, true);
  assert.match(readTasks(ws), /- \[ \] T01 build login \(reverted: fails smoke\)/);
});

test("rollbackTask strips a prior note annotation but keeps the description", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T01 build login (note: passes ci)\n`);
  await rollbackTask(ws, "T01", "regression");
  const body = readTasks(ws);
  assert.match(body, /- \[ \] T01 build login \(reverted: regression\)/);
  assert.doesNotMatch(body, /note: passes ci/);
});

test("rollbackTask preserves parentheses inside the description (e.g. fix(auth))", async () => {
  // Only known annotation suffixes (note:|reverted:) must be stripped — arbitrary
  // parens that are part of the description text must survive intact.
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T01 fix(auth) login bug\n`);
  await rollbackTask(ws, "T01", "missed edge");
  const body = readTasks(ws);
  assert.match(body, /- \[ \] T01 fix\(auth\) login bug \(reverted: missed edge\)/);
});

test("rollbackTask returns an error when the task is not completed", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T01 a\n`);
  const result = JSON.parse(await rollbackTask(ws, "T01", "n/a"));
  assert.match(result.error, /not completed/);
});

test("rollbackTask returns an error for an unknown task id", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T01 a\n`);
  const result = JSON.parse(await rollbackTask(ws, "T99", "n/a"));
  assert.match(result.error, /T99 not found/);
});

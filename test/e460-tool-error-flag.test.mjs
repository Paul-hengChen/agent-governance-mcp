// Coded by @qa-engineer
// Scenario test for specs/e448-judge-evidence-checks.md AC18 (E460).
// Invariant: an MCP client decides success vs failure from the result's `isError` flag. Every tw_rollback_task
// refusal therefore carries `isError: true` — in file mode and in SQLite mode alike — while its text stays
// byte-for-byte what it was (the JSON `error` envelope); a successful rollback carries no `isError` at all.
// (AC17, the tw_complete_task judge refusal, is asserted in test/e431-test-first-server-path.test.mjs AC14.)
// Tests call the real tool entries (TOOL_REGISTRY.run -> zod -> handler) against temp workspaces.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

let SqliteHandoffStorage = null;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite e460 AC18 case skipped");
}

const ADD = TOOL_REGISTRY.find((e) => e.name === "tw_add_task");
const COMPLETE = TOOL_REGISTRY.find((e) => e.name === "tw_complete_task");
const ROLLBACK = TOOL_REGISTRY.find((e) => e.name === "tw_rollback_task");

const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

const text = (r) => r?.content?.[0]?.text ?? "";
// The existing refusal text (tools/tasks-file.ts and tools/storage-sqlite.ts), unchanged by E460.
const NOT_COMPLETED = (id) => `Task ${id} is not completed, cannot rollback.`;

test("AC18: tw_rollback_task on a not-completed task returns its existing JSON error text with isError: true (file mode); a successful rollback carries no isError", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e460-file-"));
  cleanup.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws, activeFeature: "e460-feat", status: "In_Progress", completedTasks: [], pendingNotes: ["seed"],
    lastAgent: "code-reviewer", cutApproved: true,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  await ADD.run({ workspace_path: ws, task_id: "T-1", description: "one" });

  const refused = await ROLLBACK.run({ workspace_path: ws, task_id: "T-1", reason: "probe" });
  assert.equal(JSON.parse(text(refused)).error, NOT_COMPLETED("T-1"), `text unchanged: ${text(refused)}`);
  assert.equal(refused.isError, true, "a refusal is flagged isError: true");

  const done = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.match(text(done), /"marked":"completed"/);
  const ok = await ROLLBACK.run({ workspace_path: ws, task_id: "T-1", reason: "re-open for a fix" });
  assert.equal(JSON.parse(text(ok)).error, undefined, `rollback succeeded: ${text(ok)}`);
  assert.equal(ok.isError, undefined, "a successful rollback carries no isError");
});

test("AC18: tw_rollback_task on a not-completed task returns its existing JSON error text with isError: true (SQLite mode); a successful rollback carries no isError", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("better-sqlite3 not installed");
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e460-sq-")));
  cleanup.push(dir);
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  try {
    setActiveStorage(storage);
    await storage.writeState({ workspacePath: dir, activeFeature: "e460-feat", status: "In_Progress", completedTasks: [], pendingNotes: ["seed"], lastAgent: "code-reviewer" });
    await storage.addTask(dir, "T-1", "one", "P");
    resetSession(dir);
    markStateRead(dir);

    const refused = await ROLLBACK.run({ workspace_path: dir, task_id: "T-1", reason: "probe" });
    assert.equal(JSON.parse(text(refused)).error, NOT_COMPLETED("T-1"), `text unchanged: ${text(refused)}`);
    assert.equal(refused.isError, true, "a refusal is flagged isError: true");

    await storage.completeTask(dir, "T-1");
    const ok = await ROLLBACK.run({ workspace_path: dir, task_id: "T-1", reason: "re-open for a fix" });
    assert.equal(JSON.parse(text(ok)).error, undefined, `rollback succeeded: ${text(ok)}`);
    assert.equal(ok.isError, undefined, "a successful rollback carries no isError");
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch { /* best effort */ }
  }
});

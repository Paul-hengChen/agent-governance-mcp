// Coded by @qa-engineer
// T29: tasks.md schema-versioning sentinel + migration. Imports compiled dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseTasksFromFile,
  getNextTaskFromFile,
  completeTaskInFile,
  rollbackTaskInFile,
  addTaskInFile,
} from "../dist/tools/tasks-file.js";
import { resetSession } from "../dist/guards/session.js";

function mkWorkspace() {
  // Pre-seed a minimal tasks.md at workspace ROOT so findTasksFile resolves
  // there (resolveTaskPaths' first candidate is `.current/tasks.md`; without
  // pre-seeding, addTaskInFile would create the file under `.current/` and
  // our `read()` helper would miss it). Existing test/tasks.test.mjs uses the
  // same pattern.
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twtv-"));
  fs.writeFileSync(path.join(ws, "tasks.md"), "# Tasks\n\n## Active\n");
  return ws;
}

function mkWorkspaceEmpty() {
  // Variant for tests that need a workspace with NO existing tasks.md (so
  // addTaskInFile creates one fresh). Reads happen via the helper below
  // which checks `.current/tasks.md` first.
  return fs.mkdtempSync(path.join(os.tmpdir(), "twtv-"));
}

function writeTasksFile(ws, body) {
  const p = path.join(ws, "tasks.md");
  fs.writeFileSync(p, body);
  return p;
}

function read(ws) {
  return fs.readFileSync(path.join(ws, "tasks.md"), "utf-8");
}

const SENTINEL_LINE = "<!-- schema_version: 1 -->";

// ---------- AC-1: sentinel on every write ----------

test("AC-1: addTaskInFile creates new tasks.md with sentinel on line 1", async () => {
  const ws = mkWorkspace();
  resetSession();
  await addTaskInFile(ws, "T01", "first task");
  const content = read(ws);
  assert.ok(content.startsWith(`${SENTINEL_LINE}\n`), `expected sentinel on line 1, got: ${content.slice(0, 60)}`);
});

test("AC-1: completeTaskInFile preserves sentinel after mutation", async () => {
  const ws = mkWorkspace();
  resetSession();
  await addTaskInFile(ws, "T01", "first task");
  parseTasksFromFile(ws); // mark state read for freshness
  await completeTaskInFile(ws, "T01");
  const content = read(ws);
  assert.ok(content.startsWith(`${SENTINEL_LINE}\n`));
  assert.match(content, /- \[x\] T01/);
});

test("AC-1: rollbackTaskInFile preserves sentinel after mutation", async () => {
  const ws = mkWorkspace();
  resetSession();
  await addTaskInFile(ws, "T01", "first task");
  parseTasksFromFile(ws);
  await completeTaskInFile(ws, "T01");
  parseTasksFromFile(ws);
  await rollbackTaskInFile(ws, "T01", "test reason");
  const content = read(ws);
  assert.ok(content.startsWith(`${SENTINEL_LINE}\n`));
  assert.match(content, /- \[ \] T01.*\(reverted: test reason\)/);
});

test("AC-1: re-write idempotent — sentinel not duplicated", async () => {
  const ws = mkWorkspace();
  resetSession();
  await addTaskInFile(ws, "T01", "a");
  await addTaskInFile(ws, "T02", "b");
  const content = read(ws);
  // exactly one sentinel line
  const matches = content.match(/<!--\s*schema_version:/g) || [];
  assert.equal(matches.length, 1, "expected exactly one sentinel");
});

// ---------- AC-2: heal-on-read for getNextTaskFromFile ----------

test("AC-2: getNextTaskFromFile heals sentinel-less tasks.md on first read", () => {
  const ws = mkWorkspace();
  resetSession();
  // Pre-versioning file: no sentinel.
  writeTasksFile(
    ws,
    `# Tasks

## Active
- [ ] T01 legacy task
- [ ] T02 another legacy task
`,
  );
  const before = read(ws);
  assert.ok(!before.startsWith("<!--"), "fixture has no sentinel");

  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01");

  // Heal-on-read is synchronous in tasks (unlike handoff's async fire-and-forget).
  const after = read(ws);
  assert.ok(after.startsWith(`${SENTINEL_LINE}\n`), "file was healed");
});

test("AC-2 fast-path: getNextTaskFromFile no-op when file already at v1", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `${SENTINEL_LINE}
# Tasks

## Active
- [ ] T01 already-stamped task
`,
  );
  const mtimeBefore = fs.statSync(path.join(ws, "tasks.md")).mtimeMs;

  getNextTaskFromFile(ws);

  const mtimeAfter = fs.statSync(path.join(ws, "tasks.md")).mtimeMs;
  assert.equal(mtimeAfter, mtimeBefore, "no write should happen on v1 file");
});

test("AC-2 boundary: parseTasksFromFile does NOT trigger heal-on-read (drift path)", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `# Tasks

## Active
- [ ] T01 legacy
`,
  );
  const before = read(ws);

  const tasks = parseTasksFromFile(ws);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "T01");

  const after = read(ws);
  assert.equal(after, before, "parseTasksFromFile must be read-only (drift relies on this)");
});

// ---------- AC-4: refuse-loud on future versions ----------

test("AC-4: parseTasksFromFile refuses-loud when sentinel version > CURRENT", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `<!-- schema_version: 99 -->
# Tasks

## Active
- [ ] T01 future
`,
  );
  assert.throws(
    () => parseTasksFromFile(ws),
    /tasks on-disk version 99 > server max 1/,
  );
});

test("AC-4: getNextTaskFromFile refuses-loud on future sentinel", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `<!-- schema_version: 7 -->
## Active
- [ ] T01 future
`,
  );
  assert.throws(
    () => getNextTaskFromFile(ws),
    /tasks on-disk version 7 > server max 1/,
  );
});

test("AC-4: completeTaskInFile refuses-loud on future sentinel (mutation path)", async () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `<!-- schema_version: 42 -->
## Active
- [ ] T01 future
`,
  );
  await assert.rejects(
    async () => completeTaskInFile(ws, "T01"),
    /tasks on-disk version 42 > server max 1/,
  );
});

// ---------- boundary cases ----------

test("boundary: malformed sentinel value falls into v0 and heals", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `<!-- schema_version: abc -->
## Active
- [ ] T01 valid task
`,
  );
  // The malformed line doesn't match the version regex → treated as v0 → heals.
  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01");
  assert.ok(read(ws).startsWith(`${SENTINEL_LINE}\n`));
});

test("boundary: sentinel with extra whitespace still matches as v1", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `<!--  schema_version:   1   -->
## Active
- [ ] T01 ws-padded
`,
  );
  const mtimeBefore = fs.statSync(path.join(ws, "tasks.md")).mtimeMs;
  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01");
  // version is 1 → CURRENT → no heal write
  const mtimeAfter = fs.statSync(path.join(ws, "tasks.md")).mtimeMs;
  assert.equal(mtimeAfter, mtimeBefore);
});

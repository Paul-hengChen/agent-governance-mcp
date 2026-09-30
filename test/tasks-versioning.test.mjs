// Coded by @qa-engineer
// Tasks-file schema-versioning sentinel and migration. Imports compiled dist/. (T29)
//
// Re-baselined for lane-local task ledgers (qa-owned; e125a-lane-local-ledgers, spec AC13 "Test impact"):
// CURRENT_VERSIONS.tasks bumped 1 -> 2, and tw_* now reads/writes ONLY the
// current lane's ledger `.current/<lane>/tasks.md` (spec D-F/AC9) — a
// workspace with no .git resolves to lane "_primary" (tools/lane-paths.ts
// resolveCurrentLane), so every fixture here now seeds/reads
// `.current/_primary/tasks.md` directly instead of a root `tasks.md`. This
// sidesteps the separate D-C forward-migration mechanism entirely (that
// mechanism — legacy root -> lane ledger — has its own dedicated coverage in
// test/e125a-lane-local-ledgers.test.mjs AC4-AC8); these tests stay scoped to
// what they always tested: the sentinel/versioning contract of the file
// tasks-file.ts actually reads and writes.

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
  // With no .git, the current lane resolves to "_primary" (PRIMARY_LANE); this is the lane-local ledger layout (e125a).
  // No pre-seeded root tasks.md — addTaskInFile creates the lane ledger
  // fresh (spec AC9's "unmigrated feat/primary lane with no rows in root").
  return fs.mkdtempSync(path.join(os.tmpdir(), "twtv-"));
}

// The lane-local ledger path tasks-file.ts actually reads/writes for a
// .git-less workspace (PRIMARY_LANE).
function laneTasksPath(ws) {
  return path.join(ws, ".current", "_primary", "tasks.md");
}

function writeTasksFile(ws, body) {
  const p = laneTasksPath(ws);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function read(ws) {
  return fs.readFileSync(laneTasksPath(ws), "utf-8");
}

// CURRENT_VERSIONS.tasks is now 2 (e125a spec AC3/D-D) — the stamp-only v1->v2
// step leaves the body untouched; only the sentinel digit changes here.
const SENTINEL_LINE = "<!-- schema_version: 2 -->";

// ---------- every write stamps the version sentinel (AC-1) ----------

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

// ---------- getNextTaskFromFile heals a missing sentinel on read (AC-2) ----------

test("AC-2: getNextTaskFromFile heals sentinel-less tasks.md on first read", () => {
  const ws = mkWorkspace();
  resetSession();
  // Pre-versioning file: no sentinel. Written DIRECTLY at the lane path, so
  // migrateForRead's existsSync fast-path short-circuits before touching the
  // (here, nonexistent) legacy root at all.
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
  // v0 -> v2 heals through BOTH registered steps (v0->v1, v1->v2) in one call.
  const after = read(ws);
  assert.ok(after.startsWith(`${SENTINEL_LINE}\n`), "file was healed");
});

test("AC-2 fast-path: getNextTaskFromFile no-op when file already at v2 (CURRENT)", () => {
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
  const mtimeBefore = fs.statSync(laneTasksPath(ws)).mtimeMs;

  getNextTaskFromFile(ws);

  const mtimeAfter = fs.statSync(laneTasksPath(ws)).mtimeMs;
  assert.equal(mtimeAfter, mtimeBefore, "no write should happen on a file already at CURRENT (v2)");
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

// ---------- a file from a newer version is refused loudly (AC-4) ----------

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
    /tasks on-disk version 99 > server max 2/,
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
    /tasks on-disk version 7 > server max 2/,
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
    /tasks on-disk version 42 > server max 2/,
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

test("boundary: sentinel with extra whitespace still matches as v2 (CURRENT)", () => {
  const ws = mkWorkspace();
  resetSession();
  writeTasksFile(
    ws,
    `<!--  schema_version:   2   -->
## Active
- [ ] T01 ws-padded
`,
  );
  const mtimeBefore = fs.statSync(laneTasksPath(ws)).mtimeMs;
  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01");
  // version is 2 → CURRENT → no heal write
  const mtimeAfter = fs.statSync(laneTasksPath(ws)).mtimeMs;
  assert.equal(mtimeAfter, mtimeBefore);
});

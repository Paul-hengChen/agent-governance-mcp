// Coded by @sr-engineer
// Tests for tools/handoff.ts — locale-agnostic section parsing and write/read
// round-trip. Run via `node --test`. Imports the compiled output in dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twhand-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRaw(ws, body) {
  const p = path.join(ws, ".current", "handoff.md");
  fs.writeFileSync(p, body);
  return p;
}

test("parseHandoff returns null when handoff.md is missing", () => {
  const ws = mkWorkspace();
  assert.equal(parseHandoff(ws), null);
});

test("parseHandoff reads YAML frontmatter and Chinese section headings", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
active_feature: "feature-x"
status: "In_Progress"
last_updated: "2026-05-13T00:00:00.000Z"
---
# 任務交接狀態

## ✅ 已完成 (Completed)
- [x] T01 build login
- [x] T02 add tests

## ⚠️ 待辦與交接
- continue refactor
- 無should-not-appear
`
  );
  const state = parseHandoff(ws);
  assert.ok(state);
  assert.equal(state.active_feature, "feature-x");
  assert.equal(state.status, "In_Progress");
  assert.deepEqual(state.completed, ["T01 build login", "T02 add tests"]);
  assert.deepEqual(state.pending, ["continue refactor", "無should-not-appear"]);
});

test("parseHandoff also matches English-only section headings", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
active_feature: "f"
status: "PASS"
last_updated: "t"
---
## Completed
- [x] A1 done

## Pending Notes
- remember to ship
`
  );
  const state = parseHandoff(ws);
  assert.ok(state);
  assert.deepEqual(state.completed, ["A1 done"]);
  assert.deepEqual(state.pending, ["remember to ship"]);
});

test("parseHandoff ignores the 無 sentinel for empty pending sections", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
active_feature: "f"
status: "PASS"
last_updated: "t"
---
## ✅ 已完成
- [x] T1 x

## ⚠️ 待辦
- 無
`
  );
  const state = parseHandoff(ws);
  assert.deepEqual(state.pending, []);
});

test("parseHandoff does not bleed completed checkboxes into pending", () => {
  // Regression: an earlier non-section-scoped parser matched "- [x]" globally,
  // causing completed items to also show up under pending.
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
active_feature: "f"
status: "PASS"
last_updated: "t"
---
## Completed
- [x] T1 a
- [x] T2 b

## Pending
- only-this-one
`
  );
  const state = parseHandoff(ws);
  assert.deepEqual(state.completed, ["T1 a", "T2 b"]);
  assert.deepEqual(state.pending, ["only-this-one"]);
});

test("parseHandoff surfaces blocking_reason and last_agent when present", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
active_feature: "f"
status: "Blocked"
last_updated: "t"
blocking_reason: "waiting on api keys"
last_agent: "agent-7"
---
## Completed
- 無

## Pending
- 無
`
  );
  const state = parseHandoff(ws);
  assert.equal(state.blocking_reason, "waiting on api keys");
  assert.equal(state.last_agent, "agent-7");
});

test("parseHandoff throws a descriptive error on malformed YAML frontmatter", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
active_feature: "unterminated
status: PASS
---
## Completed
- 無
`
  );
  assert.throws(() => parseHandoff(ws), /Failed to parse handoff\.md frontmatter/);
});

test("writeHandoffState → parseHandoff round-trip preserves all fields", async () => {
  const ws = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  const result = await writeHandoffState(
    ws,
    "feature-y",
    "In_Progress",
    ["T1 first", "T2 second"],
    ["note one", "note two"],
    undefined,
    "agent-A",
  );
  const written = JSON.parse(result);
  assert.equal(written.success, true);

  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "feature-y");
  assert.equal(state.status, "In_Progress");
  assert.equal(state.last_agent, "agent-A");
  assert.deepEqual(state.completed, ["T1 first", "T2 second"]);
  assert.deepEqual(state.pending, ["note one", "note two"]);
});

test("writeHandoffState round-trip with empty task/note arrays yields empty parsed arrays", async () => {
  const ws = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  await writeHandoffState(ws, "feature-z", "PASS", [], [], undefined, undefined);
  const state = parseHandoff(ws);
  assert.deepEqual(state.completed, []);
  assert.deepEqual(state.pending, []);
});

test("writeHandoffState round-trip preserves blocking_reason when status=Blocked", async () => {
  const ws = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  await writeHandoffState(
    ws,
    "feature-q",
    "Blocked",
    [],
    ["needs human review"],
    "missing api credentials",
    undefined,
  );
  const state = parseHandoff(ws);
  assert.equal(state.status, "Blocked");
  assert.equal(state.blocking_reason, "missing api credentials");
  assert.deepEqual(state.pending, ["needs human review"]);
});

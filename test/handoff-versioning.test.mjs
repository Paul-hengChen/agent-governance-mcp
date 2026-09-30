// Coded by @qa-engineer
// T28: handoff YAML schema-versioning. Imports the compiled output in dist/.
// Fire-and-forget write-back is async; tests yield via setImmediate before
// asserting on-disk state.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseHandoff,
  readHandoffState,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twver-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// writeRaw always seeds a RAW pre-migration fixture at the legacy flat path
// .current/handoff.md, because that is the old on-disk layout these tests
// simulate; it is left flat on purpose, not moved to a lane directory.
// (e123b9 J2, spec AC1/AC9)
function writeRaw(ws, body) {
  const p = path.join(ws, ".current", "handoff.md");
  fs.writeFileSync(p, body);
  return p;
}

// The file may or may not have migrated yet when read() is called — a plain
// parseHandoff() never migrates (AC13), while readHandoffState/
// writeHandoffState do (AC3). Mirror AC13's own read-only fallback: the
// lane-scoped path if it exists, else the legacy flat path.
function currentHandoffPath(ws) {
  const lane = resolveCurrentLanePaths(ws).handoffPath;
  return fs.existsSync(lane) ? lane : path.join(ws, ".current", "handoff.md");
}

function read(ws) {
  return fs.readFileSync(currentHandoffPath(ws), "utf-8");
}

function yieldMacrotask() {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

// ---------- AC-1: schema_version stamped on writes ----------

test("AC-1: writeHandoffState stamps schema_version: 15 in YAML (e123a-lane-layout-migration)", async () => {
  const ws = mkWorkspace();
  resetSession();
  // Initial parse to mark state read so writeHandoffState's freshness check
  // has a snapshot; on a missing file the snapshot is null and any write is fresh.
  parseHandoff(ws);
  await writeHandoffState(ws, "feat-x", "In_Progress", [], ["next"], undefined, "pm", 0);
  const content = read(ws);
  // A fresh write is stamped with the current handoff schema version, 15.
  // Every schema bump must update this literal on purpose; what each version
  // added is listed in docs/schema-versions.md. The latest bump added
  // dispatch_mechanism/dispatch_mechanism_tier and seeds nothing.
  // (e123a-lane-layout-migration)
  assert.match(content, /schema_version:\s*15/);
});

test("AC-1: schema_version appears as the first frontmatter key (grep-stable)", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "feat-y", "PASS", ["T1"], [], undefined, "qa-engineer", 0);
  const content = read(ws);
  // First YAML key after the opening `---` line must be schema_version.
  const match = content.match(/^---\r?\n([^\r\n]+)/);
  assert.ok(match, "frontmatter opener present");
  assert.match(match[1], /^schema_version:/);
});

// ---------- AC-2: lazy migrate-on-read ----------

test("AC-2: readHandoffState heals v0 handoff to CURRENT (v15) on disk (fire-and-forget)", async () => {
  const ws = mkWorkspace();
  resetSession();
  // Pre-versioning shape: no schema_version key.
  writeRaw(
    ws,
    `---
active_feature: "legacy"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
qa_round: 0
---
# 📍 任務交接狀態 (Handoff State)

## ✅ 已完成 (Completed)
- 無

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );

  const json = readHandoffState(ws);
  const parsed = JSON.parse(json);
  assert.equal(parsed.exists, true);
  assert.equal(parsed.active_feature, "legacy");

  // Yield once for the fire-and-forget writeHandoffState() to land.
  await yieldMacrotask();

  const healed = read(ws);
  // A v0 file climbs every migration step in order, v0 → v1 → … → v15, and
  // the healed file lands at the current version (15).
  assert.match(healed, /schema_version:\s*15/);
});

test("AC-2 fast path: v1 file triggers no write-back", async () => {
  const ws = mkWorkspace();
  resetSession();
  // File already at CURRENT — write the canonical v1 shape via the writer first.
  parseHandoff(ws);
  await writeHandoffState(ws, "ready", "In_Progress", [], [], undefined, "pm", 0);
  const before = read(ws);
  const mtimeBefore = fs.statSync(currentHandoffPath(ws)).mtimeMs;

  // Now read — since version === CURRENT, no fire-and-forget write should fire.
  resetSession();
  readHandoffState(ws);
  await yieldMacrotask();

  const after = read(ws);
  const mtimeAfter = fs.statSync(currentHandoffPath(ws)).mtimeMs;
  assert.equal(after, before, "content unchanged");
  assert.equal(mtimeAfter, mtimeBefore, "mtime unchanged — no write happened");
});

test("AC-2 boundary: parseHandoff returns v1 state in-memory but does NOT write back", async () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
active_feature: "legacy"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- 無

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );
  const before = read(ws);

  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "legacy");

  // parseHandoff intentionally does NOT trigger write-back (avoids recursion
  // when writeHandoffState internally calls parseHandoff to preserve prd_path).
  await yieldMacrotask();
  const after = read(ws);
  assert.equal(after, before, "parseHandoff is read-only on disk");
});

test("AC-2 regression: existing handoff missing schema_version round-trips to CURRENT (v15)", async () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
active_feature: "round-trip"
status: "PASS"
last_updated: "2026-05-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- [x] T01

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- next_role: pm
`,
  );

  readHandoffState(ws);
  await yieldMacrotask();

  const parsed = parseHandoff(ws);
  assert.equal(parsed.active_feature, "round-trip");
  assert.deepEqual(parsed.completed_tasks, ["T01"]);
  assert.deepEqual(parsed.pending_notes, ["next_role: pm"]);
  // The migration runs the full v0 → v1 → … → v15 chain and the file lands
  // at the current version (15).
  assert.match(read(ws), /schema_version:\s*15/);
});

// ---------- AC-4: refuse-loud on future versions ----------

test("AC-4: readHandoffState refuses-loud when on-disk schema_version > CURRENT", () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 99
active_feature: "from-the-future"
status: "In_Progress"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- 無

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );

  assert.throws(
    () => readHandoffState(ws),
    /handoff on-disk version 99 > server max 15/,
  );
});

test("AC-4: parseHandoff refuses-loud on future schema_version", () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 42
active_feature: "newer"
status: "PASS"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- 無

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );
  assert.throws(
    () => parseHandoff(ws),
    /on-disk version 42 > server max 15/,
  );
});

// ---------- AC-5: concurrent write-back swallows freshness errors ----------

test("AC-5: sequential second-write swallows freshness error after a healing write", async () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
active_feature: "concurrent"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- 無

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );

  // First read fires the healing write-back. We do not yield yet — instead,
  // immediately trigger a second read in the *same* session snapshot. Both
  // attempt to migrate; the second one's verifyFreshness should detect the
  // file has been rewritten and the swallowed `.catch` keeps the read clean.
  const json1 = readHandoffState(ws);
  const json2 = readHandoffState(ws);
  await yieldMacrotask();

  // Both reads return migrated state without throwing.
  assert.equal(JSON.parse(json1).active_feature, "concurrent");
  assert.equal(JSON.parse(json2).active_feature, "concurrent");
  // File ended up healed (one of the writes won; the other swallowed quietly)
  // at the current version (15).
  assert.match(read(ws), /schema_version:\s*15/);
});

// ---------- regression: missing / malformed files ----------

test("regression: readHandoffState returns exists:false when handoff.md missing", () => {
  const ws = mkWorkspace();
  resetSession();
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.exists, false);
});

test("regression: malformed YAML still throws with descriptive error", () => {
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
this: is: not: valid: yaml: [unclosed
---
body
`,
  );
  assert.throws(
    () => readHandoffState(ws),
    /Failed to parse handoff.md frontmatter/,
  );
});

// Coded by @qa-engineer
// Pins for specs/e161-qa-claim-and-state-reads.md E184 (AC-E184-1..3; AC-E184-4 is the unmodified
// test/dispatch-log.test.mjs plus test/dispatch-mechanism.test.mjs run at lane close).
// Invariant: tw_get_state is the read every writer does first, so it must not show the previous hop's
// dispatch_mechanism_tier (a self-report the next writer would be tempted to copy). The record itself is untouched:
// the handoff file and the library read keep the value. Only the read view drops the one top-level key; everything
// else, including dispatch_mechanism and the E300 advisory, is exactly what storage.readState returns.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, readHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, getActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleGetState } from "../dist/tools/handoff-orchestrator.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite e184 case skipped");
}

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e184-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seed(ws, extra = {}) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e184-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "sr-engineer",
    ...extra,
  });
  resetSession(ws);
}

test("AC-E184-1: handleGetState omits dispatch_mechanism_tier; every other key and value equals storage.readState", async () => {
  const ws = mkWorkspace();
  await seed(ws, { dispatchMechanism: "task", dispatchMechanismTier: "opus" });
  const raw = JSON.parse(getActiveStorage().readState(ws));
  assert.equal(raw.dispatch_mechanism_tier, "opus", "precondition: the on-disk record carries the tier");
  assert.equal(raw.dispatch_mechanism, "task", "precondition: and the mechanism");
  const out = JSON.parse((await handleGetState({ workspace_path: ws })).content[0].text);
  assert.equal("dispatch_mechanism_tier" in out, false, "the tier key is absent from the read view");
  const expected = { ...raw };
  delete expected.dispatch_mechanism_tier;
  assert.deepEqual(out, expected, "all other keys and values (dispatch_mechanism included) are unchanged");
  assert.equal(out.dispatch_mechanism, "task");

  // The record is untouched: file bytes and the library read still carry the tier (AC-E184-4's contract).
  assert.match(fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8"), /^dispatch_mechanism_tier: "?opus"?$/m);
  assert.equal(JSON.parse(readHandoffState(ws)).dispatch_mechanism_tier, "opus");
});

test("AC-E184-2: with no tier present, handleGetState text is byte-identical to storage.readState (file and SQLite)", async (t) => {
  const ws = mkWorkspace();
  await seed(ws);
  assert.equal(
    (await handleGetState({ workspace_path: ws })).content[0].text,
    getActiveStorage().readState(ws),
    "file mode, no tier",
  );

  // A nested key that merely shares the name is not the top-level key: left alone, text byte-identical.
  const ws2 = mkWorkspace();
  await seed(ws2, { pendingNotes: ["dispatch_mechanism_tier: opus is mentioned in a note"] });
  const text2 = (await handleGetState({ workspace_path: ws2 })).content[0].text;
  assert.equal(text2, getActiveStorage().readState(ws2));
  assert.match(text2, /dispatch_mechanism_tier: opus is mentioned/);

  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3 (SQLite half)");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e184-sq-"));
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  try {
    setActiveStorage(storage);
    await storage.writeState({
      workspacePath: dir, activeFeature: "e184-sq", status: "In_Progress",
      completedTasks: [], pendingNotes: ["seed"], lastAgent: "sr-engineer",
    });
    resetSession(dir);
    assert.equal((await handleGetState({ workspace_path: dir })).content[0].text, storage.readState(dir), "SQLite mode");
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test("AC-E184-3: an out-of-enum dispatch_pins value still yields dispatch_pins_advisory, and the tier is still omitted", async () => {
  const ws = mkWorkspace();
  await seed(ws, {
    dispatchPins: { "sr-engineer": "claude-opus-4-1-20250805", pm: "fable" },
    dispatchMechanism: "task",
    dispatchMechanismTier: "opus",
  });
  const raw = JSON.parse(getActiveStorage().readState(ws));
  assert.equal(raw.dispatch_mechanism_tier, "opus", "precondition");
  const out = JSON.parse((await handleGetState({ workspace_path: ws })).content[0].text);
  assert.equal("dispatch_mechanism_tier" in out, false);
  assert.deepEqual(out.dispatch_pins, { "sr-engineer": "claude-opus-4-1-20250805", pm: "fable" }, "pins stay raw");
  assert.deepEqual(out.dispatch_pins_advisory.pins, { "sr-engineer": "claude-opus-4-1-20250805" });
  assert.deepEqual(out.dispatch_pins_advisory.allowed, ["opus", "sonnet", "haiku", "fable"]);
  assert.match(out.dispatch_pins_advisory.hint, /DISPATCH_PIN_TIER_REJECTED/);
});

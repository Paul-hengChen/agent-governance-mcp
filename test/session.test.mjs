// Tests for guards/session.ts: pre-flight check and per-file mtime freshness.
// Run via `node --test`. Imports the compiled output in dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  markStateRead,
  hasReadState,
  enforcePreFlight,
  verifyFreshness,
  refreshSnapshotFor,
  resetSession,
  cleanupStaleSessions,
} from "../dist/guards/session.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twsess-"));
  const current = path.join(ws, ".current");
  fs.mkdirSync(current, { recursive: true });
  const handoff = path.join(current, "handoff.md");
  fs.writeFileSync(handoff, "---\nactive_feature: t\nstatus: In_Progress\nlast_updated: t\n---\n");
  return { ws, handoff };
}

test("enforcePreFlight blocks tools until markStateRead is called", () => {
  const { ws } = mkWorkspace();
  resetSession(ws);

  assert.equal(hasReadState(ws), false);
  assert.throws(() => enforcePreFlight(ws, "tw_update_state"), /BLOCKED/);

  markStateRead(ws);
  assert.equal(hasReadState(ws), true);
  assert.doesNotThrow(() => enforcePreFlight(ws, "tw_update_state"));
});

test("verifyFreshness passes when on-disk mtime matches the snapshot", () => {
  const { ws, handoff } = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);
  assert.doesNotThrow(() => verifyFreshness(ws, handoff, "handoff"));
});

test("verifyFreshness throws when another writer touches the file", () => {
  const { ws, handoff } = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  // Bump the mtime forward — simulates an out-of-band edit.
  const future = (Date.now() + 60_000) / 1000;
  fs.utimesSync(handoff, future, future);

  assert.throws(() => verifyFreshness(ws, handoff, "handoff"), /STATE DRIFT/);
});

test("verifyFreshness handles missing-file mtime symmetrically", () => {
  // Snapshot taken when file did NOT exist (mtime=null). File then appears
  // → currentMtime !== null → must throw.
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twsess-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  const handoff = path.join(ws, ".current", "handoff.md");

  resetSession(ws);
  markStateRead(ws); // snapshot taken with no handoff.md → mtime=null

  fs.writeFileSync(handoff, "appeared");
  assert.throws(() => verifyFreshness(ws, handoff, "handoff"), /STATE DRIFT/);
});

test("verifyFreshness is a no-op when there is no session at all", () => {
  // enforcePreFlight is the gate; verifyFreshness must not double-throw on
  // missing sessions because the pre-flight error message is more useful.
  const { ws, handoff } = mkWorkspace();
  resetSession(ws);
  assert.doesNotThrow(() => verifyFreshness(ws, handoff, "handoff"));
});

test("refreshSnapshotFor lets a successful writer keep using the session", () => {
  const { ws, handoff } = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  // Simulate a successful write that bumps mtime.
  const future = (Date.now() + 60_000) / 1000;
  fs.utimesSync(handoff, future, future);
  refreshSnapshotFor(ws, handoff, "handoff");

  // After refresh, subsequent verifies against the same on-disk state pass.
  assert.doesNotThrow(() => verifyFreshness(ws, handoff, "handoff"));
});

test("cleanupStaleSessions evicts old sessions and keeps fresh ones", async () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), "twsess-a-"));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), "twsess-b-"));
  resetSession(a);
  resetSession(b);
  markStateRead(a);

  // Make A look 10 minutes old by sleeping briefly then calling cleanup with
  // an aggressive maxAge that targets only A.
  await new Promise((r) => setTimeout(r, 20));
  markStateRead(b);

  cleanupStaleSessions(10); // anything older than 10ms is stale
  assert.equal(hasReadState(a), false, "A should have been evicted");
  assert.equal(hasReadState(b), true, "B is fresh and must remain");
});

test("resetSession clears the pre-flight flag", () => {
  const { ws } = mkWorkspace();
  markStateRead(ws);
  assert.equal(hasReadState(ws), true);
  resetSession(ws);
  assert.equal(hasReadState(ws), false);
});

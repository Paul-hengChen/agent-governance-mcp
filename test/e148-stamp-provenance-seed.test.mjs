// Coded by @qa-engineer
// Deterministic proof that seeding a test workspace can no longer trip the
// stamp-provenance gate at random (E148, docs/backlog.md row E148 / order row
// 0t6, T-E148-01): "A gate that exists to catch fabricated timestamps
// randomly fires on genuine ones, turning any seed-then-write test into a
// coin flip." gates/stamp-provenance.ts arms STAMP_PROVENANCE_SUSPECT
// whenever the CURRENT on-disk `last_updated` matches
// HAND_AUTHORED_STAMP_RE = /T\d{2}:\d{2}:00\.000Z$/ (seconds "00" AND
// milliseconds ".000"). That gate is CORRECT and unmodified here (the ticket's
// first hard constraint: do not weaken the gate; E148) — its premise ("overwhelmingly unlikely from the server
// write path") is true but not zero: ~1/60000 per accepted write. Any test
// across the suite that seeds a workspace via writeHandoffState() and then
// drives a gated tw_update_state write inherits that ~1/60000 chance of a
// spurious STAMP_PROVENANCE_SUSPECT rejection — measured live on the
// v3.112.0 release CI (run 35308236600): 2097/2100, green on re-run with no
// code change (the J1 test in test/e28-shrink-warning.test.mjs:232).
//
// A green re-run of that test proves nothing (it's green 59999/60000 runs with
// NO fix at all). This file instead forces the on-disk seed stamp to the EXACT suspect
// shape deterministically (test/e148-seed-stamp.mjs's SUSPECT_SEED_STAMP),
// removing the wall clock from the equation entirely, and demonstrates:
//   (a) the gate fires 100% of the time on a suspect seed, not ~1/60000 of
//       the time — the mechanism this whole ticket is about is real and
//       reproducible on demand (SEED-1);
//   (b) the seed-then-write path still SUCCEEDS once the write carries the
//       audited stamp-remediation acknowledgment the gate requires
//       (SEED-2) — the "succeeds" half of the acceptance bar, for a seed
//       that deliberately matches the suspect shape;
//   (c) test/e148-seed-stamp.mjs's forceSeedStamp() helper, applied with the
//       SAFE (non-suspect) stamp now used across the other 20+ seed-then-write
//       test files, makes an ordinary seed-then-write test succeed with ZERO
//       dependency on Date.now() at all — every run, not "overwhelmingly
//       likely" (SEED-3). This is the actual fix, proven directly rather
//       than by absence-of-flake-so-far.
//
// No specs/<feature>.md exists — docs/backlog.md row E148 IS the spec.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { isHandAuthoredStamp } from "../dist/gates/stamp-provenance.js";
import {
  SAFE_SEED_STAMP,
  SUSPECT_SEED_STAMP,
  forceSeedStamp,
} from "./e148-seed-stamp.mjs";

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

function mkWs(prefix = "e148-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seed(ws, opts = {}) {
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: opts.activeFeature ?? "e148-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "pm",
  });
}

async function runUpdate(ws, args) {
  return UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "e148-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: e148 probe write"],
    ...args,
  });
}

// ---------------------------------------------------------------------------
// Fixture sanity: the two literal stamps actually land where the ticket says
// they do against the live predicate (belt-and-braces — every assertion
// below is vacuous if this fails).
// ---------------------------------------------------------------------------

test("SEED-0 (sanity): SUSPECT_SEED_STAMP matches HAND_AUTHORED_STAMP_RE; SAFE_SEED_STAMP does not", () => {
  assert.equal(isHandAuthoredStamp(SUSPECT_SEED_STAMP), true, "fixture must match the gate's own predicate");
  assert.equal(isHandAuthoredStamp(SAFE_SEED_STAMP), false, "the safe fixture must never match");
});

// ---------------------------------------------------------------------------
// SEED-1: a deterministically-forced suspect seed reproduces
// STAMP_PROVENANCE_SUSPECT on 100% of runs, not ~1/60000 — proves the
// mechanism this ticket is about is real, on demand, without waiting for the
// wall clock to cooperate.
// ---------------------------------------------------------------------------

test("SEED-1: a seed stamp forced to the suspect shape deterministically rejects the next unremediated write with STAMP_PROVENANCE_SUSPECT", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e148-seed1-");
  await seed(ws);
  forceSeedStamp(ws, SUSPECT_SEED_STAMP);
  resetSession();
  markStateRead(ws);

  const result = await runUpdate(ws, {});
  assert.ok(result.isError, "a deterministically-suspect on-disk stamp must reject the next unremediated write");
  const text = result.content[0].text;
  assert.match(text, /STAMP_PROVENANCE_SUSPECT/);
  assert.equal(parseHandoff(ws).last_updated, SUSPECT_SEED_STAMP, "the rejected write must leave the suspect stamp untouched");
});

// ---------------------------------------------------------------------------
// SEED-2: the SAME deterministically-suspect seed, but the write carries the
// audited stamp-remediation note the gate requires — the seed-then-write
// path SUCCEEDS despite the suspect shape (the "still succeeds" half of the
// acceptance bar, for the gated case).
// ---------------------------------------------------------------------------

test("SEED-2: the same deterministically-suspect seed, remediated, succeeds and stamps a fresh non-suspect value", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e148-seed2-");
  await seed(ws);
  forceSeedStamp(ws, SUSPECT_SEED_STAMP);
  resetSession();
  markStateRead(ws);

  const result = await runUpdate(ws, {
    pending_notes: ["stamp-remediation: E148 deterministic proof fixture, not a real out-of-band edit", "pm: continuing"],
  });
  assert.ok(!result.isError, `an audited remediation write against a deterministically-suspect seed must succeed: ${result.content?.[0]?.text}`);
  const healed = parseHandoff(ws);
  assert.notEqual(healed.last_updated, SUSPECT_SEED_STAMP, "the accepted write must stamp a fresh now(), not preserve the forced suspect seed");
});

// ---------------------------------------------------------------------------
// SEED-3: this is the actual fix for the random gate trip (E148), demonstrated
// directly. forceSeedStamp applied with the SAFE (non-suspect) stamp —
// exactly what the other seed-then-write test files now do — makes the seed-then-write path
// succeed with ZERO dependency on Date.now(): not "vanishingly unlikely to
// flake", but structurally incapable of landing on the suspect shape, on
// every single run.
// ---------------------------------------------------------------------------

test("SEED-3: forceSeedStamp(ws, SAFE_SEED_STAMP) makes the seed-then-write path succeed deterministically, independent of Date.now()", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e148-seed3-");
  await seed(ws);
  forceSeedStamp(ws); // default = SAFE_SEED_STAMP
  resetSession();
  markStateRead(ws);

  assert.equal(parseHandoff(ws).last_updated, SAFE_SEED_STAMP, "sanity: the seed stamp is now under this test's control, not the wall clock's");

  const result = await runUpdate(ws, {});
  assert.ok(!result.isError, `a safe, non-suspect forced seed must never trip STAMP_PROVENANCE_SUSPECT: ${result.content?.[0]?.text}`);
});

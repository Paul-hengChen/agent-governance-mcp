// Coded by @qa-engineer
// Deterministic proof that seeding a test workspace cannot trip the stamp-provenance gate at random (E148, docs/backlog.md row E148).
// gates/stamp-provenance.ts arms STAMP_PROVENANCE_SUSPECT when the on-disk `last_updated` matches HAND_AUTHORED_STAMP_RE, which a wall-clock seed hits ~1/60000 of the time;
// a green re-run proves nothing, so this file forces the exact suspect shape. SEED-1: the gate fires every time on a suspect seed. SEED-2: the write still succeeds with
// the audited stamp-remediation note. SEED-3: forceSeedStamp (test/e148-seed-stamp.mjs) with the SAFE stamp makes seed-then-write succeed with no Date.now() dependency. The gate is unmodified; no spec file, the backlog row is the spec.
// Rationale: specs/e260f-comment-rationale.md (test/e148-stamp-provenance-seed.test.mjs).

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
// SEED-3: the actual fix for the random gate trip (E148). forceSeedStamp with the SAFE stamp makes seed-then-write succeed with ZERO dependency
// on Date.now(): structurally incapable of landing on the suspect shape, on every run.
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

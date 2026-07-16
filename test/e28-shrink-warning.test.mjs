// Coded by @qa-engineer
// Tests for backlog E28 (docs/backlog.md row E28) / T-E28-01: the
// wholesale-replace shrink warning on tw_update_state's dispatch_pins /
// external_refs fields. tools/handoff-orchestrator.ts:1264-1315 is the unit
// under test — both fields REPLACE (never merge) on write, so a writer that
// forgets read-before-write silently drops entries; this feature appends an
// advisory `warnings` array to the success envelope naming the dropped
// entries when THIS write shrinks the on-disk prior set (same-feature writes
// only). Warn-only: never rejects, no new arg, no schema bump.
//
// The backlog row IS the spec for this ticket — no specs/<feature>.md exists.
// Cross-checked against code-reviewer's APPROVED review_reports/review_T-E25-01.md
// (batched review covering T-E28-01) §Correctness.
//
// Spec-to-test map:
//   shrink write warns, naming dropped entries (dispatch_pins)   -> W1
//   shrink write warns, naming dropped entries (external_refs)   -> W2
//   omitting the field on write is silent (server carry-forward) -> S1, S2
//   a feature-change write is silent even though the set shrinks -> F1, F2
//   envelope stays valid, additive JSON (no keys dropped/altered)-> J1, J2
//   reviewer probe 1: same-cardinality SWAP now WARNS naming the
//     dropped entry (E33 entry-identity diff, e32-e33-gate-hardening) -> P1a, P1b
//     (re-pinned post-E33: the old strict-cardinality `nextSize <
//      prevLength` compare that let equal-count swaps drop entries
//      silently is replaced by an entry-identity diff — dispatch_pins by
//      key set, external_refs by ref string — so a same-count swap now
//      warns too. See tools/handoff-orchestrator.ts:1297-1342 and
//      review_reports/review_T-E32-01.md "T-E33-01 — CORRECT" section.)
//   reviewer probe 2: no strict-envelope consumer breaks         -> J1, J2
//     (additive key only; grep confirms no test/*.mjs asserts an exact key
//      set on the tw_update_state response envelope)

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-e28-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedAndRead(opts) {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: opts.activeFeature ?? "e28-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "pm",
    ...opts.seed,
  });
  resetSession();
  markStateRead(ws);
  return ws;
}

async function runUpdate(ws, args) {
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "e28-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: e28 probe write"],
    ...args,
  });
  return result;
}

// ============================================================================
// W1/W2: shrink write warns, naming the dropped entries
// ============================================================================

test("W1: a dispatch_pins write that drops entries vs on-disk prior state warns, naming the dropped role(s)", async () => {
  const ws = await seedAndRead({
    seed: { dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" } },
  });
  const result = await runUpdate(ws, {
    dispatch_pins: { "sr-engineer": "fable" }, // dropped release-engineer
  });
  assert.ok(!result.isError, `write must still succeed (warn-only); got: ${result.content?.[0]?.text}`);
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.success, true, "shrink write must still be a successful write");
  assert.ok(Array.isArray(envelope.warnings), "a shrink write must carry a warnings array");
  assert.equal(envelope.warnings.length, 1);
  assert.match(envelope.warnings[0], /dispatch_pins/, "warning must name the field");
  assert.match(envelope.warnings[0], /release-engineer/, "warning must name the DROPPED entry");
  assert.doesNotMatch(envelope.warnings[0], /sr-engineer/, "warning must not name the entry that was KEPT");
});

test("W2: an external_refs write that drops entries vs on-disk prior state warns, naming the dropped ref(s)", async () => {
  const ws = await seedAndRead({
    seed: {
      externalRefs: [
        { ref: "JIRA-1", state: "indexed" },
        { ref: "JIRA-2", state: "unresolved" },
      ],
    },
  });
  const result = await runUpdate(ws, {
    external_refs: [{ ref: "JIRA-1", state: "indexed" }], // dropped JIRA-2
  });
  assert.ok(!result.isError, `write must still succeed (warn-only); got: ${result.content?.[0]?.text}`);
  const envelope = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(envelope.warnings), "a shrink write must carry a warnings array");
  assert.equal(envelope.warnings.length, 1);
  assert.match(envelope.warnings[0], /external_refs/, "warning must name the field");
  assert.match(envelope.warnings[0], /JIRA-2/, "warning must name the DROPPED ref");
  assert.doesNotMatch(envelope.warnings[0], /JIRA-1(?!.*JIRA-2)/, "warning listing should not misname the kept ref as dropped");
});

test("W1b: a single write that shrinks BOTH fields at once produces two warnings, one per field", async () => {
  const ws = await seedAndRead({
    seed: {
      dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" },
      externalRefs: [
        { ref: "JIRA-1", state: "indexed" },
        { ref: "JIRA-2", state: "unresolved" },
      ],
    },
  });
  const result = await runUpdate(ws, {
    dispatch_pins: { "sr-engineer": "fable" },
    external_refs: [{ ref: "JIRA-1", state: "indexed" }],
  });
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.warnings.length, 2, "both shrinking fields must each contribute one warning");
});

// ============================================================================
// S1/S2: omitting the field on write is silent (server carry-forward, not a
// shrink — the field simply isn't part of THIS write)
// ============================================================================

test("S1: omitting dispatch_pins entirely on a same-feature write is silent (carry-forward, not a shrink)", async () => {
  const ws = await seedAndRead({
    seed: { dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" } },
  });
  const result = await runUpdate(ws, {}); // dispatch_pins omitted
  assert.ok(!result.isError);
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.warnings, undefined, "omitting the field must never synthesize a warning");
});

test("S2: omitting external_refs entirely on a same-feature write is silent (carry-forward, not a shrink)", async () => {
  const ws = await seedAndRead({
    seed: { externalRefs: [{ ref: "JIRA-1", state: "indexed" }, { ref: "JIRA-2", state: "unresolved" }] },
  });
  const result = await runUpdate(ws, {}); // external_refs omitted
  assert.ok(!result.isError);
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.warnings, undefined, "omitting the field must never synthesize a warning");
});

// ============================================================================
// F1/F2: a feature-change write is silent even though the set shrinks — a
// feature change legitimately drops both feature-scoped fields (existing
// AC-3/AC-4 semantics from c14-dispatch-pins), so E28 must not warn here.
// ============================================================================

test("F1: switching active_feature while supplying a SMALLER dispatch_pins map is silent (feature-scoped drop is legitimate)", async () => {
  const ws = await seedAndRead({
    activeFeature: "e28-feat-a",
    seed: { dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" } },
  });
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "e28-feat-b", // different feature
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    // FEATURE_LEASE_HELD guards the per-workspace mutual-exclusion slot — a
    // second feature can't take the slot while e28-feat-a's lease is live.
    // This test is about E28's shrink-warning polarity on a feature change,
    // not the lease gate itself, so bypass it via the documented human
    // lease-override attestation (pending_notes[0] must match /^lease-override:/).
    lease_override: true,
    pending_notes: ["lease-override: e28 F1 probe — feature change to exercise the shrink-warning feature-scoped bypass"],
    dispatch_pins: { pm: "opus" }, // 1 entry, fewer than the prior feature's 2
  });
  assert.ok(!result.isError, `feature-change write must still succeed; got: ${result.content?.[0]?.text}`);
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.warnings, undefined, "a feature change must never trigger the shrink warning, regardless of cardinality");
});

test("F2: switching active_feature while supplying a SMALLER external_refs ledger is silent", async () => {
  const ws = await seedAndRead({
    activeFeature: "e28-feat-c",
    seed: { externalRefs: [{ ref: "JIRA-1", state: "indexed" }, { ref: "JIRA-2", state: "unresolved" }] },
  });
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "e28-feat-d",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    lease_override: true,
    pending_notes: ["lease-override: e28 F2 probe — feature change to exercise the shrink-warning feature-scoped bypass"],
    external_refs: [{ ref: "JIRA-9", state: "unresolved" }],
  });
  assert.ok(!result.isError);
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.warnings, undefined, "a feature change must never trigger the shrink warning, regardless of cardinality");
});

// ============================================================================
// J1/J2: the envelope stays valid, additive JSON — reviewer probe 2 (no
// strict-envelope consumer breaks). Every original success-envelope key
// (success/path/updated_at) survives byte-shape untouched; `warnings` is
// purely additive and absent on non-shrink writes. A grep across test/*.mjs
// (run manually during this QA round) turned up zero tests asserting an
// exact/strict key set on the tw_update_state response envelope — the
// agc-adapters "no stale warnings" pin (test/agc-adapters.test.mjs) is about
// a DIFFERENT feature (agc check / AGENTS.md adapter staleness), not this
// envelope, so it cannot be broken by this additive key (review_T-E25-01.md
// §Correctness already made this same cross-check; re-verified here as a
// standing regression guard).
// ============================================================================

test("J1: a shrink-write envelope keeps success/path/updated_at intact AND additively gains warnings", async () => {
  const ws = await seedAndRead({
    seed: { dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" } },
  });
  const result = await runUpdate(ws, { dispatch_pins: { "sr-engineer": "fable" } });
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.success, true);
  assert.equal(typeof envelope.path, "string");
  assert.ok(typeof envelope.updated_at === "string" && !Number.isNaN(Date.parse(envelope.updated_at)));
  assert.ok(Array.isArray(envelope.warnings));
  assert.deepEqual(
    Object.keys(envelope).sort(),
    ["path", "success", "updated_at", "warnings"].sort(),
    "shrink envelope must be EXACTLY the base 3 keys plus the additive warnings key — no keys lost, none silently renamed",
  );
});

test("J2: a non-shrink write's envelope carries NO warnings key at all (byte-identical to pre-E28 shape)", async () => {
  const ws = await seedAndRead({
    seed: { dispatchPins: { "sr-engineer": "fable" } },
  });
  const result = await runUpdate(ws, { dispatch_pins: { "sr-engineer": "fable", "release-engineer": "opus" } }); // grows, not shrinks
  const envelope = JSON.parse(result.content[0].text);
  assert.deepEqual(
    Object.keys(envelope).sort(),
    ["path", "success", "updated_at"],
    "a non-shrinking write must carry exactly the pre-E28 3-key envelope — no warnings key materializes",
  );
});

// ============================================================================
// P1a/P1b: reviewer probe 1 — same-cardinality SWAP. RE-PINNED (E33,
// e32-e33-gate-hardening): shrink detection is now an ENTRY-IDENTITY diff
// (dispatch_pins by key set, external_refs by ref string), not cardinality,
// so a same-count entry swap that drops a prior entry WARNS, naming the
// dropped entry — the E28-as-shipped `nextSize < prevLength` compare that
// let this through silently is fixed. code-reviewer verified this live
// (review_reports/review_T-E32-01.md "T-E33-01 — CORRECT, no findings" /
// round-2 "T-E33-01 regression ... CLEAN"). A value-only pin change (key
// survives) or an external_refs state advance (ref survives) is still NOT a
// drop and stays silent — see W1/W2/S1/S2/F1/F2 above, unchanged.
// ============================================================================

test("P1a (probe 1, post-E33): a same-count dispatch_pins SWAP drops an entry and WARNS, naming it", async () => {
  const ws = await seedAndRead({
    seed: { dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" } },
  });
  const result = await runUpdate(ws, {
    dispatch_pins: { "sr-engineer": "fable", "qa-engineer": "sonnet" }, // release-engineer swapped for qa-engineer, same count (2)
  });
  assert.ok(!result.isError);
  const envelope = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1, "post-E33: an equal-cardinality swap must warn (entry-identity diff, not cardinality)");
  assert.match(envelope.warnings[0], /dispatch_pins REPLACES wholesale/);
  assert.match(envelope.warnings[0], /kept 1 of 2/);
  assert.match(envelope.warnings[0], /dropped: release-engineer/);
});

test("P1b (probe 1, post-E33): a same-count external_refs SWAP drops an entry and WARNS, naming it", async () => {
  const ws = await seedAndRead({
    seed: { externalRefs: [{ ref: "JIRA-1", state: "indexed" }, { ref: "JIRA-2", state: "unresolved" }] },
  });
  const result = await runUpdate(ws, {
    external_refs: [{ ref: "JIRA-1", state: "indexed" }, { ref: "JIRA-3", state: "fetched" }], // JIRA-2 swapped for JIRA-3, same count (2)
  });
  assert.ok(!result.isError);
  const envelope = JSON.parse(result.content[0].text);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1, "post-E33: an equal-cardinality swap must warn (entry-identity diff, not cardinality)");
  assert.match(envelope.warnings[0], /external_refs REPLACES wholesale/);
  assert.match(envelope.warnings[0], /kept 1 of 2/);
  assert.match(envelope.warnings[0], /dropped: JIRA-2/);
});

// Coded by @qa-engineer
// Tests for spec: specs/c14-dispatch-pins.md (T-C14-09, T-C14-10).
//
// Spec-to-Test map:
//   AC-1 (schema bump v7→v8, stamp-only migration)   -> M1, M2, M3
//   AC-2 (closed keys / open values, defensive parse)  -> P1, P2, P3, P4, P5, Z1-Z5
//   AC-3 (REPLACE wholesale, incl. {} clears)          -> W1, W2
//   AC-4 (feature-scoped carry-forward, no PM re-arm)  -> W3, W4, W5
//   AC-5 (file-mode only, SQLite ignores)              -> S1
//   AC-8 (legacy pending_notes line stays inert)       -> M4
//
// WHY: dispatch_pins is a DURABLE, feature-scoped directive (unlike the
// transient c9 fields next_role/resume_of/review_verdict) that follows the
// exact external_refs REPLACE + feature-scoped-preserve algorithm (AC-3/AC-4
// Decision Record). These tests pin both polarities so a future edit can't
// accidentally collapse dispatch_pins onto the cut_approved re-arm pattern or
// the next_role transient-drop pattern — the two sibling algorithms this
// ticket explicitly rejected by analogy.

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
import { resetSession, markStateRead } from "../dist/guards/session.js";
import {
  _clearRegistryForTests,
  runMigrations,
  registerMigration,
  CURRENT_VERSIONS,
} from "../dist/schema/versions.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency. Skip S1
// gracefully (same guard as test/visual-round-sqlite.test.mjs) if absent.
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — S1 SQLite-ignore test skipped");
}

// ---- helpers ---------------------------------------------------------------

function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-dpin-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRaw(ws, body) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body, "utf-8");
}

function readRaw(ws) {
  return fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
}

// ============================================================================
// AC-1: schema bump v7→v8, stamp-only migration
// ============================================================================

test("M1: v7 handoff (no dispatch_pins) migrates to v8 on read — field stays undefined, other fields preserved", () => {
  // WHY: the no-seed contract. A legacy v7 file (pre-dates the field) must
  // climb to v8 WITHOUT gaining a synthetic dispatch_pins value — absence
  // stays absence ("no pins recorded"). Sibling v7 fields and round counters
  // must survive untouched (lossless, mirrors the v5→v6/v6→v7 precedent).
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 7
active_feature: "legacy-v7-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 1
review_round: 0
visual_round: 0
next_role: "sr-engineer"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );
  // parseHandoff is intentionally read-only on disk (avoids recursion with
  // writeHandoffState's own preserve-read) — the in-memory migrated shape is
  // what we assert on-disk healing separately via readHandoffState below.
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_pins, undefined, "v7→v8 must NOT seed dispatch_pins (absence is meaningful, AC-1)");
  // Pre-existing fields preserved.
  assert.equal(state.active_feature, "legacy-v7-feat");
  assert.equal(state.last_agent, "pm");
  assert.equal(state.qa_round, 1, "qa_round preserved across v7→v8");
  assert.equal(state.next_role, "sr-engineer", "sibling v7 field preserved across v7→v8");
});

test("M1b: readHandoffState's fire-and-forget write-back heals the v7 file to v10 on disk", async () => {
  // d5-server-side-stale-dispatch-detection (qa-owned re-baseline):
  // CURRENT_VERSIONS.handoff is now 10 (v9→v10 added dispatched_at, stamp-only,
  // seeds nothing). A v7 file heals all the way to v10 in one fire-and-forget
  // write-back, seeding hop_count: 0 (DR-3, from the earlier v8→v9 step) along
  // the way; the new v9→v10 step adds no field default of its own.
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 7
active_feature: "legacy-v7-heal"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  readHandoffState(ws);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const healed = readRaw(ws);
  assert.match(healed, /schema_version:\s*10/, "fire-and-forget heal lands the file at CURRENT (v10)");
  assert.match(healed, /hop_count:\s*0/, "the v8→v9 step's seeded hop_count: 0 survives the heal write");
});

test("M2: future v11 handoff refuses-loud against a v10 server (no silent downgrade)", () => {
  // WHY: forward-compat safety, mirroring the AC-10(g) c9-protocol-fields
  // precedent (v7 file against a v6 server; here v11 against v10 — re-baselined
  // by d5-server-side-stale-dispatch-detection, qa-owned, since v10 is now
  // CURRENT and no longer "the future"). A handoff written by a newer server
  // must never be silently parsed.
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 11
active_feature: "from-the-future"
status: "In_Progress"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  assert.throws(
    () => readHandoffState(ws),
    /handoff on-disk version 11 > server max 10/,
    "v11 file must refuse-loud against a v10 server",
  );
  assert.throws(
    () => parseHandoff(ws),
    /on-disk version 11 > server max 10/,
  );
});

test("M3: registry-level v7→v8→v9→v10 steps are pure, stamp-only/seed-only, and seed nothing extra (isolated from the full chain)", () => {
  // WHY: pins the migration steps themselves (schema/migrations-handoff.ts),
  // not just their effect through parseHandoff — a direct unit test of the
  // runner registration, matching the M1/M2 cut-approval-gate.test.mjs
  // convention. d5-server-side-stale-dispatch-detection (qa-owned re-baseline):
  // CURRENT is now 10, so the isolated chain re-registered here must extend one
  // step further (v9→v10, stamp-only — dispatched_at seeds nothing) or every
  // read in this file hits "missing migration step handoff v9→v10" (the
  // registry is a shared module-level singleton across tests in this
  // file/process).
  _clearRegistryForTests();
  registerMigration({ kind: "handoff", from: 0, to: 1, up: (i) => ({ ...i, schema_version: 1 }) });
  registerMigration({ kind: "handoff", from: 1, to: 2, up: (i) => ({ ...i, schema_version: 2 }) });
  registerMigration({ kind: "handoff", from: 2, to: 3, up: (i) => ({ ...i, schema_version: 3 }) });
  registerMigration({ kind: "handoff", from: 3, to: 4, up: (i) => ({ ...i, schema_version: 4 }) });
  registerMigration({ kind: "handoff", from: 4, to: 5, up: (i) => ({ ...i, schema_version: 5 }) });
  registerMigration({ kind: "handoff", from: 5, to: 6, up: (i) => ({ ...i, schema_version: 6 }) });
  registerMigration({ kind: "handoff", from: 6, to: 7, up: (i) => ({ ...i, schema_version: 7 }) });
  registerMigration({ kind: "handoff", from: 7, to: 8, up: (i) => ({ ...i, schema_version: 8 }) });
  registerMigration({ kind: "handoff", from: 8, to: 9, up: (i) => ({ ...i, schema_version: 9, hop_count: 0 }) });
  registerMigration({ kind: "handoff", from: 9, to: 10, up: (i) => ({ ...i, schema_version: 10 }) });

  const v7Payload = {
    schema_version: 7,
    active_feature: "step-isolated",
    status: "In_Progress",
    next_role: "qa-engineer",
  };
  const result = runMigrations("handoff", v7Payload);
  assert.deepEqual(result.applied, [8, 9, 10], "the v7→v8, v8→v9, AND v9→v10 steps all run when on-disk version is three behind CURRENT");
  assert.equal(result.payload.schema_version, 10, "schema_version bumped to CURRENT (10)");
  assert.equal(result.payload.dispatch_pins, undefined, "v7→v8 seeds no dispatch_pins default (AC-1)");
  assert.equal(result.payload.hop_count, 0, "v8→v9 seeds hop_count: 0 (DR-3)");
  assert.equal(result.payload.dispatched_at, undefined, "v9→v10 seeds no dispatched_at default (d5 DR-7 — absence-is-signal, not hop_count's seed-0)");
  assert.equal(result.payload.next_role, "qa-engineer", "sibling v7 field survives all three stamp-only/seed-only steps verbatim");

  // Re-running against the already-current payload is a no-op.
  const reread = runMigrations("handoff", result.payload);
  assert.deepEqual(reread.applied, [], "second pass against the now-current payload applies nothing");
});

// ============================================================================
// AC-8: legacy pending_notes `dispatch_pins: <role>=<model>` line stays inert
// ============================================================================

test("M4/AC-8: v7 handoff with a legacy 'dispatch_pins: sr-engineer=fable' pending_notes line migrates to v8 with the line byte-verbatim and the new field absent", () => {
  // WHY: DR on AC-8 — the pre-c14 C8-era convention wrote the pin as a plain
  // pending_notes string. The v7→v8 migration must NOT parse/extract that
  // line into the new structured field (no semantic promotion on migrate);
  // it becomes inert prose until a writer explicitly sets the field.
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 7
active_feature: "legacy-pin-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "coordinator"
qa_round: 0
review_round: 0
visual_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- dispatch_pins: sr-engineer=fable
- coordinator: dispatching sr-engineer now
`,
  );
  // parseHandoff is read-only on disk (see M1b for the on-disk heal check);
  // assert on the in-memory migrated shape here.
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_pins, undefined, "legacy pending_notes line must NOT be extracted into the new field (AC-8)");
  assert.deepEqual(
    state.pending_notes,
    ["dispatch_pins: sr-engineer=fable", "coordinator: dispatching sr-engineer now"],
    "legacy pending_notes lines survive byte-verbatim, inert prose",
  );
});

// ============================================================================
// AC-2: defensive read-time parser — unknown keys / malformed values dropped
// ============================================================================

test("P1: parseHandoff drops an unknown dispatch_pins role key from hand-edited YAML, keeps well-formed siblings", () => {
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 8
active_feature: "malformed-pins"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
dispatch_pins:
  sr-engineer: "fable"
  reviewer: "opus"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  const state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { "sr-engineer": "fable" },
    "unknown role key 'reviewer' (not one of the 8 AgentName values) must be dropped; the well-formed entry survives");
});

test("P2: parseHandoff drops an empty-string dispatch_pins value", () => {
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 8
active_feature: "malformed-pins-2"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
dispatch_pins:
  pm: ""
  architect: "opus"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  const state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { architect: "opus" },
    "empty-string value must be dropped (min-length defensive mirror of the zod bound)");
});

test("P3: parseHandoff drops an oversize (>100 char) dispatch_pins value", () => {
  const ws = mkWs();
  resetSession();
  const longValue = "x".repeat(101);
  writeRaw(
    ws,
    `---
schema_version: 8
active_feature: "malformed-pins-3"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
dispatch_pins:
  qa-engineer: "${longValue}"
  code-reviewer: "sonnet"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  const state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { "code-reviewer": "sonnet" },
    "a value over DISPATCH_PIN_VALUE_MAX (100 chars) must be dropped, mirroring the zod ≤100 bound");
});

test("P4: parseHandoff collapses dispatch_pins to undefined when raw is an array or a scalar (non-object shapes)", () => {
  const wsArray = mkWs();
  resetSession();
  writeRaw(
    wsArray,
    `---
schema_version: 8
active_feature: "array-shape"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
dispatch_pins:
  - "sr-engineer"
  - "fable"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  assert.equal(parseHandoff(wsArray).dispatch_pins, undefined, "an array-shaped dispatch_pins must collapse to undefined");

  const wsScalar = mkWs();
  resetSession();
  writeRaw(
    wsScalar,
    `---
schema_version: 8
active_feature: "scalar-shape"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
dispatch_pins: "sr-engineer=fable"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  assert.equal(parseHandoff(wsScalar).dispatch_pins, undefined, "a scalar-string dispatch_pins (the old convention's exact shape) must collapse to undefined, not be parsed");
});

test("P5: parseHandoff collapses an all-malformed dispatch_pins map to undefined (never a phantom empty object)", () => {
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 8
active_feature: "all-malformed"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
dispatch_pins:
  reviewer: "opus"
  pm: ""
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_pins, undefined,
    "when every entry is malformed the result must collapse to undefined (single 'no pins' sentinel), never {}");
});

// ============================================================================
// AC-3: REPLACE wholesale (not merged), including {} clears
// ============================================================================

test("W1: writeHandoffState emits dispatch_pins as a YAML map and parses it back verbatim", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "pin-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: { "sr-engineer": "fable", pm: "opus" },
  });
  const raw = readRaw(ws);
  assert.match(raw, /dispatch_pins:/, "dispatch_pins key must be emitted");
  assert.match(raw, /sr-engineer:\s*["']?fable["']?/, "sr-engineer pin must round-trip verbatim");
  assert.match(raw, /pm:\s*["']?opus["']?/, "pm pin must round-trip verbatim");

  resetSession();
  const state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { "sr-engineer": "fable", pm: "opus" },
    "dispatch_pins map must round-trip losslessly");
});

test("W2: passing dispatch_pins REPLACES the map wholesale, including clearing a prior map with {}", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "replace-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: { "sr-engineer": "fable", architect: "opus" },
  });
  // A write dropping architect and adding a new role entirely — REPLACE, not merge.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "replace-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: { "qa-engineer": "sonnet" },
  });
  resetSession();
  let state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { "qa-engineer": "sonnet" },
    "write must REPLACE the whole map, not merge — sr-engineer/architect pins must be gone");

  // Clearing with {} must also work (REPLACE semantics apply to the empty case too).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "replace-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: {},
  });
  const rawAfterClear = readRaw(ws);
  assert.doesNotMatch(rawAfterClear, /dispatch_pins:/, "an empty {} map must NOT be serialized into YAML (AC-4 empty === absence)");
  resetSession();
  state = parseHandoff(ws);
  assert.equal(state.dispatch_pins, undefined, "REPLACE with {} must clear the map entirely");
});

// ============================================================================
// AC-4: feature-scoped carry-forward when omitted; NO PM-re-entry re-arm
// ============================================================================

test("W3: a write omitting dispatch_pins on the SAME active_feature carries the map forward unchanged", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "carry-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: { "sr-engineer": "fable" },
  });
  // Downstream role write omits dispatchPins entirely.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "carry-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["sr-engineer: implementing"],
    lastAgent: "sr-engineer",
    // dispatchPins intentionally omitted.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { "sr-engineer": "fable" },
    "an omitting write on the same feature must preserve the pin map verbatim");
});

test("W4: active_feature change drops dispatch_pins (feature-scoped reset)", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-a",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: { "sr-engineer": "fable" },
  });
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-b",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_pins, undefined, "a stale pin from feature-a must never leak into feature-b");
});

test("W5: PM re-entry WITHOUT dispatch_pins preserves the map — NO re-arm (contrast with cut_approved)", async () => {
  // WHY (the load-bearing contrast, AC-4 Decision Record): cut_approved RE-ARMS
  // to undefined on every PM In_Progress re-entry that omits it. dispatch_pins
  // must NOT follow that pattern — a PM bouncing a QA FAIL back to In_Progress
  // must not silently un-pin a role mid-feature. It follows external_refs'
  // polarity instead (feature-scoped preserve, no PM-re-entry re-arm).
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "resume-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    dispatchPins: { "sr-engineer": "fable" },
  });
  // PM re-enters (e.g. after a QA-FAIL bounce) WITHOUT passing dispatchPins.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "resume-feat",
    status: "In_Progress",
    lastAgent: "pm",
    completedTasks: [],
    pendingNotes: ["pm: re-evaluating after QA FAIL"],
    // dispatchPins intentionally omitted — must NOT re-arm/drop.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.deepEqual(state.dispatch_pins, { "sr-engineer": "fable" },
    "PM re-entry omitting dispatch_pins must PRESERVE the existing map (no re-arm, unlike cut_approved)");
});

// ============================================================================
// AC-5: file-mode only — SqliteHandoffStorage.writeState ignores the field
// ============================================================================

function mkSqliteWs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dpin-sql-"));
  return { dir, dbPath: path.join(dir, "agc.db") };
}

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

sqliteDescribe("S1: SQLite storage ignores dispatch_pins", () => {
  test("S1: SqliteHandoffStorage.writeState(dispatchPins=...) does not persist or surface the field (AC-5, no DDL)", async () => {
    const { dir, dbPath } = mkSqliteWs();
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "sqlite-pin-feat",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: [],
        lastAgent: "coordinator",
        dispatchPins: { "sr-engineer": "fable" },
      });
      const state = storage.parse(dir);
      assert.ok(state, "state row must exist");
      assert.equal(state.dispatch_pins, undefined, "dispatch_pins must never surface from SQLite-mode storage (file-mode only, AC-5)");
      assert.equal(state.active_feature, "sqlite-pin-feat", "other fields persist normally");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ============================================================================
// T-C14-10: zod boundary rejection (tools/registry.ts UpdateStateArgs)
// ============================================================================

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

test("Z1: tw_update_state rejects an unknown dispatch_pins role key at the zod boundary", async () => {
  assert.ok(UPDATE_STATE_ENTRY, "tw_update_state must be registered in TOOL_REGISTRY");
  // NOTE: ToolRegistryEntry.run throws SYNCHRONOUSLY on a zod parse failure
  // (spec.zodSchema.parse(rawArgs) runs before spec.handler). Wrap in an
  // async arrow so assert.rejects can convert the throw into an awaitable
  // rejection (same idiom as the T-C9-10 next_role/resume_of tests).
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_pins: { reviewer: "fable" }, // not one of the 8 AgentName keys
      });
    },
    /ZodError|unrecognized_keys|Unrecognized key/i,
    "an unknown dispatch_pins role key must be rejected by zod's .strict() before any gate/handler logic runs",
  );
});

test("Z2: tw_update_state rejects an empty-string dispatch_pins value at the zod boundary", async () => {
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_pins: { "sr-engineer": "" }, // min(1) violated
      });
    },
    /ZodError|too_small/i,
    "an empty-string model-tier value must be rejected by zod (min length 1)",
  );
});

test("Z3: tw_update_state rejects a >100-char dispatch_pins value at the zod boundary", async () => {
  const oversized = "x".repeat(101);
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_pins: { pm: oversized }, // max(100) violated
      });
    },
    /ZodError|too_big/i,
    "a value over 100 chars must be rejected by zod (max length 100)",
  );
});

test("Z4: tw_update_state rejects a non-object (array) dispatch_pins shape at the zod boundary", async () => {
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_pins: ["sr-engineer", "fable"], // array, not object
      });
    },
    /ZodError|invalid_type/i,
    "an array-shaped dispatch_pins must be rejected by zod (expected object)",
  );
});

test("Z5: tw_update_state rejects a non-object (string) dispatch_pins shape — the old convention's exact shape", async () => {
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_pins: "sr-engineer=fable", // scalar string, the legacy C8-era shape
      });
    },
    /ZodError|invalid_type/i,
    "a scalar-string dispatch_pins (the pre-c14 pending_notes convention's exact shape) must be rejected by zod",
  );
});

test("Z6: tw_update_state ACCEPTS a valid dispatch_pins map for all 8 AgentName keys (positive control)", async () => {
  // Positive control for Z1-Z5 above — proves the schema isn't accidentally
  // rejecting everything. Exercises a real self-loop write
  // (pm:In_Progress -> pm:In_Progress) so no build-entry gate interferes.
  const { setActiveStorage, FileHandoffStorage } = await import("../dist/tools/storage.js");
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "z6-ok",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "pm",
  });
  resetSession();
  markStateRead(ws);
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "z6-ok",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: pinning every role"],
    dispatch_pins: {
      pm: "opus",
      researcher: "sonnet",
      "design-auditor": "sonnet",
      architect: "opus",
      "sr-engineer": "fable",
      "code-reviewer": "opus",
      "qa-engineer": "sonnet",
      "release-engineer": "haiku",
    },
  });
  assert.ok(!result.isError, `a valid 8-key dispatch_pins map must not be rejected; got: ${result.content?.[0]?.text}`);
});

test("Z7: tw_update_state ACCEPTS an empty dispatch_pins object ({} clears, per AC-3/AC-4)", async () => {
  const { setActiveStorage, FileHandoffStorage } = await import("../dist/tools/storage.js");
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "z7-ok",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "pm",
    dispatchPins: { pm: "opus" },
  });
  resetSession();
  markStateRead(ws);
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "z7-ok",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: clearing all pins"],
    dispatch_pins: {},
  });
  assert.ok(!result.isError, `an empty {} dispatch_pins must not be rejected by zod; got: ${result.content?.[0]?.text}`);
});

// Sanity: CURRENT_VERSIONS.handoff really is 10 in this build (guards every
// test above against silently testing the wrong target version).
// d5-server-side-stale-dispatch-detection (qa-owned re-baseline): bumped
// 9 -> 10 (dispatched_at, stamp-only, seeds nothing).
test("sanity: CURRENT_VERSIONS.handoff is 10 (d5-server-side-stale-dispatch-detection)", () => {
  assert.equal(CURRENT_VERSIONS.handoff, 10);
});

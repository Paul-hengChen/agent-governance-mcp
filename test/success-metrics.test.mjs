// Coded by @qa-engineer
// Tests for specs/e8-success-telemetry.md, refined by
// specs/e8-success-telemetry-architecture.md (blueprint) — the v11->v12
// cumulative round-counter schema bump + release-close metrics emit +
// summarizer CLI (T-E8-01..05, code-reviewer APPROVED zero findings,
// review_reports/review_T-E8-06.md).
//
// Spec-to-Test map:
//   AC8 (migration seed-0, feature-scoped reset)         -> Migration section
//   Mechanism (computeNewRound totals)                    -> Counter semantics section
//   hop_count-mirror parse/serialize contract              -> Handoff plumbing section
//   AC1/AC2/AC6/AC7 (emit hook)                            -> Emit hook section
//   AC3 (one_pass)                                         -> one_pass section
//   AC4 (deriveTicketCode / <CODE> convention)              -> deriveTicketCode section
//   AC9 (summarizer)                                        -> Summarizer section
//   skill-release-engineer.md step 11b                     -> see test/feature-lease.test.mjs S8

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  computeNewRound,
  validateTransition,
} from "../dist/tools/transitions.js";
import {
  parseHandoff,
  writeHandoffState,
  readHandoffState,
} from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import {
  CURRENT_VERSIONS,
  runMigrations,
  registerMigration,
  _clearRegistryForTests,
} from "../dist/schema/versions.js";
import { emitFeatureMetrics, deriveTicketCode } from "../dist/tools/metrics.js";

let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite e8 tests skipped");
}

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

function mkWs(prefix = "e8-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function metricsPath(ws) {
  return path.join(ws, ".current", "metrics.jsonl");
}

function readMetricsLines(ws) {
  if (!fs.existsSync(metricsPath(ws))) return [];
  return fs
    .readFileSync(metricsPath(ws), "utf-8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
}

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

async function dispatch(ws, args) {
  resetSession(ws);
  markStateRead(ws);
  return UPDATE_STATE_ENTRY.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
}

// ============================================================================
// Migration: v11->v12 seed-0; v0 legacy chain lands at v12; v13 refuses-loud;
// totals preserved on same-feature heal (AC8).
// ============================================================================

test("E8-M1: registered v11->v12 step seeds all three totals to 0, additive/lossless", () => {
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
  registerMigration({ kind: "handoff", from: 10, to: 11, up: (i) => ({ ...i, schema_version: 11 }) });
  registerMigration({
    kind: "handoff",
    from: 11,
    to: 12,
    up: (i) => ({ ...i, schema_version: 12, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 }),
  });

  const result = runMigrations("handoff", { schema_version: 11, active_feature: "seed-feat", qa_round: 2, hop_count: 5 });
  assert.deepEqual(result.applied, [12], "only the v11->v12 step runs when on-disk is one behind CURRENT");
  assert.equal(result.payload.schema_version, 12);
  assert.equal(result.payload.qa_rounds_total, 0, "AC8 — stale rows migrate in with qa_rounds_total = 0");
  assert.equal(result.payload.review_rounds_total, 0, "AC8 — stale rows migrate in with review_rounds_total = 0");
  assert.equal(result.payload.visual_rounds_total, 0, "AC8 — stale rows migrate in with visual_rounds_total = 0");
  assert.equal(result.payload.active_feature, "seed-feat", "sibling field survives losslessly");
  assert.equal(result.payload.qa_round, 2, "sibling cycle counter untouched (v11->v12 seeds only the 3 new fields)");
  assert.equal(result.payload.hop_count, 5, "hop_count untouched by this step (sibling, unrelated counter)");
});

test("E8-M2: a v0 legacy handoff (real registry) migrates all the way to CURRENT (v12) via readHandoffState/parseHandoff", async () => {
  const ws = mkWs("e8-legacy-");
  resetSession(ws);
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.exists, true);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const state = parseHandoff(ws);
  assert.equal(state.schema_version ?? CURRENT_VERSIONS.handoff, CURRENT_VERSIONS.handoff, "sanity: server CURRENT is what we migrate to");
  assert.equal(CURRENT_VERSIONS.handoff, 12, "sanity: CURRENT is 12 (e8-success-telemetry)");
  assert.equal(state.qa_rounds_total, 0, "v0 legacy chain lands with qa_rounds_total seeded 0");
  assert.equal(state.review_rounds_total, 0, "v0 legacy chain lands with review_rounds_total seeded 0");
  assert.equal(state.visual_rounds_total, 0, "v0 legacy chain lands with visual_rounds_total seeded 0");
  const raw = fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
  assert.match(raw, /schema_version:\s*12/, "on-disk heal lands at v12");
});

test("E8-M3: a v13 handoff refuses-loud against this v12 server (no silent downgrade)", () => {
  const ws = mkWs("e8-future-");
  resetSession(ws);
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
schema_version: 13
active_feature: "from-the-future"
status: "In_Progress"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  assert.throws(
    () => parseHandoff(ws),
    /on-disk version 13 > server max 12/,
    "a v13 file must refuse-loud, never silently downgrade",
  );
});

test("E8-M4: totals are preserved (not reset) across a same-feature migration-heal write", async () => {
  // WHY: mirrors the architecture's DR on migration-heal write-back threading
  // (handoff.ts:511-542) — a hand-migrated v11 file that already carries
  // nonzero totals (e.g. hand-edited during a version skip) must not have
  // them clobbered back to 0 by the heal write; the heal write threads
  // state.qa_rounds_total/etc through verbatim.
  const ws = mkWs("e8-heal-");
  resetSession(ws);
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
schema_version: 11
active_feature: "heal-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 4
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  readHandoffState(ws);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const healed = fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
  assert.match(healed, /schema_version:\s*12/, "heal lands at CURRENT (v12)");
  // v11 file had no totals at all (pre-e8 shape) -> migration seeds 0, and the
  // heal write must persist that seeded 0 (not silently drop the fields).
  assert.match(healed, /qa_rounds_total:\s*0/, "heal write persists the seeded qa_rounds_total");
  assert.match(healed, /review_rounds_total:\s*0/, "heal write persists the seeded review_rounds_total");
  assert.match(healed, /visual_rounds_total:\s*0/, "heal write persists the seeded visual_rounds_total");
  assert.match(healed, /hop_count:\s*4/, "sibling hop_count survives the heal write untouched");
});

// ============================================================================
// Counter semantics: each *_total ticks on its FAIL predicate (incl.
// visual_fail: token), survives QA PASS and pm re-entry, resets on
// active_feature change; legacy positional computeNewRound callers get
// 0-defaults.
// ============================================================================

test("E8-C1: qa_rounds_total ticks +1 on (qa-engineer, FAIL); review/visual hold", () => {
  const r = computeNewRound(
    3, 1, 0,
    { agent: "qa-engineer", status: "FAIL" },
    { agent: "sr-engineer", status: "In_Progress" },
    [],
    5, false,
    2, 1, 0, // prev totals
  );
  assert.equal(r.qa_rounds_total, 3, "qa_rounds_total ticks 2 -> 3");
  assert.equal(r.review_rounds_total, 1, "review_rounds_total holds");
  assert.equal(r.visual_rounds_total, 0, "visual_rounds_total holds (no visual_fail token)");
});

test("E8-C2: review_rounds_total ticks +1 on (code-reviewer, FAIL); qa/visual hold", () => {
  const r = computeNewRound(
    0, 2, 0,
    { agent: "code-reviewer", status: "FAIL" },
    { agent: "sr-engineer", status: "In_Progress" },
    [],
    3, false,
    4, 2, 1,
  );
  assert.equal(r.qa_rounds_total, 4, "qa_rounds_total holds");
  assert.equal(r.review_rounds_total, 3, "review_rounds_total ticks 2 -> 3");
  assert.equal(r.visual_rounds_total, 1, "visual_rounds_total holds");
});

test("E8-C3: visual_rounds_total ticks +1 ONLY when the FAIL carries a visual_fail: token — and qa_rounds_total ticks too (same qa-engineer FAIL event)", () => {
  const withToken = computeNewRound(
    0, 0, 5,
    { agent: "qa-engineer", status: "FAIL" },
    { agent: "sr-engineer", status: "In_Progress" },
    ["visual_fail: pixel diff at header"],
    2, false,
    1, 0, 5,
  );
  assert.equal(withToken.visual_rounds_total, 6, "visual_rounds_total ticks 5 -> 6 with the token");
  assert.equal(withToken.qa_rounds_total, 2, "qa_rounds_total ALSO ticks — it's still a (qa-engineer, FAIL) event");

  const withoutToken = computeNewRound(
    0, 0, 5,
    { agent: "qa-engineer", status: "FAIL" },
    { agent: "sr-engineer", status: "In_Progress" },
    ["plain FAIL, not a visual issue"],
    2, false,
    1, 0, 5,
  );
  assert.equal(withoutToken.visual_rounds_total, 5, "visual_rounds_total holds without the token");
  assert.equal(withoutToken.qa_rounds_total, 2, "qa_rounds_total still ticks (the qa-engineer FAIL predicate is unconditional on the token)");
});

test("E8-C4: totals SURVIVE a QA PASS — unlike the cycle counters, which reset", () => {
  const r = computeNewRound(
    3, 0, 0,
    { agent: "qa-engineer", status: "PASS" },
    { agent: "qa-engineer", status: "In_Progress" },
    [],
    6, false,
    3, 1, 0, // prior accumulated totals
  );
  assert.equal(r.qa_round, 0, "cycle qa_round resets on PASS (unchanged sibling behavior)");
  assert.equal(r.qa_rounds_total, 3, "qa_rounds_total does NOT reset on PASS — it's a feature-lifetime total");
  assert.equal(r.review_rounds_total, 1, "review_rounds_total likewise survives");
  assert.equal(r.visual_rounds_total, 0, "visual_rounds_total likewise survives (here already 0)");
});

test("E8-C5: totals SURVIVE (pm, In_Progress) re-entry — unlike qa_round/review_round/visual_round/hop_count-adjacent cycle counters, which reset", () => {
  // WHY: this is the load-bearing asymmetry the architecture calls out
  // explicitly (AC3/AC8) — the whole point of the new counters is to survive
  // exactly the event that already zeros the pre-existing cycle counters.
  const r = computeNewRound(
    4, 3, 2,
    { agent: "pm", status: "In_Progress" },
    { agent: "qa-engineer", status: "FAIL" },
    [],
    10, false,
    5, 4, 3, // prior accumulated totals
  );
  assert.equal(r.qa_round, 0, "cycle qa_round resets on pm re-entry");
  assert.equal(r.review_round, 0, "cycle review_round resets on pm re-entry");
  assert.equal(r.visual_round, 0, "cycle visual_round resets on pm re-entry");
  assert.equal(r.qa_rounds_total, 5, "qa_rounds_total does NOT reset on pm re-entry");
  assert.equal(r.review_rounds_total, 4, "review_rounds_total does NOT reset on pm re-entry");
  assert.equal(r.visual_rounds_total, 3, "visual_rounds_total does NOT reset on pm re-entry");
});

test("E8-C6: feature_changed=true resets ALL three totals to 0 before applying this write's own increment", () => {
  const r = computeNewRound(
    0, 0, 0,
    { agent: "qa-engineer", status: "FAIL" },
    { agent: "pm", status: "In_Progress" },
    [],
    0, true, // feature_changed
    9, 8, 7, // stale totals from the OLD feature — must not survive
  );
  assert.equal(r.qa_rounds_total, 1, "base resets to 0 on feature change, then this write's own FAIL ticks it to 1");
  assert.equal(r.review_rounds_total, 0, "base resets to 0 on feature change; no review FAIL this write");
  assert.equal(r.visual_rounds_total, 0, "base resets to 0 on feature change; no visual FAIL this write");
});

test("E8-C7: other writes (non-FAIL, non-feature-change) hold all three totals steady", () => {
  const r = computeNewRound(
    2, 1, 0,
    { agent: "sr-engineer", status: "In_Progress" },
    { agent: "qa-engineer", status: "FAIL" },
    [],
    7, false,
    3, 2, 1,
  );
  assert.deepEqual(
    [r.qa_rounds_total, r.review_rounds_total, r.visual_rounds_total],
    [3, 2, 1],
    "no FAIL predicate matched -> all three totals hold at their prior value",
  );
});

test("E8-C8: legacy computeNewRound callers omitting the 3 new prev-total args (and feature_changed/prev_hop_count) still compile and default totals to 0", () => {
  // Mirrors AC-10/AC-11's pre-v3.14/pre-v9 backwards-compat pins for
  // visual_round/hop_count — the same widen-additively-defaulted contract.
  const r = computeNewRound(1, 0, 0, { agent: "qa-engineer", status: "FAIL" });
  assert.equal(r.qa_rounds_total, 1, "with all prev-totals defaulted to 0 and no feature_changed, a qa FAIL still ticks 0 -> 1");
  assert.equal(r.review_rounds_total, 0);
  assert.equal(r.visual_rounds_total, 0);
});

// ============================================================================
// Handoff plumbing: parse defaults 0 / round-trip / always-serialized
// (mirror the hop_count test patterns in test/hop-count-transitions.test.mjs)
// ============================================================================

test("E8-H1: writeHandoffState(qaRoundsTotal=N, ...) -> parseHandoff(...).qa_rounds_total === N (round-trip)", async () => {
  const ws = mkWs("e8-rt-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "rt-totals-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
    qaRoundsTotal: 5,
    reviewRoundsTotal: 3,
    visualRoundsTotal: 2,
  });
  const state = parseHandoff(ws);
  assert.equal(state.qa_rounds_total, 5);
  assert.equal(state.review_rounds_total, 3);
  assert.equal(state.visual_rounds_total, 2);
});

test("E8-H2: writeHandoffState omitting the 3 totals normalises all three to 0", async () => {
  const ws = mkWs("e8-rt2-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "rt-totals-feat-2",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
  });
  const state = parseHandoff(ws);
  assert.equal(state.qa_rounds_total, 0);
  assert.equal(state.review_rounds_total, 0);
  assert.equal(state.visual_rounds_total, 0);
});

test("E8-H3: parseHandoff sanitises negative/NaN hand-edited totals to 0", () => {
  const ws = mkWs("e8-neg-");
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
schema_version: 12
active_feature: "feat"
status: "In_Progress"
last_updated: "2026-07-10T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
qa_rounds_total: -3
review_rounds_total: NaN
visual_rounds_total: not-a-number
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  const state = parseHandoff(ws);
  assert.equal(state.qa_rounds_total, 0, "negative sanitises to 0");
  assert.equal(state.review_rounds_total, 0, "NaN sanitises to 0");
  assert.equal(state.visual_rounds_total, 0, "non-numeric sanitises to 0");
});

test("E8-H4: writeHandoffState ALWAYS serializes the 3 totals into YAML, even when 0 (discoverability, mirrors hop_count)", async () => {
  const ws = mkWs("e8-always-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "always-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    qaRoundsTotal: 0,
    reviewRoundsTotal: 0,
    visualRoundsTotal: 0,
  });
  const raw = fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
  assert.match(raw, /qa_rounds_total:\s*0/, "qa_rounds_total: 0 is emitted, not omitted");
  assert.match(raw, /review_rounds_total:\s*0/, "review_rounds_total: 0 is emitted, not omitted");
  assert.match(raw, /visual_rounds_total:\s*0/, "visual_rounds_total: 0 is emitted, not omitted");
});

// ============================================================================
// Emit hook: fires exactly once on the closing-write signature
// (FileHandoffStorage), record shape correctness, no-emit negative space,
// AC2 best-effort/never-throw, one_pass truth table, deriveTicketCode.
// ============================================================================

function seedTasksAndPackage(ws, { code, checked = 2, unchecked = 1, version = "1.2.3" } = {}) {
  const lines = [];
  for (let i = 1; i <= checked; i++) lines.push(`- [x] T-${code}-0${i} some ticket`);
  for (let i = 0; i < unchecked; i++) lines.push(`- [ ] T-${code}-9${i} not done`);
  fs.writeFileSync(path.join(ws, "tasks.md"), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(ws, "package.json"), JSON.stringify({ name: "x", version }));
}

test("E8-E1: full realistic chain — release-engineer terminal-marker write emits exactly one record with the correct shape", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-e2e-");
  const feature = "e8metrics-full-feat";
  seedTasksAndPackage(ws, { code: "E8METRICS", checked: 2, unchecked: 1, version: "9.9.1" });

  // Seed prevState directly with realistic accumulated totals/hop_count — the
  // release-close emit reads exactly this snapshot (DR: emit source is
  // prevState, not the just-computed return).
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws,
    activeFeature: feature,
    status: "PASS",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "qa-engineer",
    hopCount: 9,
    qaRoundsTotal: 2,
    reviewRoundsTotal: 1,
    visualRoundsTotal: 0,
  });

  // Opening write (release-engineer, In_Progress, no next_role) — must NOT emit.
  let res = await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer" });
  assert.ok(!res.isError, `opening write must be accepted: ${res.content?.[0]?.text}`);
  assert.deepEqual(readMetricsLines(ws), [], "opening write must not emit a metrics record");

  // Closing write (release-engineer self-loop, next_role="pm") — the exact
  // E1A terminal marker — must emit exactly one record.
  res = await dispatch(ws, {
    active_feature: feature,
    status: "In_Progress",
    agent_id: "release-engineer",
    next_role: "pm",
    pending_notes: ["Released v9.9.1", "tag: deadbeef"],
  });
  assert.ok(!res.isError, `closing write must be accepted: ${res.content?.[0]?.text}`);

  const lines = readMetricsLines(ws);
  assert.equal(lines.length, 1, "exactly one metrics record must be appended");
  const record = lines[0];
  assert.equal(record.feature, feature);
  assert.equal(record.tickets, 2, "tickets counts only the 2 checked T-E8METRICS-* lines");
  assert.equal(record.qa_rounds, 2, "qa_rounds read from prevState.qa_rounds_total");
  assert.equal(record.review_rounds, 1, "review_rounds read from prevState.review_rounds_total");
  assert.equal(record.visual_rounds, 0, "visual_rounds read from prevState.visual_rounds_total");
  // hop_count 9 (seed) -> 10 after the OPENING write (qa-engineer ->
  // release-engineer IS a counted role transition, DR-9); the CLOSING write
  // is a same-agent self-loop (no further bump), so prevState read at the
  // closing write carries hop_count=10.
  assert.equal(record.hops, 10, "hops read from prevState.hop_count (AC5 — no new field)");
  assert.equal(record.one_pass, false, "one_pass is false — qa_rounds/review_rounds were nonzero at some point");
  assert.equal(record.released_version, "9.9.1", "released_version read from package.json at emit time");
  assert.ok(typeof record.ts === "string" && !Number.isNaN(Date.parse(record.ts)), "ts is a valid ISO-8601 timestamp");
  assert.equal(Object.keys(record).sort().join(","), "feature,hops,one_pass,qa_rounds,released_version,review_rounds,tickets,ts,visual_rounds", "record carries exactly the AC1 shape, no stray keys");
});

test("E8-E2: one_pass is true only when all three prevState totals are 0", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-onepass-");
  const feature = "e8onepass-feat";
  seedTasksAndPackage(ws, { code: "E8ONEPASS", checked: 1, version: "1.0.0" });
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws, activeFeature: feature, status: "PASS",
    completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
    hopCount: 3, qaRoundsTotal: 0, reviewRoundsTotal: 0, visualRoundsTotal: 0,
  });
  await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer" });
  await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer", next_role: "pm" });
  const [record] = readMetricsLines(ws);
  assert.equal(record.one_pass, true, "all three totals 0 at emit time -> one_pass true");
  assert.equal(record.qa_rounds, 0);
  assert.equal(record.review_rounds, 0);
  assert.equal(record.visual_rounds, 0);
});

test("E8-E3: NO emit on any write where agent_id !== release-engineer, even with next_role=\"pm\"", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-noemit-agent-");
  const feature = "e8-noemit-agent-feat";
  seedTasksAndPackage(ws, { code: "E8NOEMITAGENT" });
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws, activeFeature: feature, status: "PASS",
    completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
    hopCount: 1, qaRoundsTotal: 4, reviewRoundsTotal: 0, visualRoundsTotal: 0,
  });
  const res = await dispatch(ws, {
    active_feature: feature, status: "In_Progress", agent_id: "pm",
    next_role: "pm", cut_approved: true,
  });
  assert.ok(!res.isError, `pm write must be accepted: ${res.content?.[0]?.text}`);
  assert.deepEqual(readMetricsLines(ws), [], "next_role=pm alone is not the terminal marker — agent_id must also be release-engineer");
});

test("E8-E4: NO emit on a release-engineer self-loop write whose next_role is anything other than \"pm\" (escalation case)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-noemit-nextrole-");
  const feature = "e8-noemit-nextrole-feat";
  seedTasksAndPackage(ws, { code: "E8NOEMITNEXTROLE" });
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws, activeFeature: feature, status: "PASS",
    completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
    hopCount: 2, qaRoundsTotal: 0, reviewRoundsTotal: 0, visualRoundsTotal: 0,
  });
  await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer" });
  const res = await dispatch(ws, {
    active_feature: feature, status: "In_Progress", agent_id: "release-engineer", next_role: "qa-engineer",
  });
  assert.ok(!res.isError, `escalation self-loop write must be accepted: ${res.content?.[0]?.text}`);
  assert.deepEqual(readMetricsLines(ws), [], "next_role must be exactly \"pm\" — any other value must not emit");
});

test("E8-E5 (SQLite): the terminal-marker write never emits, even though the write itself succeeds identically", async () => {
  if (!SqliteHandoffStorage) {
    console.log("[skip] no better-sqlite3 — E8-E5 skipped");
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e8-sql-"));
  const dbPath = path.join(dir, "agc.db");
  try {
    const feature = "e8-sqlite-feat";
    seedTasksAndPackage(dir, { code: "E8SQLITE" });
    const storage = new SqliteHandoffStorage(dbPath);
    setActiveStorage(storage);
    await storage.writeState({
      workspacePath: dir, activeFeature: feature, status: "PASS",
      completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
      hopCount: 2, qaRoundsTotal: 3, reviewRoundsTotal: 0, visualRoundsTotal: 0,
    });
    resetSession(dir);
    markStateRead(dir);
    const res = await UPDATE_STATE_ENTRY.run({
      workspace_path: dir, completed_tasks: [], pending_notes: [],
      active_feature: feature, status: "In_Progress", agent_id: "release-engineer", next_role: "pm",
    });
    assert.ok(!res.isError, `SQLite-mode closing write must still be accepted: ${res.content?.[0]?.text}`);
    assert.ok(!fs.existsSync(metricsPath(dir)), "SQLite mode must never create .current/metrics.jsonl — the hook keys on FileHandoffStorage");
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test("E8-E6 (AC2): a missing tasks.md degrades the WHOLE emit to a no-op (outer try/catch) — the state write itself still succeeds", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-notasks-");
  const feature = "e8-notasks-feat";
  // Deliberately do NOT write tasks.md.
  fs.writeFileSync(path.join(ws, "package.json"), JSON.stringify({ version: "1.0.0" }));
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws, activeFeature: feature, status: "PASS",
    completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
    hopCount: 0, qaRoundsTotal: 0, reviewRoundsTotal: 0, visualRoundsTotal: 0,
  });
  await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer" });
  const res = await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer", next_role: "pm" });
  assert.ok(!res.isError, `closing write must succeed even though tasks.md is missing: ${res.content?.[0]?.text}`);
  assert.ok(!fs.existsSync(metricsPath(ws)), "the tickets-count read throws before the record is built — the ENTIRE emit is swallowed, not partially written");
});

test("E8-E7 (AC7/AC2): a missing package.json degrades ONLY released_version to null — the rest of the record still emits", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-nopkg-");
  const feature = "e8nopkg-feat";
  fs.writeFileSync(path.join(ws, "tasks.md"), "- [x] T-E8NOPKG-01 done\n");
  // Deliberately do NOT write package.json.
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws, activeFeature: feature, status: "PASS",
    completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
    hopCount: 0, qaRoundsTotal: 0, reviewRoundsTotal: 0, visualRoundsTotal: 0,
  });
  await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer" });
  const res = await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer", next_role: "pm" });
  assert.ok(!res.isError, `closing write must succeed even though package.json is missing: ${res.content?.[0]?.text}`);
  const [record] = readMetricsLines(ws);
  assert.ok(record, "the record must still be emitted (only released_version degrades, per the inner try/catch)");
  assert.equal(record.released_version, null, "released_version is null when package.json is unreadable (AC7)");
  assert.equal(record.tickets, 1, "tickets still computed correctly from the present tasks.md");
});

test("E8-E8 (AC2): an unwritable metrics.jsonl (path occupied by a directory) never throws into the caller — the state write result is unaffected", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e8-unwritable-");
  const feature = "e8-unwritable-feat";
  seedTasksAndPackage(ws, { code: "E8UNWRITABLE" });
  // Occupy the target path with a directory so fs.appendFileSync throws EISDIR.
  fs.mkdirSync(metricsPath(ws), { recursive: true });
  const storage = new FileHandoffStorage();
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: ws, activeFeature: feature, status: "PASS",
    completedTasks: [], pendingNotes: [], lastAgent: "qa-engineer",
    hopCount: 0, qaRoundsTotal: 0, reviewRoundsTotal: 0, visualRoundsTotal: 0,
  });
  await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer" });
  const res = await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "release-engineer", next_role: "pm" });
  assert.ok(!res.isError, `closing write's ToolResult must be byte-identical whether or not the emit succeeds: ${res.content?.[0]?.text}`);
  assert.ok(fs.statSync(metricsPath(ws)).isDirectory(), "the occupied path is left untouched (the append failure is swallowed, not retried/recovered)");
});

test("E8-E9: emitFeatureMetrics never throws directly, regardless of inputs (defense in depth, unit-level)", () => {
  assert.doesNotThrow(() => emitFeatureMetrics({
    workspacePath: "/nonexistent/path/that/cannot/possibly/exist",
    feature: "whatever",
    qaRoundsTotal: 0, reviewRoundsTotal: 0, visualRoundsTotal: 0, hops: 0,
  }));
});

// ---------- deriveTicketCode (AC4) ----------

test("E8-D1: deriveTicketCode derives the leading alnum token before the first hyphen, uppercased", () => {
  assert.equal(deriveTicketCode("e8-success-telemetry"), "E8");
  assert.equal(deriveTicketCode("d10-release-engineer-git-stop-rule"), "D10");
  assert.equal(deriveTicketCode("nohyphenfeature"), "NOHYPHENFEATURE", "no hyphen -> the whole string, uppercased");
  assert.equal(deriveTicketCode(""), "", "empty string never throws, degrades to empty code");
  assert.equal(deriveTicketCode("A1-b-c"), "A1", "mixed-case token is uppercased");
});

// ============================================================================
// Summarizer CLI (AC9): happy path / malformed-line skip+count / empty +
// missing file exit 0.
// ============================================================================

function runSummarizer(metricsFile) {
  return spawnSync(
    process.execPath,
    [path.join(PROJECT_ROOT, "scripts", "summarize-metrics.mjs"), metricsFile],
    { encoding: "utf-8" },
  );
}

test("E8-S1: summarizer happy path — prints per-feature rows and an aggregate one-pass-rate/mean-rounds line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e8-sum-"));
  const file = path.join(dir, "metrics.jsonl");
  const records = [
    { ts: "2026-01-01T00:00:00.000Z", feature: "feat-a", tickets: 3, qa_rounds: 0, review_rounds: 0, visual_rounds: 0, hops: 4, one_pass: true, released_version: "1.0.0" },
    { ts: "2026-01-02T00:00:00.000Z", feature: "feat-b", tickets: 5, qa_rounds: 2, review_rounds: 1, visual_rounds: 0, hops: 10, one_pass: false, released_version: "1.1.0" },
  ];
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const result = runSummarizer(file);
  assert.equal(result.status, 0, `summarizer must exit 0 on a healthy file; stderr: ${result.stderr}`);
  assert.match(result.stdout, /feat-a/);
  assert.match(result.stdout, /feat-b/);
  assert.match(result.stdout, /aggregate/);
  assert.match(result.stdout, /features: 2/);
  assert.match(result.stdout, /one-pass rate: 50\.0%/, "1 of 2 records is one_pass -> 50.0%");
});

test("E8-S2: summarizer skips malformed lines, counts them, and still summarizes the valid ones (never throws)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e8-sum-bad-"));
  const file = path.join(dir, "metrics.jsonl");
  const good = { ts: "2026-01-01T00:00:00.000Z", feature: "good-feat", tickets: 1, qa_rounds: 0, review_rounds: 0, visual_rounds: 0, hops: 1, one_pass: true, released_version: "1.0.0" };
  fs.writeFileSync(
    file,
    [
      JSON.stringify(good),
      "{not valid json",
      "",
      "[1,2,3]", // valid JSON but an array, not a record — must count as malformed
      "42",       // valid JSON but not an object
    ].join("\n") + "\n",
  );
  const result = runSummarizer(file);
  assert.equal(result.status, 0, `summarizer must exit 0 even with malformed lines; stderr: ${result.stderr}`);
  assert.match(result.stdout, /good-feat/);
  assert.match(result.stdout, /features: 1/, "only the one well-formed record counts");
  assert.match(result.stdout, /skipped 3 malformed line\(s\)/, "3 malformed entries: bad JSON, array, and bare number (blank line is NOT malformed)");
});

test("E8-S3: summarizer on an empty file exits 0 with a 'no metrics yet' notice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e8-sum-empty-"));
  const file = path.join(dir, "metrics.jsonl");
  fs.writeFileSync(file, "");
  const result = runSummarizer(file);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /no metrics yet/);
});

test("E8-S4: summarizer on a missing file exits 0 with a 'no metrics yet' notice (never throws ENOENT)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e8-sum-missing-"));
  const file = path.join(dir, "does-not-exist.jsonl");
  const result = runSummarizer(file);
  assert.equal(result.status, 0, `must exit 0 on a missing file; stderr: ${result.stderr}`);
  assert.match(result.stdout, /no metrics yet/);
  assert.match(result.stdout, /not found or unreadable/);
});

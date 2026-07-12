// Coded by @qa-engineer
// Tests for specs/e2-bugfix-repro-gate.md (T-E2-05).
//
// e2-bugfix-repro-gate adds two things on top of the C15 expected-red
// machinery: (1) a new first-class handoff field `dispatch_mode?: "feature" |
// "bugfix"` (schema v10 -> v11, stamp-only), and (2) a new plain-text
// orchestrator gate, REPRO_MANIFEST_MISSING, that blocks the bugfix-mode
// fix-phase handoff (sr-engineer:In_Progress -> code-reviewer:In_Progress)
// until qa_reports/expected-red_<feature>.txt (the C15 manifest, reused
// verbatim) exists. Neither the manifest predicate (hasExpectedRedManifest)
// nor gates/expected-red.ts changed — see test/gates-expected-red.test.mjs
// for that module's own unit coverage.
//
// Spec-to-Test map:
//   AC1 (default routing, no architect hop)         -> chain/skill-text mechanics only; not server-enforced, no dedicated test (PM judgment call, spec Out of Scope)
//   AC2 (repro-first gate blocks fix-phase write)    -> G1, G2
//   AC3 (strict PASS load-bearing in bugfix mode)    -> skill-qa-engineer prose (S3); machine floor is the existing EXPECTED_RED_DIFF_MISSING gate, covered in test/gates-expected-red.test.mjs
//   AC4 (opt back into full chain / feature mode)    -> D6
//   AC5 (feature-mode chains byte-unchanged)         -> G3
//   AC6 (clean rejection, never silent-skip/throw)   -> G1 (message), G4 (Blocked escape never gated)
//   dispatch_mode field mechanics (parse/emit/carry) -> D1..D6, Z1, M1
//   file-mode only (SQLite ignores dispatch_mode)    -> G5
//   skill-text pinning (T-E2-03)                     -> S1, S2, S3

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { expectedRedManifestPath } from "../dist/gates/expected-red.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode repro-gate tests skipped");
}

function mkWs(prefix = "repro-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRaw(ws, body) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body);
}

function readRaw(ws) {
  return fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
}

function writeManifest(ws, feature, body = "test/some.test.mjs | a repro test name\n") {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(expectedRedManifestPath(ws, feature), body, "utf-8");
}

// ============================================================================
// dispatch_mode — parse/emit/carry-forward round-trip (mirrors the
// dispatch_pins/external_refs feature-scoped algorithm, but scalar)
// ============================================================================

test("D1: writeHandoffState({dispatchMode:\"bugfix\"}) emits dispatch_mode into YAML and round-trips through parseHandoff", async () => {
  const ws = mkWs("repro-d1-");
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d1-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: cutting a bugfix ticket"],
    lastAgent: "pm",
    dispatchMode: "bugfix",
  });
  const raw = readRaw(ws);
  assert.match(raw, /dispatch_mode:\s*["']?bugfix["']?/, "dispatch_mode must be emitted into YAML when set");

  const state = parseHandoff(ws);
  assert.equal(state.dispatch_mode, "bugfix", "dispatch_mode must round-trip write -> read");
});

test("D2 (absence === feature): a write that never sets dispatch_mode leaves it undefined, never materialized to the literal \"feature\"", async () => {
  const ws = mkWs("repro-d2-");
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d2-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: ordinary feature ticket"],
    lastAgent: "pm",
  });
  const raw = readRaw(ws);
  assert.doesNotMatch(raw, /dispatch_mode:/, "dispatch_mode must never be emitted when absent (absence-is-signal, not a materialized default)");
  assert.equal(parseHandoff(ws).dispatch_mode, undefined, "dispatch_mode must be undefined, not the string \"feature\"");
});

test("D3: dispatch_mode carries forward across a same-active_feature write that omits it (sr-engineer's fix-phase write inherits PM's bugfix declaration)", async () => {
  const ws = mkWs("repro-d3-");
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d3-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: bugfix-mode cut"],
    lastAgent: "pm",
    dispatchMode: "bugfix",
  });

  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d3-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["sr-engineer: fixing"],
    lastAgent: "sr-engineer",
  });

  assert.equal(parseHandoff(ws).dispatch_mode, "bugfix", "dispatch_mode must carry forward when a downstream same-feature write omits it");
});

test("D4: dispatch_mode is dropped (not carried) when active_feature changes, even if the new write also omits it", async () => {
  const ws = mkWs("repro-d4-");
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d4-feat-old",
    status: "PASS",
    completedTasks: ["T-1"],
    pendingNotes: ["shipped"],
    lastAgent: "qa-engineer",
    dispatchMode: "bugfix",
  });

  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d4-feat-new",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: next ticket, a real feature"],
    lastAgent: "pm",
  });

  assert.equal(parseHandoff(ws).dispatch_mode, undefined, "dispatch_mode must NOT leak across an active_feature change");
});

test("D5: dispatch_mode is NOT re-armed/reset on a PM re-entry write within the SAME feature (contrast with cut_approved, which DOES reset on PM re-entry)", async () => {
  // WHY: this is the load-bearing distinction the architecture calls out
  // (DR: "dispatch_mode feature-scoping") — bug-vs-feature is a STABLE ticket
  // classification for the whole life of the feature, unlike cut_approved's
  // per-cut re-arm. A PM bouncing a QA FAIL back to In_Progress on the SAME
  // feature must not silently flip (or clear) the mode.
  const ws = mkWs("repro-d5-");
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d5-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: bugfix-mode cut"],
    lastAgent: "pm",
    dispatchMode: "bugfix",
  });

  // PM re-enters the SAME feature (e.g. reviewing a QA FAIL bounce-back),
  // omitting dispatch_mode on this write.
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d5-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: re-entering after a QA FAIL bounce"],
    lastAgent: "pm",
  });

  assert.equal(parseHandoff(ws).dispatch_mode, "bugfix", "dispatch_mode must survive a PM re-entry write on the same feature — no re-arm, unlike cut_approved");
});

test("D6 (AC4 opt-back-in): an explicit PM write of dispatch_mode=\"feature\" overrides a previously-carried \"bugfix\"", async () => {
  const ws = mkWs("repro-d6-");
  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d6-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: initially cut as bugfix"],
    lastAgent: "pm",
    dispatchMode: "bugfix",
  });

  resetSession(ws);
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "d6-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: actually cross-cutting, opting back into the full chain"],
    lastAgent: "pm",
    dispatchMode: "feature",
  });

  assert.equal(parseHandoff(ws).dispatch_mode, "feature", "an explicit dispatch_mode=\"feature\" write must override the carried bugfix mode (AC4)");
});

// ============================================================================
// Z1: zod boundary rejection (tools/registry.ts UpdateStateArgs) — out-of-enum
// dispatch_mode rejected before any gate/handler logic runs
// ============================================================================

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

test("Z1: tw_update_state rejects an out-of-enum dispatch_mode value at the zod boundary", async () => {
  assert.ok(UPDATE_STATE_ENTRY, "tw_update_state must be registered in TOOL_REGISTRY");
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_mode: "hotfix", // not "feature" | "bugfix"
      });
    },
    /ZodError|invalid_value|invalid_enum_value/i,
    "an out-of-enum dispatch_mode must be rejected by zod before any gate or handler logic runs",
  );
});

// ============================================================================
// M1: migration v10 -> v11 stamp-only on an old (v10) on-disk file
// ============================================================================

test("M1: a hand-written v10 handoff file migrates to v11 on read — dispatch_mode stays absent (no seed), sibling fields preserved", () => {
  const ws = mkWs("repro-m1-");
  resetSession(ws);
  writeRaw(
    ws,
    `---
schema_version: 10
active_feature: "legacy-v10-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 1
review_round: 0
visual_round: 0
hop_count: 2
next_role: "sr-engineer"
---
## Completed
- (none)

## Pending & Handoff Notes
- next_role: sr-engineer
`,
  );
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_mode, undefined, "v10->v11 must NOT seed dispatch_mode (absence-is-signal, e2-bugfix-repro-gate)");
  // Sibling fields survive losslessly.
  assert.equal(state.active_feature, "legacy-v10-feat");
  assert.equal(state.hop_count, 2, "hop_count preserved across v10->v11->v12");
  assert.equal(state.next_role, "sr-engineer", "sibling v7 field preserved across v10->v11->v12");
  // e8-success-telemetry re-baseline: the file also climbs v11->v12, seeding
  // the three new cumulative totals to 0 (the hop_count counter precedent).
  assert.equal(state.qa_rounds_total, 0, "v11->v12 seeds qa_rounds_total: 0 (e8-success-telemetry)");
  assert.equal(state.review_rounds_total, 0, "v11->v12 seeds review_rounds_total: 0 (e8-success-telemetry)");
  assert.equal(state.visual_rounds_total, 0, "v11->v12 seeds visual_rounds_total: 0 (e8-success-telemetry)");
  assert.equal(CURRENT_VERSIONS.handoff, 12, "sanity: this server's CURRENT handoff version is 12");
});

// ============================================================================
// REPRO_MANIFEST_MISSING orchestrator gate — FILE storage mode
// ============================================================================

async function seedSrEngineerBugfixState(ws, feature, { dispatchMode } = { dispatchMode: "bugfix" }) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["sr-engineer: fix ready for review"],
    lastAgent: "sr-engineer",
    ...(dispatchMode !== undefined ? { dispatchMode } : {}),
  });
  resetSession(ws);
  markStateRead(ws);
}

test("G1: sr-engineer -> code-reviewer handoff is BLOCKED with REPRO_MANIFEST_MISSING when dispatch_mode=\"bugfix\" and no manifest exists (AC2/AC6)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("repro-g1-");
  await seedSrEngineerBugfixState(ws, "g1-feat");

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "g1-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: starting review"],
  });

  assert.ok(result.isError, "the fix-phase handoff must be blocked when the repro manifest is absent");
  assert.match(result.content[0].text, /REPRO_MANIFEST_MISSING/, "the rejection must name the dedicated error code (AC2), never a silent skip");
  assert.match(result.content[0].text, /g1-feat/, "the rejection must name the active feature");
  // AC6: the failure mode is a clear, actionable rejection message, not a crash.
  assert.equal(typeof result.content[0].text, "string");
  assert.ok(result.content[0].text.length > 0);
});

test("G2: the same handoff succeeds once qa_reports/expected-red_<feature>.txt (the repro manifest) exists", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("repro-g2-");
  await seedSrEngineerBugfixState(ws, "g2-feat");
  writeManifest(ws, "g2-feat");

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "g2-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: starting review"],
  });

  assert.ok(!result.isError, `manifest present must clear the gate: ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "g2-feat");
});

test("G3 (AC5): the gate NEVER fires in feature mode (dispatch_mode absent) — feature-mode chains are byte-behavior-unchanged", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("repro-g3-");
  await seedSrEngineerBugfixState(ws, "g3-feat", { dispatchMode: undefined });

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "g3-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: starting review, ordinary feature chain"],
  });

  assert.ok(!result.isError, `a feature-mode ticket must never trip REPRO_MANIFEST_MISSING even with no manifest: ${result.content?.[0]?.text}`);
});

test("G4 (AC6): the sr-engineer -> pm Blocked escape edge is NEVER gated by REPRO_MANIFEST_MISSING, even in bugfix mode with no manifest", async () => {
  // WHY: AC6's escape hatch — if repro is genuinely infeasible, sr-engineer
  // escalates status=Blocked to pm instead of faking a manifest. The gate is
  // keyed ONLY to the sr-engineer:In_Progress -> code-reviewer:In_Progress
  // edge (architecture Interface Contracts); this pins that the Blocked
  // escape to pm is structurally untouched.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("repro-g4-");
  await seedSrEngineerBugfixState(ws, "g4-feat");

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "g4-feat",
    status: "Blocked",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: ["sr-engineer: repro not feasible, escalating"],
    blocking_reason: "repro not feasible for this ticket",
  });

  assert.ok(!result.isError, `the Blocked escape to pm must never be gated by REPRO_MANIFEST_MISSING: ${result.content?.[0]?.text}`);
});

// ============================================================================
// REPRO_MANIFEST_MISSING orchestrator gate — SQLite storage mode (file-mode
// only per DR-5: dispatch_mode is never persisted in SQLite, so the gate
// cannot even observe a "bugfix" prevState there)
// ============================================================================

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

sqliteDescribe("SQLite mode: REPRO_MANIFEST_MISSING never arms", () => {
  test("G5: SQLite mode never gates the fix-phase write, even with no manifest — dispatch_mode is never persisted there (DR-5, file-mode only)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repro-sql-g5-"));
    const dbPath = path.join(dir, "agc.db");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "g5-sql-feat",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["sr-engineer: fix ready (sqlite mode)"],
        lastAgent: "sr-engineer",
        dispatchMode: "bugfix", // ignored by SqliteHandoffStorage.writeState (DR-5)
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "g5-sql-feat",
        status: "In_Progress",
        agent_id: "code-reviewer",
        completed_tasks: [],
        pending_notes: ["code-reviewer: starting review (sqlite mode, no manifest)"],
      });

      assert.ok(!result.isError, `SQLite mode must never arm REPRO_MANIFEST_MISSING: ${result.content?.[0]?.text}`);
      const parsed = storage.parse(dir);
      assert.equal(parsed.dispatch_mode, undefined, "SqliteHandoffStorage must never persist dispatch_mode (DR-5, mirrors dispatch_pins)");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ============================================================================
// Skill-text pinning (T-E2-03) — the three prose additions this ticket ships
// ============================================================================

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

test("S1: content/skill-pm.md carries the Bugfix mode guidance (dispatch_mode=\"bugfix\", AC1 default chain, AC4 opt-back-in, Task Format example)", () => {
  const skill = readContentFile("skill-pm.md");
  assert.match(skill, /\*\*Bugfix mode\*\*/, "must carry the named Bugfix mode heading");
  assert.ok(skill.includes('dispatch_mode: "bugfix"'), "must instruct setting dispatch_mode=\"bugfix\" at cut time");
  assert.ok(
    skill.includes("architect and design-auditor skipped"),
    "must state the AC1 default chain (architect/design-auditor skipped)",
  );
  assert.ok(
    skill.includes('dispatch_mode: "feature"'),
    "must document the AC4 opt-back-in (explicit dispatch_mode=\"feature\")",
  );
  assert.ok(skill.includes("qa_reports/expected-red_"), "must reference the repro manifest convention in its Task Format example");
});

test("S2: content/skill-sr-engineer.md carries the Repro-First (bugfix mode) SOP step, backtick-quoting REPRO_MANIFEST_MISSING (documentedInProse contract)", () => {
  const skill = readContentFile("skill-sr-engineer.md");
  assert.match(skill, /\*\*Repro-First \(bugfix mode\)\*\*/, "must carry the named Repro-First SOP step heading");
  assert.ok(skill.includes("`REPRO_MANIFEST_MISSING`"), "must backtick-quote REPRO_MANIFEST_MISSING verbatim (gates/registry.ts documentedInProse contract, test/error-code-contract.test.mjs)");
  assert.ok(skill.includes("dispatch_mode"), "must reference the dispatch_mode signal");
  assert.ok(
    /confirm it is RED/i.test(skill),
    "must instruct confirming the reproduction test is RED before the fix (repro-first discipline)",
  );
  assert.ok(
    skill.includes("status=Blocked"),
    "must document the AC6 escape (escalate status=Blocked to pm when repro is infeasible)",
  );
});

test("S3: content/skill-qa-engineer.md carries the bugfix-mode Phase 0.5 branch making the Expected-Red Diff disposition load-bearing for PASS", () => {
  const skill = readContentFile("skill-qa-engineer.md");
  assert.match(skill, /\*\*Bugfix-mode branch\*\*/, "must carry the named Bugfix-mode branch heading");
  assert.ok(skill.includes("dispatch_mode"), "must reference the dispatch_mode signal");
  assert.ok(
    /load-bearing for PASS/i.test(skill),
    "must state the disposition is load-bearing for PASS in bugfix mode (AC3), not advisory",
  );
  assert.ok(
    /zero.{0,20}reds/i.test(skill) || /ZERO actual reds/i.test(skill),
    "must state the zero-unexplained-reds requirement",
  );
});

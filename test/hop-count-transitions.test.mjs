// Coded by @qa-engineer
// Tests for specs/d2-server-brake-accounting.md — the server-computed,
// persisted hop_count counter and its HOP_CAP_EXCEEDED gate (T-D2-05).
//
// Spec-to-Test map:
//   AC-1 (persisted, server-computed field)      -> t-compute-*, t-e2e-accumulate
//   AC-2 (hop cap enforced server-side)           -> t-gate-*, t-e2e-cap-fires
//   AC-3 (hop count resets per feature)           -> t-compute-feature-reset,
//                                                     t-gate-feature-bypass,
//                                                     t-e2e-feature-reset
//   AC-4 (survives coordinator crash/compaction)  -> t-crash-file, t-crash-sqlite
//   AC-8 (existing round caps unchanged / take
//         precedence over the hop-cap override)   -> t-precedence-*
//   DR-6 (pm landing does NOT reset hop_count)    -> t-compute-pm-no-reset,
//                                                     t-e2e-landing-no-reset
//   DR-9 (increment only on role transitions)     -> t-compute-self-loop-holds
//
// WHY: the hop counter is the one remaining cost-side circuit breaker
// (const-01 Limits `hop` cap = 10) that used to live only in the
// coordinator's in-memory arithmetic — exactly the failure mode a context
// compaction or crash could silently reset. This ticket moves it onto the
// same persisted, server-enforced machinery as qa_round/review_round/
// visual_round; these tests pin that the new sibling mechanism (a) computes
// correctly in isolation, (b) enforces the cap end-to-end through the real
// tw_update_state orchestrator, and (c) survives a simulated crash by
// reconstructing purely from what's on disk (or in SQLite).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  computeNewRound,
  validateTransition,
  HOP_CAP_EXPORTED,
} from "../dist/tools/transitions.js";
import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite hop_count tests skipped");
}

function mkWs(prefix = "hopcap-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

async function dispatch(ws, args) {
  resetSession(ws);
  markStateRead(ws);
  return UPDATE_STATE_ENTRY.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
}

// ============================================================================
// AC-1: HOP_CAP_EXPORTED constant
// ============================================================================

test("t-const: HOP_CAP_EXPORTED === 10 (const-01 Limits `hop` cap)", () => {
  assert.equal(HOP_CAP_EXPORTED, 10);
});

// ============================================================================
// AC-1/DR-9: computeNewRound hop_count semantics (pure, isolated)
// ============================================================================

test("t-compute-role-transition-increments: next.agent !== prev.agent bumps hop_count by 1", () => {
  const result = computeNewRound(
    0, 0, 0,
    { agent: "sr-engineer", status: "In_Progress" },
    { agent: "pm", status: "In_Progress" },
    [],
    3, // prev_hop_count
    false, // feature_changed
  );
  assert.equal(result.hop_count, 4, "role transition increments hop_count by 1 from its prior value");
});

test("t-compute-first-write-counts: null prev.agent -> any next.agent is a counted role transition", () => {
  // WHY (DR-9): the very first write of a fresh workspace (prev.agent === null)
  // must count as a role transition too — a coordinator opening a brand-new
  // feature still consumes one hop.
  const result = computeNewRound(
    0, 0, 0,
    { agent: "pm", status: "In_Progress" },
    undefined, // no prev tuple at all — mirrors a fresh workspace
    [],
    0,
    false,
  );
  assert.equal(result.hop_count, 1, "first write (prev.agent=null) counts as a role transition");
});

test("t-compute-self-loop-holds: same-agent In_Progress->In_Progress self-loop does NOT bump hop_count (DR-9)", () => {
  const result = computeNewRound(
    0, 0, 0,
    { agent: "sr-engineer", status: "In_Progress" },
    { agent: "sr-engineer", status: "In_Progress" },
    [],
    5,
    false,
  );
  assert.equal(result.hop_count, 5, "self-loop is not a role transition — hop_count holds");
});

test("t-compute-same-agent-status-change-holds: same-agent status change (not a self-loop) also does NOT bump hop_count", () => {
  // e.g. (qa-engineer, In_Progress) -> (qa-engineer, FAIL) — same agent,
  // different status. DR-9's counted predicate keys ONLY on next.agent !==
  // prev.agent, so this must hold too.
  const result = computeNewRound(
    1, 0, 0,
    { agent: "qa-engineer", status: "FAIL" },
    { agent: "qa-engineer", status: "In_Progress" },
    [],
    7,
    false,
  );
  assert.equal(result.hop_count, 7, "same-agent status change is not counted (DR-9)");
});

test("t-compute-feature-reset: feature_changed=true resets the base to 0 before the role-transition check (AC-3)", () => {
  const result = computeNewRound(
    0, 0, 0,
    { agent: "pm", status: "In_Progress" },
    { agent: "qa-engineer", status: "PASS" },
    [],
    9, // prior hop_count, must NOT survive the feature change
    true, // feature_changed
  );
  assert.equal(result.hop_count, 1, "feature change resets base to 0, then the role transition itself bumps to 1");
});

test("t-compute-pm-no-reset: (pm, In_Progress) landing does NOT reset hop_count — contrast with the three round caps (DR-6)", () => {
  // WHY: this is the load-bearing asymmetry vs qa_round/review_round/
  // visual_round, all of which zero on (pm, In_Progress). hop_count is a
  // session-length breaker: after HOP_CAP_EXCEEDED fires, the (pm,In_Progress)
  // landing records the halt WITHOUT clearing the counter — only an
  // active_feature change does that (AC-3).
  const result = computeNewRound(
    4, 3, 2, // qa_round, review_round, visual_round — these DO reset on pm landing
    { agent: "pm", status: "In_Progress" },
    { agent: "qa-engineer", status: "FAIL" },
    [],
    10, // already at cap
    false, // NOT a feature change
  );
  assert.equal(result.qa_round, 0, "qa_round resets on pm landing (unchanged sibling behavior)");
  assert.equal(result.review_round, 0, "review_round resets on pm landing (unchanged sibling behavior)");
  assert.equal(result.visual_round, 0, "visual_round resets on pm landing (unchanged sibling behavior)");
  assert.equal(result.hop_count, 11, "hop_count does NOT reset on pm landing — it still increments (role transition) to 11");
});

test("t-compute-persists-across-many-non-role-writes: hop_count is stable across a long run of self-loops", () => {
  let hop = 0;
  let prev = { agent: "sr-engineer", status: "In_Progress" };
  for (let i = 0; i < 50; i++) {
    const r = computeNewRound(0, 0, 0, prev, prev, [], hop, false);
    hop = r.hop_count;
  }
  assert.equal(hop, 0, "an unbroken run of self-loops must never advance hop_count");
});

// ============================================================================
// AC-2/AC-3: validateTransition hop-cap gate (pure, isolated)
// ============================================================================

test("t-gate-dormant-under-cap: hop_count < HOP_CAP is dormant for any accepted table edge", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 9,
    feature_changed: false,
  });
  assert.equal(r, null, "hop_count=9 (< cap=10) must not block a legal transition");
});

test("t-gate-fires-at-cap: hop_count >= HOP_CAP on a role transition rejects with HOP_CAP_EXCEEDED, only (pm, In_Progress) allowed", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 10,
    feature_changed: false,
  });
  assert.ok(r, "must reject once hop_count has reached the cap");
  assert.equal(r.error, "HOP_CAP_EXCEEDED");
  assert.deepEqual(r.allowed, [{ new_agent: "pm", new_status: "In_Progress" }]);
  assert.match(r.hint, /hop_count=10/);
});

test("t-gate-fires-above-cap: hop_count > HOP_CAP (migration/hand-edit case) still rejects (>= predicate, not ===)", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 15,
    feature_changed: false,
  });
  assert.ok(r);
  assert.equal(r.error, "HOP_CAP_EXCEEDED");
});

test("t-gate-landing-escape: (pm, In_Progress) landing is accepted even at/over cap (the one legal exit)", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 12,
    feature_changed: false,
  });
  assert.equal(r, null, "the (pm, In_Progress) landing must be accepted at/over cap");
});

test("t-gate-self-loop-exempt: a same-agent self-loop is accepted even at/over cap (not a counted role transition, DR-9)", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 10,
    feature_changed: false,
  });
  assert.equal(r, null, "a self-loop is not a role transition — must not be hop-blocked even at cap");
});

test("t-gate-feature-bypass: feature_changed=true bypasses the hop cap even when prev_hop_count is already at/over cap (AC-3)", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 20,
    feature_changed: true,
  });
  assert.equal(r, null, "a feature change must bypass the stale hop count from the prior feature");
});

test("t-gate-omitted-defaults-dormant: omitting prev_hop_count/feature_changed entirely defaults to dormant (opt-in, mirrors prev_visual_round)", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.equal(r, null, "callers that omit the hop-cap inputs entirely must not be blocked");
});

// ============================================================================
// AC-8: hop-cap override runs AFTER the three round-cap overrides (precedence)
// ============================================================================

test("t-precedence-qa-round-wins: prev_qa_round >= 4 AND prev_hop_count >= 10 simultaneously -> QA_ROUND_EXCEEDED fires, not HOP_CAP_EXCEEDED", () => {
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 4,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 10,
    feature_changed: false,
  });
  assert.ok(r);
  assert.equal(r.error, "QA_ROUND_EXCEEDED", "the qa_round override must win precedence over the hop-cap override");
});

test("t-precedence-visual-round-wins: prev_visual_round >= 6 AND prev_hop_count >= 10 simultaneously -> VISUAL_ROUND_EXCEEDED fires first", () => {
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 6,
    prev_hop_count: 10,
    feature_changed: false,
  });
  assert.ok(r);
  assert.equal(r.error, "VISUAL_ROUND_EXCEEDED");
});

test("t-precedence-existing-round-caps-untouched: round-cap-only scenarios (hop dormant) still behave byte-identically", () => {
  // Regression guard for AC-8: with hop_count comfortably under cap, the
  // pre-existing round-cap behavior must be exactly what it was before this
  // feature shipped.
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 4,
    prev_review_round: 0,
    prev_visual_round: 0,
    prev_hop_count: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "QA_ROUND_EXCEEDED");
});

// ============================================================================
// AC-1/AC-2/AC-3/DR-6: end-to-end through the real tw_update_state orchestrator
// ============================================================================
//
// The climb uses a legal pm <-> sr-engineer bounce (both edges are real
// ALLOWED_TRANSITIONS table rows: "pm:In_Progress" -> sr-engineer:In_Progress,
// and "sr-engineer:In_Progress" -> pm:In_Progress) so EVERY write is a
// counted role transition (DR-9), none of it touches qa_round/review_round/
// visual_round (no FAIL/PASS anywhere in the sequence), and it never trips
// the file-mode CUT_APPROVAL_REQUIRED/SCOPE_DECISION_REQUIRED/
// EXTERNAL_REFS_UNRESOLVED build-entry gates as long as every pm-agent write
// carries cut_approved: true (those gates key on the *previous* pm write's
// attestation, and cut_approved re-arms to undefined on every bare PM
// re-entry unless re-passed).

// Drives hop_count from a fresh workspace up to exactly HOP_CAP_EXPORTED via
// the pm<->sr-engineer bounce. Returns the final parsed state (last_agent is
// always "sr-engineer" when HOP_CAP_EXPORTED is even, matching the current
// cap=10 — the seed write is agent=pm=hop 1, then each further bounce write
// alternates and increments by exactly 1).
async function climbToHopCap(ws, feature) {
  let res = await dispatch(ws, { active_feature: feature, status: "In_Progress", agent_id: "pm", cut_approved: true });
  if (res.isError) throw new Error(`seed write failed: ${res.content?.[0]?.text}`);
  let state = parseHandoff(ws);
  let nextAgent = "sr-engineer";
  while (state.hop_count < HOP_CAP_EXPORTED) {
    const args = { active_feature: feature, status: "In_Progress", agent_id: nextAgent };
    if (nextAgent === "pm") args.cut_approved = true;
    res = await dispatch(ws, args);
    if (res.isError) throw new Error(`climb write (agent=${nextAgent}) failed: ${res.content?.[0]?.text}`);
    state = parseHandoff(ws);
    nextAgent = nextAgent === "pm" ? "sr-engineer" : "pm";
  }
  return state;
}

test("t-e2e-accumulate-and-cap-fires: successive pm<->sr-engineer role-transition writes climb hop_count 1..HOP_CAP; the next counted transition is rejected", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("hope2e-");

  const atCap = await climbToHopCap(ws, "hop-e2e-feat");
  assert.equal(atCap.hop_count, HOP_CAP_EXPORTED, "the climb must land exactly at HOP_CAP_EXPORTED");
  assert.equal(atCap.last_agent, "sr-engineer", "the climb's final write is the sr-engineer leg of the bounce");

  // The next counted role transition (any agent other than sr-engineer or
  // the pm landing) must now be rejected.
  const rejected = await dispatch(ws, { active_feature: "hop-e2e-feat", status: "In_Progress", agent_id: "code-reviewer" });
  assert.ok(rejected.isError, "the next role transition past the cap must be rejected");
  assert.match(rejected.content[0].text, /HOP_CAP_EXCEEDED/);

  // Only the (pm, In_Progress) landing may proceed (it is also a legal
  // ALLOWED_TRANSITIONS edge from sr-engineer:In_Progress).
  const landing = await dispatch(ws, { active_feature: "hop-e2e-feat", status: "In_Progress", agent_id: "pm", cut_approved: true });
  assert.ok(!landing.isError, `the (pm, In_Progress) landing must be accepted: ${landing.content?.[0]?.text}`);
});

test("t-e2e-landing-no-reset: the (pm, In_Progress) landing after HOP_CAP_EXCEEDED does NOT reset hop_count (DR-6) — the next non-pm transition is rejected again", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("hopland-");

  const atCap = await climbToHopCap(ws, "hop-land-feat");
  assert.equal(atCap.hop_count, HOP_CAP_EXPORTED, "precondition: hop_count is at cap");

  // Land at pm (accepted — legal edge from sr-engineer:In_Progress — but per
  // DR-6 must NOT reset the counter).
  const landing = await dispatch(ws, { active_feature: "hop-land-feat", status: "In_Progress", agent_id: "pm", cut_approved: true });
  assert.ok(!landing.isError, `pm landing must be accepted: ${landing.content?.[0]?.text}`);
  const afterLanding = parseHandoff(ws);
  assert.ok(afterLanding.hop_count >= HOP_CAP_EXPORTED, `hop_count must NOT reset on the pm landing (DR-6); got ${afterLanding.hop_count}`);

  // The very next non-pm role transition (same feature) must be rejected again.
  const stillBlocked = await dispatch(ws, { active_feature: "hop-land-feat", status: "In_Progress", agent_id: "sr-engineer" });
  assert.ok(stillBlocked.isError, "autonomous dispatch must stay frozen at pm — the next non-pm transition is rejected again");
  assert.match(stillBlocked.content[0].text, /HOP_CAP_EXCEEDED/);
});

test("t-e2e-feature-reset: an active_feature change resets hop_count to a fresh count, un-freezing dispatch (AC-3)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("hopreset-");

  const atCap = await climbToHopCap(ws, "hop-reset-feat-a");
  assert.equal(atCap.hop_count, HOP_CAP_EXPORTED, "precondition: hop_count is at cap for feature-a");

  // A NEW active_feature write on a legal edge from sr-engineer:In_Progress
  // (pm:In_Progress) must reset the counter — feature_changed bypasses the
  // hop-cap block entirely, and computeNewRound resets the base to 0 before
  // this write's own role transition bumps it to 1.
  const res = await dispatch(ws, { active_feature: "hop-reset-feat-b", status: "In_Progress", agent_id: "pm", cut_approved: true });
  assert.ok(!res.isError, `feature-change write must succeed: ${res.content?.[0]?.text}`);
  const afterReset = parseHandoff(ws);
  assert.equal(afterReset.active_feature, "hop-reset-feat-b");
  assert.equal(afterReset.hop_count, 1, "feature change resets the base to 0, then this write's own role transition bumps it to 1");

  // Autonomous dispatch is un-frozen: a subsequent role transition on the new
  // feature must be accepted (not HOP_CAP_EXCEEDED).
  const unfrozen = await dispatch(ws, { active_feature: "hop-reset-feat-b", status: "In_Progress", agent_id: "sr-engineer" });
  assert.ok(!unfrozen.isError, `dispatch must be un-frozen on the new feature: ${unfrozen.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).hop_count, 2, "counting resumes normally on the new feature");
});

// ============================================================================
// AC-4: crash/compaction — fresh read (no in-memory state) reconstructs the
// correct hop_count from disk / SQLite
// ============================================================================

test("t-crash-file: a fresh parseHandoff/tw_get_state read (new session snapshot) reconstructs the persisted hop_count exactly (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("hopcrash-");

  // cut_approved:true on the pm seed clears the file-mode CUT_APPROVAL_REQUIRED
  // gate for the pm -> architect build-entry edge that follows.
  await dispatch(ws, { active_feature: "crash-feat", status: "In_Progress", agent_id: "pm", cut_approved: true });
  await dispatch(ws, { active_feature: "crash-feat", status: "In_Progress", agent_id: "architect" });
  await dispatch(ws, { active_feature: "crash-feat", status: "In_Progress", agent_id: "sr-engineer" });
  const before = parseHandoff(ws);
  assert.equal(before.hop_count, 3, "precondition: 3 role transitions recorded before the simulated crash");

  // Simulate a coordinator crash / context compaction: wipe every in-process
  // notion of prior state (session snapshot AND any local variable) and read
  // purely from what's on disk, exactly as a brand-new process would.
  resetSession(ws);
  const reconstructed = parseHandoff(ws);
  assert.equal(reconstructed.hop_count, 3, "a fresh read with zero in-memory state must reconstruct hop_count from disk alone");
  assert.equal(reconstructed.active_feature, "crash-feat", "feature scoping survives the simulated crash too");

  // The next role-transition write must continue counting from the
  // reconstructed value, not from a phantom reset.
  resetSession(ws);
  markStateRead(ws);
  await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "crash-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: [],
  });
  assert.equal(parseHandoff(ws).hop_count, 4, "post-crash writes must resume counting from the reconstructed value");
});

const describeSqlite = (name, fn) => (SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {}));

describeSqlite("AC-4 (SQLite): hop_count survives a simulated process crash via a fresh storage instance", () => {
  test("t-crash-sqlite: instantiating a NEW SqliteHandoffStorage against the same on-disk DB reconstructs hop_count exactly", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hopcrash-sql-"));
    const dbPath = path.join(dir, "agc.db");
    try {
      // "Process A": writes 3 counted role transitions, then "crashes" (we
      // simply drop the reference — no explicit close(), the worst case).
      const storageA = new SqliteHandoffStorage(dbPath);
      await storageA.writeState({
        workspacePath: dir, activeFeature: "sql-crash-feat", status: "In_Progress",
        completedTasks: [], pendingNotes: [], lastAgent: "pm", hopCount: 1,
      });
      await storageA.writeState({
        workspacePath: dir, activeFeature: "sql-crash-feat", status: "In_Progress",
        completedTasks: [], pendingNotes: [], lastAgent: "architect", hopCount: 2,
      });
      await storageA.writeState({
        workspacePath: dir, activeFeature: "sql-crash-feat", status: "In_Progress",
        completedTasks: [], pendingNotes: [], lastAgent: "sr-engineer", hopCount: 3,
      });
      storageA.close();

      // "Process B" (post-crash): a brand-new SqliteHandoffStorage instance,
      // zero in-memory carryover, pointed at the same DB file.
      const storageB = new SqliteHandoffStorage(dbPath);
      try {
        const state = storageB.parse(dir);
        assert.ok(state, "state row must exist for a fresh storage instance");
        assert.equal(state.hop_count, 3, "a fresh SqliteHandoffStorage instance must reconstruct hop_count from the persisted column");
        assert.equal(state.active_feature, "sql-crash-feat");
      } finally {
        storageB.close();
      }
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("t-crash-sqlite-omitted-defaults-zero: SqliteHandoffStorage.writeState omitting hopCount normalises to 0 (backwards-compat, pre-D2 callers)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hopcrash-sql2-"));
    const dbPath = path.join(dir, "agc.db");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      try {
        await storage.writeState({
          workspacePath: dir, activeFeature: "sql-nohc-feat", status: "In_Progress",
          completedTasks: [], pendingNotes: [], lastAgent: "pm",
          // hopCount intentionally omitted
        });
        const state = storage.parse(dir);
        assert.equal(state.hop_count, 0, "omitted hopCount must normalise to 0, matching qaRound/reviewRound/visualRound semantics");
      } finally {
        storage.close();
      }
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ============================================================================
// Regression: hop_count round-trips through writeHandoffState (file-mode
// direct call, not via the orchestrator) — the lower-level building block the
// orchestrator sits on top of.
// ============================================================================

test("t-writehandoff-roundtrip: writeHandoffState(hopCount=N) -> parseHandoff(...).hop_count === N", async () => {
  const ws = mkWs("hopwrite-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "direct-write-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
    hopCount: 6,
  });
  const state = parseHandoff(ws);
  assert.equal(state.hop_count, 6);
});

test("t-writehandoff-default-zero: writeHandoffState omitting hopCount defaults to 0", async () => {
  const ws = mkWs("hopwrite2-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "direct-write-feat-2",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
  });
  const state = parseHandoff(ws);
  assert.equal(state.hop_count, 0);
});

test("t-parsehandoff-sanitises-negative: parseHandoff sanitises a negative/NaN hand-edited hop_count to 0", () => {
  const ws = mkWs("hopneg-");
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
schema_version: 9
active_feature: "feat"
status: "In_Progress"
last_updated: "2026-07-10T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: -3
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  assert.equal(parseHandoff(ws).hop_count, 0);
});

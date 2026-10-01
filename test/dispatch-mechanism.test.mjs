// Coded by @qa-engineer
// Tests for specs/e123a-lane-layout-migration.md AC2/AC3 (T-E123A3-08, covering T-E123A3-01/02): the
// transient dispatch_mechanism / dispatch_mechanism_tier fields and their zod boundary.
// Spec-to-Test map: specs/e260e-comment-rationale.md (dispatch-mechanism.test.mjs).

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
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

function mkWs(prefix = "dispatch-mech-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function readRaw(ws) {
  return fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8");
}

// ============================================================================
// AC2 — transience: write A sets both fields, write B (same feature, both
// omitted) drops them. NOT the dispatch_pins/external_refs feature-scoped
// carry-forward — the exact next_role/review_verdict per-hop lifetime.
// ============================================================================

test("RT1: writeHandoffState round trip — write A sets dispatch_mechanism/dispatch_mechanism_tier, write B (same feature, both omitted) reads back undefined", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "rt1-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
    dispatchMechanism: "task",
    dispatchMechanismTier: "fable",
  });
  resetSession();
  const stateA = parseHandoff(ws);
  assert.equal(stateA.dispatch_mechanism, "task", "write A must persist dispatch_mechanism verbatim");
  assert.equal(stateA.dispatch_mechanism_tier, "fable", "write A must persist dispatch_mechanism_tier verbatim");
  assert.match(readRaw(ws), /dispatch_mechanism:\s*["']?task["']?/, "dispatch_mechanism must appear in on-disk YAML");
  assert.match(readRaw(ws), /dispatch_mechanism_tier:\s*["']?fable["']?/, "dispatch_mechanism_tier must appear in on-disk YAML");

  // Write B: same active_feature, both fields intentionally omitted.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "rt1-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["qa: reviewing"],
    lastAgent: "qa-engineer",
    // dispatchMechanism / dispatchMechanismTier intentionally omitted.
  });
  resetSession();
  const stateB = parseHandoff(ws);
  assert.equal(stateB.dispatch_mechanism, undefined, "an omitting write on the SAME feature must drop dispatch_mechanism — TRANSIENT, never blindly preserved");
  assert.equal(stateB.dispatch_mechanism_tier, undefined, "an omitting write on the SAME feature must drop dispatch_mechanism_tier — TRANSIENT, never blindly preserved");
  assert.doesNotMatch(readRaw(ws), /dispatch_mechanism:/, "the key must not even appear on disk once dropped (emit-only-when-set)");
  assert.doesNotMatch(readRaw(ws), /dispatch_mechanism_tier:/, "the tier key must not even appear on disk once dropped");
});

test("RT1b: a tier-only write (no dispatch_mechanism) persists the tier alone — the two fields are independent, each emitted iff supplied on THIS write", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "rt1b-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
    dispatchMechanismTier: "opus",
    // dispatchMechanism intentionally omitted.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_mechanism, undefined, "dispatch_mechanism must stay absent when this write never set it");
  assert.equal(state.dispatch_mechanism_tier, "opus", "dispatch_mechanism_tier must persist independently of dispatch_mechanism");
});

test("RT2: a real tw_update_state write through the orchestrator round-trips dispatch_mechanism/dispatch_mechanism_tier via tw_get_state-equivalent read", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: "rt2-feat",
    status: "In_Progress",
    agent_id: "pm", // fresh workspace: null -> pm:In_Progress is a legal starting transition
    completed_tasks: [],
    pending_notes: [],
    dispatch_mechanism: "switch_role",
    dispatch_mechanism_tier: "sonnet",
  });
  assert.ok(!res.isError, `a write carrying valid dispatch_mechanism/dispatch_mechanism_tier must be accepted: ${res.content?.[0]?.text}`);

  const getState = JSON.parse(readHandoffState(ws));
  assert.equal(getState.dispatch_mechanism, "switch_role", "tw_get_state-equivalent read must surface dispatch_mechanism");
  assert.equal(getState.dispatch_mechanism_tier, "sonnet", "tw_get_state-equivalent read must surface dispatch_mechanism_tier");
});

// ============================================================================
// AC3 — zod boundary: dispatch_mechanism is a closed 3-value enum, rejected
// BEFORE the handler runs. dispatch_mechanism_tier is bounded free text
// (max 40), not a closed enum (the dispatch_pins value precedent).
// ============================================================================

test("Z1: tw_update_state rejects an out-of-enum dispatch_mechanism value at the zod boundary", async () => {
  assert.ok(UPDATE_STATE_ENTRY, "tw_update_state must be registered in TOOL_REGISTRY");
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_mechanism: "bogus",
      });
    },
    /ZodError|invalid_enum_value|invalid_value/i,
    "an out-of-enum dispatch_mechanism (not task|switch_role|inline) must be rejected by zod before any gate/handler logic runs",
  );
});

test("Z2: tw_update_state rejects a >40-char dispatch_mechanism_tier at the zod boundary", async () => {
  const oversized = "x".repeat(41);
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        dispatch_mechanism_tier: oversized,
      });
    },
    /ZodError|too_big/i,
    "a dispatch_mechanism_tier over 40 chars must be rejected by zod (max length 40)",
  );
});

test("Z3: tw_update_state ACCEPTS each of the 3 legal dispatch_mechanism values plus an arbitrary (non-enum) tier string — positive control", async () => {
  setActiveStorage(new FileHandoffStorage());
  for (const mechanism of ["task", "switch_role", "inline"]) {
    const ws = mkWs();
    resetSession(ws);
    markStateRead(ws);
    const res = await UPDATE_STATE_ENTRY.run({
      workspace_path: ws,
      active_feature: "z3-feat",
      status: "In_Progress",
      agent_id: "pm",
      completed_tasks: [],
      pending_notes: [],
      dispatch_mechanism: mechanism,
      dispatch_mechanism_tier: "some-arbitrary-tier-name", // NOT validated against a model vocabulary
    });
    assert.ok(!res.isError, `dispatch_mechanism: "${mechanism}" must be accepted: ${res.content?.[0]?.text}`);
    resetSession(ws);
    const state = parseHandoff(ws);
    assert.equal(state.dispatch_mechanism, mechanism, `dispatch_mechanism "${mechanism}" must round-trip verbatim`);
    assert.equal(state.dispatch_mechanism_tier, "some-arbitrary-tier-name", "an arbitrary tier string (not a known model name) must be accepted — the model vocabulary is not owned by this server");
  }
});

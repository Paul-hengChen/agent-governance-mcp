// Coded by @qa-engineer
// Tests for specs/v3.15.0.md — AC-6..AC-10.
// Asserts the writeHandoffState dual API:
//   - options-object overload produces identical handoff state as positional
//   - positional signature still works (backwards-compat)
//   - default values for omitted fields match historical behaviour
//   - @deprecated JSDoc tag present on the positional overload

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseHandoff,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { FileHandoffStorage } from "../dist/tools/storage.js";
import { resetSession } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "wsoo-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Reads handoff.md raw and blanks the last_updated timestamp (the ONE field
// that legitimately differs call-to-call — everything else, including field
// ORDER in the YAML frontmatter, must match byte-for-byte if the positional
// adapter packs args in the exact same order as the options-object caller).
function readNormalized(ws) {
  const p = path.join(ws, ".current", "handoff.md");
  const raw = fs.readFileSync(p, "utf-8");
  return raw.replace(/last_updated: "[^"]*"/, 'last_updated: "<TS>"');
}

// ---------- AC-6 — options-object overload ----------

test("AC-6: writeHandoffState({...options}) writes equivalent state to positional call", async () => {
  // Why: dual API requires that both call shapes produce the SAME on-disk
  // result. A divergence would make migration unsafe.
  const ws1 = mkWorkspace();
  const ws2 = mkWorkspace();
  resetSession();
  parseHandoff(ws1);
  await writeHandoffState({
    workspacePath: ws1,
    activeFeature: "feat-a",
    status: "In_Progress",
    completedTasks: ["T01"],
    pendingNotes: ["next_role: sr-engineer"],
    lastAgent: "pm",
    qaRound: 0,
    reviewRound: 0,
    visualRound: 0,
  });

  resetSession();
  parseHandoff(ws2);
  await writeHandoffState(
    ws2, "feat-a", "In_Progress", ["T01"], ["next_role: sr-engineer"],
    undefined, "pm", 0, undefined, 0, 0,
  );

  const s1 = parseHandoff(ws1);
  const s2 = parseHandoff(ws2);
  // Both writes must produce semantically identical state (modulo last_updated timestamp).
  assert.equal(s1.active_feature, s2.active_feature);
  assert.equal(s1.status, s2.status);
  assert.deepEqual(s1.completed_tasks, s2.completed_tasks);
  assert.deepEqual(s1.pending_notes, s2.pending_notes);
  assert.equal(s1.last_agent, s2.last_agent);
  assert.equal(s1.qa_round, s2.qa_round);
  assert.equal(s1.review_round, s2.review_round);
  assert.equal(s1.visual_round, s2.visual_round);
});

test("AC-6: options-object accepts all fields and persists them", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feat-full",
    status: "FAIL",
    completedTasks: ["T01", "T02"],
    pendingNotes: ["visual_fail: pixel", "next_role: sr-engineer"],
    blockingReason: "QA found visual drift",
    lastAgent: "qa-engineer",
    qaRound: 1,
    prdPath: undefined,
    reviewRound: 2,
    visualRound: 3,
  });
  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "feat-full");
  assert.equal(state.status, "FAIL");
  assert.equal(state.blocking_reason, "QA found visual drift");
  assert.equal(state.last_agent, "qa-engineer");
  assert.equal(state.qa_round, 1);
  assert.equal(state.review_round, 2);
  assert.equal(state.visual_round, 3);
  assert.deepEqual(state.completed_tasks, ["T01", "T02"]);
});

// ---------- AC-7 — interface support both call shapes ----------
// (Indirectly tested via FileHandoffStorage / SqliteHandoffStorage integration
// in the existing storage tests; the storage.ts interface compiles cleanly
// is asserted by `npm run build`.)

// ---------- AC-8 — index.ts handler uses options-object form ----------

test("AC-8: dist/tools/handoff-orchestrator.js source contains the options-object call site (no positional regression)", () => {
  // Why: the handler MUST use the new form per AC-8. A regression to the
  // positional 11-arg form would mean the dual API isn't being dogfooded.
  // Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
  // body (including this storage.writeState call site) compiles into
  // dist/tools/handoff-orchestrator.js, not dist/index.js.
  const compiledIndex = fs.readFileSync(path.join(PROJECT_ROOT, "dist", "tools", "handoff-orchestrator.js"), "utf-8");
  // The new call site sets the `workspacePath:` named key.
  assert.match(
    compiledIndex,
    /storage\.writeState\(\s*\{[\s\S]*?workspacePath:/,
    "compiled dist/tools/handoff-orchestrator.js must call storage.writeState with an options object",
  );
});

// ---------- AC-9 — @deprecated JSDoc present ----------

test("AC-9: @deprecated JSDoc present on positional writeHandoffState signature", () => {
  // Why: the deprecation tag is the only mechanism by which a caller learns
  // of the migration. If it's missing or the body is wrong, users won't know
  // to migrate before v4.0.0.
  const handoffTs = fs.readFileSync(
    path.join(PROJECT_ROOT, "tools", "handoff.ts"),
    "utf-8",
  );
  assert.match(handoffTs, /@deprecated v3\.15\.0:/, "JSDoc @deprecated tag must reference v3.15.0");
  assert.match(handoffTs, /options-object overload/i, "deprecation hint must point to options-object");
  assert.match(handoffTs, /removal in v4\.0\.0/i, "deprecation hint must announce v4.0.0 removal");
});

test("AC-9: @deprecated tag also present on HandoffStorage interface positional overload", () => {
  const storageTs = fs.readFileSync(
    path.join(PROJECT_ROOT, "tools", "storage.ts"),
    "utf-8",
  );
  assert.match(storageTs, /@deprecated v3\.15\.0:/, "interface @deprecated tag must reference v3.15.0");
});

// ---------- AC-10 — backwards-compat defaults ----------

test("AC-10: positional writeHandoffState with 8 args (pre-v3.9.0 baseline) defaults round counters to 0", async () => {
  // Why: a caller from the pre-v3.9.0 era passing only the first 8 args
  // (workspace, feat, status, completed, pending, blockingReason, lastAgent,
  // qaRound) must still produce a valid handoff with review_round=0,
  // visual_round=0 stamped by defaults.
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(
    ws, "feat-old", "In_Progress", [], [],
    undefined, "pm", 0,
  );
  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 0);
  assert.equal(state.review_round, 0, "review_round MUST default to 0");
  assert.equal(state.visual_round, 0, "visual_round MUST default to 0");
});

test("AC-10: options-object with omitted optional fields defaults to historical defaults", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feat-min",
    status: "In_Progress",
  });
  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 0);
  assert.equal(state.review_round, 0);
  assert.equal(state.visual_round, 0);
  assert.deepEqual(state.completed_tasks, []);
  // Empty pending_notes → file emits "- (none)" sentinel; parser drops it
  assert.deepEqual(state.pending_notes, []);
});

// ---------- E36 — thin-adapter delegation parity (handoff-write.ts) ----------
//
// E36 converged writeHandoffState's positional overload onto a thin arg-
// packing adapter over writeHandoffStateCore(opts). These tests pin that
// convergence at the byte level: a positional-form call covering the FULL
// legacy 12-positional arg list (including all three round counters, which
// occupy adjacent, easily-transposed slots — qaRound at index 8, reviewRound
// at index 10, visualRound at index 11 — plus blockingReason and prdPath)
// must produce output byte-identical to the equivalent options-object call.
// A future edit that swaps, drops, or renames a field while re-packing the
// adapter's positional args will fail this test even if every individual
// field's VALUE still round-trips correctly in isolation (which the AC-6/
// AC-10 tests above would not catch, since they compare parsed fields, not
// argument-POSITION-to-field mapping).

test("E36: positional writeHandoffState (full 12-arg form, all 3 round counters + blockingReason + prdPath) is byte-identical to the equivalent options-object call", async () => {
  const wsPositional = mkWorkspace();
  const wsOptions = mkWorkspace();

  resetSession();
  parseHandoff(wsPositional);
  await writeHandoffState(
    wsPositional,                    // workspacePath
    "feat-e36-adapter",              // activeFeature
    "In_Progress",                   // status
    ["T01", "T02"],                  // completedTasks
    ["note-one", "note-two"],        // pendingNotes
    "blocked for review",            // blockingReason
    "sr-engineer",                   // lastAgent
    2,                                // qaRound
    "/abs/path/to/prd.md",           // prdPath
    3,                                // reviewRound
    4,                                // visualRound
    5,                                // hopCount
  );

  resetSession();
  parseHandoff(wsOptions);
  await writeHandoffState({
    workspacePath: wsOptions,
    activeFeature: "feat-e36-adapter",
    status: "In_Progress",
    completedTasks: ["T01", "T02"],
    pendingNotes: ["note-one", "note-two"],
    blockingReason: "blocked for review",
    lastAgent: "sr-engineer",
    qaRound: 2,
    prdPath: "/abs/path/to/prd.md",
    reviewRound: 3,
    visualRound: 4,
    hopCount: 5,
  });

  assert.equal(
    readNormalized(wsPositional),
    readNormalized(wsOptions),
    "positional and options-object writeHandoffState calls must produce byte-identical handoff.md (modulo last_updated)",
  );

  // Belt-and-suspenders: confirm the three round counters landed in their
  // OWN distinct slots (not silently swapped with each other in a way that
  // happened to also match between both calls, e.g. if BOTH call sites were
  // wrong identically — the whole-file byte-compare above only proves the
  // two call shapes AGREE, not that either is correct against the historical
  // positional signature order).
  const state = parseHandoff(wsPositional);
  assert.equal(state.qa_round, 2);
  assert.equal(state.review_round, 3);
  assert.equal(state.visual_round, 4);
  assert.equal(state.blocking_reason, "blocked for review");
  assert.equal(state.prd_path, "/abs/path/to/prd.md");
});

// ---------- E36 — thin-adapter delegation parity (storage.ts FileHandoffStorage) ----------
//
// storage.ts's FileHandoffStorage.writeState carries its OWN independent
// positional→options packing (it does not simply forward raw positional args
// to tools/handoff-write.ts's adapter — it packs its own options object and
// always calls writeHandoffState's options-object overload directly). That
// makes it a second, separate site where an arg-order regression could be
// introduced without the handoff-write.ts test above catching it. Note:
// unlike the 12-positional writeHandoffState signature, FileHandoffStorage's
// positional overload stops at visualRound (11 args, no hopCount) — this
// matches the pre-E36 forward-declared HandoffStorage interface.

test("E36: FileHandoffStorage.writeState positional (full 11-arg form, all 3 round counters + blockingReason + prdPath) is byte-identical to the equivalent options-object call", async () => {
  const wsPositional = mkWorkspace();
  const wsOptions = mkWorkspace();
  const storage = new FileHandoffStorage();

  resetSession();
  parseHandoff(wsPositional);
  await storage.writeState(
    wsPositional,                    // workspacePath
    "feat-e36-storage-adapter",      // activeFeature
    "FAIL",                          // status
    ["T03"],                         // completedTasks
    ["note-three"],                  // pendingNotes
    "storage-level blocking reason", // blockingReason
    "qa-engineer",                   // lastAgent
    6,                                // qaRound
    "/abs/path/to/other-prd.md",     // prdPath
    7,                                // reviewRound
    8,                                // visualRound
  );

  resetSession();
  parseHandoff(wsOptions);
  await storage.writeState({
    workspacePath: wsOptions,
    activeFeature: "feat-e36-storage-adapter",
    status: "FAIL",
    completedTasks: ["T03"],
    pendingNotes: ["note-three"],
    blockingReason: "storage-level blocking reason",
    lastAgent: "qa-engineer",
    qaRound: 6,
    prdPath: "/abs/path/to/other-prd.md",
    reviewRound: 7,
    visualRound: 8,
  });

  assert.equal(
    readNormalized(wsPositional),
    readNormalized(wsOptions),
    "FileHandoffStorage.writeState positional and options-object calls must produce byte-identical handoff.md (modulo last_updated)",
  );

  const state = parseHandoff(wsPositional);
  assert.equal(state.qa_round, 6);
  assert.equal(state.review_round, 7);
  assert.equal(state.visual_round, 8);
  assert.equal(state.blocking_reason, "storage-level blocking reason");
  assert.equal(state.prd_path, "/abs/path/to/other-prd.md");
});

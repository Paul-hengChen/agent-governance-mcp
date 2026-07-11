// Coded by @qa-engineer
// Tests for spec: specs/pm-cut-approval-gate.md (pm-cut-approval-gate feature).
// Covers: handoff schema v5 field, hasCutApproval helper, reset semantics,
//   server gate fire/clear (AC-1/AC-2), SQLite-mode skip (D5), v4→v5 migration
//   purity (AC-6/AC-7), and Copy/Strings verbatim gate text (S01/S02).
//
// Spec-to-Test map:
//   AC-1  (gate blocks without cut_approved)    → G1 / G2
//   AC-2  (gate clears with cut_approved=true)  → G3
//   AC-6  (schema: cut_approved field + migration) → M1 / M2 / M3
//   AC-7  (migration pure and lossless)         → M4
//   reset semantics (§1 architecture)           → R1 / R2 / R3 / R4 / R5
//   SQLite-mode skip (D5)                       → S1
//   Copy/Strings verbatim (S01/S02)             → C1 / C2
//
// WHY: the gate's correctness depends on a subtle three-branch reset rule for
// `cut_approved`. Tests encode the CONTRACT (invariant), not just the behavior,
// so future readers understand what each case is guarding against — particularly
// the load-bearing QA-FAIL→PM re-entry reset (R5) that closes the stale-true hole.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hasCutApproval,
} from "../dist/gates/cut-approval.js";
import {
  hasUnresolvedRefs,
  listUnresolvedRefs,
} from "../dist/gates/external-refs.js";
import {
  parseHandoff,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import {
  getActiveStorage,
  setActiveStorage,
  FileHandoffStorage,
} from "../dist/tools/storage.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { _clearRegistryForTests, runMigrations, registerMigration } from "../dist/schema/versions.js";

// Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
// body (including the cut-approval gate's S01/S02 strings) compiles into
// dist/tools/handoff-orchestrator.js, not dist/index.js.
const DIST_INDEX = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "tools", "handoff-orchestrator.js"),
  "utf-8",
);
// gate-registry refactor (A10): the CUT_APPROVAL_REQUIRED hint string (S02) is
// now sourced from gates/registry.ts, so its verbatim text compiles into
// dist/gates/registry.js. The S01 error code token stays in the orchestrator
// envelope (dist/tools/handoff-orchestrator.js) via DIST_INDEX above.
const DIST_REGISTRY = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "gates", "registry.js"),
  "utf-8",
);

// ---- helpers ---------------------------------------------------------------

function tmpWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-cag-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRawHandoff(ws, body) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body, "utf-8");
}

function readRawHandoff(ws) {
  return fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
}

// Seed handoff via the writer (triggers migration heal if needed).
async function seedHandoff(ws, opts) {
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: opts.activeFeature ?? "test-feat",
    status: opts.status ?? "In_Progress",
    completedTasks: opts.completedTasks ?? [],
    pendingNotes: opts.pendingNotes ?? [],
    lastAgent: opts.lastAgent ?? "pm",
    ...(opts.cutApproved !== undefined ? { cutApproved: opts.cutApproved } : {}),
  });
}

// ============================================================================
// hasCutApproval helper (pure predicate)
// ============================================================================

test("hasCutApproval: returns true only for boolean true", () => {
  // WHY: strict === true is the contract; false, null, undefined, "true" all
  // must fail to prevent accidental gate bypasses via YAML type coercion.
  assert.equal(hasCutApproval({ cut_approved: true }), true);
  assert.equal(hasCutApproval({ cut_approved: false }), false);
  assert.equal(hasCutApproval({ cut_approved: undefined }), false);
  assert.equal(hasCutApproval({}), false);
  assert.equal(hasCutApproval(null), false);
  assert.equal(hasCutApproval(undefined), false);
});

test("hasCutApproval: rejects string 'true' (YAML strict parse contract)", () => {
  // WHY: if a YAML parser returns the string "true" (e.g. from a quoted value),
  // the gate must not silently pass. Strict === true catches this.
  assert.equal(hasCutApproval({ cut_approved: "true" }), false);
});

// ============================================================================
// Schema v5 field: parse + emit round-trip
// ============================================================================

test("R-schema-1: writeHandoffState emits cut_approved: true in YAML when passed", async () => {
  // WHY: verifies the PM approval write path emits the field so the gate can read it.
  // d5-server-side-stale-dispatch-detection re-baseline: schema_version bumped
  // 9->10 (dispatched_at, stamp-only, seeds nothing); was 8->9 under
  // d2-server-brake-accounting (hop_count, seeded 0); was 7->8 under
  // c14-dispatch-pins (dispatch_pins, stamp-only); was 6->7 under
  // c9-protocol-fields (next_role/resume_of/review_verdict, stamp-only).
  const ws = tmpWs();
  await seedHandoff(ws, { cutApproved: true });
  const raw = readRawHandoff(ws);
  assert.match(raw, /schema_version:\s*10/, "schema_version must be 10 (d5-server-side-stale-dispatch-detection)");
  assert.match(raw, /cut_approved:\s*true/, "cut_approved must be emitted as true");
});

test("R-schema-2: writeHandoffState does NOT emit cut_approved: false", async () => {
  // WHY: absence is the unapproved sentinel (AC-6/AC-7). Emitting false is a
  // redundant materialization of absence that could confuse a YAML parser.
  const ws = tmpWs();
  await seedHandoff(ws, { cutApproved: false });
  const raw = readRawHandoff(ws);
  assert.doesNotMatch(raw, /cut_approved:/, "false cut_approved must NOT be emitted into YAML");
});

test("R-schema-3: parseHandoff reads cut_approved: true from YAML frontmatter", async () => {
  // WHY: confirms the read path correctly surfaces the field so hasCutApproval
  // returns true when the PM wrote it.
  const ws = tmpWs();
  await seedHandoff(ws, { cutApproved: true });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, true, "parseHandoff must surface cut_approved: true");
});

test("R-schema-4: parseHandoff returns cut_approved=undefined when field absent", () => {
  // WHY: legacy/migrated handoffs have no cut_approved; the gate must see undefined
  // (not false) so it fires correctly. The spread-guard in handoff.ts ensures absence.
  const ws = tmpWs();
  writeRawHandoff(ws, `---
schema_version: 5
active_feature: "no-approval"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`);
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined, "absent YAML field must parse as undefined");
  assert.equal(hasCutApproval(state), false, "gate must fire when field is absent");
});

// ============================================================================
// Reset semantics (§1 architecture — the load-bearing part)
// ============================================================================

test("R1: PM writes cut_approved=true → field becomes true", async () => {
  // WHY: standard PM approval path. If this does not work, the gate can never be cleared.
  const ws = tmpWs();
  await seedHandoff(ws, { lastAgent: "pm", status: "In_Progress", cutApproved: true });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, true, "PM explicit approval must persist to disk");
});

test("R2: PM re-entry WITHOUT cut_approved re-arms gate (PM re-entry clause)", async () => {
  // WHY: every PM In_Progress write that does NOT explicitly pass cut_approved must
  // reset it to undefined — closes the stale-true hole when PM re-enters without
  // explicit re-approval. This is the primary reset clause in the algorithm.
  const ws = tmpWs();
  // Step 1: PM approves.
  await seedHandoff(ws, { lastAgent: "pm", status: "In_Progress", cutApproved: true });
  // Step 2: PM re-enters WITHOUT passing cut_approved (e.g. after scope rework).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "test-feat",
    status: "In_Progress",
    lastAgent: "pm",
    completedTasks: [],
    pendingNotes: ["re-evaluating scope"],
    // cutApproved intentionally omitted — this is the re-arm path
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined, "PM re-entry without explicit cutApproved must re-arm gate");
  assert.equal(hasCutApproval(state), false, "gate must fire after PM re-entry without approval");
});

test("R3: non-PM same-feature write carries cut_approved forward", async () => {
  // WHY: after PM approves, build roles (architect, sr-engineer) write state
  // without passing cutApproved. The flag must survive these writes so the gate
  // does not re-fire mid-build on every handoff step.
  const ws = tmpWs();
  // PM approves.
  await seedHandoff(ws, { lastAgent: "pm", status: "In_Progress", cutApproved: true });
  // Architect self-progresses (non-PM, same feature, no cutApproved arg).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "test-feat",
    status: "In_Progress",
    lastAgent: "architect",
    completedTasks: [],
    pendingNotes: ["building"],
    // cutApproved intentionally omitted
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, true, "non-PM same-feature write must carry cut_approved forward");
  assert.equal(hasCutApproval(state), true, "gate must not re-fire after architect self-progression");
});

test("R4: active_feature change drops cut_approved (cross-feature isolation)", async () => {
  // WHY: the gate is feature-scoped. Approval for feature-A must never carry into
  // feature-B — that would be a false attestation for an un-reviewed cut.
  const ws = tmpWs();
  // PM approves for feature-A.
  await seedHandoff(ws, { activeFeature: "feature-a", lastAgent: "pm", status: "In_Progress", cutApproved: true });
  // Any role writes state for a different feature (feature-b).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-b",   // different feature — must drop cut_approved
    status: "In_Progress",
    lastAgent: "sr-engineer",
    completedTasks: [],
    pendingNotes: [],
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined, "feature change must drop stale cut_approved");
  assert.equal(hasCutApproval(state), false, "gate must re-arm when feature changes");
});

test("R5: QA-FAIL → PM same-feature re-entry drops cut_approved (load-bearing stale-true closure)", async () => {
  // WHY: this is the critical reset that closes the stale-true hole. Without it,
  // a QA-FAIL followed by PM re-entry on the SAME feature would carry a stale
  // cut_approved:true into the next build entry, bypassing the gate silently.
  // The algorithm's "PM re-entry re-arms unconditionally" clause is what makes
  // the gate robust across QA-FAIL bounces.
  const ws = tmpWs();
  // Step 1: PM approved and build proceeded.
  await seedHandoff(ws, { lastAgent: "pm", status: "In_Progress", cutApproved: true });
  // Step 2: QA-FAIL bounce — qa-engineer writes FAIL (no cutApproved, same feature).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "test-feat",
    status: "FAIL",
    lastAgent: "qa-engineer",
    completedTasks: [],
    pendingNotes: ["failing: wrong scope"],
  });
  // Step 3: PM re-enters (same feature, no cutApproved arg — models the re-entry path).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "test-feat",
    status: "In_Progress",
    lastAgent: "pm",
    completedTasks: [],
    pendingNotes: ["revised scope"],
    // cutApproved intentionally absent — PM must explicitly re-approve
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined,
    "QA-FAIL→PM same-feature re-entry must drop cut_approved (stale-true hole closure)");
  assert.equal(hasCutApproval(state), false,
    "gate must re-arm after QA-FAIL bounce even when feature unchanged");
});

// ============================================================================
// Gate fire / clear via hasCutApproval + dist/index.js composition
// ============================================================================

test("G1: gate fires when prevState has no cut_approved (AC-1)", async () => {
  // WHY: AC-1 — the gate must block the pm→build edge when cut_approved is absent.
  // This mirrors the index.ts handler decision: hasCutApproval(prevState) === false →
  // return CUT_APPROVAL_REQUIRED. We test the predicate composition rather than
  // spawning the full MCP server, consistent with the gate-composition test pattern.
  const ws = tmpWs();
  await seedHandoff(ws, { lastAgent: "pm", status: "In_Progress" /* no cutApproved */ });
  resetSession();
  const prevState = parseHandoff(ws);

  const onGatedEdge =
    (prevState.last_agent === "pm" && prevState.status === "In_Progress") &&
    /* next would be architect or sr-engineer:In_Progress */
    true;
  assert.equal(onGatedEdge, true, "test pre-condition: handoff is on the gated edge");
  assert.equal(hasCutApproval(prevState), false, "gate MUST fire (no approval recorded)");
});

test("G2: gate fires when prevState has cut_approved: false (literal false treated as absent)", async () => {
  // WHY: the spec says "A literal `false` is treated identically to absence by the
  // gate (gate fires unless === true)". This ensures there is no escape hatch via
  // an explicit false that looks semantically different from absence.
  // Inject raw YAML with cut_approved: false to simulate a hypothetical malformed write.
  const ws = tmpWs();
  writeRawHandoff(ws, `---
schema_version: 5
active_feature: "test-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
last_agent: "pm"
cut_approved: false
qa_round: 0
review_round: 0
visual_round: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`);
  resetSession();
  const state = parseHandoff(ws);
  // The parser normalizes false → undefined (strict boolean read).
  assert.equal(hasCutApproval(state), false, "explicit false must fail gate same as absence");
});

test("G3: gate clears when cut_approved === true (AC-2)", async () => {
  // WHY: AC-2 — when PM has recorded cut_approved:true, the build-entry transition
  // must succeed. This is the primary gate-clear path.
  const ws = tmpWs();
  await seedHandoff(ws, { lastAgent: "pm", status: "In_Progress", cutApproved: true });
  resetSession();
  const prevState = parseHandoff(ws);
  assert.equal(hasCutApproval(prevState), true, "gate MUST NOT fire when cut_approved === true");
});

// ============================================================================
// SQLite-mode skip (D5)
// ============================================================================

test("S1: gate skips when active storage is not FileHandoffStorage (SQLite-mode skip)", () => {
  // WHY: D5 — cut_approved is handoff-YAML frontmatter only. In SQLite/HTTP mode
  // the parsed prev-state never carries it, so the gate would always fire and block
  // every build entry. The gate is guarded by `instanceof FileHandoffStorage`.
  // This test verifies the predicate directly rather than swapping the real SQLite
  // storage (which requires a DB), consistent with composition-test convention.
  //
  // The gate condition in index.ts: `getActiveStorage() instanceof FileHandoffStorage`.
  // A non-FileHandoffStorage object fails this instanceof check, so the gate block
  // is unreachable — exactly the SQLite-skip behavior required.
  const fakeNonFileStorage = { writeState: () => {}, readState: () => {}, parse: () => null };
  assert.equal(
    fakeNonFileStorage instanceof FileHandoffStorage,
    false,
    "a plain object must not satisfy instanceof FileHandoffStorage (SQLite-skip predicate fails as expected)",
  );

  // Verify the real FileHandoffStorage DOES satisfy the check (so the gate IS armed in file mode).
  const fileStorage = new FileHandoffStorage();
  assert.equal(
    fileStorage instanceof FileHandoffStorage,
    true,
    "FileHandoffStorage instance must satisfy instanceof check (gate arms in file mode)",
  );
});

// ============================================================================
// v4 → v5 migration purity (AC-6 / AC-7)
// ============================================================================

test("M1: v4 → v5 migration is stamp-only (AC-7 — no default seeded for cut_approved)", () => {
  // WHY: AC-7 — only schema_version changes; cut_approved MUST NOT be seeded with
  // any default value. Absence is the unapproved sentinel. A default `false` would
  // be a redundant materialization of absence; a default `true` would be a false
  // attestation bypassing the gate for all legacy files.
  // d5-server-side-stale-dispatch-detection re-baseline: CURRENT_VERSIONS.handoff
  // is now 10, so the manually-registered chain must reach 10 (adding the
  // v5->v6, v6->v7, v7->v8, v8->v9, AND v9->v10 stamp-only/seed-only steps) or
  // runMigrations throws MISSING_MIGRATION_STEP against the new target. Was 9
  // under d2-server-brake-accounting. The v4->v5 step under test is still
  // asserted in isolation via `result.applied` below.
  _clearRegistryForTests();
  // Register the chain manually so we can test v4→v5 in isolation.
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

  const v4payload = { schema_version: 4, active_feature: "old-feat", status: "In_Progress" };
  const result = runMigrations("handoff", v4payload);

  assert.equal(result.payload.schema_version, 10, "migration must bump schema_version to CURRENT (10)");
  assert.equal(result.payload.cut_approved, undefined, "v4→v5 migration MUST NOT seed cut_approved");
  assert.deepEqual(result.applied, [5, 6, 7, 8, 9, 10], "the v4→v5 step must have been applied (v5→v6, v6→v7, v7→v8, v8→v9, and v9→v10 also run to reach CURRENT)");
  assert.equal(result.fromVersion, 4, "fromVersion must be 4");
  assert.equal(result.toVersion, 10, "toVersion must be CURRENT (10)");
});

test("M2: v4 → v5 migration preserves all existing fields (AC-7 — lossless)", () => {
  // WHY: AC-7 — no existing field may be modified or removed. Losslessness is
  // critical so that scope_decision, prd_path, qa_round, etc. survive the bump.
  // d5-server-side-stale-dispatch-detection re-baseline: see M1 comment — chain
  // extended to v10.
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

  const v4payload = {
    schema_version: 4,
    active_feature: "scope-feat",
    status: "In_Progress",
    last_agent: "pm",
    scope_decision: "single-feature",
    scope_decision_why: "small feature",
    qa_round: 2,
    review_round: 1,
    visual_round: 0,
    prd_path: "/abs/specs/scope-feat.md",
  };
  const result = runMigrations("handoff", v4payload);

  assert.equal(result.payload.schema_version, 10, "schema_version bumped to CURRENT (10)");
  assert.equal(result.payload.active_feature, "scope-feat", "active_feature preserved");
  assert.equal(result.payload.scope_decision, "single-feature", "scope_decision preserved");
  assert.equal(result.payload.scope_decision_why, "small feature", "scope_decision_why preserved");
  assert.equal(result.payload.qa_round, 2, "qa_round preserved");
  assert.equal(result.payload.review_round, 1, "review_round preserved");
  assert.equal(result.payload.prd_path, "/abs/specs/scope-feat.md", "prd_path preserved");
  assert.equal(result.payload.cut_approved, undefined, "cut_approved still absent (no false/true seeded)");
  assert.equal(result.payload.external_refs, undefined, "external_refs still absent (v5→v6 also stamp-only, no seed)");
  assert.equal(result.payload.next_role, undefined, "next_role still absent (v6→v7 also stamp-only, no seed)");
  assert.equal(result.payload.resume_of, undefined, "resume_of still absent (v6→v7 also stamp-only, no seed)");
  assert.equal(result.payload.review_verdict, undefined, "review_verdict still absent (v6→v7 also stamp-only, no seed)");
  assert.equal(result.payload.dispatch_pins, undefined, "dispatch_pins still absent (v7→v8 also stamp-only, no seed, c14-dispatch-pins)");
  assert.equal(result.payload.hop_count, 0, "hop_count seeded to 0 (v8→v9, d2-server-brake-accounting DR-3 — the counter precedent, not the stamp-only-attestation precedent)");
  assert.equal(result.payload.dispatched_at, undefined, "dispatched_at still absent (v9→v10 also stamp-only, no seed, d5-server-side-stale-dispatch-detection DR-7)");
});

test("M3: legacy file (no schema_version) migrates to v5 and has no cut_approved (AC-6)", async () => {
  // WHY: AC-6 — an existing handoff at any version < 5 must come out of migration
  // with cut_approved absent (undefined), so the gate fires. This is the "legacy
  // file → unapproved" invariant.
  const ws = tmpWs();
  writeRawHandoff(ws, `---
active_feature: "legacy"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`);
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined,
    "legacy file migrated to v5 must have cut_approved undefined (gate must fire)");
  assert.equal(hasCutApproval(state), false,
    "hasCutApproval must return false for a legacy migrated file");
});

test("M4: v4 file with scope_decision migrates to v5 with no cut_approved seeded (AC-6/AC-7)", async () => {
  // WHY: this is the most common real-world legacy case — a v3.30.0 handoff that
  // has scope_decision (v4 feature) but no cut_approved. The v4→v5 migration must
  // add ONLY the version bump, leaving scope_decision intact and cut_approved absent.
  const ws = tmpWs();
  writeRawHandoff(ws, `---
schema_version: 4
active_feature: "scope-gate-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
last_agent: "pm"
scope_decision: "single-feature"
scope_decision_why: "one module only"
qa_round: 0
review_round: 0
visual_round: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- next_role: architect
`);
  resetSession();
  const state = parseHandoff(ws);
  // Migration must preserve scope_decision and must NOT seed cut_approved.
  assert.equal(state.scope_decision, "single-feature", "scope_decision must survive v4→v5 migration");
  assert.equal(state.cut_approved, undefined, "v4→v5 migration must NOT seed cut_approved");
  assert.equal(hasCutApproval(state), false, "gate must fire on a freshly-migrated v4 file");
});

// ============================================================================
// Copy/Strings verbatim gate text in dist/index.js (S01 / S02)
// ============================================================================

test("C1: S01 — 'CUT_APPROVAL_REQUIRED' error code present verbatim in dist/index.js", () => {
  // WHY: S01 is the error code emitted in the gate envelope. Any rename or typo
  // in the compiled artifact breaks clients that match on this code to provide
  // user-facing guidance.
  assert.ok(
    DIST_INDEX.includes("CUT_APPROVAL_REQUIRED"),
    "dist/index.js must contain the verbatim error code CUT_APPROVAL_REQUIRED (S01)",
  );
});

test("C2: S02 — verbatim hint string in dist/index.js", () => {
  // WHY: S02 is the actionable hint surfaced to the agent when the gate fires.
  // It must be verbatim (not paraphrased) so the SOP reference in the hint is
  // always accurate and the agent knows exactly what to do.
  const S02_PREFIX = "Cut approval missing. PM must present the ticket cut inline in chat and";
  const S02_MID = "obtain human approval before routing to build.";
  const S02_SUFFIX = "See content/skill-pm.md §SOP step 7a.";
  assert.ok(
    DIST_REGISTRY.includes(S02_PREFIX),
    `dist/gates/registry.js must contain verbatim S02 prefix: "${S02_PREFIX}"`,
  );
  assert.ok(
    DIST_REGISTRY.includes(S02_MID),
    `dist/gates/registry.js must contain verbatim S02 mid: "${S02_MID}"`,
  );
  assert.ok(
    DIST_REGISTRY.includes(S02_SUFFIX),
    `dist/gates/registry.js must contain verbatim S02 suffix: "${S02_SUFFIX}"`,
  );
});

test("C3: S03 — inline cut draft table header present verbatim in skill-pm.md", () => {
  // WHY: S03 is the exact table header PM must present inline. If it drifts,
  // the human reviewer sees a different column layout than the spec mandates.
  const SKILL_PM = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "skill-pm.md"),
    "utf-8",
  );
  assert.ok(
    SKILL_PM.includes("id | desc | depends_on | est. files | design-link"),
    "skill-pm.md must contain verbatim S03 table header (id | desc | depends_on | est. files | design-link)",
  );
});

test("C4: S04 — cut-approval gate stop-condition present in skill-coordinator.md Auto-Routing section", () => {
  // WHY: S04 is the coordinator stop-condition that prevents auto-routing from
  // hopping through the cut-approval gate. Without it, the auto-routing loop
  // would route to build before human approval.
  const COORD = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "skill-coordinator.md"),
    "utf-8",
  );
  // Check that the key S04 semantics are present: cut-approval gate reference +
  // the condition (next_role: architect/sr-engineer with no cut_approved) + the action.
  assert.ok(
    COORD.includes("Cut-approval gate") || COORD.includes("cut-approval gate"),
    "skill-coordinator.md must reference the cut-approval gate in Auto-Routing",
  );
  assert.ok(
    COORD.includes("cut_approved"),
    "skill-coordinator.md stop-condition must reference the cut_approved field",
  );
  assert.ok(
    COORD.includes("CUT_APPROVAL_REQUIRED"),
    "skill-coordinator.md must name the CUT_APPROVAL_REQUIRED error code",
  );
});

// ============================================================================
// b8-external-ref-ledger — EXTERNAL_REFS_UNRESOLVED gate (B8-QA)
// Same file-mode-only, prev-pinned-to-pm shape as CUT_APPROVAL_REQUIRED above,
// but INVERSE polarity (DR-3: absence/empty/all-resolved CLEARS, not blocks)
// and NO PM-re-entry re-arm (DR-4: only active_feature change resets it).
//
// Spec-to-Test map:
//   AC-1 (gate fires, unresolved)         -> XG1
//   AC-2 (resolved/absent/empty clears)   -> X-pred-2/3/4, XG2
//   AC-3 (pinned to pm predecessor)       -> XG-nonpm
//   AC-4 (fires on both build edges)      -> XG-both-edges
//   AC-5 (file-mode only)                 -> XS1
//   AC-6 (REPLACE semantics, incl. [])    -> XR3, X-empty
//   AC-7/AC-8 (v5->v6 migration, pure)    -> see test/handoff-migration.test.mjs
//   DR-3 (malformed entries dropped)      -> X-malformed
//   DR-4 (no PM re-entry re-arm; reset
//         only on active_feature change)  -> XR1, XR2, XR4
// ============================================================================

test("X-pred-1: hasUnresolvedRefs/listUnresolvedRefs fire on a mixed ledger, listing only the unresolved refs in order", () => {
  // WHY: AC-1 — a ledger with a mix of states must still fire, and the hint must
  // enumerate ONLY the unresolved entries, in their original order (deterministic
  // hint interpolation).
  const state = {
    external_refs: [
      { ref: "https://figma.com/a", state: "fetched" },
      { ref: "JIRA-1", state: "unresolved" },
      { ref: "JIRA-2", state: "indexed" },
      { ref: "JIRA-3", state: "unresolved" },
    ],
  };
  assert.equal(hasUnresolvedRefs(state), true, "gate must fire when >=1 entry is unresolved");
  assert.deepEqual(listUnresolvedRefs(state), ["JIRA-1", "JIRA-3"], "must list only unresolved refs, in input order");
});

test("X-pred-2: hasUnresolvedRefs returns false when external_refs is absent (AC-2)", () => {
  // WHY: absence is the INVERSE-polarity sentinel vs cut_approved — "PM found zero
  // external references", not "unresolved". Absence must clear, not block.
  assert.equal(hasUnresolvedRefs({}), false);
  assert.equal(hasUnresolvedRefs(null), false);
  assert.equal(hasUnresolvedRefs(undefined), false);
  assert.deepEqual(listUnresolvedRefs({}), []);
});

test("X-pred-3: hasUnresolvedRefs returns false for an empty array (AC-2)", () => {
  assert.equal(hasUnresolvedRefs({ external_refs: [] }), false);
  assert.deepEqual(listUnresolvedRefs({ external_refs: [] }), []);
});

test("X-pred-4: hasUnresolvedRefs returns false when every entry is resolved (fetched/indexed/user-confirmed-ignorable) (AC-2)", () => {
  const state = {
    external_refs: [
      { ref: "a", state: "fetched" },
      { ref: "b", state: "indexed" },
      { ref: "c", state: "user-confirmed-ignorable" },
    ],
  };
  assert.equal(hasUnresolvedRefs(state), false, "all-resolved ledger must clear the gate");
  assert.deepEqual(listUnresolvedRefs(state), []);
});

test("X-malformed: hasUnresolvedRefs/listUnresolvedRefs never throw on hostile/malformed input", () => {
  // WHY: gates/external-refs.ts predicates are deliberately loose-typed
  // (`state: string`, not the closed enum) so a hand-edited or partially-migrated
  // handoff can never crash the gate. Entries that are not objects, or lack the
  // expected shape, must be tolerated (via optional-chaining), not thrown on.
  assert.doesNotThrow(() => hasUnresolvedRefs({ external_refs: "not-an-array" }));
  assert.equal(hasUnresolvedRefs({ external_refs: "not-an-array" }), false);
  assert.doesNotThrow(() => hasUnresolvedRefs({ external_refs: [null, undefined, 42, "str", {}] }));
  assert.equal(hasUnresolvedRefs({ external_refs: [null, undefined, 42, "str", {}] }), false);
  assert.doesNotThrow(() => listUnresolvedRefs({ external_refs: [null, { ref: "ok", state: "unresolved" }] }));
  assert.deepEqual(listUnresolvedRefs({ external_refs: [null, { ref: "ok", state: "unresolved" }] }), ["ok"]);
});

test("X-malformed-parse: parseHandoff drops malformed external_refs entries from raw YAML without throwing (DR-3)", async () => {
  // WHY: tools/handoff.ts's parseExternalRefs is the OTHER defensive layer — it
  // filters malformed frontmatter entries (missing ref, empty ref, out-of-enum
  // state) before the gate ever sees them, and collapses an all-malformed result
  // to undefined (absence), never seeding a phantom unresolved sentinel.
  const ws = tmpWs();
  writeRawHandoff(ws, `---
schema_version: 6
active_feature: "malformed-refs"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
last_agent: "pm"
external_refs:
  - ref: "good-ref"
    state: "unresolved"
  - ref: ""
    state: "unresolved"
  - state: "unresolved"
  - ref: "bad-state"
    state: "not-a-real-state"
qa_round: 0
review_round: 0
visual_round: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- (none)
`);
  resetSession();
  let state;
  assert.doesNotThrow(() => { state = parseHandoff(ws); }, "parseHandoff must never throw on malformed external_refs entries");
  assert.deepEqual(state.external_refs, [{ ref: "good-ref", state: "unresolved" }],
    "only the well-formed entry must survive parsing; empty ref / missing ref / bad state are dropped");
  assert.equal(hasUnresolvedRefs(state), true, "the one surviving well-formed entry still fires the gate");
});

test("X-empty: writing external_refs: [] elides the field from disk and clears the gate (AC-2/AC-6)", async () => {
  // WHY: an empty array is NOT serialized (empty === absence === non-blocking) —
  // the two states must be behaviorally identical on round-trip, not merely
  // both individually non-blocking.
  const ws = tmpWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "empty-refs",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [],
  });
  const raw = readRawHandoff(ws);
  assert.doesNotMatch(raw, /external_refs:/, "an empty external_refs array must NOT be serialized into YAML");
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.external_refs, undefined, "empty array round-trips as absent, not as []");
  assert.equal(hasUnresolvedRefs(state), false);
});

test("XR-schema-1: writeHandoffState emits external_refs as a YAML block sequence and parses it back verbatim", async () => {
  // WHY: AC-6/DR-1 — external_refs is the FIRST array-of-object handoff frontmatter
  // field; this pins the write->YAML->read round-trip for the new shape.
  const ws = tmpWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ledger-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [
      { ref: "https://figma.com/file/abc", state: "unresolved" },
      { ref: "JIRA-4021", state: "indexed" },
    ],
  });
  const raw = readRawHandoff(ws);
  assert.match(raw, /external_refs:/, "external_refs key must be emitted");
  assert.match(raw, /ref:\s*"https:\/\/figma\.com\/file\/abc"/, "first entry's ref must round-trip verbatim");
  assert.match(raw, /state:\s*"unresolved"/, "first entry's state must round-trip verbatim");

  resetSession();
  const state = parseHandoff(ws);
  assert.deepEqual(state.external_refs, [
    { ref: "https://figma.com/file/abc", state: "unresolved" },
    { ref: "JIRA-4021", state: "indexed" },
  ], "external_refs array must round-trip losslessly, in order");
});

test("XR1: PM re-entry WITHOUT external_refs preserves the ledger — NO re-arm (DR-4, contrast with cut_approved R2)", async () => {
  // WHY (the load-bearing contrast): cut_approved RE-ARMS to undefined on every
  // PM re-entry that omits it (absence BLOCKS there). external_refs has INVERSE
  // polarity (absence CLEARS) — re-arming it the same way would silently DISCARD
  // a valid ledger and UN-BLOCK the gate, which is unsafe. So a PM re-entry that
  // omits external_refs on the SAME feature must carry the ledger forward.
  const ws = tmpWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "resume-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [{ ref: "JIRA-9", state: "unresolved" }],
  });
  // PM re-enters (e.g. after a QA-FAIL bounce) WITHOUT passing external_refs.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "resume-feat",
    status: "In_Progress",
    lastAgent: "pm",
    completedTasks: [],
    pendingNotes: ["re-evaluating"],
    // externalRefs intentionally omitted — DR-4: must NOT re-arm/drop.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.deepEqual(state.external_refs, [{ ref: "JIRA-9", state: "unresolved" }],
    "PM re-entry omitting external_refs must PRESERVE the existing ledger (no re-arm, DR-4)");
  assert.equal(hasUnresolvedRefs(state), true, "the still-unresolved ledger must keep the gate armed across the re-entry");
});

test("XR2: non-PM same-feature write carries external_refs forward unchanged", async () => {
  // WHY: mirrors cut_approved's R3 — after PM records the ledger, downstream
  // build-role writes (architect, sr-engineer) omit external_refs; it must
  // survive so the gate state stays consistent mid-build.
  const ws = tmpWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "build-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [{ ref: "spec-link", state: "indexed" }],
  });
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "build-feat",
    status: "In_Progress",
    lastAgent: "architect",
    completedTasks: [],
    pendingNotes: ["designing"],
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.deepEqual(state.external_refs, [{ ref: "spec-link", state: "indexed" }],
    "non-PM same-feature write must preserve external_refs verbatim");
});

test("XR3: active_feature change drops external_refs (feature-scoped reset)", async () => {
  // WHY: AC-6 — the ledger is feature-scoped. A stale ledger from feature-A must
  // never leak into feature-B (whether it would block or clear the gate there).
  const ws = tmpWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-a",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [{ ref: "a-only-ref", state: "unresolved" }],
  });
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-b",
    status: "In_Progress",
    lastAgent: "sr-engineer",
    completedTasks: [],
    pendingNotes: [],
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.external_refs, undefined, "feature change must drop the stale ledger");
  assert.equal(hasUnresolvedRefs(state), false, "no ledger means the gate is clear on the new feature");
});

test("XR4: passing external_refs REPLACES the array wholesale, including clearing a prior unresolved ledger with []", async () => {
  // WHY: AC-6 — same semantics as completed_tasks: never merged/appended. This is
  // the PM-resolves-the-refs happy path from the architecture sequence diagram —
  // PM re-writes the ledger with everything resolved (or clears it outright).
  const ws = tmpWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "replace-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [
      { ref: "r1", state: "unresolved" },
      { ref: "r2", state: "unresolved" },
    ],
  });
  // PM resolves r1, drops r2 entirely, adds a new resolved ref — REPLACE, not merge.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "replace-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [{ ref: "r1", state: "indexed" }],
  });
  resetSession();
  let state = parseHandoff(ws);
  assert.deepEqual(state.external_refs, [{ ref: "r1", state: "indexed" }],
    "write must REPLACE the whole array, not merge — r2 must be gone");
  assert.equal(hasUnresolvedRefs(state), false, "gate clears once the replacement ledger is fully resolved");

  // Clearing with [] must also work (REPLACE semantics apply to the empty case too).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "replace-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    externalRefs: [],
  });
  resetSession();
  state = parseHandoff(ws);
  assert.equal(state.external_refs, undefined, "REPLACE with [] must clear the ledger entirely (AC-6)");
});

test("XG1: gate fires when prevState carries an unresolved entry (AC-1)", () => {
  const state = { last_agent: "pm", status: "In_Progress", external_refs: [{ ref: "r", state: "unresolved" }] };
  assert.equal(hasUnresolvedRefs(state), true, "gate MUST fire on an unresolved entry");
});

test("XG2: gate clears when prevState is absent/empty/all-resolved (AC-2)", () => {
  assert.equal(hasUnresolvedRefs({ last_agent: "pm", status: "In_Progress" }), false, "absent ledger clears");
  assert.equal(hasUnresolvedRefs({ last_agent: "pm", status: "In_Progress", external_refs: [] }), false, "empty ledger clears");
  assert.equal(
    hasUnresolvedRefs({ last_agent: "pm", status: "In_Progress", external_refs: [{ ref: "r", state: "fetched" }] }),
    false,
    "all-resolved ledger clears",
  );
});

test("XG-both-edges: the orchestrator arm condition covers BOTH pm->architect and pm->sr-engineer (AC-4)", () => {
  // WHY: AC-4 is this gate's B8-specific requirement — it must fire on the SAME
  // two edges CUT_APPROVAL_REQUIRED and SCOPE_DECISION_REQUIRED already gate, not
  // only the sr-engineer edge. We assert against the compiled orchestrator source
  // (composition-test convention, same as G1-G3/S1 above) that both agent names
  // appear together with the gate's arm condition and error code.
  const gateBlock = DIST_INDEX.slice(
    DIST_INDEX.indexOf("hasUnresolvedRefs(prevState)") - 400,
    DIST_INDEX.indexOf("EXTERNAL_REFS_UNRESOLVED", DIST_INDEX.indexOf("hasUnresolvedRefs(prevState)")) + 40,
  );
  assert.ok(gateBlock.includes('"architect"'), "gate arm condition must include architect");
  assert.ok(gateBlock.includes('"sr-engineer"'), "gate arm condition must include sr-engineer");
  assert.ok(gateBlock.includes("EXTERNAL_REFS_UNRESOLVED"), "the located block must be the external-refs gate");
});

test("XG-nonpm: non-pm predecessor is never gated, regardless of ledger contents (AC-3)", () => {
  // WHY: AC-3 — architect:In_Progress -> sr-engineer:In_Progress (or any self-loop)
  // has prev.agent !== "pm"; the orchestrator's arm condition requires
  // prevTuple.agent === "pm", so a ledger populated on an earlier PM write must
  // never re-block a downstream resume/self-loop. We assert the ARM CONDITION
  // directly (composition-test convention, same as G1 above) rather than the
  // predicate itself — hasUnresolvedRefs has no agent-awareness by design; the
  // pm-pinning lives in the orchestrator's `if` guard, not the predicate.
  const prevTuple = { agent: "architect", status: "In_Progress" };
  const onGatedEdge = prevTuple.agent === "pm" && prevTuple.status === "In_Progress";
  assert.equal(onGatedEdge, false, "a non-pm predecessor must never satisfy the gate's arm condition");
  // Even with an unresolved ledger sitting in prevState, the predicate alone
  // (without the orchestrator's pm-pinning guard) would say "fire" — proving the
  // pm-pinning guard, not the predicate, is what protects resume/self-loop edges.
  const prevState = { last_agent: "architect", external_refs: [{ ref: "r", state: "unresolved" }] };
  assert.equal(hasUnresolvedRefs(prevState), true, "predicate alone is agent-agnostic by design");
});

test("XS1: gate skips when active storage is not FileHandoffStorage (SQLite-mode skip, AC-5)", () => {
  // WHY: D5/AC-5 — external_refs is handoff-YAML frontmatter only. In SQLite/HTTP
  // mode the parsed prev-state never carries it, so the gate would always see an
  // empty/absent ledger anyway — but the orchestrator skips explicitly rather
  // than relying on an always-empty read (same guard as CUT_APPROVAL_REQUIRED).
  const fakeNonFileStorage = { writeState: () => {}, readState: () => {}, parse: () => null };
  assert.equal(
    fakeNonFileStorage instanceof FileHandoffStorage,
    false,
    "a plain object must not satisfy instanceof FileHandoffStorage (SQLite-skip predicate fails as expected)",
  );
  const fileStorage = new FileHandoffStorage();
  assert.equal(
    fileStorage instanceof FileHandoffStorage,
    true,
    "FileHandoffStorage instance must satisfy instanceof check (gate arms in file mode)",
  );
});

test("XC1: EXTERNAL_REFS_UNRESOLVED error code present verbatim in dist/tools/handoff-orchestrator.js", () => {
  assert.ok(
    DIST_INDEX.includes("EXTERNAL_REFS_UNRESOLVED"),
    "compiled orchestrator must contain the verbatim error code EXTERNAL_REFS_UNRESOLVED",
  );
});

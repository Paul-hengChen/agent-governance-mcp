// Coded by @qa-engineer
// Tests for specs/e114-cut-approval-inheritance.md AC1-AC9, plus two review
// findings pinned so they cannot regress: a malformed write destroying a valid
// record (F1) and whitespace-only 'inherited:' values (F2)
// (review_reports/review_T-E114-01.md Round 1).
//
// Spec-to-Test map:
//   AC1 (v13->v14 migration is stamp-only, seeds nothing)        -> AC1
//   AC2 (absence === non-inherited, own case)                    -> AC2
//   AC3 (tw_update_state write round-trips verbatim)              -> AC3
//   AC4 (malformed values drop defensively at parse, never throw) -> AC4-1..AC4-3
//   AC5 (feature-scoped carry-forward, drop on active_feature change,
//        no PM-re-entry re-arm — mirrors dispatch_mode/dispatch_pins) -> AC5-1..AC5-3
//   AC6 (zod arg accepts it client-settable)                      -> AC6
//   AC7 (docs/schema-versions.md has both the v13 and v14 rows)   -> AC7
//   AC9 (zero gates read the field)                               -> AC9
//   F1 (malformed write must not destroy a valid record; the      -> F1-1, F1-2
//       preserve branch is feature-scoped, not a blind keep)
//   F2 ('inherited:' and 'inherited:   ' both read back undefined) -> F2

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseHandoff,
  readHandoffState,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { runMigrations, CURRENT_VERSIONS } from "../dist/schema/versions.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { forceSeedStampIfExists } from "./e148-seed-stamp.mjs";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

// ---- helpers ---------------------------------------------------------------

function mkWs(prefix = "e114-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// writeRaw always seeds a RAW pre-migration fixture (flat, deliberately).
function writeRaw(ws, body) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body, "utf-8");
}

// readRaw is always called AFTER a real writer call (writeHandoffState/
// readHandoffState), which now writes to the lane-scoped path (e123b9 J2,
// spec AC1) — these fixture workspaces carry no `.git`, so that's `_primary`.
function readRaw(ws) {
  return fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8");
}

// Drives the REAL tw_update_state orchestrator via TOOL_REGISTRY (zod schema
// + gate pipeline), matching test/e23-evidence-schema.test.mjs's dispatch()
// convention.
async function dispatch(ws, args) {
  forceSeedStampIfExists(ws);
  resetSession(ws);
  markStateRead(ws);
  return UPDATE_STATE_ENTRY.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
}

// ============================================================================
// AC1 — v13->v14 migration is stamp-only and seeds nothing
// ============================================================================

test("AC1: v13->v14 migration is stamp-only — bumps schema_version only, seeds no cut_approved_source", () => {
  // Re-baselined for the lane-layout migration (e123a): CURRENT_VERSIONS.handoff is now
  // 15, so a v13 payload run through the REAL (un-cleared) registry climbs
  // BOTH the v13->v14 step under test here AND the new v14->v15 step in the
  // same call — there is no way to isolate a single intermediate step from
  // the public API without clearing the registry (the M1/M3-style tests do
  // that; this test intentionally exercises the real registry end to end).
  // Both steps are stamp-only, so the "no field added" assertion still holds.
  assert.equal(CURRENT_VERSIONS.handoff, 15, "sanity: this server's CURRENT handoff version is 15 (e123a-lane-layout-migration)");
  const v13Payload = {
    schema_version: 13,
    active_feature: "ac1-migrate-feat",
    status: "In_Progress",
    last_agent: "pm",
    evidence_schema: 2,
  };
  const result = runMigrations("handoff", v13Payload);
  assert.deepEqual(result.applied, [14, 15], "the v13->v14 AND v14->v15 steps run on a v13 payload to reach CURRENT");
  assert.deepEqual(
    result.payload,
    { ...v13Payload, schema_version: 15 },
    "the v13->v14 and v14->v15 steps must change schema_version ONLY — no field added, changed, or removed (both stamp-only, no seed)",
  );
  assert.equal(result.payload.cut_approved_source, undefined, "v13->v14 seeds NO cut_approved_source default (absence === non-inherited, the safe direction)");
  assert.equal(result.payload.dispatch_mechanism, undefined, "v14->v15 seeds NO dispatch_mechanism default (e123a-lane-layout-migration — migration invents no attestation)");
});

test("AC1: a real v13 handoff file migrates to v14 on disk via readHandoffState's fire-and-forget heal (real registry), stamp-only", async () => {
  // parseHandoff runs migrations in-memory only and never writes back
  // (tools/handoff-parse.ts's own doc comment); readHandoffState is the
  // fire-and-forget heal path that persists the migrated payload, mirroring
  // test/dispatch-pins.test.mjs's M1b convention.
  const ws = mkWs();
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "ac1-real-v13-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
  );
  resetSession(ws);
  const json = JSON.parse(readHandoffState(ws));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(readRaw(ws), /schema_version:\s*15/, "on-disk v13 fixture migrates to CURRENT (15)");
  assert.equal(json.cut_approved_source, undefined, "the v13->v14 step invents no claim for a historical payload");
  assert.equal(json.active_feature, "ac1-real-v13-feat", "sibling field survives losslessly");
});

// ============================================================================
// AC2 — absence === non-inherited (its own case, not incidental)
// ============================================================================

test("AC2: a handoff with no cut_approved_source reads back undefined — absence is the non-inherited default, never a false negative/positive", async () => {
  // Case 1: a legacy (v13, written before this field existed) handoff that never had the field at all.
  const legacyWs = mkWs("e114-legacy-");
  writeRaw(
    legacyWs,
    `---
schema_version: 13
active_feature: "ac2-legacy-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
  );
  resetSession(legacyWs);
  const legacyJson = JSON.parse(readHandoffState(legacyWs));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(readRaw(legacyWs), /schema_version:\s*15/, "sanity: the legacy fixture migrated to CURRENT");
  assert.equal(legacyJson.cut_approved_source, undefined, "a pre-E114 handoff must read cut_approved_source as undefined, not a false 'not inherited' or false 'inherited'");

  // Case 2: a fresh, current-schema write that simply never set the field.
  const freshWs = mkWs("e114-fresh-");
  resetSession(freshWs);
  markStateRead(freshWs);
  await writeHandoffState({
    workspacePath: freshWs,
    activeFeature: "ac2-fresh-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    // cutApprovedSource intentionally omitted.
  });
  resetSession(freshWs);
  const freshState = parseHandoff(freshWs);
  assert.equal(freshState.cut_approved_source, undefined, "a write that never sets cut_approved_source must read back undefined — the absence default, not a fabricated attestation");
  assert.doesNotMatch(readRaw(freshWs), /cut_approved_source:/, "the key must not even appear on disk when never set (emit-only-when-set)");
});

// ============================================================================
// AC3 — tw_update_state write round-trips verbatim
// ============================================================================

test("AC3: a tw_update_state write of cut_approved_source: inherited:<feature> round-trips verbatim", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  const res = await dispatch(ws, {
    active_feature: "ac3-feat",
    status: "In_Progress",
    agent_id: "pm",
    cut_approved_source: "inherited:parent-feature-x",
  });
  assert.ok(!res.isError, `write with a valid cut_approved_source must be accepted: ${res.content?.[0]?.text}`);

  const raw = readRaw(ws);
  assert.match(raw, /cut_approved_source:\s*["']?inherited:parent-feature-x["']?/, "frontmatter must carry the value verbatim");

  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, "inherited:parent-feature-x", "parseHandoff must return the value unchanged");

  const getStateResult = JSON.parse(readHandoffState(ws));
  assert.equal(getStateResult.cut_approved_source, "inherited:parent-feature-x", "a subsequent tw_get_state-equivalent read must return it unchanged");
});

// ============================================================================
// AC4 — malformed values drop defensively at parse, never throw
// ============================================================================

test("AC4-1: a tw_update_state write with a malformed cut_approved_source (no 'inherited:' prefix) is accepted at the zod boundary but drops to undefined at parse", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  const res = await dispatch(ws, {
    active_feature: "ac4-noprefix-feat",
    status: "In_Progress",
    agent_id: "pm",
    cut_approved_source: "lane:not-the-right-shape",
  });
  assert.ok(!res.isError, `AC4 forbids rejecting at the zod boundary — a malformed value must still be ACCEPTED: ${res.content?.[0]?.text}`);
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, undefined, "a value missing the 'inherited:' prefix must drop to undefined, never pass through");
});

test("AC4-2: a tw_update_state write with an empty feature suffix ('inherited:') is accepted at the zod boundary but drops to undefined at parse", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  const res = await dispatch(ws, {
    active_feature: "ac4-emptysuffix-feat",
    status: "In_Progress",
    agent_id: "pm",
    cut_approved_source: "inherited:",
  });
  assert.ok(!res.isError, `AC4 forbids rejecting at the zod boundary: ${res.content?.[0]?.text}`);
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, undefined, "an empty feature suffix must drop to undefined, never pass through");
});

test("AC4-3: parseHandoff never throws on hostile/non-string hand-edited cut_approved_source values", () => {
  const cases = [
    ["42", "42"],
    ["null", "null"],
    ["true", "true"],
    ["[a, b]", "[a, b]"],
    ["{k: v}", "{k: v}"],
    ['""', '""'],
  ];
  for (const [label, yamlValue] of cases) {
    const ws = mkWs();
    writeRaw(
      ws,
      `---
schema_version: 14
active_feature: "ac4-hostile-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
cut_approved_source: ${yamlValue}
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
    );
    resetSession(ws);
    assert.doesNotThrow(() => parseHandoff(ws), `cut_approved_source: ${label} must never throw`);
    const state = parseHandoff(ws);
    assert.equal(state.cut_approved_source, undefined, `cut_approved_source: ${label} must sanitise to undefined, never a phantom value`);
  }
});

// ============================================================================
// AC5 — feature-scoped carry-forward; drop on active_feature change; NO
// PM-re-entry re-arm (mirrors the dispatch_mode/dispatch_pins carry-forward
// tests in test/dispatch-pins.test.mjs W3/W4/W5)
// ============================================================================

test("AC5-1: a write omitting cut_approved_source on the SAME active_feature carries the value forward unchanged", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac5-carry-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    cutApprovedSource: "inherited:parent-a",
  });
  // Downstream role write omits cutApprovedSource entirely.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac5-carry-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["sr-engineer: implementing"],
    lastAgent: "sr-engineer",
    // cutApprovedSource intentionally omitted.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, "inherited:parent-a", "an omitting write on the same feature must preserve the value verbatim");
});

test("AC5-2: active_feature change drops cut_approved_source (feature-scoped reset), even though the write omits it", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac5-feature-a",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    cutApprovedSource: "inherited:parent-a",
  });
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac5-feature-b",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    // cutApprovedSource omitted — must NOT leak across the feature boundary.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, undefined, "a stale claim from feature-a must never leak into feature-b, even though the write omitted the field");
});

test("AC5-3: PM re-entry WITHOUT cut_approved_source preserves the value — NO re-arm (contrast with cut_approved's PM-re-entry reset)", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac5-resume-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    cutApprovedSource: "inherited:parent-a",
  });
  // PM re-enters (e.g. after a QA-FAIL bounce) WITHOUT passing cutApprovedSource.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac5-resume-feat",
    status: "In_Progress",
    lastAgent: "pm",
    completedTasks: [],
    pendingNotes: ["pm: re-evaluating after QA FAIL"],
    // cutApprovedSource intentionally omitted — must NOT re-arm/drop.
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, "inherited:parent-a", "PM re-entry omitting cut_approved_source must PRESERVE the existing value (no re-arm, unlike cut_approved) — inheritance is a stable fact about the lane, not a per-cut approval");
});

// ============================================================================
// AC6 — the zod arg accepts cut_approved_source as client-settable (contrast
// evidence_schema's AC6-1 absence-from-client pin in test/e23-evidence-schema.test.mjs)
// ============================================================================

test("AC6: tw_update_state's zod arg surface DOES accept cut_approved_source as a client-settable string (contrast evidence_schema's server-stamped-only posture)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  const res = await dispatch(ws, {
    active_feature: "ac6-feat",
    status: "In_Progress",
    agent_id: "pm",
    cut_approved_source: "inherited:some-parent",
  });
  assert.ok(!res.isError, `cut_approved_source must be accepted as a client-settable zod arg: ${res.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).cut_approved_source, "inherited:some-parent", "the client-supplied value must actually take effect (not silently discarded despite being 'accepted')");

  // Positive-declaration check, the mirror image of e23's AC6-1 (which asserts
  // evidence_schema is NEVER declared as a client arg): cut_approved_source
  // MUST be declared, both as a zod schema key and as a hand-written
  // JSON-Schema property, since it IS client-settable by design (spec decision 2).
  const registrySrc = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "registry.ts"), "utf-8");
  assert.match(registrySrc, /cut_approved_source:\s*z\./, "tools/registry.ts MUST declare a cut_approved_source zod arg — AC6");
  assert.match(registrySrc, /cut_approved_source:\s*\{/, "tools/registry.ts MUST declare a cut_approved_source hand-written JSON-Schema property — AC6");
});

// ============================================================================
// AC7 — docs/schema-versions.md has both the v13 and v14 rows
// ============================================================================

test("AC7: docs/schema-versions.md's Handoff version history table has exactly one v13 row and exactly one v14 row", () => {
  const docSrc = fs.readFileSync(path.join(PROJECT_ROOT, "docs", "schema-versions.md"), "utf-8");
  const v13Rows = docSrc.split("\n").filter((line) => line.startsWith("| v13 "));
  const v14Rows = docSrc.split("\n").filter((line) => line.startsWith("| v14 "));
  assert.equal(v13Rows.length, 1, "docs/schema-versions.md must have exactly one v13 row (the retroactively-owed evidence_schema row)");
  assert.equal(v14Rows.length, 1, "docs/schema-versions.md must have exactly one v14 row (this ticket's cut_approved_source row)");
  assert.match(v14Rows[0], /cut_approved_source/, "the v14 row must actually describe cut_approved_source");
});

// ============================================================================
// AC9 — zero gates read the field
// ============================================================================

test("AC9: no gate predicate in gates/ reads cut_approved_source", () => {
  const gatesDir = path.join(PROJECT_ROOT, "gates");
  const files = fs.readdirSync(gatesDir).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length > 0, "sanity: gates/ must contain .ts files to scan");
  for (const file of files) {
    const src = fs.readFileSync(path.join(gatesDir, file), "utf-8");
    assert.ok(!src.includes("cut_approved_source"), `gates/${file} must not reference cut_approved_source (AC9 — recording-only, no gate widening in this ticket)`);
  }
});

// ============================================================================
// F1 — a malformed write must not destroy a valid record; the preserve
// branch is feature-scoped, not a blind keep-whatever-was-there
// (review_reports/review_T-E114-01.md Finding 1).
// ============================================================================

test("F1-1: a malformed cut_approved_source write leaves a valid SAME-feature record intact (does not overwrite or delete it)", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "f1-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    cutApprovedSource: "inherited:parent-b",
  });
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "f1-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    cutApprovedSource: "lane:x", // malformed — must not overwrite the valid record
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved_source, "inherited:parent-b", "a malformed write on the SAME feature must leave the prior valid record untouched, not overwrite it with garbage or delete it");
});

test("F1-2: the preserve branch is feature-scoped, not a blind keep — a malformed write under a DIFFERENT feature yields an absent key, not the other feature's value", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "f1-feature-a",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    cutApprovedSource: "inherited:parent-old",
  });
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "f1-feature-b", // active_feature CHANGES here
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    cutApprovedSource: "lane:x", // malformed, on a NEW feature
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(
    state.cut_approved_source,
    undefined,
    "a malformed write on a DIFFERENT feature must NOT phantom-inherit the old feature's value — proves the preserve branch is feature-scoped, not a blind 'keep whatever was there'",
  );
});

// ============================================================================
// F2 — 'inherited:' and 'inherited:   ' (whitespace-only suffix) both read
// back undefined (review_reports/review_T-E114-01.md Finding 2).
// ============================================================================

test("F2: 'inherited:' and 'inherited:   ' (whitespace-only feature suffix) both read back undefined, never a persisted claim naming no parent", () => {
  for (const raw of ["inherited:", "inherited:   ", "inherited:\t\n "]) {
    const ws = mkWs();
    writeRaw(
      ws,
      `---
schema_version: 14
active_feature: "f2-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
cut_approved_source: "${raw.replace(/\n/g, "\\n")}"
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
    );
    resetSession(ws);
    const state = parseHandoff(ws);
    assert.equal(state.cut_approved_source, undefined, `cut_approved_source: ${JSON.stringify(raw)} must read back undefined — a whitespace-only feature suffix names no parent`);
  }
});

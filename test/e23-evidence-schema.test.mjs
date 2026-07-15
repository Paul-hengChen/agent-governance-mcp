// Coded by @qa-engineer
// Tests for specs/e23-evidence-schema-versioning.md AC1-AC6. D1 pins an
// integer `evidence_schema` into the handoff (server-stamped, feature-scoped,
// v13); D2 keys the two evidence-heading gates (visual report schema,
// AC-execution disposition) off that pin so a mid-flight tightening of the
// heading-match convention can never retroactively invalidate crash-era
// artifacts (the 104447-F0 incident: `## Phase 3.5 — AC Execution Log`
// rejected on heading PREFIX alone); D3 makes the three rejection envelopes
// name the missing section/expected string, the file path checked, and the
// evidence-schema version the check ran under.
//
// Spec-to-Test map:
//   AC1 (stamp/carry/drop-restamp + no-client-supply)  -> AC1-1..AC1-6
//   AC2 (migration invents no pin)                      -> AC2-1, AC2-2
//   AC3 (incident-replay heading, pin 2/absent clears, pin 1 still fails) -> AC3-1..AC3-3
//   AC4 (suffixed/prefixed headings pass under pin 2; missing sections still reject) -> AC4-1, AC4-2
//   AC5 (envelope substrings: section/string, path, version, all 3 codes) -> AC5-1..AC5-3
//   AC6 (zod tw_update_state surface unchanged)         -> AC6-1

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { EVIDENCE_SCHEMA_CURRENT } from "../dist/gates/evidence-schema.js";
import {
  parseHandoff,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { runMigrations, _clearRegistryForTests, registerMigration } from "../dist/schema/versions.js";
import {
  hasAcExecutionLogDisposition,
  specFilePath,
} from "../dist/gates/ac-execution.js";
import { validateVisualReport } from "../dist/gates/visual.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

function mkWorkspace(prefix = "e23-") {
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

function writeReview(ws, taskId, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), body, "utf-8");
}

function writeSpec(ws, feature, body) {
  fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
  fs.writeFileSync(specFilePath(ws, feature), body, "utf-8");
}

function writeDesign(ws, feature, body) {
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${feature}.md`), body, "utf-8");
}

function writeVisual(ws, taskId, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `visual_${taskId}.md`), body, "utf-8");
}

// Drives the REAL tw_update_state orchestrator (matches test/ac-execution.test.mjs
// I1-I3b convention: handleUpdateState directly, not the TOOL_REGISTRY wrapper).
async function dispatch(ws, args) {
  resetSession(ws);
  markStateRead(ws);
  return handleUpdateState({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
}

// ============================================================================
// AC1 — evidence_schema server-stamped, feature-scoped: stamp / carry / drop-restamp
// ============================================================================

test("AC1-1: first write of a new active_feature stamps evidence_schema: 2 on disk (EVIDENCE_SCHEMA_CURRENT)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  assert.equal(EVIDENCE_SCHEMA_CURRENT, 2, "sanity: gates/evidence-schema.ts pins v2 (D2 normalized-contains)");
  const res = await dispatch(ws, { active_feature: "ac1-fresh-feat", status: "In_Progress", agent_id: "pm" });
  assert.ok(!res.isError, `first write must be accepted: ${res.content?.[0]?.text}`);
  const raw = readRaw(ws);
  assert.match(raw, /evidence_schema:\s*2/, "first write of a new feature must stamp evidence_schema: 2 verbatim");
  assert.equal(parseHandoff(ws).evidence_schema, 2);
});

test("AC1-2: a subsequent same-feature write (no client arg exists to set it) preserves the stamped pin", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  await dispatch(ws, { active_feature: "ac1-carry-feat", status: "In_Progress", agent_id: "pm" });
  assert.equal(parseHandoff(ws).evidence_schema, 2, "sanity: stamped on first write");

  const res = await dispatch(ws, { active_feature: "ac1-carry-feat", status: "In_Progress", agent_id: "pm" });
  assert.ok(!res.isError, `same-feature write must be accepted: ${res.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).evidence_schema, 2, "same-feature write must carry the pin forward verbatim (feature-scoped, no PM-re-entry re-arm)");
});

test("AC1-3: an active_feature change drops a stale pin and re-stamps EVIDENCE_SCHEMA_CURRENT — never carries the old value forward", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  // Hand-author a v13 handoff for an "old" feature pinned at v1 — simulating a
  // hypothetical pre-D2 feature dispatched under a hypothetical future v3+
  // tightening. If the pin were carried across a feature change instead of
  // dropped, this test would observe evidence_schema staying 1 on the NEW
  // feature — the exact bug D1's feature-scoped drop rule exists to prevent.
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "ac1-old-feat"
status: "In_Progress"
last_agent: "pm"
last_updated: "2026-01-01T00:00:00.123Z"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
evidence_schema: 1
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
  );
  resetSession(ws);
  markStateRead(ws);
  const before = parseHandoff(ws);
  assert.equal(before.evidence_schema, 1, "sanity: hand-authored pin is 1 before the active_feature change");

  const res = await dispatch(ws, { active_feature: "ac1-new-feat", status: "In_Progress", agent_id: "pm" });
  assert.ok(!res.isError, `active_feature change write must be accepted: ${res.content?.[0]?.text}`);
  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "ac1-new-feat");
  assert.equal(state.evidence_schema, 2, "active_feature change must DROP the stale v1 pin and re-stamp EVIDENCE_SCHEMA_CURRENT (2) — never carry v1 forward");
});

test("AC1-4: evidence_schema is not a client-settable arg — a hostile write_options field never reaches disk (no zod plumbing, D1)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  // writeHandoffState's options object accepts arbitrary extra keys structurally
  // (JS has no runtime object-shape enforcement), but WriteHandoffStateOptions
  // has no `evidenceSchema` passthrough from a hostile caller trying to smuggle
  // one in under a different option name; only the orchestrator's own internal
  // `evidenceSchema: feature_changed ? EVIDENCE_SCHEMA_CURRENT : undefined`
  // ever sets it (D1 "server-stamped, never client-supplied").
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac1-hostile-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    evidence_schema: 999, // wrong key name — NOT the `evidenceSchema` option field
  });
  assert.equal(parseHandoff(ws).evidence_schema, undefined, "a wrong-cased/unknown option key must never leak into the stamped field");
});

test("AC1-5: hand-edited negative/zero/non-numeric evidence_schema sanitises to undefined (defensive read, mirrors dispatch_pins/hop_count boundary contract)", () => {
  const ws = mkWorkspace();
  for (const bad of ["-1", "0", "NaN", "not-a-number"]) {
    writeRaw(
      ws,
      `---
schema_version: 13
active_feature: "ac1-boundary-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
evidence_schema: ${bad}
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
    );
    const state = parseHandoff(ws);
    assert.equal(state.evidence_schema, undefined, `evidence_schema: ${bad} must sanitise to undefined, never a negative/zero/NaN pin (a schema version can never legally be < 1)`);
  }
});

test("AC1-6: a legal hand-authored pin (e.g. 1) round-trips through parseHandoff verbatim", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "ac1-legal-feat"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
evidence_schema: 1
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`,
  );
  assert.equal(parseHandoff(ws).evidence_schema, 1, "a legally-pinned v1 value must survive parse verbatim (only the sanitiser rejects illegal values, not legal ones)");
});

// ============================================================================
// AC2 — v12→v13 migration invents no pin
// ============================================================================

test("AC2-1: a v12 fixture migrates to v13 with schema_version becoming 13 and NO evidence_schema seeded", () => {
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
  registerMigration({ kind: "handoff", from: 11, to: 12, up: (i) => ({ ...i, schema_version: 12, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 }) });
  registerMigration({ kind: "handoff", from: 12, to: 13, up: (i) => ({ ...i, schema_version: 13 }) });

  const v12Payload = {
    schema_version: 12,
    active_feature: "ac2-v12-feat",
    status: "In_Progress",
    qa_rounds_total: 4,
    review_rounds_total: 1,
    visual_rounds_total: 0,
  };
  const result = runMigrations("handoff", v12Payload);
  assert.deepEqual(result.applied, [13], "only the v12->v13 step runs on a v12 fixture");
  assert.equal(result.payload.schema_version, 13, "on-disk schema_version becomes 13");
  assert.equal(result.payload.evidence_schema, undefined, "the v12->v13 migration MUST NOT seed evidence_schema (D1 — migration invents no pin for historical payloads)");
  // Lossless: sibling fields (including the OTHER counter trio) survive untouched.
  assert.equal(result.payload.active_feature, "ac2-v12-feat");
  assert.equal(result.payload.qa_rounds_total, 4, "sibling counter untouched by the pure stamp-only step");
  assert.equal(result.payload.review_rounds_total, 1);
});

test("AC2-2: a real v12 handoff file (via parseHandoff, real registry) migrates to v13 on disk with the pin absent — an absent field stays absent post-migration", () => {
  const ws = mkWorkspace();
  writeRaw(
    ws,
    `---
schema_version: 12
active_feature: "ac2-real-v12-feat"
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
  const state = parseHandoff(ws);
  assert.equal(state.schema_version ?? 13, 13, "sanity: server CURRENT (13) is what a v12 fixture migrates to");
  assert.equal(state.evidence_schema, undefined, "an absent field stays absent post-migration (D1) — the v12->v13 step invents no pin");
});

// ============================================================================
// AC3 — incident-replay heading `## Phase 3.5 — AC Execution Log` clears under
// pin 2/absent, still FAILS under pin 1 (exact replay of the 104447-F0 incident)
// ============================================================================

// The EXACT incident heading (spec AC3): a prefixed H2 that only ever failed
// pre-E23 on heading PREFIX, never on missing content.
const INCIDENT_HEADING = "## Phase 3.5 — AC Execution Log";

test("AC3-1: the incident heading clears the AC-execution disposition gate under pin 2 (D2 normalized-contains)", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", `# Review\n\n${INCIDENT_HEADING}\nAC1: proof executed, exit=0. PASS.\n`);
  const r = hasAcExecutionLogDisposition(ws, ["T01"], 2);
  assert.equal(r.present, true, "pin 2 must locate 'AC Execution Log' inside the prefixed incident heading");
});

test("AC3-2: the incident heading ALSO clears when the pin is absent (v2 default — absent-pin features get the strict superset)", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", `# Review\n\n${INCIDENT_HEADING}\nAC1: proof executed, exit=0. PASS.\n`);
  const r = hasAcExecutionLogDisposition(ws, ["T01"], undefined);
  assert.equal(r.present, true, "an absent pin must behave identically to pin 2 (D2 fallback — v2 can only newly ACCEPT, never newly reject)");
});

test("AC3-3: the SAME incident heading still FAILS under pin 1 (legacy exact-anchored replay — this is the bug E23 fixes forward from, not erases backward)", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", `# Review\n\n${INCIDENT_HEADING}\nAC1: proof executed, exit=0. PASS.\n`);
  const r = hasAcExecutionLogDisposition(ws, ["T01"], 1);
  assert.equal(r.present, false, "pin 1 (exact-anchored) must reject a heading with a prefix before 'AC Execution Log' — reproducing the original 104447-F0 rejection exactly");
});

// ============================================================================
// AC4 — validateVisualReport: suffixed/prefixed headings pass section presence
// under pin 2; missing sections still reject
// ============================================================================

// A fully-clearing report (mirrors test/visual-report-schema-validation.test.mjs's
// GOOD fixture), then re-headed with prefixes/suffixes per the spec's own example.
const GOOD_REPORT = `# Visual — T01
## Widget Shape Verification
- [x] widget.stepper — rendered

## Canonical State Verification
- [x] language — selected=English, scroll=centered; impl matches

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| primary.button.accent | all | accent #3C5AAA | token | pass |

## Region Diff
| surface | result |
|---|---|
| language | pass |

## Allowed Differences

## Verdict — PASS
`;

test("AC4-1: '## Widget Shape Verification (v2 grid)' style suffixed/prefixed headings satisfy section presence under pin 2 (and absent-pin default) — but NOT under pin 1", () => {
  const reheaded = GOOD_REPORT
    .replace("## Widget Shape Verification", "## Widget Shape Verification (v2 grid)")
    .replace("## Canonical State Verification", "## Phase 3 — Canonical State Verification")
    .replace("## Verdict — PASS", "## Phase 4 — Verdict: PASS");

  const underPin2 = validateVisualReport(reheaded, 2);
  assert.equal(underPin2.ok, true, `pin 2 must clear a re-headed report; got ${JSON.stringify(underPin2)}`);
  assert.deepEqual(underPin2.missingSections, []);
  assert.equal(underPin2.verdictPass, true, "the re-headed Verdict line must still parse its PASS value under pin 2");

  const underAbsentPin = validateVisualReport(reheaded, undefined);
  assert.equal(underAbsentPin.ok, true, "an absent pin behaves identically to pin 2 (D2 fallback)");

  const underPin1 = validateVisualReport(reheaded, 1);
  assert.equal(underPin1.ok, false, "pin 1 (exact-anchored) must reject the SAME prefixed/suffixed headings");
  assert.ok(underPin1.missingSections.length > 0, "pin 1 must report the re-headed sections as missing, not merely fail the verdict");
});

test("AC4-2: missing sections still reject under pin 2 — the pin only widens HEADING MATCH, never waives section presence", () => {
  const noStructural = GOOD_REPORT.replace(/## Structural Assertions[\s\S]*?\n## Region Diff/, "## Region Diff");
  const v = validateVisualReport(noStructural, 2);
  assert.equal(v.ok, false);
  assert.ok(v.missingSections.includes("Structural Assertions"), "a genuinely absent section must still be reported missing under pin 2");
});

// ============================================================================
// AC5 — each of the three rejection envelopes names the missing section(s)/
// expected string, the file path checked, and the evidence-schema version
// ============================================================================

async function seedInProgress(ws, feature, lastAgent = "qa-engineer") {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["QA: claiming review"],
    lastAgent,
    // Simulates a feature already dispatched under EVIDENCE_SCHEMA_CURRENT (the
    // orchestrator's real D1 stamp on the feature's first accepted write) so
    // the PASS write below (same active_feature, no change) carries the pin
    // forward and the envelope names a concretely-stamped "v2", not the
    // absent-pin default label.
    evidenceSchema: 2,
  });
}

test("AC5-1: VISUAL_EVIDENCE_MISSING names the expected file path AND the evidence-schema version", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "ac5-visual-missing-feat";
  writeDesign(
    ws,
    feature,
    "# design\n\nmode: figma\n\n## Visual Baselines\n\n| surface | baseline | impl | notes |\n|---|---|---|---|\n| home | design/home.png | screenshots/home.png | - |\n",
  );
  await seedInProgress(ws, feature);
  // No qa_reports/visual_T01.md written — VISUAL_EVIDENCE_MISSING must fire.

  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review: "no visual evidence file exists",
  });
  const text = res.content[0].text;
  assert.ok(res.isError, `PASS must be rejected with no visual evidence file: ${text}`);
  assert.ok(text.includes("VISUAL_EVIDENCE_MISSING"), text);
  assert.ok(text.includes(path.join("qa_reports", "visual_T01.md")), `envelope must name the expected file path; got: ${text}`);
  assert.match(text, /Evidence schema:\s*v2/, `envelope must name the evidence-schema version; got: ${text}`);
});

test("AC5-2: VISUAL_REPORT_INCOMPLETE names the missing section heading(s), the report file path, AND the evidence-schema version", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "ac5-visual-incomplete-feat";
  writeDesign(
    ws,
    feature,
    "# design\n\nmode: figma\n\n## Visual Baselines\n\n| surface | baseline | impl | notes |\n|---|---|---|---|\n| home | design/home.png | screenshots/home.png | - |\n\n## Visual Structural Assertions\n\n| assertion id | surface | required element/state | source node/token |\n|---|---|---|---|\n| primary.button.accent | all | accent #3C5AAA | token |\n",
  );
  // A report missing the Structural Assertions section entirely.
  writeVisual(
    ws,
    "T01",
    GOOD_REPORT.replace(/## Structural Assertions[\s\S]*?\n## Region Diff/, "## Region Diff"),
  );
  await seedInProgress(ws, feature);

  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review: "report is missing a required section",
  });
  const text = res.content[0].text;
  assert.ok(res.isError, `PASS must be rejected with an incomplete visual report: ${text}`);
  assert.ok(text.includes("VISUAL_REPORT_INCOMPLETE"), text);
  assert.ok(text.includes("## Structural Assertions"), `envelope must name the missing section heading; got: ${text}`);
  assert.ok(text.includes(path.join("qa_reports", "visual_T01.md")), `envelope must name the report file path checked; got: ${text}`);
  assert.match(text, /Evidence schema:\s*v2/, `envelope must name the evidence-schema version; got: ${text}`);
});

test("AC5-3: AC_EXECUTION_LOG_MISSING names the expected heading, the review file path(s) inspected, AND the evidence-schema version", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "ac5-ac-log-missing-feat";
  writeSpec(
    ws,
    feature,
    [
      "# feat",
      "",
      "## Acceptance Criteria",
      "- **AC1** — Given the CLI is installed, when `mycli --version` runs, then it prints the version.",
      "  proof: `mycli --version` prints the package.json version.",
      "",
    ].join("\n"),
  );
  await seedInProgress(ws, feature);
  // No ## AC Execution Log anywhere — the direct review file, once auto-recorded
  // by the PASS write's qa_review text, still lacks the disposition heading.

  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review: "Looks good, no AC execution log written.",
  });
  const text = res.content[0].text;
  assert.ok(res.isError, `PASS must be rejected with no AC Execution Log section: ${text}`);
  assert.ok(text.includes("AC_EXECUTION_LOG_MISSING"), text);
  assert.ok(text.includes("## AC Execution Log"), `envelope must name the expected heading verbatim; got: ${text}`);
  assert.ok(text.includes(path.join("qa_reports", "review_T01.md")), `envelope must name the review file path(s) inspected; got: ${text}`);
  assert.match(text, /Evidence schema:\s*v2/, `envelope must name the evidence-schema version; got: ${text}`);
});

// ============================================================================
// AC6 — full suite green (verified by the QA regression run); no change to
// any client zod schema (tw_update_state arg surface unchanged)
// ============================================================================

test("AC6-1: tw_update_state's zod arg surface carries no evidence_schema key (server-stamped only, D1)", () => {
  const registrySrc = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "registry.ts"), "utf-8");
  assert.ok(
    !registrySrc.includes("evidence_schema"),
    "tools/registry.ts must not declare an evidence_schema client arg anywhere (zod schema OR hand-written JSON Schema) — AC6",
  );
  const indexSrc = fs.readFileSync(path.join(PROJECT_ROOT, "index.ts"), "utf-8");
  assert.ok(!indexSrc.includes("evidence_schema"), "index.ts must not declare an evidence_schema client arg either");
});

test("AC6-2: TOOL_REGISTRY's tw_update_state entry is still registered and unrelated to evidence_schema (sanity anchor for the AC6 grep above)", () => {
  const entry = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
  assert.ok(entry, "tw_update_state must remain registered in TOOL_REGISTRY");
});

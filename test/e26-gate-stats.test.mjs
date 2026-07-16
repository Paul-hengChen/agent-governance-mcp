// Coded by @qa-engineer
// Tests for backlog E26 (104447-F0 §4-D) / T-E26-01/02/03: `tw_gate_stats`,
// the per-gate fire-count coverage reader over `.current/telemetry.jsonl`
// (D3 gate fires) + `.current/metrics.jsonl` (E8 per-feature outcomes).
// T-E26-01 is `computeGateStats()` (tools/gate-stats.ts); T-E26-02 is the
// `tw_gate_stats` A1 registry entry (tools/registry.ts, no index.ts edit);
// T-E26-03 is doc alignment (docs/gate-retro-procedure.md + CLAUDE.md roster)
// — content-only, not test-bearing here (no prose-pin precedent exists for
// this doc; see review_reports/review_T-E26-01.md for the reviewer's
// independent verification of the doc edit).
//
// Load-bearing invariant under test throughout (the "coverage reader"
// contract): every GATE_REGISTRY code lands in EXACTLY ONE of `fired` /
// `zero_fire` — the retro adjudicates zero-fire codes, so they must be
// enumerated, never silently omitted or double-counted. The second
// load-bearing invariant is the structural category boundary: prose-
// behavioral rules carry `fires: null` (never `0`), so a reader can never
// conflate "not measured" with "never fired". Never-throws (the
// tools/exemptions.ts loader posture) is the fail-direction for malformed
// input and missing sidecars — no failure mode may block a retro.
//
// Spec-to-test map (backlog E26 row + code-reviewer's APPROVED
// review_reports/review_T-E26-01.md, which independently verified the
// registry-coverage, never-throws, and dedupe-collision-safety properties):
//   registry coverage: 32/32, no dupes across fired/zero_fire -> R1-R3
//   fired bucketing + sort order (desc, ties -> catalog order)  -> F1-F3
//   zero_fire bucketing + catalog order                          -> F1, F4
//   by_feature / by_agent / first_ts / last_ts accumulation      -> F5
//   unregistered-code bucket                                     -> U1
//   prose_behavioral fires:null invariant (never 0)               -> P1-P2
//   malformed-line handling (never throws, loud counting)         -> M1-M4
//   missing-sidecar degradation (never throws, honest caveats)    -> D1-D2
//   metrics dedupe on (feature, released_version)                 -> DE1-DE3
//   one_pass strict-boolean coercion                               -> DE4
//   mean/rate null-on-zero-features                                -> DE5
//   tw_gate_stats registry registration (A1, count 12)             -> T1-T2
//   handleGateStats MCP handler shape                               -> T3

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  computeGateStats,
  handleGateStats,
  PROSE_BEHAVIORAL_RULES,
} from "../dist/tools/gate-stats.js";
import { GATE_REGISTRY } from "../dist/gates/registry.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

function mkWorkspace(prefix = "e26-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function telemetryPath(ws) {
  return path.join(ws, ".current", "telemetry.jsonl");
}

function metricsPath(ws) {
  return path.join(ws, ".current", "metrics.jsonl");
}

// Each entry may be a plain object (JSON.stringify'd) or a raw string (for
// injecting malformed lines verbatim).
function writeLines(filePath, entries) {
  const lines = entries.map((e) => (typeof e === "string" ? e : JSON.stringify(e)));
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

function telemetryEvent({ ts, gate = "orchestrator", error_code, agent_id = "sr-engineer", feature = "f1" }) {
  return { ts, gate, error_code, agent_id, feature };
}

function metricRecord({
  ts = "2026-07-16T00:00:00.000Z",
  feature,
  tickets = 3,
  qa_rounds = 0,
  review_rounds = 0,
  visual_rounds = 0,
  hops = 4,
  one_pass = true,
  released_version = "3.88.0",
}) {
  return { ts, feature, tickets, qa_rounds, review_rounds, visual_rounds, hops, one_pass, released_version };
}

// ============================================================================
// R1-R3 — full GATE_REGISTRY coverage (T-E26-01)
// ============================================================================

test("R1: with zero telemetry, EVERY GATE_REGISTRY code lands in zero_fire, fired is empty, count is 32", () => {
  const ws = mkWorkspace();
  const report = computeGateStats(ws);
  assert.equal(GATE_REGISTRY.length, 32, "sanity: registry is 32 entries as of this ticket");
  assert.equal(report.fired.length, 0);
  assert.equal(report.zero_fire.length, 32);
});

test("R2: fired.length + zero_fire.length === 32 always, and the two sets are disjoint (no code counted twice)", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:01.000Z", error_code: "FEATURE_LEASE_HELD" }),
    telemetryEvent({ ts: "2026-07-16T01:00:02.000Z", error_code: "FEATURE_LEASE_HELD" }),
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.fired.length + report.zero_fire.length, 32, "coverage must sum to the full registry every time");
  const firedCodes = new Set(report.fired.map((f) => f.error_code));
  const zeroCodes = new Set(report.zero_fire);
  assert.equal(firedCodes.size, report.fired.length, "no duplicate codes within fired");
  assert.equal(zeroCodes.size, report.zero_fire.length, "no duplicate codes within zero_fire");
  for (const code of firedCodes) {
    assert.ok(!zeroCodes.has(code), `${code} must not appear in both fired and zero_fire`);
  }
  const allRegistryCodes = new Set(GATE_REGISTRY.map((g) => g.errorCode));
  const unionCodes = new Set([...firedCodes, ...zeroCodes]);
  assert.deepEqual([...unionCodes].sort(), [...allRegistryCodes].sort(), "fired ∪ zero_fire must equal exactly GATE_REGISTRY's code set");
});

test("R3: zero_fire enumerates codes in GATE_REGISTRY catalog order (not sorted alphabetically or by any other key)", () => {
  const ws = mkWorkspace();
  // Fire only the LAST catalog code so every other code stays zero-fire in order.
  const lastCode = GATE_REGISTRY[GATE_REGISTRY.length - 1].errorCode;
  writeLines(telemetryPath(ws), [telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: lastCode })]);
  const report = computeGateStats(ws);
  const expectedZeroOrder = GATE_REGISTRY.map((g) => g.errorCode).filter((c) => c !== lastCode);
  assert.deepEqual(report.zero_fire, expectedZeroOrder, "zero_fire order must mirror GATE_REGISTRY's array order with the fired code removed");
});

// ============================================================================
// F1-F5 — fired bucketing, sort order, and per-fire accumulation
// ============================================================================

test("F1: fired/zero_fire bucketing is exact — fired codes have real counts, zero_fire codes are absent from fired entirely", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:01.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:02.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:03.000Z", error_code: "MISSING_EVIDENCE" }),
  ]);
  const report = computeGateStats(ws);
  const rejected = report.fired.find((f) => f.error_code === "TRANSITION_REJECTED");
  const evidence = report.fired.find((f) => f.error_code === "MISSING_EVIDENCE");
  assert.equal(rejected.fires, 3);
  assert.equal(evidence.fires, 1);
  assert.ok(!report.zero_fire.includes("TRANSITION_REJECTED"));
  assert.ok(!report.zero_fire.includes("MISSING_EVIDENCE"));
  assert.ok(report.zero_fire.includes("HOP_CAP_EXCEEDED"), "codes never fired must still be enumerated in zero_fire");
});

test("F2: fired is sorted by fires descending (retro step 3 'rank by fire count')", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "HOP_CAP_EXCEEDED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:01.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:02.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:03.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:04.000Z", error_code: "FEATURE_LEASE_HELD" }),
    telemetryEvent({ ts: "2026-07-16T01:00:05.000Z", error_code: "FEATURE_LEASE_HELD" }),
  ]);
  const report = computeGateStats(ws);
  const codesInOrder = report.fired.map((f) => f.error_code);
  assert.deepEqual(codesInOrder, ["TRANSITION_REJECTED", "FEATURE_LEASE_HELD", "HOP_CAP_EXCEEDED"], "must be strictly descending by fire count: 3, 2, 1");
});

test("F3: ties in fire count preserve GATE_REGISTRY catalog order (stable sort, not insertion/alphabetical order)", () => {
  const ws = mkWorkspace();
  // AGENT_ID_REQUIRED (index 0) and TRANSITION_REJECTED (index 1) both get
  // exactly 1 fire; TRANSITION_REJECTED's event is written FIRST so an
  // unstable or insertion-order sort would misplace it ahead of
  // AGENT_ID_REQUIRED. Catalog order must win regardless of write order.
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:01.000Z", error_code: "AGENT_ID_REQUIRED" }),
  ]);
  const report = computeGateStats(ws);
  const tiedCodes = report.fired.filter((f) => f.error_code === "AGENT_ID_REQUIRED" || f.error_code === "TRANSITION_REJECTED").map((f) => f.error_code);
  assert.deepEqual(tiedCodes, ["AGENT_ID_REQUIRED", "TRANSITION_REJECTED"], "tied fire counts must resolve to catalog order, not telemetry write order");
});

test("F4: fired entries carry the registry `producer` field from GATE_REGISTRY, not from the telemetry line's own `gate` field", () => {
  const ws = mkWorkspace();
  const def = GATE_REGISTRY.find((g) => g.errorCode === "TRANSITION_REJECTED");
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED", gate: "totally-different-string" }),
  ]);
  const report = computeGateStats(ws);
  const entry = report.fired.find((f) => f.error_code === "TRANSITION_REJECTED");
  assert.equal(entry.producer, def.producer, "producer must be sourced from GATE_REGISTRY, the authoritative catalog");
  assert.equal(entry.category, "gate-backed");
});

test("F5: by_feature / by_agent / first_ts / last_ts accumulate correctly across multiple fires of the same code", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED", agent_id: "sr-engineer", feature: "f1" }),
    telemetryEvent({ ts: "2026-07-16T03:00:00.000Z", error_code: "TRANSITION_REJECTED", agent_id: "sr-engineer", feature: "f2" }),
    telemetryEvent({ ts: "2026-07-16T02:00:00.000Z", error_code: "TRANSITION_REJECTED", agent_id: "qa-engineer", feature: "f1" }),
  ]);
  const report = computeGateStats(ws);
  const entry = report.fired.find((f) => f.error_code === "TRANSITION_REJECTED");
  assert.equal(entry.fires, 3);
  assert.deepEqual(entry.by_feature, { f1: 2, f2: 1 });
  assert.deepEqual(entry.by_agent, { "sr-engineer": 2, "qa-engineer": 1 });
  assert.equal(entry.first_ts, "2026-07-16T01:00:00.000Z", "first_ts must be the lexicographically-earliest ISO timestamp, not write order");
  assert.equal(entry.last_ts, "2026-07-16T03:00:00.000Z", "last_ts must be the lexicographically-latest ISO timestamp, not write order");
  assert.equal(report.telemetry.total_fires, 3);
  assert.equal(report.telemetry.first_ts, "2026-07-16T01:00:00.000Z");
  assert.equal(report.telemetry.last_ts, "2026-07-16T03:00:00.000Z");
});

// ============================================================================
// U1 — unregistered-code bucket
// ============================================================================

test("U1: an error_code absent from today's GATE_REGISTRY lands in `unregistered`, never in fired/zero_fire, and never breaks 32/32 coverage", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "SOME_RETIRED_CODE_NO_LONGER_IN_REGISTRY", feature: "old-feat" }),
    telemetryEvent({ ts: "2026-07-16T01:00:01.000Z", error_code: "SOME_RETIRED_CODE_NO_LONGER_IN_REGISTRY", feature: "old-feat" }),
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.unregistered.length, 1);
  assert.equal(report.unregistered[0].error_code, "SOME_RETIRED_CODE_NO_LONGER_IN_REGISTRY");
  assert.equal(report.unregistered[0].fires, 2);
  assert.equal(report.unregistered[0].category, "unregistered");
  assert.ok(!report.zero_fire.includes("SOME_RETIRED_CODE_NO_LONGER_IN_REGISTRY"));
  assert.ok(!report.fired.some((f) => f.error_code === "SOME_RETIRED_CODE_NO_LONGER_IN_REGISTRY"));
  assert.equal(report.fired.length + report.zero_fire.length, 32, "an unregistered code must not perturb full-registry coverage");
});

// ============================================================================
// P1-P2 — prose_behavioral structural fires:null invariant
// ============================================================================

test("P1: every prose_behavioral rule has fires strictly null (never 0, never a number) — the structural category boundary", () => {
  const ws = mkWorkspace();
  const report = computeGateStats(ws);
  assert.ok(report.prose_behavioral.length >= 1, "at least one prose-behavioral rule must be catalogued");
  for (const rule of report.prose_behavioral) {
    assert.equal(rule.fires, null, `rule "${rule.rule}" must have fires===null`);
    assert.notEqual(rule.fires, 0, `rule "${rule.rule}" fires must never be coerced to 0`);
    assert.equal(rule.category, "prose-behavioral");
    assert.ok(typeof rule.where === "string" && rule.where.length > 0);
    assert.ok(typeof rule.adjudication === "string" && rule.adjudication.length > 0);
  }
});

test("P2: prose_behavioral output is identical regardless of telemetry content — no amount of gate-backed fires can populate it", () => {
  const wsEmpty = mkWorkspace();
  const wsBusy = mkWorkspace();
  writeLines(telemetryPath(wsBusy), [
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" }),
    telemetryEvent({ ts: "2026-07-16T01:00:01.000Z", error_code: "FEATURE_LEASE_HELD" }),
  ]);
  const emptyReport = computeGateStats(wsEmpty);
  const busyReport = computeGateStats(wsBusy);
  assert.deepEqual(emptyReport.prose_behavioral, busyReport.prose_behavioral);
  assert.deepEqual(emptyReport.prose_behavioral, PROSE_BEHAVIORAL_RULES);
});

// ============================================================================
// M1-M4 — malformed-line handling (never throws, loud counting)
// ============================================================================

test("M1: bad JSON, non-object roots (array/string/number/null), and blank lines are handled without throwing; malformed count is exact", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    "{ this is not valid json",
    "[]",
    '"just a string"',
    "42",
    "null",
    "", // blank line — NOT malformed, simply skipped
    telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" }),
  ]);
  let report;
  assert.doesNotThrow(() => {
    report = computeGateStats(ws);
  }, "computeGateStats must never throw on malformed telemetry lines");
  assert.equal(report.telemetry.lines_malformed, 5, "the 5 non-object/bad-JSON lines must all count as malformed; the blank line must not");
  assert.equal(report.telemetry.lines_total, 6, "lines_total counts non-blank lines only (5 malformed + 1 well-formed)");
  assert.equal(report.telemetry.total_fires, 1, "only the one well-formed fire event counts toward total_fires");
});

test("M2: a well-formed JSON object lacking error_code is NOT counted as malformed and NOT counted as a fire (silently skipped as a non-fire event)", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [
    { ts: "2026-07-16T01:00:00.000Z", gate: "orchestrator", agent_id: "sr-engineer", feature: "f1" }, // no error_code
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.telemetry.lines_malformed, 0, "a well-formed object without error_code is not malformed JSON");
  assert.equal(report.telemetry.total_fires, 0, "an object with no error_code is not a fire event");
  assert.equal(report.telemetry.lines_total, 1);
});

test("M3: malformed metrics.jsonl lines are handled without throwing and counted separately from telemetry's malformed count", () => {
  const ws = mkWorkspace();
  writeLines(metricsPath(ws), ["not json at all", "[1,2,3]", metricRecord({ feature: "good-feat" })]);
  let report;
  assert.doesNotThrow(() => {
    report = computeGateStats(ws);
  });
  assert.equal(report.metrics.lines_malformed, 2);
  assert.equal(report.metrics.lines_total, 3);
  assert.equal(report.metrics.features, 1);
});

test("M4: an unreadable (permission-denied) sidecar never throws — degrades to the same posture as a malformed/missing file", () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" })]);
  fs.chmodSync(telemetryPath(ws), 0o200); // write-only: readFileSync should fail EACCES (root may bypass)
  let report;
  try {
    assert.doesNotThrow(() => {
      report = computeGateStats(ws);
    }, "computeGateStats must never throw, even on an unreadable sidecar");
  } finally {
    fs.chmodSync(telemetryPath(ws), 0o644); // restore for cleanup
  }
  assert.ok(report, "computeGateStats must always return a value");
  // Sandbox-agnostic: whichever branch actually ran must be internally
  // consistent (root may bypass the permission bit and read through cleanly).
  if (!report.telemetry.exists) {
    assert.equal(report.telemetry.total_fires, 0);
  } else {
    assert.equal(report.telemetry.total_fires, 1, "if permission enforcement was bypassed, the underlying valid line must still parse");
  }
});

// ============================================================================
// D1-D2 — missing-sidecar degradation
// ============================================================================

test("D1: both sidecars absent -> never throws, full 32-code zero_fire coverage, zero counts, honest exists:false + caveats naming both paths", () => {
  const ws = mkWorkspace();
  let report;
  assert.doesNotThrow(() => {
    report = computeGateStats(ws);
  });
  assert.equal(report.telemetry.exists, false);
  assert.equal(report.metrics.exists, false);
  assert.equal(report.fired.length, 0);
  assert.equal(report.zero_fire.length, 32, "coverage must hold even with zero telemetry data — a young workspace is not an error");
  assert.equal(report.metrics.features, 0);
  assert.equal(report.metrics.one_pass_rate, null, "no fake 0% when there is no data");
  assert.ok(report.caveats.some((c) => c.includes("No telemetry yet") && c.includes(telemetryPath(ws))));
  assert.ok(report.caveats.some((c) => c.includes("No metrics yet") && c.includes(metricsPath(ws))));
});

test("D2: only metrics.jsonl present (telemetry absent) -> telemetry side degrades independently, metrics side still fully populated", () => {
  const ws = mkWorkspace();
  writeLines(metricsPath(ws), [metricRecord({ feature: "solo-feat" })]);
  const report = computeGateStats(ws);
  assert.equal(report.telemetry.exists, false);
  assert.equal(report.metrics.exists, true);
  assert.equal(report.metrics.features, 1);
  assert.equal(report.zero_fire.length, 32);
  assert.ok(report.caveats.some((c) => c.includes("No telemetry yet")));
  assert.ok(!report.caveats.some((c) => c.includes("No metrics yet")), "metrics caveat must not fire when the sidecar is present");
});

// ============================================================================
// DE1-DE5 — metrics dedupe + coercion + null-safe aggregates
// ============================================================================

test("DE1: an exact duplicate (feature, released_version) pair is deduped at read time; duplicates_skipped counts it", () => {
  const ws = mkWorkspace();
  writeLines(metricsPath(ws), [
    metricRecord({ feature: "e8-dup", released_version: "3.50.0" }),
    metricRecord({ feature: "e8-dup", released_version: "3.50.0" }), // exact duplicate key
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.metrics.features, 1, "the duplicate pair must collapse to one feature outcome");
  assert.equal(report.metrics.duplicates_skipped, 1);
});

test("DE2: released_version:null is a distinct, stable key value (not a wildcard) — a second null-version emit for the same feature also dedupes", () => {
  const ws = mkWorkspace();
  writeLines(metricsPath(ws), [
    metricRecord({ feature: "unreleased-feat", released_version: null }),
    metricRecord({ feature: "unreleased-feat", released_version: null }),
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.metrics.features, 1);
  assert.equal(report.metrics.duplicates_skipped, 1);
  assert.equal(report.metrics.per_feature[0].released_version, null);
});

test("DE3: the dedupe key is collision-safe — JSON.stringify([feature,version]) must not conflate a raw string-join collision (\"a|b\"+null vs \"a\"+\"b|null\")", () => {
  const ws = mkWorkspace();
  writeLines(metricsPath(ws), [
    metricRecord({ feature: "a|b", released_version: null }),
    metricRecord({ feature: "a", released_version: "b|null" }),
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.metrics.features, 2, "a raw '|'-joined key would collide these two distinct (feature, version) pairs; the tuple-safe key must not");
  assert.equal(report.metrics.duplicates_skipped, 0);
});

test("DE4: one_pass is strict-boolean-true only — a truthy non-boolean value (e.g. the string \"true\") must read as false, no truthy coercion", () => {
  const ws = mkWorkspace();
  writeLines(metricsPath(ws), ['{"feature":"str-onepass","tickets":1,"qa_rounds":0,"review_rounds":0,"visual_rounds":0,"hops":1,"one_pass":"true","released_version":"1.0.0"}']);
  const report = computeGateStats(ws);
  assert.equal(report.metrics.per_feature[0].one_pass, false, "the string \"true\" must not be coerced to boolean true");
  assert.equal(report.metrics.one_pass_count, 0);
  assert.equal(report.metrics.one_pass_rate, 0);
});

test("DE5: mean_* and one_pass_rate are null (not 0 or NaN) when zero features exist; populated correctly otherwise", () => {
  const wsEmpty = mkWorkspace();
  const emptyReport = computeGateStats(wsEmpty);
  assert.equal(emptyReport.metrics.one_pass_rate, null);
  assert.equal(emptyReport.metrics.mean_qa_rounds, null);
  assert.equal(emptyReport.metrics.mean_review_rounds, null);
  assert.equal(emptyReport.metrics.mean_visual_rounds, null);
  assert.equal(emptyReport.metrics.mean_hops, null);

  const ws = mkWorkspace();
  writeLines(metricsPath(ws), [
    metricRecord({ feature: "f1", qa_rounds: 0, review_rounds: 0, visual_rounds: 0, hops: 4, one_pass: true, released_version: "1.0.0" }),
    metricRecord({ feature: "f2", qa_rounds: 2, review_rounds: 1, visual_rounds: 0, hops: 8, one_pass: false, released_version: "1.0.1" }),
  ]);
  const report = computeGateStats(ws);
  assert.equal(report.metrics.features, 2);
  assert.equal(report.metrics.one_pass_count, 1);
  assert.equal(report.metrics.one_pass_rate, 0.5);
  assert.equal(report.metrics.mean_qa_rounds, 1);
  assert.equal(report.metrics.mean_review_rounds, 0.5);
  assert.equal(report.metrics.mean_visual_rounds, 0);
  assert.equal(report.metrics.mean_hops, 6);
});

// ============================================================================
// T1-T3 — tw_gate_stats registry registration (T-E26-02, A1 pattern)
// ============================================================================

test("T1: TOOL_REGISTRY contains tw_gate_stats, wired to run the same aggregation as handleGateStats, with a WorkspaceOnly-shaped input schema", async () => {
  const entry = TOOL_REGISTRY.find((e) => e.name === "tw_gate_stats");
  assert.ok(entry, "tw_gate_stats must be registered in TOOL_REGISTRY");
  assert.deepEqual(entry.inputSchema.required, ["workspace_path"]);
  assert.ok("workspace_path" in entry.inputSchema.properties);
  // defineTool() erases the concrete handler reference behind a `run`
  // closure (spec.handler is not re-exposed on the entry) — so identity
  // can't be asserted directly. Behavioral equivalence is the honest check:
  // entry.run() must dispatch to the exact same computeGateStats() report
  // handleGateStats() itself would produce for the same workspace.
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "MISSING_EVIDENCE" })]);
  const viaRegistry = await entry.run({ workspace_path: ws });
  const viaHandler = await handleGateStats({ workspace_path: ws });
  assert.deepEqual(JSON.parse(viaRegistry.content[0].text), JSON.parse(viaHandler.content[0].text));
});

test("T2: TOOL_REGISTRY has exactly 12 entries (11 pre-E26 + tw_gate_stats) — the A1 registration must not duplicate or drop any prior tool", () => {
  assert.equal(TOOL_REGISTRY.length, 12);
  const names = TOOL_REGISTRY.map((e) => e.name);
  assert.equal(new Set(names).size, 12, "no duplicate tool names");
  assert.ok(names.includes("tw_gate_stats"));
  // The 11 pre-existing tools must all still be present (no accidental drop).
  for (const priorName of [
    "tw_get_state",
    "tw_update_state",
    "tw_get_next_task",
    "tw_complete_task",
    "tw_add_task",
    "tw_rollback_task",
    "tw_detect_drift",
    "tw_sync",
    "tw_switch_role",
    "tw_index_prd",
    "tw_clear_prd_chunks",
  ]) {
    assert.ok(names.includes(priorName), `pre-existing tool ${priorName} must remain registered`);
  }
});

test("T3: handleGateStats returns a ToolResult whose text is valid JSON matching computeGateStats's own output for the same workspace", async () => {
  const ws = mkWorkspace();
  writeLines(telemetryPath(ws), [telemetryEvent({ ts: "2026-07-16T01:00:00.000Z", error_code: "TRANSITION_REJECTED" })]);
  const result = await handleGateStats({ workspace_path: ws });
  assert.ok(Array.isArray(result.content));
  assert.equal(result.content[0].type, "text");
  const parsed = JSON.parse(result.content[0].text);
  const direct = computeGateStats(ws);
  assert.deepEqual(parsed, direct, "the MCP handler must not alter or subset computeGateStats's report");
});

test("T3b: handleGateStats never throws even against a workspace with no .current directory at all", async () => {
  const bareWs = fs.mkdtempSync(path.join(os.tmpdir(), "e26-bare-"));
  let result;
  await assert.doesNotReject(async () => {
    result = await handleGateStats({ workspace_path: bareWs });
  });
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.zero_fire.length, 32);
});

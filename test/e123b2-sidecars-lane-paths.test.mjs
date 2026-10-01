// Coded by @qa-engineer
// Tests that the telemetry and metrics sidecar files are located through the lane-path resolver (no separate spec file).
// AC1: telemetryPath()/metricsPath() derive their location only from resolveCurrentLanePaths(workspacePath), never a hand-rolled
// path.join(workspacePath, ".current", "<literal>"). Since the lane flip the location does depend on the branch's lane (LANE1/LANE2/LANE3),
// but still only through the resolver. AC4 maps to LANE1 (feat/e999-x) and LANE2 (main).
// Rationale: specs/e260f-comment-rationale.md (test/e123b2-sidecars-lane-paths.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { emitGateTelemetry } from "../dist/tools/telemetry.js";
import { emitFeatureMetrics } from "../dist/tools/metrics.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

// Hand-built `.git/HEAD` (no `git init` needed — resolveCurrentLane only ever
// does statSync/readFileSync on `.git` and HEAD, per tools/lane-paths.ts's
// headFilePath doc comment; a real git init is explicitly not required).
function mkLaneWorkspace(branch, prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".git"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
  // emitFeatureMetrics's outer try/catch treats a missing tasks.md as a
  // whole-record no-op (it reads tasks.md before ever reaching
  // fs.appendFileSync) — give it a minimal, real tasks.md so the write
  // actually happens and we can assert on the sidecar path.
  fs.writeFileSync(path.join(ws, "tasks.md"), "- [x] T-E999-01 placeholder\n");
  return ws;
}

// The sidecar's expected location is now lane-scoped (lane flip, e123b9 J2,
// spec AC1) — derived from resolveCurrentLanePaths itself, so this stays
// the single source of truth rather than a second, independently-restated
// path shape.
function expectedTelemetryPath(ws) {
  return resolveCurrentLanePaths(ws).telemetryPath;
}

function expectedMetricsPath(ws) {
  return resolveCurrentLanePaths(ws).metricsPath;
}

// Assert that emitGateTelemetry/emitFeatureMetrics wrote to EXACTLY the
// lane-scoped <ws>/.current/<lane>/*.jsonl path (AC1/AC4) — no stray file
// anywhere else under the lane dir, and the file that does exist is
// readable/parseable JSONL.
function assertWroteExactlyLaneSidecars(t, ws, label) {
  emitGateTelemetry(ws, "SOME_GATE_CODE", "qa-engineer", "e999-x");
  emitFeatureMetrics({
    workspacePath: ws,
    feature: "e999-x",
    qaRoundsTotal: 0,
    reviewRoundsTotal: 0,
    visualRoundsTotal: 0,
    hops: 0,
  });

  const telemetryFile = expectedTelemetryPath(ws);
  const metricsFile = expectedMetricsPath(ws);

  assert.ok(
    fs.existsSync(telemetryFile),
    `[${label}] emitGateTelemetry must write to ${telemetryFile}`,
  );
  assert.ok(
    fs.existsSync(metricsFile),
    `[${label}] emitFeatureMetrics must write to ${metricsFile}`,
  );

  // No sidecar landed anywhere BUT the lane dir itself (e.g. no accidental
  // flat .current/telemetry.jsonl — that would mean a caller reverted to
  // building its own flat path instead of using the resolver's answer).
  const laneDirEntries = fs.readdirSync(path.dirname(telemetryFile)).sort();
  assert.deepEqual(
    laneDirEntries,
    ["metrics.jsonl", "telemetry.jsonl"],
    `[${label}] the lane dir must contain exactly the two sidecar files, found: ${laneDirEntries.join(", ")}`,
  );
  // ...and nothing landed flat at the workspace-root .current/ either.
  const flatDirEntries = fs.readdirSync(path.join(ws, ".current")).filter((f) => f !== path.basename(path.dirname(telemetryFile)) && f !== ".git");
  assert.deepEqual(flatDirEntries, [], `[${label}] no sidecar may land at the retired flat .current/ path, found: ${flatDirEntries.join(", ")}`);

  const telemetryEvent = JSON.parse(
    fs.readFileSync(telemetryFile, "utf-8").trim().split("\n")[0],
  );
  assert.equal(telemetryEvent.error_code, "SOME_GATE_CODE");

  const metricsRecord = JSON.parse(
    fs.readFileSync(metricsFile, "utf-8").trim().split("\n")[0],
  );
  assert.equal(metricsRecord.feature, "e999-x");
}

test("LANE1 (e123b9 J2, spec AC1 — FLIPPED): on a feat/e999-x branch, emitGateTelemetry and emitFeatureMetrics write exactly <ws>/.current/e999/{telemetry,metrics}.jsonl", (t) => {
  const ws = mkLaneWorkspace("feat/e999-x", "e123b2-lane1-");
  assert.equal(path.basename(path.dirname(expectedTelemetryPath(ws))), "e999", "sanity: the branch-derived lane must be e999");
  assertWroteExactlyLaneSidecars(t, ws, "feat/e999-x");
});

test("LANE2 (e123b9 J2, spec AC1 — FLIPPED): on main, emitGateTelemetry and emitFeatureMetrics write exactly <ws>/.current/_primary/{telemetry,metrics}.jsonl (PRIMARY_LANE fallback)", (t) => {
  const ws = mkLaneWorkspace("main", "e123b2-lane2-");
  assert.equal(path.basename(path.dirname(expectedTelemetryPath(ws))), "_primary", "sanity: a non-feat branch must fall back to PRIMARY_LANE");
  assertWroteExactlyLaneSidecars(t, ws, "main");
});

test("LANE3 (e123b9 J2, spec AC1 — FLIPPED, retires the old zero-behaviour-change contract): the two branches resolve to GENUINELY DIFFERENT lane-scoped sidecar locations", () => {
  const wsFeature = mkLaneWorkspace("feat/e999-x", "e123b2-lane3a-");
  const wsMain = mkLaneWorkspace("main", "e123b2-lane3b-");

  emitGateTelemetry(wsFeature, "SOME_GATE_CODE", "qa-engineer", "e999-x");
  emitGateTelemetry(wsMain, "SOME_GATE_CODE", "qa-engineer", "e999-x");

  const relFeature = path.relative(wsFeature, expectedTelemetryPath(wsFeature));
  const relMain = path.relative(wsMain, expectedTelemetryPath(wsMain));
  assert.notEqual(
    relFeature,
    relMain,
    "the sidecar's path relative to its own workspace root must now DIFFER across lanes — the lane argument is load-bearing (AC1), not ignored",
  );
  assert.equal(relFeature, path.join(".current", "e999", "telemetry.jsonl"));
  assert.equal(relMain, path.join(".current", "_primary", "telemetry.jsonl"));
});

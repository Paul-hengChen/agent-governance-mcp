// Coded by @qa-engineer
// e9a-stamp-integrity (T-E9A-05): stampAdvisory behavior — AC3/AC4.
//
// Contract under test: tw_detect_drift's DriftReport gets a new, purely
// additive top-level field, `stampAdvisory: string | null`. Non-null (a plain
// informational string) when `handoff.last_updated` matches the hand-authored
// round-second, zero-millisecond shape (`/T\d{2}:\d{2}:00\.000Z$/` —
// research/e9a-stamp-forensics.md's 5 confirmed hits, round-hour/round-half-
// hour included as a subset); null otherwise, including on every pre-`handoff`
// early return. `driftDetected`/`details`/`tasksCompleted`/`tasksIncomplete`
// must be byte-identical to what they would be without this field.
//
// Tests import detectDrift from the compiled dist (dist/tools/drift.js) and
// construct synthetic file-mode workspaces on tmpfs, mirroring
// test/drift-baseline.test.mjs / test/drift-archived-tasks.test.mjs. They do
// NOT call the live tw_detect_drift MCP tool — the running server may hold a
// stale pre-rebuild dist.
//
// tasks.md MUST begin with "<!-- schema_version: 1 -->" so that
// checkVersionSkew and parseTasks() do not short-circuit before reaching the
// stampAdvisory computation.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { detectDrift } from "../dist/tools/drift.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

// ---------------------------------------------------------------------------
// Helpers (mirroring drift-baseline.test.mjs / drift-archived-tasks.test.mjs)
// ---------------------------------------------------------------------------

/** Create a fresh tmp workspace with .current/ ready. */
function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twdrift-stamp-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

/**
 * Write a handoff.md with the given completed_tasks list via the real
 * writeHandoffState path (so frontmatter shape/migrations are authentic),
 * then splice in a synthetic last_updated value — writeHandoffState always
 * stamps `new Date().toISOString()` itself, so the only way to pin an exact
 * historical/synthetic stamp is a direct post-write string replace, same
 * spirit as writeTasks() below writing tasks.md directly.
 */
async function seedHandoffWithStamp(ws, lastUpdated, completedTasks = []) {
  resetSession();
  parseHandoff(ws); // pre-seed snapshot
  await writeHandoffState(ws, "feat", "In_Progress", completedTasks, [], undefined, "pm", 0);

  const p = path.join(ws, ".current", "handoff.md");
  const raw = fs.readFileSync(p, "utf-8");
  const patched = raw.replace(/^last_updated:\s*".*"$/m, `last_updated: "${lastUpdated}"`);
  assert.notEqual(patched, raw, "last_updated line must be found and replaced in the seeded handoff.md");
  fs.writeFileSync(p, patched, "utf-8");
}

/** Write tasks.md with the schema_version sentinel on line 1. */
function writeTasks(ws, body) {
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    `<!-- schema_version: 1 -->\n${body}`,
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// AC3 — fires on the confirmed hand-authored shapes
// ---------------------------------------------------------------------------

test("AC3: fires (non-null) on the AC3 fixture shape 2026-07-12T01:35:00.000Z", async () => {
  const ws = mkWorkspace();
  writeTasks(ws, "- [x] T1 done\n");
  await seedHandoffWithStamp(ws, "2026-07-12T01:35:00.000Z", ["T1"]);

  const report = JSON.parse(detectDrift(ws));

  assert.ok(typeof report.stampAdvisory === "string" && report.stampAdvisory.length > 0, "stampAdvisory must be a non-empty string");
  assert.ok(report.stampAdvisory.includes("2026-07-12T01:35:00.000Z"), "advisory string must name the suspect stamp");
});

test("AC3: fires (non-null) on a round-hour stamp (2026-07-08T12:00:00.000Z, forensics v3.48.0 hit)", async () => {
  const ws = mkWorkspace();
  writeTasks(ws, "- [x] T1 done\n");
  await seedHandoffWithStamp(ws, "2026-07-08T12:00:00.000Z", ["T1"]);

  const report = JSON.parse(detectDrift(ws));

  assert.ok(typeof report.stampAdvisory === "string" && report.stampAdvisory.length > 0, "round-hour stamp must also fire — it's a subset of seconds:00/ms:000");
});

// ---------------------------------------------------------------------------
// AC4 — null on ms-entropy stamp (the tw_update_state write-path shape)
// ---------------------------------------------------------------------------

test("AC4: null on an ms-entropy stamp (2026-07-13T03:22:38.181Z, the tw_update_state shape)", async () => {
  const ws = mkWorkspace();
  writeTasks(ws, "- [x] T1 done\n");
  await seedHandoffWithStamp(ws, "2026-07-13T03:22:38.181Z", ["T1"]);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.stampAdvisory, null, "millisecond-entropy stamp must not fire the advisory");
});

// ---------------------------------------------------------------------------
// AC3 control — driftDetected/details/tasksCompleted/tasksIncomplete are
// byte-identical regardless of the stamp shape (the advisory is independent
// of the existing drift machinery).
// ---------------------------------------------------------------------------

test("AC3 control: driftDetected/details/tasksCompleted/tasksIncomplete are unaffected by stamp shape (clean case)", async () => {
  const wsHand = mkWorkspace();
  writeTasks(wsHand, "- [x] T1 done\n");
  await seedHandoffWithStamp(wsHand, "2026-07-12T01:35:00.000Z", ["T1"]);
  const reportHand = JSON.parse(detectDrift(wsHand));

  const wsEntropy = mkWorkspace();
  writeTasks(wsEntropy, "- [x] T1 done\n");
  await seedHandoffWithStamp(wsEntropy, "2026-07-13T03:22:38.181Z", ["T1"]);
  const reportEntropy = JSON.parse(detectDrift(wsEntropy));

  assert.equal(reportHand.stampAdvisory !== null, true, "sanity: hand-authored fixture must fire");
  assert.equal(reportEntropy.stampAdvisory, null, "sanity: entropy fixture must not fire");

  // Everything else must be byte-identical between the two fixtures — same
  // genuine (task/handoff) state, only the stamp shape differs.
  assert.deepEqual(reportHand.driftDetected, reportEntropy.driftDetected, "driftDetected must not depend on stamp shape");
  assert.deepEqual(reportHand.details, reportEntropy.details, "details must not depend on stamp shape");
  assert.deepEqual(reportHand.tasksCompleted, reportEntropy.tasksCompleted, "tasksCompleted must not depend on stamp shape");
  assert.deepEqual(reportHand.tasksIncomplete, reportEntropy.tasksIncomplete, "tasksIncomplete must not depend on stamp shape");
});

test("AC3 control: driftDetected/details are unaffected by stamp shape when genuine task drift IS present", async () => {
  const wsHand = mkWorkspace();
  writeTasks(wsHand, "- [x] T1 done\n- [x] T2 unreconciled\n");
  await seedHandoffWithStamp(wsHand, "2026-07-12T01:35:00.000Z", ["T1"]);
  const reportHand = JSON.parse(detectDrift(wsHand));

  const wsEntropy = mkWorkspace();
  writeTasks(wsEntropy, "- [x] T1 done\n- [x] T2 unreconciled\n");
  await seedHandoffWithStamp(wsEntropy, "2026-07-13T03:22:38.181Z", ["T1"]);
  const reportEntropy = JSON.parse(detectDrift(wsEntropy));

  assert.equal(reportHand.driftDetected, true, "sanity: T2 must be genuine drift");
  assert.deepEqual(reportHand.driftDetected, reportEntropy.driftDetected);
  assert.deepEqual(reportHand.details, reportEntropy.details, "presence of the advisory must not alter the drift details array");
  assert.deepEqual(reportHand.tasksCompleted, reportEntropy.tasksCompleted);
  assert.deepEqual(reportHand.tasksIncomplete, reportEntropy.tasksIncomplete);
});

// ---------------------------------------------------------------------------
// Null on the three pre-handoff early returns
// ---------------------------------------------------------------------------

test("early return: version-skew short-circuit returns stampAdvisory null (even with a hand-authored-shaped stamp on disk)", async () => {
  const ws = mkWorkspace();
  writeTasks(ws, "- [x] T1 done\n");
  await seedHandoffWithStamp(ws, "2026-07-12T01:35:00.000Z", ["T1"]);

  // Force version skew: bump the on-disk handoff schema_version beyond what
  // this server understands, so checkVersionSkew() fires before parse().
  const p = path.join(ws, ".current", "handoff.md");
  const raw = fs.readFileSync(p, "utf-8");
  const skewed = raw.replace(/^schema_version:\s*\d+$/m, `schema_version: ${CURRENT_VERSIONS.handoff + 1}`);
  assert.notEqual(skewed, raw, "schema_version line must be found and bumped");
  fs.writeFileSync(p, skewed, "utf-8");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "sanity: version skew is itself reported as drift");
  assert.ok(report.details.some((d) => /Schema version skew/.test(d)), "sanity: skew detail line present");
  assert.equal(report.stampAdvisory, null, "version-skew early return must yield stampAdvisory null, despite the on-disk hand-authored-shaped stamp");
});

test("early return: no handoff and no tasks (fresh project) returns stampAdvisory null", () => {
  const ws = mkWorkspace();
  // deliberately no handoff.md, no tasks.md

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false);
  assert.equal(report.stampAdvisory, null, "fresh-project early return must yield stampAdvisory null");
});

test("early return: tasks exist but handoff is missing returns stampAdvisory null", () => {
  const ws = mkWorkspace();
  writeTasks(ws, "- [x] T1 done\n");
  // deliberately no handoff.md

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "sanity: missing handoff with an existing task list is itself reported as drift");
  assert.equal(report.stampAdvisory, null, "missing-handoff early return must yield stampAdvisory null");
});

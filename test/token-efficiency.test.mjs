// Coded by @qa-engineer
// Token-efficiency-improvements: drift compression + pending_notes truncation.
// Covers both deliverables from research/token-efficiency-audit-v2.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { detectDrift } from "../dist/tools/drift.js";
import { readHandoffState, writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twtokeff-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedHandoff(ws, completed = [], pending = []) {
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "feat", "In_Progress", completed, pending, undefined, "pm", 0);
}

function writeTasks(ws, tasks) {
  const lines = ["<!-- schema_version: 1 -->", "# Tasks", "", "## Active"];
  for (const t of tasks) {
    lines.push(`- [${t.done ? "x" : " "}] ${t.id} ${t.desc || "task"}`);
  }
  fs.writeFileSync(path.join(ws, "tasks.md"), lines.join("\n") + "\n");
}

// =========================================================================
// Drift compression (tools/drift.ts — compressDriftDetails)
// =========================================================================

test("drift: ≤ 5 vibe-coding drifts are kept individually (not compressed)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, [
    { id: "T01", done: true },
    { id: "T02", done: true },
    { id: "T03", done: true },
  ]);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  // Should list 3 tasks individually (below threshold of 5)
  const vibeDrifts = report.details.filter((d) => /T0\d/.test(d));
  assert.ok(vibeDrifts.length >= 1, "should have vibe-coding drift details");
  // Should NOT use the range format
  assert.ok(
    !report.details.some((d) => /\d+ tasks \(T01/.test(d)),
    "should not use compressed range format for ≤ 5 items",
  );
});

test("drift: > 5 vibe-coding drifts are compressed into a single summary line", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  const tasks = [];
  for (let i = 1; i <= 10; i++) {
    tasks.push({ id: `T${String(i).padStart(2, "0")}`, done: true });
  }
  writeTasks(ws, tasks);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  // Should be compressed into a single summary
  assert.equal(report.details.length, 1, `expected 1 compressed line, got: ${JSON.stringify(report.details)}`);
  assert.match(report.details[0], /10 tasks/);
  assert.match(report.details[0], /T01/);
  assert.match(report.details[0], /T10/);
});

test("drift: exactly 5 vibe-coding drifts are kept individually (at threshold boundary)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  const tasks = [];
  for (let i = 1; i <= 5; i++) {
    tasks.push({ id: `T${String(i).padStart(2, "0")}`, done: true });
  }
  writeTasks(ws, tasks);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  // Exactly at threshold: should still be individual (threshold is >5, not >=5)
  assert.ok(
    !report.details.some((d) => /5 tasks/.test(d)),
    "at-threshold should not compress",
  );
});

test("drift: 6 vibe-coding drifts are compressed (just above threshold)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  const tasks = [];
  for (let i = 1; i <= 6; i++) {
    tasks.push({ id: `T${String(i).padStart(2, "0")}`, done: true });
  }
  writeTasks(ws, tasks);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  assert.equal(report.details.length, 1);
  assert.match(report.details[0], /6 tasks/);
});

test("drift: mixed drift types compress independently", async () => {
  const ws = mkWorkspace();
  // Handoff says T50, T51 completed; task list says incomplete
  // Task list says T01–T10 completed; handoff doesn't mention them
  await seedHandoff(ws, ["T50", "T51"]);
  const tasks = [
    { id: "T50", done: false },
    { id: "T51", done: false },
  ];
  for (let i = 1; i <= 10; i++) {
    tasks.push({ id: `T${String(i).padStart(2, "0")}`, done: true });
  }
  writeTasks(ws, tasks);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  // Handoff-ahead: 2 items (below threshold) → individual or joined
  // Vibe-coding: 10 items (above threshold) → compressed
  const compressed = report.details.filter((d) => /10 tasks/.test(d));
  assert.equal(compressed.length, 1, "vibe-coding should be compressed");
  const handoffAhead = report.details.filter((d) => /T5\d/.test(d));
  assert.ok(handoffAhead.length >= 1, "handoff-ahead items should be present");
});

test("drift: passthrough details are preserved alongside compressed groups", async () => {
  const ws = mkWorkspace();
  // Create a FAIL status with incomplete tasks to trigger the status drift message
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "feat", "FAIL", [], [], "test failure", "qa-engineer", 1);
  const tasks = [];
  for (let i = 1; i <= 8; i++) {
    tasks.push({ id: `T${String(i).padStart(2, "0")}`, done: true });
  }
  tasks.push({ id: "T09", done: false });
  writeTasks(ws, tasks);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  // Should have compressed vibe-coding line + the FAIL/incomplete passthrough
  const statusDrift = report.details.filter((d) => /FAIL/.test(d));
  assert.ok(statusDrift.length >= 1, "status drift passthrough should survive compression");
});

// =========================================================================
// Pending notes truncation (tools/handoff.ts — PENDING_NOTES_CHAR_LIMIT)
// =========================================================================

test("pending_notes: short notes pass through untruncated", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, [], ["short note 1", "short note 2"]);
  resetSession();

  const result = JSON.parse(readHandoffState(ws));
  assert.equal(result.exists, true);
  assert.deepEqual(result.pending_notes, ["short note 1", "short note 2"]);
  assert.equal(result.pending_notes_truncated, undefined, "should not have truncation metadata");
});

test("pending_notes: notes exceeding 3000 chars are truncated", async () => {
  const ws = mkWorkspace();
  const longNote = "x".repeat(2000);
  const notes = [longNote, longNote]; // 4000 chars total > 3000 limit
  await seedHandoff(ws, [], notes);
  resetSession();

  const result = JSON.parse(readHandoffState(ws));
  assert.equal(result.exists, true);
  assert.ok(result.pending_notes_truncated, "should have truncation metadata");
  assert.equal(result.pending_notes_truncated.total_chars, 4000);
  assert.equal(result.pending_notes_truncated.limit, 3000);
  // First note (2000 chars) fits fully; second should be truncated
  assert.equal(result.pending_notes[0], longNote);
  assert.ok(result.pending_notes[1].endsWith("…[truncated]"), "second note should be truncated");
  assert.ok(result.pending_notes[1].length < 2000, "truncated note should be shorter");
});

test("pending_notes: truncation preserves front notes (routing directives)", async () => {
  const ws = mkWorkspace();
  const routingNote = "next_role: qa-engineer";
  const bulkNote = "B".repeat(3000);
  await seedHandoff(ws, [], [routingNote, bulkNote]);
  resetSession();

  const result = JSON.parse(readHandoffState(ws));
  assert.equal(result.exists, true);
  assert.equal(result.pending_notes[0], routingNote, "routing directive must be preserved");
  assert.ok(result.pending_notes_truncated, "should be truncated");
});

test("pending_notes: exactly at limit is not truncated", async () => {
  const ws = mkWorkspace();
  const note = "a".repeat(3000);
  await seedHandoff(ws, [], [note]);
  resetSession();

  const result = JSON.parse(readHandoffState(ws));
  assert.equal(result.exists, true);
  assert.equal(result.pending_notes_truncated, undefined, "exactly at limit should not truncate");
  assert.equal(result.pending_notes[0], note);
});

test("pending_notes: empty notes are not truncated", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, [], []);
  resetSession();

  const result = JSON.parse(readHandoffState(ws));
  assert.equal(result.exists, true);
  assert.deepEqual(result.pending_notes, []);
  assert.equal(result.pending_notes_truncated, undefined);
});

// =========================================================================
// Security / boundary tests
// =========================================================================

test("drift: empty details array returns no-drift message (not compressed)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, []);

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, false);
  assert.match(report.details[0], /No drift detected/);
});

test("pending_notes: special characters in notes survive truncation", async () => {
  const ws = mkWorkspace();
  const specialNote = 'Note with "quotes" & <angle> brackets 中文字符';
  const bulkNote = "Z".repeat(3000);
  await seedHandoff(ws, [], [specialNote, bulkNote]);
  resetSession();

  const result = JSON.parse(readHandoffState(ws));
  assert.equal(result.pending_notes[0], specialNote, "special chars must survive");
});

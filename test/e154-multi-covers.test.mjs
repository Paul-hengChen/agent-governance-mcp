// Coded by @qa-engineer
// Pins for specs/e139-evidence-verdict-integrity.md E154 (AC-E154-1..5): parseCoversIds reads
// EVERY `covers:` line, so a review round that widens scope by appending a second line counts.
// Invariant: a later `covers:` line only ever adds ids; with one line the output is what it
// always was (within-line duplicates included), and the exported regex is untouched.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseCoversIds, COVERS_LINE_RE } from "../dist/tools/evidence-file.js";
import { hasEvidenceInFile } from "../dist/gates/qa-review.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

function mkWorkspace(prefix = "e154-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedState(ws, feature, agent, status) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: agent,
  });
  forceSeedStamp(ws);
}

test("AC-E154-1: a second covers: line adds its ids after the first line's", () => {
  const content = "# Review\n\ncovers: A, B\n\nround 2 widened scope\n\ncovers: C\n";
  assert.deepEqual(parseCoversIds(content), ["A", "B", "C"]);
});

test("AC-E154-2: an id restated on a later line is de-duplicated, order preserved", () => {
  assert.deepEqual(parseCoversIds("covers: A, B\ntext\ncovers: B, C\n"), ["A", "B", "C"]);
  assert.deepEqual(parseCoversIds("covers: A\ncovers: B, A\ncovers: C, B\n"), ["A", "B", "C"]);
});

test("AC-E154-3: exactly one covers: line keeps today's output, within-line duplicates included", () => {
  assert.deepEqual(parseCoversIds("covers: A, A\n"), ["A", "A"]);
  assert.deepEqual(parseCoversIds("# t\n\n- **covers:** T-01, T-02\n"), ["T-01", "T-02"]);
  assert.deepEqual(parseCoversIds("no label here\n"), []);
  assert.deepEqual(parseCoversIds(""), []);
  // a first line's own duplicates survive even when a later line follows
  assert.deepEqual(parseCoversIds("covers: A, A\ncovers: B\n"), ["A", "A", "B"]);
});

test("AC-E154-4: a second covers: line satisfies the review-evidence gate and the QA completion-evidence gate", async () => {
  // Review side: APPROVED row (qa-engineer on code-reviewer:In_Progress) naming Y, covered only by line 2.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("e154-rev-");
  await seedState(ws, "e154-rev", "code-reviewer", "In_Progress");
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-E154-A.md"), "covers: T-E154-A\n\nround 2\n\ncovers: T-E154-Y\n");
  resetSession(ws);
  markStateRead(ws);
  const r1 = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e154-rev",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-E154-Y"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(!r1.isError, `second-line coverage must clear MISSING_REVIEW_EVIDENCE; got: ${r1.content?.[0]?.text}`);

  // QA side: PASS completing Y, covered only by line 2 of a qa_reports file.
  const ws2 = mkWorkspace("e154-qa-");
  await seedState(ws2, "e154-qa", "qa-engineer", "In_Progress");
  fs.mkdirSync(path.join(ws2, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws2, "qa_reports", "review_T-E154-A.md"), "covers: T-E154-A\n\ncovers: T-E154-Y\n");
  resetSession(ws2);
  markStateRead(ws2);
  const r2 = await handleUpdateState({
    workspace_path: ws2,
    active_feature: "e154-qa",
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T-E154-Y"],
    pending_notes: ["QA: PASS"],
  });
  assert.ok(!r2.isError, `second-line coverage must clear QA_COMPLETION_EVIDENCE_MISSING; got: ${r2.content?.[0]?.text}`);
  assert.deepEqual(hasEvidenceInFile(ws2, ["T-E154-Y"]).present, ["T-E154-Y"]);

  // Negative control: an id on no line is still missing.
  assert.deepEqual(hasEvidenceInFile(ws2, ["T-E154-Z"]).missing, ["T-E154-Z"]);
});

test("AC-E154-5: COVERS_LINE_RE keeps its source and im flags; prose guards hold on every line", () => {
  assert.equal(COVERS_LINE_RE.flags, "im");
  assert.equal(
    COVERS_LINE_RE.source,
    "^[^\\S\\n]*(?:[-*][^\\S\\n]*)?(?:\\*\\*[^\\S\\n]*)?covers(?:[^\\S\\n]*\\*\\*)?[^\\S\\n]*[:—-][^\\S\\n]*([^\\n]+?)[^\\S\\n]*$",
  );
  assert.equal(COVERS_LINE_RE.global, false);
  const content = "covers: A\nThe harness discovers: X, Y\ncovers: B\nthis note covers: P, Q mid-sentence\ncovers: C\n";
  assert.deepEqual(parseCoversIds(content), ["A", "B", "C"]);
  // prose guards on a later line, not only the first
  assert.deepEqual(parseCoversIds("covers: A\ndiscovers: D\n"), ["A"]);
  assert.deepEqual(parseCoversIds("prefix covers: A\n"), []);
});

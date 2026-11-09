// Coded by @qa-engineer
// Tests for specs/e247-qa-pass-unticked-gate.md AC1-AC4 and AC7 (PASS_TASKS_INCOMPLETE).
// Why: a qa PASS is terminal, so an open row of the feature's own lane ledger that is neither in
// completed_tasks, ticked nor voided must stop the PASS while qa can still fix it. The gate must stay
// dormant everywhere a lane ledger cannot be named (shared, legacy, SQLite, non-PASS writes).
// AC5/AC6 live in test/error-code-contract.test.mjs and test/e35-pipeline-order.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { featureLaneLedger, listOpenFeatureTasks } from "../dist/gates/open-tasks.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { writeHandoffState, readHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

const FEATURE = "e900-x";

function mkWs({ branch = "feat/e900-x", ledgerAt = path.join(".current", "e900", "tasks.md"), ledger }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e247-"));
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  if (ledger !== undefined) {
    const p = path.join(ws, ledgerAt);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `<!-- schema_version: 2 -->\n# Tasks\n\n## Active\n\n${ledger.join("\n")}\n`, "utf-8");
  }
  return ws;
}

const OPEN3 = [
  "- [ ] T-1 [P0] qa (first)",
  "- [ ] T-2 [P1] sr (second)",
  "- [ ] T-3 [P1] qa (third)",
];

async function seed(ws, feature = FEATURE, completedTasks = []) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks,
    pendingNotes: ["QA: claiming review"],
    lastAgent: "qa-engineer",
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}

async function pass(ws, completed, { feature = FEATURE, review = "ok" } = {}) {
  resetSession(ws);
  markStateRead(ws);
  const args = {
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: completed,
    pending_notes: ["QA: PASS"],
  };
  if (review !== null) args.qa_review = review;
  const r = await handleUpdateState(args);
  return { text: r.content[0].text, isError: !!r.isError };
}

test("AC1: open non-post-PASS rows outside the completed set reject the PASS, listed once in ledger order, evidence undone, handoff unwritten", async () => {
  const ws = mkWs({ ledger: OPEN3 });
  await seed(ws);
  const r = await pass(ws, ["T-1"]);
  assert.ok(r.isError, r.text);
  assert.ok(r.text.includes("PASS_TASKS_INCOMPLETE: T-2, T-3."), r.text);
  assert.ok(!/PASS_TASKS_INCOMPLETE:[^.]*T-1/.test(r.text), "the completed id must not be listed");
  assert.ok(r.text.includes(path.join(".current", "e900", "tasks.md")), "message names the lane ledger");
  assert.ok(!fs.existsSync(path.join(ws, "qa_reports", "review_T-1.md")), "QA_REVIEW_RECORD evidence must be undone");
  const st = await readHandoffState(ws);
  assert.notEqual(st.status, "PASS", "handoff must not be written on rejection");
});

test("AC2: PASS lands when every open id is in this write, in the on-disk set, ticked, or voided", async () => {
  // (a) all ids in this write
  let ws = mkWs({ ledger: OPEN3 });
  await seed(ws);
  let r = await pass(ws, ["T-1", "T-2", "T-3"]);
  assert.ok(!r.isError, `(a) ${r.text}`);
  // (b) two ids already on disk for the same feature
  ws = mkWs({ ledger: OPEN3 });
  await seed(ws, FEATURE, ["T-2", "T-3"]);
  r = await pass(ws, ["T-1"]);
  assert.ok(!r.isError, `(b) ${r.text}`);
  // (c) ticked rows
  ws = mkWs({ ledger: ["- [x] T-1 [P0] qa (first)", "- [x] T-2 [P1] sr (second)", "- [ ] T-3 [P1] qa (third)"] });
  await seed(ws);
  r = await pass(ws, ["T-3"]);
  assert.ok(!r.isError, `(c) ${r.text}`);
  // (d) voided row
  ws = mkWs({ ledger: ["- [ ] T-1 [P0] qa (first)", "- [-] T-2 [P1] sr (second) (voided: dropped)", "- [ ] T-3 [P1] qa (third)"] });
  await seed(ws);
  r = await pass(ws, ["T-1", "T-3"]);
  assert.ok(!r.isError, `(d) ${r.text}`);
});

test("AC3: post-PASS role rows never block; mentions later in the text and near-miss prefixes still block", async () => {
  let ws = mkWs({
    ledger: [
      "- [ ] T-1 [P0] qa (first)",
      "- [ ] T-2 release-engineer (bump)",
      "- [ ] T-3 [P2] doc-writer: docs",
      "- [ ] T-4 [P1] release-engineer (CHANGELOG)",
    ],
  });
  await seed(ws);
  let r = await pass(ws, ["T-1"]);
  assert.ok(!r.isError, r.text);

  for (const [row, label] of [
    ["- [ ] T-2 [P1] qa-engineer: verify release-engineer notes", "later mention"],
    ["- [ ] T-2 [P1] doc-writers: docs", "doc-writers prefix"],
    ["- [ ] T-2 [P1] release-engineering notes", "release-engineering prefix"],
  ]) {
    ws = mkWs({ ledger: ["- [ ] T-1 [P0] qa (first)", row] });
    await seed(ws);
    r = await pass(ws, ["T-1"]);
    assert.ok(r.isError && r.text.includes("PASS_TASKS_INCOMPLETE: T-2."), `${label}: ${r.text}`);
  }

  const rows = [
    { id: "A", completed: false, description: "[P2] doc-writer: docs" },
    { id: "B", completed: false, description: "release-engineer" },
    { id: "C", completed: false, description: "qa (x)" },
    { id: "C", completed: false, description: "qa (dup)" },
  ];
  assert.deepEqual(listOpenFeatureTasks(rows, new Set()), ["C"], "pure predicate: exempt rows skipped, ids once");
});

test("AC4: gate is dormant for non-lane ledgers, token mismatch, non-PASS writes and non-file storage", async () => {
  // _primary ledger on a main checkout
  let ws = mkWs({ branch: "main", ledgerAt: path.join(".current", "_primary", "tasks.md"), ledger: OPEN3 });
  assert.equal(featureLaneLedger(ws, FEATURE).armed, false, "_primary");
  await seed(ws);
  let r = await pass(ws, ["T-1"]);
  assert.ok(!r.isError, `_primary: ${r.text}`);

  // ledger .current/e900/ with a feature token that only shares a prefix
  for (const feature of ["e9001-x", "e901-x"]) {
    ws = mkWs({ ledger: OPEN3 });
    assert.equal(featureLaneLedger(ws, feature).armed, false, feature);
    await seed(ws, feature);
    r = await pass(ws, ["T-1"], { feature });
    assert.ok(!r.isError, `${feature}: ${r.text}`);
  }

  // legacy root ledger on a feat branch with no lane ledger
  ws = mkWs({ ledgerAt: "tasks.md", ledger: OPEN3 });
  assert.equal(featureLaneLedger(ws, FEATURE).armed, false, "legacy ledger");
  await seed(ws);
  r = await pass(ws, ["T-1"]);
  assert.ok(!r.isError, `legacy: ${r.text}`);

  // no ledger at all
  ws = mkWs({});
  assert.equal(featureLaneLedger(ws, FEATURE).armed, false, "no ledger");

  // armed lane ledger, non-PASS write
  ws = mkWs({ ledger: OPEN3 });
  assert.equal(featureLaneLedger(ws, FEATURE).armed, true, "control: lane ledger arms");
  await seed(ws);
  resetSession(ws);
  markStateRead(ws);
  const w = await handleUpdateState({
    workspace_path: ws,
    active_feature: FEATURE,
    status: "In_Progress",
    agent_id: "qa-engineer",
    pending_notes: ["QA: still reviewing"],
  });
  assert.ok(!w.isError, `non-PASS: ${w.content[0].text}`);

  // SQLite/non-file storage: the call site is guarded by FileHandoffStorage
  const src = fs.readFileSync(new URL("../tools/handoff-orchestrator.ts", import.meta.url), "utf-8");
  assert.match(src, /storage instanceof FileHandoffStorage && parsed\.status === "PASS"/, "call site is file-mode and PASS only");
});

test("AC7: QA_COMPLETION_EVIDENCE_MISSING wins over the new gate; a new-gate rejection writes one telemetry line", async () => {
  let ws = mkWs({ ledger: OPEN3 });
  await seed(ws);
  // no qa_review: the newly added id has no evidence, and T-2/T-3 are also open
  let r = await pass(ws, ["T-1"], { review: null });
  assert.ok(r.isError && r.text.includes("QA_COMPLETION_EVIDENCE_MISSING"), r.text);
  assert.ok(!r.text.includes("PASS_TASKS_INCOMPLETE"), "earlier step must win");

  ws = mkWs({ ledger: OPEN3 });
  await seed(ws);
  r = await pass(ws, ["T-1"]);
  assert.ok(r.isError && r.text.includes("PASS_TASKS_INCOMPLETE"), r.text);
  const tel = fs.readFileSync(path.join(ws, ".current", "e900", "telemetry.jsonl"), "utf-8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(tel.filter((e) => e.error_code === "PASS_TASKS_INCOMPLETE").length, 1);
});

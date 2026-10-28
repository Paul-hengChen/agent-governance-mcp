// Coded by @qa-engineer
// Pins for specs/e139-evidence-verdict-integrity.md E236 (AC-E236-1..7; AC-E236-8 is the unmodified
// test/qa-review-scoped-append.test.mjs + test/covering-evidence.test.mjs).
// Invariant: the evidence file is a record of what the server accepted. QA_REVIEW_RECORD stays at step 12
// (later gates must see this write's own review), but a write that does not land (a later gate rejects it,
// or writeState throws) gets its appended section undone, including a file or directory it created.
// Every case drives the real orchestrator and compares full directory snapshots, not just one file.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { recordReviewInFile, recordReviewInFileUndoable } from "../dist/gates/qa-review.js";
import { expectedRedManifestPath } from "../dist/gates/expected-red.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

function mkWorkspace(prefix = "e236-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedQa(ws, feature, completedTasks = []) {
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

// Name -> bytes (hex) for every file under dir, recursively; null when dir is absent. A directory that
// exists but is empty is distinguishable from an absent one.
function snapshot(dir) {
  if (!fs.existsSync(dir)) return null;
  const out = {};
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else out[path.relative(dir, p)] = fs.readFileSync(p).toString("hex");
    }
  };
  walk(dir);
  return out;
}

const text = (r) => r.content?.[0]?.text ?? "";
const PASS_ARGS = (feature, ids, extra = {}) => ({
  active_feature: feature,
  status: "PASS",
  agent_id: "qa-engineer",
  completed_tasks: ids,
  review_task_ids: ids,
  pending_notes: ["QA: PASS"],
  qa_review: "Looks good, no extra sections.",
  ...extra,
});

function writeManifest(ws, feature) {
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(expectedRedManifestPath(ws, feature), "test/x.test.mjs | a test\n");
}

test("AC-E236-1: EXPECTED_RED_DIFF_MISSING rejection leaves a pre-existing evidence file byte-identical (the E236 instance)", async () => {
  const ws = mkWorkspace();
  const feature = "e236-1";
  writeManifest(ws, feature);
  const file = path.join(ws, "qa_reports", "review_T-E236-X.md");
  fs.writeFileSync(file, "# QA review — T-E236-X\n\nearlier round notes\n");
  await seedQa(ws, feature);
  const before = fs.readFileSync(file);
  const r = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS(feature, ["T-E236-X"]) });
  assert.ok(r.isError);
  assert.match(text(r), /EXPECTED_RED_DIFF_MISSING/);
  assert.ok(before.equals(fs.readFileSync(file)), "file bytes are still exactly B");
});

test("AC-E236-2: the same rejection with no evidence file leaves no file and nothing else in qa_reports/", async () => {
  const ws = mkWorkspace();
  const feature = "e236-2";
  writeManifest(ws, feature);
  await seedQa(ws, feature);
  const before = snapshot(path.join(ws, "qa_reports"));
  const r = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS(feature, ["T-E236-X"]) });
  assert.ok(r.isError);
  assert.match(text(r), /EXPECTED_RED_DIFF_MISSING/);
  assert.equal(fs.existsSync(path.join(ws, "qa_reports", "review_T-E236-X.md")), false);
  assert.deepEqual(snapshot(path.join(ws, "qa_reports")), before, "only the manifest remains");
});

test("AC-E236-3: a write that creates qa_reports/ and is rejected by a later step leaves no qa_reports/", async () => {
  const ws = mkWorkspace();
  const feature = "e236-3";
  await seedQa(ws, feature);
  assert.equal(fs.existsSync(path.join(ws, "qa_reports")), false);
  const r = await handleUpdateState({
    workspace_path: ws,
    ...PASS_ARGS(feature, ["T-E236-Y"], { review_task_ids: ["T-E236-X"] }), // Y is outside review_task_ids
  });
  assert.ok(r.isError);
  assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.equal(fs.existsSync(path.join(ws, "qa_reports")), false, "the directory this write created is removed");
});

// One case per rejecting step after QA_REVIEW_RECORD. Each seeds a pre-existing evidence file for another id (must
// stay byte-identical) and a target id with no file (must not appear).
const AC4_CASES = [
  {
    code: "QA_COMPLETION_EVIDENCE_MISSING",
    prepare: () => ({ args: { completed_tasks: ["T-E236-Y"], review_task_ids: ["T-E236-X"] } }),
  },
  {
    code: "MISSING_EVIDENCE",
    // Y is already on disk as completed, so QA_COMPLETION skips it; its evidence is absent, so PASS_MISSING_EVIDENCE fires
    // after this write recorded evidence for X only.
    prepare: () => ({ seedCompleted: ["T-E236-Y"], args: { completed_tasks: ["T-E236-Y"], review_task_ids: ["T-E236-X"] } }),
  },
  {
    code: "VISUAL_BASELINES_REQUIRED",
    prepare: (ws, feature) => {
      fs.mkdirSync(path.join(ws, "design"), { recursive: true });
      fs.writeFileSync(path.join(ws, "design", `${feature}.md`), `# design\n\nmode: figma\n\n## Source manifest\n- figma | 1:1 | yes | audited\n`);
      return { args: {} };
    },
  },
  {
    code: "EXPECTED_RED_DIFF_MISSING",
    prepare: (ws, feature) => {
      writeManifest(ws, feature);
      return { args: {} };
    },
  },
  {
    code: "AC_EXECUTION_LOG_MISSING",
    prepare: (ws, feature) => {
      fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
      fs.writeFileSync(path.join(ws, "specs", `${feature}.md`), "# f\n\n## Acceptance Criteria\n- **AC1** — x.\n  proof: `true` exits 0.\n");
      return { args: {} };
    },
  },
];

test("AC-E236-4: every rejecting step after QA_REVIEW_RECORD leaves evidence files byte-identical", async () => {
  for (const c of AC4_CASES) {
    const ws = mkWorkspace("e236-4-");
    const feature = `e236-4-${c.code.toLowerCase().replace(/_/g, "-")}`;
    fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
    fs.writeFileSync(path.join(ws, "qa_reports", "review_T-E236-OTHER.md"), "# other task's evidence\n");
    const { seedCompleted, args } = c.prepare(ws, feature);
    await seedQa(ws, feature, seedCompleted ?? []);
    const before = snapshot(path.join(ws, "qa_reports"));
    const r = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS(feature, ["T-E236-X"], args) });
    assert.ok(r.isError, `${c.code}: write must be rejected; got: ${text(r)}`);
    assert.match(text(r), new RegExp(c.code), `${c.code}: expected that code; got: ${text(r)}`);
    assert.deepEqual(snapshot(path.join(ws, "qa_reports")), before, `${c.code}: qa_reports/ must be untouched`);
    assert.equal(fs.existsSync(path.join(ws, "qa_reports", "review_T-E236-X.md")), false, `${c.code}: no file for the reviewed id`);
  }
});

test("AC-E236-5: a write that passes every gate but whose state write throws (STATE DRIFT) leaves evidence untouched", async () => {
  const ws = mkWorkspace();
  const feature = "e236-5";
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  const existing = path.join(ws, "qa_reports", "review_T-E236-X.md");
  fs.writeFileSync(existing, "# earlier\n");
  await seedQa(ws, feature);
  const before = snapshot(path.join(ws, "qa_reports"));
  // The handoff changes after tw_get_state: verifyFreshness throws inside the state write.
  const hp = resolveCurrentLanePaths(ws).handoffPath;
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(hp, future, future);
  let threw = null;
  let result = null;
  try {
    result = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS(feature, ["T-E236-X", "T-E236-NEW"]) });
  } catch (e) {
    threw = e;
  }
  const message = threw ? String(threw.message ?? threw) : text(result);
  assert.match(message, /STATE DRIFT/, "the same error surfaces as before this change");
  assert.deepEqual(snapshot(path.join(ws, "qa_reports")), before, "evidence for both ids (one existing, one new) is restored");
});

test("AC-E236-6: a PASS whose only evidence is its own qa_review is accepted and records the same header and section as before", async () => {
  const ws = mkWorkspace();
  const feature = "e236-6";
  await seedQa(ws, feature);
  const notes = "Everything verified.";
  const r = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS(feature, ["T-E236-X"], { qa_review: notes }) });
  assert.ok(!r.isError, `same-write evidence must still satisfy PASS_MISSING_EVIDENCE; got: ${text(r)}`);
  const got = fs.readFileSync(path.join(ws, "qa_reports", "review_T-E236-X.md"), "utf-8");

  // Reference: what recordReviewInFile (the unchanged public record) writes for the same inputs.
  const ref = mkWorkspace("e236-6ref-");
  await recordReviewInFile(ref, ["T-E236-X"], "PASS", "qa-engineer", notes);
  const want = fs.readFileSync(path.join(ref, "qa_reports", "review_T-E236-X.md"), "utf-8");
  const norm = (s) => s.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<ISO>");
  assert.equal(norm(got), norm(want));
  assert.match(got, /^# QA review — T-E236-X\n\n<!-- Auto-appended by tw_update_state\(qa_review=\.\.\.\)\. -->\n\n## \d{4}-\d\d-\d\dT[\d:.]+Z — PASS — by qa-engineer\n\nEverything verified\.\n\n$/m);
});

test("AC-E236-7: the undo leaves a file alone when it changed after the append, and never throws", async () => {
  // (a) another writer appended after ours: size differs
  let ws = mkWorkspace("e236-7a-");
  let file = path.join(ws, "qa_reports", "review_T-E236-U.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# base\n");
  let undo = await recordReviewInFileUndoable(ws, ["T-E236-U"], "PASS", "qa-engineer", "mine");
  fs.appendFileSync(file, "## someone else's section\n");
  const afterOther = fs.readFileSync(file);
  assert.doesNotThrow(() => undo());
  assert.ok(afterOther.equals(fs.readFileSync(file)), "a concurrent append is never destroyed");

  // (b) same size, different tail bytes
  ws = mkWorkspace("e236-7b-");
  file = path.join(ws, "qa_reports", "review_T-E236-U.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# base\n");
  undo = await recordReviewInFileUndoable(ws, ["T-E236-U"], "PASS", "qa-engineer", "mine");
  const posted = Buffer.from(fs.readFileSync(file));
  const tampered = Buffer.from(posted);
  tampered[tampered.length - 2] = tampered[tampered.length - 2] === 0x58 ? 0x59 : 0x58; // flip one tail byte, same size
  fs.writeFileSync(file, tampered);
  assert.doesNotThrow(() => undo());
  assert.ok(tampered.equals(fs.readFileSync(file)), "a same-size tail mismatch is left untouched");

  // (c) a file this write created, then replaced by a different-sized file: not unlinked
  ws = mkWorkspace("e236-7c-");
  file = path.join(ws, "qa_reports", "review_T-E236-U.md");
  undo = await recordReviewInFileUndoable(ws, ["T-E236-U"], "PASS", "qa-engineer", "mine");
  fs.writeFileSync(file, "someone replaced it\n");
  assert.doesNotThrow(() => undo());
  assert.equal(fs.readFileSync(file, "utf-8"), "someone replaced it\n");
  assert.ok(fs.existsSync(path.join(ws, "qa_reports")), "directory kept while a file is still in it");

  // (d) the file was already removed: undo is a no-op, not an error
  ws = mkWorkspace("e236-7d-");
  file = path.join(ws, "qa_reports", "review_T-E236-U.md");
  undo = await recordReviewInFileUndoable(ws, ["T-E236-U"], "PASS", "qa-engineer", "mine");
  fs.rmSync(file);
  assert.doesNotThrow(() => undo());

  // positive control: an untouched record is fully undone, including the directory this write created, and undo is idempotent
  ws = mkWorkspace("e236-7e-");
  undo = await recordReviewInFileUndoable(ws, ["T-E236-U", "T-E236-V"], "FAIL", "qa-engineer", "mine");
  assert.equal(fs.readdirSync(path.join(ws, "qa_reports")).length, 2);
  undo();
  assert.equal(fs.existsSync(path.join(ws, "qa_reports")), false);
  assert.doesNotThrow(() => undo());
});

// Coded by @qa-engineer
// Pins for specs/e161-qa-claim-and-state-reads.md E161 (AC-E161-2..9; AC-E161-1 is the architecture-doc proof run at lane close).
// Invariant: a qa PASS's suite figures live in a structured field the server shape-checks at the zod boundary and
// records itself in one fixed line at the head of the evidence (file: new section of qa_reports/review_<id>.md;
// SQLite: reports.notes). The field is recording-only: it gates nothing, adds no error code, never reaches the
// handoff, and is ignored on any write that does not record qa_review evidence. Without it, evidence bytes are
// exactly what they were before E161.
// Malformed command values are written as \u escapes on purpose: a raw U+2028/U+2029/U+0085 in this source would
// be an invisible character that editors silently rewrite. The last test greps this file for raw ones.

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
import { recordReviewInFile } from "../dist/gates/qa-review.js";
import { expectedRedManifestPath } from "../dist/gates/expected-red.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite e161 cases skipped");
}

const UPDATE = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const text = (r) => r.content?.[0]?.text ?? "";
const ISO = /\d{4}-\d\d-\d\dT[\d:.]+Z/g;

function mkWorkspace(prefix = "e161-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedFile(ws, feature, agent = "qa-engineer") {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws, activeFeature: feature, status: "In_Progress",
    completedTasks: [], pendingNotes: ["seed"], lastAgent: agent,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}

async function mkSqlite(feature) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e161-sq-"));
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: dir, activeFeature: feature, status: "In_Progress",
    completedTasks: [], pendingNotes: ["QA: claiming review"], lastAgent: "qa-engineer",
  });
  resetSession(dir);
  storage.readState(dir);
  return { dir, storage };
}

const cleanupSqlite = (dir, storage) => {
  setActiveStorage(new FileHandoffStorage());
  try { storage.close(); } catch {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

const rows = (storage, dir) =>
  storage.db.prepare("SELECT task_id, status, reviewer, notes FROM reports WHERE workspace_path = ? ORDER BY task_id").all(dir);

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

const PASS_ARGS = (feature, ids, extra = {}) => ({
  active_feature: feature,
  status: "PASS",
  agent_id: "qa-engineer",
  completed_tasks: ids,
  review_task_ids: ids,
  pending_notes: ["QA: PASS"],
  qa_review: "Looks good.",
  ...extra,
});

const evidenceFile = (ws, id) => path.join(ws, "qa_reports", `review_${id}.md`);
const handoffBytes = (ws) => fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath);

test("AC-E161-2: file mode records the suite line, a blank line, then the trimmed qa_review; heading and file header unchanged", async () => {
  const ws = mkWorkspace();
  await seedFile(ws, "e161-2");
  const review = "  \nAll ACs verified.\n\n## AC execution log\n| AC | ok |\n\n";
  const r = await handleUpdateState({
    workspace_path: ws,
    ...PASS_ARGS("e161-2", ["T-E161-X"], {
      qa_review: review,
      qa_suite_result: { passed: 2146, total: 2146, command: "npm test" },
    }),
  });
  assert.ok(!r.isError, `well-formed qa_suite_result must be accepted; got: ${text(r)}`);
  const got = fs.readFileSync(evidenceFile(ws, "T-E161-X"), "utf-8");
  const line = "suite-result: 2146/2146 passed (server-recorded from qa_suite_result; command: npm test)";
  assert.ok(got.includes(`\n${line}\n\nAll ACs verified.\n\n## AC execution log\n`), "line, blank line, trimmed text, in that order");
  assert.ok(got.indexOf(line) < got.indexOf("## AC execution log"), "the server line never lands inside a qa-authored subsection");

  // The heading and file header are today's format: compare with recordReviewInFile's own output for the same notes.
  const ref = mkWorkspace("e161-2ref-");
  await recordReviewInFile(ref, ["T-E161-X"], "PASS", "qa-engineer", `${line}\n\n${review.trim()}`);
  const want = fs.readFileSync(evidenceFile(ref, "T-E161-X"), "utf-8");
  assert.equal(got.replace(ISO, "<ISO>"), want.replace(ISO, "<ISO>"));
  assert.match(got, /^# QA review — T-E161-X\n\n<!-- Auto-appended by tw_update_state\(qa_review=\.\.\.\)\. -->\n\n## \d{4}-\d\d-\d\dT[\d:.]+Z — PASS — by qa-engineer\n\nsuite-result: /);

  // FAIL records it too (the record step fires on PASS and FAIL alike).
  const ws2 = mkWorkspace("e161-2f-");
  await seedFile(ws2, "e161-2f");
  const rf = await handleUpdateState({
    workspace_path: ws2,
    active_feature: "e161-2f", status: "FAIL", agent_id: "qa-engineer", completed_tasks: [],
    review_task_ids: ["T-E161-F"], pending_notes: ["QA: FAIL"], qa_review: "2144 of 2146.",
    qa_suite_result: { passed: 2144, total: 2146 },
  });
  assert.ok(!rf.isError, `FAIL with the field must be accepted; got: ${text(rf)}`);
  assert.match(
    fs.readFileSync(evidenceFile(ws2, "T-E161-F"), "utf-8"),
    /— FAIL — by qa-engineer\n\nsuite-result: 2144\/2146 passed \(server-recorded from qa_suite_result\)\n\n2144 of 2146\.\n\n$/,
  );
});

test("AC-E161-3: SQLite records the same composed text in every reports row's notes (with and without command)", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3");
  for (const [suite, line] of [
    [{ passed: 10, total: 12, command: "npm test" }, "suite-result: 10/12 passed (server-recorded from qa_suite_result; command: npm test)"],
    [{ passed: 5, total: 5 }, "suite-result: 5/5 passed (server-recorded from qa_suite_result)"],
  ]) {
    const { dir, storage } = await mkSqlite("e161-3");
    try {
      const r = await handleUpdateState({
        workspace_path: dir,
        ...PASS_ARGS("e161-3", ["T1", "T2"], { qa_review: "Verified.", qa_suite_result: suite }),
      });
      assert.ok(!r.isError, `accepted; got: ${text(r)}`);
      const got = rows(storage, dir);
      assert.equal(got.length, 2);
      for (const row of got) assert.equal(row.notes, `${line}\n\nVerified.`);
    } finally {
      cleanupSqlite(dir, storage);
    }
  }
});

test("AC-E161-4: without qa_suite_result the evidence bytes (file) and notes (SQLite) are exactly the pre-E161 record", async (t) => {
  const ws = mkWorkspace();
  await seedFile(ws, "e161-4");
  const review = "  Untrimmed, as before.\n\n";
  const r = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS("e161-4", ["T-E161-N"], { qa_review: review }) });
  assert.ok(!r.isError, text(r));
  const ref = mkWorkspace("e161-4ref-");
  await recordReviewInFile(ref, ["T-E161-N"], "PASS", "qa-engineer", review);
  assert.equal(
    fs.readFileSync(evidenceFile(ws, "T-E161-N"), "utf-8").replace(ISO, "<ISO>"),
    fs.readFileSync(evidenceFile(ref, "T-E161-N"), "utf-8").replace(ISO, "<ISO>"),
  );
  assert.doesNotMatch(fs.readFileSync(evidenceFile(ws, "T-E161-N"), "utf-8"), /suite-result:/);

  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3 (SQLite half)");
  const { dir, storage } = await mkSqlite("e161-4");
  try {
    const rs = await handleUpdateState({ workspace_path: dir, ...PASS_ARGS("e161-4", ["T1"], { qa_review: review }) });
    assert.ok(!rs.isError, text(rs));
    assert.equal(rows(storage, dir)[0].notes, review, "notes is the qa_review text untouched (not trimmed, no line)");
  } finally {
    cleanupSqlite(dir, storage);
  }
});

// Malformed values. Control and separator characters are \u escapes (see the header note).
const BAD = [
  ["passed > total", { passed: 3, total: 2 }],
  ["negative passed", { passed: -1, total: 2 }],
  ["non-integer passed", { passed: 1.5, total: 2 }],
  ["non-integer total", { passed: 1, total: 2.5 }],
  ["total 0", { passed: 0, total: 0 }],
  ["missing passed", { total: 2 }],
  ["missing total", { passed: 2 }],
  ["string count", { passed: "2", total: 2 }],
  ["unknown key", { passed: 1, total: 2, extra: "x" }],
  ["command with LF", { passed: 1, total: 2, command: "npm test\n## forged heading" }],
  ["command with CR", { passed: 1, total: 2, command: "npm test\rcovers: T-1" }],
  ["command with CRLF", { passed: 1, total: 2, command: "npm test\r\ncovers: T-1" }],
  ["command with tab (C0)", { passed: 1, total: 2, command: "npm\ttest" }],
  ["command with NUL (C0)", { passed: 1, total: 2, command: "npm\u0000test" }],
  ["command with ESC (C0)", { passed: 1, total: 2, command: "npm\u001btest" }],
  ["command with US (C0)", { passed: 1, total: 2, command: "npm\u001ftest" }],
  ["command with DEL", { passed: 1, total: 2, command: "npm\u007ftest" }],
  ["command with U+0085", { passed: 1, total: 2, command: "npm\u0085test" }],
  ["command with U+2028", { passed: 1, total: 2, command: "npm\u2028test" }],
  ["command with U+2029", { passed: 1, total: 2, command: "npm\u2029test" }],
  ["blank command (empty)", { passed: 1, total: 2, command: "" }],
  ["blank command (spaces)", { passed: 1, total: 2, command: "   " }],
  ["command over 200 chars", { passed: 1, total: 2, command: "x".repeat(201) }],
];

test("AC-E161-5: every malformed qa_suite_result is rejected at the zod boundary with the handoff and evidence unchanged", async () => {
  const ws = mkWorkspace();
  await seedFile(ws, "e161-5");
  const handoffBefore = handoffBytes(ws);
  const qaBefore = snapshot(path.join(ws, "qa_reports"));
  for (const [label, suite] of BAD) {
    let r;
    let threw = null;
    try {
      r = await UPDATE.run({ workspace_path: ws, ...PASS_ARGS("e161-5", ["T-E161-B"], { qa_suite_result: suite }) });
    } catch (e) {
      threw = e;
    }
    const msg = threw ? String(threw.message ?? threw) : text(r);
    assert.ok(threw || r.isError, `${label}: must be rejected; got: ${msg}`);
    assert.match(msg, /qa_suite_result/, `${label}: the failure names the field; got: ${msg}`);
    assert.doesNotMatch(msg, /⛔ [A-Z_]{6,}:/, `${label}: a zod failure, not a gate code`);
    assert.ok(handoffBefore.equals(handoffBytes(ws)), `${label}: handoff unchanged`);
    assert.deepEqual(snapshot(path.join(ws, "qa_reports")), qaBefore, `${label}: evidence unchanged`);
  }
  // Boundary positives next to the negatives: the limits themselves are accepted.
  for (const suite of [{ passed: 0, total: 1 }, { passed: 1, total: 1, command: "x".repeat(200) }]) {
    const w = mkWorkspace("e161-5ok-");
    await seedFile(w, "e161-5ok");
    const r = await UPDATE.run({ workspace_path: w, ...PASS_ARGS("e161-5ok", ["T-E161-B"], { qa_suite_result: suite }) });
    assert.ok(!r.isError, `boundary value accepted; got: ${text(r)}`);
  }
});

test("AC-E161-6: where QA_REVIEW_RECORD does not record, the field changes no outcome, records nothing and never reaches the handoff", async () => {
  const suite = { passed: 9, total: 9, command: "npm test" };
  const norm = (s, ws) => s.split(ws).join("<WS>").replace(ISO, "<ISO>");
  const cases = [
    // non-qa agent_id carrying qa_review
    { name: "non-qa agent", seedAgent: "sr-engineer", args: { active_feature: "e161-6a", status: "In_Progress", agent_id: "sr-engineer", completed_tasks: [], pending_notes: ["sr"], qa_review: "prose" } },
    // qa In_Progress (not PASS/FAIL) carrying qa_review
    { name: "qa In_Progress", seedAgent: "qa-engineer", args: { active_feature: "e161-6b", status: "In_Progress", agent_id: "qa-engineer", completed_tasks: [], pending_notes: ["QA: wip"], qa_review: "wip" } },
    // qa PASS without qa_review
    { name: "no qa_review", seedAgent: "qa-engineer", args: { active_feature: "e161-6c", status: "PASS", agent_id: "qa-engineer", completed_tasks: [], pending_notes: ["QA: PASS"] } },
  ];
  for (const c of cases) {
    const out = [];
    for (const withField of [false, true]) {
      const ws = mkWorkspace("e161-6-");
      await seedFile(ws, c.args.active_feature, c.seedAgent);
      const r = await handleUpdateState({ workspace_path: ws, ...c.args, ...(withField ? { qa_suite_result: suite } : {}) });
      out.push({ isError: !!r.isError, text: norm(text(r), ws), ws });
    }
    assert.equal(out[1].isError, out[0].isError, `${c.name}: same accept/reject`);
    assert.equal(out[1].text, out[0].text, `${c.name}: same envelope`);
    assert.equal(fs.existsSync(path.join(out[1].ws, "qa_reports")), false, `${c.name}: nothing recorded`);
    assert.doesNotMatch(handoffBytes(out[1].ws).toString("utf-8"), /qa_suite_result|suite-result/, `${c.name}: not in the handoff`);
  }
  // Rejected (not just ignored) write: the same rejection code with and without the field.
  const rej = [];
  for (const withField of [false, true]) {
    const ws = mkWorkspace("e161-6r-");
    await seedFile(ws, "e161-6d", "qa-engineer");
    const r = await handleUpdateState({
      workspace_path: ws, active_feature: "e161-6d", status: "PASS", agent_id: "qa-engineer",
      completed_tasks: ["T-UNEVIDENCED"], review_task_ids: ["T-UNEVIDENCED"], pending_notes: ["QA: PASS"],
      ...(withField ? { qa_suite_result: suite } : {}),
    });
    rej.push({ isError: !!r.isError, text: norm(text(r), ws) });
  }
  assert.ok(rej[0].isError);
  assert.deepEqual(rej[1], rej[0], "a write rejected for other reasons is rejected identically with the field");

  // An accepted qa write that records: the field still never reaches the handoff file.
  const ws = mkWorkspace("e161-6ok-");
  await seedFile(ws, "e161-6e");
  const r = await handleUpdateState({ workspace_path: ws, ...PASS_ARGS("e161-6e", ["T-E161-H"], { qa_suite_result: suite }) });
  assert.ok(!r.isError, text(r));
  assert.doesNotMatch(handoffBytes(ws).toString("utf-8"), /qa_suite_result|suite-result/);
});

test("AC-E161-7: a PASS carrying the field that a later step rejects leaves the suite line undone with the rest of the record", async (t) => {
  // File mode: EXPECTED_RED_DIFF_MISSING rejects after QA_REVIEW_RECORD.
  const ws = mkWorkspace();
  const feature = "e161-7";
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(expectedRedManifestPath(ws, feature), "test/x.test.mjs | a test\n");
  const existing = evidenceFile(ws, "T-E161-R");
  fs.writeFileSync(existing, "# QA review — T-E161-R\n\nearlier round\n");
  await seedFile(ws, feature);
  const before = snapshot(path.join(ws, "qa_reports"));
  const r = await handleUpdateState({
    workspace_path: ws,
    ...PASS_ARGS(feature, ["T-E161-R"], { qa_suite_result: { passed: 1, total: 1, command: "npm test" } }),
  });
  assert.ok(r.isError);
  assert.match(text(r), /EXPECTED_RED_DIFF_MISSING/);
  assert.deepEqual(snapshot(path.join(ws, "qa_reports")), before, "evidence directory byte-identical");

  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3 (SQLite half)");
  const { dir, storage } = await mkSqlite(feature);
  try {
    const rs = await handleUpdateState({
      workspace_path: dir,
      ...PASS_ARGS(feature, ["T1"], { completed_tasks: ["T1", "T2"], qa_suite_result: { passed: 1, total: 1 } }),
    });
    assert.ok(rs.isError);
    assert.match(text(rs), /MISSING_EVIDENCE/);
    assert.deepEqual(rows(storage, dir), [], "no row is left");
  } finally {
    cleanupSqlite(dir, storage);
  }
});

test("AC-E161-8: passed < total is recorded verbatim and is not a rejection", async (t) => {
  const ws = mkWorkspace();
  await seedFile(ws, "e161-8");
  const r = await handleUpdateState({
    workspace_path: ws,
    ...PASS_ARGS("e161-8", ["T-E161-L"], { qa_suite_result: { passed: 2144, total: 2146, command: "npm test" } }),
  });
  assert.ok(!r.isError, `a PASS claiming 2144/2146 is recorded, not refused (gating is E161-NEW-1); got: ${text(r)}`);
  assert.match(
    fs.readFileSync(evidenceFile(ws, "T-E161-L"), "utf-8"),
    /suite-result: 2144\/2146 passed \(server-recorded from qa_suite_result; command: npm test\)\n\nLooks good\./,
  );

  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3 (SQLite half)");
  const { dir, storage } = await mkSqlite("e161-8");
  try {
    const rs = await handleUpdateState({
      workspace_path: dir,
      ...PASS_ARGS("e161-8", ["T1"], { qa_suite_result: { passed: 0, total: 3 } }),
    });
    assert.ok(!rs.isError, text(rs));
    assert.equal(rows(storage, dir)[0].notes, "suite-result: 0/3 passed (server-recorded from qa_suite_result)\n\nLooks good.");
  } finally {
    cleanupSqlite(dir, storage);
  }
});

test("AC-E161-9: tools/list tw_update_state inputSchema declares qa_suite_result with the required shape and description", () => {
  const prop = UPDATE.inputSchema.properties.qa_suite_result;
  assert.ok(prop, "qa_suite_result is in the inputSchema");
  assert.equal(prop.type, "object");
  assert.deepEqual([...prop.required].sort(), ["passed", "total"]);
  assert.equal(prop.additionalProperties, false);
  assert.deepEqual(Object.keys(prop.properties).sort(), ["command", "passed", "total"]);
  assert.match(prop.description, /recorded/i, "states it is recorded into the evidence record");
  assert.match(prop.description, /Not persisted to the handoff/i, "states it is not persisted to the handoff");
  assert.match(prop.description, /gates nothing/i, "states it gates nothing");
  assert.match(prop.description, /Attested, not verified/i);
});

test("AC-E161-5 (source hygiene): this test file carries no raw U+0085, U+2028 or U+2029 character", () => {
  // The malformed-command cases above must stay \u escapes; an editor that rewrites one into the raw character
  // makes the case invisible and unreviewable.
  const src = fs.readFileSync(new URL(import.meta.url), "utf-8");
  assert.doesNotMatch(src, /[\u0085\u2028\u2029]/);
});

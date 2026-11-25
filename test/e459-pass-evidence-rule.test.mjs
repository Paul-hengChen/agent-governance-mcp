// Coded by @qa-engineer
// Scenario tests for specs/e448-judge-evidence-checks.md AC12-AC16 (E459: one PASS-evidence rule).
// Invariant: a judge report's *standing* is the verdict of its LAST server-recorded verdict section — an H2 of
// the exact shape the qa_review auto-record writes, `## <toISOString()> — PASS|FAIL — by <signer>` — or none.
// Hand-written look-alikes (`## Round 1 — PASS — by code-reviewer`) are not verdicts. The file-mode judge PASS
// gate (MISSING_EVIDENCE), lane-status and drift all read standing through ONE exported predicate
// (tools/evidence-file.ts judgeReportStanding), so a lane's claimed completions mean the same thing everywhere:
//   - PASS gate: every id in completed_tasks needs a candidate report (direct, or a covers: report) with
//     standing PASS, under every evidence_schema pin;
//   - lane-status: credits standing PASS by a REPORT_SIGNERS signer;
//   - drift: credits "standing is not FAIL" — it deliberately keeps crediting a report with no server-recorded
//     verdict at all (human ruling; test/e112 pins that trust class).
// Deliberate (architecture Open Question 2 / DR-2): an id whose own report has standing FAIL but which a
// covers: report with standing PASS names HAS PASS evidence — any PASS-standing candidate qualifies, no
// cross-file timestamp comparison.
// Also AC14: the expected-red disposition heading follows the feature's evidence_schema pin like its sibling
// AC-execution check (normalized-contains under pin >= 2 or no pin; exact anchor under pin 1).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { checkLaneEvidence } from "../dist/tools/lane-status.js";
import { hasEvidenceAnywhere } from "../dist/tools/evidence-lookup.js";
import { GATE_REGISTRY } from "../dist/gates/registry.js";
// Namespace import: judgeReportStanding / isPassStanding do not exist before E459; a named import would fail
// the whole file at link time instead of failing the AC16 test that needs them.
import * as EF from "../dist/tools/evidence-file.js";
import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

// hint.missing_evidence and msg.missing_evidence_file (Copy / Strings, verbatim).
const HINT_MISSING_EVIDENCE =
  "Provide qa_review naming the id on this PASS write, or make the id's qa_reports/review_<id>.md (or the report whose covers: line names it) end with a server-recorded PASS verdict (file mode) / insert a PASS reports row (SQLite) before PASS.";
const MSG_MISSING_EVIDENCE_FILE = (ids, paths) =>
  `⛔ MISSING_EVIDENCE: ${ids.join(", ")}. The last server-recorded verdict for each listed id is not PASS (checked: ${paths.join(", ")}, plus any report whose covers: line names the id). ${HINT_MISSING_EVIDENCE}`;

const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");
const state = (ws) => new FileHandoffStorage().parse(ws);
const put = (ws, rel, body) => {
  fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
  fs.writeFileSync(path.join(ws, rel), body);
};
function mkWs(prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanup.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}
async function seed(ws, feature, agent, status, opts = {}) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws, activeFeature: feature, status, completedTasks: [], pendingNotes: ["seed"],
    lastAgent: agent, cutApproved: true, ...opts,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}
async function upd(ws, args) {
  setActiveStorage(new FileHandoffStorage());
  forceSeedStampIfExists(ws);
  resetSession(ws);
  markStateRead(ws);
  try {
    return await UPD.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] };
  }
}

const F = "e459-feat";
const w = (agent, status, extra = {}) => ({ active_feature: F, status, agent_id: agent, ...extra });
const reportPath = (ws, id) => path.join(ws, "qa_reports", `review_${id}.md`);

// ---------------------------------------------------------------- report fixtures

const TS1 = "2026-11-20T00:00:00.000Z";
const TS2 = "2026-11-21T09:30:15.250Z";
const SERVER = (verdict, ts = TS1, by = "code-reviewer") => `\n## ${ts} — ${verdict} — by ${by}\n\nnotes for the ${verdict} round\n`;
const HEAD = (id) => `# QA review — ${id}\n\nScenarios exercised.\n`;
const HAND_PASS = "\n## Round 1 — PASS — by code-reviewer\n\nlooks good now\n";

// The AC16 four (all signed code-reviewer).
const FIX = {
  a: (id) => HEAD(id) + SERVER("FAIL"),                        // standing FAIL
  b: (id) => HEAD(id) + SERVER("FAIL") + HAND_PASS,            // server FAIL, then a hand-written PASS heading
  c: (id) => HEAD(id) + SERVER("PASS") + SERVER("FAIL", TS2),  // server PASS, then server FAIL
  d: (id) => HEAD(id) + SERVER("PASS"),                        // standing PASS
};
// Standing none: hand-written text only.
const NONE = {
  prose: (id) => HEAD(id),
  "hand-written PASS heading": (id) => HEAD(id) + HAND_PASS,
  "timestamp without milliseconds": (id) => `${HEAD(id)}\n## 2026-11-20T00:00:00Z — PASS — by code-reviewer\n\nx\n`,
};

// A file-mode feature at code-reviewer:In_Progress with a code-review file for every id (so the separate
// code-review evidence check never decides these outcomes). pin === undefined seeds no evidence_schema.
async function judgeWs(prefix, { reports = {}, ids = ["T1"], pin, completed = [] } = {}) {
  const ws = mkWs(prefix);
  await seed(ws, F, "code-reviewer", "In_Progress", { completedTasks: completed, ...(pin === undefined ? {} : { evidenceSchema: pin }) });
  for (const [rel, body] of Object.entries(reports)) put(ws, rel, body);
  for (const id of ids) put(ws, `review_reports/review_${id}.md`, "# Code review\n\nVerdict: APPROVED\n");
  return ws;
}

// ---------------------------------------------------------------- AC12

test("AC12: a judge PASS over an id whose report has standing FAIL (no qa_review) -> MISSING_EVIDENCE naming T1 with msg.missing_evidence_file and hint.missing_evidence", async () => {
  // Why: before E459 file mode accepted any report file, even one whose last recorded verdict is FAIL.
  const ws = await judgeWs("e459-ac12a-", { reports: { "qa_reports/review_T1.md": FIX.a("T1") } });
  const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1"], review_verdict: "APPROVED" }));
  assert.ok(rejected(r), `standing FAIL is not PASS evidence: ${text(r)}`);
  assert.equal(text(r), MSG_MISSING_EVIDENCE_FILE(["T1"], [reportPath(ws, "T1")]));
  assert.equal(state(ws).status, "In_Progress", "no state written");

  const g = GATE_REGISTRY.find((x) => x.errorCode === "MISSING_EVIDENCE");
  assert.equal(g.hintStatic, HINT_MISSING_EVIDENCE, "registry hint is hint.missing_evidence");
});

test("AC12: standing none (hand-written text only, incl. a hand-written '## Round 1 — PASS — by code-reviewer') is not PASS evidence either; several ids are listed with every checked path", async () => {
  for (const [label, body] of Object.entries(NONE)) {
    const ws = await judgeWs("e459-ac12b-", { reports: { "qa_reports/review_T1.md": body("T1") } });
    const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1"] }));
    assert.ok(rejected(r), `${label}: no server-recorded verdict -> refused: ${text(r)}`);
    assert.equal(text(r), MSG_MISSING_EVIDENCE_FILE(["T1"], [reportPath(ws, "T1")]), label);
  }
  const ws = await judgeWs("e459-ac12c-", {
    ids: ["T1", "T2", "T3"],
    reports: { "qa_reports/review_T1.md": FIX.a("T1"), "qa_reports/review_T2.md": NONE.prose("T2"), "qa_reports/review_T3.md": FIX.d("T3") },
  });
  const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1", "T2", "T3"] }));
  assert.equal(text(r), MSG_MISSING_EVIDENCE_FILE(["T1", "T2"], [reportPath(ws, "T1"), reportPath(ws, "T2")]), "only the non-PASS ids, each with its path");
});

// ---------------------------------------------------------------- AC13

test("AC13: the same FAIL-standing report clears when the PASS write carries qa_review + review_task_ids (its auto-record makes the standing PASS)", async () => {
  const ws = await judgeWs("e459-ac13a-", { reports: { "qa_reports/review_T1.md": FIX.a("T1") } });
  const r = await upd(ws, w("code-reviewer", "PASS", {
    completed_tasks: ["T1"], review_task_ids: ["T1"], review_verdict: "APPROVED", qa_review: "re-judged after the fix: green",
  }));
  assert.ok(!rejected(r), `qa_review on the PASS write is PASS evidence: ${text(r)}`);
  assert.equal(state(ws).status, "PASS");
});

test("AC13: a covers: T2 report with standing PASS clears a PASS over [T2] without qa_review; at standing FAIL or none it is rejected MISSING_EVIDENCE", async () => {
  const ok = await judgeWs("e459-ac13b-", { ids: ["T2"], reports: { "qa_reports/review_batch-1.md": `covers: T2\n${FIX.d("batch")}` } });
  const r = await upd(ok, w("code-reviewer", "PASS", { completed_tasks: ["T2"] }));
  assert.ok(!rejected(r), `PASS-standing covering report: ${text(r)}`);

  for (const [label, body] of [["FAIL", FIX.a("batch")], ["none", NONE.prose("batch")], ["hand-written PASS", NONE["hand-written PASS heading"]("batch")]]) {
    const ws = await judgeWs("e459-ac13c-", { ids: ["T2"], reports: { "qa_reports/review_batch-1.md": `covers: T2\n${body}` } });
    const r2 = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T2"] }));
    assert.ok(rejected(r2), `covering report at standing ${label}: ${text(r2)}`);
    assert.equal(text(r2), MSG_MISSING_EVIDENCE_FILE(["T2"], [reportPath(ws, "T2")]), label);
  }
});

test("AC13: the rule covers every id the PASS lists in completed_tasks (carried-forward ids too), under every evidence_schema pin", async () => {
  // Why: it is a defect fix to what counts as a verdict, not a new evidence-schema rule (cut D-B).
  for (const pin of [1, 2, 3, undefined]) {
    const ws = await judgeWs("e459-ac13d-", { pin, completed: ["T1"], reports: { "qa_reports/review_T1.md": FIX.a("T1") } });
    const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1"] }));
    assert.ok(rejected(r), `pin ${pin}: carried-forward T1 at standing FAIL refused: ${text(r)}`);
    assert.equal(text(r), MSG_MISSING_EVIDENCE_FILE(["T1"], [reportPath(ws, "T1")]), `pin ${pin}`);
  }
});

test("AC13: (deliberate, architecture OQ 2) own report standing FAIL + a covers: report standing PASS = PASS evidence, for the PASS gate, lane-status and drift alike", async () => {
  // Why: any PASS-standing candidate report qualifies and timestamps are never compared across files; only the
  // server writes a PASS verdict section, and only on the judge's own write, so this is the judge's call.
  const reports = {
    "qa_reports/review_T1.md": FIX.a("T1"),
    "qa_reports/review_batch-1.md": `covers: T1\n${FIX.d("batch")}`,
  };
  const ws = await judgeWs("e459-oq2-", { reports });
  const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1"] }));
  assert.ok(!rejected(r), `PASS gate credits the PASS-standing covering report: ${text(r)}`);

  const lane = mkWs("e459-oq2-lane-");
  for (const [rel, body] of Object.entries(reports)) put(lane, rel, body);
  assert.deepEqual(checkLaneEvidence(lane, F, ["T1"]).evidenceIds, ["T1"], "lane-status credits it");
  assert.ok(hasEvidenceAnywhere(lane, ["T1"]).has("T1"), "drift credits it");
});

// ---------------------------------------------------------------- AC14

test("AC14: expected-red disposition heading follows the pin — '## Step 7 — Expected-Red Diff' clears under pin 2, 3 and no pin, is rejected under pin 1; '## Expected-Red Diff' clears under every pin", async () => {
  const run = async (pin, heading) => {
    const ws = await judgeWs("e459-ac14-", { pin, reports: { "qa_reports/review_T1.md": `${HEAD("T1")}\n${heading}\n\nclean: 1/1 manifest entries confirmed red, now green\n` } });
    put(ws, `qa_reports/expected-red_${F}.txt`, "# scenario\ntest/x.test.mjs | AC1: red\n");
    return upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1"], review_task_ids: ["T1"], qa_review: "expected-red diff recorded" }));
  };
  for (const pin of [2, 3, undefined]) {
    const r = await run(pin, "## Step 7 — Expected-Red Diff");
    assert.ok(!rejected(r), `pin ${pin}: prefixed heading clears (normalized-contains, like AC_EXECUTION_LOG): ${text(r)}`);
  }
  const r1 = await run(1, "## Step 7 — Expected-Red Diff");
  assert.ok(rejected(r1), "pin 1 keeps the exact anchor");
  assert.match(text(r1), /^⛔ EXPECTED_RED_DIFF_MISSING: T1\. /);
  for (const pin of [1, 2, 3, undefined]) {
    const r = await run(pin, "## Expected-Red Diff");
    assert.ok(!rejected(r), `pin ${pin}: the canonical heading clears: ${text(r)}`);
  }
});

// ---------------------------------------------------------------- AC15

test("AC15: lane-status — server FAIL then a hand-written PASS heading is claimedWithoutEvidence; a last server PASS by code-reviewer (or pre-v5 qa-engineer) is credited; server PASS then server FAIL is not", () => {
  const ws = mkWs("e459-ac15-");
  put(ws, "qa_reports/review_T1.md", FIX.b("T1"));
  put(ws, "qa_reports/review_T2.md", FIX.d("T2"));
  put(ws, "qa_reports/review_T3.md", HEAD("T3") + SERVER("PASS", TS1, "qa-engineer"));
  put(ws, "qa_reports/review_T4.md", FIX.c("T4"));
  const res = checkLaneEvidence(ws, F, ["T1", "T2", "T3", "T4"]);
  assert.deepEqual(res.evidenceIds, ["T2", "T3"], JSON.stringify(res));
  assert.deepEqual(res.claimedWithoutEvidence, ["T1", "T4"]);
});

// ---------------------------------------------------------------- AC16

test("AC16: judgeReportStanding (tools/evidence-file.ts) reads only server-recorded verdict sections, last one wins", () => {
  assert.equal(typeof EF.judgeReportStanding, "function", "judgeReportStanding is exported from tools/evidence-file");
  assert.equal(typeof EF.isPassStanding, "function", "isPassStanding is exported from tools/evidence-file");
  const s = (c) => ({ ...EF.judgeReportStanding(c) });
  assert.deepEqual(s(FIX.a("T1")), { verdict: "FAIL", signer: "code-reviewer", recordedAt: TS1 });
  assert.deepEqual(s(FIX.b("T1")), { verdict: "FAIL", signer: "code-reviewer", recordedAt: TS1 }, "(b) the hand-written heading is not a verdict");
  assert.deepEqual(s(FIX.c("T1")), { verdict: "FAIL", signer: "code-reviewer", recordedAt: TS2 });
  assert.deepEqual(s(FIX.d("T1")), { verdict: "PASS", signer: "code-reviewer", recordedAt: TS1 });
  for (const [label, body] of Object.entries(NONE)) {
    assert.deepEqual(s(body("T1")), { verdict: null, signer: null, recordedAt: null }, `standing none: ${label}`);
  }
  assert.deepEqual(s(""), { verdict: null, signer: null, recordedAt: null }, "empty text");
  assert.equal(s(FIX.d("T1").replace(/\n/g, "\r\n")).verdict, "PASS", "a CRLF-edited report keeps its verdict");
  assert.equal(EF.isPassStanding(EF.judgeReportStanding(FIX.d("T1"))), true);
  assert.equal(EF.isPassStanding(EF.judgeReportStanding(FIX.a("T1"))), false);
  assert.equal(EF.isPassStanding(EF.judgeReportStanding(NONE.prose("T1"))), false);
  assert.equal(EF.isPassStanding(EF.judgeReportStanding(FIX.d("T1")), ["qa-engineer"]), false, "signer filter");
  assert.equal(EF.isPassStanding(EF.judgeReportStanding(FIX.d("T1")), ["code-reviewer", "qa-engineer"]), true);
});

test("AC16: on fixtures (a) standing FAIL, (b) server FAIL + hand-written PASS, (c) server PASS + server FAIL, (d) standing PASS, the PASS gate, lane-status and drift agree: only (d) is PASS evidence", async () => {
  for (const [key, make] of Object.entries(FIX)) {
    const want = key === "d";
    const body = make("T1");

    const ws = await judgeWs(`e459-ac16${key}-`, { reports: { "qa_reports/review_T1.md": body } });
    const r = await upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T1"] }));
    assert.equal(!rejected(r), want, `(${key}) PASS gate without qa_review: ${text(r)}`);
    if (!want) assert.match(text(r), /^⛔ MISSING_EVIDENCE: T1\. /, `(${key})`);

    const lane = mkWs(`e459-ac16${key}-lane-`);
    put(lane, "qa_reports/review_T1.md", body);
    const ls = checkLaneEvidence(lane, F, ["T1"]);
    assert.equal(ls.evidenceIds.includes("T1"), want, `(${key}) lane-status: ${JSON.stringify(ls)}`);
    assert.equal(hasEvidenceAnywhere(lane, ["T1"]).has("T1"), want, `(${key}) drift`);
  }
});

test("AC16: (kept trust class) a report with no server-recorded verdict at all — even a hand-written PASS heading — is still credited by drift, never by lane-status or the PASS gate", async () => {
  // Human ruling: drift keeps crediting verdict-less reports (test/e112 pins it); only how it RECOGNISES a
  // verdict changed. lane-status and the PASS gate need standing PASS.
  for (const [label, make] of Object.entries(NONE)) {
    const lane = mkWs("e459-ac16n-");
    put(lane, "qa_reports/review_T1.md", make("T1"));
    assert.ok(hasEvidenceAnywhere(lane, ["T1"]).has("T1"), `${label}: drift credits a verdict-less report`);
    assert.deepEqual(checkLaneEvidence(lane, F, ["T1"]).evidenceIds, [], `${label}: lane-status does not`);
  }
});

test("AC16: lane-status and drift read standing through the shared predicate and restate no verdict-heading regex of their own", () => {
  const code = (rel) =>
    fs.readFileSync(path.join(ROOT, rel), "utf-8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const importsPredicate = /import\s*\{[^}]*\b(?:judgeReportStanding|isPassStanding)\b[^}]*\}\s*from\s*"(?:\.\.\/tools|\.)\/evidence-file\.js"/;
  for (const rel of ["tools/lane-status.ts", "tools/evidence-lookup.ts", "gates/qa-review.ts"]) {
    const src = code(rel);
    assert.match(src, importsPredicate, `${rel} imports the shared standing predicate from evidence-file`);
    assert.match(src, /judgeReportStanding\(/, `${rel} calls judgeReportStanding`);
  }
  for (const rel of ["tools/lane-status.ts", "tools/evidence-lookup.ts"]) {
    const src = code(rel);
    for (const needle of ["PASS|FAIL", "FAIL|PASS", "— PASS — by", "\\sPASS\\s", "JUDGE_PASS_HEADER_RE", "VERDICT_HEADING_RE"]) {
      assert.ok(!src.includes(needle), `${rel} restates a verdict-heading pattern (${needle})`);
    }
  }
});

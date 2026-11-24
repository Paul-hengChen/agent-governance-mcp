// Coded by @qa-engineer
// Scenario tests for specs/e431-test-first-server-path.md (AC1-AC18; AC19/AC20 have their own proofs).
// Invariant: a feature runs the test-first chain (pm -> (architect) -> qa-engineer -> sr-engineer ->
// code-reviewer, who judges and writes PASS) on every feature since E435: a chain_path carried on input is
// stripped, never stored; removed old-path steps get the docs/migration-v5.md hint. Tests drive the real tool entries
// (TOOL_REGISTRY.run -> zod + orchestrator) against temp workspaces, so each outcome is the one a client sees.
// Scope note: PASS-time evidence for the new judge is E432; AC3 asserts the transition/identity layer and a
// handler write the current evidence gate accepts.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";
// Namespace import: E435 removes TEST_FIRST_OVERLAY; a named import of it would fail the whole file at link time.
import * as T from "../dist/tools/transitions.js";
import { GATE_REGISTRY } from "../dist/gates/registry.js";
import { UPDATE_STATE_GATE_PIPELINE } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

const { validateTransition, HOP_CAP_EXPORTED, SR_RETURN_CAP_EXPORTED, TEST_FIRST_OVERLAY } = T;

let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite e431 case skipped");
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const ADD = TOOL_REGISTRY.find((e) => e.name === "tw_add_task");
const COMPLETE = TOOL_REGISTRY.find((e) => e.name === "tw_complete_task");

// E435 Copy / Strings, frozen (zod-boundary messages by their quote-free tails: a ZodError's JSON escapes '"').
const IN_FLIGHT_HINT =
  " If this feature started on the pre-v5 chain, docs/migration-v5.md says how to finish or restart it.";
const PM_TO_SR_HINT = (a) =>
  ` The build entry is qa-engineer: hand off ${a}:In_Progress → qa-engineer:In_Progress; qa-engineer writes the scenario tests, or records that the ticket needs no new test, before sr-engineer builds.`;
const QA_JUDGE_HINT =
  " qa-engineer writes tests and never writes PASS or FAIL: code-reviewer is the judge and writes them from code-reviewer:In_Progress.";
const REVIEWER_TO_QA_HINT =
  ' code-reviewer is the judge and closes the feature: approve with code-reviewer:PASS (review_verdict: "APPROVED"), or reject with code-reviewer:FAIL; qa-engineer does not follow code-reviewer.';
const QA_PASS_TAIL = "code-reviewer is the judge; qa-engineer writes tests and never writes PASS.";
const RESUME_OF_TAIL = "pm:In_Progress → qa-engineer:In_Progress is an ordinary edge, so omit resume_of there.";

// ---------------------------------------------------------------- helpers

function mkWs(prefix = "e431-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔") || text(r).startsWith("❌");

// Seed a handoff through the real writer, then pin the stamp so the next write is not freshness-suspect.
async function seed(ws, feature, agent, status, opts = {}) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: agent,
    cutApproved: true,
    ...opts,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}

// One client write: zod + orchestrator. A zod failure surfaces as a rejection, as it does to a client.
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

const state = (ws) => new FileHandoffStorage().parse(ws);
// upd() re-pins last_updated before each write, so compare everything except that stamp.
const handoffBytes = (ws) =>
  fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8").replace(/^last_updated:.*$/m, "last_updated: <pinned>");
const noMarkerOnDisk = (ws) =>
  assert.doesNotMatch(fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8"), /chain_path/, "chain_path never stored");

// The JSON envelope of a transition-json rejection, when the text carries one.
function envelope(r) {
  const t = text(r);
  const i = t.indexOf("{");
  assert.ok(i >= 0, `expected a JSON envelope in: ${t}`);
  return JSON.parse(t.slice(i));
}

const F = "e431-feat";

// Frozen schema 16 handoff carrying the pre-E435 marker (copy of e435-remove-old-path v16Handoff, not imported).
function writeV16Marked(ws, agent, status) {
  const p = resolveCurrentLanePaths(ws).handoffPath;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, [
    "---", "schema_version: 16", `active_feature: "${F}"`, `status: "${status}"`,
    'last_updated: "2026-01-01T00:00:00.123Z"', `last_agent: "${agent}"`, "cut_approved: true",
    'scope_decision: "single-feature"', 'chain_path: "test-first"',
    "qa_round: 2", "review_round: 0", "visual_round: 0", "hop_count: 0", "qa_rounds_total: 3",
    "review_rounds_total: 0", "visual_rounds_total: 0", "---", "# Handoff State", "", "## Completed", "- (none)", "",
    "## Pending & Handoff Notes", "- seed", "", "---",
    "> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.", "",
  ].join("\n"));
}

// E432: a qa-engineer -> sr-engineer hand-off needs the red-test manifest or the no-new-test record
// (qa_reports/no-new-test_<feature>.txt, existence only). These scenarios exercise routing, counters and
// markers, not the manifest rule (test/e432-judge-report-checks.test.mjs owns that), so they record "no new test".
function recordNoNewTest(ws) {
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", `no-new-test_${F}.txt`), "routing scenario, no new test\n");
}
const w = (agent, status, extra = {}) => ({ active_feature: F, status, agent_id: agent, ...extra });

// ---------------------------------------------------------------- AC1

test("AC1 (E435): pm -> qa-engineer (no resume_of, no marker) then qa-engineer -> sr-engineer both accepted; a chain_path carried on input is stripped, not stored", async () => {
  const ws = mkWs("e431-ac1-");
  recordNoNewTest(ws);
  await seed(ws, F, "pm", "In_Progress");
  const r1 = await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(!rejected(r1), `pm -> qa is an ordinary edge; an old client's marker is ignored: ${text(r1)}`);
  assert.equal(state(ws).chain_path, undefined, "the carried marker is stripped, not stored");
  const r2 = await upd(ws, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(r2), `qa -> sr accepted with no marker: ${text(r2)}`);
  assert.equal(state(ws).chain_path, undefined);
  noMarkerOnDisk(ws);
});

// ---------------------------------------------------------------- AC2

test("AC2 (E435): architect -> qa accepted with no marker; pm/architect -> sr-engineer rejected TRANSITION_REJECTED with the S1/S2 hint", async () => {
  const ws = mkWs("e431-ac2-");
  await seed(ws, F, "architect", "In_Progress");
  const ok = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(ok), `architect -> qa accepted: ${text(ok)}`);

  for (const from of ["architect", "pm"]) {
    const ws2 = mkWs("e431-ac2b-");
    await seed(ws2, F, from, "In_Progress");
    const before = handoffBytes(ws2);
    const r = await upd(ws2, w("sr-engineer", "In_Progress"));
    assert.ok(rejected(r), `${from} -> sr is not an edge`);
    assert.match(text(r), /TRANSITION_REJECTED/);
    assert.ok(envelope(r).hint.endsWith(PM_TO_SR_HINT(from) + IN_FLIGHT_HINT), `hint names qa-engineer as the build entry: ${text(r)}`);
    assert.equal(handoffBytes(ws2), before, "a rejected write leaves state untouched");
  }
});

// ---------------------------------------------------------------- AC3

test("AC3 (E435): code-reviewer:In_Progress -> code-reviewer:PASS passes the transition check with no marker; qa-engineer:PASS gets the S4 hint", () => {
  // The tool boundary (zod, run via UPD.run in the next test) accepts a code-reviewer PASS; the transition layer agrees.
  const judge = validateTransition({
    prev: { agent: "code-reviewer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "PASS" },
    prev_review_round: 0,
  });
  assert.equal(judge, null, "no TRANSITION_REJECTED for the judge's PASS, on every feature");
  const qa = validateTransition({
    prev: { agent: "code-reviewer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "PASS" },
    prev_review_round: 0,
  });
  assert.equal(qa?.error, "TRANSITION_REJECTED");
  assert.ok(qa.hint.endsWith(QA_JUDGE_HINT + IN_FLIGHT_HINT), `S4 hint expected, got ${qa.hint}`);
});

test("AC3: ledger completed by code-reviewer via tw_complete_task, completed_tasks [] -> PASS accepted, last_agent code-reviewer", async () => {
  const ws = mkWs("e431-ac3-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  resetSession(ws); markStateRead(ws);
  await ADD.run({ workspace_path: ws, task_id: "T-1", description: "one" });
  const c = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.match(text(c), /"success":true/);
  const r = await upd(ws, w("code-reviewer", "PASS", { qa_review: "judged", review_task_ids: ["T-1"] }));
  assert.ok(!rejected(r), `code-reviewer PASS accepted: ${text(r)}`);
  const s = state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.last_agent, "code-reviewer");
});

// ---------------------------------------------------------------- AC4

test("AC4 (E435): qa-engineer PASS is rejected naming code-reviewer, no state written (from qa and from code-reviewer)", async () => {
  for (const from of ["qa-engineer", "code-reviewer"]) {
    const ws = mkWs("e431-ac4-");
    await seed(ws, F, from, "In_Progress");
    const before = handoffBytes(ws);
    const r = await upd(ws, w("qa-engineer", "PASS", { qa_review: "x", review_task_ids: ["T-1"], completed_tasks: ["T-1"] }));
    assert.ok(rejected(r), `qa PASS from ${from}:In_Progress must be rejected`);
    assert.ok(text(r).includes(QA_PASS_TAIL), `rejection names code-reviewer as the judge: ${text(r)}`);
    assert.ok(text(r).includes("docs/migration-v5.md"), `rejection carries the migration hint: ${text(r)}`);
    assert.equal(handoffBytes(ws), before, "no state written");
  }
});

// ---------------------------------------------------------------- AC5

test("AC5: after code-reviewer FAIL -> qa, qa straight back to code-reviewer is rejected; qa -> sr -> code-reviewer accepted", async () => {
  const ws = mkWs("e431-ac5-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  const f = await upd(ws, w("code-reviewer", "FAIL", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "scenario gap" }));
  assert.ok(!rejected(f), `code-reviewer FAIL accepted: ${text(f)}`);
  assert.equal(state(ws).review_round, 1);
  const q = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(q), `code-reviewer FAIL -> qa accepted: ${text(q)}`);

  const ws2 = mkWs("e431-ac5b-");
  recordNoNewTest(ws2);
  await seed(ws2, F, "qa-engineer", "In_Progress", { reviewRound: 1 });
  const before = handoffBytes(ws2);
  const bad = await upd(ws2, w("code-reviewer", "In_Progress"));
  assert.ok(rejected(bad));
  assert.match(text(bad), /TRANSITION_REJECTED/);
  assert.equal(handoffBytes(ws2), before);

  const sr = await upd(ws2, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(sr), `qa -> sr accepted: ${text(sr)}`);
  const cr = await upd(ws2, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(cr), `sr -> code-reviewer accepted: ${text(cr)}`);
});

// ---------------------------------------------------------------- AC6

test("AC6: third sr -> qa return rejected SR_RETURN_CAP_EXCEEDED routing to pm; pm resets; other writes not blocked", async () => {
  assert.equal(SR_RETURN_CAP_EXPORTED, 2);
  const ws = mkWs("e431-ac6-");
  recordNoNewTest(ws);
  await seed(ws, F, "sr-engineer", "In_Progress");
  for (const expected of [1, 2]) {
    const back = await upd(ws, w("qa-engineer", "In_Progress"));
    assert.ok(!rejected(back), `return ${expected} accepted: ${text(back)}`);
    assert.equal(state(ws).sr_return_count, expected);
    assert.equal(state(ws).review_round, 0, "sr returns are not review rounds");
    const fwd = await upd(ws, w("sr-engineer", "In_Progress"));
    assert.ok(!rejected(fwd), `qa -> sr accepted: ${text(fwd)}`);
    assert.equal(state(ws).sr_return_count, expected, "qa -> sr does not touch the counter");
  }
  const before = handoffBytes(ws);
  const third = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(third));
  assert.match(text(third), /SR_RETURN_CAP_EXCEEDED/);
  const env = envelope(third);
  assert.deepEqual(env.allowed, [{ new_agent: "pm", new_status: "In_Progress" }]);
  assert.match(text(third), /pm/);
  assert.match(text(third), /sr_return_count=2 — sr-engineer has returned this feature to qa-engineer the maximum 2 times\. Route to pm \(pm:In_Progress\) for a human ruling on the scenario\./);
  assert.equal(handoffBytes(ws), before);

  const pm = await upd(ws, w("pm", "In_Progress", { cut_approved: true }));
  assert.ok(!rejected(pm), `pm landing accepted: ${text(pm)}`);
  assert.ok(!state(ws).sr_return_count, "pm:In_Progress resets sr_return_count to 0");

  // The cap is edge-specific: sr -> code-reviewer is not blocked at sr_return_count 2.
  const ws2 = mkWs("e431-ac6b-");
  await seed(ws2, F, "sr-engineer", "In_Progress", { srReturnCount: 2 });
  const other = await upd(ws2, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(other), `sr -> code-reviewer not blocked by the cap: ${text(other)}`);
});

// ---------------------------------------------------------------- AC7

test("AC7: code-reviewer rejections to qa and to sr together reach review_round 4; next non-pm write REVIEW_ROUND_EXCEEDED", async () => {
  const ws = mkWs("e431-ac7-");
  recordNoNewTest(ws);
  await seed(ws, F, "code-reviewer", "In_Progress");
  const fail = () => upd(ws, w("code-reviewer", "FAIL", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "no" }));
  const hop = async (agent) => {
    const r = await upd(ws, w(agent, "In_Progress"));
    assert.ok(!rejected(r), `${agent} accepted: ${text(r)}`);
  };
  assert.ok(!rejected(await fail())); assert.equal(state(ws).review_round, 1);
  await hop("qa-engineer"); await hop("sr-engineer"); await hop("code-reviewer"); // routed to qa
  assert.ok(!rejected(await fail())); assert.equal(state(ws).review_round, 2);
  await hop("sr-engineer"); await hop("code-reviewer"); // routed to sr
  assert.ok(!rejected(await fail())); assert.equal(state(ws).review_round, 3);
  await hop("qa-engineer"); await hop("sr-engineer"); await hop("code-reviewer");
  assert.ok(!rejected(await fail())); assert.equal(state(ws).review_round, 4);

  const blocked = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(blocked));
  assert.match(text(blocked), /REVIEW_ROUND_EXCEEDED/);
  const toSr = await upd(ws, w("sr-engineer", "In_Progress"));
  assert.match(text(toSr), /REVIEW_ROUND_EXCEEDED/);
  const pm = await upd(ws, w("pm", "In_Progress", { cut_approved: true }));
  assert.ok(!rejected(pm), "pm:In_Progress is the only way out");
});

// ---------------------------------------------------------------- AC8

test("AC8 (E435): pm -> qa without cut_approved rejected CUT_APPROVAL_REQUIRED; a carried chain_path neither exempts nor is stored", async () => {
  const ws = mkWs("e431-ac8a-");
  await seed(ws, F, "pm", "In_Progress", { cutApproved: false });
  const r = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /CUT_APPROVAL_REQUIRED/);

  const ws2 = mkWs("e431-ac8b-");
  await seed(ws2, F, "pm", "In_Progress", { cutApproved: false });
  const before = handoffBytes(ws2);
  const r2 = await upd(ws2, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(rejected(r2), "an old client's marker opens no route around the build-entry checks");
  assert.match(text(r2), /CUT_APPROVAL_REQUIRED/);
  assert.equal(handoffBytes(ws2), before);
});

test("AC8 (E435): pm -> qa rejected EXTERNAL_REFS_UNRESOLVED with an unresolved external ref (no marker)", async () => {
  const ws = mkWs("e431-ac8c-");
  await seed(ws, F, "pm", "In_Progress", { externalRefs: [{ ref: "https://example.invalid/spec", state: "unresolved" }] });
  const r = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /EXTERNAL_REFS_UNRESOLVED/);
});

function writeDesign(ws, body) {
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(path.join(ws, "design", `${F}.md`), body, "utf-8");
}

test("AC8 (E435): pm -> qa rejected SCOPE_DECISION_REQUIRED with an armed design and no scope decision (no marker)", async () => {
  const ws = mkWs("e431-ac8d-");
  writeDesign(ws, "# design\n\nmode: figma\n\n## Layout / Canvas\n\nx\n");
  await seed(ws, F, "pm", "In_Progress");
  const r = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /SCOPE_DECISION_REQUIRED/);
});

test("AC8 (E435): pm -> qa rejected SOURCE_CREDIBILITY_UNVERIFIED with an un-attested fetch-based design (no marker)", async () => {
  const ws = mkWs("e431-ac8e-");
  writeDesign(
    ws,
    "# design\n\nmode: figma\n\n## Source\n\n" +
      "| medium | pointer | fetched | status | credibility | reason |\n" +
      "|--------|---------|---------|--------|-------------|--------|\n" +
      "| figma | node 1:2 | yes | audited |  | — |\n",
  );
  await seed(ws, F, "pm", "In_Progress", { scopeDecision: "single-feature" });
  const r = await upd(ws, w("qa-engineer", "In_Progress", { scope_decision: "single-feature" }));
  assert.ok(rejected(r));
  assert.match(text(r), /SOURCE_CREDIBILITY_UNVERIFIED/);
});

test("AC8 (E435): unapproved pm -> qa carrying resume_of: qa-engineer is rejected at the tool boundary (the hand-back exemption is gone), no state written", async () => {
  const ws = mkWs("e431-ac8f-");
  await seed(ws, F, "pm", "In_Progress", { cutApproved: false });
  const before = handoffBytes(ws);
  const r = await upd(ws, w("qa-engineer", "In_Progress", { resume_of: "qa-engineer" }));
  assert.ok(rejected(r), `resume_of: qa-engineer is no longer a value: ${text(r)}`);
  assert.ok(text(r).includes(RESUME_OF_TAIL), `RESUME_OF_ENUM_MESSAGE expected: ${text(r)}`);
  assert.equal(handoffBytes(ws), before);
});

// ---------------------------------------------------------------- AC9

test("AC9 (E435): pm -> qa with neither marker nor resume_of is accepted; a pm-row miss hint names only the code-reviewer resume, no chain_path", async () => {
  const ws = mkWs("e431-ac9-");
  await seed(ws, F, "pm", "In_Progress");
  const ok = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(ok), `pm -> qa is an ordinary edge: ${text(ok)}`);

  const ws2 = mkWs("e431-ac9c-");
  await seed(ws2, F, "pm", "In_Progress");
  const r = await upd(ws2, w("code-reviewer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /TRANSITION_REJECTED/);
  const hint = envelope(r).hint;
  assert.ok(hint.includes('resume_of: "code-reviewer"'), "hint names the Amend-Resume form");
  assert.ok(!hint.includes("chain_path"), `no marker form in the hint: ${hint}`);
  assert.ok(!hint.includes("Test-first entry"), `the Test-first entry sentence is gone: ${hint}`);
  assert.ok(!hint.includes('resume_of: "qa-engineer"'), `no qa-engineer resume form: ${hint}`);
});

test("AC9 (E435): an in-flight schema 16 marked feature at pm:In_Progress moves to qa-engineer with no resume_of; the write stores schema 17 with no marker", async () => {
  const ws = mkWs("e431-ac9b-");
  writeV16Marked(ws, "pm", "In_Progress");
  const r = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(r), `pm -> qa without resume_of: ${text(r)}`);
  const raw = fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8");
  assert.match(raw, /^schema_version: 17$/m);
  assert.doesNotMatch(raw, /chain_path|qa_round/);
});

// ---------------------------------------------------------------- AC10

test("AC10 (E435): a chain_path carried on any write is stripped — never stored, never carried; a feature change stores none either", async () => {
  const ws = mkWs("e431-ac10-");
  recordNoNewTest(ws);
  await seed(ws, F, "pm", "In_Progress");
  assert.ok(!rejected(await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }))));
  assert.equal(state(ws).chain_path, undefined, "stripped on the entry write");
  assert.ok(!rejected(await upd(ws, w("qa-engineer", "In_Progress", { pending_notes: ["still here"] }))));
  assert.ok(!rejected(await upd(ws, w("sr-engineer", "In_Progress", { chain_path: "test-first" }))));
  assert.equal(state(ws).chain_path, undefined, "stripped mid-chain");
  noMarkerOnDisk(ws);

  const ws2 = mkWs("e431-ac10b-");
  await seed(ws2, F, "pm", "In_Progress");
  const next = await upd(ws2, { active_feature: "e431-next", status: "In_Progress", agent_id: "pm", chain_path: "test-first" });
  assert.ok(!rejected(next), `new feature opened: ${text(next)}`);
  assert.equal(state(ws2).active_feature, "e431-next");
  assert.equal(state(ws2).chain_path, undefined, "the new feature stores no marker");
});

test("AC10 (E435): chain_path carried mid-chain is ignored: sr -> code-reviewer accepted and stores none; code-reviewer -> qa-engineer rejected with the S3 hint, no state written", async () => {
  const ws = mkWs("e431-ac10c-");
  await seed(ws, F, "sr-engineer", "In_Progress");
  const ok = await upd(ws, w("code-reviewer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(!rejected(ok), `sr -> code-reviewer is the chain's edge, marker or not: ${text(ok)}`);
  assert.equal(state(ws).chain_path, undefined);

  const ws2 = mkWs("e431-ac10d-");
  await seed(ws2, F, "code-reviewer", "In_Progress");
  const before = handoffBytes(ws2);
  const r = await upd(ws2, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(rejected(r), "code-reviewer -> qa-engineer is a removed step, marker or not");
  assert.match(text(r), /TRANSITION_REJECTED/);
  assert.ok(envelope(r).hint.endsWith(REVIEWER_TO_QA_HINT + IN_FLIGHT_HINT), `S3 hint expected: ${text(r)}`);
  assert.equal(handoffBytes(ws2), before);
});

// ---------------------------------------------------------------- AC11

test("AC11 (E435): code-reviewer:PASS exits to pm, researcher, release-engineer and design-auditor (no marker)", async () => {
  for (const next of ["pm", "researcher", "release-engineer", "design-auditor"]) {
    const ws = mkWs("e431-ac11-");
    await seed(ws, F, "code-reviewer", "PASS");
    const r = await upd(ws, w(next, "In_Progress"));
    assert.ok(!rejected(r), `code-reviewer:PASS -> ${next} accepted: ${text(r)}`);
  }
});

test("AC11 (E435): code-reviewer PASS with no marker is accepted (was rejected unmarked); the legacy qa-engineer:PASS / qa-engineer:FAIL keys still exit (DR-3)", async () => {
  const ws = mkWs("e431-ac11b-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  const r = await upd(ws, w("code-reviewer", "PASS", { qa_review: "x", review_task_ids: ["T-1"] }));
  assert.ok(!rejected(r), `the judge's PASS on any feature: ${text(r)}`);
  assert.equal(state(ws).last_agent, "code-reviewer");

  // Legacy exit keys: a handoff left at qa-engineer:PASS / :FAIL by the pre-v5 chain can still leave it.
  for (const [status, next] of [["PASS", "pm"], ["PASS", "release-engineer"], ["FAIL", "sr-engineer"], ["FAIL", "pm"]]) {
    const v = validateTransition({
      prev: { agent: "qa-engineer", status }, next: { agent: next, status: "In_Progress" },
      prev_review_round: 0, feature_changed: status === "PASS",
    });
    assert.equal(v, null, `qa-engineer:${status} -> ${next} stays open as a legacy exit`);
  }
});

// Feature change: the next step after a PASS almost always opens a different
// active_feature (next ticket, release feature). The exit is judged on the
// code-reviewer:PASS key itself; no marker is read or written (E435).
const EXIT_ROLES = ["pm", "researcher", "release-engineer", "design-auditor"];

test("AC11 (E435): validateTransition accepts all four exits from code-reviewer:PASS on a feature change, no marker", () => {
  for (const next of EXIT_ROLES) {
    const r = validateTransition({
      prev: { agent: "code-reviewer", status: "PASS" },
      next: { agent: next, status: "In_Progress" },
      prev_review_round: 0, feature_changed: true,
    });
    assert.equal(r, null, `code-reviewer:PASS -> ${next} on a feature change accepted`);
  }
});

for (const next of EXIT_ROLES) {
  test(`AC11 (E435): feature change from code-reviewer:PASS accepted via handler for ${next}, new feature stores no marker`, async () => {
    const ws = mkWs("e431-ac11fc-");
    await seed(ws, F, "code-reviewer", "PASS");
    const r = await upd(ws, { active_feature: "e431-next-feat", status: "In_Progress", agent_id: next });
    assert.ok(!rejected(r), `${next} opening a new feature from code-reviewer:PASS accepted: ${text(r)}`);
    const s = state(ws);
    assert.equal(s.active_feature, "e431-next-feat");
    assert.equal(s.chain_path, undefined, "no marker on the new feature");
    assert.ok(!s.sr_return_count, "new feature carries no sr_return_count");
  });
}

test("AC11 (E435): feature-change write out of code-reviewer:PASS that carries chain_path is accepted for all four roles, the marker stripped", async () => {
  // Why: the marker no longer means anything, so carrying it can neither open nor close an exit;
  // each role's exit is decided by the code-reviewer:PASS row alone, and nothing is stored.
  for (const role of EXIT_ROLES) {
    const ws = mkWs("e431-ac11cp-");
    await seed(ws, F, "code-reviewer", "PASS");
    const r = await upd(ws, { active_feature: "e431-next-cp", status: "In_Progress", agent_id: role, chain_path: "test-first" });
    assert.ok(!rejected(r), `${role} carrying chain_path on a feature change accepted: ${text(r)}`);
    assert.equal(state(ws).active_feature, "e431-next-cp");
    assert.equal(state(ws).chain_path, undefined, "the carried marker is stripped");
    noMarkerOnDisk(ws);
  }
});

// ---------------------------------------------------------------- AC12

// E435: one chain for every feature, nothing marks it, and the dropped counters stay dropped.
const NOTHING_NEW = (s) => {
  assert.equal(s.chain_path, undefined, "no chain_path on any feature");
  assert.equal(s.qa_round, undefined, "qa_round dropped (schema 17)");
  assert.equal(s.qa_rounds_total, undefined, "qa_rounds_total dropped (schema 17)");
};

test("AC12 (E435): the one chain pm -> qa -> sr -> code-reviewer -> code-reviewer PASS keeps its counters; the old pm -> sr and code-reviewer -> qa steps are rejected with their hints", async () => {
  // Why: the old chain's happy path is now the new chain's; its counters behave as before, minus qa_round.
  const ws = mkWs("e431-ac12a-");
  await seed(ws, F, "pm", "In_Progress");
  recordNoNewTest(ws);
  for (const agent of ["qa-engineer", "sr-engineer", "code-reviewer"]) {
    const r = await upd(ws, w(agent, "In_Progress"));
    assert.ok(!rejected(r), `${agent}: ${text(r)}`);
  }
  assert.equal(state(ws).hop_count, 3);
  const pass = await upd(ws, w("code-reviewer", "PASS", { review_verdict: "APPROVED", completed_tasks: ["T-1"], review_task_ids: ["T-1"], qa_review: "ok" }));
  assert.ok(!rejected(pass), `code-reviewer PASS accepted: ${text(pass)}`);
  const s = state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.last_agent, "code-reviewer");
  assert.equal(s.review_round, 0);
  assert.equal(s.visual_round, 0);
  NOTHING_NEW(s);
  // The two old-path steps are closed and point at docs/migration-v5.md.
  const ws2 = mkWs("e431-ac12a2-");
  await seed(ws2, F, "pm", "In_Progress");
  const s1 = await upd(ws2, w("sr-engineer", "In_Progress"));
  assert.ok(rejected(s1) && envelope(s1).hint.endsWith(PM_TO_SR_HINT("pm") + IN_FLIGHT_HINT), `S1: ${text(s1)}`);
  const ws3 = mkWs("e431-ac12a3-");
  await seed(ws3, F, "code-reviewer", "In_Progress");
  const s3 = await upd(ws3, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(s3) && envelope(s3).hint.endsWith(REVIEWER_TO_QA_HINT + IN_FLIGHT_HINT), `S3: ${text(s3)}`);
});

test("AC12 (E435): pm -> architect -> qa -> sr variant and the code-reviewer FAIL -> sr loop keep their counters; a qa-engineer FAIL is rejected with the S5 hint", async () => {
  const ws = mkWs("e431-ac12b-");
  await seed(ws, F, "pm", "In_Progress");
  recordNoNewTest(ws);
  for (const agent of ["architect", "qa-engineer"]) {
    const r = await upd(ws, w(agent, "In_Progress"));
    assert.ok(!rejected(r), `${agent}: ${text(r)}`);
  }
  // qa-engineer writes tests, never a verdict: its FAIL is the removed step S5.
  const qaFail = await upd(ws, w("qa-engineer", "FAIL", { blocking_reason: "bug" }));
  assert.ok(rejected(qaFail) && envelope(qaFail).hint.endsWith(QA_JUDGE_HINT + IN_FLIGHT_HINT), `S5: ${text(qaFail)}`);
  for (const agent of ["sr-engineer", "code-reviewer"]) {
    const r = await upd(ws, w(agent, "In_Progress"));
    assert.ok(!rejected(r), `${agent}: ${text(r)}`);
  }
  assert.equal(state(ws).hop_count, 4);
  const fail = await upd(ws, w("code-reviewer", "FAIL", { blocking_reason: "bug", review_verdict: "CHANGES_REQUESTED" }));
  assert.ok(!rejected(fail), `code-reviewer FAIL: ${text(fail)}`);
  assert.equal(state(ws).review_round, 1);
  const back = await upd(ws, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(back), `FAIL -> sr: ${text(back)}`);
  assert.equal(state(ws).review_round, 1);
  NOTHING_NEW(state(ws));
});

test("AC12 (E435): bugfix-mode run and the code-reviewer Amend-Resume behave as before, storing no dropped field", async () => {
  const ws = mkWs("e431-ac12c-");
  await seed(ws, F, "sr-engineer", "In_Progress", { dispatchMode: "bugfix" });
  const r = await upd(ws, w("code-reviewer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /REPRO_MANIFEST_MISSING/);
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", `expected-red_${F}.txt`), "test/x.test.mjs | repro\n");
  const ok = await upd(ws, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(ok), `with the manifest: ${text(ok)}`);
  NOTHING_NEW(state(ws));

  const ws2 = mkWs("e431-ac12d-");
  await seed(ws2, F, "pm", "In_Progress");
  const resume = await upd(ws2, w("code-reviewer", "In_Progress", { resume_of: "code-reviewer" }));
  assert.ok(!rejected(resume), `Amend-Resume to code-reviewer: ${text(resume)}`);
  NOTHING_NEW(state(ws2));
});

test("AC12 (E435): every test-first edge is open with no marker; the five removed old-path steps S1-S5 are closed with their hints", () => {
  const base = { prev_review_round: 0 };
  const open = [
    [["pm", "In_Progress"], ["qa-engineer", "In_Progress"]],
    [["architect", "In_Progress"], ["qa-engineer", "In_Progress"]],
    [["qa-engineer", "In_Progress"], ["sr-engineer", "In_Progress"]],
    [["sr-engineer", "In_Progress"], ["qa-engineer", "In_Progress"]],
    [["code-reviewer", "In_Progress"], ["code-reviewer", "PASS"]],
    [["code-reviewer", "FAIL"], ["qa-engineer", "In_Progress"]],
    [["code-reviewer", "PASS"], ["pm", "In_Progress"]],
  ];
  for (const [[pa, ps], [na, ns]] of open) {
    const r = validateTransition({ ...base, prev: { agent: pa, status: ps }, next: { agent: na, status: ns } });
    assert.equal(r, null, `${pa}:${ps} -> ${na}:${ns} open on every feature`);
  }
  const removed = [
    [["pm", "In_Progress"], ["sr-engineer", "In_Progress"], PM_TO_SR_HINT("pm")],
    [["architect", "In_Progress"], ["sr-engineer", "In_Progress"], PM_TO_SR_HINT("architect")],
    [["code-reviewer", "In_Progress"], ["qa-engineer", "In_Progress"], REVIEWER_TO_QA_HINT],
    [["qa-engineer", "In_Progress"], ["qa-engineer", "PASS"], QA_JUDGE_HINT],
    [["qa-engineer", "In_Progress"], ["qa-engineer", "FAIL"], QA_JUDGE_HINT],
  ];
  for (const [[pa, ps], [na, ns], hint] of removed) {
    const r = validateTransition({ ...base, prev: { agent: pa, status: ps }, next: { agent: na, status: ns } });
    assert.equal(r?.error, "TRANSITION_REJECTED", `${pa}:${ps} -> ${na}:${ns} removed`);
    assert.ok(r.hint.endsWith(hint + IN_FLIGHT_HINT), `${pa}:${ps} -> ${na}:${ns} hint: ${r.hint}`);
  }
});

// ---------------------------------------------------------------- AC13

test("AC13 (E435): bugfix sr -> code-reviewer needs the repro manifest; code-reviewer PASS then passes the transition check (no marker)", async () => {
  const ws = mkWs("e431-ac13-");
  await seed(ws, F, "sr-engineer", "In_Progress", { dispatchMode: "bugfix" });
  const before = handoffBytes(ws);
  const r = await upd(ws, w("code-reviewer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /REPRO_MANIFEST_MISSING/);
  assert.equal(handoffBytes(ws), before);
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", `expected-red_${F}.txt`), "test/x.test.mjs | repro\n");
  const ok = await upd(ws, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(ok), `with the manifest: ${text(ok)}`);
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "In_Progress" },
      next: { agent: "code-reviewer", status: "PASS" },
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------------------------------------------------------------- AC14

async function ledgerWs() {
  const ws = mkWs("e431-ac14-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  resetSession(ws); markStateRead(ws);
  await ADD.run({ workspace_path: ws, task_id: "T-1", description: "one" });
  return ws;
}

const COMPLETE_BLOCKED = (who) =>
  `⛔ BLOCKED: tw_complete_task is reserved for code-reviewer, the chain's judge. Called by "${who}". Hand off to code-reviewer and pass agent_id="code-reviewer".`;

test("AC14 (E435): code-reviewer completes the task; qa-engineer rejected naming code-reviewer plus the migration hint (Copy verbatim)", async () => {
  const ws = await ledgerWs();
  const qa = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "qa-engineer" });
  assert.equal(text(qa), COMPLETE_BLOCKED("qa-engineer") + IN_FLIGHT_HINT);
  const cr = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.match(text(cr), /"marked":"completed"/);
});

test("AC14 (E435): another role (sr-engineer) is rejected naming code-reviewer with no migration hint; code-reviewer then completes", async () => {
  // Why: the in-flight hint is for the pre-v5 judge only; no other role ever completed tasks.
  const ws = await ledgerWs();
  const sr = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "sr-engineer" });
  assert.equal(text(sr), COMPLETE_BLOCKED("sr-engineer"));
  const cr = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.match(text(cr), /"marked":"completed"/);
});

// ---------------------------------------------------------------- AC15

const NON_JUDGE_HINT =
  "completed_tasks on a write not stamped agent_id=code-reviewer is ledger pollution: only code-reviewer, the chain's judge, may grow completed_tasks (or complete tasks through tw_complete_task), backed by the QA_COMPLETION_EVIDENCE_MISSING evidence gate. Omit completed_tasks (or pass []) on this write. See docs/backlog.md E40.";
const nonJudgeRejected = (r) =>
  text(r).includes("⛔ NON_JUDGE_COMPLETED_TASKS_REJECTED: completed_tasks=") && text(r).includes(NON_JUDGE_HINT);

test("AC15 (E435): code-reviewer completed_tasks allowed, qa-engineer's rejected NON_JUDGE_COMPLETED_TASKS_REJECTED, APPROVED PASS ok, FAIL removes ids (no marker)", async () => {
  const ws = mkWs("e431-ac15a-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  const cr = await upd(ws, w("code-reviewer", "FAIL", { completed_tasks: ["T-1"], blocking_reason: "x", review_verdict: "CHANGES_REQUESTED" }));
  assert.ok(!text(cr).includes("COMPLETED_TASKS_REJECTED"), `got: ${text(cr)}`);

  const ws2 = mkWs("e431-ac15b-");
  await seed(ws2, F, "qa-engineer", "In_Progress");
  const qa = await upd(ws2, w("qa-engineer", "In_Progress", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(qa));
  assert.ok(nonJudgeRejected(qa), `got: ${text(qa)}`);

  const ws3 = mkWs("e431-ac15c-");
  await seed(ws3, F, "code-reviewer", "In_Progress");
  const pass = await upd(ws3, w("code-reviewer", "PASS", { review_verdict: "APPROVED", qa_review: "ok", review_task_ids: ["T-9"] }));
  assert.ok(!text(pass).includes("REVIEW_VERDICT_STATUS_MISMATCH"), `got: ${text(pass)}`);

  const ws4 = mkWs("e431-ac15d-");
  await seed(ws4, F, "code-reviewer", "In_Progress", { completedTasks: ["T-1", "T-2"] });
  const fail = await upd(ws4, w("code-reviewer", "FAIL", { review_task_ids: ["T-1"], blocking_reason: "redo", review_verdict: "CHANGES_REQUESTED" }));
  assert.ok(!rejected(fail), `FAIL: ${text(fail)}`);
  const done = state(ws4).completed_tasks.join("|");
  assert.ok(!done.includes("T-1") && done.includes("T-2"), `T-1 removed, T-2 kept; got ${done}`);
});

test("AC15 (E435): a non-empty completed_tasks from sr-engineer or pm is rejected NON_JUDGE_COMPLETED_TASKS_REJECTED, no state written; the two removed ledger codes are never emitted", async () => {
  // Why: the old split (code-reviewer barred, qa evidence-checked) is one rule now — only the judge grows the ledger.
  for (const agent of ["sr-engineer", "pm"]) {
    const ws = mkWs("e431-ac15e-");
    await seed(ws, F, agent, "In_Progress");
    const before = handoffBytes(ws);
    const r = await upd(ws, w(agent, "In_Progress", { completed_tasks: ["T-1"] }));
    assert.ok(rejected(r) && nonJudgeRejected(r), `${agent}: ${text(r)}`);
    assert.doesNotMatch(text(r), /REVIEWER_COMPLETED_TASKS_REJECTED|NON_QA_COMPLETED_TASKS_REJECTED/);
    assert.equal(handoffBytes(ws), before, "no state written");
  }
});

// ---------------------------------------------------------------- AC16

test("AC16 (E435): a v15 handoff migrates to schema 17: no chain_path / sr_return_count seeded, qa_round / qa_rounds_total dropped; versions pinned", async () => {
  assert.equal(CURRENT_VERSIONS.handoff, 17);
  assert.equal(CURRENT_VERSIONS.sqlite, 2);
  const ws = mkWs("e431-ac16-");
  const p = resolveCurrentLanePaths(ws).handoffPath;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    [
      "---", "schema_version: 15", `active_feature: "${F}"`, 'status: "In_Progress"',
      'last_updated: "2026-01-01T00:00:00.123Z"', 'last_agent: "pm"',
      "qa_round: 0", "review_round: 0", "visual_round: 0", "hop_count: 1",
      "qa_rounds_total: 0", "review_rounds_total: 0", "visual_rounds_total: 0", "---",
      "# Handoff State", "", "## Completed", "- (none)", "", "## Pending & Handoff Notes", "- (none)", "",
    ].join("\n"),
  );
  setActiveStorage(new FileHandoffStorage());
  const s = state(ws);
  assert.equal(s.chain_path, undefined);
  assert.equal(s.sr_return_count, undefined);
  assert.equal(s.qa_round, undefined, "qa_round dropped on read");
  assert.equal(s.qa_rounds_total, undefined, "qa_rounds_total dropped on read");
  assert.equal(s.active_feature, F);
  // The next real write persists the migrated stamp, unmarked, with the dropped counters gone.
  const r = await upd(ws, w("pm", "In_Progress"));
  assert.ok(!rejected(r), text(r));
  const raw = fs.readFileSync(p, "utf-8");
  assert.match(raw, /^schema_version: 17$/m);
  assert.doesNotMatch(raw, /^chain_path:/m);
  assert.doesNotMatch(raw, /^sr_return_count:/m);
  assert.doesNotMatch(raw, /^qa_rounds?(_total)?:/m);
});

// ---------------------------------------------------------------- AC17

test("AC17 (E435): registry has 33 entries incl. SR_RETURN_CAP_EXCEEDED (shape pinned) and NON_JUDGE_COMPLETED_TASKS_REJECTED, the three removed codes gone; pipeline 17 steps, step 9 renamed; HOP_CAP 14; comment fixed", () => {
  assert.equal(GATE_REGISTRY.length, 33);
  const codes = GATE_REGISTRY.map((g) => g.errorCode);
  for (const gone of ["QA_ROUND_EXCEEDED", "REVIEWER_COMPLETED_TASKS_REJECTED", "NON_QA_COMPLETED_TASKS_REJECTED"]) {
    assert.ok(!codes.includes(gone), `${gone} removed`);
  }
  const nj = GATE_REGISTRY.find((g) => g.errorCode === "NON_JUDGE_COMPLETED_TASKS_REJECTED");
  assert.ok(nj, "NON_JUDGE_COMPLETED_TASKS_REJECTED registered");
  assert.equal(nj.producer, "orchestrator");
  assert.equal(nj.envelope, "plain-text");
  assert.equal(nj.documentedInProse, true);
  assert.equal(nj.hintStatic, NON_JUDGE_HINT);
  const e = GATE_REGISTRY.find((g) => g.errorCode === "SR_RETURN_CAP_EXCEEDED");
  assert.ok(e, "SR_RETURN_CAP_EXCEEDED registered");
  assert.equal(e.producer, "validateTransition");
  assert.equal(e.envelope, "transition-json");
  // E433 (D16) re-pin: the code is now quoted in the qa-engineer and sr-engineer SOPs.
  assert.equal(e.documentedInProse, true);
  const registrySrc = fs.readFileSync(path.join(ROOT, "gates", "registry.ts"), "utf-8");
  assert.match(registrySrc, /SR_RETURN_CAP_EXCEEDED {10}skill-qa-engineer\.md, skill-sr-engineer\.md/, "mapping-comment row names its quote sites");
  assert.doesNotMatch(registrySrc, /SR_RETURN_CAP_EXCEEDED {10}\(none\)/, "no (none) row for it any more");

  assert.deepEqual(
    UPDATE_STATE_GATE_PIPELINE.map((s) => s.name),
    [
      "TRANSITION_VALIDATION", "FEATURE_LEASE", "SCOPE_DECISION_REQUIRED", "CUT_APPROVAL_REQUIRED",
      "EXTERNAL_REFS_UNRESOLVED", "SOURCE_CREDIBILITY_UNVERIFIED", "REPRO_MANIFEST_MISSING",
      "REVIEW_VERDICT_STATUS_MISMATCH", "NON_JUDGE_COMPLETED_TASKS_REJECTED", "QA_REVIEW_RECORD",
      "QA_COMPLETION_EVIDENCE_MISSING", "PASS_TASKS_INCOMPLETE", "PASS_MISSING_EVIDENCE",
      "PASS_VISUAL_SUBGATES", "PASS_EXPECTED_RED_DIFF", "PASS_AC_EXECUTION_LOG", "MISSING_REVIEW_EVIDENCE",
    ],
  );
  assert.equal(HOP_CAP_EXPORTED, 14);

  const src = fs.readFileSync(path.join(ROOT, "tools", "transitions.ts"), "utf-8");
  const at = src.indexOf("const HOP_CAP = 14;");
  assert.ok(at > 0);
  const comment = src.slice(src.lastIndexOf("// v9 (d2-server-brake-accounting) — const-01 Limits", at), at).replace(/\n\/\/ ?/g, " ");
  assert.ok(comment.length > 0);
  assert.doesNotMatch(comment, /always\s+trip(s)?\s+first|round caps\s+always/i, "no longer claims the round caps always trip first");
  assert.match(comment, /independent brake/);
  assert.match(comment, /before\s+or\s+after any round cap/);
});

test("AC17 (E435): hop cap 14 outranks the sr-return cap, which applies with no marker", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_review_round: 0, prev_hop_count: 14, prev_sr_return_count: 2,
  });
  assert.equal(r?.error, "HOP_CAP_EXCEEDED");
  const below = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_review_round: 0, prev_hop_count: 13, prev_sr_return_count: 2,
  });
  assert.equal(below?.error, "SR_RETURN_CAP_EXCEEDED");
});

// ---------------------------------------------------------------- AC18

test("AC18 (E435): SQLite/HTTP mode runs the one chain: pm -> qa accepted without resume_of (a carried chain_path not persisted), code-reviewer PASS accepted", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("better-sqlite3 not installed");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e431-sq-"));
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  try {
    setActiveStorage(storage);
    const reseed = async (agent) => {
      await storage.writeState({
        workspacePath: dir, activeFeature: F, status: "In_Progress",
        completedTasks: [], pendingNotes: ["seed"], lastAgent: agent,
      });
      resetSession(dir);
      storage.readState(dir);
    };
    await reseed("pm");
    const r = await UPD.run({
      workspace_path: dir, completed_tasks: [], pending_notes: [],
      ...w("qa-engineer", "In_Progress", { chain_path: "test-first" }),
    });
    assert.ok(!rejected(r), `pm -> qa is an ordinary edge in SQLite too: ${text(r)}`);
    assert.equal(storage.readState(dir)?.last_agent, "qa-engineer");
    assert.equal(storage.readState(dir)?.chain_path, undefined, "marker not persisted");

    await reseed("code-reviewer");
    let p;
    try {
      p = await UPD.run({
        workspace_path: dir, completed_tasks: [], pending_notes: [],
        ...w("code-reviewer", "PASS", { chain_path: "test-first", review_verdict: "APPROVED", qa_review: "x", review_task_ids: ["T-1"] }),
      });
    } catch (err) {
      p = { isError: true, content: [{ type: "text", text: err.message }] };
    }
    assert.ok(!rejected(p), `code-reviewer is the judge in SQLite too: ${text(p)}`);
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch {}
  }
});

// ---------------------------------------------------------------- one table, doc mirror (blueprint OQ9; E435)

// E435 architecture "New ALLOWED_TRANSITIONS (22 keys)", frozen: the old marked effective table, entry for entry, in order.
const TABLE_22 = `
null:null = pm:In_Progress pm:Blocked researcher:In_Progress researcher:Blocked design-auditor:In_Progress design-auditor:Blocked
researcher:In_Progress = pm:In_Progress pm:Blocked researcher:Blocked design-auditor:In_Progress
researcher:Blocked = researcher:In_Progress pm:In_Progress
design-auditor:In_Progress = pm:In_Progress design-auditor:Blocked
design-auditor:Blocked = design-auditor:In_Progress pm:In_Progress
pm:In_Progress = architect:In_Progress researcher:In_Progress design-auditor:In_Progress pm:Blocked pm:In_Progress qa-engineer:In_Progress
pm:Blocked = pm:In_Progress pm:Blocked design-auditor:In_Progress
architect:In_Progress = architect:Blocked pm:In_Progress qa-engineer:In_Progress
architect:Blocked = pm:In_Progress architect:In_Progress
sr-engineer:In_Progress = code-reviewer:In_Progress sr-engineer:Blocked pm:In_Progress qa-engineer:In_Progress
sr-engineer:Blocked = sr-engineer:In_Progress pm:In_Progress design-auditor:In_Progress
code-reviewer:In_Progress = code-reviewer:FAIL code-reviewer:Blocked code-reviewer:PASS
code-reviewer:FAIL = sr-engineer:In_Progress pm:In_Progress qa-engineer:In_Progress
code-reviewer:Blocked = code-reviewer:In_Progress pm:In_Progress
code-reviewer:PASS = pm:In_Progress researcher:In_Progress release-engineer:In_Progress design-auditor:In_Progress
qa-engineer:In_Progress = qa-engineer:Blocked sr-engineer:In_Progress
qa-engineer:Blocked = sr-engineer:In_Progress qa-engineer:In_Progress pm:In_Progress
qa-engineer:FAIL = sr-engineer:In_Progress pm:In_Progress
qa-engineer:PASS = pm:In_Progress researcher:In_Progress release-engineer:In_Progress design-auditor:In_Progress
release-engineer:In_Progress = pm:In_Progress release-engineer:Blocked
release-engineer:Blocked = release-engineer:In_Progress pm:In_Progress qa-engineer:In_Progress
release-engineer:PASS = pm:In_Progress researcher:In_Progress`
  .trim().split("\n").map((l) => l.split(" = ")).map(([k, v]) => [k, v.split(" ")]);

function parseOverlayTable(md, heading) {
  const start = md.indexOf(heading);
  assert.ok(start >= 0, `heading present: ${heading}`);
  const rest = md.slice(start + heading.length);
  const end = rest.search(/\n##/);
  const body = end >= 0 ? rest.slice(0, end) : rest;
  const out = new Map();
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*([a-z-]+)\s*\|\s*([A-Za-z_]+)\s*\|\s*(\(.*\))\s*\|\s*$/);
    if (!m) continue;
    const successors = [...m[3].matchAll(/\(([a-z-]+), ([A-Za-z_]+)\)/g)].map((x) => ({ agent: x[1], status: x[2] }));
    out.set(`${m[1]}:${m[2]}`, successors);
  }
  return out;
}

test("OVERLAY (E435): one 22-key ALLOWED_TRANSITIONS equals the frozen contract table in order, and its doc mirror equals it; no TEST_FIRST_OVERLAY, no overlay tables", () => {
  // Why: the old matrix plus overlay collapsed into one table; a second table anywhere would let the paths drift apart again.
  assert.equal(TEST_FIRST_OVERLAY, undefined, "TEST_FIRST_OVERLAY no longer exported");
  const src = [...T.ALLOWED_TRANSITIONS.entries()].map(([k, v]) => [k, v.map((e) => `${e.agent}:${e.status}`)]);
  assert.equal(src.length, 22);
  assert.deepEqual(src, TABLE_22);
  const md = fs.readFileSync(path.join(ROOT, "specs", "qa-flow-enforcement-architecture.md"), "utf-8");
  const doc = [...parseOverlayTable(md, "## ALLOWED_TRANSITIONS Matrix").entries()]
    .map(([k, v]) => [k, v.map((e) => `${e.agent}:${e.status}`).sort()]);
  assert.deepEqual(new Map(doc), new Map(TABLE_22.map(([k, v]) => [k, [...v].sort()])), "doc matrix mirrors the one table");
  assert.ok(!md.includes("### Opened on a test-first feature") && !md.includes("### Closed on a test-first feature"), "overlay tables gone");
});

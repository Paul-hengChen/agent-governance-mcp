// Coded by @qa-engineer
// Scenario tests for specs/e431-test-first-server-path.md (AC1-AC18; AC19/AC20 have their own proofs).
// Invariant: a feature runs the test-first chain (pm -> (architect) -> qa-engineer -> sr-engineer ->
// code-reviewer, who judges and writes PASS) only when its persisted handoff carries chain_path: "test-first";
// every unmarked feature keeps the old chain byte-for-byte. Tests drive the real tool entries
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
import {
  validateTransition,
  TEST_FIRST_OVERLAY,
  HOP_CAP_EXPORTED,
  SR_RETURN_CAP_EXPORTED,
} from "../dist/tools/transitions.js";
import { GATE_REGISTRY } from "../dist/gates/registry.js";
import { UPDATE_STATE_GATE_PIPELINE } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

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

// ---------------------------------------------------------------- helpers

function mkWs(prefix = "e431-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");

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

// The JSON envelope of a transition-json rejection, when the text carries one.
function envelope(r) {
  const t = text(r);
  const i = t.indexOf("{");
  assert.ok(i >= 0, `expected a JSON envelope in: ${t}`);
  return JSON.parse(t.slice(i));
}

const F = "e431-feat";
const w = (agent, status, extra = {}) => ({ active_feature: F, status, agent_id: agent, ...extra });

// ---------------------------------------------------------------- AC1

test("AC1: marked pm -> qa-engineer (no resume_of) then qa-engineer -> sr-engineer both accepted, marker persisted", async () => {
  const ws = mkWs("e431-ac1-");
  await seed(ws, F, "pm", "In_Progress");
  const r1 = await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(!rejected(r1), `pm -> qa with the marker on the entry write must be accepted: ${text(r1)}`);
  assert.equal(state(ws).chain_path, "test-first");
  const r2 = await upd(ws, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(r2), `qa -> sr must be accepted on a marked feature: ${text(r2)}`);
  assert.equal(state(ws).chain_path, "test-first", "the marker is carried across a write that omits it");
});

// ---------------------------------------------------------------- AC2

test("AC2: marked architect -> qa accepted; pm/architect -> sr-engineer rejected TRANSITION_REJECTED", async () => {
  const ws = mkWs("e431-ac2-");
  await seed(ws, F, "architect", "In_Progress", { chainPath: "test-first" });
  const ok = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(ok), `architect -> qa accepted: ${text(ok)}`);

  for (const from of ["architect", "pm"]) {
    const ws2 = mkWs("e431-ac2b-");
    await seed(ws2, F, from, "In_Progress", { chainPath: "test-first" });
    const before = handoffBytes(ws2);
    const r = await upd(ws2, w("sr-engineer", "In_Progress"));
    assert.ok(rejected(r), `${from} -> sr must be closed on a marked feature`);
    assert.match(text(r), /TRANSITION_REJECTED/);
    assert.equal(handoffBytes(ws2), before, "a rejected write leaves state untouched");
  }
});

// ---------------------------------------------------------------- AC3

test("AC3: marked code-reviewer PASS passes the tool boundary and transition check (unmarked does not)", () => {
  // The tool boundary (zod, run via UPD.run in the next test) no longer refuses a code-reviewer PASS; the transition layer decides.
  const marked = validateTransition({
    prev: { agent: "code-reviewer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "PASS" },
    prev_qa_round: 0, prev_review_round: 0, prev_chain_path: "test-first",
  });
  assert.equal(marked, null, "no TRANSITION_REJECTED for the marked judge PASS");
  const unmarked = validateTransition({
    prev: { agent: "code-reviewer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "PASS" },
    prev_qa_round: 0, prev_review_round: 0,
  });
  assert.equal(unmarked?.error, "TRANSITION_REJECTED");
});

test("AC3: ledger completed by code-reviewer via tw_complete_task, completed_tasks [] -> PASS accepted, last_agent code-reviewer", async () => {
  const ws = mkWs("e431-ac3-");
  await seed(ws, F, "code-reviewer", "In_Progress", { chainPath: "test-first" });
  resetSession(ws); markStateRead(ws);
  await ADD.run({ workspace_path: ws, task_id: "T-1", description: "one" });
  const c = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.match(text(c), /"success":true/);
  const r = await upd(ws, w("code-reviewer", "PASS", { qa_review: "judged", review_task_ids: ["T-1"] }));
  assert.ok(!rejected(r), `marked code-reviewer PASS accepted: ${text(r)}`);
  const s = state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.last_agent, "code-reviewer");
});

// ---------------------------------------------------------------- AC4

test("AC4: qa-engineer PASS on a marked feature is rejected, no state written (from qa and from code-reviewer)", async () => {
  for (const from of ["qa-engineer", "code-reviewer"]) {
    const ws = mkWs("e431-ac4-");
    await seed(ws, F, from, "In_Progress", { chainPath: "test-first" });
    const before = handoffBytes(ws);
    const r = await upd(ws, w("qa-engineer", "PASS", { qa_review: "x", review_task_ids: ["T-1"], completed_tasks: ["T-1"] }));
    assert.ok(rejected(r), `qa PASS from ${from}:In_Progress must be rejected on a marked feature`);
    assert.equal(handoffBytes(ws), before, "no state written");
  }
});

// ---------------------------------------------------------------- AC5

test("AC5: after code-reviewer FAIL -> qa, qa straight back to code-reviewer is rejected; qa -> sr -> code-reviewer accepted", async () => {
  const ws = mkWs("e431-ac5-");
  await seed(ws, F, "code-reviewer", "In_Progress", { chainPath: "test-first" });
  const f = await upd(ws, w("code-reviewer", "FAIL", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "scenario gap" }));
  assert.ok(!rejected(f), `code-reviewer FAIL accepted: ${text(f)}`);
  assert.equal(state(ws).review_round, 1);
  const q = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(q), `code-reviewer FAIL -> qa accepted: ${text(q)}`);

  const ws2 = mkWs("e431-ac5b-");
  await seed(ws2, F, "qa-engineer", "In_Progress", { chainPath: "test-first", reviewRound: 1 });
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
  await seed(ws, F, "sr-engineer", "In_Progress", { chainPath: "test-first" });
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
  await seed(ws2, F, "sr-engineer", "In_Progress", { chainPath: "test-first", srReturnCount: 2 });
  const other = await upd(ws2, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(other), `sr -> code-reviewer not blocked by the cap: ${text(other)}`);
});

// ---------------------------------------------------------------- AC7

test("AC7: code-reviewer rejections to qa and to sr together reach review_round 4; next non-pm write REVIEW_ROUND_EXCEEDED", async () => {
  const ws = mkWs("e431-ac7-");
  await seed(ws, F, "code-reviewer", "In_Progress", { chainPath: "test-first" });
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

test("AC8: marked pm -> qa without cut_approved rejected CUT_APPROVAL_REQUIRED; resume_of on a marked feature does not exempt (OQ1 = a)", async () => {
  const ws = mkWs("e431-ac8a-");
  await seed(ws, F, "pm", "In_Progress", { cutApproved: false });
  const r = await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(rejected(r));
  assert.match(text(r), /CUT_APPROVAL_REQUIRED/);

  const ws2 = mkWs("e431-ac8b-");
  await seed(ws2, F, "pm", "In_Progress", { cutApproved: false, chainPath: "test-first" });
  const r2 = await upd(ws2, w("qa-engineer", "In_Progress", { resume_of: "qa-engineer" }));
  assert.ok(rejected(r2), "OQ1 = a: resume_of does not exempt pm -> qa from the build-entry checks on a marked feature");
  assert.match(text(r2), /CUT_APPROVAL_REQUIRED/);
});

test("AC8: marked pm -> qa rejected EXTERNAL_REFS_UNRESOLVED with an unresolved external ref", async () => {
  const ws = mkWs("e431-ac8c-");
  await seed(ws, F, "pm", "In_Progress", { externalRefs: [{ ref: "https://example.invalid/spec", state: "unresolved" }] });
  const r = await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(rejected(r));
  assert.match(text(r), /EXTERNAL_REFS_UNRESOLVED/);
});

function writeDesign(ws, body) {
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(path.join(ws, "design", `${F}.md`), body, "utf-8");
}

test("AC8: marked pm -> qa rejected SCOPE_DECISION_REQUIRED with an armed design and no scope decision", async () => {
  const ws = mkWs("e431-ac8d-");
  writeDesign(ws, "# design\n\nmode: figma\n\n## Layout / Canvas\n\nx\n");
  await seed(ws, F, "pm", "In_Progress");
  const r = await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }));
  assert.ok(rejected(r));
  assert.match(text(r), /SCOPE_DECISION_REQUIRED/);
});

test("AC8: marked pm -> qa rejected SOURCE_CREDIBILITY_UNVERIFIED with an un-attested fetch-based design", async () => {
  const ws = mkWs("e431-ac8e-");
  writeDesign(
    ws,
    "# design\n\nmode: figma\n\n## Source\n\n" +
      "| medium | pointer | fetched | status | credibility | reason |\n" +
      "|--------|---------|---------|--------|-------------|--------|\n" +
      "| figma | node 1:2 | yes | audited |  | — |\n",
  );
  await seed(ws, F, "pm", "In_Progress", { scopeDecision: "single-feature" });
  const r = await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first", scope_decision: "single-feature" }));
  assert.ok(rejected(r));
  assert.match(text(r), /SOURCE_CREDIBILITY_UNVERIFIED/);
});

test("AC8: unmarked unapproved pm -> qa with resume_of qa-engineer stays accepted (the hand-back stays exempt)", async () => {
  const ws = mkWs("e431-ac8f-");
  await seed(ws, F, "pm", "In_Progress", { cutApproved: false });
  const r = await upd(ws, w("qa-engineer", "In_Progress", { resume_of: "qa-engineer" }));
  assert.ok(!rejected(r), `unmarked resume stays exempt: ${text(r)}`);
  assert.equal(state(ws).chain_path, undefined);
});

// ---------------------------------------------------------------- AC9

test("AC9: unmarked pm -> qa with neither marker nor resume_of rejected, hint names both forms; resume_of alone accepted", async () => {
  const ws = mkWs("e431-ac9-");
  await seed(ws, F, "pm", "In_Progress");
  const r = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(rejected(r));
  assert.match(text(r), /TRANSITION_REJECTED/);
  const hint = envelope(r).hint;
  assert.ok(hint.includes('resume_of: "qa-engineer"'), "hint names the Amend-Resume form");
  assert.ok(hint.includes('chain_path: "test-first"'), "hint names the test-first form");
  assert.ok(
    hint.includes(' Test-first entry: set chain_path: "test-first" on the entry write instead (needs an approved cut; no resume_of).'),
    "Copy hint.pm_to_qa verbatim",
  );
  const ok = await upd(ws, w("qa-engineer", "In_Progress", { resume_of: "qa-engineer" }));
  assert.ok(!rejected(ok), `resume_of alone accepted as today: ${text(ok)}`);
});

test("AC9: on a marked feature a later pm -> qa write needs no resume_of", async () => {
  const ws = mkWs("e431-ac9b-");
  await seed(ws, F, "pm", "In_Progress", { chainPath: "test-first" });
  const r = await upd(ws, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(r), `marked pm -> qa without resume_of: ${text(r)}`);
});

// ---------------------------------------------------------------- AC10

test("AC10: marker survives omitting writes and is dropped on active_feature change", async () => {
  const ws = mkWs("e431-ac10-");
  await seed(ws, F, "pm", "In_Progress");
  assert.ok(!rejected(await upd(ws, w("qa-engineer", "In_Progress", { chain_path: "test-first" }))));
  assert.ok(!rejected(await upd(ws, w("qa-engineer", "In_Progress", { pending_notes: ["still here"] }))));
  assert.equal(state(ws).chain_path, "test-first", "omitting writes cannot clear the marker");
  assert.ok(!rejected(await upd(ws, w("sr-engineer", "In_Progress"))));
  assert.equal(state(ws).chain_path, "test-first");

  const ws2 = mkWs("e431-ac10b-");
  await seed(ws2, F, "pm", "In_Progress", { chainPath: "test-first" });
  const next = await upd(ws2, { active_feature: "e431-next", status: "In_Progress", agent_id: "pm" });
  assert.ok(!rejected(next), `new feature opened: ${text(next)}`);
  assert.equal(state(ws2).active_feature, "e431-next");
  assert.equal(state(ws2).chain_path, undefined, "the new feature starts unmarked");
});

test("AC10: marker carried mid-old-path is rejected TRANSITION_REJECTED, no state written", async () => {
  for (const [agent, next] of [["sr-engineer", "code-reviewer"], ["code-reviewer", "qa-engineer"]]) {
    const ws = mkWs("e431-ac10c-");
    await seed(ws, F, agent, "In_Progress");
    const before = handoffBytes(ws);
    const r = await upd(ws, w(next, "In_Progress", { chain_path: "test-first" }));
    assert.ok(rejected(r), `${agent} -> ${next} carrying the marker mid-old-path must be rejected`);
    assert.match(text(r), /TRANSITION_REJECTED/);
    assert.equal(handoffBytes(ws), before);
  }
});

// ---------------------------------------------------------------- AC11

test("AC11: marked code-reviewer:PASS exits to pm, researcher, release-engineer and design-auditor", async () => {
  for (const next of ["pm", "researcher", "release-engineer", "design-auditor"]) {
    const ws = mkWs("e431-ac11-");
    await seed(ws, F, "code-reviewer", "PASS", { chainPath: "test-first" });
    const r = await upd(ws, w(next, "In_Progress"));
    assert.ok(!rejected(r), `code-reviewer:PASS -> ${next} accepted: ${text(r)}`);
  }
});

test("AC11: unmarked code-reviewer PASS rejected as today", async () => {
  const ws = mkWs("e431-ac11b-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  const before = handoffBytes(ws);
  const r = await upd(ws, w("code-reviewer", "PASS", { qa_review: "x", review_task_ids: ["T-1"] }));
  assert.ok(rejected(r));
  assert.match(text(r), /qa-engineer/);
  assert.equal(handoffBytes(ws), before);
});

// Feature change: the next step after a PASS almost always opens a different
// active_feature (next ticket, release feature). The exit is judged against the
// PREVIOUS feature's marker; the new feature itself starts unmarked.
const EXIT_ROLES = ["pm", "researcher", "release-engineer", "design-auditor"];

test("AC11: validateTransition accepts all four exits from marked code-reviewer:PASS on a feature change", () => {
  for (const next of EXIT_ROLES) {
    const r = validateTransition({
      prev: { agent: "code-reviewer", status: "PASS" },
      next: { agent: next, status: "In_Progress" },
      prev_qa_round: 0, prev_review_round: 0, prev_chain_path: "test-first", feature_changed: true,
    });
    assert.equal(r, null, `code-reviewer:PASS -> ${next} on a feature change accepted`);
  }
});

for (const next of EXIT_ROLES) {
  test(`AC11: feature change from marked code-reviewer:PASS accepted via handler for ${next}, new feature unmarked`, async () => {
    const ws = mkWs("e431-ac11fc-");
    await seed(ws, F, "code-reviewer", "PASS", { chainPath: "test-first" });
    const r = await upd(ws, { active_feature: "e431-next-feat", status: "In_Progress", agent_id: next });
    assert.ok(!rejected(r), `${next} opening a new feature from marked code-reviewer:PASS accepted: ${text(r)}`);
    const s = state(ws);
    assert.equal(s.active_feature, "e431-next-feat");
    assert.equal(s.chain_path, undefined, "new feature starts unmarked");
    assert.ok(!s.sr_return_count, "new feature carries no sr_return_count");
  });
}

test("AC11: feature-change write out of marked code-reviewer:PASS that carries chain_path ignores the old marker (pm marks the new feature; other roles rejected)", async () => {
  // Why: the previous marker only opens the exits for a write that carries no chain_path;
  // a carrying write is judged by the set-point rule alone, so the old marker cannot
  // launder a non-pm role into marking a new feature.
  const ws = mkWs("e431-ac11cp-");
  await seed(ws, F, "code-reviewer", "PASS", { chainPath: "test-first" });
  const ok = await upd(ws, { active_feature: "e431-next-cp", status: "In_Progress", agent_id: "pm", chain_path: "test-first" });
  assert.ok(!rejected(ok), `pm opening a new feature with chain_path accepted: ${text(ok)}`);
  assert.equal(state(ws).active_feature, "e431-next-cp");
  assert.equal(state(ws).chain_path, "test-first", "the new feature is marked by its own pm write");

  for (const role of ["researcher", "release-engineer", "design-auditor"]) {
    const ws2 = mkWs("e431-ac11cp2-");
    await seed(ws2, F, "code-reviewer", "PASS", { chainPath: "test-first" });
    const before = handoffBytes(ws2);
    const r = await upd(ws2, { active_feature: "e431-next-cp", status: "In_Progress", agent_id: role, chain_path: "test-first" });
    assert.ok(rejected(r), `${role} carrying chain_path on a feature change must be rejected`);
    assert.match(text(r), /TRANSITION_REJECTED/);
    assert.equal(handoffBytes(ws2), before);
  }
});

// ---------------------------------------------------------------- AC12

const NOTHING_NEW = (s) => {
  assert.equal(s.chain_path, undefined, "old path carries no chain_path");
  assert.ok(!s.sr_return_count, "old path carries no sr_return_count");
};

test("AC12: old chain pm -> sr -> code-reviewer -> qa -> PASS unchanged (counters, no new fields)", async () => {
  const ws = mkWs("e431-ac12a-");
  await seed(ws, F, "pm", "In_Progress");
  for (const agent of ["sr-engineer", "code-reviewer", "qa-engineer"]) {
    const r = await upd(ws, w(agent, "In_Progress"));
    assert.ok(!rejected(r), `${agent}: ${text(r)}`);
  }
  assert.equal(state(ws).hop_count, 3);
  const pass = await upd(ws, w("qa-engineer", "PASS", { completed_tasks: ["T-1"], review_task_ids: ["T-1"], qa_review: "ok" }));
  assert.ok(!rejected(pass), `qa PASS accepted on the old path: ${text(pass)}`);
  const s = state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.qa_round, 0);
  assert.equal(s.review_round, 0);
  assert.equal(s.visual_round, 0);
  NOTHING_NEW(s);
  // The judge hand-offs stay closed here: code-reviewer -> qa is the old edge, code-reviewer PASS is not.
  const ws2 = mkWs("e431-ac12a2-");
  await seed(ws2, F, "code-reviewer", "In_Progress");
  const old = await upd(ws2, w("qa-engineer", "In_Progress"));
  assert.ok(!rejected(old), "code-reviewer -> qa is the old-path edge");
});

test("AC12: pm -> architect -> sr variant and the qa FAIL -> sr loop keep their counters", async () => {
  const ws = mkWs("e431-ac12b-");
  await seed(ws, F, "pm", "In_Progress");
  for (const agent of ["architect", "sr-engineer", "code-reviewer", "qa-engineer"]) {
    const r = await upd(ws, w(agent, "In_Progress"));
    assert.ok(!rejected(r), `${agent}: ${text(r)}`);
  }
  assert.equal(state(ws).hop_count, 4);
  const fail = await upd(ws, w("qa-engineer", "FAIL", { blocking_reason: "bug", review_task_ids: ["T-1"], qa_review: "found a bug" }));
  assert.ok(!rejected(fail), `qa FAIL: ${text(fail)}`);
  assert.equal(state(ws).qa_round, 1);
  const back = await upd(ws, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(back), `FAIL -> sr: ${text(back)}`);
  assert.equal(state(ws).qa_round, 1);
  assert.equal(state(ws).review_round, 0);
  NOTHING_NEW(state(ws));
});

test("AC12: bugfix-mode run and the Amend-Resume hand-back behave as before", async () => {
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

test("AC12: every new edge stays closed on an unmarked feature", () => {
  const base = { prev_qa_round: 0, prev_review_round: 0 };
  const closed = [
    [["architect", "In_Progress"], ["qa-engineer", "In_Progress"]],
    [["qa-engineer", "In_Progress"], ["sr-engineer", "In_Progress"]],
    [["sr-engineer", "In_Progress"], ["qa-engineer", "In_Progress"]],
    [["code-reviewer", "In_Progress"], ["code-reviewer", "PASS"]],
    [["code-reviewer", "FAIL"], ["qa-engineer", "In_Progress"]],
    [["code-reviewer", "PASS"], ["pm", "In_Progress"]],
  ];
  for (const [[pa, ps], [na, ns]] of closed) {
    const r = validateTransition({ ...base, prev: { agent: pa, status: ps }, next: { agent: na, status: ns } });
    assert.equal(r?.error, "TRANSITION_REJECTED", `${pa}:${ps} -> ${na}:${ns} must stay closed unmarked`);
  }
});

// ---------------------------------------------------------------- AC13

test("AC13: marked bugfix sr -> code-reviewer needs the repro manifest; later code-reviewer PASS passes the transition check", async () => {
  const ws = mkWs("e431-ac13-");
  await seed(ws, F, "sr-engineer", "In_Progress", { chainPath: "test-first", dispatchMode: "bugfix" });
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
      prev_qa_round: 0, prev_review_round: 0, prev_chain_path: "test-first",
    }),
    null,
  );
});

// ---------------------------------------------------------------- AC14

async function ledgerWs(chainPath) {
  const ws = mkWs("e431-ac14-");
  await seed(ws, F, "code-reviewer", "In_Progress", chainPath ? { chainPath } : {});
  resetSession(ws); markStateRead(ws);
  await ADD.run({ workspace_path: ws, task_id: "T-1", description: "one" });
  return ws;
}

test("AC14: marked feature: code-reviewer completes the task, qa-engineer rejected naming code-reviewer (Copy verbatim)", async () => {
  const ws = await ledgerWs("test-first");
  const qa = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "qa-engineer" });
  assert.equal(
    text(qa),
    '⛔ BLOCKED: tw_complete_task is reserved for code-reviewer on a test-first feature (chain_path: test-first). Called by "qa-engineer". Hand off to code-reviewer and pass agent_id="code-reviewer".',
  );
  const cr = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.match(text(cr), /"marked":"completed"/);
});

test("AC14: unmarked feature: qa-engineer completes, code-reviewer rejected with today's text", async () => {
  const ws = await ledgerWs(null);
  const cr = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "code-reviewer" });
  assert.equal(
    text(cr),
    '⛔ BLOCKED: tw_complete_task is reserved for qa-engineer. Called by "code-reviewer". Hand off to qa-engineer and pass agent_id="qa-engineer".',
  );
  const qa = await COMPLETE.run({ workspace_path: ws, task_id: "T-1", agent_id: "qa-engineer" });
  assert.match(text(qa), /"marked":"completed"/);
});

// ---------------------------------------------------------------- AC15

test("AC15: marked write path: code-reviewer completed_tasks allowed, qa-engineer's rejected, APPROVED PASS ok, FAIL removes ids", async () => {
  const ws = mkWs("e431-ac15a-");
  await seed(ws, F, "code-reviewer", "In_Progress", { chainPath: "test-first" });
  const cr = await upd(ws, w("code-reviewer", "FAIL", { completed_tasks: ["T-1"], blocking_reason: "x", review_verdict: "CHANGES_REQUESTED" }));
  assert.ok(!text(cr).includes("REVIEWER_COMPLETED_TASKS_REJECTED"), `got: ${text(cr)}`);

  const ws2 = mkWs("e431-ac15b-");
  await seed(ws2, F, "qa-engineer", "In_Progress", { chainPath: "test-first" });
  const qa = await upd(ws2, w("qa-engineer", "In_Progress", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(qa));
  assert.match(text(qa), /NON_QA_COMPLETED_TASKS_REJECTED/);
  assert.match(text(qa), /code-reviewer/);

  const ws3 = mkWs("e431-ac15c-");
  await seed(ws3, F, "code-reviewer", "In_Progress", { chainPath: "test-first" });
  const pass = await upd(ws3, w("code-reviewer", "PASS", { review_verdict: "APPROVED", qa_review: "ok", review_task_ids: ["T-9"] }));
  assert.ok(!text(pass).includes("REVIEW_VERDICT_STATUS_MISMATCH"), `got: ${text(pass)}`);

  const ws4 = mkWs("e431-ac15d-");
  await seed(ws4, F, "code-reviewer", "In_Progress", { chainPath: "test-first", completedTasks: ["T-1", "T-2"] });
  const fail = await upd(ws4, w("code-reviewer", "FAIL", { review_task_ids: ["T-1"], blocking_reason: "redo", review_verdict: "CHANGES_REQUESTED" }));
  assert.ok(!rejected(fail), `FAIL: ${text(fail)}`);
  const done = state(ws4).completed_tasks.join("|");
  assert.ok(!done.includes("T-1") && done.includes("T-2"), `T-1 removed, T-2 kept; got ${done}`);
});

test("AC15: unmarked write path behaves as today for each of the four", async () => {
  const ws = mkWs("e431-ac15e-");
  await seed(ws, F, "code-reviewer", "In_Progress");
  const cr = await upd(ws, w("code-reviewer", "FAIL", { completed_tasks: ["T-1"], blocking_reason: "x", review_verdict: "CHANGES_REQUESTED" }));
  assert.match(text(cr), /REVIEWER_COMPLETED_TASKS_REJECTED/);

  const ws2 = mkWs("e431-ac15f-");
  await seed(ws2, F, "qa-engineer", "In_Progress");
  const qa = await upd(ws2, w("qa-engineer", "In_Progress", { completed_tasks: ["T-1"] }));
  assert.ok(!text(qa).includes("NON_QA_COMPLETED_TASKS_REJECTED"), "qa is not role-rejected on the old path");
  assert.match(text(qa), /QA_COMPLETION_EVIDENCE_MISSING/, "today: only the per-id evidence check applies");

  const ws3 = mkWs("e431-ac15g-");
  await seed(ws3, F, "code-reviewer", "In_Progress");
  const pass = await upd(ws3, w("code-reviewer", "PASS", { review_verdict: "APPROVED", qa_review: "ok", review_task_ids: ["T-9"] }));
  assert.ok(rejected(pass), "code-reviewer PASS stays rejected unmarked");
  assert.match(text(pass), /qa-engineer/);

  const ws4 = mkWs("e431-ac15h-");
  await seed(ws4, F, "code-reviewer", "In_Progress", { completedTasks: ["T-1", "T-2"] });
  const fail = await upd(ws4, w("code-reviewer", "FAIL", { review_task_ids: ["T-1"], blocking_reason: "redo", review_verdict: "CHANGES_REQUESTED" }));
  assert.ok(!rejected(fail), `FAIL: ${text(fail)}`);
  assert.ok(state(ws4).completed_tasks.join("|").includes("T-1"), "no ledger removal for a code-reviewer FAIL unmarked");
});

// ---------------------------------------------------------------- AC16

test("AC16: v15 handoff migrates to schema 16 with no chain_path / sr_return_count seeded; versions pinned", async () => {
  assert.equal(CURRENT_VERSIONS.handoff, 16);
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
  assert.equal(s.active_feature, F);
  // The next real write persists the migrated stamp; the old path stays unmarked and uncounted.
  const r = await upd(ws, w("pm", "In_Progress"));
  assert.ok(!rejected(r), text(r));
  const raw = fs.readFileSync(p, "utf-8");
  assert.match(raw, /^schema_version: 16$/m);
  assert.doesNotMatch(raw, /^chain_path:/m);
  assert.doesNotMatch(raw, /^sr_return_count:/m);
});

// ---------------------------------------------------------------- AC17

test("AC17: registry has 35 entries incl. SR_RETURN_CAP_EXCEEDED (shape pinned); pipeline 17 steps; HOP_CAP 14; comment fixed", () => {
  assert.equal(GATE_REGISTRY.length, 35);
  const e = GATE_REGISTRY.find((g) => g.errorCode === "SR_RETURN_CAP_EXCEEDED");
  assert.ok(e, "SR_RETURN_CAP_EXCEEDED registered");
  assert.equal(e.producer, "validateTransition");
  assert.equal(e.envelope, "transition-json");
  assert.equal(e.documentedInProse, false);
  const registrySrc = fs.readFileSync(path.join(ROOT, "gates", "registry.ts"), "utf-8");
  assert.match(registrySrc, /SR_RETURN_CAP_EXCEEDED {10}\(none\)/, "mapping-comment row is (none)");

  assert.deepEqual(
    UPDATE_STATE_GATE_PIPELINE.map((s) => s.name),
    [
      "TRANSITION_VALIDATION", "FEATURE_LEASE", "SCOPE_DECISION_REQUIRED", "CUT_APPROVAL_REQUIRED",
      "EXTERNAL_REFS_UNRESOLVED", "SOURCE_CREDIBILITY_UNVERIFIED", "REPRO_MANIFEST_MISSING",
      "REVIEW_VERDICT_STATUS_MISMATCH", "REVIEWER_COMPLETED_TASKS_REJECTED", "QA_REVIEW_RECORD",
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

test("AC17: hop cap 14 outranks the sr-return cap on a marked feature", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0, prev_review_round: 0, prev_hop_count: 14,
    prev_chain_path: "test-first", prev_sr_return_count: 2,
  });
  assert.equal(r?.error, "HOP_CAP_EXCEEDED");
  const below = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0, prev_review_round: 0, prev_hop_count: 13,
    prev_chain_path: "test-first", prev_sr_return_count: 2,
  });
  assert.equal(below?.error, "SR_RETURN_CAP_EXCEEDED");
});

// ---------------------------------------------------------------- AC18

test("AC18: SQLite/HTTP mode ignores chain_path: pm -> qa without resume_of and code-reviewer PASS rejected as today", async (t) => {
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
    assert.ok(rejected(r), "marker ignored: pm -> qa without resume_of rejected");
    assert.match(text(r), /TRANSITION_REJECTED/);
    assert.equal(storage.readState(dir)?.chain_path, undefined, "marker not persisted");

    await reseed("code-reviewer");
    let p;
    try {
      p = await UPD.run({
        workspace_path: dir, completed_tasks: [], pending_notes: [],
        ...w("code-reviewer", "PASS", { chain_path: "test-first", qa_review: "x", review_task_ids: ["T-1"] }),
      });
    } catch (err) {
      p = { isError: true, content: [{ type: "text", text: err.message }] };
    }
    assert.ok(rejected(p), "code-reviewer PASS rejected as today");
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch {}
  }
});

// ---------------------------------------------------------------- overlay doc mirror (blueprint OQ9)

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

test("OVERLAY: the qa-flow-enforcement-architecture tables equal the exported TEST_FIRST_OVERLAY", () => {
  const md = fs.readFileSync(path.join(ROOT, "specs", "qa-flow-enforcement-architecture.md"), "utf-8");
  const opens = parseOverlayTable(md, "### Opened on a test-first feature");
  const closes = parseOverlayTable(md, "### Closed on a test-first feature");
  assert.deepEqual([...opens.entries()], [...TEST_FIRST_OVERLAY.opens.entries()]);
  assert.deepEqual([...closes.entries()], [...TEST_FIRST_OVERLAY.closes.entries()]);
});

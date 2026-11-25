// Coded by @qa-engineer
// Behavioural tests for the sr_return counter paths (feature-change reset, feature-change cap bypass, the
// schema 16 -> 17 read heal, the next_role lookahead annotation) and the SQLite RAG chunk cleanup on the
// judge's PASS. WHY: each path stayed green in the suite when broken in a scratch copy, so a regression
// could merge unseen. Every test drives the real tool entry (tw_update_state .run, zod + orchestrator) or
// the tw_get_state read path on a temp workspace; none reads server source text. Titles start with the AC
// id of specs/e461-mutation-test-gaps.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { readHandoffState } from "../dist/tools/handoff-parse.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { forceSeedStamp, forceSeedStampIfExists, SAFE_SEED_STAMP } from "./e148-seed-stamp.mjs";

// Without the native binding the SQLite case skips with a visible reason, never a silent pass.
const SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js").catch(() => ({}))).SqliteHandoffStorage;

const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const A = "e461-feat-a";
const B = "e461-feat-b";
const NEW_FEATURE_ONLY = "qa-engineer:In_Progress (only legal if the next write opens a new feature)";

const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔") || text(r).startsWith("❌");
const hpath = (ws) => resolveCurrentLanePaths(ws).handoffPath;
const state = (ws) => new FileHandoffStorage().parse(ws);

// A no-new-test record for both features, so the qa -> sr hand-off gate is never what a test observes.
function mkWs(prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  for (const f of [A, B]) fs.writeFileSync(path.join(ws, "qa_reports", `no-new-test_${f}.txt`), "no new test\n");
  return ws;
}

// Seed through the real writer, then pin last_updated to an old stamp so no feature lease is held.
async function seed(ws, agent, status, srReturnCount) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws, activeFeature: A, status, completedTasks: [], pendingNotes: ["seed"],
    lastAgent: agent, cutApproved: true, srReturnCount,
  });
  forceSeedStamp(ws);
}

// One client write: zod + orchestrator. A zod failure surfaces as the rejection a client sees.
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

// ---------------------------------------------------------------- sr_return counter

test("AC4: a return that opens a new feature restarts the sr_return count: 2 on feature A becomes 1 on feature B", async () => {
  // The count is per feature; carrying A's returns into B would spend B's cap before B had any return.
  const ws = mkWs("e461-ac4-");
  await seed(ws, "sr-engineer", "In_Progress", 2);
  assert.equal(state(ws).sr_return_count, 2, "seed carries two returns on A");
  const r = await upd(ws, { active_feature: B, status: "In_Progress", agent_id: "qa-engineer" });
  assert.ok(!rejected(r), `qa-engineer opening B accepted: ${text(r)}`);
  const s = state(ws);
  assert.equal(s.active_feature, B);
  assert.equal(s.sr_return_count, 1, "count restarts at 0 for B, then this return adds 1");
});

test("AC5: at the sr_return cap a return that opens a new feature is not rejected SR_RETURN_CAP_EXCEEDED", async () => {
  // The cap guards one feature's returns; a feature change must bypass it, or the lane could never move on.
  const ws = mkWs("e461-ac5-");
  await seed(ws, "sr-engineer", "In_Progress", 2);
  const r = await upd(ws, { active_feature: B, status: "In_Progress", agent_id: "qa-engineer" });
  assert.doesNotMatch(text(r), /SR_RETURN_CAP_EXCEEDED/, `feature change bypasses the cap: ${text(r)}`);
  assert.ok(!rejected(r), `the write is accepted: ${text(r)}`);
});

test("AC6: the schema 16 -> 17 read heal keeps sr_return_count on disk, so the cap still holds after the heal", async () => {
  // A heal that dropped the counter would silently reset the cap and let a third return through.
  const ws = mkWs("e461-ac6-");
  fs.mkdirSync(path.dirname(hpath(ws)), { recursive: true });
  fs.writeFileSync(hpath(ws), [
    "---", "schema_version: 16", `active_feature: "${A}"`, 'status: "In_Progress"',
    `last_updated: "${SAFE_SEED_STAMP}"`, 'last_agent: "sr-engineer"', "cut_approved: true",
    'scope_decision: "single-feature"', "sr_return_count: 2", "qa_round: 0", "review_round: 0", "visual_round: 0",
    "hop_count: 0", "qa_rounds_total: 0", "review_rounds_total: 0", "visual_rounds_total: 0", "---",
    "# Handoff State", "", "## Completed", "- (none)", "", "## Pending & Handoff Notes", "- seed", "", "---",
    "> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.", "",
  ].join("\n"));
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  JSON.parse(readHandoffState(ws));
  // The heal write is fire-and-forget: wait for the v17 file before reading it.
  let disk = "";
  for (let i = 0; i < 100; i++) {
    disk = fs.readFileSync(hpath(ws), "utf-8");
    if (/^schema_version: 17$/m.test(disk)) break;
    await new Promise((res) => setTimeout(res, 10));
  }
  assert.match(disk, /^schema_version: 17$/m, "heal write persisted v17");
  assert.match(disk, /^sr_return_count: 2$/m, "healed file still carries sr_return_count: 2");
  const third = await upd(ws, { active_feature: A, status: "In_Progress", agent_id: "qa-engineer" });
  assert.ok(rejected(third), `a third return on the same feature is rejected: ${text(third)}`);
  assert.match(text(third), /SR_RETURN_CAP_EXCEEDED/);
});

test("AC7: at sr_return_count 2 the next_role lookahead marks qa-engineer:In_Progress as legal only on a new feature; at 1 it does not", async () => {
  // The lookahead must see the live count: advertising the return as legal at the cap sends the chain into a rejection.
  const warningsAt = async (count) => {
    const ws = mkWs(`e461-ac7-${count}-`);
    await seed(ws, "sr-engineer", "In_Progress", count);
    const r = await upd(ws, { active_feature: A, status: "In_Progress", agent_id: "sr-engineer", next_role: "release-engineer" });
    assert.ok(!rejected(r), `next_role is advisory, the write is accepted: ${text(r)}`);
    const warnings = JSON.parse(text(r)).warnings ?? [];
    const lookahead = warnings.find((w) => w.startsWith('next_role="release-engineer"'));
    assert.ok(lookahead, `the lookahead warning fires: ${JSON.stringify(warnings)}`);
    return lookahead;
  };
  const atCap = await warningsAt(2);
  assert.ok(atCap.includes(NEW_FEATURE_ONLY), `at the cap the return is annotated: ${atCap}`);
  const belowCap = await warningsAt(1);
  assert.ok(/qa-engineer:In_Progress(?! \()/.test(belowCap), `below the cap the return is listed: ${belowCap}`);
  assert.ok(!belowCap.includes(NEW_FEATURE_ONLY), `below the cap it carries no new-feature annotation: ${belowCap}`);
});

// ---------------------------------------------------------------- SQLite RAG cleanup

function chunk(id) {
  return {
    chunk_id: id, section: "S", text: `body ${id}`, embedding: [0.1, 0.2, 0.3], prd_path: "/x/PRD.md",
    prd_mtime: 1, chunker_version: "1.0", embedding_model: "Xenova/all-MiniLM-L6-v2",
  };
}

test("AC8: in SQLite mode the judge's PASS drops the workspace's PRD chunks; a non-PASS write keeps them", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("better-sqlite3 not installed: the SQLite RAG cleanup case cannot run");
  // The next feature must not retrieve the finished feature's PRD; only the judge's PASS ends a feature.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e461-sq-"));
  const ws = path.join(dir, "ws");
  fs.mkdirSync(ws);
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  const run = async (args) => {
    await storage.writeState({ workspacePath: ws, activeFeature: A, status: "In_Progress", completedTasks: [], pendingNotes: ["seed"], lastAgent: "code-reviewer" });
    resetSession(ws);
    storage.readState(ws);
    try {
      return await UPD.run({ workspace_path: ws, active_feature: A, completed_tasks: [], pending_notes: [], ...args });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] };
    }
  };
  try {
    setActiveStorage(storage);
    storage.upsertPrdChunks(ws, [chunk("c000")]);
    assert.notEqual(storage.getPrdIndexMeta(ws), null, "a chunk is stored before the writes");

    const keep = await run({ agent_id: "code-reviewer", status: "In_Progress" });
    assert.ok(!rejected(keep), `control write accepted: ${text(keep)}`);
    assert.notEqual(storage.getPrdIndexMeta(ws), null, "a non-PASS write leaves the chunk");

    const pass = await run({
      agent_id: "code-reviewer", status: "PASS", review_verdict: "APPROVED", qa_review: "judged",
      review_task_ids: ["T-1"], completed_tasks: ["T-1"],
    });
    assert.ok(!rejected(pass), `judge PASS accepted: ${text(pass)}`);
    assert.equal(storage.getPrdIndexMeta(ws), null, "the judge's PASS dropped the workspace's chunks");
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch { /* best effort */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

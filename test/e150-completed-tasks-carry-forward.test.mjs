// Coded by @qa-engineer
// E150 (lane e135, feature e135-handoff-notes-ledger): in file mode the completion ledger
// (handoff completed_tasks) is feature-scoped and CARRIES FORWARD across same-feature writes.
// Before: any write that omitted completed_tasks (every coordinator amendment, every non-qa
// write) emptied the ledger, so tw_detect_drift reported evidence-backed PASSes as drift.
// Carry-forward has a cost the fix pays: a qa FAIL write now removes its review_task_ids from
// the ledger, otherwise a rolled-back id would stay in it and tw_sync would re-mark it [x].
// Spec: specs/e135-handoff-notes-ledger.md AC13-AC20; architecture DR-1..DR-5
// (specs/e135-handoff-notes-ledger-architecture.md): `[]` == omission, qa non-empty list MERGES,
// only qa-engineer + FAIL + non-empty review_task_ids shrinks, SQLite is unchanged.
// Repro discipline: red against a copy of base 2ad039d, green at HEAD.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const F = "e150-carry-probe";
const tool = (name) => TOOL_REGISTRY.find((t) => t.name === name);

function mkWs(prefix = "e150-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Seed an on-disk handoff with a given ledger through the plain writer (no carry directive, so
// it replaces the ledger exactly as before), then arm the pre-flight snapshot.
async function seed(ws, { feature = F, agent, status = "In_Progress", ledger }) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks: ledger,
    pendingNotes: ["seed"],
    lastAgent: agent,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}

function qaEvidence(ws, id) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${id}.md`), `# QA review — ${id}\n\nPASS.\n`, "utf-8");
}

function writeTasks(ws, rows) {
  const lines = ["<!-- schema_version: 1 -->", "# Tasks", "", "## Active"];
  for (const [id, done] of rows) lines.push(`- [${done ? "x" : " "}] ${id} task`);
  const tasksPath = resolveCurrentLanePaths(ws).tasksPath;
  fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
  fs.writeFileSync(tasksPath, lines.join("\n") + "\n");
}

const ledgerOf = (ws) => parseHandoff(ws).completed_tasks;
const text = (r) => r.content?.[0]?.text ?? "";

// ---------------------------------------------------------------------------
// AC13 — omission never empties the ledger (any agent, same feature).
// ---------------------------------------------------------------------------
const HOPS = [
  ["sr-engineer -> code-reviewer (review hand-off)", { agent: "sr-engineer" }, { agent_id: "code-reviewer", status: "In_Progress" }],
  ["pm amendment (pm -> pm)", { agent: "pm" }, { agent_id: "pm", status: "In_Progress" }],
  ["sr-engineer -> sr-engineer", { agent: "sr-engineer" }, { agent_id: "sr-engineer", status: "In_Progress" }],
  ["qa-engineer In_Progress (no ids)", { agent: "qa-engineer" }, { agent_id: "qa-engineer", status: "In_Progress" }],
  ];
for (const [label, seedOpts, write] of HOPS) {
  test(`AC13: ledger [A] survives a same-feature write that omits completed_tasks — ${label}`, async () => {
    const ws = mkWs();
    await seed(ws, { ...seedOpts, ledger: ["T-A"] });
    const r = await handleUpdateState({
      workspace_path: ws,
      active_feature: F,
      pending_notes: ["amendment"],
      ...write,
    });
    assert.ok(!r.isError, `write must be accepted: ${text(r)}`);
    assert.deepEqual(ledgerOf(ws), ["T-A"]);
  });
}

test("AC13: the same holds through the real tool boundary (zod defaults the field to [])", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "pm", ledger: ["T-A", "T-B"] });
  await tool("tw_get_state").run({ workspace_path: ws });
  await tool("tw_update_state").run({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "pm",
    pending_notes: ["amend via tool"],
  });
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

test("AC13: successive same-feature writes keep carrying the ledger (no erosion over several hops)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "pm", ledger: ["T-A"] });
  for (let i = 0; i < 3; i++) {
    const r = await handleUpdateState({
      workspace_path: ws,
      active_feature: F,
      status: "In_Progress",
      agent_id: "pm",
      pending_notes: [`hop ${i}`],
    });
    assert.ok(!r.isError, text(r));
  }
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

// ---------------------------------------------------------------------------
// AC15 (DR-1) — [] means exactly what omission means, for every agent.
// ---------------------------------------------------------------------------
for (const agent of ["pm", "sr-engineer", "code-reviewer", "qa-engineer"]) {
  test(`AC15: completed_tasks: [] never shrinks the ledger — ${agent}`, async () => {
    const ws = mkWs();
    await seed(ws, { agent: agent === "code-reviewer" ? "sr-engineer" : agent, ledger: ["T-A", "T-B"] });
    const r = await handleUpdateState({
      workspace_path: ws,
      active_feature: F,
      status: "In_Progress",
      agent_id: agent,
      completed_tasks: [],
      pending_notes: ["explicit empty list"],
    });
    assert.ok(!r.isError, text(r));
    assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
  });
}

test("AC15: a direct caller that bypasses zod with completed_tasks undefined is normalised the same way", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "pm", ledger: ["T-A"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: undefined,
    pending_notes: [],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

// ---------------------------------------------------------------------------
// AC15 (DR-2) — a qa-engineer non-empty list MERGES (union, on-disk order first, deduped).
// ---------------------------------------------------------------------------
test("AC15: qa-engineer writing [B] with ledger [A] yields [A, B], not [B]", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A"] });
  qaEvidence(ws, "T-B");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-B"],
    pending_notes: ["QA: T-B"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

test("AC15: a cumulative list [A, B] on ledger [A] adds only B (no duplicate, on-disk order first)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A"] });
  qaEvidence(ws, "T-B");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-B", "T-A"],
    pending_notes: ["QA cumulative"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

test("AC15: the writer's union dedupes on the trimmed id (writer-level, directive present)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A"] });
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: F,
    status: "In_Progress",
    completedTasks: ["  T-A  ", "T-B"],
    pendingNotes: ["padded"],
    lastAgent: "qa-engineer",
    completedTasksCarry: { remove: [] },
  });
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

test("AC15: a qa PASS carrying only the current ids keeps earlier PASSes on the ledger", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B"] });
  qaEvidence(ws, "T-C");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T-C"],
    qa_review: "PASS T-C",
    pending_notes: ["QA: T-C PASS"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B", "T-C"]);
});

// ---------------------------------------------------------------------------
// AC14 — feature change: new handoff ledger is empty unless the write grows it; archive keeps the old one.
// ---------------------------------------------------------------------------
test("AC14: a write naming a different active_feature starts with an empty ledger and archives the old file", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", status: "PASS", ledger: ["T-A"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e150-other-feature",
    status: "In_Progress",
    agent_id: "pm",
    pending_notes: ["new feature"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), []);
  const dir = path.join(ws, ".current", "archive");
  const archived = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
  assert.ok(archived.some((t) => t.includes("- [x] T-A")), "the archive copy must still capture the old ledger");
});

test("AC14: the new feature's own qa write grows its fresh ledger from empty (old ids are not merged in)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", status: "PASS", ledger: ["T-OLD"] });
  const r1 = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e150-next",
    status: "In_Progress",
    agent_id: "pm",
    pending_notes: ["switch"],
  });
  assert.ok(!r1.isError, text(r1));
  assert.deepEqual(ledgerOf(ws), []);
});

// ---------------------------------------------------------------------------
// AC16 — qa FAIL shrinks by review_task_ids; nothing else does.
// ---------------------------------------------------------------------------
async function qaFail(ws, extra = {}) {
  return handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "FAIL",
    agent_id: "qa-engineer",
    review_task_ids: ["T-B"],
    qa_review: "FAIL T-B: regression",
    blocking_reason: "QA: T-B FAIL",
    pending_notes: ["QA: T-B FAIL"],
    ...extra,
  });
}

test("AC16: qa FAIL with review_task_ids [B] on ledger [A, B] leaves [A]", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B"] });
  const r = await qaFail(ws);
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

test("AC16: the explicit completed_tasks: [] spelling of the same FAIL write also shrinks", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B"] });
  const r = await qaFail(ws, { completed_tasks: [] });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

test("AC16 (DR-3): when one FAIL write both lists B in completed_tasks and names it in review_task_ids, removal wins", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B"] });
  qaEvidence(ws, "T-B");
  const r = await qaFail(ws, { completed_tasks: ["T-B"] });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

test("AC16: a ledger entry that wraps the id in prose is matched on a word boundary (same predicate as tw_sync)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B (PASS, round 2)", "T-B2 unrelated"] });
  const r = await qaFail(ws);
  assert.ok(!r.isError, text(r));
  // "T-B2" has no word boundary after "T-B" ("2" is a word char), so it must survive.
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B2 unrelated"]);
});

test("AC16: only qa-engineer + FAIL + non-empty review_task_ids shrinks — APPROVED row (qa In_Progress + review_task_ids) never does", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "code-reviewer", ledger: ["T-A", "T-B"] });
  qaEvidence(ws, "T-B");
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-B.md"), "# Review T-B\n\nAPPROVED.\n");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "qa-engineer",
    review_task_ids: ["T-B"],
    qa_review: "APPROVED row: reviewing T-B",
    pending_notes: ["QA: claiming T-B"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

test("AC16: a qa FAIL that names no review_task_ids cannot remove anything (the write is refused, ledger intact)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "FAIL",
    agent_id: "qa-engineer",
    qa_review: "FAIL without a target",
    blocking_reason: "QA: FAIL",
  });
  assert.ok(r.isError, "QA_REVIEW_TARGET_REQUIRED already refuses this shape");
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

test("AC16: a non-qa agent naming review_task_ids can never shrink the ledger", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "sr-engineer", ledger: ["T-A", "T-B"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "code-reviewer",
    review_task_ids: ["T-B"],
    pending_notes: ["review"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A", "T-B"]);
});

for (const order of ["FAIL write first", "rollback first"]) {
  test(`AC16: qa FAIL + tw_rollback_task + tw_sync (${order}) — B stays out of the ledger and is not re-marked [x]`, async () => {
    const ws = mkWs();
    writeTasks(ws, [["T-A", true], ["T-B", true]]);
    await seed(ws, { agent: "qa-engineer", ledger: ["T-A", "T-B"] });
    const rollback = () => tool("tw_rollback_task").run({ workspace_path: ws, task_id: "T-B", reason: "QA: T-B FAIL" });
    if (order === "rollback first") {
      await rollback();
      markStateRead(ws);
    }
    const r = await qaFail(ws);
    assert.ok(!r.isError, text(r));
    if (order === "FAIL write first") await rollback();

    assert.deepEqual(ledgerOf(ws), ["T-A"]);
    resetSession(ws);
    await tool("tw_get_state").run({ workspace_path: ws });
    await tool("tw_sync").run({ workspace_path: ws });
    const tasks = fs.readFileSync(resolveCurrentLanePaths(ws).tasksPath, "utf8");
    assert.match(tasks, /- \[x\] T-A /, "A stays complete");
    assert.match(tasks, /- \[ \] T-B /, "tw_sync must not re-mark the rolled-back B");
  });
}

// ---------------------------------------------------------------------------
// AC17 — the Non-QA Completed-Tasks Gate is unchanged: strict on the incoming list.
// ---------------------------------------------------------------------------
test("AC17: a non-qa write carrying a non-empty completed_tasks is still rejected and the ledger is untouched", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "sr-engineer", ledger: ["T-A"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-NEW"],
    pending_notes: ["tries to grow the ledger"],
  });
  assert.ok(r.isError);
  assert.match(text(r), /REVIEWER_COMPLETED_TASKS_REJECTED|NON_QA_COMPLETED_TASKS_REJECTED/);
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

test("AC17: the QA completion-evidence gate still diffs the incoming list against the on-disk set (new id without evidence is refused)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-NOEVIDENCE"],
    pending_notes: ["no evidence"],
  });
  assert.ok(r.isError);
  assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

test("AC17: ids already on disk need no fresh evidence even when re-sent (cumulative list never re-gates)", async () => {
  const ws = mkWs();
  await seed(ws, { agent: "qa-engineer", ledger: ["T-A"] });
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-A"],
    pending_notes: ["cumulative"],
  });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(ledgerOf(ws), ["T-A"]);
});

// ---------------------------------------------------------------------------
// AC18 — SQLite/HTTP mode unchanged: omitted completed_tasks is stored as [].
// ---------------------------------------------------------------------------
let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed — AC18 SQLite case skipped");
}

test("AC18: SQLite storage stores an omitted completed_tasks as [] exactly as before (carry-forward is file-mode only)", { skip: !SqliteHandoffStorage }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e150-sql-"));
  try {
    const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
    await storage.writeState({
      workspacePath: dir,
      activeFeature: F,
      status: "In_Progress",
      completedTasks: ["T-A"],
      pendingNotes: [],
      lastAgent: "pm",
    });
    assert.deepEqual(storage.parse(dir).completed_tasks, ["T-A"]);
    await storage.writeState({
      workspacePath: dir,
      activeFeature: F,
      status: "In_Progress",
      completedTasks: [],
      pendingNotes: [],
      lastAgent: "pm",
    });
    assert.deepEqual(storage.parse(dir).completed_tasks, [], "SQLite must keep today's replace semantics");
  } finally {
    setActiveStorage(new FileHandoffStorage());
  }
});

// ---------------------------------------------------------------------------
// AC19 / AC20 — strings.
// ---------------------------------------------------------------------------
test("AC19: tools/drift.ts and its dist no longer claim a merged lane's ledger 'can be discarded on conflict'", () => {
  for (const f of ["tools/drift.ts", "dist/tools/drift.js"]) {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, f), "utf8").replace(/`\s*\+\s*`/g, "");
    assert.equal(src.split("discarded on conflict").length - 1, 0, f);
    assert.ok(
      src.includes(
        "completed_tasks is feature-scoped: it carries forward across same-feature writes and empties on an active_feature change (E150).",
      ),
      `${f} must carry the drift.evidence-line sentence verbatim`,
    );
  }
});

test("AC20: the tw_update_state completed_tasks description states the new lifetime (final architecture string) and 'Tasks completed now' is gone", () => {
  const desc = tool("tw_update_state").inputSchema.properties.completed_tasks.description;
  assert.equal(
    desc,
    'Task ids QA has completed for this feature (only agent_id "qa-engineer" may change it). File mode: a qa-engineer list is added to the ids already recorded; kept across same-feature writes that omit it or pass []; a qa-engineer FAIL write removes its review_task_ids; cleared when active_feature changes. SQLite: stored as given.',
  );
  const src = fs.readFileSync(path.join(PROJECT_ROOT, "tools/registry.ts"), "utf8");
  assert.equal(src.split("Tasks completed now").length - 1, 0);
});

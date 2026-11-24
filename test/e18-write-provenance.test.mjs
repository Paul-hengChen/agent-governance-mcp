// Coded by @qa-engineer
// Tests for the QA-evidence write gate, QA_COMPLETION_EVIDENCE_MISSING (backlog E18;
// T-E18-02; spec = the E18 section of docs/backlog.md). It closed an identity-swap hole: a
// code-reviewer's write stamped qa-engineer pre-filled completed_tasks (E435: code-reviewer is the judge). Cases QAEV-*, CONTENT-*;
// E32 regression pins live in test/e32-e33-gate-hardening.test.mjs.
// Rationale: specs/e260f-comment-rationale.md (test/e18-write-provenance.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency. Skip the
// SQLite-mode block gracefully if it's not installed locally — same guard as
// test/feature-lease.test.mjs / test/reviewer-completed-tasks-gate.test.mjs.
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode e18-write-provenance tests skipped");
}

// ---------------------------------------------------------------------------
// File-mode helpers (mirrors feature-lease.test.mjs / reviewer-completed-tasks-gate.test.mjs)
// ---------------------------------------------------------------------------

function mkWs(prefix = "e18-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedFileState(ws, feature, agent, status) {
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
  // Pin the seed's last_updated to a fixed stamp so seed-then-write fixtures are deterministic
  // (see test/e148-seed-stamp.mjs).
  forceSeedStamp(ws);
}

function writeQaEvidence(ws, taskId) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), `# QA review — ${taskId}\n\nPASS.\n`, "utf-8");
}

function writeCodeReviewEvidence(ws, taskId) {
  const dir = path.join(ws, "review_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), `# Code review — ${taskId}\n\nAPPROVED.\n`, "utf-8");
}

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "e18-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

// ===========================================================================
// QA-evidence gate (fix b) — QA_COMPLETION_EVIDENCE_MISSING. E435: code-reviewer is the only
// ledger writer (a qa-engineer ledger write is NON_JUDGE_COMPLETED_TASKS_REJECTED, pinned in
// test/reviewer-completed-tasks-gate.test.mjs FM12), so the evidence gate diffs the judge's list.
// ===========================================================================

test("QAEV-1 (E435): a code-reviewer self-loop write adding a NEW completed_tasks id with NO evidence on disk is rejected, naming the missing id", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev1-");
  await seedFileState(ws, "e18-qaev1-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev1-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-QAEV1-01"],
    pending_notes: ["code-reviewer: claiming completion with no evidence yet"],
  });
  assert.ok(result.isError, "an unevidenced new completed_tasks id must be rejected");
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.match(result.content[0].text, /T-QAEV1-01/, "the rejection must name the missing id");
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the incumbent completed_tasks list must remain untouched after rejection");
});

test("QAEV-2 (E435): the SAME code-reviewer write, once per-id evidence exists on disk, is ACCEPTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev2-");
  await seedFileState(ws, "e18-qaev2-feat", "code-reviewer", "In_Progress");
  writeQaEvidence(ws, "T-QAEV2-01");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev2-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-QAEV2-01"],
    pending_notes: ["code-reviewer: completion backed by evidence"],
  });
  assert.ok(!result.isError, `a completed_tasks id with per-id evidence present must be accepted: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-QAEV2-01"]);
});

test("QAEV-3 (E435): a code-reviewer cumulative list-back (only ids ALREADY on disk, no new ones) is NOT gated even with zero evidence", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev3-");
  resetSession(ws);
  markStateRead(ws);
  // Seed a judge state that ALREADY carries T-QAEV3-01 as completed —
  // no evidence file written for it (the write that first completed it is
  // out of scope for this test; only the "no NEW ids" set-difference matters).
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e18-qaev3-feat",
    status: "In_Progress",
    completedTasks: ["T-QAEV3-01"],
    pendingNotes: ["seed — already completed"],
    lastAgent: "code-reviewer",
  });
  // Force the seed's last_updated off the wall clock so a live timestamp can
  // never randomly look hand-authored (E148) — see test/e148-seed-stamp.mjs.
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev3-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-QAEV3-01"], // passed back verbatim, no new id added
    pending_notes: ["code-reviewer: cumulative list-back, nothing new"],
  });
  assert.ok(!result.isError, `passing back the same (already-on-disk) id list must never gate: ${result.content?.[0]?.text}`);
});

test("QAEV-4a (E32 amendment, E435): a code-reviewer APPROVED write with a completed_tasks manifest backed only by review_reports (NO qa_reports) is REJECTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev4a-");
  await seedFileState(ws, "e18-qaev4a-feat", "code-reviewer", "In_Progress");
  // review_reports/ evidence backs nothing for the ledger; deliberately NO qa_reports/
  // evidence. The gate has no edge/status/verdict exemption, so APPROVED does not clear it.
  writeCodeReviewEvidence(ws, "T-QAEV4-01");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev4a-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-QAEV4-01"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED, ledger prefill without a report"],
  });
  assert.ok(
    result.isError,
    `no APPROVED-row exemption: review_reports evidence alone must be REJECTED: ${result.content?.[0]?.text}`,
  );
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the ledger must stay unpolluted — the manifest write never lands");
});

test("QAEV-4b (E32 amendment, E435): the judge's APPROVED self-loop — review_task_ids manifest, completed_tasks EMPTY — is ACCEPTED, ledger stays []", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev4b-");
  await seedFileState(ws, "e18-qaev4b-feat", "code-reviewer", "In_Progress");
  // Review scope travels ONLY in the transient review_task_ids field; completed_tasks
  // stays empty, so QA_COMPLETION_EVIDENCE_MISSING never arms (nothing grows).
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev4b-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    review_task_ids: ["T-QAEV4-02"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED, scope in review_task_ids"],
  });
  assert.ok(
    !result.isError,
    `the compliant shape (review_task_ids + empty completed_tasks) must be ACCEPTED: ${result.content?.[0]?.text}`,
  );
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "review scope must NOT persist into completed_tasks");
});

// ---------------------------------------------------------------------------
// Incident replay (E5 identity swap), E435 shape: after the judge's legitimate APPROVED
// self-loop, the old swap (a write stamped qa-engineer) is no longer an edge, and a
// same-session judge write pre-filling completed_tasks with zero qa_reports evidence is still
// refused by the evidence gate (docs/backlog.md incident (b)).
// ---------------------------------------------------------------------------

test("QAEV-INCIDENT (E435): after the judge's APPROVED write, the qa-engineer-stamped swap is TRANSITION_REJECTED and the judge's zero-evidence pre-fill is QA_COMPLETION_EVIDENCE_MISSING", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev-incident-");
  await seedFileState(ws, "e5-replay-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const ids = ["T-E5-01", "T-E5-02", "T-E5-03"];

  // Write 1 — the LEGITIMATE APPROVED self-loop, empty completed_tasks.
  const approved = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e5-replay-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    review_task_ids: ids,
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED T-E5-01/02/03"],
  });
  assert.ok(!approved.isError, `sanity: the legitimate APPROVED write must succeed: ${approved.content?.[0]?.text}`);

  // Write 2a — the original swap: stamped qa-engineer; code-reviewer:In_Progress -> qa-engineer is gone.
  const swap = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e5-replay-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ids,
    pending_notes: ["qa-engineer: pre-filling completion (the incident shape)"],
  });
  assert.ok(swap.isError, `the qa-engineer-stamped swap must be rejected: ${swap.content?.[0]?.text}`);
  assert.match(swap.content[0].text, /TRANSITION_REJECTED/);

  // Write 2b — the same pre-fill stamped by the judge, zero qa_reports evidence anywhere.
  const prefill = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e5-replay-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ids,
    pending_notes: ["code-reviewer: pre-filling completion with no report"],
  });
  assert.ok(prefill.isError, `the zero-evidence judge pre-fill must be rejected: ${prefill.content?.[0]?.text}`);
  assert.match(prefill.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  for (const id of ids) {
    assert.match(prefill.content[0].text, new RegExp(id), `rejection must name ${id} among the missing ids`);
  }
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the pre-filled ids must NOT land in completed_tasks");
});

sqliteDescribe("QAEV-SQL (E435): SQLite mode — an unevidenced judge self-loop completion add is NOT gated (file-mode-only gate)", () => {
  test("QAEV-SQL (E435): SQLite-mode code-reviewer self-loop add with zero reports rows is accepted", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("e18-qaevsql-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "e18-sql-qa-feat",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "code-reviewer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "e18-sql-qa-feat",
        status: "In_Progress",
        agent_id: "code-reviewer",
        completed_tasks: ["T-E18-SQL-01"],
        pending_notes: ["code-reviewer: SQLite mode, no reports row exists yet"],
      });
      assert.ok(!result.isError, `SQLite mode must ignore QA_COMPLETION_EVIDENCE_MISSING entirely: ${result.content?.[0]?.text}`);
      assert.doesNotMatch(result.content?.[0]?.text ?? "", /QA_COMPLETION_EVIDENCE_MISSING/);
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ===========================================================================
// Content pins — const-08 origin tags + skill-release-engineer.md's
// COORDINATOR-RELAYED hard line (docs/backlog.md E18 Fix (a) closing clause).
// ===========================================================================

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

const CONST08 = readContentFile("const-08-chain-31-mid.md");
const SKILL_RELEASE_ENGINEER = readContentFile("skill-release-engineer.md");

test("CONTENT-2: const-08 QA Completion-Evidence bullet carries the (v3.86.0, E18) origin tag and the QA_COMPLETION_EVIDENCE_MISSING code", () => {
  assert.match(
    CONST08,
    /\*\*QA Completion-Evidence<!-- origin:start --> \(v3\.86\.0, E18\)<!-- origin:end -->\*\*/,
    "must locate the QA Completion-Evidence bullet heading with its (v3.86.0, E18) origin tag",
  );
  assert.match(
    CONST08,
    /\*\*QA Completion-Evidence[\s\S]*?`QA_COMPLETION_EVIDENCE_MISSING`/,
    "the QA Completion-Evidence bullet must backtick-quote its own error code",
  );
});

test("CONTENT-3 [E394 re-pin AC-P6/AC-P10]: the SOP carries the coordinator-relayed rule (no brief overrides); the history keeps the E18 line naming the v3.85.0 incident", () => {
  // Rule: one condensed Hard-rule bullet in the rewritten SOP.
  const ruleMatch = SKILL_RELEASE_ENGINEER.match(/^-\s+\*\*No-MCP-path sessions relay\*\*.*$/m);
  assert.ok(ruleMatch, "must locate the No-MCP-path relay Hard rule bullet");
  assert.ok(
    ruleMatch[0].includes("the coordinator makes it"),
    "the rule must state the coordinator makes the relayed write",
  );
  assert.ok(
    ruleMatch[0].includes("No dispatch brief overrides this rule"),
    "the rule must state it outranks any dispatch brief instructing otherwise",
  );
  assert.ok(
    !ruleMatch[0].includes("STAMP_PROVENANCE_SUSPECT"),
    "the retired stamp gate is no longer cited as a backstop",
  );
  // Incident: the verbatim E18 line (v3.85.0 incident) moved to the history file.
  const history = fs.readFileSync(path.join(ROOT, "specs", "release-sop-history.md"), "utf-8");
  const lineMatch = history.match(/^-\s+\*\*CRITICAL — Closing write is COORDINATOR-RELAYED.*$/m);
  assert.ok(lineMatch, "history must keep the full COORDINATOR-RELAYED bullet line (E18)");
  assert.ok(lineMatch[0].includes("outranks ANY dispatch brief"), "the history line must keep the outranks-any-brief wording");
  assert.ok(lineMatch[0].includes("v3.85.0 incident"), "the history line must name the v3.85.0 incident");
  assert.ok(lineMatch[0].includes("STAMP_PROVENANCE_SUSPECT"), "the history line must keep the server-side gate cross-reference");
});

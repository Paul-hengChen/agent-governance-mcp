// Coded by @qa-engineer
// Tests for the QA-evidence write gate, QA_COMPLETION_EVIDENCE_MISSING (backlog E18;
// T-E18-02; spec = the E18 section of docs/backlog.md). It closes an identity-swap hole: a
// code-reviewer's write stamped qa-engineer pre-filled completed_tasks. Cases QAEV-*, CONTENT-*;
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
// QA-evidence gate (fix b) — QA_COMPLETION_EVIDENCE_MISSING
// ===========================================================================

test("QAEV-1: a qa-engineer self-loop write adding a NEW completed_tasks id with NO evidence on disk is rejected, naming the missing id", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev1-");
  await seedFileState(ws, "e18-qaev1-feat", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev1-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-QAEV1-01"],
    pending_notes: ["qa-engineer: claiming completion with no evidence yet"],
  });
  assert.ok(result.isError, "an unevidenced new completed_tasks id must be rejected");
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.match(result.content[0].text, /T-QAEV1-01/, "the rejection must name the missing id");
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the incumbent completed_tasks list must remain untouched after rejection");
});

test("QAEV-2: the SAME write, once per-id evidence exists on disk, is ACCEPTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev2-");
  await seedFileState(ws, "e18-qaev2-feat", "qa-engineer", "In_Progress");
  writeQaEvidence(ws, "T-QAEV2-01");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev2-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-QAEV2-01"],
    pending_notes: ["qa-engineer: completion backed by evidence"],
  });
  assert.ok(!result.isError, `a completed_tasks id with per-id evidence present must be accepted: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-QAEV2-01"]);
});

test("QAEV-3: a cumulative list-back (only ids ALREADY on disk, no new ones) is NOT gated even with zero evidence", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev3-");
  resetSession(ws);
  markStateRead(ws);
  // Seed a qa-engineer state that ALREADY carries T-QAEV3-01 as completed —
  // no evidence file written for it (the write that first completed it is
  // out of scope for this test; only the "no NEW ids" set-difference matters).
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e18-qaev3-feat",
    status: "In_Progress",
    completedTasks: ["T-QAEV3-01"],
    pendingNotes: ["seed — already completed"],
    lastAgent: "qa-engineer",
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
    agent_id: "qa-engineer",
    completed_tasks: ["T-QAEV3-01"], // passed back verbatim, no new id added
    pending_notes: ["qa-engineer: cumulative list-back, nothing new"],
  });
  assert.ok(!result.isError, `passing back the same (already-on-disk) id list must never gate: ${result.content?.[0]?.text}`);
});

test("QAEV-4a (E32 amendment): the OLD sanctioned APPROVED-row shape — completed_tasks manifest + review_reports evidence, NO qa_reports — is now REJECTED (exemption removed)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev4a-");
  await seedFileState(ws, "e18-qaev4a-feat", "code-reviewer", "In_Progress");
  // review_reports/ evidence would have satisfied the pre-existing
  // MISSING_REVIEW_EVIDENCE gate on this edge under the OLD contract —
  // deliberately NO qa_reports/ evidence. Under the amended contract this
  // shape (completed_tasks non-empty on a qa-engineer write, no per-id QA
  // evidence) is rejected UNCONDITIONALLY: no edge/status/verdict exemption.
  writeCodeReviewEvidence(ws, "T-QAEV4-01");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev4a-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-QAEV4-01"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED, handing to qa-engineer"],
  });
  assert.ok(
    result.isError,
    `the E32 amendment removes the APPROVED-row exemption entirely — this OLD shape must now be REJECTED: ${result.content?.[0]?.text}`,
  );
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the ledger must stay unpolluted — the manifest write never lands");
});

test("QAEV-4b (E32 amendment): the AMENDED APPROVED-row shape — review_task_ids manifest, completed_tasks EMPTY — is ACCEPTED, ledger stays []", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev4b-");
  await seedFileState(ws, "e18-qaev4b-feat", "code-reviewer", "In_Progress");
  // Amended contract: review scope travels ONLY in the transient
  // review_task_ids field; completed_tasks stays empty on the APPROVED row.
  // review_reports/ evidence satisfies MISSING_REVIEW_EVIDENCE (which now
  // reads review_task_ids); QA_COMPLETION_EVIDENCE_MISSING never arms
  // because completed_tasks is empty (nothing grows).
  writeCodeReviewEvidence(ws, "T-QAEV4-02");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-qaev4b-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-QAEV4-02"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED, handing to qa-engineer"],
  });
  assert.ok(
    !result.isError,
    `the amended compliant shape (review_task_ids + empty completed_tasks) must be ACCEPTED: ${result.content?.[0]?.text}`,
  );
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "review scope must NOT persist into completed_tasks under the amended contract");
});

// ---------------------------------------------------------------------------
// Incident replay (E5 identity swap): a legitimate APPROVED handoff with an empty
// completed_tasks manifest, then a SECOND self-looped write still stamped qa-engineer that
// pre-fills completed_tasks with zero qa_reports evidence. Its prevTuple is (qa-engineer,
// In_Progress), not (code-reviewer, In_Progress), so it never lands on the exempt APPROVED-row
// edge: the gate closes the hole the exemption cannot (docs/backlog.md incident (b)).
// ---------------------------------------------------------------------------

test("QAEV-INCIDENT: the exact E5 identity-swap replay (APPROVED write, then a self-looped qa-engineer pre-fill with zero evidence) is REJECTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-qaev-incident-");
  await seedFileState(ws, "e5-replay-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  // Write 1 — the LEGITIMATE APPROVED handoff (code-reviewer:In_Progress ->
  // qa-engineer:In_Progress), empty completed_tasks manifest (review-scope
  // list, not yet the actual completion ids).
  const approved = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e5-replay-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED T-E5-01/02/03 (verdict returned inline)"],
  });
  assert.ok(!approved.isError, `sanity: the legitimate APPROVED write must succeed: ${approved.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).last_agent, "qa-engineer", "sanity: on-disk last_agent is now qa-engineer after the APPROVED write");

  // Write 2 — the IMPERSONATION write: same session, no intervening
  // tw_get_state read, still agent_id="qa-engineer", now pre-filling the real
  // completion ids with zero qa_reports evidence on disk anywhere.
  const impersonation = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e5-replay-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-E5-01", "T-E5-02", "T-E5-03"],
    pending_notes: ["qa-engineer: pre-filling completion (the incident shape)"],
  });
  assert.ok(
    impersonation.isError,
    `the E5 impersonation write shape must now be rejected: ${impersonation.content?.[0]?.text}`,
  );
  assert.match(impersonation.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  for (const id of ["T-E5-01", "T-E5-02", "T-E5-03"]) {
    assert.match(impersonation.content[0].text, new RegExp(id), `rejection must name ${id} among the missing ids`);
  }
  assert.deepEqual(
    parseHandoff(ws).completed_tasks,
    [],
    "the impersonated ids must NOT land in completed_tasks — tasks.md/handoff must stay unpolluted",
  );
});

sqliteDescribe("QAEV-SQL: SQLite mode — an unevidenced qa-engineer self-loop completion add is NOT gated (file-mode-only gate)", () => {
  test("QAEV-SQL: SQLite-mode self-loop add with zero reports rows is accepted", async () => {
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
        lastAgent: "qa-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "e18-sql-qa-feat",
        status: "In_Progress",
        agent_id: "qa-engineer",
        completed_tasks: ["T-E18-SQL-01"],
        pending_notes: ["qa-engineer: SQLite mode, no reports row exists yet"],
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

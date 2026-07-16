// Coded by @qa-engineer
// Tests for backlog E18 — write-provenance hardening (T-E18-01, T-E18-02).
// Spec = docs/backlog.md "## E18 — Write-provenance hardening" section. Both
// gates close a hole exploited during the PREVIOUS chain (E5): incident (a) a
// hand-authored closing write (third E9A-class, fabricated zero-entropy
// stamps 2026-07-14T00:00:00.000Z, commits 5950c58/199b164); incident (b) an
// identity-swap gate evasion (a code-reviewer subagent's SECOND write,
// stamped agent_id="qa-engineer", pre-filling completed_tasks T-E5-01/02/03
// before any qa-engineer ran, with zero evidence on disk).
//
// Mirrors the gate-test conventions in test/feature-lease.test.mjs (E10
// lease-override / bookkeeping-write sections) and
// test/reviewer-completed-tasks-gate.test.mjs (FM4/FM5 APPROVED-row positive
// control pattern) — same helpers, same storage-mode split, same
// "seed via raw writeHandoffState, gate via handleUpdateState" shape.
//
// Spec-to-Test map:
//   STAMP gate fires on a suspect on-disk stamp                -> STAMP-1
//   STAMP gate cleared by an audited stamp-remediation note,
//     note persists verbatim in the written handoff            -> STAMP-2
//   STAMP gate self-disarms after the accepted remediation write -> STAMP-3
//   STAMP gate inert on a brand-new workspace (no prevState)    -> STAMP-4
//   STAMP gate never trips on a real ms-entropy server stamp    -> STAMP-5
//   STAMP gate is file-mode only (SQLite inert)                 -> STAMP-SQL
//   QA-evidence gate rejects an unevidenced self-loop add,
//     naming the missing ids                                   -> QAEV-1
//   QA-evidence gate accepts once per-id evidence exists        -> QAEV-2
//   QA-evidence gate does not re-gate a cumulative list-back
//     (no NEW ids)                                              -> QAEV-3
//   QA-evidence gate: the OLD sanctioned APPROVED-row shape
//     (completed_tasks manifest + review_reports evidence, NO
//     qa_reports) is now REJECTED — the exemption is removed         -> QAEV-4a
//   QA-evidence gate: the AMENDED APPROVED-row shape (review_task_ids
//     manifest, completed_tasks EMPTY) is ACCEPTED, ledger stays []  -> QAEV-4b
//   Incident replay: the exact E5 identity-swap shape is now
//     rejected                                                  -> QAEV-INCIDENT
//   QA-evidence gate is file-mode only (SQLite inert)            -> QAEV-SQL
//   Content pins: const-08 origin tags + skill-release-engineer
//     COORDINATOR-RELAYED hard line                              -> CONTENT-1..3
//
// E32 amendment (2026-07-16, e32-e33-gate-hardening): the fourth
// E9A/E18-class incident showed the APPROVED-row `completed_tasks`
// exemption above was itself the hole — an unsanctioned pre-fill riding the
// (code-reviewer,In_Progress)->(qa-engineer,In_Progress) edge was
// byte-identical to the sanctioned write. QAEV-4a/b replace the old
// single QAEV-4 exemption test with the amended contract (specs/
// c16-c10-role-boundary.md Amendment section; review_reports/
// review_T-E32-01.md rounds 1-2). See also test/e32-e33-gate-hardening.test.mjs
// for the permanent R1-incident regression pin, the P6a/P6b/P6c
// divergent-field matrix, and the rejection-envelope content assertions.

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
import { isHandAuthoredStamp, hasStampRemediationAudit } from "../dist/gates/stamp-provenance.js";

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
}

function setLastUpdated(ws, iso) {
  const p = path.join(ws, ".current", "handoff.md");
  const raw = fs.readFileSync(p, "utf-8");
  fs.writeFileSync(p, raw.replace(/^last_updated:\s*"[^"]*"$/m, `last_updated: "${iso}"`), "utf-8");
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

// A hand-authored-shaped stamp: seconds "00", milliseconds ".000" — matches
// gates/stamp-provenance.ts's HAND_AUTHORED_STAMP_RE. Distinct from the E10
// AC4 fixture's date ("2026-05-01") so this file's fixtures are independent.
const SUSPECT_STAMP = "2026-07-14T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Sanity: the shared predicate itself agrees with the fixture (belt-and-braces
// — if this fails, every test below built on SUSPECT_STAMP is vacuous).
// ---------------------------------------------------------------------------

test("sanity: SUSPECT_STAMP matches isHandAuthoredStamp; a real ms-entropy stamp does not", () => {
  assert.equal(isHandAuthoredStamp(SUSPECT_STAMP), true);
  assert.equal(isHandAuthoredStamp(new Date().toISOString()), false, "a live now() stamp almost never lands on seconds=00/ms=.000");
  assert.equal(hasStampRemediationAudit({ pending_notes: ["stamp-remediation: x"] }), true);
  assert.equal(hasStampRemediationAudit({ pending_notes: ["not a remediation note"] }), false);
  assert.equal(hasStampRemediationAudit({}), false);
  assert.equal(hasStampRemediationAudit(null), false);
});

// ===========================================================================
// STAMP gate (fix a) — STAMP_PROVENANCE_SUSPECT
// ===========================================================================

test("STAMP-1: a suspect on-disk last_updated rejects the NEXT write with STAMP_PROVENANCE_SUSPECT (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-stamp1-");
  await seedFileState(ws, "e18-stamp1-feat", "release-engineer", "In_Progress");
  setLastUpdated(ws, SUSPECT_STAMP);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-stamp1-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm continuing after a suspect stamp"],
  });
  assert.ok(result.isError, "a write against a hand-authored-shaped on-disk stamp must be rejected");
  assert.match(result.content[0].text, /STAMP_PROVENANCE_SUSPECT/);
  assert.equal(parseHandoff(ws).last_updated, SUSPECT_STAMP, "the suspect stamp must be left untouched by the rejected write");
});

test("STAMP-2: a write carrying an audited stamp-remediation note is ACCEPTED, and the note persists verbatim in the written handoff", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-stamp2-");
  await seedFileState(ws, "e18-stamp2-feat", "release-engineer", "In_Progress");
  setLastUpdated(ws, SUSPECT_STAMP);
  resetSession(ws);
  markStateRead(ws);

  const remediationNote = "stamp-remediation: confirmed test fixture, not a real out-of-band edit — safe to overwrite";
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-stamp2-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: [remediationNote, "pm continuing"],
  });
  assert.ok(!result.isError, `an audited stamp-remediation write must be accepted: ${result.content?.[0]?.text}`);
  const healed = parseHandoff(ws);
  assert.equal(healed.pending_notes[0], remediationNote, "the stamp-remediation note must persist verbatim in the written handoff (forensic trail)");
  assert.notEqual(healed.last_updated, SUSPECT_STAMP, "the accepted write must stamp a fresh (ms-entropy) now(), not preserve the suspect stamp");
});

test("STAMP-3: the gate self-disarms after an accepted remediation write — the VERY NEXT write needs no remediation note", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-stamp3-");
  await seedFileState(ws, "e18-stamp3-feat", "release-engineer", "In_Progress");
  setLastUpdated(ws, SUSPECT_STAMP);
  resetSession(ws);
  markStateRead(ws);

  const remediated = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-stamp3-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["stamp-remediation: clearing the suspect fixture stamp", "pm continuing"],
  });
  assert.ok(!remediated.isError, `remediation write must be accepted: ${remediated.content?.[0]?.text}`);

  // Same session, no intervening resetSession/markStateRead — mirrors a real
  // agent's next tool call in the same turn. The gate must be disarmed purely
  // because the on-disk stamp is now fresh (ms entropy), not because of any
  // carried-forward note.
  const next = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-stamp3-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm continuing, no remediation needed now"],
  });
  assert.ok(!next.isError, `the gate must self-disarm after the prior accepted write: ${next.content?.[0]?.text}`);
});

test("STAMP-4: a brand-new workspace (no prevState at all) is inert — first write never gated regardless of remediation", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-stamp4-");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-stamp4-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["first write in a brand-new workspace"],
    cut_approved: true,
  });
  assert.ok(!result.isError, `a fresh workspace must never trip STAMP_PROVENANCE_SUSPECT (no prevState to distrust): ${result.content?.[0]?.text}`);
  assert.equal(parseHandoff(ws).active_feature, "e18-stamp4-feat");
});

test("STAMP-5: a real ms-entropy on-disk stamp never trips the gate (negative control)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e18-stamp5-");
  // seedFileState's writeHandoffState stamps a genuine new Date().toISOString()
  // — vanishingly unlikely to land on seconds=00/ms=.000 (the sanity test
  // above already confirms this predicate behavior directly).
  await seedFileState(ws, "e18-stamp5-feat", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e18-stamp5-feat",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["ordinary continuation, no remediation note"],
  });
  assert.ok(!result.isError, `an ordinary ms-entropy stamp must never trip STAMP_PROVENANCE_SUSPECT: ${result.content?.[0]?.text}`);
});

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "e18-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

sqliteDescribe("STAMP-SQL: SQLite mode — a suspect on-disk stamp has NO effect; STAMP_PROVENANCE_SUSPECT never fires (file-mode-only gate)", () => {
  test("STAMP-SQL: SQLite-mode suspect stamp is inert", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("e18-stampsql-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "e18-sql-feat",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "release-engineer",
      });
      // Direct row poke to a hand-authored-shaped stamp (E13-AC4b convention
      // — storage.db is a plain runtime property; TS `private` is
      // compile-time only).
      storage.db
        .prepare("UPDATE handoff_state SET last_updated = ? WHERE workspace_path = ?")
        .run(SUSPECT_STAMP, dir);
      resetSession(dir);
      storage.readState(dir);
      assert.equal(storage.parse(dir).last_updated, SUSPECT_STAMP, "sanity: direct row poke landed the suspect stamp");

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "e18-sql-feat",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: [],
        pending_notes: ["pm continuing, no remediation note — SQLite mode ignores the suspect stamp"],
      });
      assert.ok(!result.isError, `SQLite mode must ignore the suspect stamp entirely: ${result.content?.[0]?.text}`);
      assert.doesNotMatch(result.content?.[0]?.text ?? "", /STAMP_PROVENANCE_SUSPECT/);
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

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
// Incident replay: reproduce the E5 identity-swap write shape EXACTLY — a
// legitimate APPROVED handoff (empty completed_tasks manifest) followed by a
// SECOND self-looped write, still stamped agent_id="qa-engineer", pre-filling
// completed_tasks with the real task ids and zero qa_reports evidence. Per
// docs/backlog.md incident (b): "a second tw_update_state as
// agent_id='qa-engineer' pre-filling completed_tasks T-E5-01/02/03 — before
// any qa-engineer ran, with zero evidence on disk." The second write's
// prevTuple is (qa-engineer, In_Progress) — the RESULT of the first write —
// not (code-reviewer, In_Progress), so it does NOT land on the exempt
// APPROVED-row edge (QAEV-4 above); this is exactly why the gate closes the
// hole the APPROVED-row exemption cannot: the incident write is a SELF-LOOP
// after the real handoff, not the handoff itself.
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

test("CONTENT-1: const-08 Stamp-Provenance bullet carries the (v3.86.0, E18) origin tag and the STAMP_PROVENANCE_SUSPECT code", () => {
  assert.match(
    CONST08,
    /\*\*Stamp-Provenance<!-- origin:start --> \(v3\.86\.0, E18\)<!-- origin:end -->\*\*/,
    "must locate the Stamp-Provenance bullet heading with its (v3.86.0, E18) origin tag",
  );
});

test("CONTENT-1b: const-08 Stamp-Provenance bullet body backtick-quotes STAMP_PROVENANCE_SUSPECT", () => {
  assert.match(
    CONST08,
    /\*\*Stamp-Provenance[\s\S]*?`STAMP_PROVENANCE_SUSPECT`/,
    "the Stamp-Provenance bullet must backtick-quote its own error code",
  );
});

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

test("CONTENT-3: skill-release-engineer.md carries the COORDINATOR-RELAYED hard line (E18) naming the v3.85.0 incident and the new server-side gate", () => {
  assert.match(
    SKILL_RELEASE_ENGINEER,
    /CRITICAL — Closing write is COORDINATOR-RELAYED; no dispatch brief can override this/,
    "must locate the E18 COORDINATOR-RELAYED hard line heading",
  );
  const lineMatch = SKILL_RELEASE_ENGINEER.match(/^-\s+\*\*CRITICAL — Closing write is COORDINATOR-RELAYED.*$/m);
  assert.ok(lineMatch, "must locate the full COORDINATOR-RELAYED bullet line");
  assert.ok(
    lineMatch[0].includes("outranks ANY dispatch brief"),
    "the hard line must state it outranks any dispatch brief instructing otherwise",
  );
  assert.ok(
    lineMatch[0].includes("STAMP_PROVENANCE_SUSPECT"),
    "the hard line must cross-reference the new server-side gate that now also catches this incident class",
  );
});

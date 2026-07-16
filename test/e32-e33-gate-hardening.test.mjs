// Coded by @qa-engineer
// Permanent regression coverage for backlog E32/E33 (T-E32-01, T-E33-01),
// specs/c16-c10-role-boundary.md "## Amendment — E32" section, and
// review_reports/review_T-E32-01.md (both rounds — round 1
// CHANGES_REQUESTED live-replay table + round 2 APPROVED live-replay table,
// including PROBE 6 "divergent attack surface" analysis).
//
// WHY THIS FILE EXISTS (not folded into e18-write-provenance.test.mjs /
// reviewer-completed-tasks-gate.test.mjs): those files' QAEV-4a/b and FM4/FM5
// tests were MODERNIZED (old assertion flipped) to match the amended
// contract; this file adds NET-NEW permanent regression pins for shapes that
// had no prior test at all — most importantly the exact incident replay this
// ticket exists to close. If this file's R1 test is ever accidentally
// deleted or weakened, the fourth E9A/E18-class incident (e-p3-tail-batch,
// 2026-07-16) can silently recur.
//
// Spec-to-test map (labels mirror code-reviewer's own round-2 live-replay
// table in review_reports/review_T-E32-01.md verbatim, for direct
// traceability):
//   R1 — exact incident replay (verdict carried, completed_tasks grown,
//     review_reports covers-file present, qa_reports ABSENT) -> REJECTED,
//     ledger unpolluted                                       -> R1 (PERMANENT PIN)
//   R2 — R1 minus review_verdict                              -> R2
//   R4 — verdict + growth + ZERO review evidence at all (no
//     review_reports either) — proves QA_COMPLETION_EVIDENCE_MISSING
//     fires independently of, and before, MISSING_REVIEW_EVIDENCE -> R4
//   C2 — amended compliant shape (review_task_ids, completed_tasks
//     empty) MINUS review evidence -> MISSING_REVIEW_EVIDENCE           -> C2
//   C3 — legit qa-engineer PASS with own qa_review auto-record
//     satisfies the completion-evidence gate for its own ids            -> C3
//   PROBE 6 — the two gates (QA_COMPLETION_EVIDENCE_MISSING /
//     MISSING_REVIEW_EVIDENCE) are orthogonal: divergent completed_tasks
//     vs review_task_ids id sets, each independently evidenced or not   -> P6a, P6b, P6c
//   Rejection-envelope content (E23 named-path posture): offending
//     ids, the expected qa_reports/review_<id>.md path(s) per id, and
//     the covers: fallback mention                                     -> ENV-1, ENV-2
//
// (C1 — compliant amended shape ACCEPTED — is covered by QAEV-4b in
// test/e18-write-provenance.test.mjs; C4 — carry-forward no-growth
// ACCEPTED — is covered by QAEV-3 in the same file. Not duplicated here.)

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";

function mkWs(prefix = "e32e33-") {
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

function writeQaEvidence(ws, taskId) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), `# QA review — ${taskId}\n\nPASS.\n`, "utf-8");
}

// Writes a SINGLE review_reports/ file carrying a `covers:` line naming
// every id in `taskIds` — mirrors the real e-p3-tail-batch incident shape
// (one batched code-review report covering all 6 T-ids via `covers:`,
// per review_reports/review_T-E32-01.md itself, which opens with
// `covers: T-E32-01, T-E33-01`).
function writeCodeReviewCoversFile(ws, primaryId, taskIds) {
  const dir = path.join(ws, "review_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `review_${primaryId}.md`),
    `# Review — ${primaryId} (batched)\n\ncovers: ${taskIds.join(", ")}\n\nAPPROVED.\n`,
    "utf-8",
  );
}

// ===========================================================================
// R1 — PERMANENT REGRESSION PIN: the exact e-p3-tail-batch incident shape.
// This is the incident review_reports/review_T-E32-01.md was filed to close
// (round-2 replay table, row R1). DO NOT weaken or delete this test without
// re-reading specs/c16-c10-role-boundary.md's Amendment section first.
// ===========================================================================

test("R1 (PERMANENT REGRESSION PIN): the exact e-p3-tail-batch incident — review_verdict=APPROVED carried, completed_tasks grown with the batch ids, review_reports covers-file present, qa_reports ABSENT — is REJECTED, ledger unpolluted", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-r1-");
  await seedFileState(ws, "r1-incident-feat", "code-reviewer", "In_Progress");
  const ids = ["T-R1-01", "T-R1-02", "T-R1-03"];
  // review_reports/ evidence present (covers-file, exactly like the real
  // incident's review_reports/review_T-E25-01.md) — deliberately NO
  // qa_reports/ evidence anywhere. Under the OLD (pre-amendment) exemption
  // this write was ACCEPTED because it rode the sanctioned edge; the
  // amendment removes that exemption entirely.
  writeCodeReviewCoversFile(ws, "T-R1-01", ids);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "r1-incident-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ids,
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED, handing to qa-engineer"],
  });
  assert.ok(
    result.isError,
    `THE INCIDENT MUST STAY CLOSED: this exact shape must be REJECTED: ${result.content?.[0]?.text}`,
  );
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  for (const id of ids) {
    assert.match(result.content[0].text, new RegExp(id), `rejection must name ${id}`);
  }
  assert.deepEqual(
    parseHandoff(ws).completed_tasks,
    [],
    "the ledger must stay unpolluted — nothing unsanctioned may persist (closes the two-step carry-forward evasion at the source)",
  );
});

test("R2: R1 minus review_verdict (verdict omitted) is still REJECTED, ledger unpolluted", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-r2-");
  await seedFileState(ws, "r2-incident-feat", "code-reviewer", "In_Progress");
  const ids = ["T-R2-01"];
  writeCodeReviewCoversFile(ws, "T-R2-01", ids);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "r2-incident-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ids,
    // review_verdict intentionally omitted
    pending_notes: ["code-reviewer: handing to qa-engineer"],
  });
  assert.ok(result.isError, `R2 must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(parseHandoff(ws).completed_tasks, []);
});

test("R4: verdict + completed_tasks growth + ZERO review evidence anywhere is REJECTED by QA_COMPLETION_EVIDENCE_MISSING (fires independently of, and before, MISSING_REVIEW_EVIDENCE)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-r4-");
  await seedFileState(ws, "r4-incident-feat", "code-reviewer", "In_Progress");
  // No review_reports/ AND no qa_reports/ at all.
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "r4-incident-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-R4-01"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: handing to qa-engineer"],
  });
  assert.ok(result.isError, `R4 must be REJECTED: ${result.content?.[0]?.text}`);
  // QA_COMPLETION_EVIDENCE_MISSING runs FIRST in the orchestrator (before
  // MISSING_REVIEW_EVIDENCE) — this is the error the writer actually sees.
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(parseHandoff(ws).completed_tasks, []);
});

// ===========================================================================
// C2 — amended compliant shape (review_task_ids, completed_tasks empty)
// MINUS review evidence -> MISSING_REVIEW_EVIDENCE. Confirms the re-pointed
// gate did NOT go dead: the amendment closes R1 without disabling review
// evidence enforcement. (Same underlying shape as the modernized FM4 in
// test/reviewer-completed-tasks-gate.test.mjs; pinned again here under the
// review's own "C2" label for 1:1 traceability against
// review_reports/review_T-E32-01.md's round-2 replay table.)
// ===========================================================================

test("C2: amended shape (review_task_ids, completed_tasks empty) minus review evidence is REJECTED by MISSING_REVIEW_EVIDENCE — the re-pointed gate is still alive", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-c2-");
  await seedFileState(ws, "c2-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c2-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-C2-01"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED, handing to qa-engineer"],
  });
  assert.ok(result.isError, `C2 must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /MISSING_REVIEW_EVIDENCE/);
  assert.ok(
    !result.content[0].text.includes("QA_COMPLETION_EVIDENCE_MISSING"),
    "completed_tasks is empty — the completion-evidence gate must not fire at all",
  );
});

// ===========================================================================
// C3 — legit qa-engineer PASS with its own qa_review auto-record. The
// completion-evidence gate (handoff-orchestrator.ts:753) runs AFTER the
// qa_review auto-record (:701-703), so a genuine PASS write satisfies its
// own evidence requirement in the SAME write, with no pre-existing
// qa_reports/ file needed.
// ===========================================================================

test("C3: legit qa-engineer PASS write with qa_review (auto-recorded as its own evidence) is ACCEPTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-c3-");
  await seedFileState(ws, "c3-feat", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c3-feat",
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T-C3-01"],
    review_task_ids: ["T-C3-01"],
    qa_review: "All ACs verified; tests green.",
    pending_notes: ["QA: T-C3-01 PASS"],
  });
  assert.ok(!result.isError, `a legit PASS with its own qa_review must be ACCEPTED: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-C3-01"]);
});

// ===========================================================================
// PROBE 6 — divergent-field matrix: can a writer evade one gate by stuffing
// the OTHER field with evidenced ids while the first field grows with
// DIFFERENT unevidenced ids? review_reports/review_T-E32-01.md round 2
// confirms: no — the two gates are orthogonal, each demanding its own
// evidence directory. These three tests pin that conclusion permanently.
// ===========================================================================

test("P6a: review_task_ids=[A] (evidenced via review_reports) but completed_tasks grows with [B] (NO qa_reports) -> REJECTED QA_COMPLETION_EVIDENCE_MISSING, ledger []", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-p6a-");
  await seedFileState(ws, "p6a-feat", "code-reviewer", "In_Progress");
  writeCodeReviewCoversFile(ws, "T-P6A-A", ["T-P6A-A"]);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "p6a-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-P6A-B"], // divergent — no qa_reports evidence
    review_task_ids: ["T-P6A-A"], // has review_reports evidence
    review_verdict: "APPROVED",
    pending_notes: ["divergent-field probe P6a"],
  });
  assert.ok(result.isError, `P6a must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.match(result.content[0].text, /T-P6A-B/, "must name the unevidenced completed_tasks id");
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "review_task_ids evidence must NOT substitute for completed_tasks evidence");
});

test("P6b: completed_tasks=[A] (evidenced via qa_reports) but review_task_ids=[B] (NO review_reports) -> REJECTED MISSING_REVIEW_EVIDENCE, ledger []", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-p6b-");
  await seedFileState(ws, "p6b-feat", "code-reviewer", "In_Progress");
  writeQaEvidence(ws, "T-P6B-A");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "p6b-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-P6B-A"], // has qa_reports evidence
    review_task_ids: ["T-P6B-B"], // divergent — no review_reports evidence
    review_verdict: "APPROVED",
    pending_notes: ["divergent-field probe P6b"],
  });
  assert.ok(result.isError, `P6b must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /MISSING_REVIEW_EVIDENCE/);
  assert.match(result.content[0].text, /T-P6B-B/, "must name the unevidenced review_task_ids id");
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "completed_tasks evidence must NOT substitute for review_task_ids evidence — the write is rejected before it can land");
});

test("P6c: both fields diverge but BOTH are fully evidenced -> ACCEPTED, ledger carries only the completed_tasks id (neither field's evidence substitutes for the other's — this is the design working, not a hole)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-p6c-");
  await seedFileState(ws, "p6c-feat", "code-reviewer", "In_Progress");
  writeQaEvidence(ws, "T-P6C-A");
  writeCodeReviewCoversFile(ws, "T-P6C-B", ["T-P6C-B"]);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "p6c-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-P6C-A"], // has qa_reports evidence
    review_task_ids: ["T-P6C-B"], // has review_reports evidence
    review_verdict: "APPROVED",
    pending_notes: ["divergent-field probe P6c"],
  });
  assert.ok(!result.isError, `P6c must be ACCEPTED — each field is independently, genuinely evidenced: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-P6C-A"]);
});

// ===========================================================================
// Rejection-envelope content (E23 named-path posture): the
// QA_COMPLETION_EVIDENCE_MISSING envelope must name the offending id(s), the
// EXACT expected qa_reports/review_<id>.md path per offending id (the same
// sanitised path hasEvidenceInFile checked — via the exported qaEvidencePath
// wrapper), and mention the covers: fallback — so a writer fixing the
// rejection knows precisely which artifact clears the gate.
// ===========================================================================

test("ENV-1: QA_COMPLETION_EVIDENCE_MISSING envelope names each offending id and its exact expected qa_reports/review_<id>.md path", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-env1-");
  await seedFileState(ws, "env1-feat", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "env1-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-ENV1-01", "T-ENV1-02"],
    pending_notes: ["envelope-content probe"],
  });
  assert.ok(result.isError);
  const text = result.content[0].text;
  assert.match(text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.match(text, /T-ENV1-01/);
  assert.match(text, /T-ENV1-02/);
  assert.match(text, /Expected evidence file\(s\):/);
  assert.match(
    text,
    new RegExp(`qa_reports[/\\\\]review_T-ENV1-01\\.md`),
    "envelope must name the exact expected per-id evidence path",
  );
  assert.match(
    text,
    new RegExp(`qa_reports[/\\\\]review_T-ENV1-02\\.md`),
    "envelope must name the exact expected per-id evidence path for EVERY offending id, not just the first",
  );
});

test("ENV-2: QA_COMPLETION_EVIDENCE_MISSING envelope mentions the covers: fallback (a writer may clear it via a covering report instead of a per-id file)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-env2-");
  await seedFileState(ws, "env2-feat", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "env2-feat",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-ENV2-01"],
    pending_notes: ["envelope-content probe"],
  });
  assert.ok(result.isError);
  assert.match(
    result.content[0].text,
    /covers: line/,
    "envelope must mention the covers: fallback, not just the per-id file path",
  );
});

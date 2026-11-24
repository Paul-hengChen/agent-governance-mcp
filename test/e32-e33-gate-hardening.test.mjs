// Coded by @qa-engineer
// Permanent regression coverage: a state write may only mark tasks complete when
// each has its own judge evidence file under qa_reports/; a review_reports/ file alone
// is not enough, and the judge's APPROVED write has no exemption
// (specs/c16-c10-role-boundary.md, Amendment — E32). E435: code-reviewer is the judge and
// the only ledger writer, so every ledger write below is a code-reviewer self-loop; the old
// code-reviewer -> qa-engineer hand-off is not an edge (TRANSITION_REJECTED + S3 hint).
// Rationale: specs/e260g-comment-rationale.md (test/e32-e33-gate-hardening.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

// Copy hint.reviewer_to_qa + hint.in_flight (specs/e435-remove-old-path-architecture.md).
const REVIEWER_TO_QA_HINT =
  " code-reviewer is the judge and closes the feature: approve with code-reviewer:PASS (review_verdict: \"APPROVED\"), or reject with code-reviewer:FAIL; qa-engineer does not follow code-reviewer." +
  " If this feature started on the pre-v5 chain, docs/migration-v5.md says how to finish or restart it.";

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
  // Pin the seed's last_updated to a fixed stamp (test/e148-seed-stamp.mjs) so the
  // made-up-timestamp check cannot fire at random on a genuine seed. Call it before
  // the caller's own resetSession/markStateRead re-snapshot.
  forceSeedStamp(ws);
}

function writeQaEvidence(ws, taskId) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), `# QA review — ${taskId}\n\nPASS.\n`, "utf-8");
}

// Writes a SINGLE review_reports/ file carrying a `covers:` line naming
// every id in `taskIds`. This matches the real incident, where one batched
// code-review report listed every task of the batch on its `covers:` line.
// (e-p3-tail-batch)
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
// PERMANENT REGRESSION PIN: replays the real incident. A code-reviewer write with an
// APPROVED verdict grows completed_tasks while only a code-review report exists; it
// must be rejected and the ledger left untouched. Do not weaken or delete without
// re-reading specs/c16-c10-role-boundary.md (Amendment — E32).
// ===========================================================================

test("R1 (PERMANENT REGRESSION PIN, E435): the e-p3-tail-batch incident on the judge's own write — code-reviewer APPROVED self-loop, completed_tasks grown with the batch ids, review_reports covers-file present, qa_reports ABSENT — is REJECTED, ledger unpolluted", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-r1-");
  await seedFileState(ws, "r1-incident-feat", "code-reviewer", "In_Progress");
  const ids = ["T-R1-01", "T-R1-02", "T-R1-03"];
  // A review_reports/ covers-file is present, as in the real incident, and
  // deliberately there is NO qa_reports/ evidence anywhere. The judge's own
  // APPROVED verdict must not exempt the write from needing its report.
  writeCodeReviewCoversFile(ws, "T-R1-01", ids);
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "r1-incident-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ids,
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
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

test("R2 (E435): R1 minus review_verdict (verdict omitted) is still REJECTED, ledger unpolluted", async () => {
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
    agent_id: "code-reviewer",
    completed_tasks: ids,
    // review_verdict intentionally omitted
    pending_notes: ["code-reviewer: reviewing"],
  });
  assert.ok(result.isError, `R2 must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(parseHandoff(ws).completed_tasks, []);
});

test("R4 (E435): the judge's verdict + completed_tasks growth + ZERO evidence anywhere is REJECTED by QA_COMPLETION_EVIDENCE_MISSING; the hint names the judge and both repair routes", async () => {
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
    agent_id: "code-reviewer",
    completed_tasks: ["T-R4-01"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(result.isError, `R4 must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.deepEqual(parseHandoff(ws).completed_tasks, []);
  // E418 hint sufficiency: const-08 keeps the rule short; the hint must carry the evidence locations
  // and both repair routes (record the judge's report, or drop the unevidenced ids). E435 Copy hintStatic.
  const hintText = result.content[0].text;
  assert.match(hintText, /qa_reports\/review_<id>\.md/, "hint names the per-id evidence file");
  assert.match(hintText, /covers:/, "hint names the covers: batch form");
  assert.match(hintText, /review_task_ids/, "hint names the review_task_ids route");
  assert.match(hintText, /code-reviewer is the judge: write its report for each newly added id first/, "hint names the judge");
  assert.match(hintText, /No exemption for any edge, status, or review_verdict\./, "hint states no APPROVED exemption");
});

// ===========================================================================
// E435: the compliant shape (review_task_ids set, completed_tasks empty) stamped
// qa-engineer after code-reviewer:In_Progress rode the removed edge; it is now
// TRANSITION_REJECTED with the S3 hint before any evidence gate (MISSING_REVIEW_EVIDENCE
// is dormant: its only edge is gone; also FM4 in test/reviewer-completed-tasks-gate.test.mjs).
// ===========================================================================

test("C2 (E435): the old APPROVED hand-off shape (qa-engineer after code-reviewer:In_Progress) is TRANSITION_REJECTED with the S3 hint, no evidence gate reached", async () => {
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
  assert.match(result.content[0].text, /TRANSITION_REJECTED/);
  assert.ok(result.content[0].text.includes(REVIEWER_TO_QA_HINT), `S3 hint: ${result.content[0].text}`);
  assert.ok(!result.content[0].text.includes("MISSING_REVIEW_EVIDENCE"), "the dormant review-evidence gate is never reached");
  assert.ok(
    !result.content[0].text.includes("QA_COMPLETION_EVIDENCE_MISSING"),
    "completed_tasks is empty — the completion-evidence gate must not fire at all",
  );
});

// ===========================================================================
// A genuine judge (code-reviewer) PASS write with a qa_review is accepted (E435). The
// completion-evidence check in tools/handoff-orchestrator.ts runs after the
// qa_review is auto-recorded as a report, so the write supplies its own
// evidence in the SAME write, with no qa_reports/ file needed beforehand.
// (C3)
// ===========================================================================

test("C3 (E435): legit code-reviewer PASS write with qa_review (auto-recorded as its own evidence) is ACCEPTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-c3-");
  await seedFileState(ws, "c3-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c3-feat",
    status: "PASS",
    agent_id: "code-reviewer",
    completed_tasks: ["T-C3-01"],
    review_task_ids: ["T-C3-01"],
    qa_review: "All ACs verified; tests green.",
    pending_notes: ["code-reviewer: T-C3-01 PASS"],
  });
  assert.ok(!result.isError, `a legit PASS with its own qa_review must be ACCEPTED: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-C3-01"]);
});

// ===========================================================================
// Can a writer slip past one check by filling the OTHER field with
// evidenced ids while the first field grows with DIFFERENT ids that have no
// evidence? No: evidence for a review_task_ids id never backs a different
// completed_tasks id. E435: the ledger writer is the judge (code-reviewer); the old
// qa-engineer row on code-reviewer:In_Progress is not an edge. (PROBE 6)
// ===========================================================================

test("P6a (E435): the judge's review_task_ids=[A] (evidenced) but completed_tasks grows with [B] (NO qa_reports) -> REJECTED QA_COMPLETION_EVIDENCE_MISSING, ledger []", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-p6a-");
  await seedFileState(ws, "p6a-feat", "code-reviewer", "In_Progress");
  writeCodeReviewCoversFile(ws, "T-P6A-A", ["T-P6A-A"]);
  writeQaEvidence(ws, "T-P6A-A");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "p6a-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-P6A-B"], // divergent — no qa_reports evidence
    review_task_ids: ["T-P6A-A"], // has qa_reports and review_reports evidence
    review_verdict: "APPROVED",
    pending_notes: ["divergent-field probe P6a"],
  });
  assert.ok(result.isError, `P6a must be REJECTED: ${result.content?.[0]?.text}`);
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.match(result.content[0].text, /T-P6A-B/, "must name the unevidenced completed_tasks id");
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "review_task_ids evidence must NOT substitute for completed_tasks evidence");
});

test("P6b (E435): completed_tasks=[A] (evidenced) + review_task_ids=[B] (NO review_reports) stamped qa-engineer after code-reviewer:In_Progress -> TRANSITION_REJECTED, ledger []", async () => {
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
  assert.match(result.content[0].text, /TRANSITION_REJECTED/, "the removed code-reviewer -> qa-engineer step fails at step 1, before any ledger or evidence gate");
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "a non-judge ledger write is rejected before it can land");
});

test("P6c (E435): the judge's write with both fields diverging and BOTH fully evidenced -> ACCEPTED, ledger carries only the completed_tasks id (review scope stays out of the ledger)", async () => {
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
    agent_id: "code-reviewer",
    completed_tasks: ["T-P6C-A"], // has qa_reports evidence
    review_task_ids: ["T-P6C-B"], // has review_reports evidence
    review_verdict: "APPROVED",
    pending_notes: ["divergent-field probe P6c"],
  });
  assert.ok(!result.isError, `P6c must be ACCEPTED — each field is independently, genuinely evidenced: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-P6C-A"]);
});

// ===========================================================================
// The QA_COMPLETION_EVIDENCE_MISSING rejection must name each offending id, the exact
// expected qa_reports/review_<id>.md path (via the exported qaEvidencePath wrapper)
// and the covers: fallback, so a writer knows which file to add.
// ===========================================================================

test("ENV-1 (E435): QA_COMPLETION_EVIDENCE_MISSING envelope on the judge's write names each offending id and its exact expected qa_reports/review_<id>.md path", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-env1-");
  await seedFileState(ws, "env1-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "env1-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
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

test("ENV-2 (E435): QA_COMPLETION_EVIDENCE_MISSING envelope on the judge's write mentions the covers: fallback (a writer may clear it via a covering report instead of a per-id file)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs("e32e33-env2-");
  await seedFileState(ws, "env2-feat", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "env2-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
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

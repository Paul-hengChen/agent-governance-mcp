// Coded by @qa-engineer
// Scenario tests for specs/e448-judge-evidence-checks.md AC1-AC4 (E448) and AC19-AC20 (E458 item 8).
// Invariant (E448): the judge's PASS is the last line of defence, so the code-review evidence check
// (MISSING_REVIEW_EVIDENCE, pipeline step 17) arms on the file-mode code-reviewer PASS write itself — not on
// the code-reviewer -> qa-engineer hand-off v5 removed. A PASS whose review scope has no review_reports/ file
// is refused, no state is written and the same write's qa_review auto-record is undone. SQLite stays exempt
// (nothing writes code-review rows there).
// Invariant (E458 item 8): every gate hint names only things an adopter can find in their own workspace — no
// path into this repo's specs/, docs/, content/, gates/... tree and no bare ticket id.
// Tests drive the real tool entries (TOOL_REGISTRY.run -> zod + orchestrator) against temp workspaces under
// os.tmpdir(), so each outcome is the one a client sees. Hint texts are the cut's Copy / Strings, frozen here.

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
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { GATE_REGISTRY } from "../dist/gates/registry.js";
import { UPDATE_STATE_GATE_PIPELINE } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

let SqliteHandoffStorage = null;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite e448 AC3 case skipped");
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

// ---------------------------------------------------------------- Copy / Strings (spec, verbatim)

const HINT = {
  TRANSITION_REJECTED: " in ALLOWED_TRANSITIONS; pick a next state from the allowed list in this rejection.",
  SCOPE_DECISION_REQUIRED:
    "Scope decision missing. Either: (a) create .current/feature-split.md documenting the multi-feature split decision, or (b) set scope_decision: single-feature in this tw_update_state call with a why field explaining why this feature is appropriately scoped. Gate only fires when design/<feature>.md declares mode != no-design.",
  CUT_APPROVAL_REQUIRED:
    "Cut approval missing. PM must present the ticket cut inline in chat and obtain human approval before routing to build. Set cut_approved: true on the pm:In_Progress write after approval (pm SOP, Cut-Approval Gate).",
  EXTERNAL_REFS_UNRESOLVED:
    " Each entry in external_refs must be fetched, indexed, or user-confirmed-ignorable before routing to build (pm SOP, Resource Audit Gate).",
  SOURCE_CREDIBILITY_UNVERIFIED:
    " Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry credibility: full-page-composite in the ## Source manifest before routing to build (design-auditor SOP, step 2b).",
  FEATURE_LEASE_HELD:
    "A second feature cannot take the workspace slot while the incumbent feature's lease is live (per-workspace mutual exclusion: at most one non-terminal feature per workspace_path). Wait for the incumbent to reach PASS or for its lease to expire, or run the new feature in a separate git worktree (distinct workspace_path).",
  LEASE_OVERRIDE_AUDIT_MISSING:
    "A lease_override write must carry its human-attested audit line: prepend a \"lease-override: <reason>\" note as pending_notes[0].",
  QA_COMPLETION_EVIDENCE_MISSING:
    "code-reviewer is the judge: write its report for each newly added id first (qa_review with review_task_ids on a PASS/FAIL write, or qa_reports/review_<id>.md or a covers: file), or drop the unevidenced ids from completed_tasks. No exemption for any edge, status, or review_verdict.",
  REPRO_MANIFEST_MISSING:
    "Bugfix-mode fix cannot hand off to code-reviewer until qa_reports/expected-red_<feature>.txt records the failing reproduction test(s) proven red before the fix (skill-sr-engineer). If repro is infeasible, escalate status=Blocked to pm instead.",
  VISUAL_PROVENANCE_MISSING:
    "Each diffed surface in qa_reports/visual_<id>.md must carry a baseline: fingerprint and a diff-metric: value in its prose sub-section under ## Region Diff. Carry-forward surfaces (annotated \"pass (carried forward — git diff confirms source untouched)\") are exempt; \"B1 tool unavailable — LLM fallback\" satisfies the diff-metric requirement.",
  BASELINE_MANIFEST_MISSING:
    "⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections).",
  BASELINE_PROVENANCE_INCOMPLETE:
    "⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c.",
  PIXEL_GATE_ATTESTATION_MISSING:
    "Each non-carry-forward surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward surfaces are exempt.",
  REVIEW_VERDICT_STATUS_MISMATCH:
    "A code-reviewer APPROVED verdict requires status=PASS or In_Progress; CHANGES_REQUESTED requires status=FAIL. Align review_verdict with status, or omit review_verdict.",
  NON_JUDGE_COMPLETED_TASKS_REJECTED:
    "completed_tasks on a write not stamped agent_id=code-reviewer is ledger pollution: only code-reviewer, the chain's judge, may grow completed_tasks (or complete tasks through tw_complete_task), backed by the QA_COMPLETION_EVIDENCE_MISSING evidence gate. Omit completed_tasks (or pass []) on this write.",
  NON_REVIEWER_VERDICT_REJECTED:
    "review_verdict is the code-reviewer's verdict field: only an agent_id=code-reviewer write may carry it. Omit review_verdict on this write.",
  AC_EXECUTION_LOG_MISSING:
    "Run the AC Execution step (skill-code-reviewer) — execute each proof:-annotated AC in specs/<feature>.md and record command, raw output/exit code, and a per-AC pass/fail verdict under a ## AC Execution Log section in a qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count; the heading may carry a prefix/suffix but must contain the canonical name, evidence schema v2) before PASS. The server checks the section's presence only — the proofs' truthfulness stays with the judge.",
  PASS_TASKS_INCOMPLETE:
    "A code-reviewer PASS must account for every open task in the feature's lane ledger: add each listed id to completed_tasks with its QA evidence (a covers: line counts), or void a dropped task with tw_void_task, then retry the PASS. Rows whose description starts with release-engineer or doc-writer (post-PASS work) are exempt.",
};
// hint.missing_review_evidence (E448 ruling (a)).
const HINT_MISSING_REVIEW_EVIDENCE =
  "Code-reviewer evidence missing: write review_reports/review_<task-id>.md for each reviewed id (or one report whose covers: line names them) before the code-reviewer PASS write.";
// Architecture (3): the registry entry's exact new metadata.
const MRE_TRIGGER_EDGE =
  "status=PASS write by code-reviewer (the judge), whatever the previous state, with review scope (review_task_ids if non-empty, else completed_tasks); file-mode only";
const MRE_ARM_CONDITION =
  "agent_id === resolveJudgeReport().judge && status === PASS && hasCodeReviewEvidence(reviewScopeIds).missing non-empty; FileHandoffStorage only";
const MRE_CLEARING = "review_reports/review_<id>.md (or a covers: file) for every id in review scope";

// The 17 pipeline step names, in order (unchanged by this cut).
const PIPELINE_NAMES = [
  "TRANSITION_VALIDATION", "FEATURE_LEASE", "SCOPE_DECISION_REQUIRED", "CUT_APPROVAL_REQUIRED",
  "EXTERNAL_REFS_UNRESOLVED", "SOURCE_CREDIBILITY_UNVERIFIED", "REPRO_MANIFEST_MISSING",
  "REVIEW_VERDICT_STATUS_MISMATCH", "NON_JUDGE_COMPLETED_TASKS_REJECTED", "QA_REVIEW_RECORD",
  "QA_COMPLETION_EVIDENCE_MISSING", "PASS_TASKS_INCOMPLETE", "PASS_MISSING_EVIDENCE",
  "PASS_VISUAL_SUBGATES", "PASS_EXPECTED_RED_DIFF", "PASS_AC_EXECUTION_LOG", "MISSING_REVIEW_EVIDENCE",
];

// ---------------------------------------------------------------- harness

function mkWs(prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanup.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}
const put = (ws, rel, body) => {
  fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
  fs.writeFileSync(path.join(ws, rel), body);
};
const readRel = (ws, rel) => fs.readFileSync(path.join(ws, rel), "utf-8");
const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");
const handoffBytes = (ws) =>
  fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8").replace(/^last_updated:.*$/m, "last_updated: <pinned>");
const state = (ws) => new FileHandoffStorage().parse(ws);

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

const F = "e448-feat";
const w = (agent, status, extra = {}) => ({ active_feature: F, status, agent_id: agent, ...extra });

// A hand-written judge report head: no verdict section, no expected-red manifest, no proof: spec, no design —
// so the PASS write's own qa_review auto-record (a server PASS section) clears every PASS gate except
// the code-review evidence check under test.
const QA_HEAD = (id) => `# QA review — ${id}\n\nAll scenarios exercised.\n`;
const SERVER_PASS = (by = "code-reviewer") => `\n## 2026-11-20T00:00:00.000Z — PASS — by ${by}\n\nall ACs pass\n`;

async function judgeWs(prefix, { qa = {}, review = {} } = {}) {
  const ws = mkWs(prefix);
  await seed(ws, F, "code-reviewer", "In_Progress");
  for (const [id, body] of Object.entries(qa)) put(ws, `qa_reports/review_${id}.md`, body);
  for (const [name, body] of Object.entries(review)) put(ws, `review_reports/${name}`, body);
  return ws;
}

// ---------------------------------------------------------------- AC1

test("AC1: file-mode code-reviewer PASS with no review_reports/ file -> MISSING_REVIEW_EVIDENCE naming T1, hint.missing_review_evidence, no state written, auto-recorded section undone", async () => {
  // Why: the served rule says approval needs a code-review report; before E448 the check armed only on the
  // removed code-reviewer -> qa-engineer hand-off, so a PASS with no review report at all slipped through.
  const ws = await judgeWs("e448-ac1-", { qa: { T1: QA_HEAD("T1") } });
  assert.ok(!fs.existsSync(path.join(ws, "review_reports")), "fixture: no review_reports/ directory");
  const before = handoffBytes(ws);
  const reportBefore = readRel(ws, "qa_reports/review_T1.md");
  const r = await upd(ws, w("code-reviewer", "PASS", {
    completed_tasks: ["T1"], review_verdict: "APPROVED", qa_review: "every AC re-run and green",
  }));
  assert.ok(rejected(r), `judge PASS without a code-review report must be refused: ${text(r)}`);
  assert.ok(text(r).startsWith("⛔ MISSING_REVIEW_EVIDENCE: T1. "), `names T1: ${text(r)}`);
  assert.ok(text(r).endsWith(HINT_MISSING_REVIEW_EVIDENCE), `ends with hint.missing_review_evidence: ${text(r)}`);
  assert.equal(handoffBytes(ws), before, "no state written");
  assert.equal(state(ws).status, "In_Progress");
  assert.equal(readRel(ws, "qa_reports/review_T1.md"), reportBefore, "the same write's qa_review auto-record is undone");
});

// ---------------------------------------------------------------- AC2

test("AC2: the same PASS with review_reports/review_T1.md (any content) is accepted; one covers: T1, T2 report clears a PASS over [T1, T2]", async () => {
  // Why: the check is about the presence of the judge's code-review record, not its wording.
  const ws = await judgeWs("e448-ac2a-", { qa: { T1: QA_HEAD("T1") }, review: { "review_T1.md": "x\n" } });
  const r = await upd(ws, w("code-reviewer", "PASS", {
    completed_tasks: ["T1"], review_verdict: "APPROVED", qa_review: "every AC re-run and green",
  }));
  assert.ok(!rejected(r), `with a review report the PASS is accepted: ${text(r)}`);
  assert.equal(state(ws).status, "PASS");

  const ws2 = await judgeWs("e448-ac2b-", {
    qa: { T1: QA_HEAD("T1"), T2: QA_HEAD("T2") },
    review: { "review_T1.md": "# Code review\n\ncovers: T1, T2\n\nVerdict: APPROVED\n" },
  });
  const r2 = await upd(ws2, w("code-reviewer", "PASS", {
    completed_tasks: ["T1", "T2"], review_verdict: "APPROVED", qa_review: "both tasks judged",
  }));
  assert.ok(!rejected(r2), `a single covers: report clears both ids: ${text(r2)}`);
  assert.equal(state(ws2).status, "PASS");
});

test("AC2: review scope is review_task_ids when non-empty, else completed_tasks", async () => {
  // Why: scope follows the qa_review target rule, so carry-forward ids on a write are still checked.
  // (a) review_task_ids [T1] narrows the scope: T2 (completed, with its own server PASS judge report) needs no code-review file.
  const a = await judgeWs("e448-ac2c-", {
    qa: { T1: QA_HEAD("T1"), T2: QA_HEAD("T2") + SERVER_PASS() },
    review: { "review_T1.md": "x\n" },
  });
  const ra = await upd(a, w("code-reviewer", "PASS", {
    completed_tasks: ["T1", "T2"], review_task_ids: ["T1"], review_verdict: "APPROVED", qa_review: "T1 judged",
  }));
  assert.ok(!rejected(ra), `scope = review_task_ids [T1], which has its review report: ${text(ra)}`);

  // (b) no review_task_ids: scope = completed_tasks [T1, T2]; only T1 has a code-review file -> T2 named alone.
  const b = await judgeWs("e448-ac2d-", {
    qa: { T1: QA_HEAD("T1"), T2: QA_HEAD("T2") },
    review: { "review_T1.md": "x\n" },
  });
  const before = handoffBytes(b);
  const rb = await upd(b, w("code-reviewer", "PASS", {
    completed_tasks: ["T1", "T2"], review_verdict: "APPROVED", qa_review: "both judged",
  }));
  assert.ok(rejected(rb), `T2 has no code-review report: ${text(rb)}`);
  assert.ok(text(rb).startsWith("⛔ MISSING_REVIEW_EVIDENCE: T2. "), `names only T2: ${text(rb)}`);
  assert.equal(handoffBytes(b), before, "no state written");
});

// ---------------------------------------------------------------- AC3

test("AC3: SQLite judge PASS with no code-review rows is accepted; registry 33, pipeline 17 names unchanged, MISSING_REVIEW_EVIDENCE stays step 17", async (t) => {
  // Why: nothing writes code-review rows in SQLite mode, so arming the check there would refuse every PASS.
  assert.equal(GATE_REGISTRY.length, 33);
  assert.deepEqual(UPDATE_STATE_GATE_PIPELINE.map((s) => s.name), PIPELINE_NAMES);
  assert.equal(UPDATE_STATE_GATE_PIPELINE[16].name, "MISSING_REVIEW_EVIDENCE", "step 17 is the code-review evidence step");
  assert.deepEqual(UPDATE_STATE_GATE_PIPELINE[16].codes, ["MISSING_REVIEW_EVIDENCE"]);

  if (!SqliteHandoffStorage) return t.skip("better-sqlite3 not installed");
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e448-ac3-sq-")));
  cleanup.push(dir);
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  try {
    setActiveStorage(storage);
    await storage.writeState({ workspacePath: dir, activeFeature: F, status: "In_Progress", completedTasks: [], pendingNotes: ["seed"], lastAgent: "code-reviewer" });
    resetSession(dir);
    storage.readState(dir);
    let r;
    try {
      r = await UPD.run({ workspace_path: dir, pending_notes: [], ...w("code-reviewer", "PASS", {
        completed_tasks: ["T1"], review_verdict: "APPROVED", qa_review: "judged in SQLite mode",
      }) });
    } catch (err) {
      r = { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] };
    }
    assert.ok(!rejected(r), `SQLite judge PASS accepted with no code-review rows: ${text(r)}`);
    assert.equal(storage.parse(dir)?.status, "PASS");
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch { /* best effort */ }
  }
});

// ---------------------------------------------------------------- AC4

test("AC4: MISSING_REVIEW_EVIDENCE registry entry carries hint.missing_review_evidence and a triggerEdge naming the code-reviewer PASS write; the step's comment no longer names a qa-engineer hand-off", () => {
  // Why: the registry is the documented contract of each code; it must describe where the check really arms.
  const g = GATE_REGISTRY.find((x) => x.errorCode === "MISSING_REVIEW_EVIDENCE");
  assert.ok(g, "entry present");
  assert.equal(g.hintStatic, HINT_MISSING_REVIEW_EVIDENCE, "hint.missing_review_evidence verbatim");
  assert.equal(g.triggerEdge, MRE_TRIGGER_EDGE, "triggerEdge names the code-reviewer PASS write");
  assert.equal(g.armCondition, MRE_ARM_CONDITION);
  assert.equal(g.clearingArtifact, MRE_CLEARING);
  assert.doesNotMatch(g.triggerEdge, /qa-engineer/, "no qa-engineer hand-off in the trigger edge");
  assert.equal(g.producer, "orchestrator");
  assert.equal(g.envelope, "plain-text");
  assert.equal(g.documentedInProse, true);

  const src = fs.readFileSync(path.join(ROOT, "tools", "handoff-orchestrator.ts"), "utf-8");
  const at = src.indexOf('name: "MISSING_REVIEW_EVIDENCE"');
  assert.ok(at > 0, "step located");
  const end = src.indexOf("\n];", at);
  assert.ok(end > at, "end of the pipeline array located");
  const step = src.slice(at, end);
  assert.doesNotMatch(step, /qa-engineer/, `the step (code and comments) no longer names a qa-engineer hand-off:\n${step}`);
  assert.match(step, /\bPASS\b/, "the step arms on a PASS write");
});

// ---------------------------------------------------------------- AC19

test("AC19: the 18 E458 (8) hints equal their Copy / Strings text verbatim", () => {
  // Why: a rejection hint is what an adopter reads to fix the write; it must not send them to files that
  // exist only in this repo.
  assert.equal(Object.keys(HINT).length, 18, "the 18 codes of the cut");
  const live = Object.fromEntries(GATE_REGISTRY.map((g) => [g.errorCode, g]));
  for (const [code, want] of Object.entries(HINT)) {
    assert.ok(live[code], `${code} registered`);
    assert.equal(live[code].hintStatic, want, `${code} hintStatic is its Copy text`);
  }
});

// ---------------------------------------------------------------- AC20

// A repo-relative path under one of these trees, unless the path continues with a `<placeholder>` the
// adopter's own roles write (e.g. specs/<feature>.md).
const REPO_PATH_RE = /(?<![\w./-])(specs|docs|content|gates|tools|test|research|scripts)\/([^\s,;:)"'`]*)/g;
const TICKET_ID_RE = /\bE\d{1,4}\b/;
function repoPathsIn(s) {
  return [...s.matchAll(REPO_PATH_RE)].filter((m) => !m[2].startsWith("<")).map((m) => m[0]);
}

test("AC20: no hintStatic in GATE_REGISTRY names a workspace-relative repo path or a bare ticket id", () => {
  // Scanner sanity: it flags the base defects and spares the placeholder path.
  assert.deepEqual(repoPathsIn("See specs/e1-feature-scoped-state-design.md."), ["specs/e1-feature-scoped-state-design.md."]);
  assert.deepEqual(repoPathsIn("(gates/lease-override.ts)"), ["gates/lease-override.ts"]);
  assert.deepEqual(repoPathsIn("execute each AC in specs/<feature>.md and"), []);
  assert.deepEqual(repoPathsIn("qa_reports/review_<id>.md and design/<feature>.md"), []);
  assert.ok(TICKET_ID_RE.test("See docs/backlog.md E40."));
  // Every Copy text is itself clean (vacuity guard on the frozen strings).
  for (const [code, s] of Object.entries({ ...HINT, MISSING_REVIEW_EVIDENCE: HINT_MISSING_REVIEW_EVIDENCE })) {
    assert.deepEqual(repoPathsIn(s), [], `${code} Copy text`);
    assert.doesNotMatch(s, TICKET_ID_RE, `${code} Copy text`);
  }

  assert.equal(GATE_REGISTRY.length, 33);
  const offenders = [];
  for (const g of GATE_REGISTRY) {
    const paths = repoPathsIn(g.hintStatic);
    const ids = g.hintStatic.match(new RegExp(TICKET_ID_RE.source, "g")) ?? [];
    if (paths.length || ids.length) offenders.push(`${g.errorCode}: ${[...paths, ...ids].join(", ")}`);
  }
  assert.deepEqual(offenders, [], `hints naming repo-only paths or ticket ids:\n${offenders.join("\n")}`);
});

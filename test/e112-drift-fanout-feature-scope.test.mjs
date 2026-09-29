// Coded by @qa-engineer
// T-E112-03: verification-by-execution suite for the drift-detector fan-out and
// feature-scope fix (E112, e112-drift-fanout-and-feature-scope), covering both distortion cases
// sr-engineer's T-E112-01 shipped in tools/drift.ts + tools/evidence-lookup.ts
// (code-reviewer APPROVED round 2, review_reports/review_T-E112-01.md):
//
//   (b) cross-feature false positive — completed_tasks is feature-scoped and
//       legitimately empties on an active_feature change; ids with QUALIFYING
//       QA evidence on disk divert into evidenceBackedIds instead of flipping
//       driftDetected. "Qualifying" = the file's LAST recorded verdict section
//       is PASS, or the file has NO verdict section at all (hand-authored
//       covering report). A FAIL-only / PASS-then-FAIL file must NOT qualify.
//   (a) structural fan-out blindness — advisory-only fanoutAdvisory field +
//       scope-qualified clean headline when active-scope incomplete tasks
//       exist. Never flips driftDetected, never enters `details`.
//
// This file builds every fixture on tmpfs (mkdtempSync) and asserts against
// detectDrift's compiled output directly — never against this repo's own
// qa_reports/ corpus, and never against live line numbers. It does NOT call
// the live tw_detect_drift MCP tool (same rationale as
// test/drift-archived-tasks.test.mjs: the running server may hold a stale
// dist).
//
// Standing bar (the ticket's own words): 不要弱化偵測器去換取安靜 — both
// cases must fire when they should AND stay silent when they should not.
// Every group below proves both directions.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { detectDrift } from "../dist/tools/drift.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { recordReviewInFile } from "../dist/gates/qa-review.js";
import { resetSession } from "../dist/guards/session.js";

// ---------------------------------------------------------------------------
// Helpers (mirroring test/drift-archived-tasks.test.mjs / drift-baseline.test.mjs)
// ---------------------------------------------------------------------------

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twdrift-e112-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedHandoff(ws, completedTasks = [], status = "In_Progress", feature = "feat") {
  resetSession();
  parseHandoff(ws); // pre-seed snapshot so writeHandoffState doesn't trip freshness
  await writeHandoffState(ws, feature, status, completedTasks, [], undefined, "pm", 0);
}

function writeTasks(ws, body) {
  fs.writeFileSync(path.join(ws, "tasks.md"), `<!-- schema_version: 1 -->\n${body}`, "utf-8");
}

function writeConfig(ws, driftBaselineIds) {
  const cfg = { schema_version: 1 };
  if (driftBaselineIds !== undefined) cfg.driftBaselineIds = driftBaselineIds;
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify(cfg, null, 2), "utf-8");
}

function qaReportsDir(ws) {
  return path.join(ws, "qa_reports");
}

function writeReviewFile(ws, relPath, content) {
  const p = path.join(qaReportsDir(ws), relPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

function passSection(id, reviewer = "qa-engineer") {
  return `## ${new Date().toISOString()} — PASS — by ${reviewer}\n\nAll good, ${id} verified.\n\n`;
}

function failSection(id, reviewer = "qa-engineer") {
  return `## ${new Date().toISOString()} — FAIL — by ${reviewer}\n\n${id} does not meet AC.\n\n`;
}

/** True if any (possibly compressed) drift detail mentions the task id. */
function detailsMention(report, id) {
  return report.details.some((d) => new RegExp(`\\b${id}\\b`).test(d));
}

function vibeDriftLines(report) {
  return report.details.filter((d) => /vibe-coding drift|completed in task list/.test(d));
}

// ===========================================================================
// Case (b) — the four quadrants
// ===========================================================================

test("case(b) Q1: [x] task with root qa_reports/review_<id>.md PASS diverts to evidenceBackedIds, not vibe drift", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-Q1 root evidence\n");
  writeReviewFile(ws, "review_T-Q1.md", passSection("T-Q1"));

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.evidenceBackedIds.includes("T-Q1"), "T-Q1 must be evidence-backed");
  assert.equal(vibeDriftLines(report).filter((d) => /T-Q1/.test(d)).length, 0, "T-Q1 must not be called vibe drift");
});

test("case(b) Q2: [x] task with qa_reports/archive/<feature>/review_<id>.md PASS diverts to evidenceBackedIds", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-Q2 archived evidence\n");
  writeReviewFile(ws, path.join("archive", "some-old-feature", "review_T-Q2.md"), passSection("T-Q2"));

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.evidenceBackedIds.includes("T-Q2"), "T-Q2 must be evidence-backed via archive");
  assert.equal(vibeDriftLines(report).filter((d) => /T-Q2/.test(d)).length, 0, "T-Q2 must not be called vibe drift");
});

test("case(b) Q3: [x] task reached ONLY via a covers: line diverts to evidenceBackedIds", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-Q3 covers-only evidence\n");
  // No review_T-Q3.md at all — only a batched report naming it via covers:.
  writeReviewFile(ws, "review_BATCH.md", `covers: T-Q3, T-OTHER\n\n${passSection("T-Q3")}`);

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.evidenceBackedIds.includes("T-Q3"), "T-Q3 must resolve via covers:");
  assert.equal(vibeDriftLines(report).filter((d) => /T-Q3/.test(d)).length, 0, "T-Q3 must not be called vibe drift");
});

test("case(b) Q4: [x] task with NO evidence anywhere keeps the verbatim vibe-coding-drift line and flips driftDetected", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-Q4 no evidence at all\n");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "unevidenced completion must still flip driftDetected");
  assert.ok(
    report.details.includes(
      "Task list shows T-Q4 completed, but handoff state doesn't mention it. Possible vibe-coding drift.",
    ),
    `expected the exact verbatim line, got: ${JSON.stringify(report.details)}`,
  );
  assert.equal(report.evidenceBackedIds.length, 0, "no id should be diverted");
});

// ===========================================================================
// Case (b) — evidence resolution branches (must resolve)
// ===========================================================================

test("evidence branch: covers: line pointing at a report with NO verdict section still resolves (branch 2, hand-authored trust class)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-BR2 covers, no verdict\n");
  writeReviewFile(ws, "review_HAND.md", "covers: T-BR2\n\nThis was manually verified working, no formal round.\n");

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.evidenceBackedIds.includes("T-BR2"), "a verdict-less covering report must still qualify");
  assert.equal(report.driftDetected, false);
});

test("evidence branch (DELIBERATE, do not 'fix'): a zero-byte review_<id>.md still counts as qualifying evidence", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-ZERO zero-byte file\n");
  writeReviewFile(ws, "review_T-ZERO.md", "");

  const report = JSON.parse(detectDrift(ws));

  assert.ok(
    report.evidenceBackedIds.includes("T-ZERO"),
    "code-reviewer round 2 accepted this as an intended trade-off (no verdict section => branch 2) — " +
      "this assertion pins the trade-off as INTENDED, not a bug to be fixed later",
  );
});

// ===========================================================================
// Case (b) — C1 regression pins (round-1's hole, closed in round 2).
// Uses the REAL server write path (gates/qa-review.ts recordReviewInFile) so
// these pins exercise the exact shape the server produces, not a hand-typed
// approximation of it.
// ===========================================================================

test("C1 regression: a server-written FAIL-only round still counts as vibe drift (round-1's exploit, closed)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-C1A fail only\n");
  await recordReviewInFile(ws, ["T-C1A"], "FAIL", "qa-engineer", "AC-2 fails: nothing implemented.");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "a FAIL-only record must not silence the detector");
  assert.ok(detailsMention(report, "T-C1A"));
  assert.equal(report.evidenceBackedIds.includes("T-C1A"), false);
});

test("C1 regression: PASS then a later FAIL (last-wins) is REJECTED as evidence", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-C1B pass then fail\n");
  await recordReviewInFile(ws, ["T-C1B"], "PASS", "qa-engineer", "Looked fine at first.");
  await recordReviewInFile(ws, ["T-C1B"], "FAIL", "qa-engineer", "Reopened — regression found.");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "the LAST verdict is FAIL, so this must read as vibe drift");
  assert.equal(report.evidenceBackedIds.includes("T-C1B"), false);
});

test("C1 regression: FAIL then a later PASS (last-wins) is ACCEPTED as evidence", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-C1C fail then pass\n");
  await recordReviewInFile(ws, ["T-C1C"], "FAIL", "qa-engineer", "Round 1 failed.");
  await recordReviewInFile(ws, ["T-C1C"], "PASS", "qa-engineer", "Round 2 fixed it.");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false);
  assert.ok(report.evidenceBackedIds.includes("T-C1C"), "the LAST verdict is PASS, so this must be evidence-backed");
});

test("C1 regression: a CRLF-line-ending FAIL-only record is still REJECTED as evidence", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-C1D crlf fail\n");
  const crlf = `## ${new Date().toISOString()} — FAIL — by qa-engineer\r\n\r\nCRLF-authored rejection.\r\n\r\n`;
  writeReviewFile(ws, "review_T-C1D.md", crlf);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "CRLF must not defeat the verdict-heading regex, in either direction");
  assert.equal(report.evidenceBackedIds.includes("T-C1D"), false);
});

test("C1 regression: a covers: report whose own last verdict is FAIL is REJECTED as evidence", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-C1E covers ending fail\n");
  writeReviewFile(ws, "review_BATCH2.md", `covers: T-C1E\n\n${failSection("T-C1E")}`);

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.equal(report.evidenceBackedIds.includes("T-C1E"), false);
});

// ===========================================================================
// Mixed-bucket / bucket-re-tiering pins — diverting evidence-backed ids
// changes the SIZE of the surviving vibe-drift bucket, which can silently
// re-tier it across DRIFT_COMPRESS_THRESHOLD (5). Pin all three tiers, plus
// the aliasing invariant that driftDetected is computed AFTER
// details.push(buildEvidenceBackedLine) — safe only because
// compressDriftDetails returns a FRESH array.
// ===========================================================================

test("mixed tier 1: 1 drifted + 1 evidence-backed -> driftDetected true, details.length===2, single-id tier preserved", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-M1-DRIFT no evidence\n- [x] T-M1-EVID has evidence\n");
  writeReviewFile(ws, "review_T-M1-EVID.md", passSection("T-M1-EVID"));

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "the surviving drifted id must still flip driftDetected");
  assert.equal(report.details.length, 2, "one vibe line + one evidence-backed line");
  assert.ok(
    report.details.includes(
      "Task list shows T-M1-DRIFT completed, but handoff state doesn't mention it. Possible vibe-coding drift.",
    ),
    "single surviving id must keep the single-id (untiered) exact wording",
  );
  assert.ok(report.evidenceBackedIds.includes("T-M1-EVID"));
});

test("mixed tier 2: 4 completed (1 evidenced) -> remaining 3 use the individual-joined tier (>1 and <=5)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(
    ws,
    "## Active\n" +
      "- [x] T-M2-EVID has evidence\n" +
      "- [x] T-M2-A drifted\n- [x] T-M2-B drifted\n- [x] T-M2-C drifted\n",
  );
  writeReviewFile(ws, "review_T-M2-EVID.md", passSection("T-M2-EVID"));

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  const vibeLine = report.details.find((d) => /Possible vibe-coding drift/.test(d));
  assert.match(vibeLine, /^Task list shows 3 task\(s\) completed \(.*\) that handoff state doesn't mention\. Possible vibe-coding drift\.$/);
  assert.match(vibeLine, /T-M2-A/);
  assert.match(vibeLine, /T-M2-B/);
  assert.match(vibeLine, /T-M2-C/);
  assert.doesNotMatch(vibeLine, /T-M2-EVID/, "the evidence-backed id must not appear in the vibe-drift bucket");
});

test("mixed tier 3: 7 completed (1 evidenced) -> remaining 6 use the compressed-range tier (>5)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  const lines = ["## Active", "- [x] T-M3-EVID has evidence"];
  for (let i = 1; i <= 6; i++) lines.push(`- [x] T-M3-${String(i).padStart(2, "0")} drifted`);
  writeTasks(ws, lines.join("\n") + "\n");
  writeReviewFile(ws, "review_T-M3-EVID.md", passSection("T-M3-EVID"));

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  const compressed = report.details.find((d) => /^6 tasks \(/.test(d));
  assert.ok(compressed, `expected a compressed 6-task line, got: ${JSON.stringify(report.details)}`);
  assert.doesNotMatch(compressed, /T-M3-EVID/, "the evidence-backed id must not appear in the compressed range");
});

// ===========================================================================
// driftBaselineIds runs FIRST — a baselined id is excluded BEFORE the
// evidence lookup even runs. Baselining and evidence-backing must never
// double-count: a baselined id with PASS evidence on disk is excluded via the
// baseline path, not diverted to evidenceBackedIds.
// ===========================================================================

test("driftBaselineIds precedence: a baselined id with PASS evidence on disk is excluded via baseline, NOT diverted to evidenceBackedIds", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T-BASE-EVID"]);
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-BASE-EVID baselined and evidenced\n");
  writeReviewFile(ws, "review_T-BASE-EVID.md", passSection("T-BASE-EVID"));

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false);
  assert.equal(
    report.evidenceBackedIds.includes("T-BASE-EVID"),
    false,
    "a baselined id must be excluded by the baseline path, never surfaced via evidenceBackedIds",
  );
  assert.ok(!report.tasksCompleted.includes("T-BASE-EVID"), "baseline suppression from tasksCompleted is unchanged");
});

// ===========================================================================
// Regression pins — driftBaselineIds, the archived-## Completed filter,
// handoff-ahead, and FAIL/Blocked must be behaviourally UNCHANGED by the fan-out/feature-scope fix (E112).
// ===========================================================================

test("regression: driftBaselineIds still fully suppresses drift with no evidence file present at all", async () => {
  const ws = mkWorkspace();
  writeConfig(ws, ["T-BASE-PLAIN"]);
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [x] T-BASE-PLAIN baselined, no evidence file anywhere\n");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false, "the baseline exemption alone (no evidence needed) is unchanged");
  assert.deepEqual(report.evidenceBackedIds, []);
});

test("regression: an archived (## Completed) task with a PASS evidence file on disk is still fully excluded, not diverted", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(
    ws,
    "## Active\n- [ ] T-ARCH-PENDING active pending\n\n## Completed\n- [x] T-ARCH-DONE archived long ago\n",
  );
  writeReviewFile(ws, "review_T-ARCH-DONE.md", passSection("T-ARCH-DONE"));

  const report = JSON.parse(detectDrift(ws));

  assert.ok(!report.tasksCompleted.includes("T-ARCH-DONE"), "archived task must not appear in tasksCompleted");
  assert.equal(
    report.evidenceBackedIds.includes("T-ARCH-DONE"),
    false,
    "archived tasks are filtered out of activeScopeTasks BEFORE evidence lookup runs — they must never appear here",
  );
  assert.equal(detailsMention(report, "T-ARCH-DONE"), false);
});

test("regression: handoff-ahead drift still fires even when a PASS evidence file exists for that id (evidence lookup does not touch this direction)", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, ["T-HA"]);
  writeTasks(ws, "## Active\n- [ ] T-HA reopened after handoff recorded it\n");
  writeReviewFile(ws, "review_T-HA.md", passSection("T-HA"));

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true, "handoff-ahead direction is untouched by the evidence-lookup mechanism");
  assert.ok(
    report.details.includes("Handoff says T-HA completed, but task list shows it as incomplete."),
    `expected the verbatim handoff-ahead line, got: ${JSON.stringify(report.details)}`,
  );
});

test("regression: FAIL-status incomplete-tasks passthrough still fires alongside an unrelated evidence-backed id", async () => {
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "feat", "FAIL", [], [], "test failure", "qa-engineer", 1);
  writeTasks(ws, "## Active\n- [ ] T-FAIL-OPEN still open\n- [x] T-FAIL-EVID has evidence\n");
  writeReviewFile(ws, "review_T-FAIL-EVID.md", passSection("T-FAIL-EVID"));

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.ok(
    report.details.some((d) => d.includes("Handoff status is FAIL")),
    "FAIL/Blocked incomplete-tasks passthrough must survive alongside the new evidence mechanism",
  );
  assert.ok(report.evidenceBackedIds.includes("T-FAIL-EVID"));
});

// ===========================================================================
// Case (a) — fan-out advisory
// ===========================================================================

test("case(a) NDI shape: 7 rows, 1 [x] ledger-recorded, 6 unrecorded -> headline no longer claims 'synchronized', fanoutAdvisory names the 6", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, ["SRCL-S0"]);
  writeTasks(
    ws,
    [
      "## Active",
      "- [x] SRCL-S0 recorded in this ledger",
      "- [ ] SRCL-S1 pending",
      "- [ ] SRCL-S2 pending",
      "- [ ] SRCL-S3 pending",
      "- [ ] SRCL-S4 pending",
      "- [ ] SRCL-S5 pending",
      "- [ ] SRCL-S6 pending",
      "",
    ].join("\n"),
  );

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false, "no genuine drift — SRCL-S0 is acknowledged, the rest are simply open");
  assert.doesNotMatch(
    report.details[0],
    /synchronized/,
    "the clean headline must be scope-qualified, not claim blanket synchronization, when incomplete tasks remain",
  );
  assert.ok(report.fanoutAdvisory, "fanoutAdvisory must be non-null when active-scope incomplete tasks exist");
  for (const id of ["SRCL-S1", "SRCL-S2", "SRCL-S3", "SRCL-S4", "SRCL-S5", "SRCL-S6"]) {
    assert.match(report.fanoutAdvisory, new RegExp(`\\b${id}\\b`), `fanoutAdvisory must name ${id}`);
  }
  assert.doesNotMatch(report.fanoutAdvisory, /SRCL-S0\b/, "the already-recorded id should not appear as unrecorded");
  // Never a drift signal, never merged into details, never flips driftDetected.
  assert.ok(!report.details.some((d) => d.includes(report.fanoutAdvisory)), "fanoutAdvisory must never be inlined into a details[] entry");
});

test("case(a) negative: fully-accounted task list -> fanoutAdvisory is null, clean string is byte-identical to legacy", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, ["T-DONE"]);
  writeTasks(ws, "## Active\n- [x] T-DONE fully recorded\n");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false);
  assert.equal(report.fanoutAdvisory, null, "zero incomplete tasks -> advisory must be null");
  assert.deepEqual(
    report.details,
    ["No drift detected. Handoff and tasks are synchronized."],
    "with zero incomplete tasks the ORIGINAL clean string must be returned byte-identical",
  );
});

test("case(a) lane signals: .current/feature-split.md present is surfaced in fanoutAdvisory", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [ ] T-LANE open\n");
  fs.writeFileSync(path.join(ws, ".current", "feature-split.md"), "# split\n", "utf-8");

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.fanoutAdvisory);
  assert.match(report.fanoutAdvisory, /feature-split\.md/);
});

test("case(a) lane signals: a synthetic linked-worktree .git FILE is surfaced in fanoutAdvisory", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [ ] T-LANE2 open\n");
  fs.writeFileSync(path.join(ws, ".git"), "gitdir: /some/other/path/.git/worktrees/foo\n", "utf-8");

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.fanoutAdvisory);
  assert.match(report.fanoutAdvisory, /linked git worktree/);
});

test("case(a) lane signals: absent .git and absent feature-split.md never throw, and fanoutAdvisory carries no lane-signal text", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [ ] T-LANE3 open\n");

  assert.doesNotThrow(() => detectDrift(ws));
  const report = JSON.parse(detectDrift(ws));
  assert.ok(report.fanoutAdvisory);
  assert.doesNotMatch(report.fanoutAdvisory, /Positive lane signal/, "no lane signal present -> no lane-signal text appended");
});

test("case(a) lane signals: a normal .git DIRECTORY (ordinary checkout) is not mistaken for a linked worktree and never throws", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);
  writeTasks(ws, "## Active\n- [ ] T-LANE4 open\n");
  fs.mkdirSync(path.join(ws, ".git"));

  assert.doesNotThrow(() => detectDrift(ws));
  const report = JSON.parse(detectDrift(ws));
  assert.doesNotMatch(report.fanoutAdvisory, /linked git worktree/, "a real .git directory must not read as a linked worktree");
});

// ===========================================================================
// New DriftReport fields present on ALL FIVE return paths, including the
// four early returns. Compiler-enforced (TS2741 on omission per round-2's
// negative compile test) but pinned here at runtime too.
// ===========================================================================

test("field presence (early return 1/4): version skew -> fanoutAdvisory null, evidenceBackedIds []", async () => {
  const ws = mkWorkspace();
  // No handoff.md at all; tasks.md sentinel is a schema version newer than
  // the server understands, forcing checkVersionSkew to fire before either
  // storage.parse() or storage.listTasks() runs.
  fs.writeFileSync(path.join(ws, "tasks.md"), "<!-- schema_version: 9999 -->\n## Active\n- [ ] T-SKEW pending\n", "utf-8");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.match(report.details[0], /Schema version skew/);
  assert.equal(report.fanoutAdvisory, null);
  assert.deepEqual(report.evidenceBackedIds, []);
});

test("field presence (early return 2/4): fresh project (no handoff, no tasks) -> fanoutAdvisory null, evidenceBackedIds []", async () => {
  const ws = mkWorkspace();
  // Deliberately nothing written beyond the bare .current/ directory.

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false);
  assert.match(report.details[0], /Fresh project/);
  assert.equal(report.fanoutAdvisory, null);
  assert.deepEqual(report.evidenceBackedIds, []);
});

test("field presence (early return 3/4): tasks exist but handoff is missing -> fanoutAdvisory null, evidenceBackedIds []", async () => {
  const ws = mkWorkspace();
  writeTasks(ws, "## Active\n- [ ] T-NOHANDOFF pending\n");

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, true);
  assert.match(report.details[0], /handoff state is missing/);
  assert.equal(report.fanoutAdvisory, null);
  assert.deepEqual(report.evidenceBackedIds, []);
});

test("field presence (early return 4/4): handoff exists but no tasks file -> fanoutAdvisory null, evidenceBackedIds []", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, ["T-X"]);
  // Deliberately no tasks.md written.

  const report = JSON.parse(detectDrift(ws));

  assert.equal(report.driftDetected, false);
  assert.match(report.details[0], /no task list found/);
  assert.equal(report.fanoutAdvisory, null);
  assert.deepEqual(report.evidenceBackedIds, []);
});

// ===========================================================================
// The 2026-09-18 measured incident (E145/E148/E114 three-lane merge): a
// handoff conflict left only ONE feature's ledger, while tasks.md kept every
// lane's [x] marks. T-E148-01/02 are real QA PASSes with qa_reports/ evidence
// on disk; T-E145-01/02 have neither an evidence file nor a ledger entry.
// Root cause is a missing durable ledger home (E150); the drift-detector fix
// (E112) does not cure that, but it must stop mis-calling the evidenced ids drift.
// ===========================================================================

test("measured incident (2026-09-18 shape): merged-lane ledger reset — evidenced ids are no longer vibe drift, unevidenced sibling-lane ids still report incomplete", async () => {
  const ws = mkWorkspace();
  // The ledger reset to a DIFFERENT feature and holds none of the merged
  // lanes' completions (active_feature changed, completed_tasks emptied).
  await seedHandoff(ws, [], "In_Progress", "e114-cut-approval-inheritance");
  writeTasks(
    ws,
    [
      "## Active",
      "- [x] T-E148-01 real QA PASS, evidence on disk",
      "- [x] T-E148-02 real QA PASS, evidence on disk",
      "- [ ] T-E145-01 sibling lane, still open here",
      "- [ ] T-E145-02 sibling lane, still open here",
      "",
    ].join("\n"),
  );
  writeReviewFile(ws, "review_T-E148-01.md", passSection("T-E148-01"));
  writeReviewFile(ws, "review_T-E148-02.md", passSection("T-E148-02"));

  const report = JSON.parse(detectDrift(ws));

  assert.ok(report.evidenceBackedIds.includes("T-E148-01"), "T-E148-01 must divert to evidenceBackedIds");
  assert.ok(report.evidenceBackedIds.includes("T-E148-02"), "T-E148-02 must divert to evidenceBackedIds");
  assert.equal(
    vibeDriftLines(report).some((d) => /T-E148-0[12]/.test(d)),
    false,
    "neither evidenced id may be called vibe-coding drift",
  );
  assert.ok(report.tasksIncomplete.includes("T-E145-01"), "T-E145-01 must still report as incomplete");
  assert.ok(report.tasksIncomplete.includes("T-E145-02"), "T-E145-02 must still report as incomplete");
  assert.equal(report.driftDetected, false, "no genuine vibe drift remains once the two evidenced ids are diverted");
});

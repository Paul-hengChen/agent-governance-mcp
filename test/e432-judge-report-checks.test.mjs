// Coded by @qa-engineer
// Scenario tests for specs/e432-judge-report-checks.md (AC1-AC14; AC15 is the suite + hygiene proof).
// Invariant (E435: one chain, no marker): the PASS-time evidence checks read the JUDGE's report (code-reviewer,
// unconditionally) through ONE resolver (resolveJudgeReport), and the qa-engineer -> sr-engineer hand-off
// needs the red-test manifest or the no-new-test record. Tests drive the real tool entries (TOOL_REGISTRY.run ->
// zod + orchestrator) against temp workspaces under os.tmpdir(), so each outcome is the one a client sees.
// The base-commit build (git archive of BASE_SHA's dist/, a closed historical SHA guarded by
// `git rev-parse --verify`, skipped loudly when unreachable) is kept only for checks that still hold across E435.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_SHA = "5f50af1";

const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

// ---------------------------------------------------------------- module sets (this branch, base commit)

async function loadMods(distRoot) {
  const imp = (p) => import(pathToFileURL(path.join(distRoot, p)).href);
  const m = {
    distRoot,
    handoff: await imp("tools/handoff.js"),
    session: await imp("guards/session.js"),
    storage: await imp("tools/storage.js"),
    registry: await imp("tools/registry.js"),
    drift: await imp("tools/drift.js"),
    laneStatus: await imp("tools/lane-status.js"),
    orchestrator: await imp("tools/handoff-orchestrator.js"),
    gates: await imp("gates/registry.js"),
    versions: await imp("schema/versions.js"),
  };
  try { m.sqlite = (await imp("tools/storage-sqlite.js")).SqliteHandoffStorage; } catch { m.sqlite = null; }
  return m;
}

const CUR = await loadMods(path.join(ROOT, "dist"));

// A base-commit build: dist/ is committed, so `git archive` of BASE_SHA yields a runnable tree once node_modules is linked.
let BASE = null;
let baseSkipReason = null;
{
  const probe = spawnSync("git", ["rev-parse", "--verify", `${BASE_SHA}^{commit}`], { cwd: ROOT, encoding: "utf-8" });
  if (probe.status !== 0) {
    baseSkipReason = `base commit ${BASE_SHA} is not reachable in this clone`;
  } else {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e432-base-")));
    cleanup.push(dir);
    const tar = spawnSync("git", ["archive", "--format=tar", BASE_SHA, "dist", "package.json", "content",
      "tools/storage-sqlite.ts", "schema/migrations-sqlite.ts"], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
    if (tar.status !== 0) {
      baseSkipReason = `git archive ${BASE_SHA} failed: ${String(tar.stderr)}`;
    } else {
      const x = spawnSync("tar", ["-x", "-C", dir], { input: tar.stdout });
      if (x.status !== 0) {
        baseSkipReason = `tar extract failed: ${String(x.stderr)}`;
      } else {
        fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"), "dir");
        // Read the base storage sources into memory now, while the extracted tree is known to be present, so the
        // later byte-identity check never depends on files still being on disk at assertion time.
        const srcText = {};
        try {
          for (const f of ["tools/storage-sqlite.ts", "schema/migrations-sqlite.ts"]) srcText[f] = fs.readFileSync(path.join(dir, f), "utf-8");
          BASE = await loadMods(path.join(dir, "dist"));
          BASE.srcText = srcText;
        } catch (err) {
          baseSkipReason = `base tree incomplete after extraction: ${err.message}`;
        }
      }
    }
  }
  if (baseSkipReason) console.warn(`[WARN] e432: base-commit replays skipped loudly: ${baseSkipReason}`);
}

// ---------------------------------------------------------------- harness (parameterised by module set)

function harness(m) {
  const { FileHandoffStorage, setActiveStorage } = m.storage;
  const UPD = m.registry.TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
  const ADD = m.registry.TOOL_REGISTRY.find((e) => e.name === "tw_add_task");
  const COMPLETE = m.registry.TOOL_REGISTRY.find((e) => e.name === "tw_complete_task");
  const h = { m, UPD, ADD, COMPLETE };

  h.seed = async (ws, feature, agent, status, opts = {}) => {
    setActiveStorage(new FileHandoffStorage());
    m.session.resetSession(ws);
    m.session.markStateRead(ws);
    await m.handoff.writeHandoffState({
      workspacePath: ws, activeFeature: feature, status, completedTasks: [], pendingNotes: ["seed"],
      lastAgent: agent, cutApproved: true, ...opts,
    });
    forceSeedStamp(ws);
    m.session.resetSession(ws);
    m.session.markStateRead(ws);
  };
  h.upd = async (ws, args) => {
    setActiveStorage(new FileHandoffStorage());
    forceSeedStampIfExists(ws);
    m.session.resetSession(ws);
    m.session.markStateRead(ws);
    try {
      return await UPD.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] };
    }
  };
  h.state = (ws) => new FileHandoffStorage().parse(ws);
  h.addTask = async (ws, id) => {
    setActiveStorage(new FileHandoffStorage());
    m.session.resetSession(ws);
    m.session.markStateRead(ws);
    return ADD.run({ workspace_path: ws, task_id: id, description: `task ${id}` });
  };
  return h;
}

const H = harness(CUR);
const HB = BASE ? harness(BASE) : null;

function mkWs(prefix = "e432-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanup.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}
const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");
const put = (ws, rel, body) => {
  fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
  fs.writeFileSync(path.join(ws, rel), body);
};
const handoffBytes = (ws) =>
  fs.readFileSync(path.join(ws, ".current", "_primary", "handoff.md"), "utf-8").replace(/^last_updated:.*$/m, "last_updated: <pinned>");

const W = (feature) => (agent, status, extra = {}) => ({ active_feature: feature, status, agent_id: agent, ...extra });
const F = "e432-feat";
const w = W(F);

const SECTION_ER = "## Expected-Red Diff\n\nPhase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds)\n";
const SECTION_AC = "## AC Execution Log\n\nAC1: `node --test` exit 0 pass\n";
const SPEC_WITH_PROOF = "# spec\n\n## Acceptance Criteria\n\n- **AC1** thing\n  proof: `node --test x`\n";
const judgeReport = (id, ...sections) => `# QA review — ${id}\n\n${sections.join("\n")}`;

// A feature (no marker, E435) at code-reviewer:In_Progress with a ledger, manifest, a spec with a proof: line and optional judge report.
async function markedJudgeWs(prefix, { tasks = ["T-1"], completed = [], report, manifest = true, spec = true, feature = F } = {}) {
  const ws = mkWs(prefix);
  await H.seed(ws, feature, "code-reviewer", "In_Progress", { completedTasks: completed });
  for (const t of tasks) await H.addTask(ws, t);
  if (manifest) put(ws, `qa_reports/expected-red_${feature}.txt`, "test/x.test.mjs | AC1: red\n");
  if (spec) put(ws, `specs/${feature}.md`, SPEC_WITH_PROOF);
  if (report !== undefined) put(ws, "qa_reports/review_T-1.md", report);
  return ws;
}

// ---------------------------------------------------------------- AC1

test("AC1 (E435): code-reviewer PASS with no marker accepted when the judge report carries both required sections", async () => {
  const ws = await markedJudgeWs("e432-ac1-", { report: judgeReport("T-1", SECTION_ER, SECTION_AC) });
  const r = await H.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(!rejected(r), `judge PASS must be accepted: ${text(r)}`);
  const s = H.state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.last_agent, "code-reviewer");
});

// ---------------------------------------------------------------- AC2

test("AC2 (E435): code-reviewer PASS (no marker) with no judge report -> QA_COMPLETION_EVIDENCE_MISSING (names the path) or MISSING_EVIDENCE", async () => {
  const ws = await markedJudgeWs("e432-ac2a-");
  const before = handoffBytes(ws);
  const r = await H.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(r));
  assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.ok(text(r).includes(path.join(ws, "qa_reports", "review_T-1.md")), `the message names the checked path: ${text(r)}`);
  assert.equal(handoffBytes(ws), before, "no state written");

  const ws2 = await markedJudgeWs("e432-ac2b-", { completed: ["T-1"] });
  const before2 = handoffBytes(ws2);
  const r2 = await H.upd(ws2, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(r2));
  assert.match(text(r2), /MISSING_EVIDENCE/);
  assert.doesNotMatch(text(r2), /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.equal(handoffBytes(ws2), before2, "no state written");
});

// ---------------------------------------------------------------- AC3

test("AC3: expected-red and AC execution sections are read from the judge report", async () => {
  const noEr = await markedJudgeWs("e432-ac3a-", { report: judgeReport("T-1", SECTION_AC) });
  const r1 = await H.upd(noEr, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(r1));
  assert.match(text(r1), /EXPECTED_RED_DIFF_MISSING/);

  const noAc = await markedJudgeWs("e432-ac3b-", { report: judgeReport("T-1", SECTION_ER) });
  const r2 = await H.upd(noAc, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(r2));
  assert.match(text(r2), /AC_EXECUTION_LOG_MISSING/);
  assert.match(text(r2), /Inspected:/);
  assert.ok(text(r2).includes(path.join(noAc, "qa_reports", "review_T-1.md")), `Inspected: names the judge report path: ${text(r2)}`);
});

test("AC3 (E435): the resolver takes the workspace only and always names code-reviewer under qa_reports/; a report only under review_reports/ clears nothing", async () => {
  const { resolveJudgeReport } = await import(pathToFileURL(path.join(ROOT, "dist/tools/evidence-file.js")).href);
  const dir = path.join(os.tmpdir(), "e432-resolver");
  assert.deepEqual(resolveJudgeReport(dir), { judge: "code-reviewer", dir: path.join(dir, "qa_reports") }, "one judge, one directory, no marker argument");

  const ws = await markedJudgeWs("e432-ac3c-");
  put(ws, "review_reports/review_T-1.md", judgeReport("T-1", SECTION_ER, SECTION_AC));
  const r = await H.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(r), "a code-review note under review_reports/ is not the judge report");
  assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/);
});

// ---------------------------------------------------------------- AC4

// E435 Copy: QA_COMPLETION_EVIDENCE_MISSING hintStatic, verbatim.
const QA_COMPLETION_HINT =
  "code-reviewer is the judge: write its report for each newly added id first (qa_review with review_task_ids on a PASS/FAIL write, or qa_reports/review_<id>.md or a covers: file), or drop the unevidenced ids from completed_tasks. No exemption for any edge, status, or review_verdict. See docs/backlog.md E18 incident (b) + E32.";

test("AC4 (E435): a judge write that adds completed ids needs the judge report (no marker); a qa-engineer ledger write is NON_JUDGE_COMPLETED_TASKS_REJECTED", async () => {
  for (const [status, from, extra] of [
    ["In_Progress", "sr-engineer", {}],
    ["FAIL", "code-reviewer", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "x" }],
  ]) {
    const ws = mkWs("e432-ac4a-");
    await H.seed(ws, F, from, "In_Progress");
    const before = handoffBytes(ws);
    const r = await H.upd(ws, w("code-reviewer", status, { completed_tasks: ["T-2"], ...extra }));
    assert.ok(rejected(r), `${status}: ${text(r)}`);
    assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/, `${status} without a report`);
    assert.ok(text(r).includes(QA_COMPLETION_HINT), `${status}: the hint names code-reviewer as the judge: ${text(r)}`);
    assert.equal(handoffBytes(ws), before);
  }
  const ok = mkWs("e432-ac4b-");
  await H.seed(ok, F, "sr-engineer", "In_Progress");
  put(ok, "qa_reports/review_T-2.md", judgeReport("T-2", SECTION_ER));
  const r = await H.upd(ok, w("code-reviewer", "In_Progress", { completed_tasks: ["T-2"] }));
  assert.ok(!rejected(r), `with the judge report: ${text(r)}`);

  const qa = mkWs("e432-ac4c-");
  await H.seed(qa, F, "qa-engineer", "In_Progress");
  put(qa, "qa_reports/review_T-2.md", judgeReport("T-2", SECTION_ER));
  const before = handoffBytes(qa);
  const u = await H.upd(qa, w("qa-engineer", "In_Progress", { completed_tasks: ["T-2"] }));
  assert.ok(rejected(u));
  assert.ok(text(u).includes("⛔ NON_JUDGE_COMPLETED_TASKS_REJECTED: completed_tasks="), text(u));
  assert.doesNotMatch(text(u), /REVIEWER_COMPLETED_TASKS_REJECTED|NON_QA_COMPLETED_TASKS_REJECTED/, "the removed ledger codes are never emitted");
  assert.equal(handoffBytes(qa), before, "no state written");
});

// ---------------------------------------------------------------- AC5 / AC6 / AC7

test("AC5 (E435): qa -> sr (no marker) without manifest or no-new-test record -> REPRO_MANIFEST_MISSING naming both paths", async () => {
  for (const status of ["In_Progress", "Blocked"]) {
    const ws = mkWs("e432-ac5-");
    await H.seed(ws, F, "qa-engineer", status);
    const before = handoffBytes(ws);
    const r = await H.upd(ws, w("sr-engineer", "In_Progress"));
    assert.ok(rejected(r), `qa:${status} -> sr must be rejected: ${text(r)}`);
    assert.match(text(r), /REPRO_MANIFEST_MISSING/);
    assert.ok(text(r).includes(path.join(ws, "qa_reports", `expected-red_${F}.txt`)), "names the manifest path");
    assert.ok(text(r).includes(path.join(ws, "qa_reports", `no-new-test_${F}.txt`)), "names the no-new-test record path");
    assert.equal(handoffBytes(ws), before, "no state written");
  }
});

test("AC6 (E435): with no marker, the no-new-test record or the manifest alone clears qa -> sr; content is never read (empty file clears)", async () => {
  for (const file of [`no-new-test_${F}.txt`, `expected-red_${F}.txt`]) {
    for (const content of ["docs-only change\n", ""]) {
      const ws = mkWs("e432-ac6-");
      await H.seed(ws, F, "qa-engineer", "In_Progress");
      put(ws, `qa_reports/${file}`, content);
      const r = await H.upd(ws, w("sr-engineer", "In_Progress"));
      assert.ok(!rejected(r), `${file} (${content.length} bytes) must clear: ${text(r)}`);
    }
  }
});

test("AC7 (E435): a bug ticket (no marker) shares the manifest: qa-written manifest clears both hops; a no-new-test record leaves sr -> code-reviewer armed", async () => {
  const a = mkWs("e432-ac7a-");
  await H.seed(a, F, "qa-engineer", "In_Progress", { dispatchMode: "bugfix" });
  put(a, `qa_reports/expected-red_${F}.txt`, "test/x.test.mjs | repro\n");
  const a1 = await H.upd(a, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(a1), `qa -> sr: ${text(a1)}`);
  const a2 = await H.upd(a, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(a2), `sr -> code-reviewer with no file written by sr: ${text(a2)}`);

  const b = mkWs("e432-ac7b-");
  await H.seed(b, F, "qa-engineer", "In_Progress", { dispatchMode: "bugfix" });
  put(b, `qa_reports/no-new-test_${F}.txt`, "cannot reproduce from the public interface\n");
  const b1 = await H.upd(b, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(b1), `qa -> sr with the record: ${text(b1)}`);
  const b2 = await H.upd(b, w("code-reviewer", "In_Progress"));
  assert.ok(rejected(b2));
  assert.match(text(b2), /REPRO_MANIFEST_MISSING: e432-feat\. Expected repro manifest at /, "today's bugfix text");
  put(b, `qa_reports/expected-red_${F}.txt`, "test/x.test.mjs | repro\n");
  const b3 = await H.upd(b, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(b3), `after sr wrote the manifest: ${text(b3)}`);
});

// ---------------------------------------------------------------- AC8 (drift and archive-aware lookup)

const PASS_HDR = (by, verdict = "PASS") => `## 2026-11-20T00:00:00.000Z — ${verdict} — by ${by}\n\nnotes\n\n`;

async function driftWs(h, { reportPath, report }) {
  const ws = mkWs("e432-ac8-");
  await h.seed(ws, F, "code-reviewer", "In_Progress");
  put(ws, "tasks.md", "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n- [x] T-3 judged task\n- [ ] T-9 open\n");
  if (reportPath) put(ws, reportPath, report);
  return ws;
}
const driftOf = (h, ws) => JSON.parse(h.m.drift.detectDrift(ws));
const vibeFor = (rep, id) => rep.details.filter((d) => d.includes(id) && /vibe-coding drift/.test(d));

test("AC8 (E435): with no marker, a PASS-last judge report (root and archive) backs the id; FAIL-last is drift", async () => {
  const passBody = `# QA review — T-3\n\n${PASS_HDR("code-reviewer")}`;
  for (const rel of ["qa_reports/review_T-3.md", `qa_reports/archive/${F}/review_T-3.md`]) {
    const ws = await driftWs(H, { reportPath: rel, report: passBody });
    const rep = driftOf(H, ws);
    assert.ok(rep.evidenceBackedIds.includes("T-3"), `${rel}: evidence-backed ${JSON.stringify(rep)}`);
    assert.deepEqual(vibeFor(rep, "T-3"), [], `${rel}: no vibe-coding line for T-3`);
  }
  const failLast = `# QA review — T-3\n\n${PASS_HDR("code-reviewer")}${PASS_HDR("code-reviewer", "FAIL")}`;
  const ws = await driftWs(H, { reportPath: "qa_reports/review_T-3.md", report: failLast });
  const rep = driftOf(H, ws);
  assert.ok(!rep.evidenceBackedIds.includes("T-3"));
  assert.ok(vibeFor(rep, "T-3").length > 0, `FAIL-last is reported as drift: ${JSON.stringify(rep.details)}`);
});

test("AC8 (E435): a workspace with only APPROVED / CHANGES_REQUESTED code-review files under review_reports/ backs nothing: the id is drift", async () => {
  for (const body of ["# Review\n\nVerdict: APPROVED\n", "# Review\n\nVerdict: CHANGES_REQUESTED\n"]) {
    const rep = driftOf(H, await driftWs(H, { reportPath: "review_reports/review_T-3.md", report: body }));
    assert.ok(!rep.evidenceBackedIds.includes("T-3"), JSON.stringify(rep));
    assert.ok(vibeFor(rep, "T-3").length > 0, `a review_reports/ note is not the judge report: ${JSON.stringify(rep.details)}`);
  }
});

// ---------------------------------------------------------------- AC9 (lane-status)

test("AC9: lane-status counts a server-recorded code-reviewer PASS as evidence; FAIL and APPROVED notes do not", () => {
  const ws = mkWs("e432-ac9-");
  put(ws, "qa_reports/review_T-1.md", `# QA review — T-1\n\n${PASS_HDR("code-reviewer")}`);
  put(ws, "qa_reports/review_T-2.md", `# QA review — T-2\n\n${PASS_HDR("code-reviewer", "FAIL")}`);
  put(ws, "review_reports/review_T-4.md", "# Review\n\nVerdict: APPROVED\n");
  const res = CUR.laneStatus.checkLaneEvidence(ws, "e432-feat", ["T-1", "T-2", "T-4"]);
  assert.deepEqual(res.evidenceIds, ["T-1"], JSON.stringify(res));
  assert.deepEqual(res.claimedWithoutEvidence, ["T-2", "T-4"]);
});

test("AC9: unmarked lanes (qa PASS sections, with or without review_reports/ files) compute identically to base", (t) => {
  if (!BASE) return t.skip(baseSkipReason);
  const build = () => {
    const ws = mkWs("e432-ac9b-");
    put(ws, "qa_reports/review_T-1.md", `# QA review — T-1\n\n${PASS_HDR("qa-engineer")}`);
    put(ws, "qa_reports/review_T-2.md", `# QA review — T-2\n\n${PASS_HDR("qa-engineer", "FAIL")}`);
    return ws;
  };
  for (const withReviewReports of [false, true]) {
    const a = build();
    const b = build();
    if (withReviewReports) for (const ws of [a, b]) put(ws, "review_reports/review_T-1.md", "# Review\n\nVerdict: APPROVED\n");
    const ra = CUR.laneStatus.checkLaneEvidence(a, "e432-feat", ["T-1", "T-2"]);
    const rb = BASE.laneStatus.checkLaneEvidence(b, "e432-feat", ["T-1", "T-2"]);
    assert.equal(norm(JSON.stringify(ra), a), norm(JSON.stringify(rb), b));
  }
});

// ---------------------------------------------------------------- AC10 (release script)

const REL = await import(pathToFileURL(path.join(ROOT, "scripts", "release.mjs")).href);
const parseMod = await import(pathToFileURL(path.join(ROOT, "dist", "tools", "handoff-parse.js")).href);
const GIT_ENV = {
  ...process.env, GIT_AUTHOR_NAME: "QA Fixture", GIT_AUTHOR_EMAIL: "qa@example.com", GIT_COMMITTER_NAME: "QA Fixture",
  GIT_COMMITTER_EMAIL: "qa@example.com", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull, GIT_TERMINAL_PROMPT: "0",
};
const handoffText = (agent, status, marked) =>
  `---\nschema_version: 16\nactive_feature: "feat"\nstatus: "${status}"\nlast_updated: "2026-11-04T00:00:07.123Z"\nlast_agent: "${agent}"\n${marked ? 'chain_path: "test-first"\n' : ""}---\n# Handoff State\n\n## Pending & Handoff Notes\n- x\n`;

// A throwaway git repo on main tracking a local bare origin, holding .current/_primary/handoff.md.
function releaseFixture(handoff) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e432-rel-")));
  cleanup.push(base);
  const origin = path.join(base, "origin.git");
  const root = path.join(base, "repo");
  const g = (cwd, ...a) => spawnSync("git", a, { cwd, env: GIT_ENV, encoding: "utf-8" });
  g(base, "init", "-q", "--bare", "-b", "main", origin);
  fs.mkdirSync(root);
  g(root, "init", "-q", "-b", "main");
  put(root, ".current/_primary/handoff.md", handoff);
  put(root, "package.json", '{"name":"fx","version":"1.2.3"}\n');
  g(root, "add", "-A");
  g(root, "commit", "-q", "-m", "init");
  g(root, "remote", "add", "origin", origin);
  g(root, "push", "-q", "-u", "origin", "main");
  return { base, root, work: path.join(base, "work") };
}
async function runRelease(root, argv) {
  const out = [];
  const err = [];
  const spawn = (bin, args, opts) => (bin === "gh" ? { status: 0, stdout: "", stderr: "" } : spawnSync(bin, args, opts));
  const code = await REL.main(argv, {
    root, spawn, out: (s) => out.push(s), err: (s) => err.push(s), sleep: async () => {},
    env: { ...process.env, AGC_RELEASE_STOP_FILE: path.join(root, "..", "stop.txt") },
    importLanePaths: async () => ({ resolveCurrentLane: () => "_primary" }), importHandoffParse: async () => parseMod,
    now: () => new Date("2026-11-04T08:00:00Z"),
  });
  return { code, out: out.join(""), err: err.join("") };
}
const startDry = (fx) => ["start", "--bump", "patch", "--tickets", "E7", "--work-dir", fx.work, "--dry-run"];
const notPassCode = REL.EXIT_CLASSES.find((c) => c.id === "PRECONDITION_NOT_PASS").code;

test("AC10 (E435): release s1 accepts (code-reviewer, PASS) with or without a stale schema 16 marker; (qa-engineer, PASS) stops naming the judge", async () => {
  for (const marked of [true, false]) {
    const fx = releaseFixture(handoffText("code-reviewer", "PASS", marked));
    const r = await runRelease(fx.root, startDry(fx));
    assert.notEqual(r.code, notPassCode, `judge PASS (marker ${marked}) passes s1: ${r.err}`);
    assert.ok(fs.existsSync(path.join(fx.work, "state.md")), "s1 copied the handoff to the work dir");
  }
  const qa = releaseFixture(handoffText("qa-engineer", "PASS", false));
  const rq = await runRelease(qa.root, startDry(qa));
  assert.equal(rq.code, notPassCode);
  assert.match(rq.err, /RELEASE_STOP PRECONDITION_NOT_PASS: .*is \(qa-engineer, PASS\), expected \(code-reviewer, PASS\) — commit the release gate's \(code-reviewer, PASS\) write to main first/);
  assert.ok(!fs.existsSync(path.join(qa.work, "state.md")), "nothing written before the tuple holds");
});

test("AC10 (E435): the --state pre-input check follows the same judge rule", async () => {
  const run = async (state) => {
    const fx = releaseFixture(handoffText("qa-engineer", "PASS", false));
    put(fx.base, "state.json", JSON.stringify(state));
    return runRelease(fx.root, ["prepare", "--version", "1.2.4", "--state", path.join(fx.base, "state.json"),
      "--tickets", "E7", "--message-file", path.join(fx.base, "nope.txt"), "--dry-run"]);
  };
  for (const extra of [{ chain_path: "test-first" }, {}]) {
    const judge = await run({ last_agent: "code-reviewer", status: "PASS", active_feature: "feat", ...extra });
    assert.doesNotMatch(judge.err, /--state must be a/, `judge PASS accepted with or without a stale marker: ${judge.err}`);
    assert.match(judge.err, /RELEASE_STOP USAGE: .*--message-file/, "the check moved on to the next pre-input");
  }
  const qa = await run({ last_agent: "qa-engineer", status: "PASS", active_feature: "feat" });
  assert.match(qa.err, /--state must be a \(code-reviewer, PASS\) snapshot with an active_feature \(got qa-engineer, PASS\)/);
});

test("AC10 (E435): the release-gate line names code-reviewer by default", () => {
  const args = { version: "1.2.4", oldVersion: "1.2.3", bump: "patch", activeFeature: "feat", tickets: ["E7"] };
  const msg = REL.commitMessage(args);
  assert.match(msg, /Release gate: feat \(code-reviewer PASS committed to main\)\./);
  assert.equal(REL.commitMessage({ ...args, judge: "code-reviewer" }), msg);
});

// ---------------------------------------------------------------- AC11 (old path byte-identical vs base)

// Replace the workspace path and every ISO timestamp so two runs in different temp dirs compare equal.
function norm(s, ws) {
  let out = String(s);
  for (const p of new Set([ws, fs.realpathSync(ws)])) out = out.split(p).join("<WS>");
  return out.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g, "<TS>");
}
// E435: one chain, code-reviewer the judge. Each scenario drives writes through harness h and returns one outcome per write.
const SCENARIOS = {
  async chain(h, ws) {
    const t = [];
    const rec = async (args) => { const r = await h.upd(ws, args); t.push({ args, rejected: rejected(r), text: text(r) }); };
    await h.seed(ws, F, "pm", "In_Progress", { scopeDecision: "single-feature" });
    put(ws, `qa_reports/no-new-test_${F}.txt`, "routing scenario\n");
    for (const a of ["qa-engineer", "sr-engineer", "code-reviewer"]) await rec(w(a, "In_Progress"));
    await rec(w("code-reviewer", "PASS", { review_verdict: "APPROVED", completed_tasks: ["T-1"], review_task_ids: ["T-1"], qa_review: "ok" }));
    return t;
  },
  async architectFailLoop(h, ws) {
    const t = [];
    const rec = async (args) => { const r = await h.upd(ws, args); t.push({ args, rejected: rejected(r), text: text(r) }); };
    await h.seed(ws, F, "pm", "In_Progress", { scopeDecision: "single-feature" });
    put(ws, `qa_reports/no-new-test_${F}.txt`, "routing scenario\n");
    for (const a of ["architect", "qa-engineer", "sr-engineer", "code-reviewer"]) await rec(w(a, "In_Progress"));
    await rec(w("code-reviewer", "FAIL", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "bug", review_task_ids: ["T-1"], qa_review: "found a bug" }));
    await rec(w("sr-engineer", "In_Progress"));
    return t;
  },
  async bugfix(h, ws) {
    const t = [];
    const rec = async (args) => { const r = await h.upd(ws, args); t.push({ args, rejected: rejected(r), text: text(r) }); };
    await h.seed(ws, F, "sr-engineer", "In_Progress", { dispatchMode: "bugfix" });
    await rec(w("code-reviewer", "In_Progress"));
    put(ws, `qa_reports/expected-red_${F}.txt`, "test/x.test.mjs | repro\n");
    await rec(w("code-reviewer", "In_Progress"));
    return t;
  },
  async amendResume(h, ws) {
    const t = [];
    await h.seed(ws, F, "pm", "In_Progress");
    const r = await h.upd(ws, w("code-reviewer", "In_Progress", { resume_of: "code-reviewer" }));
    t.push({ rejected: rejected(r), text: text(r) });
    return t;
  },
  async completionEvidenceMissing(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress");
    const r = await h.upd(ws, w("code-reviewer", "In_Progress", { completed_tasks: ["T-9"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async missingEvidence(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress", { completedTasks: ["T-9"] });
    const r = await h.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-9"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async expectedRedMissing(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress");
    put(ws, `qa_reports/expected-red_${F}.txt`, "test/x.test.mjs | red\n");
    put(ws, "qa_reports/review_T-1.md", "# QA review - T-1\n\nno sections\n");
    const r = await h.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async acLogMissing(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress");
    put(ws, `specs/${F}.md`, SPEC_WITH_PROOF);
    put(ws, "qa_reports/review_T-1.md", judgeReport("T-1", SECTION_ER));
    const r = await h.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async reproManifestMissing(h, ws) {
    await h.seed(ws, F, "sr-engineer", "In_Progress", { dispatchMode: "bugfix" });
    const r = await h.upd(ws, w("code-reviewer", "In_Progress"));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async reviewerToQaClosed(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress");
    const r = await h.upd(ws, w("qa-engineer", "In_Progress", { review_task_ids: ["T-1"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async qaReviewTargetRequired(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress");
    const r = await h.upd(ws, w("code-reviewer", "PASS", { qa_review: "ok" }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
};

// One entry per write: null = accepted, a RegExp = rejected with matching text.
const S3 = /TRANSITION_REJECTED[\s\S]*code-reviewer is the judge and closes the feature[\s\S]*docs\/migration-v5\.md/;
const EXPECT = {
  chain: [null, null, null, null],
  architectFailLoop: [null, null, null, null, null, null],
  bugfix: [/REPRO_MANIFEST_MISSING: e432-feat\. Expected repro manifest at /, null],
  amendResume: [null],
  completionEvidenceMissing: [/QA_COMPLETION_EVIDENCE_MISSING/],
  missingEvidence: [/MISSING_EVIDENCE/],
  expectedRedMissing: [/EXPECTED_RED_DIFF_MISSING/],
  acLogMissing: [/AC_EXECUTION_LOG_MISSING/],
  reproManifestMissing: [/REPRO_MANIFEST_MISSING/],
  reviewerToQaClosed: [S3],
  qaReviewTargetRequired: [/QA_REVIEW_TARGET_REQUIRED/],
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test(`AC11 (E435): ${name} runs on the one chain with code-reviewer the judge, no marker`, async () => {
    const ws = mkWs("e432-ac11-");
    const tr = await fn(H, ws);
    assert.equal(tr.length, EXPECT[name].length, `${name}: one outcome per write`);
    EXPECT[name].forEach((want, i) => {
      if (want === null) assert.ok(!tr[i].rejected, `${name} #${i} accepted: ${tr[i].text}`);
      else { assert.ok(tr[i].rejected, `${name} #${i} rejected`); assert.match(tr[i].text, want, `${name} #${i}`); }
    });
    assert.doesNotMatch(handoffBytes(ws), /^(chain_path|qa_round|qa_rounds_total):/m, `${name}: no dropped field stored`);
  });
}

// ---------------------------------------------------------------- AC12 (SQLite)

async function sqliteRun(m, label) {
  const { FileHandoffStorage, setActiveStorage } = m.storage;
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `e432-sq-${label}-`)));
  cleanup.push(dir);
  const dbPath = path.join(dir, "agc.db");
  const storage = new m.sqlite(dbPath);
  const UPD = m.registry.TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
  const out = [];
  try {
    setActiveStorage(storage);
    const reseed = async (agent, completed = []) => {
      await storage.writeState({ workspacePath: dir, activeFeature: F, status: "In_Progress", completedTasks: completed, pendingNotes: ["seed"], lastAgent: agent });
      m.session.resetSession(dir);
      storage.readState(dir);
    };
    const go = async (args) => {
      m.session.resetSession(dir);
      storage.readState(dir);
      let r;
      try { r = await UPD.run({ workspace_path: dir, completed_tasks: [], pending_notes: [], ...args }); } catch (err) { r = { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] }; }
      out.push({ rejected: rejected(r), text: norm(text(r), dir) });
    };
    await reseed("code-reviewer", ["T-1"]);
    await go(w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
    await reseed("code-reviewer");
    await go(w("code-reviewer", "PASS", { qa_review: "ok" }));
    await reseed("qa-engineer");
    await go(w("qa-engineer", "PASS", { completed_tasks: ["T-2"], review_task_ids: ["T-2"], qa_review: "qa" }));
    await reseed("code-reviewer");
    await go(w("code-reviewer", "PASS", { review_verdict: "APPROVED", completed_tasks: ["T-2"], review_task_ids: ["T-2"], qa_review: "all good" }));
    const final = storage.readState(dir);
    out.push({ status: final?.status, last_agent: final?.last_agent, chain_path: final?.chain_path ?? null });
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { storage.close(); } catch {}
  }
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare("SELECT task_id, status, reviewer, notes FROM reports ORDER BY task_id, status").all();
  db.close();
  return { out, rows };
}

// The SQLite DDL (CREATE TABLE blocks + addColumnIfMissing lines) of a storage-sqlite.ts source text.
const sqliteDdl = (src) => [...src.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?\);|addColumnIfMissing\("[^"]*"\)/g)].map((x) => x[0]);

test("AC12 (E435): SQLite runs the evidence gates with code-reviewer the judge; a qa PASS is rejected naming code-reviewer; no SQLite schema change", async (t) => {
  if (!CUR.sqlite) return t.skip("better-sqlite3 not installed");
  const cur = await sqliteRun(CUR, "cur");
  assert.match(cur.out[0].text, /MISSING_EVIDENCE/);
  assert.match(cur.out[1].text, /QA_REVIEW_TARGET_REQUIRED/);
  assert.ok(cur.out[2].rejected && cur.out[2].text.includes("code-reviewer is the judge; qa-engineer writes tests and never writes PASS."), `qa PASS rejected: ${cur.out[2].text}`);
  assert.ok(!cur.out[3].rejected, `code-reviewer PASS with qa_review accepted: ${cur.out[3].text}`);
  assert.deepEqual(cur.out[4], { status: "PASS", last_agent: "code-reviewer", chain_path: null });
  assert.deepEqual(cur.rows.map((r) => [r.task_id, r.status, r.reviewer]), [["T-2", "PASS", "code-reviewer"]]);
  assert.equal(CUR.versions.CURRENT_VERSIONS.sqlite, 2);
  if (!BASE) return t.skip(baseSkipReason);
  assert.equal(fs.readFileSync(path.join(ROOT, "schema/migrations-sqlite.ts"), "utf-8"), BASE.srcText["schema/migrations-sqlite.ts"], "SQLite migrations byte-identical to base");
  const ddl = sqliteDdl(fs.readFileSync(path.join(ROOT, "tools/storage-sqlite.ts"), "utf-8"));
  assert.ok(ddl.length > 5, "DDL located (vacuity guard)");
  assert.deepEqual(ddl, sqliteDdl(BASE.srcText["tools/storage-sqlite.ts"]), "no SQLite column added or dropped (qa_round stays in the DDL)");
});

// ---------------------------------------------------------------- AC13 (one shared resolver)

test("AC13: the resolver is exported from exactly one module and every consumer imports it", () => {
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
  const exporters = [];
  for (const dir of ["tools", "gates", "lib", "guards", "schema"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith(".ts")) continue;
      if (/export\s+(?:async\s+)?(?:function|const)\s+resolveJudgeReport\b/.test(read(`${dir}/${f}`))) exporters.push(`${dir}/${f}`);
    }
  }
  assert.deepEqual(exporters, ["tools/evidence-file.ts"]);
  for (const f of ["tools/handoff-orchestrator.ts", "gates/qa-review.ts", "gates/expected-red.ts", "gates/ac-execution.ts", "tools/evidence-lookup.ts", "tools/lane-status.ts"]) {
    const src = read(f);
    assert.match(src, /import\s*\{[^}]*\bresolveJudgeReport\b[^}]*\}\s*from\s*"(?:\.\.\/tools|\.)\/evidence-file\.js"/, `${f} imports the resolver`);
    assert.match(src, /resolveJudgeReport\(/, `${f} calls the resolver`);
  }
  for (const f of ["tools/evidence-lookup.ts", "tools/lane-status.ts", "gates/qa-review.ts", "gates/ac-execution.ts"]) {
    const code = read(f).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.ok(!/path\.join\([^)]*"qa_reports"/.test(code), `${f} does not restate the qa_reports location literal`);
  }
});

// ---------------------------------------------------------------- AC14 (counts unchanged)

test("AC14 (E435): registry 33, pipeline 17 (base names and order, step 9 renamed), evidence schema 2, handoff 17, sqlite 2, CLAUDE.md 250 lines", async () => {
  assert.equal(CUR.gates.GATE_REGISTRY.length, 33);
  const pipe = CUR.orchestrator.UPDATE_STATE_GATE_PIPELINE;
  assert.equal(pipe.length, 17);
  if (BASE) {
    const want = BASE.orchestrator.UPDATE_STATE_GATE_PIPELINE.map((s) => s.name);
    assert.equal(want[8], "REVIEWER_COMPLETED_TASKS_REJECTED", "base step 9");
    want[8] = "NON_JUDGE_COMPLETED_TASKS_REJECTED";
    assert.deepEqual(pipe.map((s) => s.name), want, "base step names and order, step 9 renamed (Ruling (b))");
  } else {
    console.warn(`[WARN] e432 AC14: step-name comparison against base skipped: ${baseSkipReason}`);
  }
  const ev = await import(pathToFileURL(path.join(ROOT, "dist/gates/evidence-schema.js")).href);
  assert.equal(ev.EVIDENCE_SCHEMA_CURRENT, 2);
  assert.equal(CUR.versions.CURRENT_VERSIONS.handoff, 17);
  assert.equal(CUR.versions.CURRENT_VERSIONS.sqlite, 2);
  const lines = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf-8").split("\n");
  const count = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  assert.equal(count, 250);
});

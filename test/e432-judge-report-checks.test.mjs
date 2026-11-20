// Coded by @qa-engineer
// Scenario tests for specs/e432-judge-report-checks.md (AC1-AC14; AC15 is the suite + hygiene proof).
// Invariant: on a test-first feature (chain_path: "test-first") the PASS-time evidence checks read the JUDGE's
// report (code-reviewer) through ONE resolver (resolveJudgeReport), and the qa-engineer -> sr-engineer hand-off
// needs the red-test manifest or the no-new-test record; on every unmarked feature every outcome stays
// byte-identical to the base commit. Tests drive the real tool entries (TOOL_REGISTRY.run -> zod + orchestrator)
// against temp workspaces under os.tmpdir(), so each outcome is the one a client sees.
// AC11/AC12 replay the same scenarios against a base-commit build (git archive of BASE_SHA's dist/) and this
// branch and compare normalised transcripts; the base commit is a closed historical SHA, guarded by
// `git rev-parse --verify` and skipped loudly when unreachable (docs/lane-protocol.md section 3).

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

// A marked feature at code-reviewer:In_Progress with a ledger, manifest, a spec with a proof: line and optional judge report.
async function markedJudgeWs(prefix, { tasks = ["T-1"], completed = [], report, manifest = true, spec = true, feature = F } = {}) {
  const ws = mkWs(prefix);
  await H.seed(ws, feature, "code-reviewer", "In_Progress", { chainPath: "test-first", completedTasks: completed });
  for (const t of tasks) await H.addTask(ws, t);
  if (manifest) put(ws, `qa_reports/expected-red_${feature}.txt`, "test/x.test.mjs | AC1: red\n");
  if (spec) put(ws, `specs/${feature}.md`, SPEC_WITH_PROOF);
  if (report !== undefined) put(ws, "qa_reports/review_T-1.md", report);
  return ws;
}

// ---------------------------------------------------------------- AC1

test("AC1: marked code-reviewer PASS accepted when the judge report carries both required sections", async () => {
  const ws = await markedJudgeWs("e432-ac1-", { report: judgeReport("T-1", SECTION_ER, SECTION_AC) });
  const r = await H.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(!rejected(r), `judge PASS must be accepted: ${text(r)}`);
  const s = H.state(ws);
  assert.equal(s.status, "PASS");
  assert.equal(s.last_agent, "code-reviewer");
});

// ---------------------------------------------------------------- AC2

test("AC2: marked code-reviewer PASS with no judge report -> QA_COMPLETION_EVIDENCE_MISSING (names the path) or MISSING_EVIDENCE", async () => {
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

test("AC3: the resolver returns one location for both chain paths; a report only under review_reports/ clears nothing", async () => {
  const { resolveJudgeReport } = await import(pathToFileURL(path.join(ROOT, "dist/tools/evidence-file.js")).href);
  const dir = path.join(os.tmpdir(), "e432-resolver");
  const marked = resolveJudgeReport(dir, "test-first");
  const unmarked = resolveJudgeReport(dir);
  assert.equal(marked.judge, "code-reviewer");
  assert.equal(unmarked.judge, "qa-engineer");
  assert.equal(marked.dir, unmarked.dir, "D1: the judge report stays in one directory on both paths");
  assert.equal(unmarked.dir, path.join(dir, "qa_reports"));

  const ws = await markedJudgeWs("e432-ac3c-");
  put(ws, "review_reports/review_T-1.md", judgeReport("T-1", SECTION_ER, SECTION_AC));
  const r = await H.upd(ws, w("code-reviewer", "PASS", { completed_tasks: ["T-1"] }));
  assert.ok(rejected(r), "a code-review note under review_reports/ is not the judge report");
  assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/);
});

// ---------------------------------------------------------------- AC4

test("AC4: marked judge write that adds completed ids needs the judge report; unmarked keeps REVIEWER_COMPLETED_TASKS_REJECTED", async () => {
  for (const [status, from, extra] of [
    ["In_Progress", "sr-engineer", {}],
    ["FAIL", "code-reviewer", { review_verdict: "CHANGES_REQUESTED", blocking_reason: "x" }],
  ]) {
    const ws = mkWs("e432-ac4a-");
    await H.seed(ws, F, from, "In_Progress", { chainPath: "test-first" });
    const before = handoffBytes(ws);
    const r = await H.upd(ws, w("code-reviewer", status, { completed_tasks: ["T-2"], ...extra }));
    assert.ok(rejected(r), `${status}: ${text(r)}`);
    assert.match(text(r), /QA_COMPLETION_EVIDENCE_MISSING/, `${status} without a report`);
    assert.equal(handoffBytes(ws), before);
  }
  const ok = mkWs("e432-ac4b-");
  await H.seed(ok, F, "sr-engineer", "In_Progress", { chainPath: "test-first" });
  put(ok, "qa_reports/review_T-2.md", judgeReport("T-2", SECTION_ER));
  const r = await H.upd(ok, w("code-reviewer", "In_Progress", { completed_tasks: ["T-2"] }));
  assert.ok(!rejected(r), `with the judge report: ${text(r)}`);

  const un = mkWs("e432-ac4c-");
  await H.seed(un, F, "sr-engineer", "In_Progress");
  const u = await H.upd(un, w("code-reviewer", "In_Progress", { completed_tasks: ["T-2"] }));
  assert.ok(rejected(u));
  assert.match(text(u), /REVIEWER_COMPLETED_TASKS_REJECTED/);
  if (HB) {
    const un2 = mkWs("e432-ac4d-");
    await HB.seed(un2, F, "sr-engineer", "In_Progress");
    const b = await HB.upd(un2, w("code-reviewer", "In_Progress", { completed_tasks: ["T-2"] }));
    assert.equal(norm(text(u), un), norm(text(b), un2), "today's text, byte for byte against base");
  }
});

// ---------------------------------------------------------------- AC5 / AC6 / AC7

test("AC5: marked qa -> sr without manifest or no-new-test record -> REPRO_MANIFEST_MISSING naming both paths", async () => {
  for (const status of ["In_Progress", "Blocked"]) {
    const ws = mkWs("e432-ac5-");
    await H.seed(ws, F, "qa-engineer", status, { chainPath: "test-first" });
    const before = handoffBytes(ws);
    const r = await H.upd(ws, w("sr-engineer", "In_Progress"));
    assert.ok(rejected(r), `qa:${status} -> sr must be rejected: ${text(r)}`);
    assert.match(text(r), /REPRO_MANIFEST_MISSING/);
    assert.ok(text(r).includes(path.join(ws, "qa_reports", `expected-red_${F}.txt`)), "names the manifest path");
    assert.ok(text(r).includes(path.join(ws, "qa_reports", `no-new-test_${F}.txt`)), "names the no-new-test record path");
    assert.equal(handoffBytes(ws), before, "no state written");
  }
});

test("AC6: the no-new-test record or the manifest alone clears qa -> sr; content is never read (empty file clears)", async () => {
  for (const file of [`no-new-test_${F}.txt`, `expected-red_${F}.txt`]) {
    for (const content of ["docs-only change\n", ""]) {
      const ws = mkWs("e432-ac6-");
      await H.seed(ws, F, "qa-engineer", "In_Progress", { chainPath: "test-first" });
      put(ws, `qa_reports/${file}`, content);
      const r = await H.upd(ws, w("sr-engineer", "In_Progress"));
      assert.ok(!rejected(r), `${file} (${content.length} bytes) must clear: ${text(r)}`);
    }
  }
});

test("AC7: marked bug ticket shares the manifest: qa-written manifest clears both hops; a no-new-test record leaves sr -> code-reviewer armed", async () => {
  const a = mkWs("e432-ac7a-");
  await H.seed(a, F, "qa-engineer", "In_Progress", { chainPath: "test-first", dispatchMode: "bugfix" });
  put(a, `qa_reports/expected-red_${F}.txt`, "test/x.test.mjs | repro\n");
  const a1 = await H.upd(a, w("sr-engineer", "In_Progress"));
  assert.ok(!rejected(a1), `qa -> sr: ${text(a1)}`);
  const a2 = await H.upd(a, w("code-reviewer", "In_Progress"));
  assert.ok(!rejected(a2), `sr -> code-reviewer with no file written by sr: ${text(a2)}`);

  const b = mkWs("e432-ac7b-");
  await H.seed(b, F, "qa-engineer", "In_Progress", { chainPath: "test-first", dispatchMode: "bugfix" });
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

async function driftWs(h, { marked, reportPath, report }) {
  const ws = mkWs("e432-ac8-");
  await h.seed(ws, F, "code-reviewer", "In_Progress", marked ? { chainPath: "test-first" } : {});
  put(ws, "tasks.md", "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n- [x] T-3 judged task\n- [ ] T-9 open\n");
  if (reportPath) put(ws, reportPath, report);
  return ws;
}
const driftOf = (h, ws) => JSON.parse(h.m.drift.detectDrift(ws));
const vibeFor = (rep, id) => rep.details.filter((d) => d.includes(id) && /vibe-coding drift/.test(d));

test("AC8: marked feature, PASS-last judge report (root and archive) backs the id; FAIL-last is drift", async () => {
  const passBody = `# QA review — T-3\n\n${PASS_HDR("code-reviewer")}`;
  for (const rel of ["qa_reports/review_T-3.md", `qa_reports/archive/${F}/review_T-3.md`]) {
    const ws = await driftWs(H, { marked: true, reportPath: rel, report: passBody });
    const rep = driftOf(H, ws);
    assert.ok(rep.evidenceBackedIds.includes("T-3"), `${rel}: evidence-backed ${JSON.stringify(rep)}`);
    assert.deepEqual(vibeFor(rep, "T-3"), [], `${rel}: no vibe-coding line for T-3`);
  }
  const failLast = `# QA review — T-3\n\n${PASS_HDR("code-reviewer")}${PASS_HDR("code-reviewer", "FAIL")}`;
  const ws = await driftWs(H, { marked: true, reportPath: "qa_reports/review_T-3.md", report: failLast });
  const rep = driftOf(H, ws);
  assert.ok(!rep.evidenceBackedIds.includes("T-3"));
  assert.ok(vibeFor(rep, "T-3").length > 0, `FAIL-last is reported as drift: ${JSON.stringify(rep.details)}`);
});

test("AC8: unmarked workspace with only APPROVED / CHANGES_REQUESTED code-review files drifts exactly as base", async (t) => {
  if (!BASE) return t.skip(baseSkipReason);
  for (const body of ["# Review\n\nVerdict: APPROVED\n", "# Review\n\nVerdict: CHANGES_REQUESTED\n"]) {
    const a = await driftWs(H, { marked: false, reportPath: "review_reports/review_T-3.md", report: body });
    const b = await driftWs(HB, { marked: false, reportPath: "review_reports/review_T-3.md", report: body });
    assert.equal(norm(JSON.stringify(driftOf(H, a)), a), norm(JSON.stringify(driftOf(HB, b)), b));
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

test("AC10: release s1 accepts (code-reviewer, PASS) only with the marker; unmarked stops with today's text", async () => {
  const marked = releaseFixture(handoffText("code-reviewer", "PASS", true));
  const rm = await runRelease(marked.root, startDry(marked));
  assert.notEqual(rm.code, notPassCode, `marked judge PASS passes s1: ${rm.err}`);
  assert.ok(fs.existsSync(path.join(marked.work, "state.md")), "s1 copied the handoff to the work dir");

  const unmarked = releaseFixture(handoffText("code-reviewer", "PASS", false));
  const ru = await runRelease(unmarked.root, startDry(unmarked));
  assert.equal(ru.code, notPassCode);
  assert.match(ru.err, /RELEASE_STOP PRECONDITION_NOT_PASS: .*is \(code-reviewer, PASS\), expected \(qa-engineer, PASS\) — commit the release gate's \(qa-engineer, PASS\) write to main first/);
  assert.ok(!fs.existsSync(path.join(unmarked.work, "state.md")), "nothing written before the tuple holds");

  const qa = releaseFixture(handoffText("qa-engineer", "PASS", false));
  const rq = await runRelease(qa.root, startDry(qa));
  assert.notEqual(rq.code, notPassCode, `unmarked qa PASS passes s1 as today: ${rq.err}`);
});

test("AC10: the --state pre-input check follows the same judge rule", async () => {
  const run = async (state) => {
    const fx = releaseFixture(handoffText("qa-engineer", "PASS", false));
    put(fx.base, "state.json", JSON.stringify(state));
    return runRelease(fx.root, ["prepare", "--version", "1.2.4", "--state", path.join(fx.base, "state.json"),
      "--tickets", "E7", "--message-file", path.join(fx.base, "nope.txt"), "--dry-run"]);
  };
  const markedJudge = await run({ last_agent: "code-reviewer", status: "PASS", active_feature: "feat", chain_path: "test-first" });
  assert.doesNotMatch(markedJudge.err, /--state must be a/, `marked judge PASS accepted: ${markedJudge.err}`);
  assert.match(markedJudge.err, /RELEASE_STOP USAGE: .*--message-file/, "the check moved on to the next pre-input");
  const unmarkedJudge = await run({ last_agent: "code-reviewer", status: "PASS", active_feature: "feat" });
  assert.match(unmarkedJudge.err, /--state must be a \(qa-engineer, PASS\) snapshot with an active_feature \(got code-reviewer, PASS\)/);
  const qaUnmarked = await run({ last_agent: "qa-engineer", status: "PASS", active_feature: "feat" });
  assert.doesNotMatch(qaUnmarked.err, /--state must be a/, `unmarked qa PASS accepted as today: ${qaUnmarked.err}`);
});

test("AC10: the release-gate line names the judge; unmarked text is byte-identical", () => {
  const args = { version: "1.2.4", oldVersion: "1.2.3", bump: "patch", activeFeature: "feat", tickets: ["E7"] };
  const unmarked = REL.commitMessage(args);
  assert.match(unmarked, /Release gate: feat \(qa-engineer PASS committed to main\)\./);
  assert.equal(REL.commitMessage({ ...args, judge: "qa-engineer" }), unmarked);
  assert.match(REL.commitMessage({ ...args, judge: "code-reviewer" }), /Release gate: feat \(code-reviewer PASS committed to main\)\./);
});

// ---------------------------------------------------------------- AC11 (old path byte-identical vs base)

// Replace the workspace path and every ISO timestamp so two runs in different temp dirs compare equal.
function norm(s, ws) {
  let out = String(s);
  for (const p of new Set([ws, fs.realpathSync(ws)])) out = out.split(p).join("<WS>");
  return out.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g, "<TS>");
}
function evidenceDump(ws) {
  const dir = path.join(ws, "qa_reports");
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) out[f] = norm(fs.readFileSync(path.join(dir, f), "utf-8"), ws);
  return out;
}

// Each scenario drives writes through harness h and returns a transcript of every outcome plus the persisted bytes.
const SCENARIOS = {
  async chain(h, ws) {
    const t = [];
    const rec = async (args) => { const r = await h.upd(ws, args); t.push({ args, rejected: rejected(r), text: text(r) }); };
    await h.seed(ws, F, "pm", "In_Progress");
    for (const a of ["sr-engineer", "code-reviewer", "qa-engineer"]) await rec(w(a, "In_Progress"));
    await rec(w("qa-engineer", "PASS", { completed_tasks: ["T-1"], review_task_ids: ["T-1"], qa_review: "ok" }));
    return t;
  },
  async architectFailLoop(h, ws) {
    const t = [];
    const rec = async (args) => { const r = await h.upd(ws, args); t.push({ args, rejected: rejected(r), text: text(r) }); };
    await h.seed(ws, F, "pm", "In_Progress");
    for (const a of ["architect", "sr-engineer", "code-reviewer", "qa-engineer"]) await rec(w(a, "In_Progress"));
    await rec(w("qa-engineer", "FAIL", { blocking_reason: "bug", review_task_ids: ["T-1"], qa_review: "found a bug" }));
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
    await h.seed(ws, F, "qa-engineer", "In_Progress");
    const r = await h.upd(ws, w("qa-engineer", "In_Progress", { completed_tasks: ["T-9"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async missingEvidence(h, ws) {
    await h.seed(ws, F, "qa-engineer", "In_Progress", { completedTasks: ["T-9"] });
    const r = await h.upd(ws, w("qa-engineer", "PASS", { completed_tasks: ["T-9"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async expectedRedMissing(h, ws) {
    await h.seed(ws, F, "qa-engineer", "In_Progress");
    put(ws, `qa_reports/expected-red_${F}.txt`, "test/x.test.mjs | red\n");
    put(ws, "qa_reports/review_T-1.md", "# QA review - T-1\n\nno sections\n");
    const r = await h.upd(ws, w("qa-engineer", "PASS", { completed_tasks: ["T-1"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async acLogMissing(h, ws) {
    await h.seed(ws, F, "qa-engineer", "In_Progress");
    put(ws, `specs/${F}.md`, SPEC_WITH_PROOF);
    put(ws, "qa_reports/review_T-1.md", judgeReport("T-1", SECTION_ER));
    const r = await h.upd(ws, w("qa-engineer", "PASS", { completed_tasks: ["T-1"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async reproManifestMissing(h, ws) {
    await h.seed(ws, F, "sr-engineer", "In_Progress", { dispatchMode: "bugfix" });
    const r = await h.upd(ws, w("code-reviewer", "In_Progress"));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async missingReviewEvidence(h, ws) {
    await h.seed(ws, F, "code-reviewer", "In_Progress");
    const r = await h.upd(ws, w("qa-engineer", "In_Progress", { review_task_ids: ["T-1"] }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
  async qaReviewTargetRequired(h, ws) {
    await h.seed(ws, F, "qa-engineer", "In_Progress");
    const r = await h.upd(ws, w("qa-engineer", "PASS", { qa_review: "ok" }));
    return [{ rejected: rejected(r), text: text(r) }];
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test(`AC11: unmarked ${name} outcome is identical on the base commit and this branch`, async (t) => {
    if (!BASE) return t.skip(baseSkipReason);
    const wsA = mkWs("e432-ac11a-");
    const wsB = mkWs("e432-ac11b-");
    const a = await fn(H, wsA);
    const b = await fn(HB, wsB);
    const snap = (tr, ws, h) => JSON.stringify({
      tr: tr.map((x) => ({ ...x, text: norm(x.text, ws) })),
      handoff: norm(handoffBytes(ws), ws),
      evidence: evidenceDump(ws),
    });
    assert.equal(snap(a, wsA, H), snap(b, wsB, HB), `${name}: transcript, persisted handoff and evidence bytes identical`);
    assert.ok(a.length > 0);
  });
}

test("AC11: the rejection scenarios still reject on this branch (guards against a vacuous replay)", async () => {
  const expect = {
    completionEvidenceMissing: /QA_COMPLETION_EVIDENCE_MISSING/,
    missingEvidence: /MISSING_EVIDENCE/,
    expectedRedMissing: /EXPECTED_RED_DIFF_MISSING/,
    acLogMissing: /AC_EXECUTION_LOG_MISSING/,
    reproManifestMissing: /REPRO_MANIFEST_MISSING/,
    missingReviewEvidence: /MISSING_REVIEW_EVIDENCE/,
    qaReviewTargetRequired: /QA_REVIEW_TARGET_REQUIRED/,
  };
  for (const [name, re] of Object.entries(expect)) {
    const ws = mkWs("e432-ac11c-");
    const [r] = await SCENARIOS[name](H, ws);
    assert.ok(r.rejected, `${name} rejected`);
    assert.match(r.text, re, name);
  }
  const ws = mkWs("e432-ac11d-");
  const t = await SCENARIOS.chain(H, ws);
  assert.ok(t.every((x) => !x.rejected), "the unmarked chain still passes end to end");
});

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
    await reseed("qa-engineer", ["T-1"]);
    await go(w("qa-engineer", "PASS", { completed_tasks: ["T-1"] }));
    await reseed("qa-engineer");
    await go(w("qa-engineer", "PASS", { qa_review: "ok" }));
    await reseed("qa-engineer");
    await go(w("qa-engineer", "PASS", { completed_tasks: ["T-2"], review_task_ids: ["T-2"], qa_review: "all good" }));
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

test("AC12: SQLite rejections and a qa PASS with qa_review replay identically on base and branch; storage files byte-identical", async (t) => {
  if (!CUR.sqlite) return t.skip("better-sqlite3 not installed");
  if (!BASE) return t.skip(baseSkipReason);
  const cur = await sqliteRun(CUR, "cur");
  const base = await sqliteRun(BASE, "base");
  assert.deepEqual(cur.out, base.out);
  assert.deepEqual(cur.rows, base.rows, "reports rows identical");
  assert.match(cur.out[0].text, /MISSING_EVIDENCE/);
  assert.match(cur.out[1].text, /QA_REVIEW_TARGET_REQUIRED/);
  assert.ok(!cur.out[2].rejected, `qa PASS with qa_review accepted: ${cur.out[2].text}`);
  assert.equal(cur.rows.length, 1);
  assert.equal(CUR.versions.CURRENT_VERSIONS.sqlite, 2);
  for (const f of ["tools/storage-sqlite.ts", "schema/migrations-sqlite.ts"]) {
    assert.equal(fs.readFileSync(path.join(ROOT, f), "utf-8"), BASE.srcText[f], `${f} byte-identical to base`);
  }
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

test("AC14: registry 35, pipeline 17 (names and order as base), evidence schema 2, handoff 16, sqlite 2, CLAUDE.md 250 lines", async () => {
  assert.equal(CUR.gates.GATE_REGISTRY.length, 35);
  const pipe = CUR.orchestrator.UPDATE_STATE_GATE_PIPELINE;
  assert.equal(pipe.length, 17);
  if (BASE) {
    assert.deepEqual(pipe.map((s) => s.name), BASE.orchestrator.UPDATE_STATE_GATE_PIPELINE.map((s) => s.name), "same step names, same order");
  } else {
    console.warn(`[WARN] e432 AC14: step-name comparison against base skipped: ${baseSkipReason}`);
  }
  const ev = await import(pathToFileURL(path.join(ROOT, "dist/gates/evidence-schema.js")).href);
  assert.equal(ev.EVIDENCE_SCHEMA_CURRENT, 2);
  assert.equal(CUR.versions.CURRENT_VERSIONS.handoff, 16);
  assert.equal(CUR.versions.CURRENT_VERSIONS.sqlite, 2);
  const lines = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf-8").split("\n");
  const count = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  assert.equal(count, 250);
});

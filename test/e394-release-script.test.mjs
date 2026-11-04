// Coded by @qa-engineer
// T-E394-11: contract tests for scripts/release.mjs (specs/e394-release-sop-rewrite.md AC-S1..S9, AC-L1 S-class).
//
// WHY: the release mechanics moved out of SOP prose into one script, so the script's contract (one exit
// code per failure class, a last-stderr-line stop record, no mutation under --dry-run, a closed git/gh verb
// set, idempotent re-runs) is what keeps a model from re-interpreting a release. Every lesson the old SOP
// carried as a paragraph is an assertion here; its test title carries `L:<id>` so the AC-L1 meta-assertion
// in test/e394-release-sop.test.mjs can find it.
//
// Harness: real git in a throwaway repo under os.tmpdir() with a local bare `origin`; only `gh` (a PATH shim
// that logs mutating calls and performs the merge on the bare origin) and the three absorbed node scripts
// plus bin/agc-init.mjs (stubs the tests configure) are simulated. Nothing here touches a real remote.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync, execFileSync } from "node:child_process";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO, "scripts", "release.mjs");
const rel = await import(pathToFileURL(SCRIPT).href);
const ARCH = fs.readFileSync(path.join(REPO, "specs", "e394-release-sop-rewrite-architecture.md"), "utf-8");
const ARCH405 = fs.readFileSync(path.join(REPO, "specs", "e405-release-cd-architecture.md"), "utf-8");
const MANUAL_PHASES = ["prepare", "publish", "close-out"];

// ---------------------------------------------------------------- fixture

const STUB = `import fs from "node:fs"; import path from "node:path";
const name = path.basename(process.argv[1]), args = process.argv.slice(2);
if (process.env.STUB_LOG) fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ name, args }) + "\\n");
const cfg = process.env.STUB_CFG && fs.existsSync(process.env.STUB_CFG) ? JSON.parse(fs.readFileSync(process.env.STUB_CFG, "utf8")) : {};
const key = name === "verify-release.mjs" ? (args.includes("--ci-check") ? "ci" : args.includes("--close-out") ? "closeout" : "self") : name;
const c = cfg[key] ?? {};
const defaults = { ci: "CI-CHECK PASSED\\n", closeout: "CLOSE-OUT PASSED\\n" };
if (c.stderrBytes) process.stderr.write(("x".repeat(79) + "\\n").repeat(Math.ceil(c.stderrBytes / 80)));
if (c.stderr) process.stderr.write(c.stderr);
process.stdout.write(c.stdout ?? defaults[key] ?? "OK\\n");
process.exit(c.status ?? 0);
`;

const GH_SHIM = `#!/usr/bin/env node
const fs = require("node:fs"), cp = require("node:child_process"), path = require("node:path"), os = require("node:os");
const a = process.argv.slice(2), S = process.env.GH_STATE, L = process.env.GH_LOG;
const st = JSON.parse(fs.readFileSync(S, "utf8")), save = () => fs.writeFileSync(S, JSON.stringify(st));
const log = (l) => fs.appendFileSync(L, l + "\\n");
const git = (args, cwd) => cp.execFileSync("git", args, { cwd, encoding: "utf8", env: process.env }).trim();
const flag = (n) => a[a.indexOf(n) + 1];
const k = a.slice(0, 2).join(" ");
if (k === "auth status") { if (st.authFail) { console.error("not logged in"); process.exit(1); } process.exit(0); }
if (k === "pr view") {
  const pr = st.prs[a[2]];
  if (!pr) { console.error("no pull requests found for branch"); process.exit(1); }
  console.log(JSON.stringify(pr)); process.exit(0);
}
if (k === "pr create") {
  log(JSON.stringify(a));
  if (st.createFail) { console.error("create refused"); process.exit(1); }
  const head = flag("--head"), n = ++st.n;
  st.prs[head] = { number: n, state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN",
    statusCheckRollup: [{ conclusion: "SUCCESS" }], mergeCommit: null, headRefOid: git(["rev-parse", "refs/heads/" + head], process.cwd()) };
  save(); console.log("https://github.com/o/r/pull/" + n); process.exit(0);
}
if (k === "pr merge") {
  log(a.join(" "));
  if (st.mergeFail) { console.error("merge blocked"); process.exit(1); }
  const br = Object.keys(st.prs).find((b) => String(st.prs[b].number) === a[2]), pr = st.prs[br];
  if (st.autoMerge !== false) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e394-gh-"));
    git(["clone", "-q", st.origin, tmp]); git(["config", "commit.gpgsign", "false"], tmp); git(["checkout", "-q", "main"], tmp);
    git(["merge", "--no-ff", "-q", "-m", "Merge pull request #" + pr.number, "origin/" + br], tmp); git(["push", "-q", "origin", "main"], tmp);
    pr.mergeCommit = { oid: git(["rev-parse", "HEAD"], tmp) }; pr.state = "MERGED";
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  save(); process.exit(0);
}
if (k === "release view") { process.exit(st.releases.includes(a[2]) ? 0 : 1); }
if (k === "release create") { log(JSON.stringify(a)); st.releases.push(a[2]); save(); process.exit(0); }
process.exit(0);
`;

const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

const sha = (s) => createHash("sha256").update(s).digest("hex");
const lastLine = (s) => String(s).trim().split("\n").filter(Boolean).pop() ?? "";

function layout(base, version, baseVersion) {
  const fx = { base, root: path.join(base, "repo"), origin: path.join(base, "origin.git"), bin: path.join(base, "bin"), inputs: path.join(base, "inputs"), version, baseVersion, tag: `v${version}`, relBranch: `release/v${version}`, feature: "feat" };
  fx.env = {
    ...process.env, PATH: `${fx.bin}${path.delimiter}${process.env.PATH}`,
    GIT_AUTHOR_NAME: "QA Fixture", GIT_AUTHOR_EMAIL: "qa@example.com", GIT_COMMITTER_NAME: "QA Fixture", GIT_COMMITTER_EMAIL: "qa@example.com",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull, GIT_TERMINAL_PROMPT: "0",
    GH_STATE: path.join(fx.inputs, "gh-state.json"), GH_LOG: path.join(fx.inputs, "gh.log"),
    STUB_CFG: path.join(fx.inputs, "stub.json"), STUB_LOG: path.join(fx.inputs, "stub.log"),
    AGC_RELEASE_MERGE_WAIT_SECONDS: "0", AGC_RELEASE_POLL_SECONDS: "1",
  };
  fx.put = (p, text) => { fs.mkdirSync(path.dirname(path.join(fx.root, p)), { recursive: true }); fs.writeFileSync(path.join(fx.root, p), text); };
  return fx;
}

// The expensive part (init, commit, tag, bare origin, push) runs once per option set; each test copies it.
const templates = new Map();
function buildTemplate({ baseVersion, version, spec, baseline }) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e394-rs-tpl-")));
  cleanup.push(base);
  const fx = layout(base, version, baseVersion), put = fx.put;
  for (const d of [fx.root, fx.bin, fx.inputs]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(fx.env.GH_STATE, JSON.stringify({ n: 0, prs: {}, releases: [], origin: fx.origin }));
  fs.writeFileSync(path.join(fx.bin, "gh"), GH_SHIM, { mode: 0o755 });
  put("package.json", JSON.stringify({ name: "fx", version: baseVersion }, null, 2) + "\n");
  put("index.ts", `const v = "${baseVersion}";\n`);
  put("README.md", `Install: npm i github:o/r#v${baseVersion}\n`);
  put("CHANGELOG.md", `# Changelog\n\n## [${baseVersion}] - 2026-01-01\n- initial\n`);
  put("docs/backlog.md", "# Backlog\n\n| id | desc |\n|---|---|\n| E7 | feature seven |\n| E8 | other feature |\n");
  put("CLAUDE.md", `# Claude\n<!-- agc-version: ${baseVersion} -->\n`);
  put("AGENTS.md", `# Agents\n# agc-version: ${baseVersion}\n`);
  put(".antigravityrules", `# rules\n# agc-version: ${baseVersion}\n`);
  put("tasks.md", "# Tasks\n- [x] T-E7-01\n");
  put(".current/lane1/handoff.md", "---\nlast_agent: qa-engineer\nstatus: PASS\n---\n# Handoff\n\n## Pending & Handoff Notes\n- QA PASS\n");
  put(".current/lane1/events.jsonl", "{\"n\":1}\n");
  put("scripts/release.mjs", fs.readFileSync(SCRIPT, "utf-8"));
  for (const s of ["scripts/check-version.mjs", "scripts/check-bookkeeping.mjs", "scripts/verify-release.mjs", "bin/agc-init.mjs"]) put(s, STUB);
  if (baseline) put("qa_reports/archive/old/review_T-OLD-01.md", "old\n");
  if (spec) put("specs/feat.md", "# feat\n");
  const g = (...a) => git(fx, ...a);
  g("init", "-q", "-b", "main"); g("config", "commit.gpgsign", "false"); g("add", "-A"); g("commit", "-q", "-m", "init"); g("tag", `v${baseVersion}`);
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", fx.origin], { env: fx.env });
  g("remote", "add", "origin", fx.origin); g("push", "-q", "-u", "origin", "main", `v${baseVersion}`);
  return base;
}
function mkFixture(o = {}) {
  const { baseVersion = "1.2.3", version = "1.2.4", spec = false, baseline = true, onMain = false } = o;
  const key = JSON.stringify([baseVersion, version, spec, baseline]);
  if (!templates.has(key)) templates.set(key, buildTemplate({ baseVersion, version, spec, baseline }));
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e394-rs-")));
  cleanup.push(base);
  fs.cpSync(templates.get(key), base, { recursive: true });
  const fx = layout(base, version, baseVersion);
  fs.writeFileSync(fx.env.GH_STATE, JSON.stringify({ n: 0, prs: {}, releases: [], origin: fx.origin }));
  git(fx, "remote", "set-url", "origin", fx.origin);
  if (!onMain) git(fx, "switch", "-q", "-c", fx.relBranch);
  return fx;
}
const git = (fx, ...args) => execFileSync("git", args, { cwd: fx.root, encoding: "utf-8", env: fx.env }).trim();
const gitTry = (fx, ...args) => spawnSync("git", args, { cwd: fx.root, encoding: "utf-8", env: fx.env });
const gitOrigin = (fx, ...args) => execFileSync("git", ["--git-dir", fx.origin, ...args], { encoding: "utf-8", env: fx.env }).trim();
const ghState = (fx, fn) => { const s = JSON.parse(fs.readFileSync(fx.env.GH_STATE, "utf8")); fn(s); fs.writeFileSync(fx.env.GH_STATE, JSON.stringify(s)); };
const ghLog = (fx) => (fs.existsSync(fx.env.GH_LOG) ? fs.readFileSync(fx.env.GH_LOG, "utf8").split("\n").filter(Boolean) : []);
const stubCfg = (fx, cfg) => fs.writeFileSync(fx.env.STUB_CFG, JSON.stringify(cfg));
const stubLog = (fx) => (fs.existsSync(fx.env.STUB_LOG) ? fs.readFileSync(fx.env.STUB_LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const read = (fx, p) => fs.readFileSync(path.join(fx.root, p), "utf-8");
const exists = (fx, p) => fs.existsSync(path.join(fx.root, p));

// The edits SOP steps 7, 10 and 11 leave on the release branch before `prepare`.
function workTree(fx, o = {}) {
  const { baseVersion: b, version: v } = fx;
  if (!o.noBump) {
    fx.put("package.json", JSON.stringify({ name: "fx", version: v }, null, 2) + "\n");
    fx.put("index.ts", `const v = "${v}";\n`);
    fx.put("README.md", `Install: npm i github:o/r#v${v}\n`);
  }
  const cited = o.cite ?? "`content/foo.md`";
  fx.put("CHANGELOG.md", `# Changelog\n\n## [${v}] - 2026-01-02\n\n### Added\n- Thing in ${cited}.\n\n## [${b}] - 2026-01-01\n- initial\n`);
  fx.put("content/foo.md", "foo\n");
  if (!fx.spec && !o.noSpec) fx.put("specs/feat.md", "# feat\n");
  fx.put("qa_reports/review_T-E7-01.md", "review\n");
  if (o.doneMark !== false) fx.put("docs/backlog.md", `# Backlog\n\n| id | desc |\n|---|---|\n| E7 | **DONE v${v}**: feature seven |\n| E8 | other feature |\n`);
}
const state = (fx, over = {}) => {
  const p = path.join(fx.inputs, "state.json");
  fs.writeFileSync(p, JSON.stringify({ last_agent: "qa-engineer", status: "PASS", active_feature: "feat", completed_tasks: ["T-E7-01"], scope_decision_why: "", pending_notes: [], ...over }));
  return p;
};
const msgFile = (fx, text) => {
  const p = path.join(fx.inputs, "msg.txt");
  fs.writeFileSync(p, text ?? `chore(release): v${fx.version} — add the thing\n\nBody line.\n`);
  return p;
};
const prepareArgs = (fx, extra = [], o = {}) => ["prepare", "--version", fx.version, "--state", o.state ?? state(fx), "--tickets", o.tickets ?? "E7", "--message-file", o.msg ?? msgFile(fx), ...extra];
const lane = (name = "lane1") => async () => ({ resolveCurrentLane: () => name });

async function runMain(fx, argv, extra = {}) {
  const calls = [], outs = [], errs = [];
  const recorder = (bin, args, opts) => { calls.push({ bin, args: [...args], shell: opts?.shell }); return spawnSync(bin, args, opts); };
  const code = await rel.main(argv, {
    root: fx.root, env: { ...fx.env, ...(extra.env ?? {}) }, out: (s) => outs.push(s), err: (s) => errs.push(s),
    spawn: recorder, sleep: async () => {}, importLanePaths: extra.importLanePaths ?? lane(),
  });
  const cmds = calls.map((c) => (c.bin === process.execPath ? `node ${path.relative(fx.root, c.args[0])} ${c.args.slice(1).join(" ")}`.trim() : `${c.bin} ${c.args.join(" ")}`));
  return { code, out: outs.join(""), err: errs.join(""), calls, cmds };
}
const stopLine = (r) => lastLine(r.err);
const steps = (out) => [...out.matchAll(/^release: (?:DRY-RUN )?\[([^\]]+)\]/gm)].map((m) => m[1]).filter((s, i, a) => s !== a[i - 1]);

async function prepared(fx, o = {}) {
  workTree(fx, o);
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, `prepare must succeed on the good fixture: ${r.err}`);
  return r;
}
function closeOutTree(fx, o = {}) {
  if (o.closing !== false) {
    fx.put(".current/lane1/handoff.md", `---\nlast_agent: release-engineer\nstatus: In_Progress\nnext_role: pm\n---\n# Handoff\n\n## Pending & Handoff Notes\n- Released v${fx.version}\n- tag: deadbeef\n`);
    fx.put(".current/lane1/events.jsonl", "{\"n\":1}\n{\"n\":2}\n");
  }
  fx.put(".current/lane1/scratch.txt", "not a jsonl\n");
}

function snapshot(fx) {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === ".git") continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push([path.relative(fx.root, p), sha(fs.readFileSync(p))]); } };
  walk(fx.root);
  return {
    status: git(fx, "status", "--porcelain=v1", "-uall"), index: git(fx, "ls-files", "-s"), refs: git(fx, "for-each-ref"),
    originRefs: gitOrigin(fx, "for-each-ref"), head: git(fx, "rev-parse", "HEAD"), branch: git(fx, "rev-parse", "--abbrev-ref", "HEAD"),
    files: JSON.stringify(files.sort()), gh: JSON.stringify(ghLog(fx)),
  };
}

// ---------------------------------------------------------------- AC-S2 contract

const archRows = (text = ARCH) => text.split("\n").filter((l) => /^\| \d+ \| [A-Z_]+ \|/.test(l)).map((l) => {
  const c = l.split("|").map((x) => x.trim());
  return { code: Number(c[1]), id: c[2], phases: c[3].split(",").map((x) => x.trim()) };
});

const archRows405 = () => archRows(ARCH405);

test("AC-R10 exit table equals the E394 and E405 architecture tables row for row (AC-S2)", () => {
  // WHY (AC-R10): the table only grows. The 31 E394 rows keep code and id and may gain the runner phases;
  // the E405 architecture's table is the union and the code must equal it row for row.
  const want = archRows405(), e394 = archRows(ARCH);
  assert.equal(e394.length, 31, "the E394 architecture's Exit-Code Table has 31 classes");
  assert.equal(want.length, 42, "the E405 architecture's Exit-Code Table has 42 classes (31 + 11 runner-only)");
  assert.deepEqual(rel.EXIT_CLASSES.map((c) => ({ code: c.code, id: c.id, phases: [...c.phases] })), want);
  for (const old of e394) {
    const row = want.find((w) => w.code === old.code);
    assert.ok(row && row.id === old.id, `${old.id} keeps code ${old.code}`);
    assert.ok(old.phases.every((p) => row.phases.includes(p)), `${old.id} keeps its E394 phases`);
  }
  assert.equal(new Set(rel.EXIT_CLASSES.map((c) => c.code)).size, 42, "codes are distinct");
  assert.equal(new Set(rel.EXIT_CLASSES.map((c) => c.id)).size, 42, "ids are distinct");
  assert.ok(rel.EXIT_CLASSES.every((c) => c.code > 0 && Object.isFrozen(c)), "no class exits 0; rows are frozen");
  assert.ok(Object.isFrozen(rel.EXIT_CLASSES));
  assert.deepEqual([...rel.RUNNER_PHASES], ["start", "record"]);
});

// One trigger per failure class: [phase, setup(fx) -> run options]. Each runs on its own fixture.
const TRIGGERS = {
  INTERNAL: { phase: "prepare", run: async (fx) => { workTree(fx); fs.rmSync(path.join(fx.root, "package.json")); return runMain(fx, prepareArgs(fx)); } },
  USAGE: { phase: "prepare", run: async (fx) => runMain(fx, ["prepare", "--version", "v1"]) },
  WRONG_BRANCH: { phase: "prepare", run: async (fx) => { git(fx, "switch", "-q", "main"); return runMain(fx, prepareArgs(fx)); } },
  STALE_BASE: { phase: "prepare", run: async (fx) => { advanceOrigin(fx); return runMain(fx, prepareArgs(fx)); } },
  VERSION_INCOHERENT: { phase: "prepare", run: async (fx) => { workTree(fx, { noBump: true }); return runMain(fx, prepareArgs(fx)); } },
  UNRELATED_CHANGES: { phase: "prepare", run: async (fx) => { workTree(fx); fx.put("stray.txt", "x\n"); return runMain(fx, prepareArgs(fx)); } },
  GH_UNAVAILABLE: { phase: "prepare", run: async (fx) => { ghState(fx, (s) => { s.authFail = true; }); workTree(fx); return runMain(fx, prepareArgs(fx)); } },
  EMPTY_BASELINE: { phase: "prepare", run: async (fx) => { workTree(fx); fx.put("review_reports/review_T-E7-02.md", "r\n"); return runMain(fx, prepareArgs(fx)); } },
  DRIFT_BASELINE: { phase: "prepare", run: async (fx) => { workTree(fx); fx.put(".current/.config.json", "{\"driftBaselineIds\": \"x\"}\n"); return runMain(fx, prepareArgs(fx)); } },
  DONE_MARK: { phase: "prepare", run: async (fx) => { workTree(fx, { doneMark: false }); return runMain(fx, prepareArgs(fx)); } },
  BOOKKEEPING_CHECK: { phase: "prepare", run: async (fx) => { workTree(fx); stubCfg(fx, { "check-bookkeeping.mjs": { status: 1, stderr: "id order broken\n" } }); return runMain(fx, prepareArgs(fx)); } },
  ADAPTER_STAMP: { phase: "prepare", run: async (fx) => { workTree(fx); fx.put("AGENTS.md", "# Agents\n"); return runMain(fx, prepareArgs(fx)); } },
  STAGING_INCOMPLETE: { phase: "prepare", run: async (fx) => {
    workTree(fx); fx.put("CLAUDE.md", `# Claude\n<!-- agc-version: ${fx.version} -->\n`); fx.put("AGENTS.md", `# Agents\n# agc-version: ${fx.version}\n`);
    fx.put(".antigravityrules", `# rules\n# agc-version: ${fx.version}\n`); fs.rmSync(path.join(fx.root, "qa_reports/review_T-E7-01.md"));
    git(fx, "add", "-A"); git(fx, "commit", "-q", "-m", "wip");
    return runMain(fx, prepareArgs(fx, [], { state: state(fx, { completed_tasks: [] }) }));
  } },
  CHANGELOG_CITATION: { phase: "prepare", run: async (fx) => { workTree(fx, { cite: "`content/missing.md`" }); return runMain(fx, prepareArgs(fx)); } },
  SPEC_REQUIRE: { phase: "prepare", run: async (fx) => { workTree(fx); return runMain(fx, prepareArgs(fx)); }, opts: { spec: true } },
  SPEC_UNCLASSIFIABLE: { phase: "prepare", run: async (fx) => { workTree(fx, { noSpec: true }); return runMain(fx, prepareArgs(fx)); } },
  PUSH_REJECTED: { phase: "prepare", run: async (fx) => { divergeOriginBranch(fx, fx.relBranch); workTree(fx); return runMain(fx, prepareArgs(fx)); } },
  MUTATION_FAILED: { phase: "prepare", run: async (fx) => {
    fs.writeFileSync(path.join(fx.root, ".git/hooks/pre-commit"), "#!/bin/sh\necho blocked >&2\nexit 1\n", { mode: 0o755 });
    workTree(fx); return runMain(fx, prepareArgs(fx));
  } },
  TAG_EXISTS: { phase: "publish", run: async (fx) => { await prepared(fx); git(fx, "tag", "-a", fx.tag, "-m", "stray"); return runMain(fx, ["publish", "--version", fx.version]); } },
  CI_GATE_FAILED: { phase: "publish", run: async (fx) => { await prepared(fx); stubCfg(fx, { ci: { status: 1, stdout: "CI-CHECK FAILED\n", stderr: "FAIL: red\n" } }); return runMain(fx, ["publish", "--version", fx.version]); } },
  PR_CANNOT_MERGE: { phase: "publish", run: async (fx) => { await prepared(fx); ghState(fx, (s) => { s.prs[fx.relBranch].mergeable = "CONFLICTING"; }); return runMain(fx, ["publish", "--version", fx.version]); } },
  MERGE_WAIT_TIMEOUT: { phase: "publish", run: async (fx) => { await prepared(fx); ghState(fx, (s) => { s.autoMerge = false; }); return runMain(fx, ["publish", "--version", fx.version]); } },
  MAIN_DIVERGED: { phase: "publish", run: async (fx) => {
    await prepared(fx); git(fx, "switch", "-q", "main"); fx.put("local-only.txt", "x\n"); git(fx, "add", "-A"); git(fx, "commit", "-q", "-m", "local main commit"); git(fx, "switch", "-q", fx.relBranch);
    return runMain(fx, ["publish", "--version", fx.version]);
  } },
  SELF_CHECK_FAILED: { phase: "publish", run: async (fx) => { await prepared(fx); stubCfg(fx, { self: { status: 1, stderr: "FAIL: tag not on origin\n" } }); return runMain(fx, ["publish", "--version", fx.version]); } },
  CLOSING_WRITE_ABSENT: { phase: "close-out", run: async (fx) => { closeOutTree(fx, { closing: false }); return runMain(fx, ["close-out", "--version", fx.version]); }, opts: { onMain: true } },
  LANE_UNRESOLVED: { phase: "close-out", run: async (fx) => { closeOutTree(fx); return runMain(fx, ["close-out", "--version", fx.version], { importLanePaths: async () => { throw new Error("no lane"); } }); }, opts: { onMain: true } },
  EMPTY_STAGE: { phase: "close-out", run: async (fx) => {
    fx.put(".current/lane1/handoff.md", `---\nlast_agent: release-engineer\nstatus: In_Progress\nnext_role: pm\n---\n# Handoff\n\n## Pending & Handoff Notes\n- Released v${fx.version}\n`);
    git(fx, "add", "-A"); git(fx, "commit", "-q", "-m", "handoff"); git(fx, "push", "-q", "origin", "main");
    return runMain(fx, ["close-out", "--version", fx.version]);
  }, opts: { onMain: true } },
  BRANCH_EXISTS: { phase: "close-out", run: async (fx) => { closeOutTree(fx); divergeOriginBranch(fx, `${fx.relBranch}-bookkeeping`); return runMain(fx, ["close-out", "--version", fx.version]); }, opts: { onMain: true } },
  CLOSE_OUT_NO_UPSTREAM: { phase: "close-out", run: async (fx) => { closeOutTree(fx); stubCfg(fx, { closeout: { status: 1, stderr: "FAIL: no upstream tracking branch configured\n" } }); return runMain(fx, ["close-out", "--version", fx.version]); }, opts: { onMain: true } },
  CLOSE_OUT_AHEAD: { phase: "close-out", run: async (fx) => { closeOutTree(fx); stubCfg(fx, { closeout: { status: 1, stderr: "FAIL: HEAD is 1 commit(s) ahead of upstream origin/main\n" } }); return runMain(fx, ["close-out", "--version", fx.version]); }, opts: { onMain: true } },
  CLOSE_OUT_UNVERIFIED: { phase: "close-out", run: async (fx) => { closeOutTree(fx); stubCfg(fx, { closeout: { status: 1, stderr: "FAIL: git fetch failed\n" } }); return runMain(fx, ["close-out", "--version", fx.version]); }, opts: { onMain: true } },
};

function advanceOrigin(fx) {
  const tmp = fs.mkdtempSync(path.join(fx.base, "adv-"));
  execFileSync("git", ["clone", "-q", fx.origin, tmp], { env: fx.env });
  fs.writeFileSync(path.join(tmp, "advance.txt"), "x\n");
  for (const a of [["config", "commit.gpgsign", "false"], ["add", "-A"], ["commit", "-q", "-m", "advance"], ["push", "-q", "origin", "main"]]) execFileSync("git", a, { cwd: tmp, env: fx.env });
}
function divergeOriginBranch(fx, branch) {
  const tmp = fs.mkdtempSync(path.join(fx.base, "div-"));
  execFileSync("git", ["clone", "-q", fx.origin, tmp], { env: fx.env });
  for (const a of [["config", "commit.gpgsign", "false"], ["switch", "-q", "-c", branch]]) execFileSync("git", a, { cwd: tmp, env: fx.env });
  fs.writeFileSync(path.join(tmp, "other.txt"), "x\n");
  for (const a of [["add", "-A"], ["commit", "-q", "-m", "diverge"], ["push", "-q", "origin", branch]]) execFileSync("git", a, { cwd: tmp, env: fx.env });
}

test("AC-R10 one exit code per manual-phase failure class (AC-S2)", async () => {
  // WHY (AC-R10): these triggers drive the three manual phases; the 11 runner-only classes are driven by test/e405-release-runner.test.mjs.
  const manual = rel.EXIT_CLASSES.filter((c) => c.phases.some((p) => MANUAL_PHASES.includes(p)));
  assert.equal(manual.length, 31);
  assert.deepEqual(Object.keys(TRIGGERS).sort(), manual.map((c) => c.id).sort(), "every manual-phase class has a trigger");
  for (const cls of manual) {
    const t = TRIGGERS[cls.id];
    assert.ok(cls.phases.includes(t.phase), `${cls.id}: trigger phase ${t.phase} is one of its phases`);
    const fx = mkFixture(t.opts ?? {});
    const r = await t.run(fx);
    assert.equal(r.code, cls.code, `${cls.id}: exit code (stderr: ${r.err.slice(-300)})`);
    assert.match(stopLine(r), new RegExp(`^RELEASE_STOP ${cls.id}: .+`), `${cls.id}: last stderr line is the stop record`);
    assert.equal(r.err.trim().split("\n").filter((l) => l.startsWith("RELEASE_STOP ")).length, 1, `${cls.id}: exactly one stop record`);
  }
});

test("AC-S2 --help and a good run exit 0 and print no stop record", async () => {
  const h = await rel.main(["--help"], { out: () => {}, err: () => {} });
  assert.equal(h, 0);
  const fx = mkFixture();
  workTree(fx);
  const r = await runMain(fx, prepareArgs(fx, ["--dry-run"]));
  assert.equal(r.code, 0);
  assert.ok(!/RELEASE_STOP/.test(r.err));
});

test("AC-S2 the stop record is the last stderr line through a real child with piped stderr (R2)", async () => {
  // WHY: a CLI whose final RELEASE_STOP line can be cut by process.exit when stderr is a pipe is not
  // a contract. A large child stderr is forwarded first and the reader is slow, forcing backpressure.
  const fx = mkFixture();
  workTree(fx, { noBump: true });
  stubCfg(fx, { "check-version.mjs": { status: 1, stderrBytes: 3_000_000, stderr: "lockfile drift\n" } });
  const child = spawn(process.execPath, [path.join(fx.root, "scripts", "release.mjs"), ...prepareArgs(fx)], { cwd: fx.root, env: fx.env, stdio: ["ignore", "pipe", "pipe"] });
  const chunks = [];
  child.stdout.resume();
  child.stderr.pause();
  setTimeout(() => child.stderr.resume(), 500);
  child.stderr.on("data", (d) => chunks.push(d));
  const code = await new Promise((res) => child.on("close", res));
  const err = Buffer.concat(chunks).toString("utf-8");
  assert.equal(code, 12, "VERSION_INCOHERENT exits 12");
  assert.match(lastLine(err), /^RELEASE_STOP VERSION_INCOHERENT: /, `last stderr line; tail was ${JSON.stringify(err.slice(-120))}`);
});

test("AC-S2 every non-zero path through a real child prints the stop record last", () => {
  const fx = mkFixture();
  for (const argv of [["nope"], ["prepare"], ["publish", "--version", "1.x"], ["close-out", "--version", fx.version, "--bogus"]]) {
    const r = spawnSync(process.execPath, [path.join(fx.root, "scripts", "release.mjs"), ...argv], { cwd: fx.root, env: fx.env, encoding: "utf-8" });
    assert.equal(r.status, 2, argv.join(" "));
    assert.match(lastLine(r.stderr), /^RELEASE_STOP USAGE: /, argv.join(" "));
  }
});

test("AC-S2 VERSION_INCOHERENT stops a stale README pin, not a correct bump whose version extends the old one (R3)", async () => {
  // WHY: v1.2.1 -> 1.2.10 is a correct bump; "#v1.2.10" merely starts with the old pin "#v1.2.1".
  const fx = mkFixture({ baseVersion: "1.2.1", version: "1.2.10" });
  workTree(fx);
  const ok = await runMain(fx, prepareArgs(fx, ["--dry-run"]));
  assert.equal(ok.code, 0, `a correct bump must pass: ${stopLine(ok)}`);
  const fy = mkFixture();
  workTree(fy);
  fy.put("README.md", `Install: npm i github:o/r#v${fy.baseVersion} and #v${fy.version}\n`);
  const stale = await runMain(fy, prepareArgs(fy, ["--dry-run"]));
  assert.equal(stale.code, 12, "an old pin left in README still stops");
});

// ---------------------------------------------------------------- AC-S1 dry-run

const ORDER = {
  prepare: ["pre-2", "pre-3", "pre-4", "pre-5", "pre-6", "7a", "7b", "7c", "7d", "8a-1", "8a-2", "8a-3", "8a-4", "8a-5", "8a-6"],
  publish: ["pre-2", "pre-3", "8b-1", "8b-2", "8c-1", "8c-2", "8c-3", "8c-4", "8c-5", "8c-6", "9", "9a"],
  "close-out": ["pre-2", "pre-3", "13a-1", "13a-3", "13a-4", "13a-5", "13a-6", "13b"],
};
const MUTATING = {
  prepare: ["7a", "7b", "7d", "8a-1", "8a-4", "8a-5", "8a-6"],
  publish: ["8c-1", "8c-4", "8c-5", "8c-6", "9"],
  "close-out": ["13a-4", "13a-5", "13a-6"],
};

test("AC-S1 dry-run mutates nothing, per phase", async () => {
  for (const phase of ["prepare", "publish", "close-out"]) {
    const fx = mkFixture({ onMain: phase === "close-out" });
    let argv;
    if (phase === "prepare") { workTree(fx); argv = prepareArgs(fx, ["--dry-run"]); }
    else if (phase === "publish") { await prepared(fx); argv = ["publish", "--version", fx.version, "--dry-run"]; }
    else { closeOutTree(fx); argv = ["close-out", "--version", fx.version, "--dry-run"]; }
    const before = snapshot(fx);
    const r = await runMain(fx, argv);
    assert.equal(r.code, 0, `${phase}: ${r.err}`);
    assert.deepEqual(snapshot(fx), before, `${phase}: tree, index, refs, origin and gh mutation log unchanged`);
    assert.match(lastLine(r.out), new RegExp(`^release: ${phase} DRY-RUN OK \\(v${fx.version.replace(/\./g, "\\.")}\\) — nothing changed$`));
    const seen = steps(r.out), idx = seen.map((s) => ORDER[phase].indexOf(s));
    assert.ok(!idx.includes(-1), `${phase}: unknown step label in ${seen}`);
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${phase}: actions print in step order: ${seen}`);
    for (const s of MUTATING[phase]) assert.match(r.out, new RegExp(`^release: DRY-RUN \\[${s}\\] `, "m"), `${phase}: mutation ${s} is printed as planned`);
    assert.ok(r.calls.every((c) => !/^(add|commit|push|tag|switch|branch|pull)$/.test(c.args[c.args[0] === "-c" ? 2 : 0]) || c.bin !== "git"), `${phase}: no mutating git call reached the spawn seam`);
  }
});

test("AC-S1 a real run changes what the dry-run said it would (prepare)", async () => {
  const fx = mkFixture();
  workTree(fx);
  const dry = await runMain(fx, prepareArgs(fx, ["--dry-run"]));
  const real = await runMain(fx, prepareArgs(fx));
  assert.equal(real.code, 0, real.err);
  assert.deepEqual(steps(dry.out).filter((s) => MUTATING.prepare.includes(s)), steps(real.out).filter((s) => MUTATING.prepare.includes(s)), "same mutating steps");
});

test("AC-S1 runner records mutations without spawning under dry-run, and refuses a call off the allow-list", () => {
  const calls = [];
  const spawnFake = (...a) => { calls.push(a); return { status: 0, stdout: "", stderr: "" }; };
  const outs = [];
  const r = rel.createRunner({ root: os.tmpdir(), dryRun: true, spawn: spawnFake, env: {}, out: (s) => outs.push(s), err: () => {} });
  r.mutate("git", ["push", "-u", "origin", "release/v9.9.9"], { step: "8a-5" });
  assert.equal(calls.length, 0);
  assert.equal(r.actions[0].executed, false);
  assert.throws(() => r.mutate("git", ["reset", "--hard"], { step: "x" }), (e) => e.classId === "INTERNAL");
  assert.throws(() => r.read("git", ["push", "-u", "origin", "release/v9.9.9"], { step: "x" }), (e) => e.classId === "INTERNAL", "a mutating verb cannot pass as a read");
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------- AC-S3 verb allow-list

const ALLOW = [
  /^git add -- \S/, /^git commit -F \S/, /^git commit -m \S/, /^git tag -a v\d+\.\d+\.\d+ -m \S/, /^git push -u origin release\/\S+$/,
  /^git push origin v\d+\.\d+\.\d+$/, /^git switch -c release\/\S+$/, /^git switch main$/, /^git branch -d release\/\S+$/,
  /^git -c pull\.rebase=false pull --ff-only$/, /^git (fetch|diff|log|status|show|ls-tree|ls-files|rev-parse|rev-list|describe|ls-remote)( |$)/,
  /^gh auth status$/, /^gh release view /, /^gh pr create /, /^gh pr merge \d+ --auto --merge$/, /^gh pr view /, /^gh run (list|view)/, /^gh release create /,
  /^node (scripts\/(check-version|verify-release|check-bookkeeping)\.mjs|bin\/agc-init\.mjs)/,
];
const FORBIDDEN = [
  /^git (reset|rebase|clean|stash|update-ref|merge|checkout)\b/, /^git push .*(--force|\s-f\b|--force-with-lease)/, /^git push .*\bmain\b/, /^git tag .*\s-f\b/,
  /^git branch -D\b/, /--squash|--rebase|--admin|--amend/, /^(bash|sh|zsh|npm)\b/,
];

test("AC-S3 verb allow-list and array argv", async () => {
  // Static: one spawn call site, never a shell.
  const src = fs.readFileSync(SCRIPT, "utf-8");
  assert.equal((src.match(/spawn\(bin, argv/g) ?? []).length, 1, "exactly one child-process call site (the runner)");
  assert.ok(!/shell\s*:\s*true/.test(src), "no shell: true");
  assert.ok(!/\b(execSync|execFileSync|execFile)\(/.test(src), "no string exec");
  assert.deepEqual([...src.matchAll(/import \{([^}]*)\} from "node:child_process"/g)].map((m) => m[1].trim()), ["spawnSync"], "only spawnSync is imported");

  // Dynamic: enumerate every child call across all three phases (resume re-runs included).
  const all = [];
  const feed = (r) => all.push(...r.calls.map((c, i) => ({ c, cmd: r.cmds[i] })));
  const fx = mkFixture();
  feed(await prepared(fx));
  feed(await runMain(fx, prepareArgs(fx)));
  feed(await runMain(fx, ["publish", "--version", fx.version]));
  feed(await runMain(fx, ["publish", "--version", fx.version]));
  closeOutTree(fx);
  feed(await runMain(fx, ["close-out", "--version", fx.version]));
  assert.ok(all.length > 40, `enumerated ${all.length} calls`);
  for (const { c, cmd } of all) {
    assert.ok(Array.isArray(c.args) && c.args.every((a) => typeof a === "string"), `array argv: ${cmd}`);
    assert.ok(!c.shell, `no shell option: ${cmd}`);
    assert.ok(ALLOW.some((re) => re.test(cmd)), `on the allow-list: ${cmd}`);
    assert.ok(!FORBIDDEN.some((re) => re.test(cmd)), `not forbidden: ${cmd}`);
  }
  for (const v of ["gh auth status", "gh release view", "git ls-remote", "git add", "git commit", "git tag", "gh pr", "gh release"]) {
    assert.ok(all.some(({ cmd }) => cmd.startsWith(v)), `exercised ${v}`);
  }
  assert.ok(!all.some(({ cmd }) => /^git commit .*--amend/.test(cmd)));
});

test("AC-R11 isAllowed admits the allow-list, the six new shapes, and refuses every absent verb (AC-S3)", () => {
  const yes = [
    ["git", ["add", "--", "a.txt"]], ["git", ["commit", "-F", "/m"]], ["git", ["commit", "-m", "msg --amend text"]], ["git", ["tag", "-a", "v1.2.3", "-m", "t"]],
    ["git", ["push", "-u", "origin", "release/v1.2.3"]], ["git", ["push", "origin", "v1.2.3"]], ["git", ["switch", "-c", "release/v1.2.3"]], ["git", ["switch", "main"]],
    ["git", ["branch", "-d", "release/v1.2.3"]], ["git", ["fetch", "origin"]], ["git", ["ls-remote", "--tags", "origin", "refs/tags/v1.2.3"]],
    ["git", ["describe", "--tags", "--abbrev=0"]], ["gh", ["auth", "status"]], ["gh", ["release", "view", "v1.2.3"]], ["gh", ["pr", "create", "--base", "main", "--head", "release/v1.2.3"]],
    ["gh", ["pr", "merge", "7", "--auto", "--merge"]], ["gh", ["pr", "view", "release/v1.2.3"]], ["gh", ["run", "list"]], ["gh", ["run", "view", "1"]], ["gh", ["release", "create", "v1.2.3", "--title", "t"]],
    // AC-R11: the six exact shapes E405 adds for SOP steps 3-4 and 7-9.
    ["npm", ["install", "--package-lock-only"]], ["npm", ["test"]], ["npm", ["audit", "--audit-level=high", "--json"]], ["npx", ["tsc"]],
    ["node", ["scripts/check-transitions-sync.mjs"]], ["node", ["scripts/verify-release.mjs", "--ci-check"]],
  ];
  for (const [cmd, args] of yes) assert.ok(rel.isAllowed(cmd, args, { branch: "release/v1.2.3" }), `${cmd} ${args.join(" ")}`);
  assert.ok(rel.isAllowed("git", ["-c", "pull.rebase=false", "pull", "--ff-only"], { branch: "main" }));
  assert.ok(!rel.isAllowed("git", ["-c", "pull.rebase=false", "pull", "--ff-only"], { branch: "release/v1.2.3" }), "pull only while on main");
  const no = [
    ["git", ["reset", "--hard"]], ["git", ["rebase", "main"]], ["git", ["clean", "-fd"]], ["git", ["checkout", "--force", "main"]], ["git", ["checkout", "main"]],
    ["git", ["push", "--force", "origin", "release/v1.2.3"]], ["git", ["push", "-f", "origin", "release/v1.2.3"]], ["git", ["push", "--force-with-lease", "origin", "release/v1.2.3"]],
    ["git", ["tag", "-f", "v1.2.3"]], ["git", ["tag", "-d", "v1.2.3"]], ["git", ["push", "origin", "main"]], ["git", ["push", "-u", "origin", "main"]], ["git", ["push", "origin", "HEAD:main"]],
    ["git", ["branch", "-D", "release/v1.2.3"]], ["git", ["stash", "drop"]], ["git", ["stash", "clear"]], ["git", ["update-ref", "-d", "refs/heads/x"]], ["git", ["commit", "--amend", "-m", "x"]],
    ["git", ["merge", "release/v1.2.3"]], ["git", ["pull", "--rebase"]], ["gh", ["pr", "merge", "7", "--squash"]], ["gh", ["pr", "merge", "7", "--rebase"]], ["gh", ["pr", "merge", "7", "--admin"]],
    ["gh", ["pr", "merge", "7", "--merge"]], ["gh", ["api", "x"]], ["bash", ["-c", "true"]],
    // AC-R11: every other npm / npx form stays refused.
    ["npm", ["ci"]], ["npm", ["install", "x"]], ["npm", ["install"]], ["npm", ["install", "--package-lock-only", "x"]], ["npm", ["publish"]], ["npm", ["run", "build"]],
    ["npm", ["test", "--", "x"]], ["npm", ["audit"]], ["npm", ["audit", "fix"]], ["npm", ["audit", "--audit-level=high"]], ["npx", ["eslint"]], ["npx", ["--yes", "tsc"]], ["npx", ["tsc", "--watch"]],
    ["node", ["scripts/check-transitions-sync.mjs", "x"]], ["node", ["scripts/release.mjs"]], ["node", ["-e", "1"]],
  ];
  for (const [cmd, args] of no) assert.ok(!rel.isAllowed(cmd, args, { branch: "main" }), `${cmd} ${args.join(" ")} must be refused`);
  assert.ok(Object.isFrozen(rel.ALLOWED));
});

// ---------------------------------------------------------------- AC-S5 bookkeeping

test("AC-S5 drift baseline, done-mark, adapter stamps", async () => {
  // 7b: dedup, created if absent, existing order and keys kept.
  const made = rel.appendDriftBaseline(null, ["T-1", "T-2", "T-1"]);
  assert.deepEqual(JSON.parse(made.text).driftBaselineIds, ["T-1", "T-2"]);
  const kept = rel.appendDriftBaseline(JSON.stringify({ keep: 1, driftBaselineIds: ["B", "T-1"] }), ["T-1", "T-3"]);
  assert.deepEqual(JSON.parse(kept.text), { keep: 1, driftBaselineIds: ["B", "T-1", "T-3"] });
  assert.deepEqual(kept.added, ["T-3"]);
  assert.deepEqual(rel.appendDriftBaseline(JSON.stringify({ driftBaselineIds: ["T-1"] }), ["T-1"]).added, []);
  assert.throws(() => rel.appendDriftBaseline("{", ["x"]), (e) => e.classId === "DRIFT_BASELINE");
  // 7d: stamp set on the three adapters, one line each, line endings kept, anything else stops.
  assert.equal(rel.bumpAdapterStamp("CLAUDE.md", "a\n<!-- agc-version: 1.0.0 -->\nb\n", "2.0.0"), "a\n<!-- agc-version: 2.0.0 -->\nb\n");
  assert.equal(rel.bumpAdapterStamp("AGENTS.md", "# agc-version: 1.0.0\r\nx\r\n", "2.0.0"), "# agc-version: 2.0.0\r\nx\r\n");
  assert.throws(() => rel.bumpAdapterStamp("AGENTS.md", "# agc-version: 1\n# agc-version: 2\n", "3.0.0"), (e) => e.classId === "ADAPTER_STAMP");
  assert.throws(() => rel.bumpAdapterStamp(".antigravityrules", "nothing\n", "3.0.0"), (e) => e.classId === "ADAPTER_STAMP");
  assert.deepEqual(rel.ADAPTER_STAMPS.map((s) => s.path), ["CLAUDE.md", "AGENTS.md", ".antigravityrules"]);

  // End to end through prepare: files written, check-bookkeeping and agc check delegated.
  const fx = mkFixture();
  workTree(fx);
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(read(fx, ".current/.config.json")).driftBaselineIds, ["T-E7-01"], "config created with the completed ids");
  for (const f of ["CLAUDE.md", "AGENTS.md", ".antigravityrules"]) assert.ok(read(fx, f).includes(`agc-version: ${fx.version}`), f);
  const log = stubLog(fx);
  assert.ok(log.some((l) => l.name === "check-bookkeeping.mjs"), "check-bookkeeping.mjs ran");
  assert.ok(log.some((l) => l.name === "agc-init.mjs" && l.args[0] === "check"), "agc-init.mjs check ran");
  assert.match(read(fx, "docs/backlog.md"), new RegExp(`\\| E7 \\| \\*\\*DONE v${fx.version.replace(/\./g, "\\.")}\\*\\*`));
  // Re-run after the commit: no second write, same ids not duplicated.
  const again = await runMain(fx, prepareArgs(fx));
  assert.equal(again.code, 0, again.err);
  assert.deepEqual(JSON.parse(read(fx, ".current/.config.json")).driftBaselineIds, ["T-E7-01"]);
});

test("AC-S5 done-mark rules: row, version token, no stray rows, bookkeeping stop", () => {
  const rows = (desc) => `| id | desc |\n|---|---|\n| E7 | ${desc} |\n| E8 | other |\n`;
  const ok = rel.checkDoneMarks({ backlogText: rows("**DONE v1.2.4**: x"), diffLines: ["-| E7 | x |", "+| E7 | **DONE v1.2.4**: x |"], tickets: ["E7"], version: "1.2.4" });
  assert.deepEqual(ok, []);
  assert.ok(rel.checkDoneMarks({ backlogText: rows("x"), diffLines: [], tickets: ["E7"], version: "1.2.4" }).length > 0, "unmarked row");
  assert.ok(rel.checkDoneMarks({ backlogText: rows("**DONE v1.2.40**: x"), diffLines: [], tickets: ["E7"], version: "1.2.4" }).length > 0, "a longer version is not this version");
  assert.ok(rel.checkDoneMarks({ backlogText: rows("**DONE**: x"), diffLines: [], tickets: ["E7"], version: "1.2.4" }).length > 0, "no version named");
  assert.ok(rel.checkDoneMarks({ backlogText: rows("x"), diffLines: [], tickets: ["E9"], version: "1.2.4" }).length > 0, "ticket without a row");
  assert.ok(rel.checkDoneMarks({ backlogText: rows("x"), diffLines: ["+| E8 | sneaky |"], tickets: ["E7"], version: "1.2.4" }).some((p) => /E8|not a done-marked/.test(p)), "unrelated row edit");
  assert.ok(rel.checkDoneMarks({ backlogText: rows("x"), diffLines: ["+random prose"], tickets: "none", version: "1.2.4" }).length > 0, "--tickets none still rejects a backlog edit");
});

// ---------------------------------------------------------------- AC-S6 commit, push, PR

test("AC-S6 commit, push, PR", async () => {
  const fx = mkFixture();
  workTree(fx);
  // A message body full of shell metacharacters reaches git verbatim; no shell ever sees it.
  const body = "$(touch PWNED) `touch PWNED2` ; touch PWNED3 \"quoted\" $HOME";
  const r = await runMain(fx, prepareArgs(fx, [], { msg: msgFile(fx, `chore(release): v${fx.version} — add the thing\n\n${body}\n`) }));
  assert.equal(r.code, 0, r.err);
  assert.match(lastLine(r.out), new RegExp(`^release: prepare OK \\(v${fx.version.replace(/\./g, "\\.")}\\) — pull request #1$`));
  assert.ok(!["PWNED", "PWNED2", "PWNED3"].some((f) => exists(fx, f)), "message text never executed");
  assert.equal(git(fx, "log", "-1", "--format=%s"), `chore(release): v${fx.version} — add the thing`);
  assert.ok(git(fx, "log", "-1", "--format=%B").includes(body));
  assert.equal(git(fx, "rev-list", "--count", "HEAD", "^main"), "1", "exactly one commit, no amend");
  const files = git(fx, "show", "--name-only", "--format=", "HEAD").split("\n");
  for (const f of ["package.json", "README.md", "CHANGELOG.md", "docs/backlog.md", "content/foo.md", "specs/feat.md", "CLAUDE.md", "AGENTS.md", ".antigravityrules", ".current/.config.json", `qa_reports/archive/feat/review_T-E7-01.md`]) {
    assert.ok(files.includes(f), `${f} is in the release commit (got ${files})`);
  }
  assert.equal(git(fx, "status", "--porcelain=v1", "-uall", "--", ".", ":!.current"), "", "nothing left over outside .current/");
  assert.equal(gitOrigin(fx, "rev-parse", `refs/heads/${fx.relBranch}`), git(fx, "rev-parse", "HEAD"), "branch pushed");
  assert.equal(git(fx, "rev-parse", "--abbrev-ref", "@{u}"), `origin/${fx.relBranch}`, "pushed with -u");
  const create = ghLog(fx).map((l) => JSON.parse(l));
  assert.equal(create.length, 1, "one gh mutation: pr create");
  assert.equal(create[0][create[0].indexOf("--base") + 1], "main");
  assert.equal(create[0][create[0].indexOf("--head") + 1], fx.relBranch);
  assert.equal(git(fx, "tag", "--list", fx.tag), "", "prepare never tags");
  assert.ok(!gitOrigin(fx, "tag", "--list").includes(fx.tag));
  assert.ok(!r.cmds.some((c) => /gh pr merge|git tag|git push origin v/.test(c)), "prepare never merges or tags");
  assert.equal(exists(fx, "qa_reports/review_T-E7-01.md"), false, "7a ran before the commit");
  // Re-run resumes: no new commit, no second push of new content, no second PR.
  const again = await runMain(fx, prepareArgs(fx));
  assert.equal(again.code, 0, again.err);
  assert.equal(git(fx, "rev-list", "--count", "HEAD", "^main"), "1");
  assert.equal(ghLog(fx).length, 1, "the open PR is reused");
});

test("AC-S6 REQUIRE remedy is stage-and-re-run, UNCLASSIFIABLE is the base string, and neither leaves a commit", async () => {
  const fx = mkFixture({ spec: true });
  workTree(fx);
  const head = git(fx, "rev-parse", "HEAD");
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 32);
  assert.ok(stopLine(r).includes("Release commit incomplete: specs/feat.md is absent from the release range <prev-tag>..HEAD. Stage the missing files and re-run."), stopLine(r));
  assert.ok(!/amend/i.test(stopLine(r)), "never invites --amend");
  assert.equal(git(fx, "rev-parse", "HEAD"), head, "no commit made");
  const fy = mkFixture();
  workTree(fy, { noSpec: true });
  const u = await runMain(fy, prepareArgs(fy));
  assert.equal(u.code, 33);
  assert.ok(stopLine(u).includes("AC4 unclassifiable: no specs/<active_feature>.md in the tree, pending_notes does not record a multi-feature release, and scope_decision_why does not record a backlog-row-as-spec mini-chain"));
  assert.equal(git(fy, "rev-list", "--count", "HEAD", "^main"), "0");
});

test("AC-S6 a Multi-feature release note in --state makes the named feature's spec mandatory", async () => {
  // WHY: the opening write replaces pending_notes on disk, so --state is the only place the note survives.
  const note = ["Multi-feature release: feat, newone (shipped together)."];
  const fx = mkFixture({ spec: true });
  workTree(fx, { noSpec: true });
  fx.put("specs/newone.md", "# newone\n");
  const without = await runMain(fx, prepareArgs(fx, ["--dry-run"], { state: state(fx, { active_feature: "newone" }) }));
  assert.equal(without.code, 0, `a lone active spec in range passes: ${without.err}`);
  const withNote = await runMain(fx, prepareArgs(fx, ["--dry-run"], { state: state(fx, { active_feature: "newone", pending_notes: note }) }));
  assert.equal(withNote.code, 32);
  assert.ok(stopLine(withNote).includes("specs/feat.md is absent from the release range"), stopLine(withNote));
});

test("AC-S6 staging stops: leftover root files, unstaged feature dirs, an unrelated path", () => {
  const ok = rel.checkStagingCompleteness({ changed: ["content/a.md"], staged: ["content/a.md"], unstaged: [], untracked: [] });
  assert.equal(ok.pass, true);
  const miss = rel.checkStagingCompleteness({ changed: ["content/a.md", "specs/s.md"], staged: ["content/a.md"] });
  assert.equal(miss.pass, false);
  assert.deepEqual(miss.missing, ["specs/"]);
  assert.equal(rel.checkStagingCompleteness({ changed: [], staged: [], unstaged: ["notes.txt"] }).pass, false);
  assert.equal(rel.checkStagingCompleteness({ changed: [], staged: [], untracked: ["notes.txt"] }).pass, false);
  assert.equal(rel.checkScope(["content/a.md", "package.json", ".current/x", "tasks.md"]), null);
  assert.equal(rel.checkScope(["content/a.md", "stray.txt"]), "Pre-existing uncommitted changes found in stray.txt — this path is unrelated to the active feature. Commit or stash it first.");
});

// ---------------------------------------------------------------- AC-S7 publish

const subsequence = (cmds, pats) => {
  let at = -1;
  for (const p of pats) {
    const i = cmds.findIndex((c, k) => k > at && p.test(c));
    assert.ok(i > at, `missing or out of order: ${p} in\n${cmds.join("\n")}`);
    at = i;
  }
};

test("AC-S7 publish order and stops", async () => {
  const fx = mkFixture();
  await prepared(fx);
  const headBefore = git(fx, "rev-parse", "HEAD");
  const r = await runMain(fx, ["publish", "--version", fx.version]);
  assert.equal(r.code, 0, r.err);
  const mergeOid = JSON.parse(fs.readFileSync(fx.env.GH_STATE, "utf8")).prs[fx.relBranch].mergeCommit.oid;
  assert.match(lastLine(r.out), new RegExp(`^release: publish OK \\(${fx.tag.replace(/\./g, "\\.")}\\) — tag at ${mergeOid}$`));
  subsequence(r.cmds, [
    /^git ls-remote --tags origin/, new RegExp(`^node scripts/verify-release\\.mjs --ci-check --strict --sha ${headBefore}$`), /^gh pr merge 1 --auto --merge$/,
    /^git switch main$/, /^git -c pull\.rebase=false pull --ff-only$/, new RegExp(`^git tag -a ${fx.tag} -m `), new RegExp(`^git push origin ${fx.tag}$`),
    new RegExp(`^git branch -d ${fx.relBranch}$`), new RegExp(`^gh release create ${fx.tag} `), new RegExp(`^node scripts/verify-release\\.mjs ${fx.tag}$`),
  ]);
  assert.equal(git(fx, "rev-parse", "HEAD"), mergeOid, "main is at the merge commit");
  assert.equal(git(fx, "rev-parse", `${fx.tag}^{commit}`), mergeOid, "the tag is on the merge commit");
  assert.equal(gitOrigin(fx, "rev-parse", `${fx.tag}^{commit}`), mergeOid, "pushed to origin");
  assert.equal(gitTry(fx, "rev-parse", "-q", "--verify", `refs/heads/${fx.relBranch}`).status, 1, "release branch deleted locally");
  const rc = ghLog(fx).filter((l) => l.startsWith("[")).map((l) => JSON.parse(l)).find((a) => a[0] === "release");
  const notes = rc[rc.indexOf("--notes") + 1];
  assert.ok(notes.includes("Thing in `content/foo.md`") && notes.includes("## Install") && notes.includes(`#v${fx.version}`), "notes = CHANGELOG entry + Install block");
  assert.equal(rc[rc.indexOf("--title") + 1], `${fx.tag} — add the thing`);
  // Re-run resumes with no second tag, push or release.
  const again = await runMain(fx, ["publish", "--version", fx.version]);
  assert.equal(again.code, 0, again.err);
  assert.ok(!again.cmds.some((c) => /^git tag -a|^git push origin v|^gh release create|^gh pr merge/.test(c)), "nothing re-created");
  assert.equal(ghLog(fx).filter((l) => l.includes("\"release\"")).length, 1);
});

test("AC-S7 TAG_EXISTS stops before any merge, locally or on origin", async () => {
  const fx = mkFixture();
  await prepared(fx);
  git(fx, "tag", "-a", fx.tag, "-m", "stray");
  const r = await runMain(fx, ["publish", "--version", fx.version]);
  assert.equal(r.code, 40);
  assert.ok(!r.cmds.some((c) => /gh pr merge|verify-release/.test(c)), "no CI gate, no merge");
  const fy = mkFixture();
  await prepared(fy);
  git(fy, "tag", "-a", fy.tag, "-m", "stray"); git(fy, "push", "-q", "origin", fy.tag); git(fy, "tag", "-d", fy.tag);
  const o = await runMain(fy, ["publish", "--version", fy.version]);
  assert.equal(o.code, 40, "tag only on origin");
  assert.ok(!o.cmds.some((c) => /gh pr merge/.test(c)));
});

test("AC-S7 only CI-CHECK PASSED continues; a red or silent gate stops before the merge", async () => {
  for (const cfg of [{ status: 1, stdout: "CI-CHECK FAILED\n", stderr: "FAIL: red\n" }, { status: 0, stdout: "all fine\n" }]) {
    const fx = mkFixture();
    await prepared(fx);
    stubCfg(fx, { ci: cfg });
    const r = await runMain(fx, ["publish", "--version", fx.version]);
    assert.equal(r.code, 41, JSON.stringify(cfg));
    assert.ok(!r.cmds.some((c) => /gh pr merge/.test(c)), "no merge after a failed gate");
  }
});

test("AC-S7 a PR that cannot merge is its own class: conflicting, behind, red check, closed", async () => {
  for (const patch of [{ mergeable: "CONFLICTING" }, { mergeStateStatus: "BEHIND" }, { statusCheckRollup: [{ conclusion: "FAILURE" }] }]) {
    const fx = mkFixture();
    await prepared(fx);
    ghState(fx, (s) => Object.assign(s.prs[fx.relBranch], patch));
    const r = await runMain(fx, ["publish", "--version", fx.version]);
    assert.equal(r.code, 42, JSON.stringify(patch));
    assert.ok(!r.cmds.some((c) => /gh pr merge|git tag/.test(c)), "never merges, never tags");
  }
  const fx = mkFixture();
  await prepared(fx);
  ghState(fx, (s) => { s.mergeFail = true; });
  assert.equal((await runMain(fx, ["publish", "--version", fx.version])).code, 42, "a refused gh pr merge");
  const fz = mkFixture();
  await prepared(fz);
  ghState(fz, (s) => { s.prs[fz.relBranch].state = "CLOSED"; });
  assert.equal((await runMain(fz, ["publish", "--version", fz.version])).code, 42, "closed PR");
});

test("AC-S7 a rejected tag push is PUSH_REJECTED and a re-run resumes without re-merging or re-tagging", async () => {
  const fx = mkFixture();
  await prepared(fx);
  const hook = path.join(fx.origin, "hooks", "pre-receive");
  fs.writeFileSync(hook, "#!/bin/sh\nwhile read old new ref; do case \"$ref\" in refs/tags/*) echo 'tags refused' >&2; exit 1;; esac; done\n", { mode: 0o755 });
  const r = await runMain(fx, ["publish", "--version", fx.version]);
  assert.equal(r.code, 34);
  assert.match(stopLine(r), /^RELEASE_STOP PUSH_REJECTED: .* at [0-9a-f]{40}/, "branch and local sha named (Constitution §6)");
  fs.rmSync(hook);
  const again = await runMain(fx, ["publish", "--version", fx.version]);
  assert.equal(again.code, 0, again.err);
  assert.ok(!again.cmds.some((c) => /gh pr merge|git tag -a/.test(c)), "no second merge, the local tag is kept");
  assert.ok(gitOrigin(fx, "tag", "--list").includes(fx.tag));
});

// ---------------------------------------------------------------- AC-S8 close-out

test("AC-S8 close-out", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  const names = [];
  const r = await runMain(fx, ["close-out", "--version", fx.version], { importLanePaths: async () => ({ resolveCurrentLane: (root) => { names.push(root); return "lane1"; } }) });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names, [fx.root], "the lane comes from the resolver, called with the root");
  assert.match(lastLine(r.out), new RegExp(`^release: close-out OK \\(${fx.tag.replace(/\./g, "\\.")}\\) — CLOSE-OUT PASSED$`));
  const bk = `${fx.relBranch}-bookkeeping`;
  subsequence(r.cmds, [
    new RegExp(`^git switch -c ${bk}$`), /^git add -- \.current\/lane1\/handoff\.md \.current\/lane1\/events\.jsonl$/, /^git commit -m chore\(governance\): post-release bookkeeping/,
    new RegExp(`^git push -u origin ${bk}$`), /^gh pr create /, /^gh pr merge 1 --auto --merge$/, /^git switch main$/, /^git -c pull\.rebase=false pull --ff-only$/,
    new RegExp(`^git branch -d ${bk}$`), /^node scripts\/verify-release\.mjs --close-out$/,
  ]);
  const add = r.calls.find((c) => c.args[0] === "add").args;
  assert.ok(!add.some((a) => /[*?]/.test(a)), "enumerated paths, no glob");
  const merged = git(fx, "show", "--name-only", "--format=", "HEAD^2").split("\n");
  assert.deepEqual(merged.sort(), [".current/lane1/events.jsonl", ".current/lane1/handoff.md"], "the bookkeeping commit holds the handoff and the jsonl only");
  assert.equal(git(fx, "status", "--porcelain=v1", "-uall"), "?? .current/lane1/scratch.txt", "a non-jsonl sidecar is left alone");
  // A different lane name is honoured (nothing hardcoded).
  const fy = mkFixture({ onMain: true });
  fy.put(".current/other/handoff.md", "---\nlast_agent: release-engineer\nstatus: In_Progress\nnext_role: pm\n---\n## Pending & Handoff Notes\n- Released v" + fy.version + "\n");
  const o = await runMain(fy, ["close-out", "--version", fy.version], { importLanePaths: lane("other") });
  assert.equal(o.code, 0, o.err);
  assert.ok(o.cmds.some((c) => c === "git add -- .current/other/handoff.md"), o.cmds.join("\n"));
  // Re-run after completion: the merged PR is not opened or merged again.
  const again = await runMain(fy, ["close-out", "--version", fy.version], { importLanePaths: lane("other") });
  assert.ok(!again.cmds.some((c) => /gh pr create|gh pr merge|switch -c/.test(c)), again.cmds.join("\n"));
});

test("AC-S8 an empty stage stops before commit and a bookkeeping branch with no PR is never reused", async () => {
  const fx = mkFixture({ onMain: true });
  const closing = `---\nlast_agent: release-engineer\nstatus: In_Progress\nnext_role: pm\n---\n## Pending & Handoff Notes\n- Released v${fx.version}\n`;
  fx.put(".current/lane1/handoff.md", closing);
  git(fx, "add", "-A"); git(fx, "commit", "-q", "-m", "handoff"); git(fx, "push", "-q", "origin", "main");
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  assert.equal(r.code, 52);
  assert.ok(!r.cmds.some((c) => /^git commit|^git switch -c/.test(c)));
  const fy = mkFixture({ onMain: true });
  closeOutTree(fy);
  git(fy, "branch", `${fy.relBranch}-bookkeeping`);
  const b = await runMain(fy, ["close-out", "--version", fy.version]);
  assert.equal(b.code, 53, "a local-only bookkeeping branch also counts");
});

test("AC-S8 the two close-out FAILs are two distinct classes, any other FAIL a third", async () => {
  const codes = {};
  for (const [id, stderr] of [["CLOSE_OUT_NO_UPSTREAM", "FAIL: no upstream tracking branch configured\n"], ["CLOSE_OUT_AHEAD", "FAIL: HEAD is 2 commit(s) ahead of upstream origin/main\n"], ["CLOSE_OUT_UNVERIFIED", "FAIL: something else\n"]]) {
    const fx = mkFixture({ onMain: true });
    closeOutTree(fx);
    stubCfg(fx, { closeout: { status: 1, stderr } });
    codes[id] = (await runMain(fx, ["close-out", "--version", fx.version])).code;
    assert.equal(rel.classifyCloseOut(stderr), id);
  }
  assert.equal(new Set(Object.values(codes)).size, 3);
});

test("AC-S8 the closing write must be on disk before anything is committed", () => {
  const w = rel.readClosingWrite("---\nlast_agent: release-engineer\nstatus: In_Progress\nnext_role: pm\n---\n# H\n\n## Pending & Handoff Notes\n- Released v1.2.3\n- tag: x\n");
  assert.deepEqual(w, { lastAgent: "release-engineer", status: "In_Progress", nextRole: "pm", firstNote: "Released v1.2.3" });
  assert.equal(rel.readClosingWrite("# nothing").firstNote, null);
});

// ---------------------------------------------------------------- AC-S9 absorption

test("AC-S9 absorbed checks are delegated", async () => {
  const src = fs.readFileSync(SCRIPT, "utf-8");
  assert.ok(!/^import .*from "\.\.?\//m.test(src) && !/import\("\.\.?\//.test(src) && !/from "\.\/(check|verify)/.test(src), "release.mjs imports none of the three scripts");
  const fx = mkFixture();
  await prepared(fx);
  await runMain(fx, ["publish", "--version", fx.version]);
  closeOutTree(fx, {});
  await runMain(fx, ["close-out", "--version", fx.version]);
  const log = stubLog(fx).map((l) => `${l.name} ${l.args.join(" ")}`.trim());
  assert.ok(log.some((l) => l === "check-version.mjs"), "version coherence: check-version.mjs");
  assert.ok(log.some((l) => /^verify-release\.mjs --ci-check --strict --sha [0-9a-f]{40}$/.test(l)), "CI ground truth: verify-release --ci-check --strict");
  assert.ok(log.some((l) => l === `verify-release.mjs ${fx.tag}`), "self-check: verify-release vX.Y.Z");
  assert.ok(log.some((l) => l === "verify-release.mjs --close-out"), "close-out: verify-release --close-out");
  assert.ok(log.some((l) => l === "check-bookkeeping.mjs"), "backlog validation: check-bookkeeping.mjs");
  // A stub verdict is the verdict: the script re-implements none of these checks.
  for (const [key, id] of [["check-version.mjs", "VERSION_INCOHERENT"], ["check-bookkeeping.mjs", "BOOKKEEPING_CHECK"]]) {
    const fy = mkFixture();
    workTree(fy);
    stubCfg(fy, { [key]: { status: 1, stderr: "stub says no\n" } });
    const r = await runMain(fy, prepareArgs(fy));
    assert.equal(r.err.includes(`RELEASE_STOP ${id}`), true, id);
  }
  for (const f of ["scripts/check-version.mjs", "scripts/verify-release.mjs", "scripts/check-bookkeeping.mjs"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(REPO, f), "utf-8"), /from "\.\/|from '\.\/|import\("\.\//, `${f} stays self-contained`);
  }
});

// ---------------------------------------------------------------- AC-L1 S-class lessons (title carries L:<id>)

test("L:E1 STALE_BASE when origin/main is not an ancestor", async () => {
  const fx = mkFixture();
  workTree(fx);
  advanceOrigin(fx);
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 11);
  assert.ok(!r.cmds.some((c) => /^git (add|commit|push)/.test(c)), "stops before any mutation");
});

test("L:E9 SELF_CHECK_FAILED on verify-release non-zero, after the release exists", async () => {
  const fx = mkFixture();
  await prepared(fx);
  stubCfg(fx, { self: { status: 1, stderr: "FAIL: tag missing\nFAIL: release missing\n" } });
  const r = await runMain(fx, ["publish", "--version", fx.version]);
  assert.equal(r.code, 45);
  assert.ok(stopLine(r).includes("FAIL: tag missing") && stopLine(r).includes("FAIL: release missing"), "failed checks in the detail");
});

test("L:E14 L:E78 L:E80 CI ground truth is delegated to verify-release.mjs", async () => {
  const fx = mkFixture();
  await prepared(fx);
  const r = await runMain(fx, ["publish", "--version", fx.version]);
  assert.ok(!r.cmds.some((c) => /^gh run /.test(c)), "release.mjs does not read workflow runs itself");
  const ci = r.cmds.filter((c) => /verify-release\.mjs --ci-check/.test(c));
  assert.equal(ci.length, 1);
  assert.ok(/--sha [0-9a-f]{40}$/.test(ci[0]), "sha-matched, not branch-derived");
  const fy = mkFixture();
  await prepared(fy);
  stubCfg(fy, { ci: { status: 2, stdout: "", stderr: "FAIL: no completed run for the sha within the budget\n" } });
  const bad = await runMain(fy, ["publish", "--version", fy.version], { env: { AGC_VERIFY_CI_WAIT_SECONDS: "7" } });
  assert.equal(bad.code, 41, "the script's verdict is final");
});

test("L:E163 publish gate is --ci-check --strict", async () => {
  const fx = mkFixture();
  await prepared(fx);
  const r = await runMain(fx, ["publish", "--version", fx.version, "--dry-run"]);
  assert.ok(r.cmds.some((c) => /verify-release\.mjs --ci-check --strict /.test(c)));
  assert.ok(!r.cmds.some((c) => /verify-release\.mjs --ci-check(?! --strict)/.test(c)), "never the lenient form");
});

test("L:E297 no push to main; PR merge is --auto --merge", async () => {
  const fx = mkFixture();
  await prepared(fx);
  const a = await runMain(fx, ["publish", "--version", fx.version]);
  closeOutTree(fx);
  const b = await runMain(fx, ["close-out", "--version", fx.version]);
  for (const c of [...a.cmds, ...b.cmds]) {
    assert.ok(!/^git push\b.*\b(main|HEAD:main)\b/.test(c), c);
    if (/^gh pr merge/.test(c)) assert.match(c, / --auto --merge$/);
  }
  assert.ok(a.cmds.some((c) => /^gh pr merge/.test(c)) && b.cmds.some((c) => /^gh pr merge/.test(c)));
  assert.equal(rel.isAllowed("git", ["push", "origin", "main"], { branch: "main" }), false);
  assert.ok(gitOrigin(fx, "log", "--merges", "--format=%s", "main").includes("Merge pull request #1"), "main moved by PR merge only");
});

test("L:E141 L:E143 close-out stages only handoff + jsonl; the ledger rides the release commit", async () => {
  assert.ok(rel.STAGE_PATHS.metadataPaths.includes("tasks.md"), "tasks.md is on the release commit's plan");
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  fx.put("tasks.md", "# Tasks\n- [x] T-E7-01\n- [x] T-E7-02\n");
  fx.put(".current/_primary/tasks.md", "x\n");
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  assert.equal(r.code, 0, r.err);
  const add = r.cmds.find((c) => c.startsWith("git add --"));
  assert.ok(!/tasks\.md/.test(add), add);
  assert.ok(git(fx, "status", "--porcelain=v1", "-uall").includes("tasks.md"), "ledger changes stay uncommitted by close-out");
});

test("L:E144 close-out FAILs map to two classes", () => {
  assert.equal(rel.classifyCloseOut("FAIL: no upstream tracking branch configured\n"), "CLOSE_OUT_NO_UPSTREAM");
  assert.equal(rel.classifyCloseOut("FAIL: HEAD is 3 commit(s) ahead of upstream origin/main\n"), "CLOSE_OUT_AHEAD");
  assert.notEqual(rel.EXIT_CLASSES.find((c) => c.id === "CLOSE_OUT_NO_UPSTREAM").code, rel.EXIT_CLASSES.find((c) => c.id === "CLOSE_OUT_AHEAD").code);
});

test("L:E84 close-out merges the bookkeeping PR before --close-out", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  const merge = r.cmds.findIndex((c) => /^gh pr merge/.test(c)), verify = r.cmds.findIndex((c) => /--close-out/.test(c)), pull = r.cmds.findIndex((c) => /pull --ff-only/.test(c));
  assert.ok(merge > -1 && merge < pull && pull < verify, r.cmds.join("\n"));
});

test("L:E179 done-mark check rejects an added row", () => {
  const text = "| id | desc |\n|---|---|\n| E7 | **DONE v1.0.0**: x |\n| E99 | new row |\n";
  assert.ok(rel.checkDoneMarks({ backlogText: text, diffLines: ["+| E7 | **DONE v1.0.0**: x |", "+| E99 | new row |"], tickets: ["E7"], version: "1.0.0" }).length > 0);
});

test("L:E71d not-yet-released pre-mark must be amended", () => {
  const text = "| id | desc |\n|---|---|\n| E7 | **DONE** (not yet released) v1.0.0: x |\n";
  const p = rel.checkDoneMarks({ backlogText: text, diffLines: [], tickets: ["E7"], version: "1.0.0" });
  assert.ok(p.some((m) => /not yet released/.test(m)));
  const amended = "| id | desc |\n|---|---|\n| E7 | **DONE v1.0.0**: x |\n";
  assert.deepEqual(rel.checkDoneMarks({ backlogText: amended, diffLines: ["-| E7 | **DONE** (not yet released) v1.0.0: x |", "+| E7 | **DONE v1.0.0**: x |"], tickets: ["E7"], version: "1.0.0" }), []);
});

test("L:E301 archive step never writes docs/backlog.md", async () => {
  const fx = mkFixture();
  workTree(fx);
  const before = read(fx, "docs/backlog.md");
  const dry = await runMain(fx, prepareArgs(fx, ["--dry-run"]));
  assert.ok(!/(write|mv|mkdir) .*backlog/.test(dry.out.replace(/\[8a-1\].*/g, "")), "no 7a/7b/7d action touches the backlog");
  await runMain(fx, prepareArgs(fx));
  assert.equal(read(fx, "docs/backlog.md"), before, "byte-identical: the agent's done-mark is the only edit");
});

test("L:E125c write set stays inside the Artifact allowlist", async () => {
  const fx = mkFixture();
  const tasksBefore = read(fx, "tasks.md");
  await prepared(fx);
  assert.equal(read(fx, "tasks.md"), tasksBefore, "root tasks.md is never written");
  assert.ok(!exists(fx, ".current/history"));
  const files = git(fx, "show", "--name-only", "--format=", "HEAD").split("\n");
  const allowed = [/^package\.json$/, /^index\.ts$/, /^CHANGELOG\.md$/, /^README\.md$/, /^docs\/backlog\.md$/, /^\.current\/\.config\.json$/, /^(CLAUDE|AGENTS)\.md$/, /^\.antigravityrules$/, /^qa_reports\/archive\//, /^review_reports\/archive\//, /^content\//, /^specs\//];
  for (const f of files) assert.ok(allowed.some((re) => re.test(f)), `${f} is inside the allowlist`);
});

test("L:E53 EMPTY_BASELINE exits 20 before any write", async () => {
  const fx = mkFixture();
  workTree(fx);
  fx.put("review_reports/review_T-E7-02.md", "r\n");
  // The precondition fetch runs first by design and only moves remote-tracking refs.
  const stable = () => { const s = snapshot(fx); s.refs = s.refs.split("\n").filter((l) => !l.includes("refs/remotes/")).join("\n"); return s; };
  const before = stable();
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 20);
  assert.ok(stopLine(r).includes("step 7a has no membership baseline for <qa_reports|review_reports> (PREV_TAG='v1.2.3')"));
  assert.deepEqual(stable(), before, "no file moved, written or committed");
  const none = mkFixture();
  workTree(none);
  git(none, "tag", "-d", "v1.2.3");
  gitOrigin(none, "tag", "-d", "v1.2.3");
  const r2 = await runMain(none, prepareArgs(none));
  assert.equal(r2.code, 20, "an unset PREV_TAG with root evidence is the same class");
  assert.ok(stopLine(r2).includes("(PREV_TAG='')"));
});

test("L:E60 lockfile drift stops as VERSION_INCOHERENT", async () => {
  const fx = mkFixture();
  workTree(fx);
  stubCfg(fx, { "check-version.mjs": { status: 1, stderr: "FAIL: package-lock.json version 1.2.3 != package.json 1.2.4\n" } });
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 12);
  assert.ok(stopLine(r).includes("package-lock.json version"), "the delegated reason reaches the stop record");
});

test("L:E65 prepare runs 7a, 7b, 7c, 7d before the commit", async () => {
  const fx = mkFixture();
  workTree(fx);
  const r = await runMain(fx, prepareArgs(fx));
  const s = steps(r.out), at = (x) => s.indexOf(x);
  assert.ok(at("7a") < at("7b") && at("7b") < at("7c") && at("7c") < at("7d") && at("7d") < at("8a-4"), s.join(","));
});

test("L:E71b L:E76 array argv, no shell child, one process for 7a (globs and spaces in names)", async () => {
  const fx = mkFixture();
  workTree(fx);
  fx.put("qa_reports/review_T-E7-02 with space.md", "a\n");
  fx.put("qa_reports/review_T-E7-03 star*.md", "b\n");
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, r.err);
  for (const n of ["review_T-E7-01.md", "review_T-E7-02 with space.md", "review_T-E7-03 star*.md"]) assert.ok(exists(fx, `qa_reports/archive/feat/${n}`), `${n} archived`);
  assert.ok(!r.calls.some((c) => /^(bash|sh|zsh|npm|mv|mkdir|find|ls|cp)$/.test(path.basename(c.bin))), "no shell or file-tool child");
  assert.ok(r.calls.every((c) => !c.shell));
});

test("L:E71c scope rule ignores .current and tasks.md", () => {
  assert.equal(rel.checkScope([".current/lane1/handoff.md", ".current/.config.json", "tasks.md", ".current/_primary/tasks.md"]), null);
  assert.ok(rel.checkScope(["notes.md"]));
  assert.ok(rel.checkScope([".currentish/x"]), "only the .current/ directory is exempt");
});

test("L:E83 L:E95 citation check", () => {
  const entry = "## [1.0.0] - 2026-01-01\n- Fixed `lib/a.ts` and `scripts/x.mjs:12`.\n- Kept `docs/ctx.md` (context, not changed).\n- Dir `gates/`. Pattern `test/*.mjs`. Plain `word`.\n";
  const cites = rel.extractCitations(entry);
  assert.deepEqual(cites.map((c) => [c.path, c.context]), [["lib/a.ts", false], ["scripts/x.mjs", false], ["docs/ctx.md", true], ["gates/", false]]);
  const have = new Set(["lib/a.ts", "scripts/x.mjs", "gates/g.ts"]);
  const ok = rel.checkChangelogCitations({ citations: cites, union: have, exists: () => true });
  assert.deepEqual(ok, []);
  const missingCtx = rel.checkChangelogCitations({ citations: cites, union: have, exists: () => false });
  assert.equal(missingCtx.length, 1, "(context, not changed) exempts membership, never on-disk existence");
  assert.ok(missingCtx[0].includes("docs/ctx.md"));
  const outside = rel.checkChangelogCitations({ citations: cites, union: new Set(["lib/a.ts"]), exists: () => true });
  assert.equal(outside.length, 2, "an unmarked citation outside the release range fails");
  assert.equal(rel.extractChangelogEntry("# c\n\n## [1.0.0] - d\nbody\n\n## [0.9.0] - d\nold\n", "1.0.0"), "## [1.0.0] - d\nbody\n");
});

// Spec classes, archive shapes and staging plan: the pure core the old SOP carried as shell fragments.

test("L:E109 L:E146 multi-feature names strip a trailing parenthetical", () => {
  const r = rel.classifySpecCheck({
    feature: "a", unionFiles: ["specs/a.md", "specs/b.md"], specExists: () => true,
    pendingNotes: ["Multi-feature release: a, b (shipped together)."],
  });
  assert.equal(r.pass, true);
  assert.equal(r.branch, "MULTI-FEATURE");
  assert.ok(r.logs.some((l) => l.includes("specs/b.md present")), r.logs.join("\n"));
  const miss = rel.classifySpecCheck({ feature: "a", unionFiles: ["specs/a.md"], specExists: () => true, pendingNotes: ["Multi-feature release: a, b (note)"] });
  assert.equal(miss.classId, "SPEC_REQUIRE");
  assert.ok(miss.errorMsg.includes("specs/b.md"), "the name was parsed without its parenthetical");
});

test("L:E44 AC4 branches: REQUIRE, SKIP, UNCLASSIFIABLE, MULTI-FEATURE are exhaustive", () => {
  const mini = "mini-chain, pm/architect skipped";
  const c = (o) => rel.classifySpecCheck({ feature: "f", unionFiles: [], specExists: () => false, ...o });
  assert.equal(c({ specExists: () => true, unionFiles: ["specs/f.md"] }).branch, "REQUIRE");
  assert.equal(c({ specExists: () => true }).classId, "SPEC_REQUIRE");
  assert.deepEqual([c({ scopeWhy: mini }).branch, c({ scopeWhy: mini }).pass], ["SKIP", true]);
  assert.equal(c({}).classId, "SPEC_UNCLASSIFIABLE");
  assert.equal(c({ pendingNotes: ["Multi-feature release: x"] }).branch, "MULTI-FEATURE");
  assert.equal(rel.recordsMiniChain("mini-chain: PM skipped, architect skipped"), false, "both phrases are required in the recorded form");
  assert.equal(rel.recordsMiniChain(mini), true);
});

test("L:E152 range-derived spec set does not weaken the active feature's own check", () => {
  assert.deepEqual(rel.deriveRangeSpecs(["specs/a.md", "specs/fanout-x.md", "specs/a-architecture.md", "specs/sub/b.md", "docs/c.md"]), ["specs/a.md"]);
  const other = rel.classifySpecCheck({ feature: "f", unionFiles: ["specs/g.md"], specExists: () => true });
  assert.equal(other.classId, "SPEC_REQUIRE", "another feature's spec in range does not satisfy f's own");
  assert.equal(other.branch, "MULTI-FEATURE");
});

test("L:E142 expected-red files archive per feature, and citations see PREV_TAG..HEAD", () => {
  const plan = rel.planArchiveMoves({ feature: "feat", codes: [], qaRoot: ["expected-red_other.txt", "expected-red_feat.txt"], newExpectedRed: ["expected-red_other.txt", "expected-red_feat.txt"], participating: { qa: true, rr: false }, coversLine: () => null });
  assert.deepEqual(plan.map((m) => m.to), ["qa_reports/archive/other/expected-red_other.txt", "qa_reports/archive/feat/expected-red_feat.txt"]);
  const none = rel.planArchiveMoves({ feature: "feat", codes: [], qaRoot: ["expected-red_old.txt"], newExpectedRed: [], participating: { qa: true, rr: false }, coversLine: () => null });
  assert.deepEqual(none, [], "an expected-red file already at PREV_TAG is not archived");
  assert.deepEqual(rel.checkChangelogCitations({ citations: [{ path: "lib/in-range.ts", context: false }], union: new Set(["lib/in-range.ts"]), exists: () => true }), []);
});

test("L:E36 untracked-at-root evidence derives its code", () => {
  assert.deepEqual(rel.deriveCodes({ qaAdmitted: ["review_T-E36-01.md", "visual_T-E36-02.md"] }), ["E36"]);
});

test("L:E37 L:E38 two-file shape: one code per tree, never cross-filed", () => {
  assert.deepEqual(rel.deriveCodes({ qaAdmitted: ["review_T-E37-01.md"], rrAdmitted: ["review_T-E38-01.md"] }), ["E37", "E38"]);
  const plan = rel.planArchiveMoves({ feature: "f", codes: ["E37", "E38"], qaRoot: ["review_T-E37-01.md"], rrRoot: ["review_T-E38-01.md"], participating: { qa: true, rr: true }, coversLine: () => null });
  assert.deepEqual(plan, [{ from: "qa_reports/review_T-E37-01.md", to: "qa_reports/archive/f/review_T-E37-01.md" }, { from: "review_reports/review_T-E38-01.md", to: "review_reports/archive/f/review_T-E38-01.md" }]);
  assert.equal(rel.planArchiveMoves({ feature: "f", codes: ["E37"], qaRoot: [], rrRoot: ["visual_T-E37-01.md"], participating: { qa: true, rr: true }, coversLine: () => null }).length, 0, "review_reports takes review_ files only");
});

test("L:E45 L:E46 committed-in-range evidence is archived", async () => {
  const fx = mkFixture();
  fx.put("qa_reports/review_T-E45-01.md", "committed in range\n");
  git(fx, "add", "-A"); git(fx, "commit", "-q", "-m", "evidence committed after the previous tag");
  workTree(fx);
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /step 7a: <CODES> = \{E45,E7\}/);
  assert.ok(exists(fx, "qa_reports/archive/feat/review_T-E45-01.md"));
});

test("L:E49 codes come from files new since the previous tag, never from prose, history or archives", async () => {
  const fx = mkFixture();
  fx.put("qa_reports/review_T-OLDR-01.md", "shipped at the previous tag\n");
  git(fx, "add", "-A"); git(fx, "commit", "-q", "-m", "x"); git(fx, "tag", "-f", "v1.2.3");
  workTree(fx);
  fx.put("qa_reports/notes_E99.md", "prose mentioning E99 and T-E99-\n");
  fx.put("qa_reports/archive/older/review_T-E98-01.md", "already archived\n");
  const dry = await runMain(fx, prepareArgs(fx, ["--dry-run"]));
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /step 7a: <CODES> = \{E7\}\n/, "only the new review file contributes");
  assert.deepEqual(rel.deriveCodes({ qaAdmitted: ["notes_E99.md", "README.md"] }), []);
  assert.equal(rel.codeFromBasename("review_T-e7-01.md"), "E7", "uppercased");
  assert.equal(rel.codeFromBasename("overview.md"), null);
  const real = await runMain(fx, prepareArgs(fx));
  assert.match(real.out, /step 7a: <CODES> = \{E7\}/);
  assert.ok(exists(fx, "qa_reports/review_T-OLDR-01.md"), "non-retroactive: the previous release's own file stays put");
  assert.ok(exists(fx, "qa_reports/notes_E99.md"));
});

test("L:E50 two parallel trees: per-tree guard, no-clobber collisions, covers: swept in its own tree", () => {
  const c = rel.classifyArchiveTree;
  assert.equal(c({ prevTag: null, treeExists: false, baselineHasFiles: false, rootHasFiles: false }), "STOP", "no PREV_TAG stops even for an absent tree");
  assert.equal(c({ prevTag: "v1", treeExists: false, baselineHasFiles: false, rootHasFiles: true }), "EXCLUDE");
  assert.equal(c({ prevTag: "v1", treeExists: true, baselineHasFiles: true, rootHasFiles: true }), "INCLUDE");
  assert.equal(c({ prevTag: "v1", treeExists: true, baselineHasFiles: false, rootHasFiles: true }), "STOP");
  assert.equal(c({ prevTag: "v1", treeExists: true, baselineHasFiles: false, rootHasFiles: false }), "EXCLUDE");
  const plan = rel.planArchiveMoves({
    feature: "f", codes: ["E5"], qaRoot: ["batch.md"], rrRoot: ["summary.md", "other.md"], participating: { qa: true, rr: true },
    coversLine: (r) => (r === "qa_reports/batch.md" || r === "review_reports/summary.md" ? "covers: T-E5-01, T-E5-02" : null),
  });
  assert.deepEqual(plan.map((m) => m.to), ["qa_reports/archive/f/batch.md", "review_reports/archive/f/summary.md"]);
  assert.ok(rel.COVERS_RE.test("- **Covers**: T-E5-01") && rel.COVERS_RE.test("covers — T-E5-01") && !rel.COVERS_RE.test("discovers: x"));
});

test("L:E50 the same basename in both trees and an occupied destination: no overwrite, <CODES> logged even when empty", async () => {
  const fx = mkFixture();
  workTree(fx);
  fx.put("qa_reports/archive/feat/review_T-E7-01.md", "already here\n");
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, r.err);
  assert.equal(read(fx, "qa_reports/archive/feat/review_T-E7-01.md"), "already here\n", "destination never overwritten");
  assert.match(r.out, /\[7a\] kept qa_reports\/review_T-E7-01\.md/);
  const none = mkFixture();
  workTree(none);
  fs.rmSync(path.join(none.root, "qa_reports/review_T-E7-01.md"));
  const d = await runMain(none, prepareArgs(none, ["--dry-run"], { state: state(none, { completed_tasks: [] }) }));
  assert.match(d.out, /step 7a: <CODES> = \{∅\}/);
});

test("L:E64 L:E71 L:E71a staging plan: feature dirs incl. gates/, existence pre-filter", () => {
  const exists = (m) => m !== "multi-agent-scripts/" && m !== "dist/";
  const plan = rel.planStage({ changed: ["gates/g.ts", "multi-agent-scripts/x.sh", "dist/a.js", "package.json", "docs/backlog.md", "random.txt"], exists });
  assert.ok(plan.includes("gates/") && plan.includes("package.json") && plan.includes("docs/"));
  assert.ok(!plan.includes("multi-agent-scripts/") && !plan.includes("dist/"), "a missing pathspec is never handed to git add");
  assert.ok(!plan.some((p) => p === "random.txt"));
  assert.ok(rel.STAGE_PATHS.featureDirs.includes("gates/"));
  assert.equal(rel.STAGE_PATHS.featureDirs.length + rel.STAGE_PATHS.metadataPaths.length, 34);
});

test("L:E125a STAGE_PATHS holds .current/_primary/tasks.md", () => {
  assert.ok(rel.STAGE_PATHS.metadataPaths.includes(".current/_primary/tasks.md"));
  assert.ok(rel.STAGE_PATHS.metadataPaths.includes("tasks.md"));
  assert.deepEqual(rel.planStage({ changed: [".current/_primary/tasks.md"], exists: () => true }), [".current/_primary/tasks.md"]);
});

test("L:E94 root-file completeness: four workspace shapes", () => {
  const shapes = [
    [{ changed: ["content/a.md"], staged: ["content/a.md"] }, true],
    [{ changed: ["content/a.md"], staged: [], unstaged: [] }, false],
    [{ changed: [], staged: [], unstaged: ["CONTRIBUTING.md"] }, false],
    [{ changed: [], staged: [], untracked: ["notes.md"] }, false],
  ];
  for (const [input, pass] of shapes) assert.equal(rel.checkStagingCompleteness(input).pass, pass, JSON.stringify(input));
});

test("L:E71b a status path with spaces survives (NUL-separated, never word-split)", async () => {
  const fx = mkFixture();
  workTree(fx);
  fx.put("docs/a file with spaces.md", "x\n");
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, r.err);
  assert.ok(git(fx, "show", "--name-only", "--format=", "HEAD").split("\n").includes("docs/a file with spaces.md"));
});

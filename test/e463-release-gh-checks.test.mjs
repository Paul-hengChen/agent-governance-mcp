// Coded by @qa-engineer
// T-E463-01: contract tests for E463 (a failed `gh pr view` is not a missing pull request) and E464 (the minimum
// `gh` version is checked at each phase start) — specs/e463-release-gh-checks.md, one test per AC id.
//
// WHY: a transient GitHub API error once read as "no pull request" and stopped a v5.0.0 release with
// PR_CANNOT_MERGE while the pull request was open; an old `gh` once failed deep inside the CI gate. Each AC
// below pins one half of that contract so the release scripts cannot fall back to either failure.
//
// Harness: the in-process `main(argv, deps)` seam of scripts/release.mjs with an injected `sleep`. Two fixtures:
// (A) "bare": an empty repo root and a fake `spawn` that answers `gh --version` — enough for the phase-start
// checks, which stop (or are observed) before any repository call; (B) "real": a real repository in a throwaway
// directory under os.tmpdir() with a bare local `origin` and a PATH `gh` shim (copied from
// test/e394-release-script.test.mjs and extended with failure injection and `gh --version`), for the pull-request
// lookups. No real `gh`, no network. The helper scripts/gh-compat.mjs is imported lazily inside the tests that
// need it, so a missing helper reds only those tests.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO, "scripts", "release.mjs");
const HELPER = path.join(REPO, "scripts", "gh-compat.mjs");
const rel = await import(pathToFileURL(SCRIPT).href);
const helper = () => import(pathToFileURL(HELPER).href);
const DOC = JSON.parse(fs.readFileSync(path.join(REPO, "test", "fixtures", "e463", "doc-paragraphs.json"), "utf-8"));

const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });
const lastLine = (s) => String(s).trim().split("\n").filter(Boolean).pop() ?? "";
const FAIL_ERR = "GraphQL: Something went wrong while executing your query on 2026-11-25T14:44:24Z. Please include `X` when reporting this issue.";
const GH_OK = { status: 0, stdout: "gh version 2.40.0 (2023-12-07)\nhttps://github.com/cli/cli/releases/tag/v2.40.0\n", stderr: "" };

// ---------------------------------------------------------------- fixture B: real repository + gh shim

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
if (a[0] === "--version") { process.stdout.write(st.versionOut ?? "gh version 2.40.0 (2023-12-07)\\nhttps://github.com/cli/cli/releases/tag/v2.40.0\\n"); process.exit(st.versionExit ?? 0); }
if (k === "auth status") { if (st.authFail) { console.error("not logged in"); process.exit(1); } process.exit(0); }
if (k === "pr view") {
  const vf = st.viewFail;
  if (vf && (vf.branch === undefined || vf.branch === a[2]) && vf.remaining !== 0) {
    if (vf.remaining > 0) vf.remaining--;
    save(); console.error(vf.err); process.exit(1);
  }
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
  if (st.armAfterCreate) st.viewFail = st.armAfterCreate;
  save(); console.log(st.createNoUrl ? "created" : "https://github.com/o/r/pull/" + n); process.exit(0);
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
  if (st.armAfterMerge) st.viewFail = st.armAfterMerge;
  save(); process.exit(0);
}
if (k === "release view") { process.exit(st.releases.includes(a[2]) ? 0 : 1); }
if (k === "release create") { log(JSON.stringify(a)); st.releases.push(a[2]); save(); process.exit(0); }
process.exit(0);
`;

function layout(base, version, baseVersion) {
  const fx = { base, root: path.join(base, "repo"), origin: path.join(base, "origin.git"), bin: path.join(base, "bin"), inputs: path.join(base, "inputs"), version, baseVersion, tag: `v${version}`, relBranch: `release/v${version}`, feature: "feat" };
  fx.bk = `${fx.relBranch}-bookkeeping`;
  fx.env = {
    ...process.env, PATH: `${fx.bin}${path.delimiter}${process.env.PATH}`,
    GIT_AUTHOR_NAME: "QA Fixture", GIT_AUTHOR_EMAIL: "qa@example.com", GIT_COMMITTER_NAME: "QA Fixture", GIT_COMMITTER_EMAIL: "qa@example.com",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull, GIT_TERMINAL_PROMPT: "0",
    GH_STATE: path.join(fx.inputs, "gh-state.json"), GH_LOG: path.join(fx.inputs, "gh.log"),
    STUB_CFG: path.join(fx.inputs, "stub.json"), STUB_LOG: path.join(fx.inputs, "stub.log"),
    AGC_RELEASE_MERGE_WAIT_SECONDS: "0", AGC_RELEASE_POLL_SECONDS: "1",
  };
  delete fx.env.AGC_RELEASE_GH_RETRY_SECONDS; // a developer's shell must not change the default wait
  fx.put = (p, text) => { fs.mkdirSync(path.dirname(path.join(fx.root, p)), { recursive: true }); fs.writeFileSync(path.join(fx.root, p), text); };
  return fx;
}
const git = (fx, ...args) => execFileSync("git", args, { cwd: fx.root, encoding: "utf-8", env: fx.env }).trim();
const templates = new Map();
function buildTemplate({ baseVersion, version }) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e463-tpl-")));
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
  put("content/foo.md", "base\n");
  put(".current/lane1/handoff.md", "---\nlast_agent: qa-engineer\nstatus: PASS\n---\n# Handoff\n\n## Pending & Handoff Notes\n- QA PASS\n");
  put(".current/lane1/events.jsonl", "{\"n\":1}\n");
  put("scripts/release.mjs", fs.readFileSync(SCRIPT, "utf-8"));
  for (const s of ["scripts/check-version.mjs", "scripts/check-bookkeeping.mjs", "scripts/verify-release.mjs", "bin/agc-init.mjs"]) put(s, STUB);
  put("qa_reports/archive/old/review_T-OLD-01.md", "old\n");
  const g = (...a) => git(fx, ...a);
  g("init", "-q", "-b", "main"); g("config", "commit.gpgsign", "false"); g("add", "-A"); g("commit", "-q", "-m", "init"); g("tag", `v${baseVersion}`);
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", fx.origin], { env: fx.env });
  g("remote", "add", "origin", fx.origin); g("push", "-q", "-u", "origin", "main", `v${baseVersion}`);
  return base;
}
// onMain: false leaves the fixture on release/v1.2.4 (publish, prepare); true stays on main (close-out).
function mkFixture({ onMain = false } = {}) {
  const [baseVersion, version] = ["1.2.3", "1.2.4"];
  if (!templates.has("t")) templates.set("t", buildTemplate({ baseVersion, version }));
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e463-")));
  cleanup.push(base);
  fs.cpSync(templates.get("t"), base, { recursive: true });
  const fx = layout(base, version, baseVersion);
  fs.writeFileSync(fx.env.GH_STATE, JSON.stringify({ n: 0, prs: {}, releases: [], origin: fx.origin }));
  git(fx, "remote", "set-url", "origin", fx.origin);
  if (!onMain) git(fx, "switch", "-q", "-c", fx.relBranch);
  return fx;
}
const ghState = (fx, fn) => { const s = JSON.parse(fs.readFileSync(fx.env.GH_STATE, "utf8")); fn(s); fs.writeFileSync(fx.env.GH_STATE, JSON.stringify(s)); };
const failLookups = (fx, branch, remaining = -1, err = FAIL_ERR) => ghState(fx, (s) => { s.viewFail = { branch, remaining, err }; });

function workTree(fx) {
  const { baseVersion: b, version: v } = fx;
  fx.put("package.json", JSON.stringify({ name: "fx", version: v }, null, 2) + "\n");
  fx.put("index.ts", `const v = "${v}";\n`);
  fx.put("README.md", `Install: npm i github:o/r#v${v}\n`);
  fx.put("CHANGELOG.md", `# Changelog\n\n## [${v}] - 2026-01-02\n\n### Added\n- Thing in \`content/foo.md\`.\n\n## [${b}] - 2026-01-01\n- initial\n`);
  fx.put("content/foo.md", "foo\n");
  fx.put("specs/feat.md", "# feat\n");
  fx.put("qa_reports/review_T-E7-01.md", "review\n");
  fx.put("docs/backlog.md", `# Backlog\n\n| id | desc |\n|---|---|\n| E7 | **DONE v${v}**: feature seven |\n| E8 | other feature |\n`);
}
const stateFile = (fx) => {
  const p = path.join(fx.inputs, "state.json");
  fs.writeFileSync(p, JSON.stringify({ last_agent: "code-reviewer", status: "PASS", active_feature: "feat", completed_tasks: ["T-E7-01"], scope_decision_why: "", pending_notes: [] }));
  return p;
};
const msgFile = (fx) => {
  const p = path.join(fx.inputs, "msg.txt");
  fs.writeFileSync(p, `chore(release): v${fx.version} — add the thing\n\nBody line.\n`);
  return p;
};
const prepareArgs = (fx, extra = []) => ["prepare", "--version", fx.version, "--state", stateFile(fx), "--tickets", "E7", "--message-file", msgFile(fx), ...extra];

// Runs main in-process with the real spawn; `sleeps` records every injected-sleep call in milliseconds.
async function runMain(fx, argv, { env = {} } = {}) {
  const calls = [], outs = [], errs = [], sleeps = [];
  const recorder = (bin, args, opts) => { calls.push({ bin, args: [...args] }); return spawnSync(bin, args, opts); };
  const code = await rel.main(argv, {
    root: fx.root, env: { ...fx.env, ...env }, out: (s) => outs.push(s), err: (s) => errs.push(s),
    spawn: recorder, sleep: async (ms) => { sleeps.push(ms); }, importLanePaths: async () => ({ resolveCurrentLane: () => "lane1" }),
  });
  const cmds = calls.map((c) => (c.bin === process.execPath ? `node ${path.relative(fx.root, c.args[0])} ${c.args.slice(1).join(" ")}`.trim() : `${c.bin} ${c.args.join(" ")}`));
  return { code, out: outs.join(""), err: errs.join(""), calls, cmds, sleeps };
}
const stopLine = (r) => lastLine(r.err);
const prViews = (r, branch) => r.cmds.filter((c) => c.startsWith(`gh pr view ${branch} `));
async function prepared(fx) {
  workTree(fx);
  const r = await runMain(fx, prepareArgs(fx));
  assert.equal(r.code, 0, `prepare must succeed on the good fixture: ${r.err}`);
  return r;
}
function closeOutTree(fx) {
  fx.put(".current/lane1/handoff.md", `---\nlast_agent: release-engineer\nstatus: In_Progress\nnext_role: pm\n---\n# Handoff\n\n## Pending & Handoff Notes\n- Released v${fx.version}\n- tag: deadbeef\n`);
  fx.put(".current/lane1/events.jsonl", "{\"n\":1}\n{\"n\":2}\n");
}

// The stop text of stop.lookup_failed, and the retry log line of log.lookup_retry.
const lookupStop = (branch, phase, last = FAIL_ERR) => `RELEASE_STOP GH_UNAVAILABLE: gh pr view ${branch} failed 3 times (last: exit 1 — ${last}) — a failed lookup, not a missing pull request; re-run ${phase} once gh answers`;
const retryLine = (step, branch, n, seconds = 10) => `release: [${step}] gh pr view ${branch} failed (exit 1); attempt ${n} of 3, retrying in ${seconds}s`;
// One call site: every lookup of `branch` fails; 3 attempts, 2 sleeps, exit 14, never a missing-PR stop.
function assertLookupStop(r, { branch, phase, step, views, sleeps = [10000, 10000] }) {
  assert.equal(r.code, 14, `exit 14 GH_UNAVAILABLE (stop: ${stopLine(r)})`);
  assert.equal(stopLine(r), lookupStop(branch, phase));
  assert.equal(prViews(r, branch).length, views, `gh pr view calls for ${branch}`);
  assert.deepEqual(r.sleeps, sleeps, "injected sleep between attempts");
  assert.ok(!/PR_CANNOT_MERGE|MERGE_WAIT_TIMEOUT/.test(r.err), "never reported as a missing pull request or a merge timeout");
  const lines = r.out.split("\n");
  assert.ok(lines.includes(retryLine(step, branch, 1)) && lines.includes(retryLine(step, branch, 2)), "one log.lookup_retry line per failed attempt that is retried");
  assert.ok(!lines.includes(retryLine(step, branch, 3)), "no retry line after the last attempt");
}

// ---------------------------------------------------------------- E463

test("E463-AC1 a pr view that says `no pull requests found` is one call, no retry, and reads as no pull request (publish)", async () => {
  // WHY: gh reports a genuinely missing PR with its own message; that case must keep stopping PR_CANNOT_MERGE at once.
  for (const err of ['no pull requests found for branch "release/v1.2.4"', '\nno pull requests found for branch "release/v1.2.4"\nextra line']) {
    const fx = mkFixture();
    failLookups(fx, fx.relBranch, -1, err);
    const r = await runMain(fx, ["publish", "--version", fx.version]);
    assert.equal(r.code, 42, stopLine(r));
    assert.equal(stopLine(r), `RELEASE_STOP PR_CANNOT_MERGE: no open or merged pull request for ${fx.relBranch}`);
    assert.equal(prViews(r, fx.relBranch).length, 1, "one call, no retry");
    assert.deepEqual(r.sleeps, [], "no sleep");
    assert.ok(!r.out.includes("retrying in"), "no retry log line");
  }
});

test("E463-AC1 not found at close-out goes on to open the bookkeeping pull request (unchanged)", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  assert.equal(r.code, 0, r.err);
  assert.ok(r.cmds.some((c) => c.startsWith("gh pr create ")), "the bookkeeping pull request was created");
  const first = r.cmds.findIndex((c) => c.startsWith(`gh pr view ${fx.bk} `));
  assert.ok(first >= 0 && !r.cmds[first + 1].startsWith("gh pr view "), "the pre-check lookup is one call");
  assert.deepEqual(r.sleeps, [], "no sleep");
  assert.ok(!r.out.includes("retrying in"), "no retry log line");
});

for (const dry of [false, true]) {
  test(`E463-AC2 every lookup fails: publish${dry ? " --dry-run" : ""} makes 3 pr view calls, sleeps twice, stops 14 stop.lookup_failed and goes no further`, async () => {
    // WHY: a transient GitHub error must not read as "no pull request" (issue #190); the stop names gh's own error.
    const fx = mkFixture();
    await prepared(fx);
    failLookups(fx, fx.relBranch);
    const r = await runMain(fx, ["publish", "--version", fx.version, ...(dry ? ["--dry-run"] : [])]);
    assertLookupStop(r, { branch: fx.relBranch, phase: "publish", step: "pre-3", views: 3 });
    const lastView = r.cmds.map((c, i) => [c, i]).filter(([c]) => c.startsWith("gh pr view ")).pop()[1];
    assert.deepEqual(r.cmds.slice(lastView + 1), [], "no call after the pre-check (no rev-parse, merge, tag or release)");
  });
}

for (const failures of [1, 2]) {
  test(`E463-AC3 ${failures} failed lookup(s) then success: publish proceeds as if the first lookup had succeeded`, async () => {
    const fx = mkFixture();
    await prepared(fx);
    failLookups(fx, fx.relBranch, failures);
    const r = await runMain(fx, ["publish", "--version", fx.version]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, new RegExp(`release: publish OK \\(${fx.tag}\\)`));
    const lines = r.out.split("\n");
    for (let n = 1; n <= failures; n++) assert.ok(lines.includes(retryLine("pre-3", fx.relBranch, n)), `log.lookup_retry for attempt ${n}`);
    assert.equal(lines.filter((l) => l.includes("retrying in")).length, failures, "one retry line per failed attempt");
    assert.deepEqual(r.sleeps, Array(failures).fill(10000));
    assert.ok(r.cmds.some((c) => c.startsWith("gh release create ")), "the release was created");
  });
}

test("E463-AC4 close-out pre-check: a failed lookup of the bookkeeping branch retries 3 times then stops 14", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  failLookups(fx, fx.bk);
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  assertLookupStop(r, { branch: fx.bk, phase: "close-out", step: "pre-3", views: 3 });
  assert.ok(!r.cmds.some((c) => c.startsWith("gh pr create ")), "no bookkeeping pull request was created on a failed lookup");
});

test("E463-AC4 prepare step 8a-6 lookup before gh pr create: 3 attempts then stop 14, no pull request created", async () => {
  const fx = mkFixture();
  workTree(fx);
  failLookups(fx, fx.relBranch);
  const r = await runMain(fx, prepareArgs(fx));
  assertLookupStop(r, { branch: fx.relBranch, phase: "prepare", step: "8a-6", views: 3 });
  assert.ok(!r.cmds.some((c) => c.startsWith("gh pr create ")), "a failed lookup is not 'no pull request': no gh pr create");
});

test("E463-AC4 prepare step 8a-6 lookup after gh pr create: 3 attempts then stop 14", async () => {
  // The create answers without a pull-request URL, so the number comes from the follow-up lookup.
  const fx = mkFixture();
  workTree(fx);
  ghState(fx, (s) => { s.createNoUrl = true; s.armAfterCreate = { branch: fx.relBranch, remaining: -1, err: FAIL_ERR }; });
  const r = await runMain(fx, prepareArgs(fx));
  assertLookupStop(r, { branch: fx.relBranch, phase: "prepare", step: "8a-6", views: 4 });
  assert.equal(r.cmds.filter((c) => c.startsWith("gh pr create ")).length, 1, "the pull request was created once, before the failing lookup");
});

test("E463-AC4 close-out step 13a-5 lookup after gh pr create: 3 attempts then stop 14", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  ghState(fx, (s) => { s.armAfterCreate = { branch: fx.bk, remaining: -1, err: FAIL_ERR }; });
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  assertLookupStop(r, { branch: fx.bk, phase: "close-out", step: "13a-5", views: 4 });
  assert.equal(r.cmds.filter((c) => c.startsWith("gh pr create ")).length, 1);
});

test("E463-AC4 publish merge wait (8c-2): a failed lookup after the merge request retries 3 times then stops 14", async () => {
  const fx = mkFixture();
  await prepared(fx);
  ghState(fx, (s) => { s.armAfterMerge = { branch: fx.relBranch, remaining: -1, err: FAIL_ERR }; });
  const r = await runMain(fx, ["publish", "--version", fx.version]);
  assertLookupStop(r, { branch: fx.relBranch, phase: "publish", step: "8c-2", views: 4 });
  assert.ok(r.cmds.some((c) => c.startsWith("gh pr merge ")), "the merge was requested before the wait");
});

test("E463-AC4 close-out merge wait (13a-6): a failed lookup after the merge request retries 3 times then stops 14", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  ghState(fx, (s) => { s.armAfterMerge = { branch: fx.bk, remaining: -1, err: FAIL_ERR }; });
  const r = await runMain(fx, ["close-out", "--version", fx.version]);
  assertLookupStop(r, { branch: fx.bk, phase: "close-out", step: "13a-6", views: 5 });
  assert.ok(r.cmds.some((c) => c.startsWith("gh pr merge ")));
});

test("E463-AC4 a deferred lookup under --dry-run is still not run and still returns not observed", async () => {
  const fx = mkFixture({ onMain: true });
  closeOutTree(fx);
  const r = await runMain(fx, ["close-out", "--version", fx.version, "--dry-run"]);
  assert.equal(r.code, 0, r.err);
  assert.equal(prViews(r, fx.bk).length, 1, "only the pre-check lookup ran; the 13a-5 and 13a-6 lookups were not run");
  assert.deepEqual(r.sleeps, []);
});

test("E463-AC5 the wait between attempts is AGC_RELEASE_GH_RETRY_SECONDS when a number >= 0, else 10s, as milliseconds through deps.sleep", async () => {
  // WHY: operators and tests need a short wait; a malformed value must fall back like envSeconds does elsewhere.
  const cases = [[undefined, [10000, 10000]], ["0", [0, 0]], ["abc", [10000, 10000]], ["", [10000, 10000]], ["-1", [10000, 10000]], ["2", [2000, 2000]]];
  for (const [value, want] of cases) {
    const fx = mkFixture();
    await prepared(fx);
    failLookups(fx, fx.relBranch);
    const r = await runMain(fx, ["publish", "--version", fx.version], { env: value === undefined ? {} : { AGC_RELEASE_GH_RETRY_SECONDS: value } });
    assert.equal(r.code, 14, `env ${JSON.stringify(value)}: ${stopLine(r)}`);
    assert.deepEqual(r.sleeps, want, `env ${JSON.stringify(value)}`);
    assert.equal(prViews(r, fx.relBranch).length, 3, "the attempt count is not configurable");
    assert.ok(r.out.split("\n").includes(retryLine("pre-3", fx.relBranch, 1, want[0] / 1000)), `retry line names ${want[0] / 1000}s`);
  }
});

test("E463-AC5 the helper exports GH_LOOKUP_ATTEMPTS (3) and GH_LOOKUP_RETRY_SECONDS (10)", async () => {
  const h = await helper();
  assert.equal(h.GH_LOOKUP_ATTEMPTS, 3);
  assert.equal(h.GH_LOOKUP_RETRY_SECONDS, 10);
});

const manualFallback = () => {
  const text = fs.readFileSync(path.join(REPO, "docs", "release-cd.md"), "utf-8");
  const at = text.indexOf("\n## Manual fallback");
  assert.ok(at >= 0, "docs/release-cd.md has a ## Manual fallback section");
  const rest = text.slice(at + 1), next = rest.indexOf("\n## ", 3);
  return next < 0 ? rest : rest.slice(0, next);
};

test("E463-AC6 docs/release-cd.md Manual fallback states doc.lookup_retry verbatim, after doc.gh_min", () => {
  const section = manualFallback();
  assert.ok(section.includes(DOC["doc.lookup_retry"]), "the doc.lookup_retry paragraph, verbatim");
  assert.ok(section.indexOf(DOC["doc.gh_min"]) < section.indexOf(DOC["doc.lookup_retry"]), "doc.gh_min comes first");
});

// ---------------------------------------------------------------- E464

test("E464-AC1 docs/release-cd.md Manual fallback states doc.gh_min verbatim and its version equals MIN_GH_VERSION", async () => {
  const section = manualFallback();
  assert.ok(section.includes(DOC["doc.gh_min"]), "the doc.gh_min paragraph, verbatim");
  const named = /need `gh` (\d+\.\d+\.\d+) or newer/.exec(section)?.[1];
  const { MIN_GH_VERSION } = await helper();
  assert.equal(MIN_GH_VERSION, "2.40.0");
  assert.equal(named, MIN_GH_VERSION, "the documented minimum is the checked minimum");
});

// Fixture A: an empty repo root, a fake spawn that answers `gh --version` with `version`, every other call exit 0.
const PHASE_ARGS = (a) => ({
  start: ["start", "--bump", "patch", "--tickets", "none", "--work-dir", a.work],
  prepare: ["prepare", "--version", "1.2.4", "--state", a.state, "--tickets", "none", "--message-file", a.msg],
  publish: ["publish", "--version", "1.2.4"], "close-out": ["close-out", "--version", "1.2.4"], record: ["record", "--version", "1.2.4"],
});
async function runBare(phase, version, { dry = false } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e463-bare-")));
  cleanup.push(base);
  const root = path.join(base, "repo");
  fs.mkdirSync(root);
  const state = path.join(base, "state.json"), msg = path.join(base, "msg.txt");
  fs.writeFileSync(state, JSON.stringify({ last_agent: "code-reviewer", status: "PASS", active_feature: "feat" }));
  fs.writeFileSync(msg, "chore(release): v1.2.4 — x\n");
  const calls = [], outs = [], errs = [], orch = { loads: 0 };
  const spawn = (bin, argv) => { calls.push({ bin, args: [...argv] }); return bin === "gh" && argv[0] === "--version" ? version : { status: 0, stdout: "", stderr: "" }; };
  const code = await rel.main([...PHASE_ARGS({ work: path.join(base, "work"), state, msg })[phase], ...(dry ? ["--dry-run"] : [])], {
    root, spawn, out: (s) => outs.push(s), err: (s) => errs.push(s), sleep: async () => {}, env: { PATH: process.env.PATH },
    importLanePaths: async () => ({ resolveCurrentLane: () => "lane1" }), importOrchestrator: async () => { orch.loads++; throw new Error("not loaded in this test"); },
  });
  return { code, out: outs.join(""), err: errs.join(""), calls, orch };
}
const ghCalls = (r) => r.calls.filter((c) => c.bin === "gh");
const FOUR = ["start", "prepare", "publish", "close-out"];
const stopOf = (r) => lastLine(r.err);

test("E464-AC2 each of start, prepare, publish, close-out runs `gh --version` first and once, before gh auth status (with and without --dry-run); record makes no gh call", async () => {
  for (const phase of FOUR) for (const dry of [false, true]) {
    const r = await runBare(phase, GH_OK, { dry });
    const label = `${phase}${dry ? " --dry-run" : ""}`, gh = ghCalls(r);
    assert.deepEqual(gh[0]?.args, ["--version"], `${label}: the first gh call is gh --version`);
    assert.equal(gh.filter((c) => c.args[0] === "--version").length, 1, `${label}: once`);
    assert.deepEqual(gh[1]?.args, ["auth", "status"], `${label}: gh auth status follows`);
    assert.ok(!/GH_UNAVAILABLE/.test(r.err), `${label}: a 2.40.0 gh does not stop the phase (${stopOf(r)})`);
  }
  for (const dry of [false, true]) assert.deepEqual(ghCalls(await runBare("record", GH_OK, { dry })), [], "record makes no gh call");
});

test("E464-AC3 gh 2.39.2 stops every phase 14 stop.gh_too_old with no child call after gh --version", async () => {
  const old = { status: 0, stdout: "gh version 2.39.2 (2023-11-15)\nhttps://github.com/cli/cli/releases/tag/v2.39.2\n", stderr: "" };
  for (const phase of FOUR) {
    const r = await runBare(phase, old);
    assert.equal(r.code, 14, `${phase}: ${stopOf(r)}`);
    assert.equal(stopOf(r), "RELEASE_STOP GH_UNAVAILABLE: gh 2.39.2 is older than 2.40.0, the minimum the release scripts need (gh run list --commit) — upgrade gh; see docs/release-cd.md, Manual fallback");
    assert.deepEqual(r.calls.map((c) => [c.bin, ...c.args]), [["gh", "--version"]], `${phase}: nothing follows gh --version (no auth status, repository or state call)`);
    assert.equal(r.orch.loads, 0, `${phase}: no state call`);
  }
});

test("E464-AC4 gh --version failing, unspawnable, or printing no version stops 14 with its own string", async () => {
  const failed = [
    [{ status: 1, stdout: "", stderr: "boom\n" }, "gh --version exited 1 — boom"],
    [{ status: null, stdout: "", stderr: "", error: new Error("spawn gh ENOENT") }, "gh --version exited -1 — spawn gh ENOENT"],
    [{ status: 1, stdout: "", stderr: "" }, "gh --version exited 1 — gh unavailable"],
  ];
  const unparsed = [
    [{ status: 0, stdout: "gh version DEV (2023-01-01)\n", stderr: "" }, 'gh --version printed no version (first line: "gh version DEV (2023-01-01)") — need gh 2.40.0 or newer'],
    [{ status: 0, stdout: "", stderr: "" }, 'gh --version printed no version (first line: "") — need gh 2.40.0 or newer'],
  ];
  for (const phase of FOUR) for (const [res, detail] of [...failed, ...unparsed]) {
    const r = await runBare(phase, res);
    assert.equal(r.code, 14, `${phase}: ${stopOf(r)}`);
    assert.equal(stopOf(r), `RELEASE_STOP GH_UNAVAILABLE: ${detail}`, phase);
    assert.deepEqual(ghCalls(r).map((c) => c.args), [["--version"]], `${phase}: gh --version is the only gh call`);
  }
});

test("E464-AC5 versions compare numerically per component; the first `gh version X.Y.Z` on the output is the one parsed", async () => {
  // WHY: a string compare would pass 2.4.10 and fail 2.100.0; a numeric compare per component does neither.
  const out = (v) => ({ status: 0, stdout: `gh version ${v} (2024-01-01)\n`, stderr: "" });
  const tooOld = (r) => r.code === 14 && /is older than 2\.40\.0/.test(stopOf(r));
  const unverified = (r) => r.code === 14 && /gh --version/.test(stopOf(r));
  for (const v of ["2.40.0", "2.40.1", "2.92.0", "2.100.0", "3.0.0", "2.41.0-rc.1"]) {
    const r = await runBare("publish", out(v));
    assert.ok(!tooOld(r) && !unverified(r), `${v} passes (${stopOf(r)})`);
    assert.deepEqual(ghCalls(r)[1]?.args, ["auth", "status"], `${v}: the phase goes on to gh auth status`);
  }
  for (const v of ["2.39.2", "2.4.10", "1.99.99"]) {
    const r = await runBare("publish", out(v));
    assert.ok(tooOld(r), `${v} fails (${stopOf(r)})`);
    assert.match(stopOf(r), new RegExp(`gh ${v.replace(/\./g, "\\.")} is older than`));
  }
  const noisy = await runBare("publish", { status: 0, stdout: "notice: update available\ngh version 2.39.2 (2023-11-15)\ngh version 2.99.0 (2025-01-01)\n", stderr: "" });
  assert.ok(tooOld(noisy), "the first version line wins");
  const lead = await runBare("publish", { status: 0, stdout: "notice: update available\ngh version 2.40.0 (2023-12-07)\n", stderr: "" });
  assert.ok(!tooOld(lead) && !unverified(lead), "a leading notice line is skipped");
});

test("E464-AC6 scripts/gh-compat.mjs exports the constants and pure functions, imports no child_process; gh --version is an allowed read; verify-release.mjs does not import the helper", async () => {
  assert.ok(fs.existsSync(HELPER), "scripts/gh-compat.mjs exists");
  const h = await helper(), src = fs.readFileSync(HELPER, "utf-8");
  assert.equal(h.MIN_GH_VERSION, "2.40.0");
  assert.equal(h.GH_LOOKUP_ATTEMPTS, 3);
  assert.equal(h.GH_LOOKUP_RETRY_SECONDS, 10);
  assert.ok(Object.values(h).filter((v) => typeof v === "function").length >= 2, "pure functions for the version check and the not-found test");
  assert.ok(!/child_process/.test(src), "every child call stays in release.mjs's runner");
  // The allow-list: exactly one argument, and a read.
  assert.equal(rel.isAllowed("gh", ["--version"]), true);
  assert.equal(rel.isAllowed("gh", ["--version", "x"]), false);
  assert.equal(rel.isAllowed("gh", ["version"]), false);
  const runner = rel.createRunner({ root: os.tmpdir(), spawn: () => ({ status: 0, stdout: "", stderr: "" }), out: () => {}, err: () => {} });
  assert.equal(runner.read("gh", ["--version"], { step: "pre-2" }).status, 0, "usable as a read");
  assert.throws(() => runner.mutate("gh", ["--version"], { step: "pre-2" }), (e) => e.classId === "INTERNAL", "not a mutation");
  // verify-release.mjs stays standalone: it never imports the helper (its byte-identity to the base is the judge's
  // `git diff` proof in X-AC1; a test may not read repository history as a fixture, test/render-structure.test.mjs).
  assert.ok(!/gh-compat/.test(fs.readFileSync(path.join(REPO, "scripts", "verify-release.mjs"), "utf-8")), "scripts/verify-release.mjs does not import the helper");
});

// ---------------------------------------------------------------- both tickets

test("X-AC1 no exit class is added or changed: GH_UNAVAILABLE stays code 14 in start, prepare, publish, close-out; the viewPr argv literal is intact", () => {
  const row = rel.EXIT_CLASSES.find((c) => c.id === "GH_UNAVAILABLE");
  assert.equal(row.code, 14);
  assert.deepEqual([...row.phases], ["start", "prepare", "publish", "close-out"]);
  assert.equal(rel.EXIT_CLASSES.length, 42);
  const src = fs.readFileSync(SCRIPT, "utf-8");
  assert.equal((src.match(/"--json", "number,state,mergeable,mergeStateStatus,statusCheckRollup,mergeCommit,headRefOid"/g) ?? []).length, 1, "the viewPr argv literal, once");
});

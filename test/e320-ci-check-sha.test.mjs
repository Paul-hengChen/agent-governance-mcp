// E320 (T-E320-02): `verify-release.mjs --ci-check --sha <sha>` finds the run by
// commit (not by the checkout's branch) and never degrades "could not verify"
// into PASSED. The real script runs in a throwaway git fixture; only `gh` is a
// PATH shim (same pattern as test/verify-release.test.mjs). Poll budgets are a
// few seconds and no assertion bounds wall-clock time, so load cannot flake them.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REAL_SCRIPT = fs.readFileSync(path.join(ROOT, "scripts", "verify-release.mjs"), "utf-8");
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "QA Fixture",
  GIT_AUTHOR_EMAIL: "qa-fixture@example.com",
  GIT_COMMITTER_NAME: "QA Fixture",
  GIT_COMMITTER_EMAIL: "qa-fixture@example.com",
  GIT_CONFIG_NOSYSTEM: "1",
};
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf-8", env: GIT_ENV }).trim();
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function resolveOnPath(bin) {
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    const c = path.join(dir, bin);
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      /* keep walking */
    }
  }
  throw new Error(`cannot find ${bin} on PATH`);
}

// Fixture: `main` (checked out) plus a lane branch holding one extra commit.
// Returns the lane commit's full sha — a sha that is NOT on the checked-out branch.
function mkFixture({ detach = false } = {}) {
  const root = tmp("e320-fixture-");
  git(["init", "-q"], root);
  git(["checkout", "-q", "-b", "main"], root);
  git(["config", "commit.gpgsign", "false"], root);
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "verify-release.mjs"), REAL_SCRIPT);
  fs.writeFileSync(path.join(root, "README.md"), "base\n");
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", "init"], root);
  git(["checkout", "-q", "-b", "lane/x"], root);
  fs.writeFileSync(path.join(root, "lane.txt"), "lane\n");
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", "lane commit"], root);
  const laneSha = git(["rev-parse", "HEAD"], root);
  git(["checkout", "-q", detach ? "--detach" : "main"], root);
  if (detach) git(["checkout", "-q", "--detach", "main"], root);
  return { root, laneSha };
}

// PATH dir with a logging `git` wrapper (so "git never called" is observable) and `cat`.
function mkToolPath() {
  const dir = tmp("e320-tools-");
  const logPath = path.join(dir, "git.log");
  fs.writeFileSync(logPath, "");
  fs.writeFileSync(
    path.join(dir, "git"),
    `#!/bin/sh\necho "$@" >> "${logPath}"\nexec "${resolveOnPath("git")}" "$@"\n`,
  );
  fs.chmodSync(path.join(dir, "git"), 0o755);
  fs.symlinkSync(resolveOnPath("cat"), path.join(dir, "cat"));
  return { dir, logPath };
}

// gh shim: appends argv to a log, answers responses[i] on call i (last repeats);
// a response of {exit: n} exits non-zero instead.
function mkGh(responses) {
  const dir = tmp("e320-gh-");
  const argvLog = path.join(dir, "argv.log");
  const counter = path.join(dir, "counter");
  fs.writeFileSync(argvLog, "");
  fs.writeFileSync(counter, "0");
  responses.forEach((r, i) => {
    fs.writeFileSync(path.join(dir, `resp-${i}`), typeof r === "string" ? r : "");
    if (typeof r !== "string") fs.writeFileSync(path.join(dir, `exit-${i}`), String(r.exit));
  });
  const last = responses.length - 1;
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\nN=$(cat "${counter}")\necho "$@" >> "${argvLog}"\nif [ "$N" -lt ${last} ]; then echo $((N + 1)) > "${counter}"; fi\nif [ -f "${dir}/exit-$N" ]; then echo "gh: boom" >&2; exit $(cat "${dir}/exit-$N"); fi\ncat "${dir}/resp-$N"\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return { dir, argvLog };
}

function run(root, ghDir, tools, args, waitSeconds = "0") {
  const pathValue = [ghDir, tools.dir].filter(Boolean).join(":");
  return spawnSync(process.execPath, [path.join(root, "scripts", "verify-release.mjs"), ...args], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env, PATH: pathValue, AGC_VERIFY_CI_WAIT_SECONDS: waitSeconds },
    timeout: 90_000,
  });
}

const runJson = (sha, conclusion, branch = "lane/x") =>
  JSON.stringify([{ conclusion, headSha: sha, headBranch: branch, url: "https://example.invalid/run/1", updatedAt: "2026-01-01T00:00:00Z" }]);

function setup(responsesFor, opts) {
  const fx = mkFixture(opts);
  const tools = mkToolPath();
  const gh = mkGh(responsesFor(fx.laneSha));
  return { ...fx, tools, gh };
}

test("E320 AC-E320-1/3: green run on another branch -> queried by --commit <full sha>, no --branch, PASSED", () => {
  const f = setup((s) => [runJson(s, "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, new RegExp(`CI-CHECK PASSED \\(${f.laneSha.slice(0, 12)}\\)`));
  const argv = fs.readFileSync(f.gh.argvLog, "utf-8");
  assert.ok(argv.includes(`--commit ${f.laneSha}`), `argv must carry the full sha; got: ${argv}`);
  assert.ok(!/--branch/.test(argv), `--sha path must not be scoped to the checkout branch; got: ${argv}`);
  assert.match(argv, /--workflow CI/);
});

test("E320 AC-E320-2: red run for the sha -> exit 1, FAIL names conclusion + 12-char sha, never PASSED", () => {
  const f = setup((s) => [runJson(s, "failure")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL/);
  assert.match(r.stderr, /failure/);
  assert.ok(r.stderr.includes(f.laneSha.slice(0, 12)));
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
});

test("E320 AC-E320-4: empty list, budget 0 -> FAIL 'no completed CI run', no E14 WARN, never PASSED", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha], "0");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL: CI ground-truth/);
  assert.match(r.stderr, /no completed CI run/);
  assert.ok(r.stderr.includes(f.laneSha.slice(0, 12)));
  assert.ok(!r.stdout.includes("graceful degradation"));
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
});

test("E320 AC-E320-4: only runs for other shas also FAIL (not WARN) once the budget is spent", () => {
  const f = setup(() => [runJson("a".repeat(40), "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha], "0");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no completed CI run/);
  assert.ok(!r.stdout.includes("graceful degradation"));
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
});

test("E320 AC-E320-4: empty list is POLLED within the budget, then a success on a later call -> PASSED", () => {
  const f = setup((s) => ["[]", runJson(s, "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha], "30");
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /CI-CHECK PASSED/);
  const calls = fs.readFileSync(f.gh.argvLog, "utf-8").trim().split("\n").length;
  assert.ok(calls >= 2, `empty answer must be re-polled; gh calls = ${calls}`);
});

test("E320 AC-E320-4: empty list keeps polling until the budget is exhausted (>1 gh call), then FAILs", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha], "3");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no completed CI run/);
  const calls = fs.readFileSync(f.gh.argvLog, "utf-8").trim().split("\n").length;
  assert.ok(calls >= 2, `gh calls = ${calls}`);
});

test("E320 AC-E320-5: abbreviated --sha resolves to the full sha (query, match, and the stdout CI-only line)", () => {
  const f = setup((s) => [runJson(s, "success")]);
  const abbrev = f.laneSha.slice(0, 7);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", abbrev]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(r.stdout.includes(`CI-only check (lenient) for ${f.laneSha.slice(0, 12)}`), r.stdout);
  assert.ok(fs.readFileSync(f.gh.argvLog, "utf-8").includes(`--commit ${f.laneSha}`));
});

test("E320 AC-E320-5: unresolvable --sha deadbee -> exit 1, message names the value, gh never called", () => {
  const f = setup((s) => [runJson(s, "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", "deadbee"]);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes("deadbee") && r.stderr.includes("--sha"), r.stderr);
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
  assert.equal(fs.readFileSync(f.gh.argvLog, "utf-8"), "");
});

test("E320 boundary: --sha \"\" -> exit 1 (base silently fell back to HEAD), gh never called", () => {
  const f = setup((s) => [runJson(s, "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", ""]);
  assert.equal(r.status, 1);
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
  assert.equal(fs.readFileSync(f.gh.argvLog, "utf-8"), "");
});

test("E320 boundary: --sha -x (single dash) -> exit 1 without ever handing it to git or gh", () => {
  const f = setup((s) => [runJson(s, "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", "-x"]);
  assert.equal(r.status, 1);
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
  const gitLog = fs.readFileSync(f.tools.logPath, "utf-8");
  assert.ok(!gitLog.includes("-x"), `git must not receive the dash-led value; log: ${gitLog}`);
  assert.equal(fs.readFileSync(f.gh.argvLog, "utf-8"), "");
});

test("E320 AC-E320-6: --sha + gh non-array JSON -> lenient WARN (unchanged), exit 0", () => {
  const f = setup(() => ['{"message":"not a list"}']);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /WARN/);
  assert.match(r.stdout, /graceful degradation, E14/);
});

test("E320 AC-E320-6: --sha + gh exits non-zero -> lenient WARN exit 0; with --strict FAIL exit 1", () => {
  const f = setup(() => [{ exit: 1 }]);
  const lenient = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--sha", f.laneSha]);
  assert.equal(lenient.status, 0, `stderr: ${lenient.stderr}`);
  assert.match(lenient.stdout, /graceful degradation, E14/);
  const strict = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--strict", "--sha", f.laneSha]);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /FAIL/);
  assert.ok(!strict.stdout.includes("CI-CHECK PASSED"));
});

test("E320 AC-E320-6: --sha + gh not on PATH -> lenient WARN exit 0", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, undefined, f.tools, ["--ci-check", "--sha", f.laneSha]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /WARN/);
  assert.match(r.stdout, /graceful degradation, E14/);
});

test("E320 AC-E320-9: detached HEAD + --sha -> no detached-HEAD WARN, verdict follows the sha's run", () => {
  const green = setup((s) => [runJson(s, "success")], { detach: true });
  const g = run(green.root, green.gh.dir, green.tools, ["--ci-check", "--sha", green.laneSha]);
  assert.equal(g.status, 0, `stderr: ${g.stderr}`);
  assert.ok(!/detached HEAD/.test(g.stdout), g.stdout);
  const red = setup((s) => [runJson(s, "failure")], { detach: true });
  const rr = run(red.root, red.gh.dir, red.tools, ["--ci-check", "--sha", red.laneSha]);
  assert.equal(rr.status, 1);
});

test("E320 AC-E320-7: no --sha path unchanged — queries the checkout branch with --branch, no --commit", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check"]);
  assert.equal(r.status, 0, `no-sha lenient empty list must still WARN, not FAIL; stderr: ${r.stderr}`);
  assert.match(r.stdout, /WARN/);
  const argv = fs.readFileSync(f.gh.argvLog, "utf-8");
  assert.match(argv, /--branch main/);
  assert.ok(!/--commit/.test(argv), argv);
});

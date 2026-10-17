// Coded by @qa-engineer
// E326 (T-E326-02): on the branch-scoped path (no --sha) `verify-release.mjs --ci-check` polls an
// EMPTY completed-run list within AGC_VERIFY_CI_WAIT_SECONDS instead of degrading at once. WHY: a
// freshly pushed release/* branch has no completed run yet, so an immediate strict FAIL is the same
// "CI not finished" condition the commit-scoped path (E320) already waits for. After the budget the
// reason text is unchanged. Real script in a throwaway git fixture; only `gh` is a PATH shim (E320
// pattern). Budgets are small and no assertion bounds wall-clock time.

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


const runJson = (sha, conclusion, branch = "main") =>
  JSON.stringify([{ conclusion, headSha: sha, headBranch: branch, url: "https://example.invalid/run/1", updatedAt: "2026-01-01T00:00:00Z" }]);

function setup(responsesFor) {
  const fx = mkFixture();
  const headSha = git(["rev-parse", "HEAD"], fx.root);
  const tools = mkToolPath();
  const gh = mkGh(responsesFor(headSha));
  return { ...fx, headSha, tools, gh };
}
const calls = (f) => fs.readFileSync(f.gh.argvLog, "utf-8").trim().split("\n").filter(Boolean).length;
const WARN_RE = /WARN: CI ground-truth — no completed CI runs found on \S+; continuing without CI verification \(graceful degradation, E14\)/;

test("E326 AC-E326-1: strict, [] then success for HEAD within the budget -> polls (progress line), exit 0, CI-CHECK PASSED", () => {
  const f = setup((s) => ["[]", runJson(s, "success")]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--strict"], "30");
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /no completed CI runs on \S+ yet; polling again in/);
  assert.match(r.stdout, /CI-CHECK PASSED/);
  assert.ok(calls(f) >= 2, `gh calls = ${calls(f)}`);
  assert.ok(!/--commit/.test(fs.readFileSync(f.gh.argvLog, "utf-8")), "stays branch-scoped (no --sha)");
});

test("E326 AC-E326-2: strict, [] and budget 0 -> exit 1, unchanged reason, exactly one gh call", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--strict"], "0");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL: CI ground-truth — no completed CI runs found on/);
  assert.equal(calls(f), 1);
  assert.ok(!r.stdout.includes("CI-CHECK PASSED"));
});

test("E326 AC-E326-2: strict, [] throughout a small budget -> >= 2 gh calls before the same FAIL", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--strict"], "2");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL: CI ground-truth — no completed CI runs found on/);
  assert.ok(calls(f) >= 2, `gh calls = ${calls(f)}`);
});

test("E326 AC-E326-3: lenient, [] and budget 0 -> exit 0 and the byte-identical WARN, one gh call", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check"], "0");
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, WARN_RE);
  assert.equal(calls(f), 1);
});

test("E326 AC-E326-3: lenient, [] throughout a small budget -> polls, then the same WARN, exit 0", () => {
  const f = setup(() => ["[]"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check"], "2");
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, WARN_RE);
  assert.ok(calls(f) >= 2);
});

test("E326 AC-E326-5: gh non-zero exit degrades on the FIRST call without polling (strict FAIL, lenient WARN)", () => {
  const strict = setup(() => [{ exit: 3 }]);
  const rs = run(strict.root, strict.gh.dir, strict.tools, ["--ci-check", "--strict"], "30");
  assert.equal(rs.status, 1);
  assert.equal(calls(strict), 1);
  const lenient = setup(() => [{ exit: 3 }]);
  const rl = run(lenient.root, lenient.gh.dir, lenient.tools, ["--ci-check"], "30");
  assert.equal(rl.status, 0, rl.stderr);
  assert.match(rl.stdout, /WARN: CI ground-truth/);
  assert.equal(calls(lenient), 1);
});

test("E326 AC-E326-5: unparseable gh output degrades on the first call without polling", () => {
  const f = setup(() => ["not json at all"]);
  const r = run(f.root, f.gh.dir, f.tools, ["--ci-check", "--strict"], "30");
  assert.equal(r.status, 1);
  assert.equal(calls(f), 1);
});

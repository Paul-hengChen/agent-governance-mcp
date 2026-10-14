// Coded by @qa-engineer
// Tests for backlog E298 items (1) and (5): .github/workflows/ci.yml push triggers (T-E298-01) and
// `agc feature finish --shipped` deleting the pushed lane branch on origin (T-E298-02, bin/agc-init.mjs
// deleteRemoteLaneBranch). Every scratch repo (primary, bare origin, lane) lives under os.tmpdir() and
// is torn down in the `after` hook, never inside this checkout. Network is never touched: "origin" is
// always a local bare repo or a nonexistent local path.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const CI_YML = path.join(PROJECT_ROOT, ".github", "workflows", "ci.yml");

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}
function gitTry(cwd, args) {
  try { return { status: 0, stdout: git(cwd, args) }; } catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? "") }; }
}
function localBranchExists(repo, b) {
  return gitTry(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${b}`]).status === 0;
}
function originBranchExists(bare, b) {
  return gitTry(bare, ["show-ref", "--verify", "--quiet", `refs/heads/${b}`]).status === 0;
}
function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
}

// Primary repo on main with a bare `origin` (unless withOrigin=false).
function makeFixture({ withOrigin = true } = {}) {
  const repo = mkTmp("e298-primary-");
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(repo, "README.md"), "# scratch\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "init"]);
  let bare = null;
  if (withOrigin) {
    bare = mkTmp("e298-origin-");
    git(bare, ["init", "--bare", "-b", "main"]);
    git(repo, ["remote", "add", "origin", bare]);
    git(repo, ["push", "origin", "main"]);
  }
  return { repo, bare };
}

// Start a lane, give it one commit, optionally push it to origin, merge it --no-ff into `base`.
function startAndMerge(repo, slug, { push, base = "main" }) {
  const lane = path.join(mkTmp("e298-lane-"), "lane");
  const branch = `feat/${slug}`;
  const s = runAgc(repo, ["start", slug, "--path", lane]);
  assert.equal(s.status, 0, `start stderr=${s.stderr}`);
  fs.writeFileSync(path.join(lane, "work.txt"), "work\n");
  git(lane, ["add", "work.txt"]);
  git(lane, ["commit", "-m", "lane work"]);
  if (push) git(repo, ["push", "origin", branch]);
  git(repo, ["merge", "--no-ff", "-m", `merge ${branch}`, branch]);
  return { lane, branch };
}

const OUT = (b) => `agc feature finish — deleted remote branch origin/${b}`;

// ---------------------------------------------------------------------------
// T-E298-01: ci.yml triggers
// ---------------------------------------------------------------------------
test("AC1: ci.yml on.push.branches is [main, feat/**, integ/**, release/**]", () => {
  const doc = yaml.load(fs.readFileSync(CI_YML, "utf-8"));
  assert.deepEqual(doc.on.push.branches, ["main", "feat/**", "integ/**", "release/**"]);
});

test("AC2: ci.yml on.pull_request.branches stays [main]; jobs untouched in shape", () => {
  const doc = yaml.load(fs.readFileSync(CI_YML, "utf-8"));
  assert.deepEqual(doc.on.pull_request.branches, ["main"]);
  assert.ok(doc.jobs && Object.keys(doc.jobs).length >= 1, "jobs block must still exist");
});

// ---------------------------------------------------------------------------
// T-E298-02: finish --shipped remote delete
// ---------------------------------------------------------------------------
test("AC3: finish --shipped with origin + tracking ref deletes the branch on origin (stdout line, after existing lines)", () => {
  const { repo, bare } = makeFixture();
  const { lane, branch } = startAndMerge(repo, "e298a-pushed", { push: true });
  assert.ok(originBranchExists(bare, branch), "precondition: branch on origin");
  const r = runAgc(repo, ["finish", "e298a", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(r.stdout.includes(OUT(branch)), r.stdout);
  assert.ok(r.stdout.indexOf(`deleted branch ${branch}`) < r.stdout.indexOf(OUT(branch)), "remote line follows local delete line (AC7)");
  assert.ok(r.stdout.includes("removed worktree"), "pre-existing line still printed (AC7)");
  assert.ok(!originBranchExists(bare, branch), "branch must be gone on origin");
  assert.ok(!localBranchExists(repo, branch));
  assert.ok(!fs.existsSync(lane));
});

test("AC4: no origin remote -> stderr hint, exit 0", () => {
  const { repo } = makeFixture({ withOrigin: false });
  const { branch } = startAndMerge(repo, "e298b-noorigin", { push: false });
  const r = runAgc(repo, ["finish", "e298b", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(r.stderr.includes(`agc feature finish — no origin remote, nothing to delete remotely for ${branch}`), r.stderr);
  assert.ok(!r.stdout.includes("deleted remote branch"));
  assert.ok(!localBranchExists(repo, branch));
});

test("AC5: never pushed (no tracking ref) -> stderr hint, exit 0, no network call even with unreachable origin", () => {
  const { repo, bare } = makeFixture();
  const { branch } = startAndMerge(repo, "e298c-neverpushed", { push: false });
  // Any attempted push/ls-remote would now fail loudly; the pre-check must be purely local.
  git(repo, ["remote", "set-url", "origin", path.join(os.tmpdir(), "e298-does-not-exist-xyz")]);
  const r = runAgc(repo, ["finish", "e298c", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(
    r.stderr.includes(`agc feature finish — ${branch} was never pushed to origin (no remote-tracking ref), nothing to delete remotely`),
    r.stderr,
  );
  assert.ok(!r.stderr.includes("could not delete"), "must not have attempted the push");
  assert.ok(!originBranchExists(bare, branch));
  assert.ok(!localBranchExists(repo, branch));
});

test("AC6a: push fails (origin unreachable after push) -> could-not-delete hint, exit 0, local branch + worktree still removed", () => {
  const { repo } = makeFixture();
  const { lane, branch } = startAndMerge(repo, "e298d-unreachable", { push: true });
  git(repo, ["remote", "set-url", "origin", path.join(os.tmpdir(), "e298-does-not-exist-abc")]);
  const r = runAgc(repo, ["finish", "e298d", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(
    r.stderr,
    new RegExp(`agc feature finish — could not delete remote branch origin/${branch.replace(/[/]/g, "\\/")} \\(.+\\); delete it by hand if it still exists`),
  );
  assert.ok(!localBranchExists(repo, branch));
  assert.ok(!fs.existsSync(lane));
});

test("AC6b: remote branch already deleted but tracking ref remains -> could-not-delete hint, exit 0", () => {
  const { repo, bare } = makeFixture();
  const { lane, branch } = startAndMerge(repo, "e298e-stale", { push: true });
  git(bare, ["update-ref", "-d", `refs/heads/${branch}`]); // deleted behind the lane's back; tracking ref stays
  assert.equal(gitTry(repo, ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`]).status, 0);
  const r = runAgc(repo, ["finish", "e298e", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(r.stderr.includes(`could not delete remote branch origin/${branch} (`), r.stderr);
  assert.ok(r.stderr.includes("delete it by hand if it still exists"));
  assert.ok(!r.stdout.includes("deleted remote branch"));
  assert.ok(!localBranchExists(repo, branch));
  assert.ok(!fs.existsSync(lane));
});

test("AC7a: --abandoned keeps the branch and never touches origin", () => {
  const { repo, bare } = makeFixture();
  const lane = path.join(mkTmp("e298-lane-"), "lane");
  const branch = "feat/e298f-abandoned";
  assert.equal(runAgc(repo, ["start", "e298f-abandoned", "--path", lane]).status, 0);
  git(repo, ["push", "origin", branch]);
  const r = runAgc(repo, ["finish", "e298f", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(localBranchExists(repo, branch), "branch kept");
  assert.ok(originBranchExists(bare, branch), "origin branch untouched");
  assert.ok(!r.stdout.includes("remote branch") && !r.stderr.includes("remote"), `${r.stdout}${r.stderr}`);
});

test("AC7b: --base other than main (integ/wave) still deletes the remote branch", () => {
  const { repo, bare } = makeFixture();
  git(repo, ["checkout", "-b", "integ/wave"]);
  git(repo, ["push", "origin", "integ/wave"]);
  const { lane, branch } = startAndMerge(repo, "e298g-integ", { push: true, base: "integ/wave" });
  const r = runAgc(repo, ["finish", "e298g", "--shipped", "--base", "integ/wave"]);
  assert.equal(r.status, 0, `stdout=${r.stdout} stderr=${r.stderr}`);
  assert.ok(r.stdout.includes(OUT(branch)), r.stdout);
  assert.ok(!originBranchExists(bare, branch));
  assert.ok(originBranchExists(bare, "integ/wave"), "base branch on origin must survive");
  assert.ok(!localBranchExists(repo, branch));
  assert.ok(!fs.existsSync(lane));
});

test("source: new code carries no ls-remote (local tracking-ref pre-check only)", () => {
  const src = fs.readFileSync(AGC_INIT, "utf-8");
  const start = src.indexOf("function deleteRemoteLaneBranch(");
  assert.ok(start > 0, "helper must exist");
  const body = src.slice(start, src.indexOf("\nasync function runFeatureFinish", start));
  assert.ok(!/ls-remote/.test(body), "deleteRemoteLaneBranch must not use ls-remote");
});

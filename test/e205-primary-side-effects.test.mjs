// Coded by @qa-engineer
// E205 (T-E196-06): `agc feature start` snapshots the primary checkout's git status and
// `agc feature finish` warns about every path that is new in primary since. Spec:
// specs/e196-agc-init-lane-checks.md (AC-E205-1..5, 7; -6 is a code-review item). Why: a lane
// session that writes into primary by mistake is invisible until someone commits it; the
// warning (never a refusal) names the paths. The comparison is between path sets, not contents,
// so primary's own in-flight work is never flagged. Every fixture is a temp repo.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const gitStatus = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const feature = (cwd, args) =>
  spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

const LANE = "e05";
const BRANCH = "feat/e05-x";
const SNAP = "agc-primary-status";
const HEAD = "agc feature finish — warning:";
const HEAD_TAIL = "path(s) in the primary checkout's git status are new since agc feature start";

function makeRepo() {
  const r = mkTmp("e205-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  writeFile(path.join(r, "tracked.txt"), "t\n");
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  // An empty node_modules keeps start's no-node_modules warning off stderr (e291 precedent);
  // git does not list an empty directory, so primary's status is unaffected.
  fs.mkdirSync(path.join(r, "node_modules"));
  return r;
}
function start(repo) {
  const lane = path.join(mkTmp("e205-lane-"), "lane");
  const s = feature(repo, ["start", "e05-x", "--path", lane]);
  assert.equal(s.status, 0, s.stderr);
  return { lane, start: s };
}
const snapPath = (lane) => path.resolve(lane, git(lane, ["rev-parse", "--git-path", SNAP]).trim());
const merge = (repo) => git(repo, ["merge", "-q", "--no-ff", "-m", "merge lane", BRANCH]);
const branchExists = (repo) =>
  gitStatus(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${BRANCH}`]) === 0;
const items = (stderr) =>
  stderr
    .split("\n")
    .filter((l) => l.startsWith("  "))
    .map((l) => l.trim());
const countOf = (hay, needle) => hay.split(needle).length - 1;

test("AC-E205-1: start writes primary's raw porcelain -z status to the per-worktree git dir, silently; not visible in the lane", () => {
  const repo = makeRepo();
  writeFile(path.join(repo, "pre.txt"), "p\n");
  const { lane, start: s } = start(repo);
  assert.equal(s.stderr, "", "start stderr is empty on success (e291 contract)");
  const p = snapPath(lane);
  assert.ok(fs.existsSync(p), "snapshot exists at the --git-path location");
  assert.ok(fs.readFileSync(p, "utf-8").includes("?? pre.txt\0"), "raw -z bytes of primary's status");
  assert.ok(!path.resolve(p).startsWith(path.resolve(lane) + path.sep), "outside the lane working tree");
  assert.ok(!git(lane, ["status", "--porcelain"]).includes(SNAP), "not listed by git status in the lane");
});

test("AC-E205-2: --shipped names every new path (untracked + newly modified), sorted, head once, teardown unchanged", () => {
  const repo = makeRepo();
  const { lane } = start(repo);
  merge(repo);
  writeFile(path.join(repo, "stray.txt"), "s\n");
  writeFile(path.join(repo, "README.md"), "changed\n");
  const r = feature(repo, ["finish", LANE, "--shipped"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(countOf(r.stderr, HEAD_TAIL), 1, r.stderr);
  assert.ok(r.stderr.includes(`${HEAD} 2 ${HEAD_TAIL} (a lane session may have written here by mistake; nothing was changed — check them by hand):\n`), r.stderr);
  assert.deepEqual(items(r.stderr), ["README.md", "stray.txt"]);
  assert.ok(!fs.existsSync(lane), "worktree removed as today");
  assert.equal(branchExists(repo), false, "branch deleted as today");
});

test("AC-E205-2: --abandoned names the same paths; worktree removed, branch kept as today", () => {
  const repo = makeRepo();
  const { lane } = start(repo);
  writeFile(path.join(repo, "stray.txt"), "s\n");
  writeFile(path.join(repo, "tracked.txt"), "changed\n");
  const r = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(countOf(r.stderr, HEAD_TAIL), 1, r.stderr);
  assert.deepEqual(items(r.stderr), ["stray.txt", "tracked.txt"]);
  assert.ok(!fs.existsSync(lane));
  assert.equal(branchExists(repo), true);
});

test("AC-E205-3: paths already dirty in primary at start are never named, even when their content changed", () => {
  const repo = makeRepo();
  writeFile(path.join(repo, "pre.txt"), "p1\n"); // untracked at start
  writeFile(path.join(repo, "tracked.txt"), "m1\n"); // modified at start
  const { lane } = start(repo);
  writeFile(path.join(repo, "pre.txt"), "p2 changed after start\n");
  writeFile(path.join(repo, "tracked.txt"), "m2 changed after start\n");
  // Only pre-existing paths changed: no e205 output at all.
  const quiet = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.equal(countOf(quiet.stderr, HEAD_TAIL), 0, quiet.stderr);
  assert.ok(!fs.existsSync(lane));

  // Positive control on a fresh lane: a genuinely new path is named, the pre-existing ones are not.
  const repo2 = makeRepo();
  writeFile(path.join(repo2, "pre.txt"), "p1\n");
  writeFile(path.join(repo2, "tracked.txt"), "m1\n");
  start(repo2);
  writeFile(path.join(repo2, "pre.txt"), "p2\n");
  writeFile(path.join(repo2, "new.txt"), "n\n");
  const loud = feature(repo2, ["finish", LANE, "--abandoned"]);
  assert.equal(loud.status, 0, loud.stderr);
  assert.deepEqual(items(loud.stderr), ["new.txt"]);
});

test("AC-E205-4: finish's own outputs are not flagged; a re-run after a refused worktree remove names no history path", () => {
  const repo = makeRepo();
  const { lane } = start(repo);
  merge(repo);
  // An untracked, non-ignored file makes `git worktree remove` refuse after finish has mutated.
  writeFile(path.join(lane, "dirty.txt"), "d\n");
  const first = feature(repo, ["finish", LANE, "--shipped"]);
  assert.notEqual(first.status, 0, "first finish refused by the dirty lane worktree");
  assert.ok(fs.existsSync(path.join(repo, ".current", "history")), "first run left its own history output in primary");
  assert.ok(!first.stderr.includes(".current/history/"), `first run: ${first.stderr}`);
  fs.rmSync(path.join(lane, "dirty.txt"));
  const second = feature(repo, ["finish", LANE, "--shipped"]);
  assert.equal(second.status, 0, second.stderr);
  assert.ok(!second.stderr.includes(".current/history/"), `re-run: ${second.stderr}`);
  assert.equal(countOf(second.stderr, HEAD_TAIL), 0, second.stderr);
});

test("AC-E205-5: no snapshot file: silent skip, finish behaves as today", () => {
  const repo = makeRepo();
  const { lane } = start(repo);
  fs.rmSync(snapPath(lane));
  writeFile(path.join(repo, "stray.txt"), "s\n");
  const r = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stderr.includes("e205") && !r.stderr.includes("new since agc feature start"), r.stderr);
  assert.ok(!r.stderr.includes("new-path check skipped"), r.stderr);
  assert.ok(!fs.existsSync(lane));
});

test("AC-E205-7: after --shipped, the snapshot exists nowhere under primary and the lane is unregistered", () => {
  const repo = makeRepo();
  const { lane } = start(repo);
  merge(repo);
  assert.ok(fs.existsSync(snapPath(lane)));
  const r = feature(repo, ["finish", LANE, "--shipped"]);
  assert.equal(r.status, 0, r.stderr);
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === SNAP) found.push(path.join(dir, e.name));
      if (e.isDirectory()) walk(path.join(dir, e.name));
    }
  };
  walk(repo); // includes primary's own .git: the admin dir went away with the worktree
  assert.deepEqual(found, []);
  assert.ok(!git(repo, ["worktree", "list", "--porcelain"]).includes(`branch refs/heads/${BRANCH}`));
  assert.equal(tracked(repo), false, "never committed");
});

function tracked(repo) {
  return git(repo, ["ls-files"]).split("\n").some((f) => f.endsWith(SNAP));
}

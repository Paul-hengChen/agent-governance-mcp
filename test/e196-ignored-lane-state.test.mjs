// Coded by @qa-engineer
// E196 / E206 (T-E196-04): `agc feature finish` keeps a lane's git-ignored `.current/<lane>/`
// files when the lane dir is tracked, on the first run, for both dispositions. Spec:
// specs/e196-agc-init-lane-checks.md (AC-E196-1..6). Why: `git mv` (--shipped) carries tracked
// files only and the --abandoned harvest used to skip a dir with any tracked content, so
// `git worktree remove` silently deleted the ignored files. Every fixture is a temp repo.

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
const bucket = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
};
const branchExists = (repo, b) =>
  gitStatus(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${b}`]) === 0;

const LANE = "e96";
const BRANCH = "feat/e96-x";
const CUR = `.current/${LANE}`;
const hist = (repo, rel = "") => path.join(repo, ".current", "history", bucket(), LANE, rel);

function makeRepo(exclude) {
  const r = mkTmp("e196-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  fs.appendFileSync(path.join(r, ".git", "info", "exclude"), exclude);
  return r;
}

// Lane with a tracked `.current/<lane>/handoff.md` (so the dir has tracked content) plus the
// given git-ignored files written in the worktree only.
function startTrackedLane(repo, ignored) {
  const lane = path.join(mkTmp("e196-lane-"), "lane");
  const s = feature(repo, ["start", "e96-x", "--path", lane]);
  assert.equal(s.status, 0, s.stderr);
  writeFile(path.join(lane, CUR, "handoff.md"), "tracked\n");
  git(lane, ["add", "-f", `${CUR}/handoff.md`]);
  git(lane, ["commit", "-qm", "track lane dir"]);
  for (const [rel, bytes] of Object.entries(ignored)) writeFile(path.join(lane, CUR, rel), bytes);
  return lane;
}
const merge = (repo) => git(repo, ["merge", "-q", "--no-ff", "-m", "merge lane", BRANCH]);
const tracked = (repo, rel) => gitStatus(repo, ["ls-files", "--error-unmatch", "--", rel]) === 0;

const EXCL = "/.current/*/notes.local\n/.current/*/other.local\n";

const block = (id) =>
  "```pending-ticket\nlane_local_id: " + id + "\ntitle: t " + id + "\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n";

test("AC-E196-1: --shipped first run, tracked shape: ignored files copied to history, not committed, listed", () => {
  const repo = makeRepo(EXCL);
  const lane = startTrackedLane(repo, { "notes.local": "n1\n", "other.local": "o1\n" });
  merge(repo);
  const r = feature(repo, ["finish", LANE, "--shipped"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(hist(repo, "notes.local"), "utf-8"), "n1\n");
  assert.equal(fs.readFileSync(hist(repo, "other.local"), "utf-8"), "o1\n");
  assert.equal(tracked(repo, `.current/history/${bucket()}/${LANE}/notes.local`), false);
  assert.equal(tracked(repo, `.current/history/${bucket()}/${LANE}/other.local`), false);
  assert.ok(
    r.stdout.includes(
      `agc feature finish — copied 2 git-ignored file(s) under .current/${LANE}/ into .current/history/${bucket()}/${LANE}/ (fs copy, not committed — git mv carries tracked files only):`,
    ),
    r.stdout,
  );
  assert.ok(r.stdout.includes(`\n  ${CUR}/notes.local`), r.stdout);
  assert.ok(r.stdout.includes(`\n  ${CUR}/other.local`), r.stdout);
  // The tracked file moved by git mv (close commit unchanged) and is tracked at the history path.
  assert.equal(tracked(repo, `.current/history/${bucket()}/${LANE}/handoff.md`), true);
  assert.ok(!fs.existsSync(lane), "worktree removed");
  assert.equal(branchExists(repo, BRANCH), false, "branch deleted");
});

test("AC-E196-2: --abandoned, partly tracked lane dir: only ignored files copied, branch kept", () => {
  const repo = makeRepo(EXCL);
  const lane = startTrackedLane(repo, { "notes.local": "n2\n" });
  const r = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(hist(repo, "notes.local"), "utf-8"), "n2\n");
  assert.equal(tracked(repo, `.current/history/${bucket()}/${LANE}/notes.local`), false);
  assert.ok(!fs.existsSync(hist(repo, "handoff.md")), "tracked files are not copied (durable on the branch)");
  assert.ok(
    r.stdout.includes(
      `agc feature finish — copied 1 git-ignored file(s) under .current/${LANE}/ into .current/history/${bucket()}/${LANE}/ (fs copy, not committed — the tracked rest of .current/${LANE}/ stays on ${BRANCH}):`,
    ),
    r.stdout,
  );
  assert.ok(r.stdout.includes(`\n  ${CUR}/notes.local`), r.stdout);
  assert.ok(!fs.existsSync(lane));
  assert.equal(branchExists(repo, BRANCH), true);
});

test("AC-E196-3: base-sha is the only ignored file: no e196 line, abandoned creates no history dir", () => {
  const abandoned = makeRepo(EXCL);
  startTrackedLane(abandoned, {});
  const a = feature(abandoned, ["finish", LANE, "--abandoned"]);
  assert.equal(a.status, 0, a.stderr);
  assert.ok(!/git-ignored file\(s\) under/.test(a.stdout), a.stdout);
  assert.ok(!fs.existsSync(hist(abandoned)), "no history dir for the base-sha-only shape (E180 AC8)");

  const shipped = makeRepo(EXCL);
  startTrackedLane(shipped, {});
  merge(shipped);
  const s = feature(shipped, ["finish", LANE, "--shipped"]);
  assert.equal(s.status, 0, s.stderr);
  assert.ok(!/git-ignored file\(s\) under/.test(s.stdout), s.stdout);
  assert.ok(!fs.existsSync(hist(shipped, "base-sha")), "base-sha is never copied");
});

test("AC-E196-4: one listing and one copy routine serve the call sites", () => {
  const src = fs.readFileSync(AGC_INIT, "utf-8");
  // definition + alreadyClosed re-run + first-run --shipped + --abandoned
  assert.equal((src.match(/laneIgnoredStateFiles\(/g) ?? []).length, 4);
  assert.equal((src.match(/function laneIgnoredStateFiles\(/g) ?? []).length, 1);
});

test("AC-E196-5 (--shipped): copy failure throws e196.copy-fail after the close commit; re-run finishes the copy", () => {
  const repo = makeRepo(EXCL);
  const lane = startTrackedLane(repo, { "notes.local": "n5\n" });
  merge(repo);
  // A directory at the file's history path cannot be overwritten by a file copy. A
  // pre-existing history dir would be refused at plan time (before the close commit), so the
  // blocker is planted by a post-commit hook: it lands only after the close commit has landed.
  const hook = path.join(repo, ".git", "hooks", "post-commit");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, `#!/bin/sh\nmkdir -p ".current/history/${bucket()}/${LANE}/notes.local"\n`);
  fs.chmodSync(hook, 0o755);
  const r1 = feature(repo, ["finish", LANE, "--shipped"]);
  assert.notEqual(r1.status, 0);
  assert.ok(r1.stderr.includes("worktree and branch left in place (re-running finish is safe)"), r1.stderr);
  assert.ok(fs.existsSync(lane), "worktree stays");
  assert.equal(branchExists(repo, BRANCH), true, "branch stays");
  assert.ok(r1.stderr.includes("agc feature finish --shipped: copy of git-ignored .current/e96/ files into"), r1.stderr);
  fs.rmSync(hook, { force: true });
  fs.rmSync(hist(repo, "notes.local"), { recursive: true, force: true });
  const r2 = feature(repo, ["finish", LANE, "--shipped"]);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(fs.readFileSync(hist(repo, "notes.local"), "utf-8"), "n5\n");
  assert.ok(!fs.existsSync(lane));
});

test("AC-E196-5 (--abandoned): copy failure is loud and safe; re-run skips identical, overwrites differing", () => {
  const repo = makeRepo(EXCL);
  const lane = startTrackedLane(repo, { "notes.local": "n5a\n", "other.local": "o5a\n" });
  fs.mkdirSync(hist(repo, "notes.local"), { recursive: true });
  const r1 = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.notEqual(r1.status, 0);
  assert.ok(r1.stderr.includes("worktree and branch left in place (re-running finish is safe)"), r1.stderr);
  assert.ok(fs.existsSync(lane));
  assert.equal(branchExists(repo, BRANCH), true);
  fs.rmSync(hist(repo, "notes.local"), { recursive: true, force: true });
  // identical copy already present for other.local; differing for notes.local
  writeFile(hist(repo, "other.local"), "o5a\n");
  writeFile(hist(repo, "notes.local"), "stale\n");
  const r2 = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(fs.readFileSync(hist(repo, "notes.local"), "utf-8"), "n5a\n", "differing copy overwritten");
  assert.equal(fs.readFileSync(hist(repo, "other.local"), "utf-8"), "o5a\n");
  assert.ok(!fs.existsSync(lane));
});

test("AC-E196-5 exception: --abandoned with a differing history pending-tickets.md refuses before any mutation", () => {
  const repo = makeRepo("pending-tickets.md\n");
  const lane = startTrackedLane(repo, { "pending-tickets.md": block("L1") });
  writeFile(hist(repo, "pending-tickets.md"), "someone else's bytes\n");
  const r = feature(repo, ["finish", LANE, "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes("already exists in the primary checkout and differs"), r.stderr);
  assert.ok(fs.existsSync(lane), "worktree not removed");
  assert.equal(fs.readFileSync(hist(repo, "pending-tickets.md"), "utf-8"), "someone else's bytes\n");
});

test("AC-E196-6: ignored worktree-only pending-tickets.md in a tracked lane dir, no primary copy: one regular file with the lane's bytes, no refusal", () => {
  const repo = makeRepo("pending-tickets.md\n");
  const body = block("L1");
  const lane = startTrackedLane(repo, { "pending-tickets.md": body });
  merge(repo);
  const r = feature(repo, ["finish", LANE, "--shipped"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stderr.includes("e287") && !r.stderr.includes("preserve"), r.stderr);
  const dst = hist(repo, "pending-tickets.md");
  assert.equal(fs.lstatSync(dst).isFile(), true, "regular file, not a symlink");
  assert.equal(fs.readFileSync(dst, "utf-8"), body);
  assert.ok(!fs.existsSync(lane));
});

test("AC-E196-6-carry: primary holds a differing .current/<lane>/pending-tickets.md that git mv would carry: --shipped refuses, nothing mutated", () => {
  const repo = makeRepo("pending-tickets.md\n");
  const lane = startTrackedLane(repo, { "pending-tickets.md": block("L1") });
  merge(repo);
  // After the merge, primary has the tracked lane dir; add its own excluded copy at the same path.
  const primaryCopy = path.join(repo, CUR, "pending-tickets.md");
  writeFile(primaryCopy, "PRIMARY OWN BYTES\n");
  const headBefore = git(repo, ["rev-parse", "HEAD"]).trim();
  const r = feature(repo, ["finish", LANE, "--shipped"]);
  assert.notEqual(r.status, 0, r.stdout);
  assert.ok(r.stderr.includes("pending-tickets.md"), r.stderr);
  assert.match(r.stderr, /differs/i, r.stderr);
  assert.equal(fs.readFileSync(primaryCopy, "utf-8"), "PRIMARY OWN BYTES\n", "primary's bytes survive");
  assert.equal(git(repo, ["rev-parse", "HEAD"]).trim(), headBefore, "no close commit");
  assert.ok(fs.existsSync(lane), "worktree left in place");
  assert.equal(branchExists(repo, BRANCH), true, "branch left in place");
  assert.ok(!fs.existsSync(hist(repo)), "no history dir created");
});

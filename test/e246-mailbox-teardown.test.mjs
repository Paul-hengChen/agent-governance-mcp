// Coded by @qa-engineer
// Tests for specs/e246-mailbox-teardown.md AC1-AC11: `agc feature finish`
// removes the lane's default-location mailbox `<dirname(worktree)>/_mailbox/<lane>/`
// (bin/agc-init.mjs removeLaneMailbox) and refuses to delete anything it does
// not recognise or that a live watch still holds.
//
// Why these tests exist: a stale mailbox lets a later lane with the same name
// inherit old messages, but deleting an unrecognised file or a live watch's
// lock would destroy someone's work. Each case pins one side of that line.
// Mailboxes are created under a temp dir next to a temp lane worktree — never
// the real lanes mailbox.
//
// Spec-to-Test map:
//   AC1+AC8 -> "shipped removes clean mailbox"
//   AC2     -> "abandoned removes clean mailbox"
//   AC3     -> "dead watch-lock sidecars are removed"
//   AC4     -> "unknown entry keeps folder and warns" (+ subdirectory / symlink variants)
//   AC5     -> "live watch-lock keeps folder and warns", "unparseable watch-lock keeps folder and warns"
//   AC6     -> "absent mailbox is a silent no-op", "sibling mailbox untouched"
//   AC7     -> "shipped mailbox removed even when branch -d refuses",
//              "refused worktree removal leaves mailbox"
//   AC9     -> "usage text mentions mailbox"
//   AC10    -> "integrator SOP names mailbox reset and finish cleanup"
//   AC11    -> "lane-protocol names mailbox lifecycle"

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
  for (const dir of TMP_DIRS) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}
function branchExists(repo, branch) {
  return spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: repo }).status === 0;
}
function makePrimaryRepo() {
  const repo = mkTmp("e246-primary-");
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(repo, "README.md"), "# scratch fixture\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "init"]);
  return repo;
}
function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
}

let seq = 0;
// Starts a lane; returns { repo, lane, lanePath, mailbox, ticket, branch, mailboxRoot }.
// The worktree sits in a fresh temp parent so `<parent>/_mailbox/<lane>` is private to the test.
function setupLane(slug) {
  seq += 1;
  const ticket = `e246${String.fromCharCode(96 + seq)}`;
  const repo = makePrimaryRepo();
  // Canonical path: finish prints git's realpath (macOS /var -> /private/var).
  const parent = fs.realpathSync(mkTmp("e246-lanes-"));
  const lanePath = path.join(parent, "lane");
  const branch = `feat/${ticket}-${slug}`;
  const r = runAgc(repo, ["start", `${ticket}-${slug}`, "--path", lanePath]);
  assert.equal(r.status, 0, `start failed: ${r.stderr}`);
  const mailboxRoot = path.join(parent, "_mailbox");
  const mailbox = path.join(mailboxRoot, ticket);
  return { repo, ticket, branch, lanePath, mailboxRoot, mailbox };
}
function mkMailbox(ctx, extra = {}) {
  fs.mkdirSync(ctx.mailbox, { recursive: true });
  fs.writeFileSync(path.join(ctx.mailbox, "to-integrator.md"), "hello\n");
  fs.writeFileSync(path.join(ctx.mailbox, "to-lane.md"), "");
  for (const [name, content] of Object.entries(extra)) {
    fs.writeFileSync(path.join(ctx.mailbox, name), content);
  }
}
function lock(pid, file) {
  return JSON.stringify({ pid, startedAt: "2026-09-30T00:00:00.000Z", file });
}
// A pid that is certainly not alive: spawn a child and reap it.
function deadPid() {
  const c = spawnSync(process.execPath, ["-e", "0"]);
  return c.pid;
}
function finishShipped(ctx) {
  git(ctx.repo, ["merge", "--no-ff", "-m", `merge ${ctx.branch}`, ctx.branch]);
  return runAgc(ctx.repo, ["finish", ctx.ticket, "--shipped"]);
}
function finishAbandoned(ctx) {
  return runAgc(ctx.repo, ["finish", ctx.ticket, "--abandoned"]);
}
function keptLines(stderr) {
  return stderr.split("\n").filter((l) => l.includes("agc feature finish — kept mailbox"));
}

test("shipped removes clean mailbox", () => {
  const ctx = setupLane("ship-clean");
  mkMailbox(ctx);
  const r = finishShipped(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(ctx.mailbox), "mailbox folder must be gone");
  assert.ok(!fs.existsSync(ctx.lanePath), "worktree must be removed");
  // AC8: success line, printed like the worktree line (absolute path).
  assert.ok(r.stdout.includes(`agc feature finish — removed mailbox ${ctx.mailbox}\n`), r.stdout);
  assert.ok(fs.existsSync(ctx.mailboxRoot), "the _mailbox root itself is never removed");
});

test("abandoned removes clean mailbox", () => {
  const ctx = setupLane("aband-clean");
  mkMailbox(ctx);
  const r = finishAbandoned(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(ctx.mailbox));
  assert.ok(!fs.existsSync(ctx.lanePath));
  assert.ok(branchExists(ctx.repo, ctx.branch), "abandoned keeps the branch");
  assert.ok(r.stdout.includes(`agc feature finish — removed mailbox ${ctx.mailbox}\n`), r.stdout);
});

test("dead watch-lock sidecars are removed", () => {
  const ctx = setupLane("dead-lock");
  const pid = deadPid();
  mkMailbox(ctx, {
    ".to-integrator.md.watch-lock": lock(pid, "to-integrator.md"),
    ".to-lane.md.watch-lock": lock(pid, "to-lane.md"),
  });
  const r = finishShipped(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(ctx.mailbox), "whole folder including dead sidecars removed");
});

function assertKept(ctx, r, reasonRe) {
  assert.equal(r.status, 0, `finish must still succeed: ${r.stderr}`);
  assert.ok(fs.existsSync(ctx.mailbox), "mailbox kept");
  const lines = keptLines(r.stderr);
  assert.equal(lines.length, 1, `exactly one warning line, got: ${r.stderr}`);
  assert.ok(lines[0].includes(ctx.mailbox), "warning names the mailbox path");
  assert.match(lines[0], reasonRe);
  assert.ok(!fs.existsSync(ctx.lanePath), "normal worktree outcome preserved");
}

test("unknown entry keeps folder and warns", () => {
  const ctx = setupLane("unknown");
  mkMailbox(ctx, { "notes.txt": "keep me\n" });
  const r = finishShipped(ctx);
  assertKept(ctx, r, /unknown entry notes\.txt/);
  assert.equal(fs.readFileSync(path.join(ctx.mailbox, "notes.txt"), "utf8"), "keep me\n");
  assert.equal(fs.readFileSync(path.join(ctx.mailbox, "to-integrator.md"), "utf8"), "hello\n");
  assert.ok(fs.existsSync(path.join(ctx.mailbox, "to-lane.md")));
  assert.ok(!r.stdout.includes("removed mailbox"));
});

test("unknown entry keeps folder and warns — subdirectory", () => {
  const ctx = setupLane("subdir");
  mkMailbox(ctx);
  fs.mkdirSync(path.join(ctx.mailbox, "sub"));
  const r = finishAbandoned(ctx);
  assertKept(ctx, r, /unknown entry sub/);
  assert.ok(fs.statSync(path.join(ctx.mailbox, "sub")).isDirectory());
});

test("unknown entry keeps folder and warns — symlink (target untouched)", () => {
  const ctx = setupLane("symlink");
  mkMailbox(ctx);
  const outside = mkTmp("e246-outside-");
  fs.writeFileSync(path.join(outside, "precious.txt"), "x");
  fs.symlinkSync(outside, path.join(ctx.mailbox, "link"));
  const r = finishShipped(ctx);
  assertKept(ctx, r, /unknown entry link/);
  assert.ok(fs.lstatSync(path.join(ctx.mailbox, "link")).isSymbolicLink());
  assert.ok(fs.existsSync(path.join(outside, "precious.txt")), "symlink target never followed or deleted");
});

test("live watch-lock keeps folder and warns", () => {
  const ctx = setupLane("live-lock");
  mkMailbox(ctx, { ".to-integrator.md.watch-lock": lock(process.pid, "to-integrator.md") });
  const r = finishShipped(ctx);
  assertKept(ctx, r, new RegExp(`watch-lock \\.to-integrator\\.md\\.watch-lock held by live pid ${process.pid}`));
  assert.ok(fs.existsSync(path.join(ctx.mailbox, ".to-integrator.md.watch-lock")));
});

test("unparseable watch-lock keeps folder and warns", () => {
  for (const [i, body] of ["not json{", JSON.stringify({ pid: "12", file: "x" }), JSON.stringify({ pid: 1.5 }), "null"].entries()) {
    const ctx = setupLane(`bad-lock${i}`);
    mkMailbox(ctx, { ".to-lane.md.watch-lock": body });
    const r = finishAbandoned(ctx);
    assertKept(ctx, r, /unparseable watch-lock \.to-lane\.md\.watch-lock/);
  }
});

test("absent mailbox is a silent no-op", () => {
  const ctx = setupLane("absent");
  const r = finishShipped(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!/mailbox/i.test(r.stdout), `stdout mentions mailbox: ${r.stdout}`);
  assert.ok(!/mailbox/i.test(r.stderr), `stderr mentions mailbox: ${r.stderr}`);
  assert.ok(!fs.existsSync(ctx.mailboxRoot), "finish must not create a _mailbox root");
});

test("sibling mailbox untouched", () => {
  const ctx = setupLane("sibling");
  mkMailbox(ctx);
  const sib = path.join(ctx.mailboxRoot, "e999z");
  fs.mkdirSync(sib, { recursive: true });
  fs.writeFileSync(path.join(sib, "to-integrator.md"), "other lane\n");
  const r = finishShipped(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(ctx.mailbox));
  assert.equal(fs.readFileSync(path.join(sib, "to-integrator.md"), "utf8"), "other lane\n");
});

test("shipped mailbox removed even when branch -d refuses", () => {
  const ctx = setupLane("branchd");
  mkMailbox(ctx);
  git(ctx.repo, ["merge", "--no-ff", "-m", `merge ${ctx.branch}`, ctx.branch]);
  // A stale ref lock makes the real `git branch -d` fail after the merge guard passed.
  const commonDir = path.resolve(ctx.repo, git(ctx.repo, ["rev-parse", "--git-common-dir"]).trim());
  fs.writeFileSync(path.join(commonDir, "refs", "heads", `${ctx.branch}.lock`), "");
  const r = runAgc(ctx.repo, ["finish", ctx.ticket, "--shipped"]);
  assert.notEqual(r.status, 0, "branch -d refusal keeps its existing non-zero exit");
  assert.match(r.stderr, /refused — delete it by hand/);
  assert.ok(branchExists(ctx.repo, ctx.branch), "branch survived the refusal");
  assert.ok(!fs.existsSync(ctx.lanePath), "worktree already removed");
  assert.ok(!fs.existsSync(ctx.mailbox), "mailbox removed before branch -d ran");
});

test("refused worktree removal leaves mailbox", () => {
  const ctx = setupLane("refused");
  mkMailbox(ctx);
  git(ctx.repo, ["merge", "--no-ff", "-m", `merge ${ctx.branch}`, ctx.branch]);
  // Untracked junk in the lane: `git worktree remove` (no --force) refuses.
  fs.writeFileSync(path.join(ctx.lanePath, "dirty.txt"), "uncommitted\n");
  const r = runAgc(ctx.repo, ["finish", ctx.ticket, "--shipped"]);
  assert.notEqual(r.status, 0, "removal refusal must fail finish");
  assert.ok(fs.existsSync(ctx.lanePath), "lane still live");
  assert.ok(fs.existsSync(path.join(ctx.mailbox, "to-integrator.md")), "mailbox untouched while lane is live");
  assert.ok(!r.stdout.includes("removed mailbox"));
  assert.equal(keptLines(r.stderr).length, 0);
});

test("usage text mentions mailbox", () => {
  const r = runAgc(PROJECT_ROOT, ["--help"]);
  const out = r.stdout + r.stderr;
  assert.ok(out.includes("_mailbox/<lane>/"), out);
});

test("integrator SOP names mailbox reset and finish cleanup", () => {
  const sop = fs.readFileSync(path.join(PROJECT_ROOT, "content", "skill-integrator.md"), "utf8");
  for (const frag of ["reset", "never reused", "by hand", "stop the mailbox watch", "removes the default-location mailbox"]) {
    assert.ok(sop.toLowerCase().includes(frag.toLowerCase()), `SOP missing fragment: ${frag}`);
  }
});

test("lane-protocol names mailbox lifecycle", () => {
  const doc = fs.readFileSync(path.join(PROJECT_ROOT, "docs", "lane-protocol.md"), "utf8");
  assert.ok(doc.includes("agc feature finish") && doc.includes("信箱在 `agc feature finish` 拆除 lane 時才會刪除"));
});

// Coded by @qa-engineer
// E335 (T-E335-02): `agc feature finish` converges on a lane whose .current/<lane>/pending-tickets.md
// is a symlink. The history copy must end as a regular file holding the bytes the O6 detector read
// (a link would dangle once the worktree is gone), only a link this run's harvest placed is replaced,
// and every other symlinked lane file keeps the link-copy semantics.
// Spec: specs/e291-start-link-locations.md (D7 + amendment, AC-E335-1..6). Fixtures are built in
// os.tmpdir() at runtime; the pre-fix residue a failed earlier run left is recreated by hand.

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
  for (const d of TMP_DIRS) {
    try {
      fs.chmodSync(d, 0o700);
    } catch {
      // best effort
    }
    fs.rmSync(d, { recursive: true, force: true });
  }
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const gitStatus = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const feature = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const lstat = (p) => {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
};
const isRegular = (p) => {
  const st = lstat(p);
  return st !== null && st.isFile() && !st.isSymbolicLink();
};
const bucket = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
};

const BACKLOG = "# B\n\n| id | desc | priority | status |\n|---|---|---|---|\n| E10 | x | P2 | open |\n";
const PEND =
  "```pending-ticket\nlane_local_id: L1\ntitle: local finding\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n";

function makeRepo({ exclude = "/.current/\n" } = {}) {
  const r = mkTmp("e335-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  writeFile(path.join(r, "docs", "backlog.md"), BACKLOG);
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  fs.appendFileSync(path.join(r, ".git", "info", "exclude"), exclude);
  return r;
}

// Lane "e9" (branch feat/e9-x); its findings file is .current/e9/pending-tickets.md.
const PEND_REL = ".current/e9/pending-tickets.md";
function startLane(repo) {
  const lane = path.join(mkTmp("e335-lane-"), "lane");
  const s = feature(repo, ["start", "e9-x", "--path", lane]);
  assert.equal(s.status, 0, s.stderr);
  return lane;
}
const laneDir = (lane) => path.join(lane, ".current", "e9");
const histDir = (repo) => path.join(repo, ".current", "history", bucket(), "e9");
const histPend = (repo) => path.join(histDir(repo), "pending-tickets.md");
const HIST_REL = () => `.current/history/${bucket()}/e9/pending-tickets.md`;
const branchExists = (repo) => gitStatus(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e9-x"]) === 0;
const noTempLeft = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"));

function commitAndMerge(repo, lane) {
  writeFile(path.join(lane, "f.txt"), "f\n");
  git(lane, ["add", "f.txt"]);
  git(lane, ["commit", "-qm", "lane work"]);
  git(repo, ["merge", "-q", "--no-ff", "-m", "merge lane", "feat/e9-x"]);
}

// The three link shapes the spec names: target inside the worktree (relative link into the lane dir,
// or one reaching outside .current/<lane>/, which dangles after a link-copy) and outside it.
const LINK_SHAPES = [
  {
    label: "target inside the lane dir (relative link)",
    make(lane) {
      writeFile(path.join(laneDir(lane), "findings-src.md"), PEND);
      fs.symlinkSync("findings-src.md", path.join(laneDir(lane), "pending-tickets.md"));
      return null;
    },
  },
  {
    label: "target elsewhere in the worktree (relative link out of the lane dir)",
    make(lane) {
      writeFile(path.join(lane, ".current", "scratch", "pending-target.md"), PEND);
      fs.mkdirSync(laneDir(lane), { recursive: true });
      fs.symlinkSync(path.join("..", "scratch", "pending-target.md"), path.join(laneDir(lane), "pending-tickets.md"));
      return null;
    },
  },
  {
    label: "target outside the worktree (absolute link)",
    make(lane) {
      const target = path.join(mkTmp("e335-outside-"), "pending-target.md");
      writeFile(target, PEND);
      fs.mkdirSync(laneDir(lane), { recursive: true });
      fs.symlinkSync(target, path.join(laneDir(lane), "pending-tickets.md"));
      return target;
    },
  },
];

// Another symlinked lane file: out of scope for D7, so it must still be harvested as a link.
function addOtherLink(lane) {
  const other = path.join(mkTmp("e335-other-"), "other-target.md");
  writeFile(other, "other\n");
  fs.symlinkSync(other, path.join(laneDir(lane), "other-link.md"));
  return other;
}

function assertConverged(repo, res, outsideTarget) {
  const dst = histPend(repo);
  assert.ok(isRegular(dst), "history copy is a regular file, not a link");
  assert.equal(fs.readFileSync(dst, "utf-8"), PEND, "history copy holds the bytes the detector read");
  assert.deepEqual(noTempLeft(histDir(repo)), [], "no temp or aside file left behind");
  if (outsideTarget) assert.equal(fs.readFileSync(outsideTarget, "utf-8"), PEND, "link target unchanged");
  assert.ok(res.stderr.includes(`kept at ${HIST_REL()} in the primary checkout`), res.stderr);
}

// ============================================================================
// AC-E335-1 — --shipped, single run
// ============================================================================

for (const shape of LINK_SHAPES) {
  test(`AC-E335-1: --shipped, ${shape.label}: one run exits 0, history copy is a regular file with the target's bytes`, () => {
    const repo = makeRepo();
    const lane = startLane(repo);
    const outside = shape.make(lane);
    const other = addOtherLink(lane);
    commitAndMerge(repo, lane);

    const res = feature(repo, ["finish", "e9", "--shipped"]);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(!fs.existsSync(lane), "worktree removed");
    assert.match(res.stderr, /agc feature finish — warning: lane e9: \.current\/e9\/pending-tickets\.md is not committed on main/);
    assertConverged(repo, res, outside);
    const otherCopy = path.join(histDir(repo), "other-link.md");
    assert.ok(lstat(otherCopy)?.isSymbolicLink(), "another symlinked lane file keeps the link-copy semantics");
    assert.equal(fs.realpathSync(otherCopy), fs.realpathSync(other));
  });
}

// ============================================================================
// AC-E335-2 — --abandoned, single run
// ============================================================================

for (const shape of LINK_SHAPES) {
  test(`AC-E335-2: --abandoned, ${shape.label}: one run exits 0, branch kept, history copy is a regular file`, () => {
    const repo = makeRepo();
    const lane = startLane(repo);
    const outside = shape.make(lane);
    const other = addOtherLink(lane);

    const res = feature(repo, ["finish", "e9", "--abandoned"]);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(!fs.existsSync(lane), "worktree removed");
    assert.equal(branchExists(repo), true, "--abandoned keeps the branch");
    assertConverged(repo, res, outside);
    assert.ok(lstat(path.join(histDir(repo), "other-link.md")).isSymbolicLink(), "other link still a link");
    assert.equal(fs.realpathSync(path.join(histDir(repo), "other-link.md")), fs.realpathSync(other));
  });
}

// ============================================================================
// AC-E335-3 — --shipped re-run from the state a pre-fix failing run leaves
// ============================================================================

for (const shape of [LINK_SHAPES[1], LINK_SHAPES[2]]) {
  test(`AC-E335-3: --shipped re-run over a history symlink left by a failed run (${shape.label}) converges`, () => {
    const repo = makeRepo();
    const lane = startLane(repo);
    const outside = shape.make(lane);
    commitAndMerge(repo, lane);
    writeFile(path.join(lane, "blocker.txt"), "x\n"); // untracked, not ignored: worktree remove refuses

    const first = feature(repo, ["finish", "e9", "--shipped"]);
    assert.notEqual(first.status, 0, "forced late failure");
    assert.ok(fs.existsSync(lane), "worktree still present");
    assert.match(fs.readFileSync(path.join(repo, "tasks.md"), "utf-8"), /## Closed Lanes[\s\S]*e9/, "lane recorded as closed");
    // Recreate the pre-fix residue: the history copy is the lane's link, copied as a link.
    fs.rmSync(histPend(repo), { force: true });
    fs.symlinkSync(fs.readlinkSync(path.join(laneDir(lane), "pending-tickets.md")), histPend(repo));
    fs.rmSync(path.join(lane, "blocker.txt"));

    const rerun = feature(repo, ["finish", "e9", "--shipped"]);
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.match(rerun.stdout + rerun.stderr, /already recorded under tasks\.md ## Closed Lanes/, "this is the re-run path");
    assert.ok(!fs.existsSync(lane), "worktree removed");
    assertConverged(repo, rerun, outside);
  });
}

test("AC-E335-3: --shipped re-run when the failed run already left a regular history copy converges too", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  const outside = LINK_SHAPES[2].make(lane);
  commitAndMerge(repo, lane);
  writeFile(path.join(lane, "blocker.txt"), "x\n");
  const first = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(first.status, 0);
  assert.ok(isRegular(histPend(repo)), "the fixed first run already materializes the copy");
  fs.rmSync(path.join(lane, "blocker.txt"));

  const rerun = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.ok(!fs.existsSync(lane));
  assertConverged(repo, rerun, outside);
});

// ============================================================================
// AC-E335-4 — an uncovered destination holding a symlink is still refused
// ============================================================================

// A tracked .current/e9/ with an ignored pending file and --abandoned: no harvest covers the
// destination, so a link already there (even one whose target holds identical bytes) is refused at
// plan time, unchanged. --shipped has no reachable uncovered-link state: its first run refuses an
// existing history dir, and its re-run lists a linked history copy as changed (covered).
function uncoveredFixture(laneLink) {
  const repo = makeRepo({ exclude: "pending-tickets.md\n" });
  const lane = startLane(repo);
  writeFile(path.join(laneDir(lane), "handoff.md"), "tracked\n");
  git(lane, ["add", "-f", ".current/e9/handoff.md"]);
  git(lane, ["commit", "-qm", "track lane dir"]);
  const target = path.join(mkTmp("e335-outside-"), "pending-target.md");
  writeFile(target, PEND);
  if (laneLink) fs.symlinkSync(target, path.join(laneDir(lane), "pending-tickets.md"));
  else writeFile(path.join(laneDir(lane), "pending-tickets.md"), PEND);
  return { repo, lane, target };
}

for (const laneLink of [true, false]) {
  const flag = "--abandoned";
  test(`AC-E335-4: ${flag}, lane file a ${laneLink ? "symlink" : "regular file"}, uncovered destination already a symlink -> unchanged e287.preserve-differs-refuse, nothing removed`, () => {
    const { repo, lane, target } = uncoveredFixture(laneLink);
    const dstRel = HIST_REL();
    const dstAbs = path.join(repo, ...dstRel.split("/"));
    fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
    const decoy = path.join(mkTmp("e335-decoy-"), "same-bytes.md");
    writeFile(decoy, PEND);
    fs.symlinkSync(decoy, dstAbs);

    const res = feature(repo, ["finish", "e9", flag]);
    assert.notEqual(res.status, 0, res.stderr);
    assert.ok(
      res.stderr.includes(
        `agc feature finish ${flag}: ${dstRel} already exists in the primary checkout and differs from ` +
          `the lane's ${PEND_REL} (1 unallocated finding(s)) — move it aside first (nothing applied, nothing removed)`
      ),
      res.stderr
    );
    assert.ok(fs.existsSync(lane), "worktree not removed");
    assert.equal(branchExists(repo), true, "branch not removed");
    assert.ok(lstat(dstAbs).isSymbolicLink(), "the uncovered link is never replaced");
    assert.equal(fs.readlinkSync(dstAbs), decoy);
    assert.equal(fs.readFileSync(decoy, "utf-8"), PEND, "nothing written through the link");
    assert.equal(fs.readFileSync(target, "utf-8"), PEND);
  });
}

// ============================================================================
// AC-E335-5 — a regular pending-tickets.md keeps the old behavior (abandoned re-run path)
// ============================================================================

test("AC-E335-5: regular-file pending-tickets.md, --abandoned refused then re-run -> regular copy, same bytes", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  writeFile(path.join(laneDir(lane), "pending-tickets.md"), PEND);
  writeFile(path.join(lane, "qa_reports", "review_T-E9-01.md"), "untracked evidence\n");

  const first = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.notEqual(first.status, 0, "untracked moved evidence makes worktree remove refuse");
  assert.ok(isRegular(histPend(repo)));
  fs.rmSync(path.join(lane, "qa_reports"), { recursive: true, force: true });

  const rerun = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.ok(!fs.existsSync(lane));
  assertConverged(repo, rerun, null);
});

// ============================================================================
// AC-E335-6 — --abandoned re-run convergence, residue (a) regular file and (b) symlink
// ============================================================================

for (const residue of ["a", "b"]) {
  test(`AC-E335-6 (${residue}): --abandoned re-run over a ${residue === "a" ? "regular-file" : "symlink"} history copy converges; other lane files harvested as before`, () => {
    const repo = makeRepo();
    const lane = startLane(repo);
    const target = LINK_SHAPES[2].make(lane);
    const other = addOtherLink(lane);
    writeFile(path.join(laneDir(lane), "notes.md"), "notes v1\n");
    writeFile(path.join(histDir(repo), "history-only.md"), "kept\n");
    // Moved but still untracked evidence: the harvest runs, then `git worktree remove` refuses.
    writeFile(path.join(lane, "qa_reports", "review_T-E9-01.md"), "untracked evidence\n");

    const first = feature(repo, ["finish", "e9", "--abandoned"]);
    assert.notEqual(first.status, 0, "first run refused at git worktree remove");
    assert.ok(fs.existsSync(lane), "worktree kept by the refused run");
    assert.ok(isRegular(histPend(repo)), "(a) is exactly what the fixed first run leaves");
    if (residue === "b") {
      // The pre-fix first run left the lane's link, copied as a link.
      fs.rmSync(histPend(repo));
      fs.symlinkSync(target, histPend(repo));
    }
    writeFile(path.join(laneDir(lane), "notes.md"), "notes v2\n");
    fs.rmSync(path.join(lane, "qa_reports"), { recursive: true, force: true });

    const rerun = feature(repo, ["finish", "e9", "--abandoned"]);
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.ok(!fs.existsSync(lane), "worktree removed");
    assert.equal(branchExists(repo), true, "branch kept");
    assertConverged(repo, rerun, target);
    const hist = histDir(repo);
    assert.equal(fs.readFileSync(path.join(hist, "notes.md"), "utf-8"), "notes v2\n", "the whole-dir copy still ran");
    assert.equal(fs.readFileSync(path.join(hist, "history-only.md"), "utf-8"), "kept\n", "history-only files kept (AC10)");
    assert.ok(lstat(path.join(hist, "other-link.md")).isSymbolicLink(), "other symlinked lane file still copied as a link");
    assert.equal(fs.realpathSync(path.join(hist, "other-link.md")), fs.realpathSync(other));
  });
}

// Failure injection on the T-E335-03 set-aside: when the whole-dir copy fails, the earlier history
// copy is put back (lossless), the worktree stays, and the next run converges.
test("AC-E335-6 (failure path): a failed --abandoned harvest restores the earlier history copy and a later run converges", (t) => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("root ignores file permissions, so the copy failure cannot be injected");
    return;
  }
  if (process.platform === "win32") {
    t.skip("chmod-based failure injection is POSIX-only");
    return;
  }
  const repo = makeRepo();
  const lane = startLane(repo);
  const target = LINK_SHAPES[2].make(lane);
  writeFile(histPend(repo), "OLD-HISTORY\n");
  const unreadable = path.join(laneDir(lane), "locked.md");
  writeFile(unreadable, "secret\n");
  fs.chmodSync(unreadable, 0o000);

  const failed = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /harvest of \.current\/e9\/ into \.current\/history\/.*failed/);
  assert.ok(fs.existsSync(lane), "worktree left in place");
  assert.ok(isRegular(histPend(repo)));
  assert.equal(fs.readFileSync(histPend(repo), "utf-8"), "OLD-HISTORY\n", "earlier history copy restored");
  assert.deepEqual(noTempLeft(histDir(repo)), [], "no aside file left");

  fs.chmodSync(unreadable, 0o600);
  const rerun = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assertConverged(repo, rerun, target);
});

// ============================================================================
// AC-E335-7 — failure clause of the D8 set-aside (T-E335-05, review recommendation R1)
// ============================================================================

// D8 sets aside every history link a same-named lane link would be copied over, sharing one aside
// list with the T-E335-03 pending-tickets.md set-aside. The failure test above holds only that first
// entry, so a restore loop that put back only the first aside would stay green there. Here the
// history dir holds TWO set-aside entries — the earlier pending-tickets.md copy (set aside first) and
// an other-link.md link pointing at a DIFFERENT target than the lane's link — so every aside must be
// restored for the history link to come back at its old target. "Nothing written through it" is
// checked on the old target's bytes: only rename may touch a history link.
test("AC-E335-7 (failure path): a failed --abandoned harvest restores every set-aside history link (old target, nothing written through it, no aside left) and a later run converges", (t) => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("root ignores file permissions, so the copy failure cannot be injected");
    return;
  }
  if (process.platform === "win32") {
    t.skip("chmod-based failure injection is POSIX-only");
    return;
  }
  const repo = makeRepo();
  const lane = startLane(repo);
  const target = LINK_SHAPES[2].make(lane);
  const laneOther = addOtherLink(lane);
  writeFile(histPend(repo), "OLD-HISTORY\n");
  const oldOther = path.join(mkTmp("e335-old-other-"), "old-other-target.md");
  writeFile(oldOther, "old other\n");
  const histOther = path.join(histDir(repo), "other-link.md");
  fs.symlinkSync(oldOther, histOther);
  assert.notEqual(fs.realpathSync(oldOther), fs.realpathSync(laneOther), "fixture: the two links differ in target");
  const unreadable = path.join(laneDir(lane), "locked.md");
  writeFile(unreadable, "secret\n");
  fs.chmodSync(unreadable, 0o000);

  const failed = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /harvest of \.current\/e9\/ into \.current\/history\/.*failed/);
  assert.match(failed.stderr, /worktree and branch left in place/, "unchanged harvest-failed error");
  assert.ok(fs.existsSync(lane), "worktree left in place");
  assert.equal(branchExists(repo), true, "branch left in place");
  assert.equal(fs.readFileSync(histPend(repo), "utf-8"), "OLD-HISTORY\n", "earlier history copy restored");
  assert.ok(lstat(histOther)?.isSymbolicLink(), "the set-aside history link is back at its original path");
  assert.equal(fs.readlinkSync(histOther), oldOther, "restored history link still points at its old target");
  assert.equal(fs.readFileSync(oldOther, "utf-8"), "old other\n", "nothing written through the history link");
  assert.equal(fs.readFileSync(laneOther, "utf-8"), "other\n", "lane link target untouched");
  assert.deepEqual(
    fs.readdirSync(histDir(repo)).filter((f) => f.endsWith(".aside.tmp")),
    [],
    "no .aside.tmp file left"
  );
  assert.deepEqual(noTempLeft(histDir(repo)), [], "no temp file left");

  fs.chmodSync(unreadable, 0o600);
  const rerun = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.ok(!fs.existsSync(lane), "worktree removed");
  assert.equal(branchExists(repo), true, "branch kept");
  assertConverged(repo, rerun, target);
  assert.ok(lstat(histOther)?.isSymbolicLink(), "other symlinked lane file still copied as a link");
  assert.equal(fs.realpathSync(histOther), fs.realpathSync(laneOther), "history link now resolves to the lane link's target");
  assert.equal(fs.readFileSync(oldOther, "utf-8"), "old other\n", "old target never written");
});

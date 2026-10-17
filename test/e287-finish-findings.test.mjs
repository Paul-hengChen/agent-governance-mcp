// Coded by @qa-engineer
// E287 (T-E287-02): `agc feature finish` never drops a lane's findings silently (O6) and never
// numbers a finding that names another repo (D4). Spec: specs/e287-finish-findings-and-small-fixes.md
// (AC-E287-1..10); mechanism: its -architecture.md. Every fixture is built in-test (os.tmpdir), no
// real repo content is asserted. The three regression pins from code-review round 2 are named R1-*:
// a committed (or target_repo-only) pending file must not warn on a re-run, a never-committed one
// must warn on both runs and converge.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parsePendingTickets, allocateTicketIds } from "../dist/tools/lane-ticket-allocation.js";

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
const agc = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
const feature = (cwd, args) => agc(cwd, ["feature", ...args]);
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const bucket = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
};

const BACKLOG = "# B\n\n| id | desc | priority | status |\n|---|---|---|---|\n| E10 | x | P2 | open |\n";

function makeRepo({ backlog = true, exclude = null } = {}) {
  const r = mkTmp("e287-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  if (backlog) writeFile(path.join(r, "docs", "backlog.md"), BACKLOG);
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  if (exclude) fs.appendFileSync(path.join(r, ".git", "info", "exclude"), exclude);
  return r;
}

const block = (id, title, extra = "", deps = "[]") =>
  "```pending-ticket\nlane_local_id: " +
  id +
  "\ntitle: " +
  title +
  "\npriority: P3\ndepends_on: " +
  deps +
  "\n" +
  extra +
  "body: |\n  b\n```\n";

// Lane ticket id is "e9" (branch feat/e9-x); its findings file is .current/e9/pending-tickets.md.
const PEND_REL = ".current/e9/pending-tickets.md";
function startLane(repo) {
  const lane = path.join(mkTmp("e287-lane-"), "lane");
  const s = feature(repo, ["start", "e9-x", "--path", lane]);
  assert.equal(s.status, 0, s.stderr);
  return lane;
}
function commitPending(lane, text) {
  writeFile(path.join(lane, PEND_REL), text);
  git(lane, ["add", "-f", PEND_REL]);
  git(lane, ["commit", "-qm", "pending"]);
}
function commitLaneFile(lane) {
  writeFile(path.join(lane, "f.txt"), "f\n");
  git(lane, ["add", "f.txt"]);
  git(lane, ["commit", "-qm", "lane work"]);
}
const merge = (repo) => git(repo, ["merge", "-q", "--no-ff", "-m", "merge lane", "feat/e9-x"]);
const mainLog = (repo) => git(repo, ["log", "--format=%s", "main"]).trim().split("\n");
const allocateCommits = (repo) => mainLog(repo).filter((s) => s.startsWith("chore(backlog): allocate"));
const branchExists = (repo) => gitStatus(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e9-x"]) === 0;
const histCopy = (repo) => path.join(repo, ".current", "history", bucket(), "e9", "pending-tickets.md");
const backlogRows = (repo) => fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8").split("\n").filter((l) => /^\| E\d+ /.test(l));

const MIXED = block("L1", "local finding") + block("X1", "other repo finding", "target_repo: sister-repo\n");

// ============================================================================
// O6: file only in the worktree (never at the revision)
// ============================================================================

test("AC-E287-1/3/9: --shipped, .current excluded: warns on stderr naming lane/path/rev/count/ids, exit 0, nothing allocated, history copy byte-identical", () => {
  const repo = makeRepo({ exclude: "/.current/\n" });
  const lane = startLane(repo);
  commitLaneFile(lane);
  writeFile(path.join(lane, PEND_REL), MIXED);
  merge(repo);

  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(lane), "worktree removed as at base");
  assert.equal(branchExists(repo), false, "--shipped deletes the branch");
  assert.deepEqual(allocateCommits(repo), [], "never numbered from the worktree copy");
  assert.equal(backlogRows(repo).length, 1, "backlog gains no rows");

  assert.match(res.stderr, /agc feature finish —/);
  assert.match(res.stderr, /lane e9/);
  assert.ok(res.stderr.includes(PEND_REL));
  assert.match(res.stderr, /not committed on main/);
  assert.match(res.stderr, /2 unapplied finding\(s\) were not allocated/);
  assert.match(res.stderr, /L1 — local finding/);
  assert.match(res.stderr, /X1 — other repo finding \[target_repo: sister-repo/); // AC-E287-9
  assert.ok(res.stderr.includes(`.current/history/${bucket()}/e9/pending-tickets.md`), "names the history copy");

  const dst = histCopy(repo);
  assert.ok(fs.existsSync(dst), "named destination exists");
  assert.equal(fs.readFileSync(dst, "utf-8"), MIXED, "byte-identical to the lane's file");
});

test("AC-E287-2/3/9: --abandoned, .current excluded: same warning, worktree removed, branch kept, history copy byte-identical", () => {
  const repo = makeRepo({ exclude: "/.current/\n" });
  const lane = startLane(repo);
  writeFile(path.join(lane, PEND_REL), MIXED);

  const res = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(lane));
  assert.equal(branchExists(repo), true, "--abandoned keeps the branch");
  assert.match(res.stdout, /kept branch/);
  assert.deepEqual(allocateCommits(repo), []);
  assert.match(res.stderr, /agc feature finish —/);
  assert.match(res.stderr, /not committed on feat\/e9-x/);
  assert.match(res.stderr, /2 unapplied finding\(s\) were not allocated/);
  assert.match(res.stderr, /L1 — local finding/);
  assert.match(res.stderr, /X1 — other repo finding \[target_repo: sister-repo/);
  assert.equal(fs.readFileSync(histCopy(repo), "utf-8"), MIXED);
});

test("AC-E287-3: tracked .current/<lane>/ with an ignored pending file (--shipped): the file survives at the named history path", () => {
  const repo = makeRepo({ exclude: "pending-tickets.md\n" });
  const lane = startLane(repo);
  writeFile(path.join(lane, ".current", "e9", "handoff.md"), "tracked\n");
  git(lane, ["add", "-f", ".current/e9/handoff.md"]);
  git(lane, ["commit", "-qm", "track lane dir"]);
  writeFile(path.join(lane, PEND_REL), MIXED);
  merge(repo);

  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /2 unapplied finding\(s\) were not allocated/);
  const named = res.stderr.match(/kept at (\S+) in the primary checkout/);
  assert.ok(named, `warning names a destination: ${res.stderr}`);
  const dst = path.join(repo, ...named[1].split("/"));
  assert.ok(fs.existsSync(dst), "the named destination exists");
  assert.equal(fs.readFileSync(dst, "utf-8"), MIXED);
});

test("AC-E287-3: tracked .current/<lane>/ with an ignored pending file (--abandoned): the file survives at the named history path", () => {
  const repo = makeRepo({ exclude: "pending-tickets.md\n" });
  const lane = startLane(repo);
  writeFile(path.join(lane, ".current", "e9", "handoff.md"), "tracked\n");
  git(lane, ["add", "-f", ".current/e9/handoff.md"]);
  git(lane, ["commit", "-qm", "track lane dir"]);
  writeFile(path.join(lane, PEND_REL), MIXED);

  const res = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(res.status, 0, res.stderr);
  const named = res.stderr.match(/kept at (\S+) in the primary checkout/);
  assert.ok(named, res.stderr);
  assert.equal(fs.readFileSync(path.join(repo, ...named[1].split("/")), "utf-8"), MIXED);
});

test("AC-E287-3: a differing file already at the history destination is refused at plan time, nothing removed", () => {
  const repo = makeRepo({ exclude: "pending-tickets.md\n" });
  const lane = startLane(repo);
  writeFile(path.join(lane, ".current", "e9", "handoff.md"), "tracked\n");
  git(lane, ["add", "-f", ".current/e9/handoff.md"]);
  git(lane, ["commit", "-qm", "track lane dir"]);
  writeFile(path.join(lane, PEND_REL), MIXED);
  writeFile(histCopy(repo), "someone else's different bytes\n");

  const res = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /already exists in the primary checkout and differs/);
  assert.ok(fs.existsSync(lane), "worktree not removed");
  assert.equal(fs.readFileSync(histCopy(repo), "utf-8"), "someone else's different bytes\n", "existing file untouched");
});

test("AC-E287-4: no pending file anywhere -> finish prints no findings line", () => {
  const repo = makeRepo({ exclude: "/.current/\n" });
  const lane = startLane(repo);
  commitLaneFile(lane);
  merge(repo);
  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stderr);
  assert.doesNotMatch(res.stderr, /pending-tickets|not allocated|target_repo/);
});

test("AC-E287: an all-malformed worktree-only file still warns (counted), never refuses or numbers", () => {
  const repo = makeRepo({ exclude: "/.current/\n" });
  const lane = startLane(repo);
  commitLaneFile(lane);
  writeFile(path.join(lane, PEND_REL), block("L1", "ok") + "```pending-ticket\nnot: [a mapping\n```\n");
  merge(repo);
  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /1 unapplied finding\(s\) were not allocated/);
  assert.match(res.stderr, /\+ 1 malformed pending-ticket block\(s\)/);
  assert.deepEqual(allocateCommits(repo), []);
});

// ---- Review round-2 regression pins (R1): re-run behaviour ----

test("R1-s8: committed local pending file, forced late failure, re-run -> exit 0 and NO O6 warning on either run", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  commitPending(lane, block("L1", "loc"));
  merge(repo);
  writeFile(path.join(lane, "blocker.txt"), "x\n"); // untracked, not ignored: worktree remove refuses

  const first = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(first.status, 0, "forced late failure");
  assert.doesNotMatch(first.stderr, /were not allocated/);
  fs.rmSync(path.join(lane, "blocker.txt"));

  const rerun = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.doesNotMatch(rerun.stderr, /were not allocated|not committed on/, "committed file is not an O6 file on re-run");
  assert.ok(!fs.existsSync(lane));
  assert.equal(allocateCommits(repo).length, 1, "allocated exactly once");
});

test("R1-s5: committed target_repo-only file, no docs/backlog.md, forced late failure, re-run -> exit 0, no warning, no allocation", () => {
  const repo = makeRepo({ backlog: false });
  const lane = startLane(repo);
  commitPending(lane, block("X1", "ext", "target_repo: sister\n"));
  merge(repo);
  writeFile(path.join(lane, "blocker.txt"), "x\n");

  const first = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(first.status, 0);
  assert.match(first.stderr, /X1/, "target_repo entry listed for a human ruling on the first run");
  assert.match(first.stderr, /human ruling/);
  fs.rmSync(path.join(lane, "blocker.txt"));

  const rerun = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.doesNotMatch(rerun.stderr, /were not allocated|not committed on/);
  assert.ok(!fs.existsSync(path.join(repo, "docs", "backlog.md")), "an absent backlog is never created");
  assert.deepEqual(allocateCommits(repo), []);
});

test("R1-s11: never-committed counterpart warns on both runs, re-run exits 0, history copy byte-identical", () => {
  const repo = makeRepo({ exclude: "/.current/\n" });
  const lane = startLane(repo);
  const text = block("N1", "local one");
  commitLaneFile(lane);
  writeFile(path.join(lane, PEND_REL), text);
  merge(repo);
  writeFile(path.join(lane, "blocker.txt"), "x\n");

  const first = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(first.status, 0);
  assert.match(first.stderr, /1 unapplied finding\(s\) were not allocated/);
  fs.rmSync(path.join(lane, "blocker.txt"));

  const rerun = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.match(rerun.stderr, /1 unapplied finding\(s\) were not allocated/, "warns again: the copy is re-verified");
  assert.equal(fs.readFileSync(histCopy(repo), "utf-8"), text);
  assert.ok(!fs.existsSync(lane));
});

// ============================================================================
// D4: target_repo findings on the revision path
// ============================================================================

test("AC-E287-6: --shipped, committed file with one local + one target_repo entry -> exactly one new backlog row, external listed, archived", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  commitPending(lane, MIXED);
  merge(repo);
  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stderr);
  const rows = backlogRows(repo);
  assert.equal(rows.length, 2, "E10 + exactly one new row");
  assert.match(rows[1], /^\| E11 /);
  assert.ok(!rows.some((r) => /E12|other repo finding/.test(r)), "the external finding got no id/row");
  assert.match(res.stderr, /e9\/X1 "other repo finding" names target_repo sister-repo/);
  assert.match(res.stderr, /human ruling/);
  const allocSha = git(repo, ["log", "--format=%H", "--grep=^chore(backlog): allocate", "-1", "main"]).trim();
  const archived = git(repo, ["show", `${allocSha}:${PEND_REL}`]);
  assert.match(archived.split("## Applied")[1] ?? "", /lane_local_id: X1/, "external block archived under ## Applied");
});

test("AC-E287-6: --abandoned, same shape -> one new backlog row, external listed, archived on the branch", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  commitPending(lane, MIXED);
  const res = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(res.status, 0, res.stderr);
  const rows = backlogRows(repo);
  assert.equal(rows.length, 2);
  assert.match(rows[1], /^\| E11 /);
  assert.match(res.stderr, /e9\/X1 "other repo finding" names target_repo sister-repo/);
  assert.match(res.stderr, /human ruling/);
  const onBranch = git(repo, ["show", `feat/e9-x:${PEND_REL}`]);
  assert.match(onBranch.split("## Applied")[1] ?? "", /lane_local_id: X1/);
  assert.equal(branchExists(repo), true);
});

test("AC-E287-7: only target_repo entries and no docs/backlog.md at base -> exit 0, no allocate commit, listed (--shipped)", () => {
  const repo = makeRepo({ backlog: false });
  const lane = startLane(repo);
  commitPending(lane, block("X1", "ext one", "target_repo: sister\n") + block("X2", "ext two", "target_repo: sister\n"));
  merge(repo);
  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(allocateCommits(repo), []);
  assert.ok(!fs.existsSync(path.join(repo, "docs", "backlog.md")));
  assert.match(res.stderr, /e9\/X1 "ext one" names target_repo sister/);
  assert.match(res.stderr, /e9\/X2 "ext two" names target_repo sister/);
  assert.ok(!fs.existsSync(lane));
});

test("AC-E287-7: only target_repo entries and no backlog (--abandoned) -> exit 0, no base commit", () => {
  const repo = makeRepo({ backlog: false });
  const lane = startLane(repo);
  commitPending(lane, block("X1", "ext one", "target_repo: sister\n"));
  const before = git(repo, ["rev-parse", "main"]);
  const res = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(git(repo, ["rev-parse", "main"]), before, "no commit on base");
  assert.match(res.stderr, /e9\/X1 "ext one" names target_repo sister/);
});

test("AC-E287-8: forced late failure then re-run never allocates or errors because of a target_repo entry", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  commitPending(lane, MIXED);
  merge(repo);
  writeFile(path.join(lane, "blocker.txt"), "x\n");
  const first = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(first.status, 0);
  assert.equal(backlogRows(repo).length, 2);
  fs.rmSync(path.join(lane, "blocker.txt"));
  const rerun = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(backlogRows(repo).length, 2, "no second allocation");
  assert.equal(allocateCommits(repo).length, 1);
});

test("AC-E287-8: agc check does not report an orphan branch whose only unapplied entries are target_repo; a local one still is", () => {
  const ext = makeRepo();
  const extLane = startLane(ext);
  commitPending(extLane, block("X1", "ext", "target_repo: sister\n"));
  git(ext, ["worktree", "remove", "--force", extLane]);
  const ckExt = agc(ext, ["check"]);
  assert.doesNotMatch(ckExt.stderr + ckExt.stdout, /unapplied pending-tickets file/);

  const loc = makeRepo();
  const locLane = startLane(loc);
  commitPending(locLane, block("L1", "loc"));
  git(loc, ["worktree", "remove", "--force", locLane]);
  const ckLoc = agc(loc, ["check"]);
  assert.match(ckLoc.stderr, /branch feat\/e9-x carries an unapplied pending-tickets file/);
});

test("AC-E287-5 (end to end): a malformed target_repo on the revision path refuses, nothing applied", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  commitPending(lane, block("L1", "loc") + block("X1", "ext", "target_repo:\n"));
  merge(repo);
  const before = git(repo, ["rev-parse", "main"]);
  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /target_repo must be a non-empty string/);
  assert.equal(git(repo, ["rev-parse", "main"]), before, "nothing applied");
  assert.ok(fs.existsSync(lane), "nothing removed");
});

test("AC-E287-10: usage text states unnumbered-warning and target_repo behaviour", () => {
  const res = feature(makeRepo(), []);
  const out = res.stdout + res.stderr;
  assert.match(out, /pending-tickets\.md that exists only in the\s+worktree is not\s+numbered/);
  assert.match(out, /target_repo: <repo> belongs to another repo/);
  assert.match(out, /human\s+ruling/);
});

// ============================================================================
// tools/lane-ticket-allocation.ts units (AC-E287-5, Q4, Q5)
// ============================================================================

test("AC-E287-5: parsePendingTickets accepts a non-empty target_repo (trimmed) and leaves local entries without the property", () => {
  const { entries, errors } = parsePendingTickets(block("A", "a", "target_repo: '  sister  '\n") + block("B", "b"), "e9");
  assert.deepEqual(errors, []);
  assert.equal(entries.find((e) => e.laneLocalId === "A").targetRepo, "sister");
  assert.ok(!("targetRepo" in entries.find((e) => e.laneLocalId === "B")), "absent key -> absent property");
});

for (const [label, line] of [
  ["bare (null)", "target_repo:\n"],
  ["empty string", 'target_repo: ""\n'],
  ["whitespace only", "target_repo: '   '\n"],
  ["number", "target_repo: 7\n"],
  ["list", "target_repo: [a]\n"],
  ["boolean", "target_repo: true\n"],
]) {
  test(`AC-E287-5: target_repo ${label} is a malformed block (reported, not parsed)`, () => {
    const { entries, errors } = parsePendingTickets(block("A", "a", line), "e9");
    assert.equal(entries.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /target_repo must be a non-empty string/);
  });
}

test("Q4: an archived target_repo block is exempt from the provenance check; an archived local one is not", () => {
  const text = "## Applied\n\n" + block("X1", "ext", "target_repo: sister\n") + block("L1", "loc");
  const { errors } = parsePendingTickets(text, "e9", { appliedLaneLocalIds: new Set() });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /L1/);
  assert.doesNotMatch(errors[0], /X1/);
});

test("AC-E287-6: allocateTicketIds never numbers a target_repo entry and does not advance the max id", () => {
  const { entries } = parsePendingTickets(block("X1", "ext", "target_repo: sister\n") + block("L1", "loc") + block("L2", "loc2"), "e9");
  const r = allocateTicketIds({ currentMaxId: 10, batches: [{ lane: "e9", entries }] });
  assert.deepEqual(r.allocated.map((a) => a.id), ["E11", "E12"]);
  assert.equal(r.maxAllocatedId, 12);
  assert.ok(!r.allocated.some((a) => a.laneLocalId === "X1"));
});

test("Q5: a local entry depending on a target_repo entry is unresolved with a reason naming target_repo", () => {
  const { entries } = parsePendingTickets(block("X1", "ext", "target_repo: sister\n") + block("L1", "loc", "", "[X1]"), "e9");
  const r = allocateTicketIds({ currentMaxId: 0, batches: [{ lane: "e9", entries }] });
  assert.equal(r.unresolvedDependencies.length, 1);
  assert.match(r.unresolvedDependencies[0].reason, /depends on a target_repo finding \(target_repo: sister\)/);
});

test("Q5: a reference to a lane_local_id that exists nowhere keeps the original reason", () => {
  const { entries } = parsePendingTickets(block("L1", "loc", "", "[NOPE]"), "e9");
  const r = allocateTicketIds({ currentMaxId: 0, batches: [{ lane: "e9", entries }] });
  assert.match(r.unresolvedDependencies[0].reason, /no entry with that lane_local_id/);
});

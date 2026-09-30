// Coded by @qa-engineer
// Tests for specs/e125b-lane-close-writeback.md AC1/AC2/AC3/AC9/AC10/AC11/
// AC12 — the `agc feature finish --shipped` lane-close writeback in
// bin/agc-init.mjs (planLaneClose/executeLaneClose/executeHarvestRefresh/
// closedLanePointerLine/applyClosedLanePointer), plus the base-sha write at
// `agc feature start` (AC11).
//
// Every scratch repo is a real git repository built under os.tmpdir(), per
// the test/agc-feature-lifecycle.test.mjs precedent this file reuses
// fixture helpers from (duplicated locally — this repo's test files each own
// their fixture helpers rather than importing across test files).
//
// Spec-to-Test map:
//   AC1  (tracked-shape close: git mv into .current/history/<YYYY-MM>/<ticket>/,
//         committed on --base)                          -> AC1
//   AC2  (exactly one Closed Lanes pointer line, HTML comment, never a
//         checkbox row)                                  -> AC2
//   AC3  (a pre-existing "tasks moved" marker left for the lane by the earlier
//         lane-local-ledger step (e125a) is replaced by the one Closed Lanes pointer)       -> AC3
//   AC9  (gitignored-shape harvest: fs-copy before worktree removal, never
//         committed, advisory line; re-run re-harvest (R1); partial-failure
//         rollback (R2); zero-write lane no-op)            -> AC9-HARVEST,
//                                                              AC9-R1, AC9-R2,
//                                                              AC9-ZEROWRITE
//   AC10 (root tasks.md as the LIVE ledger (the shape where the repo-root task
//         file is itself the ledger): the Closed Lanes
//         pointer line parses as zero tasks)               -> AC10
//   AC11 (base_sha = the fork point agc feature start resolved, NOT the
//         branch tip nor merge-base at finish time when base advanced;
//         base_sha=unknown for a lane with no base-sha file)  -> AC11-FORKPOINT,
//                                                                 AC11-UNKNOWN
//   AC12 (--pr <n> -> pr=<n>; no --pr -> pr=none; --pr validates /^\d+$/)
//                                                          -> AC12

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

// ---------------------------------------------------------------------------
// Cleanup registry (test/agc-feature-lifecycle.test.mjs precedent).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// git / agc helpers (test/agc-feature-lifecycle.test.mjs precedent).
// ---------------------------------------------------------------------------
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}
function gitTry(cwd, args) {
  try {
    return { status: 0, stdout: git(cwd, args), stderr: "" };
  } catch (err) {
    return {
      status: typeof err.status === "number" ? err.status : 1,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? ""),
    };
  }
}
function branchExists(repoRoot, branch) {
  return gitTry(repoRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
}

function makePrimaryRepo(opts = {}) {
  const repo = mkTmp("e125b-finish-primary-");
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  if (opts.gitignore !== undefined) {
    fs.writeFileSync(path.join(repo, ".gitignore"), opts.gitignore);
  }
  fs.writeFileSync(path.join(repo, "README.md"), "# scratch fixture\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "init"]);
  return repo;
}

function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
}

function mergeLane(repo, branch) {
  git(repo, ["merge", "--no-ff", "-m", `merge ${branch}`, branch]);
}

function readTasksMd(repo) {
  return fs.readFileSync(path.join(repo, "tasks.md"), "utf-8");
}
// Tolerant read for a point in a fixture where tasks.md may not exist yet
// (before any finish has run) or may have been rolled back to absent (a
// failed-and-rolled-back close on a repo that never had one to begin with).
function readTasksMdSafe(repo) {
  try {
    return readTasksMd(repo);
  } catch (err) {
    if (err && err.code === "ENOENT") return "";
    throw err;
  }
}

// Extracts one lane's `lane_closed:` pointer line's fields (Copy / Strings
// e125b.closed-lane-pointer-line). Returns null if no such line exists.
function extractPointer(tasksText, ticketId) {
  const re = new RegExp(
    `<!-- lane_closed: ticket=${ticketId} branch=(\\S+) base_sha=(\\S+) pr=(\\S+) history=(\\S+) closed_at=(\\S+) \\(.*?\\) -->`,
  );
  const m = re.exec(tasksText);
  if (!m) return null;
  return { branch: m[1], baseSha: m[2], pr: m[3], history: m[4], closedAt: m[5] };
}

// Writes and commits a real file under a live lane's .current/<lane>/ dir
// directly in the LANE worktree (tracked-shape fixture builder).
function writeAndCommitLaneFile(lanePath, lane, filename, content, message = "add lane state") {
  const dir = path.join(lanePath, ".current", lane);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content);
  git(lanePath, ["add", `.current/${lane}/${filename}`]);
  git(lanePath, ["commit", "-m", message]);
}

// ============================================================================
// AC1 — tracked-shape close: .current/<ticket>/ git-mv'd into
// .current/history/<YYYY-MM>/<ticket>/, committed on --base (adjacent to
// finish's other commits).
// ============================================================================

test("AC1: finish --shipped moves a TRACKED .current/<ticket>/ into .current/history/<YYYY-MM>/<ticket>/, holding the same files, committed on --base", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac1-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b1-tracked-close", "--path", lane]).status, 0);
  writeAndCommitLaneFile(lane, "e125b1", "handoff.md", "---\nactive_feature: e125b1\n---\n");
  mergeLane(repo, "feat/e125b1-tracked-close");

  const r = runAgc(repo, ["finish", "e125b1", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.ok(!fs.existsSync(path.join(repo, ".current", "e125b1")), "the old flat .current/e125b1/ path must no longer exist");
  const now = new Date();
  const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const histDir = path.join(repo, ".current", "history", bucket, "e125b1");
  assert.ok(fs.existsSync(path.join(histDir, "handoff.md")), "the same file must exist at .current/history/<YYYY-MM>/e125b1/handoff.md");
  assert.equal(
    fs.readFileSync(path.join(histDir, "handoff.md"), "utf-8"),
    "---\nactive_feature: e125b1\n---\n",
    "the moved file's content must be byte-identical",
  );

  // Tracked by git (not merely present on disk) — a real `git mv`, not a copy.
  assert.equal(gitTry(repo, ["ls-files", "--error-unmatch", "--", `.current/history/${bucket}/e125b1/handoff.md`]).status, 0);
  assert.equal(gitTry(repo, ["ls-files", "--error-unmatch", "--", ".current/e125b1/handoff.md"]).status, 1, "the old path must no longer be tracked either");
});

// ============================================================================
// AC2 — exactly one Closed Lanes pointer line, an HTML comment, never a
// markdown checkbox row.
// ============================================================================

test("AC2: root tasks.md gains exactly one lane_closed pointer line under a new ## Closed Lanes section, and it is never a checkbox row", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac2-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b2-pointer-shape", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b2-pointer-shape");

  const r = runAgc(repo, ["finish", "e125b2", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const text = readTasksMd(repo);
  assert.match(text, /## Closed Lanes/);
  const matches = text.match(/^<!-- lane_closed: ticket=e125b2 /gm) ?? [];
  assert.equal(matches.length, 1, "exactly one lane_closed line for this ticket must exist");

  const pointerLine = text.split("\n").find((l) => l.includes("lane_closed: ticket=e125b2"));
  assert.ok(pointerLine, "the pointer line must exist");
  assert.ok(!/^- \[ \]|^- \[x\]/.test(pointerLine.trim()), "the pointer line must never be a markdown checkbox row (X3)");
  assert.match(pointerLine, /^<!--.*-->$/, "the pointer line must be a single HTML comment");

  const pointer = extractPointer(text, "e125b2");
  assert.ok(pointer, "extractPointer must parse the pointer line's fields");
  assert.equal(pointer.branch, "feat/e125b2-pointer-shape");
  assert.match(pointer.history, /^\.current\/history\/\d{4}-\d{2}\/e125b2\/$/);
});

test("AC2: a re-run of finish --shipped after the lane already closed never appends a second pointer line (idempotent)", () => {
  // This exercises planLaneClose's alreadyClosed branch on a lane with
  // nothing git-ignored under .current/<ticket>/ (a tracked-only lane), so
  // the re-run is a true no-op re-run (git worktree remove already
  // succeeded and deleted the worktree on the first run — re-invoking
  // `finish` on the SAME ticket a second time must find no linked worktree
  // at all and refuse with THAT error, never a duplicate pointer). This
  // proves the guard that actually prevents double-application: no worktree
  // means no second run can reach planLaneClose's mutation path at all.
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac2-idem-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b2b-idempotent", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b2b-idempotent");
  assert.equal(runAgc(repo, ["finish", "e125b2b", "--shipped"]).status, 0);

  const secondRun = runAgc(repo, ["finish", "e125b2b", "--shipped"]);
  assert.notEqual(secondRun.status, 0, "a second finish on an already-finished (worktree-gone) ticket must refuse");
  assert.match(secondRun.stderr, /no linked worktree found for lane e125b2b/);

  const text = readTasksMd(repo);
  const matches = text.match(/^<!-- lane_closed: ticket=e125b2b /gm) ?? [];
  assert.equal(matches.length, 1, "still exactly one pointer line after the refused second run");
});

// ============================================================================
// AC3 — a pre-existing "tasks moved" marker (left by the earlier lane-local-ledger
// step, e125a) for the lane is removed;
// the Closed Lanes pointer is the ONE authoritative row left.
// ============================================================================

test("AC3: a pre-existing e125a tasks_moved feat marker for the closing lane is replaced by the new Closed Lanes pointer — no dangling marker left", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac3-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b3-feat-marker", "--path", lane]).status, 0);

  // Simulate a feat marker from the earlier lane-ledger forward migration (e125a) already sitting in root
  // tasks.md for this lane (tools/tasks-lane-migrate.ts's featMarker shape).
  const markerLine = "<!-- tasks_moved: lane=e125b3 run=1 of=1 sections=1 -> .current/e125b3/tasks.md (E125a) -->";
  fs.writeFileSync(path.join(repo, "tasks.md"), `# Tasks\n\n${markerLine}\n`);
  git(repo, ["add", "tasks.md"]);
  git(repo, ["commit", "-m", "seed a pre-existing e125a feat marker"]);

  mergeLane(repo, "feat/e125b3-feat-marker");
  const r = runAgc(repo, ["finish", "e125b3", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const text = readTasksMd(repo);
  assert.ok(!text.includes(markerLine), "the stale e125a feat marker for this lane must be removed");
  assert.doesNotMatch(text, /tasks_moved: lane=e125b3/, "no tasks_moved marker for this lane may remain at all");
  const matches = text.match(/^<!-- lane_closed: ticket=e125b3 /gm) ?? [];
  assert.equal(matches.length, 1, "exactly one authoritative Closed Lanes pointer must be left for this lane");
});

test("AC3: a feat marker belonging to a DIFFERENT lane is left untouched when this lane closes", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac3b-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b3b-other-marker", "--path", lane]).status, 0);

  const otherMarkerLine = "<!-- tasks_moved: lane=e999 run=1 of=1 sections=1 -> .current/e999/tasks.md (E125a) -->";
  fs.writeFileSync(path.join(repo, "tasks.md"), `# Tasks\n\n${otherMarkerLine}\n`);
  git(repo, ["add", "tasks.md"]);
  git(repo, ["commit", "-m", "seed another lane's feat marker"]);

  mergeLane(repo, "feat/e125b3b-other-marker");
  assert.equal(runAgc(repo, ["finish", "e125b3b", "--shipped"]).status, 0);

  const text = readTasksMd(repo);
  assert.ok(text.includes(otherMarkerLine), "a different lane's feat marker must never be touched by this lane's close");
});

// ============================================================================
// AC9 — gitignored .current/: fs-copy harvest before worktree removal, never
// committed; the re-harvest note (R1) and the partial-failure rollback note (R2)
// are part of the contract (dispatch brief).
// ============================================================================

test("AC9-HARVEST: an UNTRACKED (gitignored) .current/<ticket>/ is fs-copy harvested into .current/history/<bucket>/<ticket>/ before the worktree is removed, and the copy is never committed", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  const lane = path.join(mkTmp("e125b-ac9-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b9-harvest", "--path", lane]).status, 0);

  // Real, untracked (ignored) lane state — never committed anywhere.
  fs.mkdirSync(path.join(lane, ".current", "e125b9"), { recursive: true });
  fs.writeFileSync(path.join(lane, ".current", "e125b9", "handoff.md"), "untracked handoff content\n");

  const r = runAgc(repo, ["finish", "e125b9", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /harvested untracked \.current\/e125b9\/ into \.current\/history\//, "the harvest advisory line must be printed");
  assert.match(r.stdout, /fs copy, not committed/);
  assert.match(r.stdout, /the source path is git-ignored in this workspace/);

  const now = new Date();
  const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const histFile = path.join(repo, ".current", "history", bucket, "e125b9", "handoff.md");
  assert.ok(fs.existsSync(histFile), "the harvested file must exist under .current/history/<bucket>/e125b9/");
  assert.equal(fs.readFileSync(histFile, "utf-8"), "untracked handoff content\n");

  assert.equal(
    gitTry(repo, ["ls-files", "--error-unmatch", "--", `.current/history/${bucket}/e125b9/handoff.md`]).status,
    1,
    "the harvested copy must NOT be committed — .current/ is gitignored in this workspace",
  );
  // The Closed Lanes pointer line, by contrast, IS committed (it lives in
  // tasks.md, independent of whether the evidence itself is tracked).
  assert.equal(gitTry(repo, ["ls-files", "--error-unmatch", "--", "tasks.md"]).status, 0);
  const pointer = extractPointer(readTasksMd(repo), "e125b9");
  assert.ok(pointer, "the Closed Lanes pointer must still be committed even though the harvest itself is untracked");
});

test("AC9-ZEROWRITE: a lane whose .current/<ticket>/ directory does not exist at all (genuinely zero governance writes, spec AC9's own final sentence) harvests nothing and errors on nothing", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  const lane = path.join(mkTmp("e125b-ac9-zw-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b9z-zero-write", "--path", lane]).status, 0);
  // `agc feature start` itself already wrote .current/e125b9z/base-sha (AC11,
  // T-E125B-07) — remove the WHOLE directory so this fixture hits the genuine
  // "does not exist either" branch described at the end of AC9, not the
  // "only base-sha" harvest-of-one-file branch.
  fs.rmSync(path.join(lane, ".current", "e125b9z"), { recursive: true, force: true });

  const r = runAgc(repo, ["finish", "e125b9z", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvested untracked/, "nothing to copy is not an error and prints no harvest advisory");
  const pointer = extractPointer(readTasksMd(repo), "e125b9z");
  assert.ok(pointer, "the Closed Lanes pointer must still be written even for a zero-write lane");
  assert.equal(pointer.baseSha, "unknown", "with no base-sha file at all, the pointer's base_sha must fall back to unknown");
});

test("AC9-ZEROWRITE (base-sha only): a lane whose .current/<ticket>/ holds ONLY the base-sha file agc feature start wrote harvests that one file, and its byte content is unchanged", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  const lane = path.join(mkTmp("e125b-ac9-zw2-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b9z2-only-base-sha", "--path", lane]).status, 0);
  const baseShaBytes = fs.readFileSync(path.join(lane, ".current", "e125b9z2", "base-sha"));

  const r = runAgc(repo, ["finish", "e125b9z2", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /harvested untracked \.current\/e125b9z2\//, "a directory holding only base-sha is still a real, present .current/<ticket>/ dir and IS harvested");

  const now = new Date();
  const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const histFiles = fs.readdirSync(path.join(repo, ".current", "history", bucket, "e125b9z2"));
  assert.deepEqual(histFiles, ["base-sha"], "the history copy must hold exactly the one file that was there");
  assert.ok(fs.readFileSync(path.join(repo, ".current", "history", bucket, "e125b9z2", "base-sha")).equals(baseShaBytes));
});

test("AC9-R1 (re-run note): a re-run after a refused worktree removal re-harvests git-ignored lane state that changed since the first run's harvest, before removing the worktree", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  const lane = path.join(mkTmp("e125b-ac9-r1-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b9r1-rerun", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, ".current", "e125b9r1"), { recursive: true });
  fs.writeFileSync(path.join(lane, ".current", "e125b9r1", "handoff.md"), "v1\n");
  // A stray, NON-ignored untracked file at the lane root forces `git worktree
  // remove` (never --force) to refuse — the exact shape the review's R1 repro
  // uses.
  fs.writeFileSync(path.join(lane, "stray.txt"), "uncommitted stray file\n");

  const first = runAgc(repo, ["finish", "e125b9r1", "--shipped"]);
  assert.notEqual(first.status, 0, "the worktree removal must be refused by git itself while the stray file is present");
  assert.match(first.stderr, /worktree remove refused/);
  assert.ok(fs.existsSync(lane), "the lane worktree must be left in place after a refused removal");
  const pointerAfterFirst = extractPointer(readTasksMd(repo), "e125b9r1");
  assert.ok(pointerAfterFirst, "the close writeback (harvest + pointer) must already have happened on the first run, before the refused removal");

  // Operator resolves the blocker and makes further governance writes.
  fs.rmSync(path.join(lane, "stray.txt"));
  fs.writeFileSync(path.join(lane, ".current", "e125b9r1", "handoff.md"), "v2-later-write\n");
  fs.writeFileSync(path.join(lane, ".current", "e125b9r1", "dispatch.jsonl"), '{"ts":"t1"}\n');

  const second = runAgc(repo, ["finish", "e125b9r1", "--shipped"]);
  assert.equal(second.status, 0, `stderr=${second.stderr}`);
  assert.match(second.stdout, /already closed, but \d+ git-ignored/, "the e125b.harvest-refresh-line advisory must be printed");
  assert.match(second.stdout, /handoff\.md/);
  assert.match(second.stdout, /dispatch\.jsonl/);
  assert.ok(!fs.existsSync(lane), "the worktree must be removed on the second, successful run");

  const histRel = pointerAfterFirst.history;
  const handoff = fs.readFileSync(path.join(repo, histRel, "handoff.md"), "utf-8");
  assert.equal(handoff, "v2-later-write\n", "the history copy must hold the NEWER content, not the first run's v1 snapshot — no silent loss");
  assert.ok(fs.existsSync(path.join(repo, histRel, "dispatch.jsonl")), "a file that didn't exist at the first harvest must also be re-harvested");

  // Still exactly one pointer line — the re-run never re-applies the close.
  const matches = readTasksMd(repo).match(/^<!-- lane_closed: ticket=e125b9r1 /gm) ?? [];
  assert.equal(matches.length, 1);
});

test("AC9-R2 (partial-failure rollback): a harvest that fails part-way leaves NO .current/history/ directory behind — the 'safe to re-run' message holds", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  const lane = path.join(mkTmp("e125b-ac9-r2-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b9r2-rollback", "--path", lane]).status, 0);
  const laneCurrentDir = path.join(lane, ".current", "e125b9r2");
  fs.mkdirSync(laneCurrentDir, { recursive: true });
  fs.writeFileSync(path.join(laneCurrentDir, "handoff.md"), "readable\n");
  const unreadable = path.join(laneCurrentDir, "unreadable.jsonl");
  fs.writeFileSync(unreadable, "cannot read this\n");
  fs.chmodSync(unreadable, 0o000);

  const now = new Date();
  const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const histDir = path.join(repo, ".current", "history", bucket, "e125b9r2");

  try {
    const first = runAgc(repo, ["finish", "e125b9r2", "--shipped"]);
    assert.notEqual(first.status, 0, "an EACCES mid-copy must fail the run");
    assert.match(first.stderr, /lane close for e125b9r2 failed|EACCES|permission denied/i);
    assert.match(first.stderr, /re-running finish is safe/i);
    assert.ok(!fs.existsSync(histDir), "no .current/history/<bucket>/e125b9r2/ may be left behind after a rolled-back partial harvest");
    assert.ok(fs.existsSync(lane), "the worktree must be left in place after a rolled-back close");
    assert.ok(!extractPointer(readTasksMdSafe(repo), "e125b9r2"), "no pointer line may be committed when the harvest itself was rolled back");
  } finally {
    // Restore permissions unconditionally so mkTmp's cleanup can remove the tree.
    try {
      fs.chmodSync(unreadable, 0o644);
    } catch {
      /* best effort */
    }
  }

  // After the fix, re-running finish is genuinely safe (the message's claim).
  const second = runAgc(repo, ["finish", "e125b9r2", "--shipped"]);
  assert.equal(second.status, 0, `stderr=${second.stderr}`);
  assert.ok(fs.existsSync(path.join(histDir, "handoff.md")), "the retried run must harvest successfully once the blocker is fixed");
  assert.ok(!fs.existsSync(lane), "the worktree must be removed on the successful retry");
});

// ============================================================================
// AC10 — root tasks.md as the LIVE ledger (the shape where the repo-root task
// file is itself the ledger; .gitignore covers .current/): the Closed Lanes pointer contributes exactly zero tasks to
// every tw_* reader.
// ============================================================================

test("AC10: in a workspace whose .gitignore covers .current/ (root tasks.md is the live ledger), the Closed Lanes pointer line parses as zero tasks", async () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  // A real task row already on root tasks.md — the shape where root IS
  // the ledger tw_* itself reads/writes, never an index.
  fs.writeFileSync(path.join(repo, "tasks.md"), "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n- [ ] T01 an ordinary live task\n");
  git(repo, ["add", "tasks.md"]);
  git(repo, ["commit", "-m", "seed a live root ledger (AC4b shape)"]);

  const lane = path.join(mkTmp("e125b-ac10-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b10-ac4b-shape", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b10-ac4b-shape");
  assert.equal(runAgc(repo, ["finish", "e125b10", "--shipped"]).status, 0);

  const text = readTasksMd(repo);
  assert.match(text, /## Closed Lanes/);
  assert.match(text, /lane_closed: ticket=e125b10/);

  const { parseTasksFromFile } = await import("../dist/tools/tasks-file.js");
  const rows = parseTasksFromFile(repo);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["T01"],
    "the ## Closed Lanes section and its lane_closed comment line must contribute exactly zero parsed tasks",
  );
});

// ============================================================================
// AC11 — base_sha: the fork point `agc feature start` resolved, not the
// branch tip nor a later merge-base; "unknown" when no base-sha file exists.
// ============================================================================

test("AC11-FORKPOINT: base_sha in the pointer line is the fork point agc feature start resolved, NOT the branch tip, when --base advanced with new commits after start", () => {
  const repo = makePrimaryRepo();
  const forkPoint = git(repo, ["rev-parse", "main"]).trim();

  const lane = path.join(mkTmp("e125b-ac11-fp-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b11a-fork-point", "--path", lane]).status, 0);

  // Advance main with a new commit AFTER the lane forked — merge-base(branch,
  // main) at finish time will differ from the fork point once merged.
  fs.writeFileSync(path.join(repo, "ADVANCE.md"), "base moved on\n");
  git(repo, ["add", "ADVANCE.md"]);
  git(repo, ["commit", "-m", "advance main after the lane forked"]);
  const tip = git(repo, ["rev-parse", "main"]).trim();
  assert.notEqual(forkPoint, tip, "the fixture must actually advance main past the fork point");

  mergeLane(repo, "feat/e125b11a-fork-point");
  assert.equal(runAgc(repo, ["finish", "e125b11a", "--shipped"]).status, 0);

  const pointer = extractPointer(readTasksMd(repo), "e125b11a");
  assert.ok(pointer);
  assert.equal(pointer.baseSha, forkPoint, "base_sha must equal the commit `agc feature start` resolved at creation time");
  assert.notEqual(pointer.baseSha, tip, "base_sha must NOT equal the branch tip / current main HEAD");
});

test("AC11-UNKNOWN: a lane with no base-sha file (simulating a lane started before this ticket shipped) records base_sha=unknown, never omitted", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac11-unk-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b11b-no-base-sha", "--path", lane]).status, 0);
  // Simulate a lane created before base-sha was recorded (E125b): delete the
  // base-sha file this start just wrote.
  fs.rmSync(path.join(lane, ".current", "e125b11b", "base-sha"), { force: true });

  mergeLane(repo, "feat/e125b11b-no-base-sha");
  assert.equal(runAgc(repo, ["finish", "e125b11b", "--shipped"]).status, 0);

  const pointer = extractPointer(readTasksMd(repo), "e125b11b");
  assert.ok(pointer);
  assert.equal(pointer.baseSha, "unknown", "base_sha must fall back to the literal token \"unknown\", never be omitted from the line");
});

test("AC11-UNKNOWN: a MALFORMED base-sha file (not a bare 40/64-hex object id) also falls back to base_sha=unknown, never leaks arbitrary file content into the pointer line", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac11-malformed-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b11c-malformed", "--path", lane]).status, 0);
  fs.writeFileSync(path.join(lane, ".current", "e125b11c", "base-sha"), "not-a-sha-at-all --> injected\n");

  mergeLane(repo, "feat/e125b11c-malformed");
  assert.equal(runAgc(repo, ["finish", "e125b11c", "--shipped"]).status, 0);

  const pointer = extractPointer(readTasksMd(repo), "e125b11c");
  assert.ok(pointer);
  assert.equal(pointer.baseSha, "unknown");
});

// ============================================================================
// AC12 — --pr <n>: the pointer line's pr= field; default "none" when
// omitted; the server never queries a PR host.
// ============================================================================

test("AC12: --pr 42 records pr=42 in the pointer line", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac12a-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b12a-pr-given", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b12a-pr-given");
  assert.equal(runAgc(repo, ["finish", "e125b12a", "--shipped", "--pr", "42"]).status, 0);

  const pointer = extractPointer(readTasksMd(repo), "e125b12a");
  assert.ok(pointer);
  assert.equal(pointer.pr, "42");
});

test("AC12: no --pr defaults to pr=none in the pointer line", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac12b-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b12b-pr-omitted", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b12b-pr-omitted");
  assert.equal(runAgc(repo, ["finish", "e125b12b", "--shipped"]).status, 0);

  const pointer = extractPointer(readTasksMd(repo), "e125b12b");
  assert.ok(pointer);
  assert.equal(pointer.pr, "none");
});

test("AC12: --pr rejects a non-numeric value with a usage error, before any mutation", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac12c-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b12c-pr-invalid", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b12c-pr-invalid");

  const before = readTasksMdSafe(repo);
  const r = runAgc(repo, ["finish", "e125b12c", "--shipped", "--pr", "4 -->"]);
  assert.notEqual(r.status, 0, "a non-numeric --pr must be rejected");
  assert.match(r.stderr, /invalid --pr/);
  assert.equal(readTasksMdSafe(repo), before, "a rejected --pr must mutate nothing");
  assert.ok(branchExists(repo, "feat/e125b12c-pr-invalid"), "the branch must survive a usage-error refusal");
});

test("AC12: --pr with --abandoned is rejected (the flag applies only to --shipped)", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-ac12d-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125b12d-pr-abandoned", "--path", lane]).status, 0);

  const r = runAgc(repo, ["finish", "e125b12d", "--abandoned", "--pr", "7"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--pr applies only to --shipped/);
});

// ============================================================================
// Security smoke — a branch name that would break the single-line HTML
// comment shape is refused outright, nothing applied, nothing removed (AC2's
// injection guard, from a code-review finding on pointer-line injection).
// ============================================================================

test("boundary: a branch name containing \"-->\" is refused before any mutation (would otherwise break the tasks.md comment line)", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e125b-boundary-lane-"), "lane");
  // git branch names cannot contain spaces or most shell metacharacters, but
  // CAN contain "-->" verbatim (no '..', no control chars, no leading '-' —
  // all satisfied here).
  assert.equal(runAgc(repo, ["start", "e125b13a-->-injection", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e125b13a-->-injection");

  const before = readTasksMdSafe(repo);
  const r = runAgc(repo, ["finish", "e125b13a", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /contains "-->"/);
  assert.equal(readTasksMdSafe(repo), before, "nothing may be applied when the branch name is refused");
  assert.ok(fs.existsSync(lane), "nothing may be removed when the branch name is refused");
});

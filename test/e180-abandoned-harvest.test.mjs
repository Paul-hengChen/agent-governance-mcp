// Coded by @qa-engineer
// Tests for specs/e180-abandoned-harvest.md AC1-AC13 — `agc feature finish
// <ticket> --abandoned` harvesting git-ignored evidence (E180) and untracked
// `.current/<ticket>/` (E194) into the primary checkout before the worktree
// is removed, plus one E197 string assertion (AC13).
//
// Fixture conventions follow test/agc-feature-lifecycle.test.mjs and
// test/agc-feature-finish-history.test.mjs (this repo's own precedent: every
// test file owns its fixture helpers rather than importing across files).
// Every scratch repo/lane is a real git repository built under os.tmpdir()
// via fs.mkdtempSync and torn down in the top-level `after` hook.
//
// A load-bearing empirical fact this file relies on throughout (verified
// directly against the system git before writing these tests): `git worktree
// remove` (never --force) refuses over MODIFIED or UNTRACKED-AND-NOT-IGNORED
// content, but does NOT refuse over untracked content that IS git-ignored.
// That is exactly why AC1-AC4/AC6-AC12's fixtures (whose "at risk" files are
// by definition git-ignored — that is what makes them at risk in the first
// place) can reach a full, clean `finish --abandoned` (worktree removed, exit
// 0), while AC5's plain-untracked (never-ignored) file reproduces today's
// pre-existing refusal unchanged (same shape as the existing AC22/AC24 test
// in test/agc-feature-lifecycle.test.mjs).
//
// `agc feature start` itself already excludes `.current/**/base-sha` via the
// shared `info/exclude` (LANE_EXCLUDE_RULES, bin/agc-init.mjs) regardless of
// any project `.gitignore` — so a lane's `.current/<ticket>/base-sha` alone
// is already git-ignored with zero project-level setup. Tests that need more
// than base-sha to survive worktree removal add a project `.gitignore`
// covering the relevant directories.
//
// Spec-to-test map:
//   AC1  -> "AC1: an untracked, git-ignored evidence file is harvested into primary before the move"
//   AC2  -> "AC2: an evidence dir symlinked outside the worktree gets no primary copy"
//   AC3  -> "AC3: a differing primary destination refuses before any mutation"
//   AC4  -> "AC4: an identical primary destination does not refuse"
//   AC5  -> "AC5: a plain untracked (non-ignored) evidence file is unaffected — pre-existing behavior"
//   AC6  -> "AC6: the evidence harvest is idempotent across a later-step failure and re-run"
//   AC7  -> "AC7: an all-untracked .current/<ticket>/ is harvested in full, no exclusions"
//   AC8  -> "AC8: a tracked .current/<ticket>/ gets no harvest copy"
//   AC9  -> "AC9: a non-directory blocking the history path refuses before any mutation"
//   AC10 -> "AC10: a pre-existing history directory is refreshed by copy-over, never delete"
//   AC11 -> "AC11: a lane with no .current/<ticket>/ at all harvests nothing and errors on nothing"
//   AC12 -> "AC12: the adopter-shaped workspace — both harvests fire end-to-end"
//   AC13 -> "AC13: closedLanePointerLine's fallback clause reads case-insensitive git log -i --grep"

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
  const repo = mkTmp("e180-abandoned-harvest-primary-");
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  if (opts.gitignore !== undefined) {
    fs.writeFileSync(path.join(repo, ".gitignore"), opts.gitignore);
  }
  if (opts.extraFiles) {
    for (const [rel, content] of Object.entries(opts.extraFiles)) {
      const abs = path.join(repo, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
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

// `.current/history/<bucket>/` bucket format (lanePaths.resolveHistoryBucket
// precedent, mirrored in test/agc-feature-finish-history.test.mjs).
function historyBucket(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Literal-substring-safe regex builder for exact Copy/Strings assertions.
function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// AC1-AC6 — E180 evidence harvest (planAbandonEvidenceHarvest /
// applyAbandonEvidenceHarvest, bin/agc-init.mjs).
// ============================================================================

test("AC1: an untracked, git-ignored evidence file is harvested into primary before the move", () => {
  const repo = makePrimaryRepo({ gitignore: "qa_reports/\nreview_reports/\n" });
  const lane = path.join(mkTmp("e180d1-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d1-evidence-harvest", "--path", lane]).status, 0);

  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.mkdirSync(path.join(lane, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D1-01.md"), "qa evidence\n");
  fs.writeFileSync(path.join(lane, "review_reports", "review_T-E180D1-02.md"), "review evidence\n");

  const r = runAgc(repo, ["finish", "e180d1", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // Copy / Strings e180.evidence-harvest-line, once per harvested file, in
  // ADDITION to (not instead of) the pre-existing `moved` line.
  assert.match(
    r.stdout,
    /agc feature finish — harvested git-ignored evidence qa_reports\/review_T-E180D1-01\.md -> primary qa_reports\/abandoned\/e180d1\/review_T-E180D1-01\.md \(fs copy, not committed — qa_reports\/ is git-ignored here and not linked outside the worktree, so `git worktree remove` would otherwise delete it silently\)/,
  );
  assert.match(
    r.stdout,
    /harvested git-ignored evidence review_reports\/review_T-E180D1-02\.md -> primary review_reports\/abandoned\/e180d1\//,
  );
  assert.match(r.stdout, /moved qa_reports\/review_T-E180D1-01\.md -> qa_reports\/abandoned\/e180d1\//);
  assert.match(r.stdout, /moved review_reports\/review_T-E180D1-02\.md -> review_reports\/abandoned\/e180d1\//);

  const qaDst = path.join(repo, "qa_reports", "abandoned", "e180d1", "review_T-E180D1-01.md");
  const revDst = path.join(repo, "review_reports", "abandoned", "e180d1", "review_T-E180D1-02.md");
  assert.equal(fs.readFileSync(qaDst, "utf-8"), "qa evidence\n");
  assert.equal(fs.readFileSync(revDst, "utf-8"), "review evidence\n");
  // The primary copy must NOT be committed (fs copy only).
  assert.equal(gitTry(repo, ["ls-files", "--error-unmatch", "--", "qa_reports/abandoned/e180d1/review_T-E180D1-01.md"]).status, 1);
  assert.equal(gitTry(repo, ["ls-files", "--error-unmatch", "--", "review_reports/abandoned/e180d1/review_T-E180D1-02.md"]).status, 1);

  assert.ok(!fs.existsSync(lane), "the worktree must be removed — the only untracked content left behind is git-ignored");
  assert.ok(branchExists(repo, "feat/e180d1-evidence-harvest"), "abandoned lanes keep their branch");
});

test("AC2: an evidence dir symlinked outside the worktree gets no primary copy", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e180d2-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d2-symlinked-outside", "--path", lane]).status, 0);

  // The coord-03 bootstrap shape: qa_reports is a symlink resolving OUTSIDE
  // the worktree, committed as a tracked symlink (so it never shows up as an
  // unrelated dirty entry of its own).
  const outside = mkTmp("e180d2-outside-evidence-");
  fs.symlinkSync(outside, path.join(lane, "qa_reports"));
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "bootstrap: symlink qa_reports outside the worktree"]);

  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D2-01.md"), "linked evidence\n");

  const r = runAgc(repo, ["finish", "e180d2", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence/, "a dir linked outside the worktree survives removal on its own — no harvest needed");
  assert.match(r.stdout, /moved qa_reports\/review_T-E180D2-01\.md -> qa_reports\/abandoned\/e180d2\//);

  assert.ok(!fs.existsSync(path.join(repo, "qa_reports")), "no primary copy must be made");
  assert.ok(
    fs.existsSync(path.join(outside, "abandoned", "e180d2", "review_T-E180D2-01.md")),
    "the file's true (outside) location must hold the moved file — it survived the worktree removal on its own",
  );
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d2-symlinked-outside"));
});

test("AC3: a differing primary destination refuses before any mutation", () => {
  const repo = makePrimaryRepo({ gitignore: "qa_reports/\n" });
  const lane = path.join(mkTmp("e180d3-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d3-conflict-differs", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D3-01.md"), "lane content\n");

  // Pre-seed a CONFLICTING primary destination with different bytes.
  fs.mkdirSync(path.join(repo, "qa_reports", "abandoned", "e180d3"), { recursive: true });
  fs.writeFileSync(path.join(repo, "qa_reports", "abandoned", "e180d3", "review_T-E180D3-01.md"), "DIFFERENT primary content\n");

  const before = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e180d3-conflict-differs"]);
  const r = runAgc(repo, ["finish", "e180d3", "--abandoned"]);
  assert.notEqual(r.status, 0, "must refuse — nothing moved");

  // Copy / Strings e180.evidence-harvest-refuse-line.
  assert.match(
    r.stderr,
    /agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs \(nothing moved\):/,
  );
  assert.match(r.stderr, /qa_reports\/abandoned\/e180d3\/review_T-E180D3-01\.md/);

  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "review_T-E180D3-01.md")), "the lane's evidence file must stay in place");
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "abandoned", "e180d3", "review_T-E180D3-01.md"), "utf-8"),
    "DIFFERENT primary content\n",
    "the conflicting primary file must be left untouched",
  );
  assert.ok(fs.existsSync(lane), "the worktree must remain");
  assert.ok(branchExists(repo, "feat/e180d3-conflict-differs"));
  const after = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e180d3-conflict-differs"]);
  assert.equal(before, after, "no commit of any kind may have happened");
});

test("AC4: an identical primary destination does not refuse", () => {
  const repo = makePrimaryRepo({ gitignore: "qa_reports/\n" });
  const lane = path.join(mkTmp("e180d4-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d4-conflict-identical", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D4-01.md"), "same bytes\n");

  // Pre-seed the SAME bytes at the primary destination (a safe re-run shape).
  fs.mkdirSync(path.join(repo, "qa_reports", "abandoned", "e180d4"), { recursive: true });
  fs.writeFileSync(path.join(repo, "qa_reports", "abandoned", "e180d4", "review_T-E180D4-01.md"), "same bytes\n");

  const r = runAgc(repo, ["finish", "e180d4", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvest destination already exists/, "identical bytes must not refuse");
  // No fresh copy is needed (it was already there identical), but the move
  // itself must still proceed exactly as always.
  assert.match(r.stdout, /moved qa_reports\/review_T-E180D4-01\.md -> qa_reports\/abandoned\/e180d4\//);
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "abandoned", "e180d4", "review_T-E180D4-01.md"), "utf-8"),
    "same bytes\n",
  );
  assert.ok(!fs.existsSync(lane), "finishes normally — worktree removed");
  assert.ok(branchExists(repo, "feat/e180d4-conflict-identical"));
});

test("AC5: a plain untracked (non-ignored) evidence file is unaffected — pre-existing behavior", () => {
  const repo = makePrimaryRepo(); // no .gitignore — qa_reports is NOT ignored
  const lane = path.join(mkTmp("e180d5-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d5-plain-untracked", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D5-01.md"), "plain untracked\n");

  const r = runAgc(repo, ["finish", "e180d5", "--abandoned"]);
  // AC1's new harvest logic never applies to this file — the pre-existing
  // native worktree-remove refusal over the moved-but-still-untracked file
  // fires exactly as it does today (test/agc-feature-lifecycle.test.mjs AC22).
  assert.notEqual(r.status, 0, "git worktree remove must still refuse over the non-ignored leftover");
  assert.match(r.stderr, /modified or untracked/i);
  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence/, "a non-ignored file is not \"at risk\" — no harvest applies");
  assert.match(r.stdout, /moved qa_reports\/review_T-E180D5-01\.md -> qa_reports\/abandoned\/e180d5\//);
  assert.ok(!fs.existsSync(path.join(repo, "qa_reports")), "no primary copy must ever be made for this shape");
  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "abandoned", "e180d5", "review_T-E180D5-01.md")));

  gitTry(repo, ["worktree", "remove", "--force", lane]); // cleanup, matches AC22 precedent
});

test("AC6: the evidence harvest is idempotent across a later-step failure and re-run", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\nqa_reports/\n" });
  const lane = path.join(mkTmp("e180d6-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d6-idempotent-reharvest", "--path", lane]).status, 0);

  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D6-01.md"), "harvest me once\n");

  // A LATER step (the E194 .current/<ticket>/ harvest, which runs after the
  // E180 evidence harvest+move+commit) fails mid-copy: an unreadable file
  // forces fs.cpSync to throw EACCES (test/agc-feature-finish-history.test.mjs
  // AC9-R2 precedent for the equivalent --shipped harvest).
  const laneCurrentDir = path.join(lane, ".current", "e180d6");
  const unreadable = path.join(laneCurrentDir, "unreadable.jsonl");
  fs.writeFileSync(unreadable, "cannot read this\n");
  fs.chmodSync(unreadable, 0o000);

  try {
    const first = runAgc(repo, ["finish", "e180d6", "--abandoned"]);
    assert.notEqual(first.status, 0, "the .current harvest must fail on the unreadable file");
    assert.match(first.stderr, /harvest of \.current\/e180d6\/.*failed|EACCES|permission denied/i);
    assert.match(first.stderr, /worktree and branch left in place/i);

    // The EARLIER evidence harvest (E180) must have already completed and
    // committed, unaffected by the LATER (E194) failure.
    assert.match(first.stdout, /harvested git-ignored evidence qa_reports\/review_T-E180D6-01\.md -> primary/);
    assert.match(first.stdout, /moved qa_reports\/review_T-E180D6-01\.md -> qa_reports\/abandoned\/e180d6\//);
    const harvestedEvidence = path.join(repo, "qa_reports", "abandoned", "e180d6", "review_T-E180D6-01.md");
    assert.equal(fs.readFileSync(harvestedEvidence, "utf-8"), "harvest me once\n");
    assert.ok(fs.existsSync(lane), "the worktree must be left in place after the later failure");
    assert.ok(branchExists(repo, "feat/e180d6-idempotent-reharvest"));

    // Resolve the cause and re-run.
    fs.chmodSync(unreadable, 0o644);
    const second = runAgc(repo, ["finish", "e180d6", "--abandoned"]);
    assert.equal(second.status, 0, `stderr=${second.stderr}`);

    // Re-run must NOT error on the already-harvested identical primary copy —
    // by this point the evidence file is no longer a direct child of
    // qa_reports/ (it already moved into qa_reports/abandoned/e180d6/ on the
    // first run), so planAbandonEvidence finds nothing left to harvest at all.
    assert.doesNotMatch(second.stdout, /harvested git-ignored evidence qa_reports\/review_T-E180D6-01\.md/);
    assert.doesNotMatch(second.stdout, /harvest destination already exists/);
    assert.equal(fs.readFileSync(harvestedEvidence, "utf-8"), "harvest me once\n", "the primary evidence copy must be untouched by the re-run");

    // The .current harvest now succeeds and the worktree removal proceeds.
    assert.match(second.stdout, /harvested untracked \.current\/e180d6\/ into \.current\/history\//);
    const bucket = historyBucket();
    assert.ok(fs.existsSync(path.join(repo, ".current", "history", bucket, "e180d6", "unreadable.jsonl")), "the fixed file must be re-harvested on the successful re-run");
    assert.ok(!fs.existsSync(lane), "the worktree removal must proceed once the earlier cause is resolved");
    assert.ok(branchExists(repo, "feat/e180d6-idempotent-reharvest"));
  } finally {
    try {
      fs.chmodSync(unreadable, 0o644);
    } catch {
      // best effort — file may already be gone with the removed worktree
    }
  }
});

// ============================================================================
// AC7-AC12 — E194 `.current/<ticket>/` harvest (planAbandonCurrentHarvest /
// executeAbandonCurrentHarvest, bin/agc-init.mjs).
// ============================================================================

test("AC7: an all-untracked .current/<ticket>/ is harvested in full, no exclusions", () => {
  const repo = makePrimaryRepo(); // no project .gitignore needed
  const lane = path.join(mkTmp("e180d7-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d7-current-harvest", "--path", lane]).status, 0);
  const baseShaBytes = fs.readFileSync(path.join(lane, ".current", "e180d7", "base-sha"));

  const r = runAgc(repo, ["finish", "e180d7", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // Copy / Strings e194.current-harvest-line (this fixture never committed
  // .current/e180d7/ on its branch at all, so the "nothing durable" reason
  // clause applies — the directory itself carries no project-level ignore
  // rule, only the base-sha FILENAME is excluded via the shared info/exclude).
  assert.match(
    r.stdout,
    /agc feature finish — harvested untracked \.current\/e180d7\/ into \.current\/history\/\d{4}-\d{2}\/e180d7\/ \(fs copy, not committed — this lane never committed \.current\/e180d7\/ on feat\/e180d7-current-harvest, so there was nothing durable to keep;/,
  );

  const bucket = historyBucket();
  const histFile = path.join(repo, ".current", "history", bucket, "e180d7", "base-sha");
  assert.ok(fs.existsSync(histFile), "base-sha must be harvested too — unlike --shipped, --abandoned excludes nothing");
  assert.ok(fs.readFileSync(histFile).equals(baseShaBytes));
  assert.equal(
    gitTry(repo, ["ls-files", "--error-unmatch", "--", `.current/history/${bucket}/e180d7/base-sha`]).status,
    1,
    "the harvested copy must not be committed",
  );
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d7-current-harvest"));
});

test("AC8: a tracked .current/<ticket>/ gets no harvest copy", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e180d8-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d8-tracked-current", "--path", lane]).status, 0);

  fs.writeFileSync(path.join(lane, ".current", "e180d8", "handoff.md"), "tracked handoff\n");
  git(lane, ["add", "-f", ".current/e180d8/handoff.md"]);
  git(lane, ["commit", "-m", "track lane state"]);

  const r = runAgc(repo, ["finish", "e180d8", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvested untracked \.current/, "tracked content is already durable via the kept branch");

  const bucket = historyBucket();
  assert.ok(!fs.existsSync(path.join(repo, ".current", "history", bucket, "e180d8")), "no history copy must be made");
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d8-tracked-current"));
});

test("AC9: a non-directory blocking the history path refuses before any mutation", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e180d9-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d9-history-blocked", "--path", lane]).status, 0);

  // An extra evidence file, to prove the E194 refusal is hoisted BEFORE the
  // E180 evidence harvest/move/commit even runs.
  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D9-01.md"), "should not move\n");

  const bucket = historyBucket();
  fs.mkdirSync(path.join(repo, ".current", "history", bucket), { recursive: true });
  fs.writeFileSync(path.join(repo, ".current", "history", bucket, "e180d9"), "a stray FILE, not a directory\n");

  const r = runAgc(repo, ["finish", "e180d9", "--abandoned"]);
  assert.notEqual(r.status, 0, "must refuse — nothing moved");
  // Copy / Strings e194.current-harvest-refuse-line.
  assert.match(
    r.stderr,
    new RegExp(
      escRe(
        `agc feature finish --abandoned: .current/history/${bucket}/e180d9/ already exists in the primary checkout and is not a directory — move it aside first (nothing moved, worktree left in place)`,
      ),
    ),
  );

  assert.equal(
    fs.readFileSync(path.join(repo, ".current", "history", bucket, "e180d9"), "utf-8"),
    "a stray FILE, not a directory\n",
    "the stray file must be untouched",
  );
  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "review_T-E180D9-01.md")), "the unrelated evidence file must not have moved — the refusal precedes it");
  assert.ok(fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d9-history-blocked"));
});

test("AC10: a pre-existing history directory is refreshed by copy-over, never delete", () => {
  const repo = makePrimaryRepo({ gitignore: ".current/\n" });
  const lane = path.join(mkTmp("e180d10-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d10-refresh-copy-over", "--path", lane]).status, 0);

  const bucket = historyBucket();
  const histDir = path.join(repo, ".current", "history", bucket, "e180d10");
  fs.mkdirSync(histDir, { recursive: true });
  // A file that exists ONLY in history (an earlier harvest under this same
  // ticket) — an rm-then-copy implementation would destroy this.
  fs.writeFileSync(path.join(histDir, "only-history.md"), "history-only survivor\n");
  // A file that exists in BOTH places with DIFFERENT content — must refresh.
  fs.writeFileSync(path.join(histDir, "handoff.md"), "stale history content\n");

  fs.writeFileSync(path.join(lane, ".current", "e180d10", "handoff.md"), "fresh lane content\n");

  const r = runAgc(repo, ["finish", "e180d10", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /harvested untracked \.current\/e180d10\/ into \.current\/history\//);

  assert.equal(
    fs.readFileSync(path.join(histDir, "only-history.md"), "utf-8"),
    "history-only survivor\n",
    "a pre-seeded history-only file must survive the re-harvest byte-identical",
  );
  assert.equal(
    fs.readFileSync(path.join(histDir, "handoff.md"), "utf-8"),
    "fresh lane content\n",
    "a same-named file must be refreshed from the lane's current content",
  );
  assert.ok(fs.existsSync(path.join(histDir, "base-sha")), "base-sha (new to the history dir) must also be copied over");
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d10-refresh-copy-over"));
});

test("AC11: a lane with no .current/<ticket>/ at all harvests nothing and errors on nothing", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e180d11-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d11-no-current-dir", "--path", lane]).status, 0);
  fs.rmSync(path.join(lane, ".current", "e180d11"), { recursive: true, force: true });

  const r = runAgc(repo, ["finish", "e180d11", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvested untracked \.current/);
  const bucket = historyBucket();
  assert.ok(!fs.existsSync(path.join(repo, ".current", "history", bucket, "e180d11")));
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d11-no-current-dir"));
});

test("AC12: the adopter-shaped workspace — both harvests fire end-to-end", () => {
  // Fixture shape mirrors an adopter project's actual repo (amended 2026-09-27
  // per integrator pre-review, to-lane.md#1): no coord-03 bootstrap symlink;
  // qa_reports/, review_reports/, .current/ and tasks.md all git-ignored (the
  // last three anchored, exercising git check-ignore's anchored matching);
  // the primary's own .current/ is the FLAT LEGACY shape (no lane dirs).
  const repo = makePrimaryRepo({
    gitignore: ".current/\ntasks.md\n/qa_reports/\n/review_reports/\n/specs/\n",
    extraFiles: {
      ".current/handoff.md": "flat legacy handoff\n",
      ".current/tasks.md": "flat legacy tasks\n",
      ".current/archive/x": "flat legacy archive\n",
    },
  });
  const before = {
    handoff: fs.readFileSync(path.join(repo, ".current", "handoff.md"), "utf-8"),
    tasks: fs.readFileSync(path.join(repo, ".current", "tasks.md"), "utf-8"),
    archive: fs.readFileSync(path.join(repo, ".current", "archive", "x"), "utf-8"),
  };

  const lane = path.join(mkTmp("e180d12-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d12-adopter-shape", "--path", lane]).status, 0);

  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E180D12-01.md"), "adopter-shape evidence\n");
  fs.writeFileSync(path.join(lane, ".current", "e180d12", "handoff.md"), "adopter-shape lane handoff\n");

  const r = runAgc(repo, ["finish", "e180d12", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // Both harvests fire and are logged.
  assert.match(r.stdout, /harvested git-ignored evidence qa_reports\/review_T-E180D12-01\.md -> primary/);
  assert.match(r.stdout, /harvested untracked \.current\/e180d12\/ into \.current\/history\//);
  assert.match(r.stdout, /the source path is git-ignored in this workspace/, "with a project .gitignore covering .current/ directory-wide, the ignored reason clause applies");

  const bucket = historyBucket();
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "abandoned", "e180d12", "review_T-E180D12-01.md"), "utf-8"),
    "adopter-shape evidence\n",
  );
  assert.equal(
    fs.readFileSync(path.join(repo, ".current", "history", bucket, "e180d12", "handoff.md"), "utf-8"),
    "adopter-shape lane handoff\n",
  );
  assert.ok(fs.existsSync(path.join(repo, ".current", "history", bucket, "e180d12", "base-sha")));

  // The worktree is removed and the branch is kept.
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e180d12-adopter-shape"));

  // The flat legacy primary .current/ must be neither modified nor moved.
  assert.equal(fs.readFileSync(path.join(repo, ".current", "handoff.md"), "utf-8"), before.handoff);
  assert.equal(fs.readFileSync(path.join(repo, ".current", "tasks.md"), "utf-8"), before.tasks);
  assert.equal(fs.readFileSync(path.join(repo, ".current", "archive", "x"), "utf-8"), before.archive);
});

// ============================================================================
// AC13 — E197: closedLanePointerLine's fallback clause (--shipped path only;
// AC1-AC12 above never touch it).
// ============================================================================

test("AC13: closedLanePointerLine's fallback clause reads case-insensitive git log -i --grep", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e180d13-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e180d13-pointer-fallback", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e180d13-pointer-fallback");

  const r = runAgc(repo, ["finish", "e180d13", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const tasksText = fs.readFileSync(path.join(repo, "tasks.md"), "utf-8");
  assert.match(tasksText, /git log -i --grep e180d13 is the universal fallback/);
});

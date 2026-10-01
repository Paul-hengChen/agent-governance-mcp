// Coded by @qa-engineer
// Tests for `agc feature finish <ticket> --shipped` where root tasks.md and .current/ are both git-ignored: without these fixes the command failed on the ignored tasks.md, or deleted git-ignored qa_reports/,
// review_reports/ and specs/ evidence with the worktree. Also covers one --abandoned fix: the in-lane `moved` line must not read as a second durable copy for a file already copied to primary. (specs/e213-shipped-ignored-shape.md AC1-AC17; E213, E214, E216)
// Fixtures: every test file owns its helpers (test/e180-abandoned-harvest.test.mjs, test/agc-feature-finish-history.test.mjs); makePrimaryRepo/runAgc/mergeLane/historyBucket/escRe match e180's, reused per the spec's Dependencies note. Test names carry the AC number.
// `git worktree remove` (never --force) deletes untracked-and-ignored content without refusing but refuses untracked-not-ignored content; AC10's plain untracked sibling reproduces that refusal. AC4 and AC13 are proven by existing suites plus full `npm test`.
// Rationale: specs/e260f-comment-rationale.md (test/e213-shipped-ignored-shape.test.mjs).

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
// git / agc helpers, same shape as test/e180-abandoned-harvest.test.mjs's.
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
  const repo = mkTmp("e213-shipped-ignored-primary-");
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
// precedent, mirrored in test/e180-abandoned-harvest.test.mjs).
function historyBucket(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Literal-substring-safe regex builder for exact Copy/Strings assertions.
function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeFile(abs, content) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

// Commits `.current/<ticket>/` on the lane's own branch. AC1 uses this shape
// to test the git-ignored tasks.md line on its own, apart from the separate
// untracked-.current/ copy message that AC2 tests: `tracked` then reads true
// from the primary's own perspective after the merge, and the close step
// takes the `git mv` branch instead of the plain file-copy branch.
function commitLaneCurrentDir(lanePath, ticketId) {
  git(lanePath, ["add", "-f", "--", `.current/${ticketId}`]);
  git(lanePath, ["commit", "-m", `track .current/${ticketId}/`]);
}

// A pre-commit hook that unconditionally fails every commit made against
// this repo from this point on — used once, right before the call under
// test, in a repo whose earlier fixture-setup commits have already landed.
function installFailingPreCommitHook(repo) {
  const hookPath = path.join(repo, ".git", "hooks", "pre-commit");
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });
  fs.writeFileSync(hookPath, "#!/bin/sh\nexit 1\n");
  fs.chmodSync(hookPath, 0o755);
}
function removePreCommitHook(repo) {
  fs.rmSync(path.join(repo, ".git", "hooks", "pre-commit"), { force: true });
}

function readTasksMd(repo) {
  return fs.readFileSync(path.join(repo, "tasks.md"), "utf-8");
}

// ============================================================================
// Root tasks.md is git-ignored: the lane-close pointer is written to the
// file directly, with no `git add`. (AC1-AC5, E213)
// ============================================================================

test("AC1: tasks.md git-ignored — fs-only pointer write, no git add, fsonly-line once", () => {
  const repo = makePrimaryRepo({ gitignore: "tasks.md\n" });
  const lane = path.join(mkTmp("e213t1-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t1-tasks-fsonly", "--path", lane]).status, 0);
  // Committed .current/<ticket>/ isolates this test from the separate,
  // always-fires untracked-.current/ advisory (that's AC2's own point).
  commitLaneCurrentDir(lane, "e213t1");
  mergeLane(repo, "feat/e213t1-tasks-fsonly");

  const r = runAgc(repo, ["finish", "e213t1", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // The spec's exact message for a git-ignored tasks.md, printed exactly
  // once. (Copy / Strings e213.tasks-fsonly-line)
  const fsonly =
    /agc feature finish — tasks\.md is git-ignored here: wrote the lane-close pointer to it directly \(fs write, not committed\)/g;
  const matches = r.stdout.match(fsonly) ?? [];
  assert.equal(matches.length, 1, `expected the fsonly-line exactly once, got: ${r.stdout}`);

  // `git add -- tasks.md` was never attempted: tasks.md stays untracked.
  assert.equal(
    gitTry(repo, ["ls-files", "--error-unmatch", "--", "tasks.md"]).status,
    1,
    "tasks.md must remain untracked — git add was never attempted for an ignored path",
  );
  const text = readTasksMd(repo);
  assert.match(text, /## Closed Lanes/);
  assert.match(text, /lane_closed: ticket=e213t1/, "the pointer must still be written by a plain fs write");

  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e213t1-tasks-fsonly"));
});

test("AC2: tasks.md git-ignored + untracked .current/ harvest — both advisories fire in mutation order", () => {
  const repo = makePrimaryRepo({ gitignore: "tasks.md\n" });
  const lane = path.join(mkTmp("e213t2-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t2-both-advisories", "--path", lane]).status, 0);
  // Default `.current/<ticket>/` (base-sha only) is untracked, never committed
  // on the branch — the fs-copy harvest branch fires independently of tasks.md.
  mergeLane(repo, "feat/e213t2-both-advisories");

  const r = runAgc(repo, ["finish", "e213t2", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const fsonlyIdx = r.stdout.indexOf(
    "agc feature finish — tasks.md is git-ignored here: wrote the lane-close pointer to it directly (fs write, not committed)",
  );
  const harvestIdx = r.stdout.indexOf("agc feature finish — harvested untracked .current/e213t2/ into .current/history/");
  assert.ok(fsonlyIdx >= 0, `fsonly-line missing: ${r.stdout}`);
  assert.ok(harvestIdx >= 0, `harvest line missing: ${r.stdout}`);
  assert.ok(fsonlyIdx < harvestIdx, "the tasks.md fs-write must be mutated (and so printed) before the .current/ harvest");

  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e213t2-both-advisories"));
});

test("AC3: tasks.md git-ignored + zero-write .current/ — nocommit-line replaces the recorded-lane line, no harvest line", () => {
  const repo = makePrimaryRepo({ gitignore: "tasks.md\n" });
  const lane = path.join(mkTmp("e213t3-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t3-zero-write", "--path", lane]).status, 0);
  // Remove .current/<ticket>/ entirely (the AC9-ZEROWRITE shape this spec's
  // AC3 explicitly reuses) so no fs harvest applies at all.
  fs.rmSync(path.join(lane, ".current", "e213t3"), { recursive: true, force: true });
  mergeLane(repo, "feat/e213t3-zero-write");

  const r = runAgc(repo, ["finish", "e213t3", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.doesNotMatch(r.stdout, /harvested untracked \.current/, "nothing exists to harvest — no harvest line");
  assert.doesNotMatch(r.stdout, /recorded lane e213t3 under/, "the plain recorded-lane line must be replaced, not just supplemented");
  // The spec's exact message when nothing was committed, verbatim.
  // (Copy / Strings e213.tasks-nocommit-line)
  assert.match(
    r.stdout,
    /agc feature finish — lane e213t3 closed with no primary commit \(nothing here is git-tracked: tasks\.md and \.current\/e213t3\/ are both git-ignored\) — the fs-only writes above are this lane's only durable record/,
  );

  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e213t3-zero-write"));
});

test("AC4: tasks.md NOT git-ignored — neither new E213 line ever prints (byte-for-byte unchanged shape)", () => {
  const repo = makePrimaryRepo(); // no .gitignore — tasks.md is the ordinary tracked/untracked-but-not-ignored default
  const lane = path.join(mkTmp("e213t4-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t4-tasks-tracked", "--path", lane]).status, 0);
  mergeLane(repo, "feat/e213t4-tasks-tracked");

  const r = runAgc(repo, ["finish", "e213t4", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.doesNotMatch(r.stdout, /is git-ignored here: wrote the lane-close pointer/);
  assert.doesNotMatch(r.stdout, /closed with no primary commit/);
  assert.match(r.stdout, /recorded lane e213t4 under tasks\.md ## Closed Lanes/);
  // The existing add+commit path still runs: tasks.md IS tracked afterward.
  assert.equal(gitTry(repo, ["ls-files", "--error-unmatch", "--", "tasks.md"]).status, 0);

  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e213t4-tasks-tracked"));
});

test("AC5: a later step failing after a successful untracked harvest leaves no stale harvest line in stdout; re-run is safe", () => {
  const repo = makePrimaryRepo(); // tasks.md untracked-but-NOT-ignored — it gets `git add`ed, then committed
  const lane = path.join(mkTmp("e213t5-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t5-later-fail", "--path", lane]).status, 0);
  // Default untracked .current/<ticket>/ (base-sha only) — the fs-copy
  // harvest branch fires and succeeds BEFORE the commit step below fails.
  mergeLane(repo, "feat/e213t5-later-fail");

  installFailingPreCommitHook(repo);
  try {
    const first = runAgc(repo, ["finish", "e213t5", "--shipped"]);
    assert.notEqual(first.status, 0, "the forced pre-commit hook failure must fail the run");
    assert.equal(first.stdout, "", "every buffered advisory line — including the harvest line for the mutation that already succeeded — must be withheld, not just the commit-dependent one, until the whole step durably succeeds");
    assert.match(first.stderr, /git commit on main failed/);
    assert.match(first.stderr, /lane close not applied, worktree and branch left in place \(re-running finish is safe\)/);

    // Rollback must actually hold: no leftover history dir, tasks.md pointer
    // absent, worktree and branch both still present.
    const bucket = historyBucket();
    assert.ok(
      !fs.existsSync(path.join(repo, ".current", "history", bucket, "e213t5")),
      "a rolled-back harvest must leave no .current/history/ directory behind",
    );
    assert.doesNotMatch(fs.existsSync(path.join(repo, "tasks.md")) ? readTasksMd(repo) : "", /lane_closed: ticket=e213t5/);
    assert.ok(fs.existsSync(lane), "the worktree must be left in place after the rolled-back close");
    assert.ok(branchExists(repo, "feat/e213t5-later-fail"));
  } finally {
    removePreCommitHook(repo);
  }

  // "re-running finish is safe" — the retry must actually complete cleanly,
  // now printing the harvest line it withheld on the failing run.
  const second = runAgc(repo, ["finish", "e213t5", "--shipped"]);
  assert.equal(second.status, 0, `stderr=${second.stderr}`);
  assert.match(second.stdout, /harvested untracked \.current\/e213t5\//);
  assert.match(second.stdout, /recorded lane e213t5 under tasks\.md ## Closed Lanes/);
  assert.ok(!fs.existsSync(lane));
});

// ============================================================================
// `--shipped` copies git-ignored evidence to the primary checkout before the
// worktree is removed. (E214, AC6-AC11, AC16, AC17)
// ============================================================================

test("AC6: recursive evidence harvest, nested path preserved, across qa_reports/ and review_reports/, no ticket-token filter", () => {
  const repo = makePrimaryRepo({ gitignore: "/qa_reports/\n/review_reports/\n" });
  const lane = path.join(mkTmp("e213t6-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t6-recursive-harvest", "--path", lane]).status, 0);

  writeFile(path.join(lane, "qa_reports", "top.md"), "qa top\n");
  writeFile(path.join(lane, "qa_reports", "sub", "deep", "nested.md"), "qa nested\n");
  // Deliberately no ticket-token anywhere in these filenames (unlike
  // --abandoned's own token-filtered harvest) — --shipped harvests every
  // at-risk file regardless of name.
  writeFile(path.join(lane, "review_reports", "unrelated-name.md"), "review evidence\n");
  mergeLane(repo, "feat/e213t6-recursive-harvest");

  const r = runAgc(repo, ["finish", "e213t6", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // The existing evidence-copy message, reused verbatim, with the
  // archive/<ticket>/ destination. (Copy / Strings e180.evidence-harvest-line)
  assert.match(
    r.stdout,
    /agc feature finish — harvested git-ignored evidence qa_reports\/top\.md -> primary qa_reports\/archive\/e213t6\/top\.md \(fs copy, not committed — qa_reports\/ is git-ignored here and not linked outside the worktree, so `git worktree remove` would otherwise delete it silently\)/,
  );
  assert.match(
    r.stdout,
    /harvested git-ignored evidence qa_reports\/sub\/deep\/nested\.md -> primary qa_reports\/archive\/e213t6\/sub\/deep\/nested\.md/,
    "the file's path relative to the dir root must be preserved verbatim at any depth",
  );
  assert.match(
    r.stdout,
    /harvested git-ignored evidence review_reports\/unrelated-name\.md -> primary review_reports\/archive\/e213t6\/unrelated-name\.md/,
    "review_reports/ behaves identically to qa_reports/, and a non-ticket-token filename is still harvested",
  );

  assert.equal(fs.readFileSync(path.join(repo, "qa_reports", "archive", "e213t6", "top.md"), "utf-8"), "qa top\n");
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "archive", "e213t6", "sub", "deep", "nested.md"), "utf-8"),
    "qa nested\n",
  );
  assert.equal(
    fs.readFileSync(path.join(repo, "review_reports", "archive", "e213t6", "unrelated-name.md"), "utf-8"),
    "review evidence\n",
  );
  // The primary copies must NOT be committed (fs copy only).
  assert.equal(
    gitTry(repo, ["ls-files", "--error-unmatch", "--", "qa_reports/archive/e213t6/top.md"]).status,
    1,
  );

  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e213t6-recursive-harvest"));
});

test("AC7: an evidence dir symlinked outside the worktree gets no primary copy", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("e213t7-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t7-symlinked-outside", "--path", lane]).status, 0);

  // The lane bootstrap shape from the coordinator SOP (coord-03): qa_reports
  // is a symlink resolving OUTSIDE the worktree. Committed on the lane's own
  // branch (as in e180 AC2) so the symlink itself is TRACKED — otherwise `git worktree remove` (never
  // --force) refuses over the symlink entry as untracked-and-not-ignored
  // content, independent of anything this spec's harvest logic decides.
  const outside = mkTmp("e213t7-outside-evidence-");
  fs.symlinkSync(outside, path.join(lane, "qa_reports"));
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "bootstrap: symlink qa_reports outside the worktree"]);
  fs.writeFileSync(path.join(lane, "qa_reports", "linked.md"), "linked evidence\n");
  mergeLane(repo, "feat/e213t7-symlinked-outside");

  const r = runAgc(repo, ["finish", "e213t7", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence/, "a dir linked outside the worktree survives removal on its own — no harvest needed");
  assert.ok(fs.lstatSync(path.join(repo, "qa_reports")).isSymbolicLink(), "the merged-in symlink is the primary's own qa_reports/ (nothing was copied over it)");
  assert.ok(
    fs.existsSync(path.join(outside, "linked.md")),
    "the file's true (outside) location must hold it — it survives worktree removal on its own",
  );
  assert.ok(!fs.existsSync(lane));
});

test("AC8: a differing primary destination refuses before any mutation — worktree, branch and other evidence untouched", () => {
  const repo = makePrimaryRepo({ gitignore: "/qa_reports/\n/review_reports/\n" });
  const lane = path.join(mkTmp("e213t8-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t8-conflict-differs", "--path", lane]).status, 0);
  writeFile(path.join(lane, "qa_reports", "conflict.md"), "lane content\n");
  writeFile(path.join(lane, "review_reports", "safe.md"), "safe review content\n");

  // Pre-seed a CONFLICTING primary destination with different bytes.
  writeFile(path.join(repo, "qa_reports", "archive", "e213t8", "conflict.md"), "DIFFERENT primary content\n");
  mergeLane(repo, "feat/e213t8-conflict-differs");

  const before = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e213t8-conflict-differs"]);
  const r = runAgc(repo, ["finish", "e213t8", "--shipped"]);
  assert.notEqual(r.status, 0, "must refuse — nothing moved");

  // The existing refusal message, with `--shipped` as the verb.
  // (Copy / Strings e180.evidence-harvest-refuse-line)
  assert.match(
    r.stderr,
    /agc feature finish --shipped: harvest destination already exists in the primary checkout and differs \(nothing moved\):/,
  );
  assert.match(r.stderr, /qa_reports\/archive\/e213t8\/conflict\.md/);

  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "conflict.md")), "the lane's evidence file must stay in place");
  assert.ok(!fs.existsSync(path.join(repo, "review_reports")), "an unrelated evidence file must not have been harvested either — the refusal precedes ALL mutation");
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "archive", "e213t8", "conflict.md"), "utf-8"),
    "DIFFERENT primary content\n",
    "the conflicting primary file must be left untouched",
  );
  assert.ok(fs.existsSync(lane), "the worktree must remain");
  assert.ok(branchExists(repo, "feat/e213t8-conflict-differs"));
  const after = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e213t8-conflict-differs"]);
  assert.equal(before, after, "no commit of any kind may have happened");
});

test("AC9: an identical primary destination does not refuse and finishes normally (idempotent re-run)", () => {
  const repo = makePrimaryRepo({ gitignore: "/qa_reports/\n" });
  const lane = path.join(mkTmp("e213t9-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t9-conflict-identical", "--path", lane]).status, 0);
  writeFile(path.join(lane, "qa_reports", "same.md"), "same bytes\n");

  // Pre-seed the SAME bytes at the primary destination (a safe re-run shape).
  writeFile(path.join(repo, "qa_reports", "archive", "e213t9", "same.md"), "same bytes\n");
  mergeLane(repo, "feat/e213t9-conflict-identical");

  const r = runAgc(repo, ["finish", "e213t9", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvest destination already exists/, "identical bytes must not refuse");
  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence qa_reports\/same\.md/, "an already-identical destination needs no fresh copy");
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "archive", "e213t9", "same.md"), "utf-8"),
    "same bytes\n",
  );
  assert.ok(!fs.existsSync(lane), "finishes normally — worktree removed");
  assert.ok(!branchExists(repo, "feat/e213t9-conflict-identical"));
});

test("AC10: an untracked-but-not-ignored file is left to git's own refusal; a sibling ignored file still harvests", () => {
  const repo = makePrimaryRepo({ gitignore: "qa_reports/ignored-*.md\n" }); // pattern-scoped — qa_reports/ itself is NOT ignored
  const lane = path.join(mkTmp("e213t10-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t10-plain-untracked", "--path", lane]).status, 0);
  writeFile(path.join(lane, "qa_reports", "ignored-evidence.md"), "at risk\n");
  writeFile(path.join(lane, "qa_reports", "plain-not-ignored.md"), "plain untracked\n");
  assert.equal(
    gitTry(lane, ["check-ignore", "-q", "--", "qa_reports/plain-not-ignored.md"]).status,
    1,
    "sanity: the plain sibling file must genuinely not be ignored",
  );
  mergeLane(repo, "feat/e213t10-plain-untracked");

  const r = runAgc(repo, ["finish", "e213t10", "--shipped"]);
  // git's own worktree-remove refusal over the plain, never-ignored leftover
  // still fires unchanged, but only AFTER the ignored sibling has already
  // been copied to the primary checkout. (E180 AC5)
  assert.notEqual(r.status, 0, "git worktree remove must still refuse over the non-ignored leftover");
  assert.match(r.stderr, /modified or untracked/i);
  assert.match(r.stdout, /harvested git-ignored evidence qa_reports\/ignored-evidence\.md -> primary qa_reports\/archive\/e213t10\/ignored-evidence\.md/);
  assert.doesNotMatch(r.stdout, /plain-not-ignored/, "a non-ignored file is not \"at risk\" — no harvest applies to it");
  assert.equal(
    fs.readFileSync(path.join(repo, "qa_reports", "archive", "e213t10", "ignored-evidence.md"), "utf-8"),
    "at risk\n",
  );
  assert.ok(fs.existsSync(lane), "the worktree must be left in place — git itself refused the removal");
  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "plain-not-ignored.md")));

  gitTry(repo, ["worktree", "remove", "--force", lane]); // cleanup: git refused the removal above, so the worktree is still there (e180 AC5)
});

test("AC11: no files under any evidence dir — no harvest attempted, nothing errors", () => {
  const repo = makePrimaryRepo({ gitignore: "/qa_reports/\n/review_reports/\n/specs/\n" });
  const lane = path.join(mkTmp("e213t11-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t11-no-evidence", "--path", lane]).status, 0);
  // qa_reports/ and specs/ absent entirely; review_reports/ present but empty.
  fs.mkdirSync(path.join(lane, "review_reports"), { recursive: true });
  mergeLane(repo, "feat/e213t11-no-evidence");

  const r = runAgc(repo, ["finish", "e213t11", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence/);
  assert.ok(!fs.existsSync(path.join(repo, "qa_reports")));
  assert.ok(!fs.existsSync(path.join(repo, "review_reports")));
  assert.ok(!fs.existsSync(path.join(repo, "specs")));
  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e213t11-no-evidence"));
});

// ============================================================================
// AC12 — the adopter-shaped workspace, end-to-end
// (specs/e73-adopter-acceptance-2026-09-27.md Run A/A').
// ============================================================================

test("AC12: the adopter-shaped workspace — every harvest fires end-to-end", () => {
  const repo = makePrimaryRepo({
    gitignore: ".current/\ntasks.md\n/qa_reports/\n/review_reports/\n/specs/\n",
  });
  const lane = path.join(mkTmp("e213t12-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t12-adopter-shape", "--path", lane]).status, 0);

  writeFile(path.join(lane, "qa_reports", "review_T01.md"), "qa evidence\n");
  writeFile(path.join(lane, "review_reports", "review_T01.md"), "review evidence\n");
  // AC17's recursion requirement — a nested specs/<subdir>/<file>.
  writeFile(path.join(lane, "specs", "sub", "e213t12-shipped-ignored-shape.md"), "spec evidence\n");
  mergeLane(repo, "feat/e213t12-adopter-shape");

  const r = runAgc(repo, ["finish", "e213t12", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // AC1: fs-only tasks.md pointer, no git add.
  assert.match(r.stdout, /tasks\.md is git-ignored here: wrote the lane-close pointer to it directly/);
  // The separate copy of an untracked .current/<ticket>/ into history still
  // fires on its own. (E125b)
  assert.match(r.stdout, /harvested untracked \.current\/e213t12\/ into \.current\/history\//);
  // AC3-shape "no primary commit" line — nothing here is git-tracked at all.
  assert.match(r.stdout, /lane e213t12 closed with no primary commit/);
  // AC6/AC16 — all three evidence dirs harvested.
  assert.match(r.stdout, /harvested git-ignored evidence qa_reports\/review_T01\.md -> primary qa_reports\/archive\/e213t12\//);
  assert.match(r.stdout, /harvested git-ignored evidence review_reports\/review_T01\.md -> primary review_reports\/archive\/e213t12\//);
  assert.match(
    r.stdout,
    /harvested git-ignored evidence specs\/sub\/e213t12-shipped-ignored-shape\.md -> primary specs\/archive\/e213t12\/sub\/e213t12-shipped-ignored-shape\.md/,
  );

  const bucket = historyBucket();
  assert.equal(fs.readFileSync(path.join(repo, "qa_reports", "archive", "e213t12", "review_T01.md"), "utf-8"), "qa evidence\n");
  assert.equal(fs.readFileSync(path.join(repo, "review_reports", "archive", "e213t12", "review_T01.md"), "utf-8"), "review evidence\n");
  assert.equal(
    fs.readFileSync(path.join(repo, "specs", "archive", "e213t12", "sub", "e213t12-shipped-ignored-shape.md"), "utf-8"),
    "spec evidence\n",
  );
  assert.ok(fs.existsSync(path.join(repo, ".current", "history", bucket, "e213t12", "base-sha")));
  const text = readTasksMd(repo);
  assert.match(text, /lane_closed: ticket=e213t12/);

  assert.ok(!fs.existsSync(lane), "the worktree must be removed");
  assert.ok(!branchExists(repo, "feat/e213t12-adopter-shape"), "the branch must be deleted (--shipped, unlike --abandoned, which keeps it)");
});

// ============================================================================
// `--abandoned`: the in-lane `moved` line says when the file was also
// copied to the primary checkout. (AC14, AC15, E216)
// ============================================================================

test("AC14: --abandoned qualifies the moved line for a file harvested to primary", () => {
  const repo = makePrimaryRepo({ gitignore: "qa_reports/\n" });
  const lane = path.join(mkTmp("e213t14-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t14-qualified-move", "--path", lane]).status, 0);
  // --abandoned's own harvest is token-filtered — the filename must contain
  // the ticket id for planAbandonEvidence to pick it up at all.
  writeFile(path.join(lane, "qa_reports", "review_e213t14-01.md"), "harvested content\n");

  const r = runAgc(repo, ["finish", "e213t14", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.match(r.stdout, /harvested git-ignored evidence qa_reports\/review_e213t14-01\.md -> primary qa_reports\/abandoned\/e213t14\//);
  // The spec's qualified `moved` message, verbatim.
  // (Copy / Strings e216.moved-qualified-line)
  assert.match(
    r.stdout,
    /agc feature finish — moved qa_reports\/review_e213t14-01\.md -> qa_reports\/abandoned\/e213t14\/review_e213t14-01\.md \(inside the lane worktree only — removed with it; the primary copy harvested above is the durable one\)/,
  );
  assert.doesNotMatch(
    r.stdout,
    /moved qa_reports\/review_e213t14-01\.md -> qa_reports\/abandoned\/e213t14\/review_e213t14-01\.md\n/,
    "the plain (unqualified) line must NOT also print for this harvested file",
  );

  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e213t14-qualified-move"));
});

test("AC15: --abandoned keeps the plain moved line for a file NOT harvested to primary", () => {
  const repo = makePrimaryRepo(); // no .gitignore — the file below is tracked, so it is never "at risk"
  const lane = path.join(mkTmp("e213t15-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t15-plain-move", "--path", lane]).status, 0);
  writeFile(path.join(lane, "qa_reports", "review_e213t15-01.md"), "tracked content\n");
  git(lane, ["add", "-f", "qa_reports/review_e213t15-01.md"]);
  git(lane, ["commit", "-m", "track evidence"]);

  const r = runAgc(repo, ["finish", "e213t15", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence/, "a tracked file is never \"at risk\" — no harvest applies");
  // The existing plain `moved` line prints UNCHANGED — no qualification suffix.
  assert.match(r.stdout, /agc feature finish — moved qa_reports\/review_e213t15-01\.md -> qa_reports\/abandoned\/e213t15\/review_e213t15-01\.md\n/);
  assert.doesNotMatch(r.stdout, /inside the lane worktree only/);

  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e213t15-plain-move"));
});

// ============================================================================
// AC16 — specs/ is a full third member of SHIPPED_EVIDENCE_DIRS.
// ============================================================================

test("AC16: specs/ is a full third member of SHIPPED_EVIDENCE_DIRS, harvested under the same rules", () => {
  const repo = makePrimaryRepo({ gitignore: "/specs/\n" });
  const lane = path.join(mkTmp("e213t16-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t16-specs-harvest", "--path", lane]).status, 0);
  writeFile(path.join(lane, "specs", "e213t16-shipped-ignored-shape.md"), "spec content\n");
  // Pre-seed an identical destination too, to confirm specs/ shares AC9's
  // idempotent-on-identical rule, not just AC6's fresh-copy rule.
  writeFile(path.join(repo, "specs", "archive", "e213t16", "e213t16-shipped-ignored-shape.md"), "spec content\n");
  mergeLane(repo, "feat/e213t16-specs-harvest");

  const r = runAgc(repo, ["finish", "e213t16", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /harvest destination already exists/, "identical bytes at the specs/ destination must not refuse");
  assert.doesNotMatch(r.stdout, /harvested git-ignored evidence specs\//, "no fresh copy is needed — it was already there identical");
  assert.equal(
    fs.readFileSync(path.join(repo, "specs", "archive", "e213t16", "e213t16-shipped-ignored-shape.md"), "utf-8"),
    "spec content\n",
  );
  assert.ok(!fs.existsSync(lane));
});

// ============================================================================
// AC17 — symlink handling inside a harvested tree: dereference vs refuse.
// ============================================================================

test("AC17a: a symlink whose target resolves is dereferenced — content copied, primary never gains a symlink", () => {
  const repo = makePrimaryRepo({ gitignore: "/qa_reports/\n" });
  const lane = path.join(mkTmp("e213t17a-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t17a-symlink-deref", "--path", lane]).status, 0);
  writeFile(path.join(lane, "qa_reports", "real.md"), "real content\n");
  // A symlink INSIDE the walked tree whose target exists (unlike the dangling
  // symlink case). (E207)
  fs.symlinkSync(path.join(lane, "qa_reports", "real.md"), path.join(lane, "qa_reports", "link-to-real.md"));
  mergeLane(repo, "feat/e213t17a-symlink-deref");

  const r = runAgc(repo, ["finish", "e213t17a", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /harvested git-ignored evidence qa_reports\/link-to-real\.md -> primary qa_reports\/archive\/e213t17a\/link-to-real\.md/);

  const dst = path.join(repo, "qa_reports", "archive", "e213t17a", "link-to-real.md");
  assert.ok(!fs.lstatSync(dst).isSymbolicLink(), "the primary copy must be the resolved file's CONTENT, never a link");
  assert.equal(fs.readFileSync(dst, "utf-8"), "real content\n");

  const symlinksInPrimary = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) symlinksInPrimary.push(abs);
      else if (st.isDirectory()) walk(abs);
    }
  };
  walk(path.join(repo, "qa_reports"));
  assert.deepEqual(symlinksInPrimary, [], "the primary checkout must contain zero symlinks after the harvest — never a link back into the removed worktree (E207)");

  assert.ok(!fs.existsSync(lane));
});

test("AC17b: a symlink whose target does not resolve refuses before any mutation, naming every such path", () => {
  const repo = makePrimaryRepo({ gitignore: "/qa_reports/\n" });
  const lane = path.join(mkTmp("e213t17b-lane-"), "lane");
  assert.equal(runAgc(repo, ["start", "e213t17b-symlink-dangling", "--path", lane]).status, 0);
  writeFile(path.join(lane, "qa_reports", "safe.md"), "safe content\n");
  fs.symlinkSync("/nonexistent/path/e213t17b-does-not-exist", path.join(lane, "qa_reports", "dangling.md"));
  mergeLane(repo, "feat/e213t17b-symlink-dangling");

  const before = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e213t17b-symlink-dangling"]);
  const r = runAgc(repo, ["finish", "e213t17b", "--shipped"]);
  assert.notEqual(r.status, 0, "an unresolvable symlink must refuse the whole harvest for its dir — never silently skipped, never silently copied dangling");

  // The spec's refusal message for an unresolvable symlink, verbatim.
  // (Copy / Strings e214.evidence-harvest-symlink-refuse-line)
  assert.match(
    r.stderr,
    /agc feature finish --shipped: harvest of qa_reports\/ found unresolvable symlink\(s\) — refusing before any mutation \(nothing moved\):/,
  );
  assert.match(r.stderr, /qa_reports\/dangling\.md/);

  assert.ok(!fs.existsSync(path.join(repo, "qa_reports")), "nothing — not even the healthy sibling file — may be harvested when the dir refuses");
  assert.ok(fs.existsSync(lane), "the worktree must remain");
  assert.ok(branchExists(repo, "feat/e213t17b-symlink-dangling"));
  const after = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e213t17b-symlink-dangling"]);
  assert.equal(before, after, "no commit of any kind may have happened");
});

// Coded by @qa-engineer
// Tests for specs/e108-agc-eject.md AC1-AC25 (AC22 tests top-level usage text
// in test/agc-adapters.test.mjs instead — see the additive case there; AC23
// is verified by grep proof against docs/install.md, not a test case here,
// per this file's dispatch brief).
//
// Spec-to-test map:
//   AC1  -> "AC1: dry-run prints the full four-class plan, touches nothing"
//   AC2  -> "AC2: --yes executes exactly the AC1 plan"
//   AC3  -> "AC3: --purge-knowledge alone is still a dry-run and reports design/specs as tracked"
//   AC4  -> "AC4: --yes --purge-knowledge prints git rm for tracked design/specs, does not delete them"
//   AC5  -> "AC5: repo-mode tracked artifacts get a git rm command, never a delete"
//   AC6  -> "AC6: disposition is per-path on actual tracked state, independent of the declared artifacts value"
//   AC7  -> "AC7: docs/backlog.md is kept by default and handled as domain knowledge under --purge-knowledge"
//   AC8  -> "AC8: CLAUDE.md with user prose keeps the prose, loses only the marked block"
//   AC9  -> "AC9: CLAUDE.md holding only the block is deleted entirely"
//   AC10 -> "AC10: CLAUDE.md absent or unmarked is silently skipped"
//   AC11 -> "AC11: template-identical AGENTS.md/.antigravityrules are deleted"
//   AC12 -> "AC12: a non-template-matching AGENTS.md/.antigravityrules is flagged, never deleted"
//   AC13 -> "AC13: absent adapter files are silently skipped"
//   AC14 -> "AC14: exclude-line removal never touches LANE_EXCLUDE_RULES or unrelated lines"
//   AC15 -> "AC15: subdirectory eject never touches a sibling root workspace's artifacts"
//   AC16 -> "AC16: eject refuses inside a linked worktree, same as feature start/finish"
//   AC17 -> "AC17: outside a git repo, plain deletion still runs and exclude cleanup is skipped with a note"
//   AC18 -> "AC18: idempotent second run reports nothing to eject"
//   AC19 -> "AC19: the cannot-do block is always present, in both dry-run and --yes output"
//   AC20 -> "AC20: eject never prompts, runs to completion with stdin closed"
//   AC21 -> "AC21: an unknown flag is a usage error, exit 2, no changes"
//   AC24 -> "AC24: plan header reports the declared artifacts mode and the no-recovery note"
//   AC25 -> "AC25: --yes refuses while linked worktrees exist; dry-run warns"
//
// Additional coverage beyond the bare AC text, per the QA round-2 code
// review's recommendation (review_reports/review_T-E108-01.md, "Round 2")
// to pin the tracked-host-trace cases live-verified there, and per this
// file's dispatch brief:
//   "tracked host-trace: ..." tests -> cases A-D and G from that review's table
//   "git rm -r line: ..." tests -> both the root form and the subdirectory
//     "(run from the repository root)" form
//   "cannot-do item 4: ..." tests -> the "(none)" filler and the populated
//     ~/.claude/agents/*.md listing
//
// Every scratch repo is a REAL git repository built under os.tmpdir() via
// `git init` + a local identity (never this checkout or the lane worktree,
// and never the ambient global git config) — same discipline as
// test/e106-init-artifacts-flag.test.mjs and test/e239-init-subdir-exclude.test.mjs.
// Every invocation of the real bin/agc-init.mjs in this file runs with HOME
// pointed at a fresh, empty per-test temp directory (never the real ambient
// $HOME) so `agc eject`'s cannot-do item 4 (~/.claude/agents/*.md) is fully
// under this file's control and never leaks the operator's own machine state
// into an assertion.
//
// Security/boundary smoke (SOP Phase 3d): boundary inputs (empty-string arg,
// a very long garbage flag, a flag carrying embedded whitespace/newlines) are
// covered under "boundary:" below. Auth/permission tests are N/A — agc eject
// has no access-control surface (a local CLI acting on the caller's own
// working tree).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

const ARTIFACT_EXCLUDE_RULES = ["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/"];
const LANE_EXCLUDE_RULES = [".env", "/node_modules", "/.current/**/base-sha"];

// ---------------------------------------------------------------------------
// Cleanup registry — mirrors test/e106-init-artifacts-flag.test.mjs /
// test/e239-init-subdir-exclude.test.mjs.
// ---------------------------------------------------------------------------
const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of TMP_DIRS) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

// A fresh, empty per-call HOME — never the ambient $HOME. Every runAgc()
// call below is given one explicitly (or defaults to a fresh one) so
// cannot-do item 4 (~/.claude/agents/*.md) is deterministic.
function mkTmpHome() {
  return mkTmp("agc-eject-home-");
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

function mkGitRepo(prefix) {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  return repo;
}

// Same as mkGitRepo, plus one commit — required wherever `git worktree add`
// or a tracked-file fixture needs a resolvable HEAD.
function mkGitRepoWithCommit(prefix) {
  const repo = mkGitRepo(prefix);
  fs.writeFileSync(path.join(repo, "README.md"), "seed\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  return repo;
}

// Runs the real CLI with HOME pinned to a fresh temp dir (never the ambient
// $HOME) and stdin explicitly closed (AC20: eject must never read stdin).
function runAgc(cwd, args, { home } = {}) {
  const HOME = home ?? mkTmpHome();
  return spawnSync(process.execPath, [AGC_INIT, ...args], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HOME },
    timeout: 15000,
  });
}

function readExclude(repo) {
  try {
    return fs.readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8");
  } catch {
    return "";
  }
}

function readConfig(ws) {
  return JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));
}

// `git status --short` lines, WITHOUT a whole-string .trim() first: status
// codes are column-position-significant (" D file" vs "D  file" mean
// different things), and a blanket .trim() on the multi-line string strips
// only the very first line's leading column, corrupting exactly that line.
function gitStatusShort(repo) {
  return git(repo, ["status", "--short"])
    .split("\n")
    .filter((l) => l.length > 0);
}

// Byte snapshot of every regular file under `root`, excluding .git — used to
// assert a dry-run (or a rejected/errored invocation) makes zero filesystem
// changes.
function snapshotTree(root) {
  const out = {};
  function walk(dir, rel) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, relPath);
      } else if (entry.isFile()) {
        out[relPath] = fs.readFileSync(abs, "utf-8");
      }
    }
  }
  walk(root, "");
  return out;
}

function initWorkspace(ws, artifactsFlag, opts) {
  const args = artifactsFlag ? ["init", `--artifacts=${artifactsFlag}`] : ["init"];
  const r = runAgc(ws, args, opts);
  assert.equal(r.status, 0, `agc init failed: ${r.stderr}`);
  return r;
}

function addProcessEvidence(ws) {
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", "review_T-1.md"), "# QA review\npass\n");
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-1.md"), "# Code review\napproved\n");
}

function addDomainKnowledge(ws) {
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(path.join(ws, "design", "feature.md"), "# design notes\n");
  fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
  fs.writeFileSync(path.join(ws, "specs", "feature.md"), "# spec\n");
  fs.mkdirSync(path.join(ws, "docs"), { recursive: true });
  fs.writeFileSync(path.join(ws, "docs", "backlog.md"), "# Backlog\n- E1 something\n");
}

function ejectCannotDoRe() {
  return /agc eject cannot do the following — review and act on these yourself:/;
}

// ---------------------------------------------------------------------------
// AC1 — dry-run prints the full four-class plan, touches nothing
// ---------------------------------------------------------------------------
test("AC1: dry-run prints the full four-class plan, touches nothing", () => {
  const repo = mkGitRepo("e108-ac1-");
  initWorkspace(repo, "local");
  addProcessEvidence(repo);
  addDomainKnowledge(repo);
  // design/specs are tracked; docs/backlog.md, the runtime artifacts, and
  // the host-trace files are left untracked (AC1's own precondition set).
  git(repo, ["add", "design", "specs"]);
  git(repo, ["commit", "-q", "-m", "tracked design/specs"]);

  const before = snapshotTree(repo);
  const excludeBefore = readExclude(repo);

  const r = runAgc(repo, ["eject"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  assert.match(r.stdout, /agc eject — plan for .* \(dry-run; re-run with --yes to apply\):/);
  assert.match(r.stdout, /\(i\) machine state — \.current\/: DELETE/);
  assert.match(r.stdout, /\(ii-b\) process evidence — tasks\.md: DELETE/);
  assert.match(r.stdout, /\(ii-b\) process evidence — qa_reports\/: DELETE/);
  assert.match(r.stdout, /\(ii-b\) process evidence — review_reports\/: DELETE/);
  assert.match(
    r.stdout,
    /\(ii-a\) domain knowledge — docs\/backlog\.md: KEPT \(pass --purge-knowledge to remove; never the default\) — may be this project's plan/,
  );
  assert.match(
    r.stdout,
    /\(ii-a\) domain knowledge — design\/: KEPT \(pass --purge-knowledge to remove; never the default\)\n/,
  );
  assert.match(
    r.stdout,
    /\(ii-a\) domain knowledge — specs\/: KEPT \(pass --purge-knowledge to remove; never the default\)\n/,
  );
  assert.match(r.stdout, /\(iii\) host traces — CLAUDE\.md: REMOVE adapter block/);
  assert.match(r.stdout, /\(iii\) host traces — AGENTS\.md: DELETE \(matches the installed template\)/);
  assert.match(r.stdout, /\(iii\) host traces — \.antigravityrules: DELETE \(matches the installed template\)/);
  assert.match(r.stdout, /\(iii\) host traces — \.git\/info\/exclude: REMOVE 4 artifact exclude line\(s\)/);
  assert.match(r.stdout, ejectCannotDoRe());

  // Zero filesystem changes.
  assert.deepEqual(snapshotTree(repo), before, "dry-run must not touch any file");
  assert.equal(readExclude(repo), excludeBefore, "dry-run must not touch .git/info/exclude");
});

// ---------------------------------------------------------------------------
// AC2 — --yes executes exactly the AC1 plan
// ---------------------------------------------------------------------------
test("AC2: --yes executes exactly the AC1 plan", () => {
  const repo = mkGitRepo("e108-ac2-");
  initWorkspace(repo, "local");
  addProcessEvidence(repo);
  addDomainKnowledge(repo);
  git(repo, ["add", "design", "specs"]);
  git(repo, ["commit", "-q", "-m", "tracked design/specs"]);
  const backlogBefore = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  const designBefore = fs.readFileSync(path.join(repo, "design", "feature.md"), "utf-8");
  const specsBefore = fs.readFileSync(path.join(repo, "specs", "feature.md"), "utf-8");

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  assert.equal(fs.existsSync(path.join(repo, ".current")), false, ".current/ must be gone");
  assert.equal(fs.existsSync(path.join(repo, "tasks.md")), false, "tasks.md must be gone");
  assert.equal(fs.existsSync(path.join(repo, "qa_reports")), false, "qa_reports/ must be gone");
  assert.equal(fs.existsSync(path.join(repo, "review_reports")), false, "review_reports/ must be gone");

  assert.equal(fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"), backlogBefore);
  assert.equal(fs.readFileSync(path.join(repo, "design", "feature.md"), "utf-8"), designBefore);
  assert.equal(fs.readFileSync(path.join(repo, "specs", "feature.md"), "utf-8"), specsBefore);

  assert.equal(fs.existsSync(path.join(repo, "CLAUDE.md")), false, "CLAUDE.md (block-only) must be deleted");
  assert.equal(fs.existsSync(path.join(repo, "AGENTS.md")), false, "AGENTS.md must be deleted");
  assert.equal(fs.existsSync(path.join(repo, ".antigravityrules")), false, ".antigravityrules must be deleted");

  const excludeLines = readExclude(repo)
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.ok(!excludeLines.includes(rule), `exclude rule ${rule} must be gone`);
  }

  assert.match(r.stdout, ejectCannotDoRe());
});

// ---------------------------------------------------------------------------
// AC3 — --purge-knowledge alone is still a dry-run and reports design/specs as tracked
// ---------------------------------------------------------------------------
test("AC3: --purge-knowledge alone is still a dry-run and reports design/specs as tracked", () => {
  const repo = mkGitRepo("e108-ac3-");
  initWorkspace(repo, "local");
  addProcessEvidence(repo);
  addDomainKnowledge(repo);
  git(repo, ["add", "design", "specs"]);
  git(repo, ["commit", "-q", "-m", "tracked design/specs"]);

  const before = snapshotTree(repo);

  const r = runAgc(repo, ["eject", "--purge-knowledge"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.match(r.stdout, /agc eject — plan for .* \(dry-run; re-run with --yes to apply\):/);
  assert.match(r.stderr, /The following are tracked and were left untouched \(agc does not run git rm\):/);
  assert.match(r.stderr, /^  design\/$/m, `stderr=${r.stderr}`);
  assert.match(r.stderr, /^  specs\/$/m, `stderr=${r.stderr}`);
  assert.match(r.stderr, /git rm -r design specs\b/);
  assert.match(r.stderr, /Note: history still contains these files after that command\./);

  assert.deepEqual(snapshotTree(repo), before, "--purge-knowledge without --yes must not touch any file");
});

// ---------------------------------------------------------------------------
// AC4 — --yes --purge-knowledge prints git rm for tracked design/specs, does not delete them
// ---------------------------------------------------------------------------
test("AC4: --yes --purge-knowledge prints git rm for tracked design/specs, does not delete them", () => {
  const repo = mkGitRepo("e108-ac4-");
  initWorkspace(repo, "local");
  addProcessEvidence(repo);
  addDomainKnowledge(repo);
  git(repo, ["add", "design", "specs"]);
  git(repo, ["commit", "-q", "-m", "tracked design/specs"]);

  const r = runAgc(repo, ["eject", "--yes", "--purge-knowledge"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  assert.match(r.stderr, /git rm -r design specs\b/);
  assert.match(r.stderr, /Note: history still contains these files after that command\./);
  assert.ok(fs.existsSync(path.join(repo, "design", "feature.md")), "design/ must NOT be deleted (tracked)");
  assert.ok(fs.existsSync(path.join(repo, "specs", "feature.md")), "specs/ must NOT be deleted (tracked)");

  // Every other AC2 disposition still applies.
  assert.equal(fs.existsSync(path.join(repo, ".current")), false);
  assert.equal(fs.existsSync(path.join(repo, "tasks.md")), false);
  assert.equal(fs.existsSync(path.join(repo, "qa_reports")), false);
  assert.equal(fs.existsSync(path.join(repo, "review_reports")), false);
  assert.equal(fs.existsSync(path.join(repo, "CLAUDE.md")), false);
  assert.equal(fs.existsSync(path.join(repo, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(repo, ".antigravityrules")), false);
});

// ---------------------------------------------------------------------------
// AC5 — repo-mode tracked artifacts get a git rm command, never a delete
// ---------------------------------------------------------------------------
test("AC5: repo-mode tracked artifacts get a git rm command, never a delete", () => {
  const repo = mkGitRepo("e108-ac5-");
  initWorkspace(repo, "repo");
  addProcessEvidence(repo);
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "everything tracked under repo mode"]);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  // None of the four are deleted from the working tree or the index.
  for (const rel of [".current", "tasks.md", "qa_reports", "review_reports"]) {
    assert.ok(fs.existsSync(path.join(repo, rel)), `${rel} must still be on disk`);
  }
  const tracked = git(repo, ["ls-files", "--", ".current", "tasks.md", "qa_reports", "review_reports"])
    .trim()
    .split("\n")
    .filter(Boolean);
  assert.ok(tracked.some((f) => f.startsWith(".current/")));
  assert.ok(tracked.includes("tasks.md"));
  assert.ok(tracked.some((f) => f.startsWith("qa_reports/")));
  assert.ok(tracked.some((f) => f.startsWith("review_reports/")));

  // ONE consolidated command covering all four, root form (no qualifier).
  assert.match(r.stderr, /git rm -r \.current tasks\.md qa_reports review_reports\b/);
  assert.doesNotMatch(r.stderr, /run from the repository root/, "root workspace must not print the subdir qualifier");
  assert.match(r.stderr, /Note: history still contains these files after that command\./);
  // Exactly one such block (one "git rm -r" line naming the four paths together).
  const gitRmMatches = r.stderr.match(/git rm -r /g) ?? [];
  assert.equal(gitRmMatches.length, 1, `expected exactly one git rm -r line, stderr=${r.stderr}`);

  // Host traces still run exactly as in AC2 — deleted/edited even though tracked.
  assert.equal(fs.existsSync(path.join(repo, "CLAUDE.md")), false, "tracked CLAUDE.md (block-only) still deleted");
  assert.equal(fs.existsSync(path.join(repo, "AGENTS.md")), false, "tracked AGENTS.md still deleted");
  assert.equal(fs.existsSync(path.join(repo, ".antigravityrules")), false, "tracked .antigravityrules still deleted");

  // Exclude cleanup is a no-op: repo mode never wrote exclude rules.
  assert.match(r.stdout, /\(iii\) host traces — \.git\/info\/exclude: nothing to remove/);
});

// ---------------------------------------------------------------------------
// AC6 — disposition is per-path on actual tracked state, independent of the declared artifacts value
// ---------------------------------------------------------------------------
test("AC6: disposition is per-path on actual tracked state, independent of the declared artifacts value", () => {
  const repo = mkGitRepoWithCommit("e108-ac6-");
  // No "artifacts" key at all (undeclared).
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".current", ".config.json"), JSON.stringify({ schema_version: 2, host: "claude-code" }, null, 2) + "\n");
  fs.writeFileSync(path.join(repo, ".current", "seed.txt"), "untracked machine state\n");
  fs.mkdirSync(path.join(repo, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(repo, "qa_reports", "review_T-1.md"), "untracked evidence\n");
  // tasks.md IS tracked (mixed/legacy state).
  fs.writeFileSync(path.join(repo, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "tasks.md"]);
  git(repo, ["commit", "-q", "-m", "tracked tasks.md, legacy state"]);

  const tasksBefore = fs.readFileSync(path.join(repo, "tasks.md"), "utf-8");
  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  assert.equal(fs.existsSync(path.join(repo, ".current")), false, ".current/ (untracked) must be deleted");
  assert.equal(fs.existsSync(path.join(repo, "qa_reports")), false, "qa_reports/ (untracked) must be deleted");
  assert.ok(fs.existsSync(path.join(repo, "tasks.md")), "tasks.md (tracked) must be left untouched");
  assert.equal(fs.readFileSync(path.join(repo, "tasks.md"), "utf-8"), tasksBefore);
  assert.match(r.stderr, /git rm -r tasks\.md\b/);
  assert.match(r.stdout, /declared artifacts mode: undeclared/);
});

// ---------------------------------------------------------------------------
// AC7 — docs/backlog.md is kept by default and handled as domain knowledge under --purge-knowledge
// ---------------------------------------------------------------------------
test("AC7: docs/backlog.md is kept by default and handled as domain knowledge under --purge-knowledge", () => {
  // (a) default: kept, with or without --yes.
  {
    const repo = mkGitRepo("e108-ac7a-");
    initWorkspace(repo, "local");
    addDomainKnowledge(repo);
    const before = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
    const r1 = runAgc(repo, ["eject"]);
    assert.equal(r1.status, 0);
    assert.match(
      r1.stdout,
      /\(ii-a\) domain knowledge — docs\/backlog\.md: KEPT \(pass --purge-knowledge to remove; never the default\) — may be this project's plan/,
    );
    const r2 = runAgc(repo, ["eject", "--yes"]);
    assert.equal(r2.status, 0);
    assert.ok(fs.existsSync(path.join(repo, "docs", "backlog.md")), "backlog.md must survive plain --yes");
    assert.equal(fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"), before);
  }
  // (b) --purge-knowledge --yes, untracked backlog -> deleted.
  {
    const repo = mkGitRepo("e108-ac7b-");
    initWorkspace(repo, "local");
    fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repo, "docs", "backlog.md"), "# Backlog\n");
    const r = runAgc(repo, ["eject", "--yes", "--purge-knowledge"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.equal(fs.existsSync(path.join(repo, "docs", "backlog.md")), false, "untracked backlog.md must be deleted");
  }
  // (c) --purge-knowledge --yes, tracked backlog -> named in the git rm -r line, never deleted.
  {
    const repo = mkGitRepo("e108-ac7c-");
    initWorkspace(repo, "local");
    fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repo, "docs", "backlog.md"), "# Backlog\n");
    git(repo, ["add", "docs/backlog.md"]);
    git(repo, ["commit", "-q", "-m", "tracked backlog"]);
    const r = runAgc(repo, ["eject", "--yes", "--purge-knowledge"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.ok(fs.existsSync(path.join(repo, "docs", "backlog.md")), "tracked backlog.md must not be deleted");
    assert.match(r.stderr, /git rm -r .*docs\/backlog\.md/);
  }
});

// ---------------------------------------------------------------------------
// AC8 — CLAUDE.md with user prose keeps the prose, loses only the marked block
// ---------------------------------------------------------------------------
test("AC8: CLAUDE.md with user prose keeps the prose, loses only the marked block", () => {
  const repo = mkGitRepo("e108-ac8-");
  initWorkspace(repo, "local");
  const original = fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8");
  const withProse = "# My own notes\nsome prose before\n\n" + original + "\n\nsome prose after\n";
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), withProse);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.ok(fs.existsSync(path.join(repo, "CLAUDE.md")), "CLAUDE.md must be kept, not deleted");
  const after = fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8");
  assert.match(after, /^# My own notes\nsome prose before\n/);
  assert.match(after, /some prose after\n?$/);
  assert.doesNotMatch(after, /BEGIN agc-adapter/, "the marked block itself must be gone");
  assert.doesNotMatch(after, /END agc-adapter/);
  assert.match(r.stdout, /\(iii\) host traces — CLAUDE\.md: adapter block removed \(file kept, other content preserved\)/);
});

// ---------------------------------------------------------------------------
// AC9 — CLAUDE.md holding only the block is deleted entirely
// ---------------------------------------------------------------------------
test("AC9: CLAUDE.md holding only the block is deleted entirely", () => {
  const repo = mkGitRepo("e108-ac9-");
  initWorkspace(repo, "local"); // fresh init: CLAUDE.md holds only the block

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.equal(fs.existsSync(path.join(repo, "CLAUDE.md")), false, "CLAUDE.md must be deleted, not left empty");
  assert.match(
    r.stdout,
    /\(iii\) host traces — CLAUDE\.md: adapter block removed \(file deleted, held only the block\)/,
  );
});

// ---------------------------------------------------------------------------
// AC10 — CLAUDE.md absent or unmarked is silently skipped
// ---------------------------------------------------------------------------
test("AC10: CLAUDE.md absent or unmarked is silently skipped", () => {
  // (a) absent entirely.
  {
    const repo = mkGitRepo("e108-ac10a-");
    initWorkspace(repo, "local");
    fs.rmSync(path.join(repo, "CLAUDE.md"), { force: true });
    const r = runAgc(repo, ["eject"]);
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /CLAUDE\.md/);
  }
  // (b) present with no markers at all.
  {
    const repo = mkGitRepo("e108-ac10b-");
    initWorkspace(repo, "local");
    fs.writeFileSync(path.join(repo, "CLAUDE.md"), "# just my own project notes\nnothing agc-related here\n");
    const before = fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8");
    const r = runAgc(repo, ["eject"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.equal(fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8"), before, "must not touch an unmarked file");
    assert.match(r.stdout, /CLAUDE\.md: no adapter block found — nothing to do/);
    assert.doesNotMatch(r.stdout, /alarming|error|WARNING/i);
  }
});

// ---------------------------------------------------------------------------
// AC11 — template-identical AGENTS.md/.antigravityrules are deleted
// ---------------------------------------------------------------------------
test("AC11: template-identical AGENTS.md/.antigravityrules are deleted", () => {
  const repo = mkGitRepo("e108-ac11-");
  initWorkspace(repo, "local"); // both written byte-identical to the installed template
  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.equal(fs.existsSync(path.join(repo, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(repo, ".antigravityrules")), false);
  assert.match(r.stdout, /\(iii\) host traces — AGENTS\.md: deleted \(matched the installed template\)/);
  assert.match(r.stdout, /\(iii\) host traces — \.antigravityrules: deleted \(matched the installed template\)/);
});

// ---------------------------------------------------------------------------
// AC12 — a non-template-matching AGENTS.md/.antigravityrules is flagged, never deleted
// ---------------------------------------------------------------------------
test("AC12: a non-template-matching AGENTS.md/.antigravityrules is flagged, never deleted", () => {
  const repo = mkGitRepo("e108-ac12-");
  initWorkspace(repo, "local");
  fs.appendFileSync(path.join(repo, "AGENTS.md"), "\n\n# adopter-added section\n");
  const before = fs.readFileSync(path.join(repo, "AGENTS.md"), "utf-8");

  for (const args of [["eject"], ["eject", "--yes"], ["eject", "--yes", "--purge-knowledge"]]) {
    const r = runAgc(repo, args);
    assert.equal(r.status, 0, `exit code for ${args.join(" ")} (stderr=${r.stderr})`);
    assert.ok(fs.existsSync(path.join(repo, "AGENTS.md")), `AGENTS.md must survive ${args.join(" ")}`);
    assert.equal(fs.readFileSync(path.join(repo, "AGENTS.md"), "utf-8"), before);
    assert.match(
      r.stdout,
      /\(iii\) host traces — AGENTS\.md: KEPT — may hold content beyond agc's own template; review and remove by hand/,
    );
  }
  // .antigravityrules (untouched, still template-identical) IS deleted alongside — the
  // AGENTS.md advisory does not block the sibling file.
  assert.equal(fs.existsSync(path.join(repo, ".antigravityrules")), false);
});

// ---------------------------------------------------------------------------
// AC13 — absent adapter files are silently skipped
// ---------------------------------------------------------------------------
test("AC13: absent adapter files are silently skipped", () => {
  const repo = mkGitRepo("e108-ac13-");
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".current", ".config.json"),
    JSON.stringify({ schema_version: 2, host: "claude-code", artifacts: "repo" }, null, 2) + "\n",
  );
  // No CLAUDE.md, no AGENTS.md, no .antigravityrules at all.
  const r = runAgc(repo, ["eject"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout, /AGENTS\.md/);
  assert.doesNotMatch(r.stdout, /antigravityrules/);
  assert.doesNotMatch(r.stdout, /CLAUDE\.md/);
});

// ---------------------------------------------------------------------------
// AC14 — exclude-line removal never touches LANE_EXCLUDE_RULES or unrelated lines
// ---------------------------------------------------------------------------
test("AC14: exclude-line removal never touches LANE_EXCLUDE_RULES or unrelated lines", () => {
  const repo = mkGitRepo("e108-ac14-");
  initWorkspace(repo, "local");
  fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
  const excludeContent =
    [...LANE_EXCLUDE_RULES, "# mine", ...ARTIFACT_EXCLUDE_RULES].join("\n") + "\n";
  fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), excludeContent);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  const after = readExclude(repo);
  for (const line of [...LANE_EXCLUDE_RULES, "# mine"]) {
    assert.match(after, new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"), `line ${line} must survive`);
  }
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.doesNotMatch(after, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
});

// ---------------------------------------------------------------------------
// AC15 — subdirectory eject never touches a sibling root workspace's artifacts
// ---------------------------------------------------------------------------
test("AC15: subdirectory eject never touches a sibling root workspace's artifacts", () => {
  const repo = mkGitRepo("e108-ac15-");
  // Root workspace: its own agc init + full removable content.
  initWorkspace(repo, "local");
  addProcessEvidence(repo);

  // Subdir workspace.
  const sub = path.join(repo, "sub");
  fs.mkdirSync(sub, { recursive: true });
  initWorkspace(sub, "local");
  fs.mkdirSync(path.join(sub, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(sub, "qa_reports", "review_T-1.md"), "sub evidence\n");
  fs.mkdirSync(path.join(sub, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(sub, "review_reports", "review_T-1.md"), "sub review\n");

  const rootSnapshotBefore = {
    config: fs.readFileSync(path.join(repo, ".current", ".config.json"), "utf-8"),
    tasks: fs.readFileSync(path.join(repo, "tasks.md"), "utf-8"),
    claude: fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8"),
    agents: fs.readFileSync(path.join(repo, "AGENTS.md"), "utf-8"),
    antigravity: fs.readFileSync(path.join(repo, ".antigravityrules"), "utf-8"),
  };
  const excludeBefore = readExclude(repo);

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  // Subdir's own artifacts are gone.
  assert.equal(fs.existsSync(path.join(sub, ".current")), false);
  assert.equal(fs.existsSync(path.join(sub, "tasks.md")), false);
  assert.equal(fs.existsSync(path.join(sub, "qa_reports")), false);
  assert.equal(fs.existsSync(path.join(sub, "review_reports")), false);
  assert.equal(fs.existsSync(path.join(sub, "CLAUDE.md")), false);

  // Root workspace's own artifacts are completely untouched.
  assert.equal(fs.readFileSync(path.join(repo, ".current", ".config.json"), "utf-8"), rootSnapshotBefore.config);
  assert.equal(fs.readFileSync(path.join(repo, "tasks.md"), "utf-8"), rootSnapshotBefore.tasks);
  assert.equal(fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8"), rootSnapshotBefore.claude);
  assert.equal(fs.readFileSync(path.join(repo, "AGENTS.md"), "utf-8"), rootSnapshotBefore.agents);
  assert.equal(fs.readFileSync(path.join(repo, ".antigravityrules"), "utf-8"), rootSnapshotBefore.antigravity);
  assert.ok(fs.existsSync(path.join(repo, "qa_reports")), "root qa_reports/ must survive");
  assert.ok(fs.existsSync(path.join(repo, "review_reports")), "root review_reports/ must survive");

  // The root's own root-anchored exclude lines are byte-identical afterward;
  // only sub/'s prefixed lines are gone.
  const excludeAfter = readExclude(repo);
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.match(excludeAfter, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"), `root rule ${rule} must survive`);
  }
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.doesNotMatch(excludeAfter, new RegExp(`^/sub${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
  assert.notEqual(excludeAfter, excludeBefore, "sub/'s own lines must actually have been removed");
});

// ---------------------------------------------------------------------------
// AC16 — eject refuses inside a linked worktree, same as feature start/finish
// ---------------------------------------------------------------------------
test("AC16: eject refuses inside a linked worktree, same as feature start/finish", () => {
  const repo = mkGitRepoWithCommit("e108-ac16-");
  const lane = mkTmp("e108-ac16-lane-");
  git(repo, ["worktree", "add", lane, "-b", "feat/e108-ac16"]);

  const before = snapshotTree(lane);
  const r = runAgc(lane, ["eject", "--yes"]);
  assert.equal(r.status, 1, `expected exit 1 (stdout=${r.stdout} stderr=${r.stderr})`);
  assert.match(r.stderr, /refusing to run from inside a linked git worktree/);
  // git reports worktree paths realpath'd (macOS: /var -> /private/var), so
  // the message is compared against the canonical form, not the raw mkTmp() path.
  const canonicalRepo = fs.realpathSync(repo);
  assert.match(r.stderr, new RegExp(`run it from the primary checkout \\(${canonicalRepo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
  assert.doesNotMatch(r.stdout, /agc eject — (plan|applying)/, "no plan may be printed before the refusal");
  assert.deepEqual(snapshotTree(lane), before, "zero filesystem changes on refusal");
});

// ---------------------------------------------------------------------------
// AC17 — outside a git repo, plain deletion still runs and exclude cleanup is skipped with a note
// ---------------------------------------------------------------------------
test("AC17: outside a git repo, plain deletion still runs and exclude cleanup is skipped with a note", () => {
  const ws = mkTmp("e108-ac17-"); // deliberately NOT a git repo
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".current", "seed.txt"), "x\n");
  fs.writeFileSync(path.join(ws, "tasks.md"), "# Tasks\n");
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", "review_T-1.md"), "x\n");
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-1.md"), "x\n");

  const r = runAgc(ws, ["eject", "--yes"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.equal(fs.existsSync(path.join(ws, ".current")), false);
  assert.equal(fs.existsSync(path.join(ws, "tasks.md")), false);
  assert.equal(fs.existsSync(path.join(ws, "qa_reports")), false);
  assert.equal(fs.existsSync(path.join(ws, "review_reports")), false);
  assert.doesNotMatch(r.stderr, /git rm/, "no possible tracked state outside git — never printed");
  assert.match(r.stdout, /deleted \(no git repo — nothing to check-ignore\)/);
  assert.match(r.stdout, /\(iii\) host traces — \.git\/info\/exclude: skipped \(not inside a git repository\)/);
});

// ---------------------------------------------------------------------------
// AC18 — idempotent second run reports nothing to eject
// ---------------------------------------------------------------------------
test("AC18: idempotent second run reports nothing to eject", () => {
  const repo = mkGitRepo("e108-ac18-");
  initWorkspace(repo, "local");
  const r1 = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r1.status, 0, `first run (stderr=${r1.stderr})`);

  const before = snapshotTree(repo);
  const excludeBefore = readExclude(repo);
  const r2 = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r2.status, 0, `second run (stderr=${r2.stderr})`);
  assert.match(r2.stdout, /^agc eject — nothing to eject\.$/m);
  assert.match(r2.stdout, ejectCannotDoRe());
  assert.deepEqual(snapshotTree(repo), before, "second run must make no changes");
  assert.equal(readExclude(repo), excludeBefore);

  // Dry-run (no --yes) form too.
  const r3 = runAgc(repo, ["eject"]);
  assert.equal(r3.status, 0);
  assert.match(r3.stdout, /^agc eject — nothing to eject\.$/m);
});

// ---------------------------------------------------------------------------
// AC19 — the cannot-do block is always present, in both dry-run and --yes output
// ---------------------------------------------------------------------------
test("AC19: the cannot-do block is always present, in both dry-run and --yes output", () => {
  const cases = [[], ["--yes"], ["--purge-knowledge"], ["--yes", "--purge-knowledge"]];
  for (const flags of cases) {
    const repo = mkGitRepo(`e108-ac19-${flags.join("").replace(/-/g, "")}-`);
    initWorkspace(repo, "local");
    const home = mkTmpHome(); // empty — no ~/.claude/agents/*.md
    const r = runAgc(repo, ["eject", ...flags], { home });
    assert.equal(r.status, 0, `flags=${flags.join(" ")} stderr=${r.stderr}`);
    assert.match(r.stdout, /agc eject cannot do the following — review and act on these yourself:/);
    assert.match(r.stdout, /1\. Rewrite git history:/);
    assert.match(r.stdout, /2\. Edit code comments:/);
    assert.match(r.stdout, /3\. Edit your host's MCP\/settings registration:/);
    assert.match(r.stdout, /claude mcp remove -s user agent-governance-mcp/);
    assert.match(r.stdout, /4\. Remove the machine-wide subagent templates in ~\/\.claude\/agents\/:/);
    // Empty HOME/.claude/agents -> the "(none)" filler, per this file's dispatch brief.
    assert.match(r.stdout, /Present:\n\s+\(none\)\n/);
  }
});

// ---------------------------------------------------------------------------
// cannot-do item 4 — populated ~/.claude/agents/*.md listing (contrast to "(none)")
// ---------------------------------------------------------------------------
test("cannot-do item 4: installed machine-wide subagent templates are listed with the rm command", () => {
  const repo = mkGitRepo("e108-cannotdo4-");
  initWorkspace(repo, "local");
  const home = mkTmpHome();
  const agentsDir = path.join(home, ".claude", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  const templatesDir = path.join(PROJECT_ROOT, "templates", "claude-code-agents");
  const templateNames = fs.readdirSync(templatesDir).filter((n) => n.endsWith(".md")).sort();
  assert.ok(templateNames.length > 0, "fixture precondition: shipped templates must exist");
  const first = templateNames[0];
  fs.writeFileSync(path.join(agentsDir, first), "# a real installed subagent template\n");
  // A file that does NOT match any shipped template name must never appear.
  fs.writeFileSync(path.join(agentsDir, "my-own-agent.md"), "# not agc's\n");

  const r = runAgc(repo, ["eject"], { home });
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const expectedPath = path.join(agentsDir, first);
  assert.match(r.stdout, new RegExp(`Present:\\n\\s+${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n`));
  assert.doesNotMatch(r.stdout, /my-own-agent\.md/, "an adopter's own, non-shipped agent file must never be listed");
  assert.match(r.stdout, new RegExp(`rm ${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

// ---------------------------------------------------------------------------
// AC20 — eject never prompts, runs to completion with stdin closed
// ---------------------------------------------------------------------------
test("AC20: eject never prompts, runs to completion with stdin closed", () => {
  const repo = mkGitRepo("e108-ac20-");
  initWorkspace(repo, "local");
  for (const args of [["eject"], ["eject", "--yes"]]) {
    const r = spawnSync(process.execPath, [AGC_INIT, ...args], {
      cwd: repo,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"], // stdin explicitly closed
      env: { ...process.env, HOME: mkTmpHome() },
      timeout: 10000,
    });
    assert.equal(r.error, undefined, `must not error/hang for ${args.join(" ")}: ${r.error}`);
    assert.notEqual(r.status, null, `must not time out for ${args.join(" ")} (signal=${r.signal})`);
  }
});

// ---------------------------------------------------------------------------
// AC21 — an unknown flag is a usage error, exit 2, no changes
// ---------------------------------------------------------------------------
test("AC21: an unknown flag is a usage error, exit 2, no changes", () => {
  const repo = mkGitRepo("e108-ac21-");
  initWorkspace(repo, "local");
  const before = snapshotTree(repo);

  const r = runAgc(repo, ["eject", "--bogus-flag"]);
  assert.equal(r.status, 2, `stdout=${r.stdout} stderr=${r.stderr}`);
  assert.match(r.stderr, /agc eject: unknown option --bogus-flag/);
  assert.match(r.stderr, /Usage:/);
  assert.match(r.stderr, /eject \[--yes\] \[--purge-knowledge\]/);
  assert.deepEqual(snapshotTree(repo), before, "an unknown flag must make zero filesystem changes");
});

// ---------------------------------------------------------------------------
// AC24 — plan header reports the declared artifacts mode and the no-recovery note
// ---------------------------------------------------------------------------
test("AC24: plan header reports the declared artifacts mode and the no-recovery note", () => {
  const repo = mkGitRepo("e108-ac24-");
  initWorkspace(repo, "local");
  // .current/ stays untracked (-> DELETE, no-recovery note); tasks.md becomes
  // tracked despite the declared "local" mode (-> local-not-honoured note).
  // -f: local mode just excluded it via .git/info/exclude.
  git(repo, ["add", "-f", "tasks.md"]);
  git(repo, ["commit", "-q", "-m", "tasks.md tracked despite local mode"]);

  const r = runAgc(repo, ["eject"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /declared artifacts mode: local/);
  assert.match(r.stdout, /note: local mode was not in effect for the tracked path\(s\) listed below/);
  assert.match(r.stdout, /untracked paths marked DELETE have no git recovery — once deleted they are gone/);

  // repo mode: no local-not-honoured note (nothing to honour); still names the mode.
  const repo2 = mkGitRepo("e108-ac24b-");
  initWorkspace(repo2, "repo");
  const r2 = runAgc(repo2, ["eject"]);
  assert.equal(r2.status, 0);
  assert.match(r2.stdout, /declared artifacts mode: repo/);
  assert.doesNotMatch(r2.stdout, /local mode was not in effect/);
});

// ---------------------------------------------------------------------------
// AC25 — --yes refuses while linked worktrees exist; dry-run warns
// ---------------------------------------------------------------------------
test("AC25: --yes refuses while linked worktrees exist; dry-run warns", () => {
  const repo = mkGitRepoWithCommit("e108-ac25-");
  initWorkspace(repo, "local");
  const lane = mkTmp("e108-ac25-lane-");
  git(repo, ["worktree", "add", lane, "-b", "feat/e108-ac25"]);
  // git worktree list prints realpath'd paths (macOS: /var -> /private/var).
  const canonicalLane = fs.realpathSync(lane);

  const before = snapshotTree(repo);
  const rYes = runAgc(repo, ["eject", "--yes"]);
  assert.equal(rYes.status, 1, `stdout=${rYes.stdout} stderr=${rYes.stderr}`);
  assert.match(rYes.stderr, /agc eject: refusing --yes — linked worktree\(s\) still exist and would be stranded:/);
  assert.match(rYes.stderr, new RegExp(`^  ${canonicalLane.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.match(rYes.stderr, /Finish or remove them first \(agc feature finish\)\./);
  assert.deepEqual(snapshotTree(repo), before, "refusal must make zero filesystem changes");

  const rDry = runAgc(repo, ["eject"]);
  assert.equal(rDry.status, 0, `stderr=${rDry.stderr}`);
  assert.match(rDry.stderr, /warning: linked worktree\(s\) still exist and would be stranded:/);
  assert.match(rDry.stderr, new RegExp(`^  ${canonicalLane.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.match(rDry.stdout, /agc eject — plan for/, "dry-run still prints the plan after the warning");
});

// ---------------------------------------------------------------------------
// Tracked host-trace changes (integrator-accepted AC5 clarification, QA round
// 1 finding fixed in ceb3c4a) — cases A-D and G pinned per code-reviewer's
// round-2 recommendation (review_reports/review_T-E108-01.md, "Round 2").
// ---------------------------------------------------------------------------

// Case A: all three host-trace files tracked, CLAUDE.md block-only (whole
// file deleted).
test("tracked host-trace: all three tracked, CLAUDE.md block-only — listed as deleted", () => {
  const repo = mkGitRepo("e108-htA-");
  initWorkspace(repo, "local");
  git(repo, ["add", "CLAUDE.md", "AGENTS.md", ".antigravityrules"]);
  git(repo, ["commit", "-q", "-m", "tracked host traces"]);

  const rDry = runAgc(repo, ["eject"]);
  assert.equal(rDry.status, 0, `stderr=${rDry.stderr}`);
  assert.match(rDry.stdout, /will change tracked file\(s\) — uncommitted until you commit:/);
  assert.match(rDry.stdout, /^  CLAUDE\.md \(deleted\)$/m, `stdout=${rDry.stdout}`);
  assert.match(rDry.stdout, /^  AGENTS\.md \(deleted\)$/m);
  assert.match(rDry.stdout, /^  \.antigravityrules \(deleted\)$/m);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(
    r.stdout,
    /Tracked host-trace file\(s\) were changed in the working tree — this is uncommitted; review and commit it yourself:\n/,
  );
  assert.match(r.stdout, /^  CLAUDE\.md \(deleted\)$/m);
  assert.match(r.stdout, /^  AGENTS\.md \(deleted\)$/m);
  assert.match(r.stdout, /^  \.antigravityrules \(deleted\)$/m);

  const status = gitStatusShort(repo).sort();
  assert.deepEqual(status, [" D .antigravityrules", " D AGENTS.md", " D CLAUDE.md"]);
});

// Case B: tracked CLAUDE.md with adopter prose (edit-in-place branch).
test("tracked host-trace: tracked CLAUDE.md with prose — listed as edited", () => {
  const repo = mkGitRepo("e108-htB-");
  initWorkspace(repo, "local");
  const original = fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8");
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), "# prose\n\n" + original);
  git(repo, ["add", "CLAUDE.md", "AGENTS.md", ".antigravityrules"]);
  git(repo, ["commit", "-q", "-m", "tracked CLAUDE.md with prose"]);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /^  CLAUDE\.md \(edited\)$/m, `stdout=${r.stdout}`);
  assert.match(r.stdout, /^  AGENTS\.md \(deleted\)$/m);
  assert.match(r.stdout, /^  \.antigravityrules \(deleted\)$/m);

  const status = gitStatusShort(repo).sort();
  assert.deepEqual(status, [" D .antigravityrules", " D AGENTS.md", " M CLAUDE.md"]);
  assert.match(fs.readFileSync(path.join(repo, "CLAUDE.md"), "utf-8"), /^# prose\n/);
});

// Case C: everything untracked — no uncommitted-change list at all.
test("tracked host-trace: untracked host-trace files — no uncommitted-change list printed", () => {
  const repo = mkGitRepo("e108-htC-");
  initWorkspace(repo, "local"); // never git add'd
  for (const args of [["eject"], ["eject", "--yes"]]) {
    const r = runAgc(repo, args);
    assert.equal(r.status, 0, `args=${args.join(" ")} stderr=${r.stderr}`);
    assert.doesNotMatch(r.stdout, /uncommitted/i, `args=${args.join(" ")}`);
    assert.doesNotMatch(r.stdout, /will change tracked file/);
  }
});

// Case D: subdirectory workspace, tracked — subdir-prefixed display paths.
test("tracked host-trace: subdirectory workspace — uncommitted list uses subdir-prefixed paths", () => {
  const repo = mkGitRepo("e108-htD-");
  const sub = path.join(repo, "sub");
  fs.mkdirSync(sub, { recursive: true });
  initWorkspace(sub, "local");
  git(repo, ["add", "sub/CLAUDE.md", "sub/AGENTS.md", "sub/.antigravityrules"]);
  git(repo, ["commit", "-q", "-m", "tracked sub host traces"]);

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /^  sub\/CLAUDE\.md \(deleted\)$/m, `stdout=${r.stdout}`);
  assert.match(r.stdout, /^  sub\/AGENTS\.md \(deleted\)$/m);
  assert.match(r.stdout, /^  sub\/\.antigravityrules \(deleted\)$/m);
  assert.doesNotMatch(r.stdout, /^  CLAUDE\.md \(deleted\)$/m, "must never print the un-prefixed display form");
});

// Case G: no-op branches (no block found; a non-matching adapter file KEPT)
// never leak into the tracked-change list — only the one file that actually
// changed appears.
test("tracked host-trace: no-op branches (no block, KEPT-advisory) never appear in the change list", () => {
  const repo = mkGitRepo("e108-htG-");
  initWorkspace(repo, "local");
  // CLAUDE.md tracked but with the marker block stripped out (no-op branch).
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), "# plain notes, no agc block\n");
  // AGENTS.md tracked but edited beyond the template (KEPT-advisory branch).
  fs.appendFileSync(path.join(repo, "AGENTS.md"), "\n# adopter addition\n");
  // .antigravityrules tracked and still template-identical (the one real change).
  git(repo, ["add", "CLAUDE.md", "AGENTS.md", ".antigravityrules"]);
  git(repo, ["commit", "-q", "-m", "mixed host-trace states"]);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /^  \.antigravityrules \(deleted\)$/m, `stdout=${r.stdout}`);
  assert.doesNotMatch(r.stdout, /^  CLAUDE\.md \(/m, "the no-block no-op must not appear in the change list");
  assert.doesNotMatch(r.stdout, /^  AGENTS\.md \(/m, "the KEPT-advisory file must not appear in the change list");

  const status = gitStatusShort(repo);
  assert.deepEqual(status, [" D .antigravityrules"]);
});

// ---------------------------------------------------------------------------
// git rm -r line forms: root (no qualifier) vs subdirectory (qualifier)
// ---------------------------------------------------------------------------
test("git rm -r line: root workspace never prints the subdirectory qualifier (see AC5/AC6)", () => {
  // Covered directly by AC5 and AC6 above; this test only pins the negative
  // assertion as its own named case per this file's dispatch brief.
  const repo = mkGitRepoWithCommit("e108-gitrmroot-");
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".current", ".config.json"),
    JSON.stringify({ schema_version: 2, host: "claude-code" }, null, 2) + "\n",
  );
  fs.writeFileSync(path.join(repo, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "tasks.md"]);
  git(repo, ["commit", "-q", "-m", "tracked tasks.md at root"]);
  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stderr, /git rm -r tasks\.md\b/);
  assert.doesNotMatch(r.stderr, /run from the repository root/);
});

test("git rm -r line: subdirectory workspace includes the repository-root qualifier", () => {
  const repo = mkGitRepoWithCommit("e108-gitrmsub-");
  const sub = path.join(repo, "sub");
  fs.mkdirSync(sub, { recursive: true });
  fs.mkdirSync(path.join(sub, ".current"), { recursive: true });
  fs.writeFileSync(
    path.join(sub, ".current", ".config.json"),
    JSON.stringify({ schema_version: 2, host: "claude-code" }, null, 2) + "\n",
  );
  fs.writeFileSync(path.join(sub, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "sub/tasks.md"]);
  git(repo, ["commit", "-q", "-m", "tracked sub/tasks.md"]);

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stderr, /Remove them \(from the index and the working tree\) with \(run from the repository root\):/);
  assert.match(r.stderr, /git rm -r sub\/tasks\.md\b/);
});

// ---------------------------------------------------------------------------
// Boundary / security smoke (SOP Phase 3d — always included)
// ---------------------------------------------------------------------------
test("boundary: an empty-string argument is an unknown-option usage error", () => {
  const repo = mkGitRepo("e108-boundary-empty-");
  initWorkspace(repo, "local");
  const before = snapshotTree(repo);
  const r = runAgc(repo, ["eject", ""]);
  assert.equal(r.status, 2, `stderr=${r.stderr}`);
  assert.match(r.stderr, /agc eject: unknown option/);
  assert.deepEqual(snapshotTree(repo), before);
});

test("boundary: a very long garbage flag is rejected cleanly, no crash or hang", () => {
  const repo = mkGitRepo("e108-boundary-long-");
  initWorkspace(repo, "local");
  const garbage = "--" + "x".repeat(5000);
  const r = runAgc(repo, ["eject", garbage]);
  assert.equal(r.status, 2, `stderr length=${r.stderr.length}`);
  assert.match(r.stderr, /agc eject: unknown option/);
});

test("boundary: a flag-shaped argument carrying embedded whitespace/newlines is rejected, not parsed as a real flag", () => {
  const repo = mkGitRepo("e108-boundary-ws-");
  initWorkspace(repo, "local");
  const before = snapshotTree(repo);
  const r = runAgc(repo, ["eject", "--yes\n--purge-knowledge"]);
  assert.equal(r.status, 2, `stderr=${r.stderr}`);
  assert.match(r.stderr, /agc eject: unknown option/);
  assert.deepEqual(snapshotTree(repo), before, "a malformed combined flag must never be silently accepted");
});

// N/A: auth/permission boundary tests — agc eject has no access-control
// surface (a local CLI acting on the invoking user's own working tree; see
// this file's header comment).

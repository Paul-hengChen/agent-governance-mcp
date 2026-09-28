// Coded by @qa-engineer
// Tests for specs/e73-agc-feature-lifecycle.md AC1-AC29 (+ AC-QA-1, §6
// secrets) — `agc feature start` / `agc feature finish` in bin/agc-init.mjs.
//
// Every scratch repo is a real git repository built under os.tmpdir() via
// fs.mkdtempSync and torn down in the top-level `after` hook — never inside
// this checkout or the lane worktree it runs from (§2.5). `agc feature`
// dynamically imports THIS project's own dist/tools/lane-paths.js (relative
// to bin/agc-init.mjs's own location, not cwd), so pointing it at a scratch
// repo elsewhere exercises the real code path without touching this repo's
// tracked state.
//
// Spec-to-test map:
//   AC1  -> "AC1: agc feature start creates branch + worktree, exit 0"
//   AC2  -> "AC2: agc feature start refuses from inside a linked worktree"
//   AC3  -> "AC3: printed lane id equals an independently-derived resolveCurrentLane"
//   AC4  -> "AC4: a slug with no leading ticket id is rejected before any git mutation"
//   AC5  -> "AC5: default --path is <dirname(repoRoot)>/<basename(repoRoot)>-lanes/<id>"
//   AC6  -> "AC6: existing branch / existing path / registered-but-missing worktree all refuse cleanly"
//   AC7  -> "AC7: agc feature start never rewrites the lane's tracked CLAUDE.md"
//   AC8  -> "AC8: git status --porcelain is empty immediately after start"
//   AC9  -> "AC9: node_modules is a symlink, resolves a primary-only dep, zero npm install" /
//           "AC9: missing primary node_modules still succeeds, with a warning"
//   AC10 -> "AC10: .env is byte-copied and its secret never reaches stdout/stderr" /
//           "AC10: no primary .env means no lane .env and no error"
//   AC11 -> "AC11: .env exclude upsert is idempotent across two starts"
//   AC12 -> "AC12: /node_modules exclude upsert is idempotent and unconditional"
//   AC13 -> "AC13: a pathological node_modules/ .gitignore still yields a clean status and a force-free finish"
//   AC14 -> "AC14: stdout carries the shared-node_modules warning right after the symlink"
//   AC15 -> "AC15: finish never deletes primary's real node_modules through the lane's symlink"
//   AC16 -> "AC16: finish --shipped on an unmerged branch fails and touches nothing"
//   AC17 -> "AC17: finish --shipped on a merged branch removes the worktree and deletes the branch"
//   AC18 -> "AC18: finish refuses from inside any linked worktree, including the target"
//   AC19 -> "AC19: finish --shipped on a dirty worktree fails with git's own error and removes nothing"
//   AC20 -> "AC20: finish --abandoned succeeds on an unmerged branch (no merge guard)"
//   AC21 -> "AC21: --abandoned precondition refuses on an unrelated dirty file, then succeeds after it's resolved"
//   AC22 -> "AC22/AC23/AC24: bounded-token evidence move, commit, and the untracked rough edge" (combined fixture)
//   AC23 -> same test, plus "AC23: zero tracked evidence matched means no new commit (no-op case)"
//   AC24 -> covered in the AC22 combined test
//   AC25 -> "AC25: --abandoned never touches specs/"
//   AC26 -> "AC26: an all-tracked-evidence --abandoned run keeps the branch and drops the worktree"
//   AC27 -> "AC27: docs/install.md documents both commands per the spec's required list"
//   AC28 -> "AC28: docs/install.md states the .env-never-read-into-output guarantee"
//   AC29 -> "AC29: the two retargeted comments read the lane-scoped path; .config.json mentions untouched"
//   §6/AC-QA-1 -> folded into the AC10 dummy-secret test
//   Security smoke -> "boundary:" tests at the end (empty slug, --base option
//     injection, shell-metacharacter slug, oversized slug)
//
// Mechanical fallout (not a new AC, sr-engineer's expected-red manifest,
// qa_reports/expected-red_e73-agc-feature-lifecycle.txt): this file does NOT
// touch test/lane-paths.test.mjs — that allow-list update is a separate edit
// in the same task, verified by "CALLERS2/CALLERS3 allow-list" assertions
// re-run as part of the full suite gate, not duplicated here.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const LANE_PATHS_DIST_URL = pathToFileURL(path.join(PROJECT_ROOT, "dist", "tools", "lane-paths.js")).href;

// Dummy secret for AC10/AC-QA-1 — a QA-authored sentinel, never a real secret.
const DUMMY_ENV_CONTENT = "DUMMY_KEY=placeholder-value-e73-qa-sentinel\n";
const DUMMY_SENTINEL = "placeholder-value-e73-qa-sentinel";

// ---------------------------------------------------------------------------
// Cleanup registry — every mkTmp() call registers its dir here; the single
// `after` hook removes them all, even if an individual test fails midway.
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
// git helpers (test-side only — the CLI under test is exercised as a black
// box via runAgc; these are for scratch-repo setup/assertion).
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
function worktreePaths(repoRoot) {
  const out = git(repoRoot, ["worktree", "list", "--porcelain"]);
  return out
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

// Build a scratch primary repo: `git init -b main`, local identity (never
// relies on ambient global git config), one commit on main.
function makePrimaryRepo(opts = {}) {
  const repo = mkTmp("agc-feature-primary-");
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  if (opts.gitignore !== undefined) {
    fs.writeFileSync(path.join(repo, ".gitignore"), opts.gitignore);
  }
  if (opts.claudeMd !== undefined) {
    fs.writeFileSync(path.join(repo, "CLAUDE.md"), opts.claudeMd);
  }
  fs.writeFileSync(path.join(repo, "README.md"), "# scratch fixture\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "init"]);
  if (opts.nodeModules) {
    const dep = path.join(repo, "node_modules", "agc-fixture-dep");
    fs.mkdirSync(dep, { recursive: true });
    fs.writeFileSync(path.join(dep, "package.json"), JSON.stringify({ name: "agc-fixture-dep", main: "index.js" }));
    fs.writeFileSync(path.join(dep, "index.js"), "module.exports = 'fixture';\n");
  }
  if (opts.env !== undefined) {
    fs.writeFileSync(path.join(repo, ".env"), opts.env);
  }
  return repo;
}

function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
}

function runAgcCheck(cwd) {
  return spawnSync(process.execPath, [AGC_INIT, "check"], { cwd, encoding: "utf-8" });
}

// ---------------------------------------------------------------------------
// E179 helpers — finish-time pending-ticket allocation (specs/e179-*.md).
// ---------------------------------------------------------------------------

// Seeds docs/backlog.md with a real ticket-table header + the given rows
// (default: a single `E1` seed row) and commits it, so extractMaxBacklogId
// has a known, non-zero starting point in every E179 fixture.
function seedBacklog(repo, rows = ["| E1 | seed ticket | P2 | none | — | — |"]) {
  fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
  const body =
    "# Backlog\n\n" +
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|----|------|----------|------------|------------|-------------|\n" +
    rows.join("\n") +
    "\n";
  fs.writeFileSync(path.join(repo, "docs", "backlog.md"), body);
  git(repo, ["add", "docs/backlog.md"]);
  git(repo, ["commit", "-m", "seed backlog"]);
}

// One well-formed `pending-ticket` fenced block (E124's format).
function pendingBlock(laneLocalId, title, priority = "P2", extra = "") {
  return `\`\`\`pending-ticket\nlane_local_id: ${laneLocalId}\ntitle: ${title}\npriority: ${priority}\n${extra}\`\`\`\n`;
}

function writePendingTickets(lanePath, lane, blocksText) {
  const dir = path.join(lanePath, ".current", lane);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "pending-tickets.md"), blocksText);
}

function commitPendingTickets(lanePath, lane, message = "file a finding") {
  git(lanePath, ["add", `.current/${lane}/pending-tickets.md`]);
  git(lanePath, ["commit", "-m", message]);
}

// A real (non-fast-forward) merge commit — works whether or not a
// fast-forward is possible, so it is safe to reuse across a sequence of
// lanes (AC4) as well as a single one.
function mergeLane(repo, branch) {
  git(repo, ["merge", "--no-ff", "-m", `merge ${branch}`, branch]);
}

function readInfoExclude(repoRoot) {
  const p = path.join(repoRoot, ".git", "info", "exclude");
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}
function excludeLineCount(content, line) {
  return content.split(/\r?\n/).filter((l) => l.trim() === line).length;
}

// ===========================================================================
// agc feature start
// ===========================================================================

test("AC1: agc feature start creates branch + worktree, exit 0", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane1-"), "lane");
  const r = runAgc(repo, ["start", "e2e-test-lane", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(branchExists(repo, "feat/e2e-test-lane"), "branch feat/e2e-test-lane must exist");
  assert.ok(fs.existsSync(lane), "lane worktree directory must exist");
  assert.ok(
    worktreePaths(repo).some((p) => fs.realpathSync(p) === fs.realpathSync(lane)),
    "lane must be registered as a git worktree",
  );
});

test("AC2: agc feature start refuses from inside a linked worktree, creates nothing", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane2-"), "lane");
  const start = runAgc(repo, ["start", "e2b-first", "--path", lane]);
  assert.equal(start.status, 0);

  const other = path.join(mkTmp("agc-feature-lane2b-"), "other");
  const r = runAgc(lane, ["start", "e2c-second", "--path", other]);
  assert.notEqual(r.status, 0, "must refuse from inside a linked worktree");
  assert.match(r.stderr, /primary checkout/i);
  assert.ok(!branchExists(repo, "feat/e2c-second"), "no branch must be created");
  assert.ok(!fs.existsSync(other), "no directory must be created");
});

test("AC3: printed lane id equals an independently-derived resolveCurrentLane", async () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane3-"), "lane");
  const r = runAgc(repo, ["start", "e3x-lane-check", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const printed = r.stdout.trim().split("\n").pop();
  assert.match(printed, /^lane: /);
  const printedLane = printed.slice("lane: ".length);

  // Independent derivation, fresh process/import, no reuse of anything the
  // CLI computed — proves there is no second, possibly-diverging naming
  // scheme (spec's own AC3 wording).
  const mod = await import(LANE_PATHS_DIST_URL);
  const derived = mod.resolveCurrentLane(lane);
  assert.equal(printedLane, derived);
  assert.equal(printedLane, "e3x");
});

test("AC4: a slug with no leading ticket id is rejected before any git mutation", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane4-"), "lane");
  const r = runAgc(repo, ["start", "no-ticket-id-here", "--path", lane]);
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(lane), "no directory must be created");
  assert.ok(!branchExists(repo, "feat/no-ticket-id-here"), "no branch must be created");
});

test("AC5: default --path is <dirname(repoRoot)>/<basename(repoRoot)>-lanes/<ticket-id>", () => {
  const repo = makePrimaryRepo();
  const expected = path.join(path.dirname(repo), `${path.basename(repo)}-lanes`, "e5x");
  try {
    const r = runAgc(repo, ["start", "e5x-default-path"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.ok(fs.existsSync(expected), `expected default lane path ${expected} to exist`);
    assert.ok(
      worktreePaths(repo).some((p) => fs.realpathSync(p) === fs.realpathSync(expected)),
    );
  } finally {
    // Test hygiene only — --force here is cleanup, not an assertion on the
    // tool's own (never-force) removal behavior.
    gitTry(repo, ["worktree", "remove", "--force", expected]);
    fs.rmSync(path.dirname(expected), { recursive: true, force: true });
  }
});

test("AC6: an already-existing branch refuses and creates nothing new", () => {
  const repo = makePrimaryRepo();
  git(repo, ["branch", "feat/e6a-dup"]);
  const lane = path.join(mkTmp("agc-feature-lane6a-"), "lane");
  const r = runAgc(repo, ["start", "e6a-dup", "--path", lane]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists/i);
  assert.ok(!fs.existsSync(lane), "no directory must be created");
});

test("AC6: an already-existing target path refuses and creates nothing new", () => {
  const repo = makePrimaryRepo();
  const laneParent = mkTmp("agc-feature-lane6b-");
  const lane = path.join(laneParent, "taken");
  fs.mkdirSync(lane);
  fs.writeFileSync(path.join(lane, "sentinel.txt"), "pre-existing\n");
  const r = runAgc(repo, ["start", "e6b-taken", "--path", lane]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists/i);
  assert.ok(!branchExists(repo, "feat/e6b-taken"), "no branch must be created");
  assert.equal(fs.readFileSync(path.join(lane, "sentinel.txt"), "utf-8"), "pre-existing\n");
});

test("AC6: a registered-but-missing worktree path refuses (git worktree prune case), creates no branch", () => {
  const repo = makePrimaryRepo();
  const laneParent = mkTmp("agc-feature-lane6c-");
  const lane = path.join(laneParent, "ghost");
  // Register a worktree under a DIFFERENT branch name so it never collides
  // with the branch-exists check below, isolating the third AC6 clause.
  git(repo, ["worktree", "add", "-b", "other-branch-6c", lane]);
  fs.rmSync(lane, { recursive: true, force: true }); // dir gone, still registered
  const r = runAgc(repo, ["start", "e6c-ghost", "--path", lane]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /registered as a git worktree/i);
  assert.ok(!branchExists(repo, "feat/e6c-ghost"), "no branch must be created");
});

test("AC7: agc feature start never rewrites the lane's tracked CLAUDE.md", () => {
  const sentinel = "# CLAUDE.md sentinel — not an agc stamp block\n";
  const repo = makePrimaryRepo({ claudeMd: sentinel });
  const lane = path.join(mkTmp("agc-feature-lane7-"), "lane");
  const r = runAgc(repo, ["start", "e7x-claude-untouched", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.equal(fs.readFileSync(path.join(lane, "CLAUDE.md"), "utf-8"), sentinel);
});

test("AC8: git status --porcelain is empty immediately after start", () => {
  const repo = makePrimaryRepo({ nodeModules: true, env: DUMMY_ENV_CONTENT });
  const lane = path.join(mkTmp("agc-feature-lane8-"), "lane");
  const r = runAgc(repo, ["start", "e8x-clean-status", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.equal(git(lane, ["status", "--porcelain"]).trim(), "");
});

// ---------------------------------------------------------------------------
// Env bootstrap (AC9-AC15)
// ---------------------------------------------------------------------------

test("AC9: node_modules is a symlink, resolves a primary-only dep, zero npm install run", () => {
  const repo = makePrimaryRepo({ nodeModules: true });
  const lane = path.join(mkTmp("agc-feature-lane9-"), "lane");
  const r = runAgc(repo, ["start", "e9x-nm-link", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const laneNm = path.join(lane, "node_modules");
  const st = fs.lstatSync(laneNm);
  assert.ok(st.isSymbolicLink(), "lane node_modules must be a symlink, not a copy");
  assert.equal(fs.realpathSync(laneNm), fs.realpathSync(path.join(repo, "node_modules")));

  const resolve = spawnSync(process.execPath, ["-e", "process.stdout.write(require.resolve('agc-fixture-dep'))"], {
    cwd: lane,
    encoding: "utf-8",
  });
  assert.equal(resolve.status, 0, `require.resolve failed: ${resolve.stderr}`);
  assert.match(resolve.stdout, /agc-fixture-dep/);
});

test("AC9: missing primary node_modules still succeeds, with a warning, lane still created", () => {
  const repo = makePrimaryRepo(); // no nodeModules
  const lane = path.join(mkTmp("agc-feature-lane9b-"), "lane");
  const r = runAgc(repo, ["start", "e9y-no-nm", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stderr, /npm install/i);
  assert.ok(fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e9y-no-nm"));
});

test("AC10: .env is byte-copied and its secret never reaches stdout/stderr", () => {
  const repo = makePrimaryRepo({ env: DUMMY_ENV_CONTENT });
  const lane = path.join(mkTmp("agc-feature-lane10-"), "lane");
  const r = runAgc(repo, ["start", "e10x-env-copy", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const laneEnv = fs.readFileSync(path.join(lane, ".env"));
  const primaryEnv = fs.readFileSync(path.join(repo, ".env"));
  assert.ok(laneEnv.equals(primaryEnv), ".env must be byte-identical");
  assert.ok(!r.stdout.includes(DUMMY_SENTINEL), "stdout must never contain the .env secret");
  assert.ok(!r.stderr.includes(DUMMY_SENTINEL), "stderr must never contain the .env secret");
});

test("AC10: no primary .env means no lane .env and no error", () => {
  const repo = makePrimaryRepo(); // no env
  const lane = path.join(mkTmp("agc-feature-lane10b-"), "lane");
  const r = runAgc(repo, ["start", "e10y-no-env", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(!fs.existsSync(path.join(lane, ".env")));
});

test("AC11: .env exclude upsert is idempotent across two starts", () => {
  const repo = makePrimaryRepo({ env: DUMMY_ENV_CONTENT });
  const laneA = path.join(mkTmp("agc-feature-lane11a-"), "lane");
  const laneB = path.join(mkTmp("agc-feature-lane11b-"), "lane");
  assert.equal(runAgc(repo, ["start", "e11a-first", "--path", laneA]).status, 0);
  assert.equal(excludeLineCount(readInfoExclude(repo), ".env"), 1);
  assert.equal(runAgc(repo, ["start", "e11b-second", "--path", laneB]).status, 0);
  assert.equal(excludeLineCount(readInfoExclude(repo), ".env"), 1, "must not duplicate the .env exclude line");
});

test("AC12: /node_modules exclude upsert is idempotent and unconditional", () => {
  const repo = makePrimaryRepo({ nodeModules: true });
  const laneA = path.join(mkTmp("agc-feature-lane12a-"), "lane");
  const laneB = path.join(mkTmp("agc-feature-lane12b-"), "lane");
  assert.equal(runAgc(repo, ["start", "e12a-first", "--path", laneA]).status, 0);
  assert.equal(excludeLineCount(readInfoExclude(repo), "/node_modules"), 1);
  assert.equal(runAgc(repo, ["start", "e12b-second", "--path", laneB]).status, 0);
  assert.equal(excludeLineCount(readInfoExclude(repo), "/node_modules"), 1);
});

test("AC13: a pathological node_modules/ .gitignore still yields a clean status and a force-free finish", () => {
  const repo = makePrimaryRepo({ nodeModules: true, gitignore: "node_modules/\n" });
  const lane = path.join(mkTmp("agc-feature-lane13-"), "lane");
  const start = runAgc(repo, ["start", "e13x-pathological", "--path", lane]);
  assert.equal(start.status, 0, `stderr=${start.stderr}`);
  assert.equal(git(lane, ["status", "--porcelain"]).trim(), "", "AC8 must hold even against this .gitignore");

  const finish = runAgc(repo, ["finish", "e13x", "--shipped"]);
  assert.equal(finish.status, 0, `stderr=${finish.stderr}`);
  assert.ok(!fs.existsSync(lane));
});

test("AC14: stdout carries the shared-node_modules warning right after the symlink line", () => {
  const repo = makePrimaryRepo({ nodeModules: true });
  const lane = path.join(mkTmp("agc-feature-lane14-"), "lane");
  const r = runAgc(repo, ["start", "e14x-warning", "--path", lane]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const lines = r.stdout.split("\n");
  const linkIdx = lines.findIndex((l) => l.includes("linked node_modules"));
  assert.notEqual(linkIdx, -1, "expected a 'linked node_modules' stdout line");
  const warningLine = lines[linkIdx + 1] ?? "";
  assert.match(warningLine, /npm ci/);
  assert.match(warningLine, /npm install/);
  assert.match(warningLine, /node_modules is shared/);
  assert.match(warningLine, /rm node_modules/);
});

test("AC15: finish never deletes primary's real node_modules through the lane's symlink (shipped + abandoned)", () => {
  for (const [flag, slug] of [["--shipped", "e15a-shipped"], ["--abandoned", "e15b-abandoned"]]) {
    const repo = makePrimaryRepo({ nodeModules: true });
    const lane = path.join(mkTmp("agc-feature-lane15-"), "lane");
    assert.equal(runAgc(repo, ["start", slug, "--path", lane]).status, 0);
    const ticketId = slug.split("-")[0];
    const finish = runAgc(repo, ["finish", ticketId, flag]);
    assert.equal(finish.status, 0, `${flag} stderr=${finish.stderr}`);
    const depFile = path.join(repo, "node_modules", "agc-fixture-dep", "index.js");
    assert.ok(fs.existsSync(depFile), `${flag}: primary node_modules content must survive`);
    assert.equal(fs.readFileSync(depFile, "utf-8"), "module.exports = 'fixture';\n");
  }
});

// ===========================================================================
// agc feature finish
// ===========================================================================

test("AC16: finish --shipped on an unmerged branch fails and touches nothing", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane16-"), "lane");
  assert.equal(runAgc(repo, ["start", "e16x-unmerged", "--path", lane]).status, 0);
  fs.writeFileSync(path.join(lane, "extra.txt"), "diverge\n");
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "diverge from main"]);

  const r = runAgc(repo, ["finish", "e16x", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--abandoned|merge/i);
  assert.ok(fs.existsSync(lane), "worktree must be left untouched");
  assert.ok(branchExists(repo, "feat/e16x-unmerged"), "branch must be left untouched");
});

test("AC17: finish --shipped on a merged branch removes the worktree and deletes the branch", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane17-"), "lane");
  assert.equal(runAgc(repo, ["start", "e17x-merged", "--path", lane]).status, 0);
  // No divergent commits: the branch is trivially an ancestor of main.
  const r = runAgc(repo, ["finish", "e17x", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(
    !worktreePaths(repo).some((p) => p === lane || (fs.existsSync(p) && fs.realpathSync(p) === lane)),
  );
  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e17x-merged"));
});

test("AC18: finish refuses from inside any linked worktree, including the target", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane18-"), "lane");
  assert.equal(runAgc(repo, ["start", "e18x-target", "--path", lane]).status, 0);
  const r = runAgc(lane, ["finish", "e18x", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /primary checkout/i);
  assert.ok(fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e18x-target"));
});

test("AC19: finish --shipped on a dirty worktree fails with git's own error and removes nothing", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane19-"), "lane");
  assert.equal(runAgc(repo, ["start", "e19x-dirty", "--path", lane]).status, 0);
  fs.writeFileSync(path.join(lane, "README.md"), "dirty edit, never committed\n");

  const r = runAgc(repo, ["finish", "e19x", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /modified or untracked/i);
  assert.ok(fs.existsSync(lane), "nothing must be removed");
  assert.ok(branchExists(repo, "feat/e19x-dirty"));
});

test("AC20: finish --abandoned succeeds on an unmerged branch (no merge guard)", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane20-"), "lane");
  assert.equal(runAgc(repo, ["start", "e20x-unmerged-ok", "--path", lane]).status, 0);
  fs.writeFileSync(path.join(lane, "extra.txt"), "diverge\n");
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "diverge from main"]);

  const r = runAgc(repo, ["finish", "e20x", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(!fs.existsSync(lane));
  assert.ok(branchExists(repo, "feat/e20x-unmerged-ok"), "abandoned keeps the branch");
});

test("AC21: --abandoned precondition refuses on an unrelated dirty file, then succeeds once resolved", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane21-"), "lane");
  assert.equal(runAgc(repo, ["start", "e21x-precondition", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E21X-01.md"), "evidence\n");
  // Evidence is TRACKED so the second run (after the unrelated change is
  // discarded) can cleanly succeed via git mv + commit — isolating the
  // precondition itself from AC24's separate untracked-leftover rough edge.
  git(lane, ["add", "qa_reports/review_T-E21X-01.md"]);
  git(lane, ["commit", "-m", "add evidence"]);
  fs.writeFileSync(path.join(lane, "README.md"), "unrelated uncommitted change\n");

  const first = runAgc(repo, ["finish", "e21x", "--abandoned"]);
  assert.notEqual(first.status, 0);
  assert.match(first.stderr, /README\.md/);
  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "review_T-E21X-01.md")), "nothing must be moved");
  assert.ok(fs.existsSync(lane), "worktree must remain");

  git(lane, ["checkout", "--", "README.md"]); // discard the unrelated change
  const second = runAgc(repo, ["finish", "e21x", "--abandoned"]);
  assert.equal(second.status, 0, `stderr=${second.stderr}`);
  assert.ok(!fs.existsSync(lane), "all-tracked evidence means the worktree remove must succeed");
});

test("AC22/AC23/AC24: bounded-token evidence move, tracked commit, and the untracked worktree-remove rough edge", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane22-"), "lane");
  assert.equal(runAgc(repo, ["start", "e22x-evidence", "--path", lane]).status, 0);

  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.mkdirSync(path.join(lane, "review_reports"), { recursive: true });
  // Tracked match — committed before finish runs.
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E22X-01.md"), "tracked evidence\n");
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "add tracked evidence"]);
  // Untracked match.
  fs.writeFileSync(path.join(lane, "review_reports", "review_T-E22X-02.md"), "untracked evidence\n");
  // Similarly-named DIFFERENT ticket (e22x0) — bounded-token match must
  // leave this alone (mirrors the spec's e73 vs e730 example).
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E22X0-01.md"), "different ticket\n");
  git(lane, ["add", "qa_reports/review_T-E22X0-01.md"]);
  git(lane, ["commit", "-m", "add decoy evidence"]);

  const r = runAgc(repo, ["finish", "e22x", "--abandoned"]);
  // AC24: the untracked move leaves a `??` entry behind, so the same run's
  // `git worktree remove` refuses — surfaced verbatim, never --forced.
  assert.notEqual(r.status, 0, "worktree remove must refuse because of the lingering untracked move");
  assert.match(r.stderr, /modified or untracked/i);
  assert.match(r.stdout, /moved qa_reports\/review_T-E22X-01\.md -> qa_reports\/abandoned\/e22x\//);
  assert.match(r.stdout, /moved review_reports\/review_T-E22X-02\.md -> review_reports\/abandoned\/e22x\//);

  // Decoy untouched.
  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "review_T-E22X0-01.md")));
  // Tracked moved to abandoned/.
  assert.ok(fs.existsSync(path.join(lane, "qa_reports", "abandoned", "e22x", "review_T-E22X-01.md")));
  // Untracked moved to abandoned/, still untracked (??) at the new path.
  const movedUntracked = path.join(lane, "review_reports", "abandoned", "e22x", "review_T-E22X-02.md");
  assert.ok(fs.existsSync(movedUntracked));
  // --untracked-files=all (matching the production precondition's own git
  // status invocation) reports the file itself, not the containing untracked
  // directory as a single collapsed entry.
  const status = git(lane, ["status", "--porcelain", "--untracked-files=all"]);
  assert.match(status, /\?\? review_reports\/abandoned\/e22x\/review_T-E22X-02\.md/);

  // AC23: tracked evidence was committed on the branch.
  const stat = git(repo, ["show", "--stat", "--no-renames", "refs/heads/feat/e22x-evidence"]);
  assert.match(stat, /qa_reports\/abandoned\/e22x\/review_T-E22X-01\.md/);
  const log = git(repo, ["log", "-1", "--format=%s", "refs/heads/feat/e22x-evidence"]);
  assert.match(log, /^chore\(lane\): abandon e22x/);

  // Worktree still registered (remove refused) — clean up manually so later
  // tests never depend on this repo's residual state.
  gitTry(repo, ["worktree", "remove", "--force", lane]);
});

test("AC23: zero tracked evidence matched means no new commit (no-op case)", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane23-"), "lane");
  assert.equal(runAgc(repo, ["start", "e23x-noop", "--path", lane]).status, 0);
  const before = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e23x-noop"]);

  const r = runAgc(repo, ["finish", "e23x", "--abandoned"]);
  // No evidence at all -> nothing to move, worktree remove succeeds cleanly.
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(!fs.existsSync(lane));
  const after = git(repo, ["log", "-1", "--format=%H", "refs/heads/feat/e23x-noop"]);
  assert.equal(before, after, "git log must be unchanged when nothing was disposed");
});

test("AC25: --abandoned never touches specs/", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane25-"), "lane");
  assert.equal(runAgc(repo, ["start", "e25x-specs", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, "specs"), { recursive: true });
  fs.writeFileSync(path.join(lane, "specs", "e25x-specs.md"), "spec content\n");
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "add spec"]);

  const r = runAgc(repo, ["finish", "e25x", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(!fs.existsSync(lane), "clean, all-tracked-evidence-free run removes the worktree");
  const specContent = git(repo, ["show", "refs/heads/feat/e25x-specs:specs/e25x-specs.md"]);
  assert.equal(specContent, "spec content\n", "specs/ must be untouched, still at its original path");
});

test("AC26: an all-tracked-evidence --abandoned run keeps the branch and drops the worktree", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-lane26-"), "lane");
  assert.equal(runAgc(repo, ["start", "e26x-clean-abandon", "--path", lane]).status, 0);
  fs.mkdirSync(path.join(lane, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(lane, "qa_reports", "review_T-E26X-01.md"), "tracked only\n");
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "add tracked evidence"]);

  const r = runAgc(repo, ["finish", "e26x", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(!fs.existsSync(lane));
  assert.ok(
    !worktreePaths(repo).some((p) => fs.existsSync(p) && fs.realpathSync(p) === lane),
    "git worktree list must no longer show the lane",
  );
  assert.ok(branchExists(repo, "feat/e26x-clean-abandon"), "branch must be kept");
});

// ===========================================================================
// E179 — finish-time pending-ticket allocation (specs/e179-ticket-allocation-
// wiring.md AC2-AC5, the G1-G4 preconditions, and the error-refusal gate).
// AC1/AC6/AC7/AC9/AC10 are covered elsewhere (test/lane-paths.test.mjs,
// test/lane-ticket-allocation.test.mjs, test/lane-migrate.test.mjs) — this
// section is exclusively the `agc feature finish`/`agc check` WIRING.
// ===========================================================================

test("AC2 proof (1): finish --shipped applies a lane's 2-entry pending-tickets.md, commits on --base, and archives it", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-ac2-1-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179a-two-entries", "--path", lane]).status, 0);

  writePendingTickets(
    lane,
    "e179a",
    pendingBlock("L-E179A-NEW-1", "First finding") + "\n" + pendingBlock("L-E179A-NEW-2", "Second finding", "P3"),
  );
  commitPendingTickets(lane, "e179a", "file two findings");
  // A real workflow merges the branch via a PR before --shipped's merge guard
  // can pass; simulate that merge directly here.
  mergeLane(repo, "feat/e179a-two-entries");

  const r = runAgc(repo, ["finish", "e179a", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const afterBacklog = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  assert.match(afterBacklog, /\| E2 \|/, "the first entry must be allocated E2 (currentMaxId was 1)");
  assert.match(afterBacklog, /\| E3 \|/, "the second entry must be allocated E3");
  assert.match(afterBacklog, /L-E179A-NEW-1/);
  assert.match(afterBacklog, /L-E179A-NEW-2/);

  // The commit landed on --base (main) — the lane branch no longer exists
  // after finish --shipped removes it.
  assert.ok(!branchExists(repo, "feat/e179a-two-entries"), "branch must be deleted after a shipped finish");
  // e125b AC1/AC2 (spec-mandated re-baseline, qa_reports/expected-red_e125b-
  // lane-close-writeback.txt): --shipped now lands a SECOND, adjacent commit
  // after the pending-apply commit — the lane-close writeback (AC1's git mv +
  // AC2's Closed Lanes pointer) — so `git log -1` is that close commit, not
  // the pending-apply one any more. The pending-apply commit is still there,
  // one hop back.
  const log = git(repo, ["log", "-1", "--format=%s"]).trim();
  assert.match(
    log,
    /^chore\(lanes\): close lane e179a \(shipped\) — \.current\/e179a\/ -> \.current\/history\/\d{4}-\d{2}\/e179a\/$/,
  );
  const priorLog = git(repo, ["log", "-1", "--skip=1", "--format=%s"]);
  assert.match(priorLog, /allocate E2, E3 from lane e179a \(shipped\)/, "the pending-apply commit must still exist, one hop before the close commit");

  // e125b AC1: the old flat .current/e179a/ path is gone — the lane's
  // pending-tickets.md (archived under "## Applied" by the SAME pending-apply
  // commit, before the close moved it) now lives under
  // .current/history/<YYYY-MM>/e179a/ instead.
  assert.ok(!fs.existsSync(path.join(repo, ".current", "e179a")), "the old flat .current/e179a/ path must no longer exist after the close writeback");
  const historyRoot = path.join(repo, ".current", "history");
  const buckets = fs.readdirSync(historyRoot);
  assert.equal(buckets.length, 1, "exactly one history bucket must exist for this single close");
  const pending = fs.readFileSync(path.join(historyRoot, buckets[0], "e179a", "pending-tickets.md"), "utf-8");
  assert.match(pending, /## Applied/);
  assert.match(pending, /L-E179A-NEW-1/);
  assert.match(pending, /L-E179A-NEW-2/);
});

test("AC2 precondition (a): primary checked out on a branch OTHER than --base refuses, nothing mutated", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-ac2-2-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179b-wrong-branch", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179b", pendingBlock("L-E179B-NEW-1", "A finding"));
  commitPendingTickets(lane, "e179b");
  mergeLane(repo, "feat/e179b-wrong-branch");
  git(repo, ["checkout", "-b", "not-main"]);

  const before = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  const r = runAgc(repo, ["finish", "e179b", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /has not-main checked out, not --base main/);
  assert.equal(fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"), before, "backlog must be untouched");
  assert.ok(branchExists(repo, "feat/e179b-wrong-branch"), "lane branch must be untouched");
  assert.ok(fs.existsSync(lane), "lane worktree must be untouched");
});

test("AC2 precondition (b): primary with an uncommitted edit to docs/backlog.md refuses, nothing mutated", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-ac2-3-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179c-dirty-primary", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179c", pendingBlock("L-E179C-NEW-1", "A finding"));
  commitPendingTickets(lane, "e179c");
  mergeLane(repo, "feat/e179c-dirty-primary");
  fs.appendFileSync(path.join(repo, "docs", "backlog.md"), "\n<!-- uncommitted edit -->\n");

  const r = runAgc(repo, ["finish", "e179c", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /uncommitted changes to files this command writes/i);
  assert.match(
    fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"),
    /<!-- uncommitted edit -->/,
    "the dirty edit must be left exactly as the user made it",
  );
  assert.ok(branchExists(repo, "feat/e179c-dirty-primary"));
  assert.ok(fs.existsSync(lane));
});

test("AC2 precondition (c): an unrelated staged file in primary survives a successful apply commit, never swept in", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-ac2-4-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179d-unrelated-staged", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179d", pendingBlock("L-E179D-NEW-1", "A finding"));
  commitPendingTickets(lane, "e179d");
  mergeLane(repo, "feat/e179d-unrelated-staged");
  fs.writeFileSync(path.join(repo, "unrelated.txt"), "unrelated staged content\n");
  git(repo, ["add", "unrelated.txt"]);

  const r = runAgc(repo, ["finish", "e179d", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const status = git(repo, ["status", "--porcelain"]);
  assert.match(status, /^A\s+unrelated\.txt$/m, "unrelated.txt must still be staged and uncommitted — the apply commit is path-limited to docs/backlog.md + the pending file");
});

test("Error-refusal (1): a malformed pending-ticket block refuses BEFORE the AC2 primary-checkout preconditions get a chance to matter", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-err-1-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179e-malformed", "--path", lane]).status, 0);
  // Malformed: missing the required `priority` field.
  writePendingTickets(lane, "e179e", "```pending-ticket\nlane_local_id: L-E179E-NEW-1\ntitle: Missing priority\n```\n");
  commitPendingTickets(lane, "e179e");
  mergeLane(repo, "feat/e179e-malformed");
  git(repo, ["checkout", "-b", "also-wrong"]); // a SECOND, independent fault (AC2(a))

  const before = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  const r = runAgc(repo, ["finish", "e179e", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /problem\(s\)/);
  assert.match(r.stderr, /pending-ticket block #1/);
  assert.doesNotMatch(r.stderr, /not --base main/, "the content error must win — the primary-branch mismatch is never reached");
  assert.equal(fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"), before, "nothing committed");
});

test("Error-refusal (2): an unresolvable depends_on refuses BEFORE the AC2 primary-checkout preconditions get a chance to matter", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-err-2-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179f-ghost-dep", "--path", lane]).status, 0);
  writePendingTickets(
    lane,
    "e179f",
    "```pending-ticket\nlane_local_id: L-E179F-NEW-1\ntitle: Ghost dependency\npriority: P2\ndepends_on: L-GHOST-NEW-9\n```\n",
  );
  commitPendingTickets(lane, "e179f");
  mergeLane(repo, "feat/e179f-ghost-dep");
  fs.appendFileSync(path.join(repo, "docs", "backlog.md"), "\n<!-- dirty -->\n"); // a SECOND, independent fault (AC2(b))

  const r = runAgc(repo, ["finish", "e179f", "--shipped"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unresolvable depends_on/);
  assert.match(r.stderr, /L-GHOST-NEW-9/);
  assert.doesNotMatch(
    r.stderr,
    /uncommitted changes to files this command writes/,
    "the dependency error must win — the dirty-primary check is never reached",
  );
});

test("Error-refusal (3): both content-error classes refuse identically under --abandoned (read via git show, never fs)", () => {
  const cases = [
    ["e179g-malformed-abandoned", "```pending-ticket\nlane_local_id: L-E179G-NEW-1\ntitle: Missing priority\n```\n", /problem\(s\)/],
    [
      "e179h-ghostdep-abandoned",
      "```pending-ticket\nlane_local_id: L-E179H-NEW-1\ntitle: Ghost\npriority: P2\ndepends_on: L-GHOST-NEW-9\n```\n",
      /unresolvable depends_on/,
    ],
  ];
  for (const [slug, block, expect] of cases) {
    const repo = makePrimaryRepo();
    seedBacklog(repo);
    const lane = path.join(mkTmp("agc-e179-err-3-"), "lane");
    const ticketId = slug.split("-")[0];
    assert.equal(runAgc(repo, ["start", slug, "--path", lane]).status, 0);
    writePendingTickets(lane, ticketId, block);
    commitPendingTickets(lane, ticketId);
    // Deliberately NOT merged: --abandoned reads the branch, never --base.
    fs.writeFileSync(path.join(lane, "extra.txt"), "diverge\n");
    git(lane, ["add", "-A"]);
    git(lane, ["commit", "-m", "diverge from main"]);

    const before = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
    const r = runAgc(repo, ["finish", ticketId, "--abandoned"]);
    assert.notEqual(r.status, 0, `${slug} must refuse`);
    assert.match(r.stderr, expect);
    assert.equal(fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"), before, "nothing committed");
    assert.ok(fs.existsSync(lane), "worktree left in place");
    assert.ok(branchExists(repo, `feat/${slug}`), "branch left in place");
  }
});

test("AC3: finish --abandoned applies pending tickets identically, reading the file from the branch (never --base)", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-ac3-1-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179i-abandoned-apply", "--path", lane]).status, 0);
  writePendingTickets(
    lane,
    "e179i",
    pendingBlock("L-E179I-NEW-1", "First finding") + "\n" + pendingBlock("L-E179I-NEW-2", "Second finding", "P3"),
  );
  commitPendingTickets(lane, "e179i", "file two findings");
  // Never merged — abandoned lanes diverge from main by construction (AC20).
  fs.writeFileSync(path.join(lane, "extra.txt"), "diverge\n");
  git(lane, ["add", "-A"]);
  git(lane, ["commit", "-m", "diverge from main"]);

  const r = runAgc(repo, ["finish", "e179i", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const backlog = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  assert.match(backlog, /\| E2 \|/);
  assert.match(backlog, /\| E3 \|/);
  const log = git(repo, ["log", "-1", "--format=%s"]);
  assert.match(log, /allocate E2, E3 from lane e179i \(abandoned\)/);

  assert.ok(!fs.existsSync(lane), "worktree removed");
  assert.ok(branchExists(repo, "feat/e179i-abandoned-apply"), "abandoned lanes keep their branch");
  const pending = git(repo, ["show", "refs/heads/feat/e179i-abandoned-apply:.current/e179i/pending-tickets.md"]);
  assert.match(pending, /## Applied/);
  assert.match(pending, /L-E179I-NEW-1/);
  assert.match(pending, /L-E179I-NEW-2/);
});

test("AC3(a) G4 ordering: a dirty lane worktree (unrelated file) refuses BEFORE the primary-side backlog-append commit runs", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-g4a-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179j-dirty-lane", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179j", pendingBlock("L-E179J-NEW-1", "A finding"));
  commitPendingTickets(lane, "e179j");
  fs.writeFileSync(path.join(lane, "README.md"), "unrelated uncommitted change\n");

  const before = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  const r = runAgc(repo, ["finish", "e179j", "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /README\.md/);
  assert.equal(
    fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8"),
    before,
    "the primary-side backlog commit must never have run — the lane-worktree-dirty check is evaluated first (G4(a))",
  );
  assert.ok(fs.existsSync(lane), "worktree left in place");
  assert.ok(branchExists(repo, "feat/e179j-dirty-lane"));
});

test("AC3(b) G4 idempotency: a re-run after a simulated partial failure allocates 0 new ids and finishes only the branch-side archive", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e179-g4b-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179k-partial-failure", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179k", pendingBlock("L-E179K-NEW-1", "Already-allocated finding"));
  commitPendingTickets(lane, "e179k");

  // Simulate a partial failure: the backlog row for this finding already
  // landed on --base (as a real prior run's M1 would have committed it), but
  // the branch's pending-tickets.md was never archived (M2 never ran).
  fs.appendFileSync(
    path.join(repo, "docs", "backlog.md"),
    "| E2 | **Already-allocated finding** (filed by lane `e179k` as `L-E179K-NEW-1`) | P2 | none | — | — |\n",
  );
  git(repo, ["add", "docs/backlog.md"]);
  git(repo, ["commit", "-m", "simulate partial apply"]);

  const beforeBacklog = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  const r = runAgc(repo, ["finish", "e179k", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stdout, /e179k\/L-E179K-NEW-1 already applied, skipping \(backlog row E2\)/);
  const afterBacklog = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  assert.equal(afterBacklog, beforeBacklog, "0 new rows appended — the pre-existing row is untouched and no new one is added");
  assert.doesNotMatch(afterBacklog, /\| E3 \|/, "no fresh id may be minted for an already-applied entry");

  const pending = git(repo, ["show", "refs/heads/feat/e179k-partial-failure:.current/e179k/pending-tickets.md"]);
  assert.match(pending, /## Applied/);
  assert.match(pending, /L-E179K-NEW-1/);
});

test("AC4: sequential finishes for two lanes allocate disjoint id ranges, both re-derived from a freshly-read backlog", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const laneA = path.join(mkTmp("agc-e179-ac4-a-"), "lane");
  const laneB = path.join(mkTmp("agc-e179-ac4-b-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179l-lane-a", "--path", laneA]).status, 0);
  assert.equal(runAgc(repo, ["start", "e179m-lane-b", "--path", laneB]).status, 0);

  writePendingTickets(laneA, "e179l", pendingBlock("L-E179L-NEW-1", "Lane A finding"));
  commitPendingTickets(laneA, "e179l");
  writePendingTickets(laneB, "e179m", pendingBlock("L-E179M-NEW-1", "Lane B finding"));
  commitPendingTickets(laneB, "e179m");

  mergeLane(repo, "feat/e179l-lane-a");
  const r1 = runAgc(repo, ["finish", "e179l", "--shipped"]);
  assert.equal(r1.status, 0, `stderr=${r1.stderr}`);
  const afterA = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  assert.match(afterA, /\| E2 \|/);
  assert.doesNotMatch(afterA, /\| E3 \|/, "lane B has not been applied yet");

  // The second run's currentMaxId is re-derived by freshly re-reading
  // docs/backlog.md AFTER the first run's commit landed — never reused from
  // an earlier read (AC4) — even though this is a fresh process invocation.
  mergeLane(repo, "feat/e179m-lane-b");
  const r2 = runAgc(repo, ["finish", "e179m", "--shipped"]);
  assert.equal(r2.status, 0, `stderr=${r2.stderr}`);
  const afterB = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8");
  assert.match(afterB, /\| E3 \|/, "lane B must allocate E3, strictly above lane A's E2 — never repeating it");
  assert.equal((afterB.match(/\| E2 \|/g) ?? []).length, 1, "E2 must appear exactly once — never re-minted");
});

// ---------------------------------------------------------------------------
// AC5 — agc check surfaces orphaned lanes, advisory only, from ANY checkout.
// ---------------------------------------------------------------------------

test("AC5 proof (1): agc check surfaces a branch with an unapplied pending-tickets.md and no live worktree, exit 0", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-e179-ac5-1-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179n-orphan", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179n", pendingBlock("L-E179N-NEW-1", "Orphaned finding"));
  commitPendingTickets(lane, "e179n");
  // Worktree gone WITHOUT finish — the "abandoned and forgotten" case AC5
  // exists to surface.
  git(repo, ["worktree", "remove", "--force", lane]);

  const r = runAgcCheck(repo);
  assert.equal(r.status, 0, `agc check must never fail the exit code on an orphan — stderr=${r.stderr}`);
  assert.match(r.stderr, /agc check — warning:.*branch feat\/e179n-orphan carries an unapplied pending-tickets file/);
});

test("AC5 proof (2): the identical orphan warning appears byte-identical whether agc check runs from primary or from a DIFFERENT lane's own live worktree", () => {
  const repo = makePrimaryRepo();
  const orphanLane = path.join(mkTmp("agc-e179-ac5-2-orphan-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179o-orphan2", "--path", orphanLane]).status, 0);
  writePendingTickets(orphanLane, "e179o", pendingBlock("L-E179O-NEW-1", "Orphaned finding"));
  commitPendingTickets(orphanLane, "e179o");
  git(repo, ["worktree", "remove", "--force", orphanLane]);

  const otherLane = path.join(mkTmp("agc-e179-ac5-2-other-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179p-observer", "--path", otherLane]).status, 0);

  const fromPrimary = runAgcCheck(repo);
  const fromOtherLane = runAgcCheck(otherLane);
  assert.equal(fromPrimary.status, 0);
  assert.equal(fromOtherLane.status, 0);

  const extractWarning = (stderr) =>
    stderr
      .split("\n")
      .filter((l) => l.includes("agc check — warning:") && l.includes("e179o"))
      .join("\n");
  assert.ok(extractWarning(fromPrimary.stderr).length > 0, "primary must print the orphan warning");
  assert.equal(
    extractWarning(fromOtherLane.stderr),
    extractWarning(fromPrimary.stderr),
    "the orphan warning must be byte-identical regardless of which worktree agc check runs from",
  );
});

test("AC5 proof (3): a branch WITH a live worktree and still-unapplied pending entries is never flagged as an orphan", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-e179-ac5-3-"), "lane");
  assert.equal(runAgc(repo, ["start", "e179q-live-pending", "--path", lane]).status, 0);
  writePendingTickets(lane, "e179q", pendingBlock("L-E179Q-NEW-1", "Still-live finding"));
  commitPendingTickets(lane, "e179q");
  // Worktree intentionally kept live — no finish, no removal: orphan-ness is
  // "no live worktree", never "has unapplied entries" alone.

  const r = runAgcCheck(repo);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stderr, /e179q/, "a branch with a live worktree is never an orphan, regardless of unapplied entries");
});

test("AC5 proof (4) (E179-NEW-2, human ruling 2026-09-25, option (a) — own-lane-only scanning): a branch with no worktree, forked while ANOTHER lane's unapplied pending-tickets.md sits on base, must NOT be flagged, and no warning may name that other lane", () => {
  const repo = makePrimaryRepo();
  // Simulate another lane's pending-tickets.md already sitting on base,
  // unapplied — e.g. a merged lane whose own apply step has not yet run, or
  // any other lane's file the base commit happens to carry.
  fs.mkdirSync(path.join(repo, ".current", "e999"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".current", "e999", "pending-tickets.md"),
    pendingBlock("L-E999-NEW-1", "Someone else's finding"),
  );
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "seed another lane's unapplied pending file on base"]);

  // A NEW branch forked from this base commit — it carries e999's pending
  // file only because it INHERITED it from base, not because it is e999's
  // own lane. No live worktree is ever created for it.
  git(repo, ["branch", "feat/e179r-forked-no-worktree"]);

  const r = runAgcCheck(repo);
  assert.equal(r.status, 0);
  assert.doesNotMatch(
    r.stderr,
    /feat\/e179r-forked-no-worktree/,
    "AC5 own-lane-only (E179-NEW-2 option (a)): <lane> must be the branch's OWN lane " +
      "(resolveCurrentLane(branch) === 'e179r'), never every .current/<lane>/ the branch's " +
      "tree happens to carry — this branch has no .current/e179r/pending-tickets.md of its " +
      "own, so it must never be flagged, and no warning may name lane e999",
  );
  assert.doesNotMatch(r.stderr, /lane e999|as `e999`|finish --abandoned e999/, "no warning may name another lane's id");
});

// ---------------------------------------------------------------------------
// e125b spec AC4 (S1 resolved — the orphan scan never reads
// .current/history/, because --shipped also deletes the branch, so a closed
// lane is never a candidate in the first place; candidates are drawn from
// refs/heads/ only). Test-file placement note (Phase 3a): the ticket named
// test/agc-orphan-lanes.test.mjs (extend), but no file with that name exists
// in this repo — the real, pre-existing orphan-lane coverage (AC5 proof
// (1)-(4) above) already lives in THIS file, so this AC4 extension is placed
// alongside it rather than forking a same-purpose file under a different name.
// ---------------------------------------------------------------------------

test("AC4 (e125b, S1 — grep proof): checkOrphanLanes's own source in bin/agc-init.mjs never reads .current/history/ — no readdir/statSync/fs call anywhere in the function names \"history\"", () => {
  const src = fs.readFileSync(AGC_INIT, "utf-8");
  const start = src.indexOf("async function checkOrphanLanes(cwd) {");
  assert.ok(start >= 0, "checkOrphanLanes must exist in bin/agc-init.mjs");
  // The next top-level `async function ` after checkOrphanLanes's own
  // declaration marks the end of its body (runCheck, per the file's layout).
  const end = src.indexOf("\nasync function ", start + 1);
  assert.ok(end > start, "could not locate the end of checkOrphanLanes's body");
  const body = src.slice(start, end);
  assert.doesNotMatch(
    body,
    /history/,
    "checkOrphanLanes must never mention \"history\" anywhere in its body — its only inputs are refs/heads/ branches (via listWorktrees/for-each-ref) and each branch's OWN .current/<lane>/pending-tickets.md blob (via readBlob), never a .current/history/ readdir or stat",
  );
});

test("AC4 proof (e125b): a lane closed via finish --shipped (branch deleted, .current/<lane>/ moved into .current/history/<bucket>/<lane>/) is never flagged by agc check, even though its history copy still holds a pending-tickets.md", () => {
  const repo = makePrimaryRepo();
  seedBacklog(repo);
  const lane = path.join(mkTmp("agc-e125b-ac4-1-"), "lane");
  assert.equal(runAgc(repo, ["start", "e125bac4-closes-clean", "--path", lane]).status, 0);
  writePendingTickets(lane, "e125bac4", pendingBlock("L-E125BAC4-NEW-1", "A finding that will be applied at finish"));
  commitPendingTickets(lane, "e125bac4");
  mergeLane(repo, "feat/e125bac4-closes-clean");

  const r = runAgc(repo, ["finish", "e125bac4", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.ok(!branchExists(repo, "feat/e125bac4-closes-clean"), "the branch must be deleted — S1's whole premise is that a closed lane has no live branch ref");

  const historyRoot = path.join(repo, ".current", "history");
  const buckets = fs.readdirSync(historyRoot);
  const histLaneDir = path.join(historyRoot, buckets[0], "e125bac4");
  assert.ok(fs.existsSync(path.join(histLaneDir, "pending-tickets.md")), "the closed lane's pending-tickets.md must have moved into the history bucket");

  // Overwrite the history copy with UNAPPLIED-shaped content — if
  // checkOrphanLanes ever read .current/history/, this would look exactly
  // like an orphan. It must still produce zero warning, because this lane's
  // branch does not exist any more (structural non-applicability, not a
  // content check).
  fs.writeFileSync(path.join(histLaneDir, "pending-tickets.md"), pendingBlock("L-E125BAC4-NEW-2", "Still looks unapplied"));

  const check = runAgcCheck(repo);
  assert.equal(check.status, 0);
  assert.doesNotMatch(check.stderr, /e125bac4/, "a closed lane must never be flagged as an orphan, regardless of what its history copy contains");
});

// ===========================================================================
// Docs / security (AC27-AC29)
// ===========================================================================

test("AC27: docs/install.md documents both commands per the spec's required list", () => {
  const doc = fs.readFileSync(path.join(PROJECT_ROOT, "docs", "install.md"), "utf-8");
  assert.match(doc, /agc feature start/);
  assert.match(doc, /agc feature finish/);
  assert.match(doc, /--path/); // default --path convention
  assert.match(doc, /--shipped/);
  assert.match(doc, /--abandoned/);
  assert.match(doc, /merge/i); // shipped merge guard
  assert.match(doc, /commit/i); // commit-before-remove
  assert.match(doc, /untracked/i); // AC24 rough edge
  assert.match(doc, /shared[^\n]*node_modules|node_modules[^\n]*shared/i); // AC14 warning
  assert.match(doc, /npm ci/i);
  assert.match(doc, /undefined behaviour|undefined behavior/i); // direct `git worktree remove`
});

test("AC28: docs/install.md states the .env-never-read-into-output guarantee", () => {
  const doc = fs.readFileSync(path.join(PROJECT_ROOT, "docs", "install.md"), "utf-8");
  assert.match(doc, /Secrets:/);
  assert.match(doc, /never (be )?read into a JavaScript string|never read/i);
});

test("AC29: the two retargeted comments read the lane-scoped path; .config.json mentions untouched", () => {
  const src = fs.readFileSync(AGC_INIT, "utf-8");
  const lines = src.split("\n");
  // Header note (near line 9) and the runInit body note (near line 351) —
  // both must describe the lane-scoped path, never the stale flat one.
  const headerLine = lines.slice(0, 20).find((l) => l.includes("any seeded prev tuple dead-ends"));
  // Located by content, not a fixed line window (e106-init-artifacts-flag
  // added --artifacts helpers ahead of runInit, pushing this comment further
  // down than any window pinned to the pre-e106 file would find it).
  const runInitStart = lines.findIndex((l) => l.includes("function runInit(cwd"));
  assert.ok(runInitStart !== -1, "expected to find the runInit function definition");
  const runInitLine = lines.slice(runInitStart, runInitStart + 30).find((l) => l.includes("no .current"));
  assert.ok(headerLine, "expected the header retarget comment near line 9");
  assert.ok(runInitLine, "expected the runInit retarget comment near the top of runInit's body");
  assert.match(headerLine, /\.current\/<lane>\/handoff\.md/);
  assert.match(runInitLine, /\.current\/<lane>\/handoff\.md/);
  // The OLD flat wording must no longer appear anywhere as the described path.
  assert.ok(!src.includes(".current/handoff.md (E34)"), "stale flat-path comment wording must be gone");
  // .config.json mentions are untouched: still a plain, non-lane-scoped path
  // (never rewritten to .current/<lane>/.config.json anywhere in the file).
  assert.ok(!/\.current\/<lane>\/\.config\.json/.test(src), ".config.json must stay top-level, not lane-scoped");
  assert.ok(src.includes(".current/.config.json"), ".config.json mentions must still be present");
});

// ===========================================================================
// Boundary / security smoke (SOP Phase 3d — always included)
// ===========================================================================

test("boundary: empty ticket-slug is rejected, not treated as a valid (empty) lane name", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-boundary1-"), "lane");
  const r = runAgc(repo, ["start", "", "--path", lane]);
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(lane));
});

test("boundary: an option-shaped --base value is rejected (git option-injection defense)", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-boundary2-"), "lane");
  const r = runAgc(repo, ["start", "e30x-injection", "--base", "--upload-pack=touch /tmp/pwned", "--path", lane]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /invalid --base/i);
  assert.ok(!fs.existsSync(lane));
  assert.ok(!branchExists(repo, "feat/e30x-injection"));
});

test("boundary: a shell-metacharacter-laden slug is handled as inert argv data, not shell input", () => {
  const repo = makePrimaryRepo();
  const marker = path.join(repo, "shell-was-invoked.marker");
  const lane = path.join(mkTmp("agc-feature-boundary3-"), "lane");
  const slug = `e31x-safe;touch ${marker};\`touch ${marker}\`-suffix`;
  const r = runAgc(repo, ["start", slug, "--path", lane]);
  // Whatever the CLI decides about validity, argv is never shell-interpreted
  // (execFileSync/spawnSync with an argv array) — the marker file must never
  // be created.
  assert.ok(!fs.existsSync(marker), "shell metacharacters in argv must never be interpreted");
  assert.equal(typeof r.status, "number");
});

test("boundary: an oversized ticket-slug is rejected or handled without an uncaught crash", () => {
  const repo = makePrimaryRepo();
  const lane = path.join(mkTmp("agc-feature-boundary4-"), "lane");
  const oversized = "e32x-" + "a".repeat(4096);
  const r = runAgc(repo, ["start", oversized, "--path", lane]);
  assert.equal(typeof r.status, "number", "must exit with a defined code, not crash the process");
  assert.ok(!r.stderr.includes("Uncaught"), "must not surface a raw uncaught-exception stack trace");
});

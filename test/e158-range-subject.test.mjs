// Coded by @qa-engineer
// Tests (T-E158-03) for specs/e158-range-subject-audit.md: a check whose subject comes from a commit range must
// fail loudly when the range is empty, because a for-all over nothing passes without inspecting anything.
// Covered: AC-E158-1 (verify-release Check 1 refuses an empty commit), AC-E158-4 (check-bookkeeping --base that does
// not resolve, and the post-cut-approval extension: --base with no merge-base), AC-E158-4b (no base at all; a base
// without docs/backlog.md keeps the note), AC-E158-5 (fanout check), AC-E158-6 (fanout owners --range).
// AC-E158-2 (zero-commit enumeration) cannot be reached from a real repo; code review judges it by reading.
// Every fixture is an in-test git repo under os.tmpdir() and is removed afterwards. Nothing here reads a real
// specs/fanout-*.md or diffs against a fixed base sha (AC-LANE-4). Creation pre-authorized in the dispatch brief.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = (name) => fs.readFileSync(path.join(ROOT, "scripts", name), "utf-8");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e158-qa-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "qa",
  GIT_AUTHOR_EMAIL: "qa@example.invalid",
  GIT_COMMITTER_NAME: "qa",
  GIT_COMMITTER_EMAIL: "qa@example.invalid",
  GIT_CONFIG_NOSYSTEM: "1",
};
function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env: GIT_ENV, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function put(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function mkdir(prefix) {
  return fs.mkdtempSync(path.join(TMP, prefix));
}

// ---------------------------------------------------------------------------
// AC-E158-1: verify-release Check 1 (tag-at-HEAD range tolerance).
// ---------------------------------------------------------------------------

const VERSION = "1.0.0";

function mkReleaseFixture() {
  const root = mkdir("vr-");
  const remote = mkdir("vr-remote-");
  git(root, "init", "-q", "-b", "main");
  put(root, "scripts/verify-release.mjs", SCRIPT("verify-release.mjs"));
  put(root, "scripts/check-version.mjs", SCRIPT("check-version.mjs"));
  put(root, "package.json", JSON.stringify({ name: "agent-governance-mcp", version: VERSION }, null, 2));
  put(root, "index.ts", `new Server({ name: "agent-governance-mcp", version: "${VERSION}" });\n`);
  put(root, "CHANGELOG.md", `# Changelog\n\n## [${VERSION}] - 2026-01-01\n### Added\n- fixture entry\n`);
  put(root, "dist/index.js", `new Server({ name: "agent-governance-mcp", version: "${VERSION}" });\n`);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  git(remote, "init", "-q", "--bare");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-q", "-u", "origin", "main");
  git(root, "tag", `v${VERSION}`);
  return root;
}
const verify = (root) =>
  spawnSync(process.execPath, [path.join(root, "scripts", "verify-release.mjs"), `v${VERSION}`], { cwd: root, encoding: "utf8" });

test("AC-E158-1: a commit that lists no changed path is an offender; Check 1 FAILs naming its 12-char sha and prints no tolerance NOTE", () => {
  // WHY: an `--allow-empty` commit has badPaths = [], so the old for-all counted it as bookkeeping-only and passed.
  const root = mkReleaseFixture();
  git(root, "commit", "-q", "--allow-empty", "-m", "empty commit after the tag");
  const sha12 = git(root, "rev-parse", "HEAD").slice(0, 12);
  git(root, "push", "-q", "origin", "main");
  const r = verify(root);
  assert.equal(r.status, 1, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.ok(r.stderr.includes(`${sha12} lists no changed paths`), r.stderr);
  assert.doesNotMatch(r.stdout, /NOTE: tag-at-HEAD — tolerated/);
  assert.doesNotMatch(r.stdout, /OK: tag-at-HEAD/);
});

test("AC-E158-1: one empty commit among bookkeeping commits still FAILs, and only the empty one is named", () => {
  const root = mkReleaseFixture();
  put(root, "tasks.md", "- [x] done\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "chore(governance): post-release bookkeeping");
  const bookkeepingSha12 = git(root, "rev-parse", "HEAD").slice(0, 12);
  git(root, "commit", "-q", "--allow-empty", "-m", "empty");
  const emptySha12 = git(root, "rev-parse", "HEAD").slice(0, 12);
  git(root, "push", "-q", "origin", "main");
  const r = verify(root);
  assert.equal(r.status, 1, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.ok(r.stderr.includes(`${emptySha12} lists no changed paths`), r.stderr);
  assert.ok(!r.stderr.includes(`${bookkeepingSha12} lists no changed paths`), "a bookkeeping commit is not an offender");
  assert.match(r.stderr, /1 of 2 commit\(s\) in range/);
});

test("AC-E158-1 (control): a range made only of bookkeeping-path commits is still tolerated with the NOTE, exit 0", () => {
  const root = mkReleaseFixture();
  put(root, "tasks.md", "- [x] done\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "chore(governance): post-release bookkeeping");
  git(root, "push", "-q", "origin", "main");
  const r = verify(root);
  assert.equal(r.status, 0, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.match(r.stdout, /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v1\.0\.0/);
  assert.match(r.stdout, /OK: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// AC-E158-4 / 4b: check-bookkeeping base resolution.
// ---------------------------------------------------------------------------

const TICKET_HEAD = "| id | desc | priority | depends_on | est. files | design-link |\n|---|---|---|---|---|---|\n";
const QUEUE_HEAD = "| # | 票 | P | 一句話 | 發現於 | 為什麼排在這個位置 |\n|---|---|---|---|---|---|\n";
const trow = (id, desc) => `| ${id} | ${desc} | P3 | none | 1 | N/A |\n`;

function mkBookkeepingFixture({ branch = "main" } = {}) {
  const root = mkdir("cb-");
  put(root, "scripts/check-bookkeeping.mjs", SCRIPT("check-bookkeeping.mjs"));
  put(root, "docs/backlog.md", TICKET_HEAD + trow("E10", "a"));
  put(root, "docs/v4.0.0-new-tickets.md", QUEUE_HEAD);
  git(root, "init", "-q", "-b", branch);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  return root;
}
const bookkeeping = (root, args = []) =>
  spawnSync(process.execPath, [path.join(root, "scripts", "check-bookkeeping.mjs"), ...args], { cwd: root, encoding: "utf8" });

test("AC-E158-4: an explicit --base that does not resolve exits 2 with exactly one stderr line, and never falls back to main", () => {
  // WHY: main resolves in this fixture, so the old fall-through silently swapped the typo for a different base.
  const root = mkBookkeepingFixture();
  const r = bookkeeping(root, ["--base", "nope"]);
  assert.equal(r.status, 2, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.equal(r.stderr, "check:bookkeeping — cannot run: --base nope does not resolve to a commit\n");
  assert.equal(r.stdout, "");
});

test("AC-E158-4 (extension): a --base that resolves but shares no history with HEAD exits 2 with exactly one stderr line", () => {
  // WHY: before the extension this also fell through to origin/main/main with no message (audit row 6).
  const root = mkBookkeepingFixture();
  git(root, "checkout", "-q", "--orphan", "unrelated");
  git(root, "rm", "-rqf", ".");
  put(root, "other.txt", "x\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "unrelated root");
  git(root, "checkout", "-q", "main");
  const r = bookkeeping(root, ["--base", "unrelated"]);
  assert.equal(r.status, 2, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.equal(r.stderr, "check:bookkeeping — cannot run: --base unrelated has no merge-base with HEAD\n");
  assert.equal(r.stdout, "");
});

test("AC-E158-4 (control): a resolvable --base keeps working and still reports a late id", () => {
  const root = mkBookkeepingFixture({ branch: "trunk" });
  put(root, "docs/backlog.md", TICKET_HEAD + trow("E10", "a") + trow("E9", "late"));
  const r = bookkeeping(root, ["--base", "trunk"]);
  assert.equal(r.status, 1, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.match(r.stderr, /new ticket id E9 is not above the previous maximum E10/);
});

test("AC-E158-4b: no --base and neither origin/main nor main resolves exits 2 with exactly one stderr line", () => {
  const root = mkBookkeepingFixture({ branch: "trunk" });
  const r = bookkeeping(root);
  assert.equal(r.status, 2, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.equal(
    r.stderr,
    "check:bookkeeping — cannot run: no base commit found for the id-ordering check (tried origin/main, main; pass --base <ref>)\n"
  );
  assert.equal(r.stdout, "");
});

test("AC-E158-4b (audit row 8): a base that resolves but holds no docs/backlog.md keeps the note and exits 0", () => {
  // WHY: the comparison set is empty, not the subject: this is the legitimate first-introduction case.
  const root = mkBookkeepingFixture();
  git(root, "rm", "-q", "docs/backlog.md");
  git(root, "commit", "-q", "-m", "drop backlog");
  put(root, "docs/backlog.md", TICKET_HEAD + trow("E10", "a"));
  const r = bookkeeping(root);
  assert.equal(r.status, 0, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.match(r.stdout, /docs\/backlog\.md — id ordering not checked: no base commit found \(pass --base <ref>\)/);
  assert.equal(r.stderr, "");
});

// ---------------------------------------------------------------------------
// AC-E158-5 / 6: fanout check and owners --range on an empty A...B diff.
// ---------------------------------------------------------------------------

const MANIFEST = path.join(TMP, "m.md");
fs.writeFileSync(
  MANIFEST,
  [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    "| same | E1 | feat/same | ../lanes/same | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "| net0 | E2 | feat/net0 | ../lanes/net0 | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "| work | E3 | feat/work | ../lanes/work | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "",
    "## Dispatch pins",
    "- same：`sr-engineer=opus`。",
    "- net0：`sr-engineer=opus`。",
    "- work：`sr-engineer=opus`。",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ].join("\n"),
);

/** main; feat/same = main; feat/net0 adds then reverts a file (commits, zero net paths); feat/work adds tools/a.ts. */
function mkFanoutRepo() {
  const repo = mkdir("fo-");
  git(repo, "init", "-q", "-b", "main");
  put(repo, "README.md", "x\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "branch", "feat/same");
  git(repo, "checkout", "-q", "-b", "feat/net0");
  put(repo, "tmp.txt", "x\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "add");
  git(repo, "rm", "-q", "tmp.txt");
  git(repo, "commit", "-q", "-m", "revert");
  git(repo, "checkout", "-q", "main");
  git(repo, "checkout", "-q", "-b", "feat/work");
  put(repo, "tools/a.ts", "export const a = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "work");
  git(repo, "checkout", "-q", "main");
  return repo;
}
const fanout = (args) => {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};
const REPO = mkFanoutRepo();

function assertRangeEmpty(r, linePattern) {
  assert.equal(r.status, 2, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.equal(r.stdout, "", "no verdict on stdout for an input error");
  const lines = r.stderr.split("\n").filter(Boolean);
  assert.equal(lines.length, 1, `exactly one stderr line, got: ${r.stderr}`);
  assert.match(lines[0], linePattern);
}

test("AC-E158-5: fanout check on a lane branch equal to base exits 2 RANGE_EMPTY, stdout empty, one stderr line", () => {
  // WHY: "0 file(s) changed, 0 out of bounds" over an empty range reads as a clean boundary check after inspecting nothing.
  assertRangeEmpty(
    fanout(["check", MANIFEST, "same", "--base", "main", "--repo", REPO]),
    /^fanout: error: RANGE_EMPTY: git diff main\.\.\.feat\/same lists no committed change in .+ — nothing was checked; commit the lane's work first \(uncommitted and untracked work is never checked\) \(E158\)$/,
  );
});

test("AC-E158-5: a lane whose commits net to zero paths is the same empty range", () => {
  assertRangeEmpty(fanout(["check", MANIFEST, "net0", "--base", "main", "--repo", REPO]), /^fanout: error: RANGE_EMPTY: git diff main\.\.\.feat\/net0 /);
});

test("AC-E158-5: uncommitted work in the lane's checkout does not make an empty range non-empty", () => {
  const repo = mkFanoutRepo();
  git(repo, "checkout", "-q", "feat/same");
  put(repo, "tools/a.ts", "uncommitted\n");
  assertRangeEmpty(fanout(["check", MANIFEST, "same", "--base", "main", "--repo", repo]), /^fanout: error: RANGE_EMPTY: /);
});

test("AC-E158-5 (control): a non-empty in-bounds range is unchanged (exit 0, no RANGE_EMPTY)", () => {
  const r = fanout(["check", MANIFEST, "work", "--base", "main", "--repo", REPO]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!r.stderr.includes("RANGE_EMPTY"));
  assert.match(r.stdout, /1 file\(s\) changed, 0 out of bounds/);
});

test("AC-E158-6: owners --range on an empty A...B diff exits 2 RANGE_EMPTY, stdout empty, one stderr line", () => {
  assertRangeEmpty(
    fanout(["owners", MANIFEST, "--range", "main...feat/same", "--repo", REPO]),
    /^fanout: error: RANGE_EMPTY: git diff main\.\.\.feat\/same lists no committed change in .+ — an empty range proves nothing about ownership \(E158\)$/,
  );
  assertRangeEmpty(fanout(["owners", MANIFEST, "--range", "main...main", "--repo", REPO]), /^fanout: error: RANGE_EMPTY: git diff main\.\.\.main /);
});

test("AC-E158-6 (control): owners --range with a non-empty diff still reports its HIT line and exit 1", () => {
  const r = fanout(["owners", MANIFEST, "--range", "main...feat/work", "--repo", REPO]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^HIT  tools\/a\.ts  /m);
  assert.ok(!r.stderr.includes("RANGE_EMPTY"));
});

test("AC-E158-6 (control): owners --paths with an empty list is not range-derived and still exits 0", () => {
  const empty = path.join(TMP, "empty-paths.txt");
  fs.writeFileSync(empty, "");
  const r = fanout(["owners", MANIFEST, "--paths", empty]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!r.stderr.includes("RANGE_EMPTY"));
});

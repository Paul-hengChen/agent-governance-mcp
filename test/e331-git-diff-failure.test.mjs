// Coded by @qa-engineer
// Tests (T-E331-01) for specs/e284-fanout-handoff-command.md AC-E331-1..3: when the `git diff <a>...<b>` behind
// `fanout.mjs owners --range` or `fanout.mjs check` fails (here: the two sides share no merge base), the CLI exits 2
// with the named input error GIT_DIFF_FAILED instead of a stack trace and exit 1. Exit 1 means "an owned path" for
// owners and "out of bounds" for check, so a failed diff read as exit 1 would be a false result.
// Fixtures are an in-test manifest and a temp git repo under os.tmpdir(); nothing reads the committed manifests.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e331-qa-"));

function cli(args) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function git(repo, ...args) {
  const r = spawnSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
const STACK_LINE = /^\s+at /m;

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
    "| a | E1 | feat/a | ../lanes/a | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "| o | E2 | orphan/o | ../lanes/o | `tools/o.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "",
    "## Dispatch pins",
    "- a：`sr-engineer=opus`。",
    "- o：`sr-engineer=opus`。",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ].join("\n"),
);

/** main + feat/a (shares main's history, touches tools/a.ts and docs/x.md) + orphan/o (no common history). */
function makeRepo() {
  const repo = fs.mkdtempSync(path.join(TMP, "repo-"));
  git(repo, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repo, "README.md"), "x\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "checkout", "-q", "-b", "feat/a");
  fs.mkdirSync(path.join(repo, "tools"));
  fs.writeFileSync(path.join(repo, "tools", "a.ts"), "export const a = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "lane a");
  git(repo, "checkout", "-q", "--orphan", "orphan/o");
  git(repo, "rm", "-rq", "--cached", ".");
  fs.rmSync(path.join(repo, "tools"), { recursive: true, force: true });
  fs.rmSync(path.join(repo, "README.md"));
  fs.mkdirSync(path.join(repo, "tools"));
  fs.writeFileSync(path.join(repo, "tools", "o.ts"), "export const o = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "orphan root");
  git(repo, "checkout", "-q", "main");
  return repo;
}
const REPO = makeRepo();

function assertGitDiffFailed(r, range) {
  assert.equal(r.status, 2, `exit 2 (input error), not 1 (a result): ${r.stdout}${r.stderr}`);
  const lines = r.stderr.split("\n").filter((l) => l.startsWith("fanout: error: GIT_DIFF_FAILED:"));
  assert.equal(lines.length, 1, r.stderr);
  assert.ok(lines[0].includes(`git diff ${range} failed in `), `names the range: ${lines[0]}`);
  // git's own first stderr line is carried after the repo, so the reason is visible without a trace
  assert.match(lines[0], /failed in .+: \S/, lines[0]);
  assert.ok(!STACK_LINE.test(r.stderr), `no stack trace: ${r.stderr}`);
  assert.ok(!/^HIT  |^OUT  /m.test(r.stdout), `no result lines on a failed diff: ${r.stdout}`);
}

test("owners range without merge base", () => {
  assertGitDiffFailed(cli(["owners", MANIFEST, "--range", "main...orphan/o", "--repo", REPO]), "main...orphan/o");
});

test("check without merge base", () => {
  assertGitDiffFailed(cli(["check", MANIFEST, "o", "--base", "main", "--repo", REPO]), "main...orphan/o");
});

test("other owners / check exit codes are unchanged on the same repo", () => {
  // WHY: the wrapper must change only the failed-diff path (AC-E331-3); a shared-history range still gives a result.
  const hit = cli(["owners", MANIFEST, "--range", "main...feat/a", "--repo", REPO]);
  assert.equal(hit.status, 1, hit.stderr);
  assert.match(hit.stdout, /^HIT  tools\/a\.ts  \(a: tools\/a\.ts\)$/m);
  const none = cli(["owners", MANIFEST, "--range", "main...main", "--repo", REPO]);
  assert.equal(none.status, 0, none.stderr);
  const inBounds = cli(["check", MANIFEST, "a", "--base", "main", "--repo", REPO]);
  assert.equal(inBounds.status, 0, inBounds.stdout + inBounds.stderr);
  const noRef = cli(["owners", MANIFEST, "--range", "main...nope", "--repo", REPO]);
  assert.equal(noRef.status, 2);
  assert.match(noRef.stderr, /fanout: error: REF_NOT_FOUND:/);
  assert.ok(!noRef.stderr.includes("GIT_DIFF_FAILED"), "an unresolvable ref keeps its own code");
});

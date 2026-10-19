// Coded by @qa-engineer
// Tests (T-E339-01) for specs/e289-render-addendum.md AC-E339-1..2: `handoff`'s git status fact reads paths
// unquoted (`-c core.quotePath=false`). By default git prints a non-ASCII path as a quoted, octal-escaped string,
// which escapes the manifest self-exclusion (pasting the section dirties the manifest itself) and makes a clean
// `handoff --check` report a difference that is not there. Fixture: a temp git primary (with a bare origin) whose
// committed manifest is `specs/fanout-波次.md`, built under os.tmpdir(); nothing reads the repo's own manifests.
// AC-E339-3 (HANDOFF_GIT_FAILED still names `status`) is a code-reading criterion covered by the code review.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { runHandoff } from "../dist/tools/fanout-handoff.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e339-qa-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync(
    "git",
    ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 },
  ).trim();
}

const MANIFEST = [
  "# Fan-out: fixture",
  "base: abc1234    integration branch: integ/fx",
  "",
  "**狀態：人類核准 2026-10-13。**",
  "",
  "## Lanes",
  "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  "|---|---|---|---|---|---|---|---|",
  "",
  "## Dispatch pins",
  "- a：`sr-engineer=opus`。",
  "",
  "## Decisions",
  "| 日期 | 裁決者 | 內容 | 出處 |",
  "|---|---|---|---|",
  "| 2026-10-13 | 人類 | 開波 | s |",
  "",
].join("\n");

/** A primary on main == origin/main, clean, holding the committed manifest `specs/fanout-波次.md`. */
async function makeRepo(name) {
  const root = path.join(TMP, name);
  const primary = path.join(root, "primary");
  fs.mkdirSync(path.join(primary, "specs"), { recursive: true });
  git(root, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(primary, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(primary, ".gitignore"), ".current/\n");
  const M = path.join(primary, "specs", "fanout-波次.md");
  fs.writeFileSync(M, MANIFEST);
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "base");
  git(primary, "remote", "add", "origin", path.join(root, "origin.git"));
  git(primary, "push", "-q", "origin", "main");
  // The primary lane-status row needs a readable handoff state (.current/ is git-ignored, so the tree stays clean).
  resetSession();
  await writeHandoffState({
    workspacePath: primary,
    activeFeature: "wave-fx",
    status: "PASS",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "qa-engineer",
    hopCount: 7,
  });
  return { primary, M };
}

const run = (args) => {
  const r = runHandoff(args);
  return { status: r.exitCode, stdout: r.stdout, stderr: r.stderr };
};
const fact = (text, key) => new RegExp(`^- ${key}：(.*)$`, "m").exec(text)?.[1];

test("AC-E339-1 a pasted section in a non-ASCII-named manifest checks clean", async () => {
  // WHY: the manifest's own status line must be recognised (and left out) whatever its file name's script.
  const w = await makeRepo("paste");
  const g = run([w.M]);
  assert.equal(g.status, 0, g.stderr);
  assert.equal(fact(g.stdout, "git status"), "乾淨");
  assert.match(fact(g.stdout, "lane-status"), /^primary（main）/);
  fs.appendFileSync(w.M, "\n" + g.stdout);
  assert.match(git(w.primary, "status", "--porcelain"), /fanout-/, "the manifest is now modified");

  const c = run(["--check", w.M]);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.ok(!c.stdout.split("\n").some((l) => l.startsWith("DIFF  ") || l.startsWith("MOVED  ")), c.stdout);
  assert.match(c.stdout, /0 differ, 0 moved/);
  const regen = run([w.M]);
  assert.equal(fact(regen.stdout, "git status"), "乾淨");
  assert.match(fact(regen.stdout, "lane-status"), /clean/);
});

test("AC-E339-2 an untracked non-ASCII file is listed unquoted", async () => {
  // WHY: quoted output ("\346\226\260...") is unreadable and cannot be matched against the manifest path.
  const w = await makeRepo("untracked");
  fs.writeFileSync(path.join(w.primary, "新檔.txt"), "x\n");
  const g = run([w.M]);
  assert.equal(g.status, 0, g.stderr);
  const status = fact(g.stdout, "git status");
  assert.ok(status.includes("?? 新檔.txt"), status);
  assert.ok(!status.includes('"') && !status.includes("\\3"), `no quoting or octal escapes: ${status}`);
  assert.ok(!status.includes("波次"), "the manifest itself is not listed");
});

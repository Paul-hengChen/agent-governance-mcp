// Coded by @qa-engineer
// Tests (T-E346-02) for specs/e384-design-mode-and-handoff-target.md AC-E346-1..3: a `sisterRepos` path is a usable
// sister repo only when it IS a repository top level. A plain directory nested in another repo's working tree (or a
// subdirectory of the sister repo itself) must be SISTER_REPO_NOT_GIT, never silently read as the enclosing repo, because
// `handoff --check` would then report the wrong repo's branch sha as the sister's. A symlinked root and a linked-worktree
// root are real top levels and stay accepted (realpath comparison). Fixtures: temp git repos under os.tmpdir().

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { runHandoff } from "../dist/tools/fanout-handoff.js";

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e346-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}
const run = (args) => {
  const r = runHandoff(args);
  return { status: r.exitCode, stdout: r.stdout, stderr: r.stderr };
};
const errCodes = (r) => [...r.stderr.matchAll(/fanout: error: ([A-Z_]+):/g)].map((m) => m[1]);
const NOT_GIT = (name) =>
  `fanout: error: SISTER_REPO_NOT_GIT: sister repo "${name}" (sisterRepos in .current/.config.json) is not a git repository at its declared path`;

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
  "",
  "## Decisions",
  "| 日期 | 裁決者 | 內容 | 出處 |",
  "|---|---|---|---|",
  "| 2026-10-13 | 人類 | 開波 | s |",
  "",
].join("\n");
const HEADER = "| repo | 票 | branch | sha | 協定出處 |\n|---|---|---|---|---|";

let n = 0;
/**
 * root/primary (main, clean, committed v2 config declaring `sisterRepos`) with the generated section pasted, plus
 * root/sister (main + feat/x). `paths` maps entry name -> declared path (relative to primary).
 */
function makeWave(paths) {
  const root = path.join(TMP, `w${n++}`);
  const primary = path.join(root, "primary");
  const sister = path.join(root, "sister");
  fs.mkdirSync(path.join(primary, "specs"), { recursive: true });
  fs.mkdirSync(path.join(primary, ".current"), { recursive: true });
  fs.mkdirSync(path.join(sister, "sub"), { recursive: true });
  git(root, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(sister, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(sister, "sub", "f.txt"), "1\n");
  git(sister, "add", "-A");
  git(sister, "commit", "-q", "-m", "s1");
  git(sister, "branch", "feat/x");
  git(primary, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(primary, ".gitignore"), ".current/*\n!.current/.config.json\n");
  const sisterRepos = Object.entries(paths).map(([name, p]) => ({ name, path: p, owns: "the protocol" }));
  fs.writeFileSync(path.join(primary, ".current", ".config.json"), JSON.stringify({ schema_version: 2, sisterRepos }, null, 2) + "\n");
  const M = path.join(primary, "specs", "fanout-fx.md");
  fs.writeFileSync(M, MANIFEST);
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "base");
  git(primary, "remote", "add", "origin", path.join(root, "origin.git"));
  git(primary, "push", "-q", "origin", "main");
  const g = run([M]);
  assert.equal(g.status, 0, g.stderr);
  fs.appendFileSync(M, "\n" + g.stdout);
  return { root, primary, sister, M };
}
const rowsFor = (w, names) => {
  const sha = git(w.sister, "rev-parse", "--short=7", "feat/x");
  return ["", "## 外部依賴", HEADER, ...names.map((nm, i) => `| ${nm} | E${i + 1} | feat/x | ${sha} | README.md §3 |`), ""].join("\n");
};

test("AC-E346-1 a plain directory nested in another repo's working tree -> exit 2 SISTER_REPO_NOT_GIT, no path echoed", () => {
  // WHY: `git rev-parse --git-dir` succeeds inside the enclosing repo, so the old check read the OUTER repo's branch sha.
  const w = makeWave({ nested: "../outer/nested-plain" });
  const outer = path.join(w.root, "outer");
  fs.mkdirSync(path.join(outer, "nested-plain"), { recursive: true });
  git(outer, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(outer, "a.txt"), "x\n");
  git(outer, "add", "a.txt");
  git(outer, "commit", "-q", "-m", "o1");
  git(outer, "branch", "feat/x"); // the enclosing repo even has the branch: the wrong-repo read would "succeed"
  fs.appendFileSync(w.M, rowsFor(w, ["nested"]));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.deepEqual(errCodes(r), ["SISTER_REPO_NOT_GIT"]);
  assert.ok(r.stderr.includes(NOT_GIT("nested")), r.stderr);
  for (const leak of ["nested-plain", "outer", "../", TMP, os.tmpdir(), w.root]) {
    assert.ok(!r.stderr.includes(leak), `stderr must not hold ${leak}`);
  }
});

test("AC-E346-2 a subdirectory of the sister repo itself (not its root) -> the same rejection", () => {
  const w = makeWave({ sub: "../sister/sub" });
  fs.appendFileSync(w.M, rowsFor(w, ["sub"]));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.deepEqual(errCodes(r), ["SISTER_REPO_NOT_GIT"]);
  assert.ok(r.stderr.includes(NOT_GIT("sub")), r.stderr);
  assert.ok(!r.stderr.includes("sister/sub") && !r.stderr.includes(w.root), r.stderr);
});

test("AC-E346-3 a symlinked path to the sister root is accepted", () => {
  const w = makeWave({ viaLink: "../sister-link" });
  fs.symlinkSync(w.sister, path.join(w.root, "sister-link"), "dir");
  fs.appendFileSync(w.M, rowsFor(w, ["viaLink"]));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!r.stderr.includes("SISTER_REPO"), r.stderr);
});

test("AC-E346-3 a linked git worktree root is accepted", () => {
  const w = makeWave({ wt: "../sister-wt" });
  git(w.sister, "worktree", "add", "-q", path.join(w.root, "sister-wt"), "-b", "wt-branch");
  fs.appendFileSync(w.M, rowsFor(w, ["wt"]));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!r.stderr.includes("SISTER_REPO"), r.stderr);
});

test("AC-E346-3 control: the real sister root is still accepted, and a bad entry does not hide a good one", () => {
  const w = makeWave({ good: "../sister", sub: "../sister/sub" });
  fs.appendFileSync(w.M, rowsFor(w, ["good", "sub"]));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r), ["SISTER_REPO_NOT_GIT"]);
  assert.ok(r.stderr.includes('sister repo "sub"') && !r.stderr.includes('sister repo "good"'), r.stderr);
});

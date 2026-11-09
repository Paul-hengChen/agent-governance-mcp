// Coded by @qa-engineer
// Tests (T-E381-05) for specs/e381-fanout-and-ledger-fixes.md AC-E390-1..6 (D-E390): `fanout.mjs check <manifest>
// <lane>` without --base uses the target branch the manifest's `### 核對 primary` section RECORDED (`目標分支：<branch>
// @ <sha>`), as `handoff --check` does (E386), so a repo whose integration branch is not `main` is not stopped at a
// `main` default it never chose. With nothing usable recorded the default stays `main`; an explicit --base is
// unchanged. Each base REF_NOT_FOUND path has its own Copy-table message, asserted verbatim. AC-E390-7 (usage text)
// is a lane-level check; AC-E390-5's unedited part is test/e177a-check-cli.test.mjs. Fixtures are temp repos under
// os.tmpdir() (one with only `develop`) and in-test manifests; nothing reads real specs/fanout-*.md or a fixed sha.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseManifest, checkLane } from "../dist/tools/fanout-manifest.js";
import { runHandoff } from "../dist/tools/fanout-handoff.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e390-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}
const cli = (args) => {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

// Copy table (specs/e381-fanout-and-ledger-fixes.md), verbatim.
const COPY_FLAG = (x, repo) => `base ref "${x}" does not resolve (git rev-parse --verify) in ${repo}`;
const COPY_RECORDED = (b, repo) =>
  `base "${b}" is the target branch recorded in the manifest (目標分支 under ### 核對 primary) and does not resolve (git rev-parse --verify) in ${repo} — pass --base <ref> to check against another ref`;
const COPY_DEFAULT = (repo) =>
  `default base "main" does not resolve (git rev-parse --verify) in ${repo} and the manifest records no target branch (目標分支 under ### 核對 primary) — pass --base <ref>`;
const refNotFound = (msg) => `fanout: error: REF_NOT_FOUND: ${msg}\n`;

const manifestText = () =>
  [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "mailbox: ../lanes/_mailbox",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    "| a | E1 | feat/a | ../lanes/a | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
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

let n = 0;
/** primary whose only integration branch is `branch`, a bare origin, a lane branch feat/a with one in-bounds commit, and the manifest at specs/fanout-fx.md. */
function makeRepo(branch) {
  const root = path.join(TMP, `r${n++}`);
  const primary = path.join(root, "primary");
  fs.mkdirSync(path.join(primary, "specs"), { recursive: true });
  git(root, "init", "-q", "--bare", "-b", branch, "origin.git");
  git(primary, "init", "-q", "-b", branch);
  const M = path.join(primary, "specs", "fanout-fx.md");
  fs.writeFileSync(M, manifestText());
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "base");
  git(primary, "remote", "add", "origin", path.join(root, "origin.git"));
  git(primary, "push", "-q", "origin", branch);
  git(primary, "checkout", "-q", "-b", "feat/a");
  fs.mkdirSync(path.join(primary, "tools"), { recursive: true });
  fs.writeFileSync(path.join(primary, "tools", "a.ts"), "x\n");
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "lane");
  git(primary, "checkout", "-q", branch);
  return { root, primary, M };
}
/** Generate with an explicit target and paste the section into the manifest (uncommitted, as an integrator would). */
function withSection(w, target) {
  const g = runHandoff([w.M, "--target", target]);
  assert.equal(g.exitCode, 0, g.stderr);
  fs.appendFileSync(w.M, "\n" + g.stdout);
}
const rewriteTarget = (w, value) => {
  const text = fs.readFileSync(w.M, "utf8");
  const next = text.replace(/^(- 目標分支：).*$/m, `$1${value}`);
  assert.notEqual(next, text, "fixture: the 目標分支 line must exist");
  fs.writeFileSync(w.M, next);
};
const check = (w, ...extra) => cli(["check", w.M, "a", ...extra]);
const repoOf = (w) => path.dirname(path.resolve(w.M));

// --- AC-E390-1 ------------------------------------------------------------------------------------------------

test("AC-E390-1 develop-only repo: check without --base diffs develop...feat/a from the recorded target, no REF_NOT_FOUND", () => {
  // WHY: the section already says which branch the lane was cut against; a `main` default stopped a valid check.
  const w = makeRepo("develop");
  withSection(w, "develop");
  const r = check(w);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes("git diff --no-renames --name-only develop...feat/a"), r.stdout);
  assert.ok(!r.stdout.includes("REF_NOT_FOUND") && !r.stderr.includes("REF_NOT_FOUND"));
});

// --- AC-E390-2 ------------------------------------------------------------------------------------------------

const sameAsMain = (w) => {
  const dflt = check(w);
  const flagged = check(w, "--base", "main");
  assert.equal(dflt.status, flagged.status);
  assert.equal(dflt.stdout, flagged.stdout);
  assert.equal(dflt.stderr, flagged.stderr);
  assert.equal(dflt.status, 0, dflt.stdout + dflt.stderr);
  assert.ok(dflt.stdout.includes("main...feat/a"), dflt.stdout);
};

test("AC-E390-2 no 接手步驟 section: output and exit code are byte-identical to --base main", () => {
  sameAsMain(makeRepo("main"));
});

test("AC-E390-2 a section without a 目標分支 line: byte-identical to --base main", () => {
  const w = makeRepo("main");
  withSection(w, "main");
  fs.writeFileSync(w.M, fs.readFileSync(w.M, "utf8").replace(/^- 目標分支：.*\n/m, ""));
  sameAsMain(w);
});

test("AC-E390-2 an unparseable recorded value (<待填：…>): byte-identical to --base main", () => {
  const w = makeRepo("main");
  withSection(w, "main");
  rewriteTarget(w, "<待填：目標分支>");
  sameAsMain(w);
});

test("AC-E390-2 the 目標分支 line twice is ambiguous, so main: byte-identical to --base main", () => {
  // WHY: one fact line is the contract; with two, picking either would be a guess (reviewer note: falls back to main).
  const w = makeRepo("main");
  withSection(w, "main");
  const text = fs.readFileSync(w.M, "utf8");
  const line = /^- 目標分支：.*$/m.exec(text)[0];
  fs.writeFileSync(w.M, text.replace(line, `${line}\n${line.replace(/：.*$/, "：other @ abc1234")}`));
  sameAsMain(w);
});

// --- AC-E390-3 / 4 --------------------------------------------------------------------------------------------

test("AC-E390-3 develop-only repo, manifest records no target: exit 2 and err.base-default verbatim", () => {
  const w = makeRepo("develop");
  const r = check(w);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(r.stderr, refNotFound(COPY_DEFAULT(repoOf(w))));
});

test("AC-E390-4 a recorded target that does not resolve: exit 2 and err.base-recorded verbatim", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  rewriteTarget(w, "gone-branch @ abc1234");
  const r = check(w);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(r.stderr, refNotFound(COPY_RECORDED("gone-branch", repoOf(w))));
});

// --- AC-E390-5 ------------------------------------------------------------------------------------------------

test("AC-E390-5 an explicit --base wins over the recorded target", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  git(w.primary, "branch", "alt", "develop");
  const r = check(w, "--base", "alt");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes("alt...feat/a"), r.stdout);
  assert.ok(!r.stdout.includes("develop...feat/a"), r.stdout);
});

test("AC-E390-5 an explicit --base that does not resolve keeps err.base-flag, even when a target is recorded", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  const r = check(w, "--base", "nope");
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(r.stderr, refNotFound(COPY_FLAG("nope", repoOf(w))));
});

test("AC-E390-5 library checkLane without base still reports base main", () => {
  const w = makeRepo("main");
  const res = checkLane(parseManifest(fs.readFileSync(w.M, "utf8")), "a", { repo: w.primary });
  assert.equal(res.ok, true);
  assert.equal(res.report.base, "main");
});

// --- AC-E390-6 ------------------------------------------------------------------------------------------------

test("AC-E390-6 check and handoff --check agree on the recorded target (develop)", () => {
  // WHY: the resolver is duplicated rather than imported (module cycle); this pins the two against drift.
  const w = makeRepo("develop");
  withSection(w, "develop");
  const c = check(w);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.ok(c.stdout.includes("develop...feat/a"), c.stdout);
  const h = runHandoff(["--check", w.M]);
  assert.ok(!h.stdout.includes("REF_NOT_FOUND") && !h.stderr.includes("REF_NOT_FOUND"), h.stdout + h.stderr);
  assert.equal(h.exitCode, 0, h.stdout + h.stderr);
});

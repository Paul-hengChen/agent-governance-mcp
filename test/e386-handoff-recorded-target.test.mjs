// Coded by @qa-engineer
// Tests (T-E386-02) for specs/e384-design-mode-and-handoff-target.md AC-E386-1..6: `handoff --check` without
// `--target` compares against the target branch the manifest's `### 核對 primary` section RECORDED (`目標分支：<branch>
// @ <sha>`), so a repo whose integration branch is not `main` is not reported as broken. With nothing usable recorded
// the default stays `main`; an explicit `--target` is unchanged; generate / `--closing` keep the `main` default. Each
// REF_NOT_FOUND path has its own Copy-table message, asserted verbatim. Fixtures: temp repos under os.tmpdir() whose
// only branch is `develop` (no `main`), in-test manifests; nothing reads the real specs/fanout-*.md and nothing is
// compared with a fixed sha.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { runHandoff } from "../dist/tools/fanout-handoff.js";

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e386-")));
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

// Copy table (specs/e384-design-mode-and-handoff-target.md), verbatim.
const COPY_RECORDED = (b) =>
  `target branch "${b}" recorded in the manifest (目標分支 under ### 核對 primary) does not resolve to a commit (git rev-parse --verify) — pass --target <branch> to check against another branch`;
const COPY_DEFAULT =
  'default target "main" does not resolve to a commit (git rev-parse --verify) and the manifest records no target branch (目標分支 under ### 核對 primary) — pass --target <branch>';
const COPY_FLAG = (x) => `--target "${x}" does not resolve to a commit (git rev-parse --verify)`;
const refNotFound = (msg) => `fanout: error: REF_NOT_FOUND: ${msg}`;

const manifestText = () =>
  [
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

let n = 0;
/** primary whose only branch is `branch`, a bare origin, and the manifest committed at specs/fanout-fx.md. */
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
  return { root, primary, M };
}
/** Generate with an explicit target and paste the section into the manifest (uncommitted, as an integrator would). */
function withSection(w, target) {
  const g = run([w.M, "--target", target]);
  assert.equal(g.status, 0, g.stderr);
  fs.appendFileSync(w.M, "\n" + g.stdout);
  return g.stdout;
}
const summary = (r) => /^fanout handoff --check: (\d+) fact\(s\) checked, (\d+) differ, (\d+) moved$/m.exec(r.stdout)?.slice(1).map(Number);
const commit = (w, name) => {
  fs.writeFileSync(path.join(w.primary, name), "x\n");
  git(w.primary, "add", name);
  git(w.primary, "commit", "-q", "-m", name);
};

// --- AC-E386-1 / 2 ----------------------------------------------------------------------------------------------

test("AC-E386-1 develop-only repo: --check without --target uses the recorded develop, 0 differ, no REF_NOT_FOUND", () => {
  // WHY: the section already says which branch it was generated against; defaulting to `main` made a valid handoff look broken.
  const w = makeRepo("develop");
  withSection(w, "develop");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(summary(r)[1], 0);
  assert.ok(!r.stderr.includes("REF_NOT_FOUND") && !r.stdout.includes("REF_NOT_FOUND"));
});

test("AC-E386-2 after one more commit on develop the 目標分支 line is MOVED (前進 1 個 commit), exit 0", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  commit(w, "more.txt");
  git(w.primary, "push", "-q", "origin", "develop"); // keep the origin/unpushed facts unchanged: only the target moved
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const line = r.stdout.split("\n").find((l) => l.startsWith("MOVED") && l.includes("目標分支"));
  assert.ok(line?.includes("（前進 1 個 commit）"), r.stdout);
  assert.equal(summary(r)[1], 0);
});

// --- AC-E386-3 --------------------------------------------------------------------------------------------------

/** Replace the recorded 目標分支 fact value in the pasted section. */
function rewriteTargetFact(w, value) {
  const text = fs.readFileSync(w.M, "utf8");
  const next = text.replace(/^(- 目標分支：).*$/m, `$1${value}`);
  assert.notEqual(next, text, "fixture: the 目標分支 line must exist to be rewritten");
  fs.writeFileSync(w.M, next);
}

test("AC-E386-3 unparseable recorded value + repo WITHOUT main -> exit 2 REF_NOT_FOUND with err.target-default", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  rewriteTargetFact(w, "<待填：目標分支>");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2, r.stdout);
  assert.ok(r.stderr.includes(refNotFound(COPY_DEFAULT)), r.stderr);
});

test("AC-E386-3 unparseable recorded value + repo WITH main -> facts use main exactly as before", () => {
  const w = makeRepo("main");
  withSection(w, "main");
  const ok = run(["--check", w.M]);
  assert.equal(ok.status, 0, ok.stderr);
  rewriteTargetFact(w, "<待填：目標分支>");
  const r = run(["--check", w.M]);
  assert.equal(r.stderr.includes("REF_NOT_FOUND"), false, r.stderr);
  assert.equal(r.status, 1, "the placeholder differs from the real fact; main resolved");
  assert.ok(r.stdout.includes("目標分支"), r.stdout);
  assert.ok(r.stdout.includes(`main @ ${git(w.primary, "rev-parse", "--short=7", "main")}`), "the now-fact names main");
});

test("AC-E386-3 a section with no 目標分支 fact line at all: never recorded-target copy; main default", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  const text = fs.readFileSync(w.M, "utf8");
  fs.writeFileSync(w.M, text.replace(/^- 目標分支：.*\n/m, ""));
  const r = run(["--check", w.M]);
  // Either the reader rejects the section (exit 2, a different code) or the default applies; neither may claim a recorded target.
  assert.equal(r.status, 2, r.stdout);
  assert.ok(!r.stderr.includes("recorded in the manifest"), r.stderr);
});

// --- AC-E386-4 --------------------------------------------------------------------------------------------------

test("AC-E386-4 recorded branch that does not resolve -> exit 2 REF_NOT_FOUND with err.target-recorded", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  rewriteTargetFact(w, `gone-branch @ ${git(w.primary, "rev-parse", "--short=7", "HEAD")}`);
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2, r.stdout);
  assert.ok(r.stderr.includes(refNotFound(COPY_RECORDED("gone-branch"))), r.stderr);
  assert.ok(r.stderr.includes("--target"), "names the flag");
});

// --- AC-E386-5 --------------------------------------------------------------------------------------------------

test("AC-E386-5 explicit --target wins over the recorded one", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  git(w.primary, "branch", "other");
  commit(w, "later.txt"); // develop moves; `other` stays where the record was
  const r = run(["--check", w.M, "--target", "other"]);
  assert.equal(r.status, 1, r.stdout + r.stderr); // recorded `develop`, now `other`: a DIFF, proving `other` was used
  assert.ok(r.stdout.includes(`other @ ${git(w.primary, "rev-parse", "--short=7", "other")}`), r.stdout);
});

test("AC-E386-5 unresolvable explicit --target -> exit 2 with the byte-identical err.target-flag message", () => {
  const w = makeRepo("develop");
  withSection(w, "develop");
  const r = run(["--check", w.M, "--target", "nope"]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes(refNotFound(COPY_FLAG("nope"))), r.stderr);
  assert.ok(!r.stderr.includes("recorded in the manifest") && !r.stderr.includes("default target"), r.stderr);
});

// --- AC-E386-6 --------------------------------------------------------------------------------------------------

test("AC-E386-6 generate without --target in a repo with no main -> exit 2 err.target-default (also with --closing)", () => {
  const w = makeRepo("develop");
  for (const extra of [[], ["--closing"]]) {
    const r = run([w.M, ...extra]);
    assert.equal(r.status, 2, r.stdout);
    assert.ok(r.stderr.includes(refNotFound(COPY_DEFAULT)), r.stderr);
  }
});

test("AC-E386-6 generate without --target in a repo with main still targets main", () => {
  const w = makeRepo("main");
  for (const extra of [[], ["--closing"]]) {
    const r = run([w.M, ...extra]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(`main @ ${git(w.primary, "rev-parse", "--short=7", "main")}`), r.stdout);
  }
});

test("AC-E386-6 generate ignores a recorded target (only --check reads it)", () => {
  const w = makeRepo("develop");
  withSection(w, "develop"); // manifest now records develop
  const text = fs.readFileSync(w.M, "utf8");
  // generate against the manifest that already holds a section: still the main default -> REF_NOT_FOUND here
  const r = run([w.M]);
  assert.equal(fs.readFileSync(w.M, "utf8"), text, "generate never writes the manifest");
  assert.equal(r.status, 2, r.stdout);
  assert.ok(r.stderr.includes(refNotFound(COPY_DEFAULT)), r.stderr);
});

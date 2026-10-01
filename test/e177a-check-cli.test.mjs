// Coded by @qa-engineer
// Tests (T-E177A-07) for checkLane() and the thin scripts/fanout.mjs CLI
// (specs/e177a-fanout-manifest.md, AC9-AC12, AC15); test/e177a-manifest.test.mjs covers
// AC1-AC8, AC13, AC14. AC16 (build + suite) has no in-file assertion, see
// qa_reports/archive/release-v4.0.0/review_T-E177A-06.md. Fixtures are real throwaway git
// repos (committed refs only) plus the real test/fixtures/e177a/fanout-wave7.md.
// Rationale: specs/e260f-comment-rationale.md (test/e177a-check-cli.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseManifest, checkLane } from "../dist/tools/fanout-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const F = path.join(ROOT, "test", "fixtures", "e177a");
const MANIFEST = fs.readFileSync(path.join(F, "fanout-wave7.md"), "utf8");
const E177A_BRANCH = "feat/e177a-fanout-manifest";

// ---------------------------------------------------------------------------
// Fixture helpers (mirrors test/e126-merge-invariants.test.mjs)
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh, throwaway repo under os.tmpdir() — never inside this repo. Realpath'd so macOS's /tmp -> /private/tmp symlink never causes a path-identity mismatch. */
function mkRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e177a-check-")));
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  git(["config", "user.email", "a@b.c"], root);
  git(["config", "user.name", "t"], root);
  git(["config", "commit.gpgsign", "false"], root);
  return root;
}

/**
 * Wipe the tree then write exactly `files`, producing a commit object with
 * the given `parents` via `commit-tree` — never `git checkout`/`git commit`,
 * so this never depends on which branch (if any) is checked out.
 */
function commitTree(root, files, parents, message) {
  if (parents.length > 0) git(["rm", "-rq", "--ignore-unmatch", "-f", "."], root);
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(root, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  git(["add", "-A"], root);
  const tree = git(["write-tree"], root);
  return git(["commit-tree", tree, ...parents.flatMap((p) => ["-p", p]), "-m", message], root);
}

function setBranch(root, name, sha) {
  git(["update-ref", `refs/heads/${name}`, sha], root);
}

/** manifest with lane e177a's real (spec) 擁有/禁止/branch. */
function fanoutManifest() {
  return parseManifest(MANIFEST);
}

// ---------------------------------------------------------------------------
// AC9 — check passes when every changed file is in bounds
// ---------------------------------------------------------------------------

test("AC9 check in bounds", () => {
  const root = mkRepo();
  const base = commitTree(root, { "README.md": "x" }, [], "base");
  setBranch(root, "main", base);
  const branch = commitTree(
    root,
    {
      "README.md": "x",
      "tools/fanout-manifest.ts": "code",
      "dist/tools/fanout-manifest.js": "code",
      ".current/e177a/tasks.md": "t",
      "specs/e177a-fanout-manifest.md": "s",
      "qa_reports/review_T-E177A-01.md": "r",
    },
    [base],
    "branch",
  );
  setBranch(root, E177A_BRANCH, branch);

  const res = checkLane(fanoutManifest(), "e177a", { base: "main", repo: root });
  assert.equal(res.ok, true);
  const r = res.report;
  assert.equal(r.exitCode, 0);
  assert.equal(r.out.length, 0);
  assert.equal(r.changed.length, 5);
  assert.match(r.output, /owned \(from 擁有\): tools\/fanout-manifest\.ts/);
  assert.match(r.output, /implicit lane bookkeeping: \.current\/e177a\/\*\*, specs\/e177a-\*\.md, qa_reports\|review_reports\/\*e177a\* \(case-insensitive\)/);
  assert.match(r.output, /fanout check: e177a — 5 file\(s\) changed, 0 out of bounds/);
  assert.ok(!r.output.includes("OUT  "), "no OUT lines when everything is in bounds");
});

// ---------------------------------------------------------------------------
// AC10 — check fails when a changed file is out of bounds
// ---------------------------------------------------------------------------

test("AC10 check out of bounds", () => {
  const root = mkRepo();
  // Base carries the pre-rename path tools/x.ts.
  const base = commitTree(root, { "README.md": "x", "tools/x.ts": "old" }, [], "base");
  setBranch(root, "main", base);
  const branch = commitTree(
    root,
    {
      "README.md": "x",
      // tools/x.ts -> tools/fanout-manifest.ts: with --no-renames the old
      // path is a plain delete, so it must still show up as OUT.
      "tools/fanout-manifest.ts": "code",
      "dist/tools/fanout-manifest.js": "code",
      ".current/e177a/tasks.md": "t",
      "specs/e177a-fanout-manifest.md": "s",
      "qa_reports/review_T-E177A-01.md": "r",
      "bin/agc-init.mjs": "b",
      "docs/backlog.md": "d",
      "tools/lane-status.ts": "l",
    },
    [base],
    "branch",
  );
  setBranch(root, E177A_BRANCH, branch);

  const res = checkLane(fanoutManifest(), "e177a", { base: "main", repo: root });
  assert.equal(res.ok, true);
  const r = res.report;
  assert.equal(r.exitCode, 1);
  assert.equal(r.changed.length, 9);
  assert.equal(r.out.length, 4);

  const outPaths = r.out.map((o) => o.path);
  assert.deepEqual(outPaths, [...outPaths].sort(), "OUT paths must be sorted");
  assert.deepEqual(outPaths, ["bin/agc-init.mjs", "docs/backlog.md", "tools/lane-status.ts", "tools/x.ts"]);
  assert.ok(outPaths.includes("tools/x.ts"), "the rename source (deleted under --no-renames) must be listed");

  const byPath = Object.fromEntries(r.out.map((o) => [o.path, o.forbidden]));
  assert.equal(byPath["bin/agc-init.mjs"], "bin/**");
  assert.equal(byPath["docs/backlog.md"], "docs/**");
  assert.equal(byPath["tools/lane-status.ts"], undefined, "no 禁止 token matches this path");
  assert.equal(byPath["tools/x.ts"], undefined, "no 禁止 token matches this path");

  assert.match(r.output, /OUT {2}bin\/agc-init\.mjs {2}\(禁止: bin\/\*\*\)/);
  assert.match(r.output, /OUT {2}docs\/backlog\.md {2}\(禁止: docs\/\*\*\)/);
  assert.match(r.output, /OUT {2}tools\/lane-status\.ts\n/);
  assert.match(r.output, /OUT {2}tools\/x\.ts\n/);
  assert.match(r.output, /fanout check: e177a — 9 file\(s\) changed, 4 out of bounds/);
});

// ---------------------------------------------------------------------------
// AC11 — report disclaimers (committed-only scope, prose limits unchecked)
// ---------------------------------------------------------------------------

test("AC11 E158 disclaimer", () => {
  const e158 = /note: only committed changes were checked \(git diff --no-renames --name-only main\.\.\.feat\/e177a-fanout-manifest\); uncommitted and untracked work in the worktree was NOT checked \(E158\)\./;
  const prose = /note: prose restrictions inside 擁有 \(e\.g\. （只限 …）\) are not machine-checked\./;

  // exit 0 run (reuse AC9's shape)
  {
    const root = mkRepo();
    const base = commitTree(root, { "README.md": "x" }, [], "base");
    setBranch(root, "main", base);
    const branch = commitTree(root, { "README.md": "x", "tools/fanout-manifest.ts": "code" }, [base], "branch");
    setBranch(root, E177A_BRANCH, branch);
    const res = checkLane(fanoutManifest(), "e177a", { base: "main", repo: root });
    assert.equal(res.ok, true);
    assert.equal(res.report.exitCode, 0);
    assert.match(res.report.output, e158);
    assert.match(res.report.output, prose);
  }

  // exit 1 run (reuse AC10's shape)
  {
    const root = mkRepo();
    const base = commitTree(root, { "README.md": "x" }, [], "base");
    setBranch(root, "main", base);
    const branch = commitTree(root, { "README.md": "x", "docs/backlog.md": "d" }, [base], "branch");
    setBranch(root, E177A_BRANCH, branch);
    const res = checkLane(fanoutManifest(), "e177a", { base: "main", repo: root });
    assert.equal(res.ok, true);
    assert.equal(res.report.exitCode, 1);
    assert.match(res.report.output, e158);
    assert.match(res.report.output, prose);
  }
});

// ---------------------------------------------------------------------------
// AC12 — base ref and branch refs
// ---------------------------------------------------------------------------

test("AC12 check base and refs", () => {
  const root = mkRepo();
  const empty = commitTree(root, {}, [], "empty");
  const base = commitTree(root, { "README.md": "x" }, [empty], "base");
  setBranch(root, "main", base);
  setBranch(root, "other", empty);
  const branch = commitTree(root, { "README.md": "x", "tools/fanout-manifest.ts": "code" }, [base], "branch");
  setBranch(root, E177A_BRANCH, branch);

  // --base omitted -> base is "main"
  const defaultBase = checkLane(fanoutManifest(), "e177a", { repo: root });
  assert.equal(defaultBase.ok, true);
  assert.equal(defaultBase.report.base, "main");
  assert.deepEqual(defaultBase.report.changed, ["tools/fanout-manifest.ts"]);

  // --base other -> diff uses other...branch (other has no README.md either,
  // so README.md now also shows up as changed).
  const otherBase = checkLane(fanoutManifest(), "e177a", { base: "other", repo: root });
  assert.equal(otherBase.ok, true);
  assert.equal(otherBase.report.base, "other");
  assert.deepEqual(otherBase.report.changed, ["README.md", "tools/fanout-manifest.ts"]);

  // A base ref that does not resolve -> REF_NOT_FOUND naming the ref.
  const badBase = checkLane(fanoutManifest(), "e177a", { base: "does-not-exist", repo: root });
  assert.equal(badBase.ok, false);
  const baseErr = badBase.errors.find((e) => e.code === "REF_NOT_FOUND");
  assert.ok(baseErr);
  assert.match(baseErr.message, /does-not-exist/);

  // A branch ref that does not resolve -> REF_NOT_FOUND naming the ref
  // (build a manifest whose e177a row points at a branch that was never
  // created in this repo).
  const noBranchRepo = mkRepo();
  const nbBase = commitTree(noBranchRepo, { "README.md": "x" }, [], "base");
  setBranch(noBranchRepo, "main", nbBase);
  const badBranch = checkLane(fanoutManifest(), "e177a", { base: "main", repo: noBranchRepo });
  assert.equal(badBranch.ok, false);
  const branchErr = badBranch.errors.find((e) => e.code === "REF_NOT_FOUND");
  assert.ok(branchErr);
  assert.match(branchErr.message, new RegExp(E177A_BRANCH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  // --repo not inside a git repository -> REPO_NOT_GIT
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), "e177a-notrepo-"));
  const notGit = checkLane(fanoutManifest(), "e177a", { base: "main", repo: notRepo });
  assert.equal(notGit.ok, false);
  assert.ok(notGit.errors.some((e) => e.code === "REPO_NOT_GIT"));
});

// ---------------------------------------------------------------------------
// AC15 — CLI exit and output contract
// ---------------------------------------------------------------------------

function runCli(args, cwd = ROOT) {
  try {
    const stdout = execFileSync("node", ["scripts/fanout.mjs", ...args], { cwd, encoding: "utf8" });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", status: err.status };
  }
}

test("AC15 CLI contract", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts", "fanout.mjs"), "utf8");
  const importCount = (src.match(/from "\.\.\/dist\/tools\/fanout-manifest\.js"/g) ?? []).length;
  assert.equal(importCount, 1, 'scripts/fanout.mjs must have exactly one import from "../dist/tools/fanout-manifest.js"');
  assert.equal(
    (src.match(/from ["']\.\.\/dist\//g) ?? []).length,
    1,
    "scripts/fanout.mjs must import from dist/ exactly once total (thin CLI, no other logic module)",
  );

  const noSub = runCli([]);
  assert.equal(noSub.status, 2);
  assert.equal(noSub.stdout, "");
  assert.match(noSub.stderr, /^usage: node scripts\/fanout\.mjs validate/);

  const unknownSub = runCli(["bogus"]);
  assert.equal(unknownSub.status, 2);
  assert.equal(unknownSub.stdout, "");
  assert.match(unknownSub.stderr, /^usage: node scripts\/fanout\.mjs validate/);

  const ok = runCli(["validate", path.join(F, "fanout-wave7.md")]);
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, "fanout: ok — 4 dispatchable lane(s), 2 provisional, 5 decision(s)\n");

  const parseErr = runCli(["render", path.join(F, "fanout-wave7.md"), "e130", "--summary", "S", "--reading", "R"]);
  assert.equal(parseErr.status, 2);
  assert.equal(parseErr.stdout, "");
  assert.match(parseErr.stderr, /^fanout: error: LANE_PROVISIONAL: /);

  const outOfBounds = (() => {
    const root = mkRepo();
    const base = commitTree(root, { "README.md": "x" }, [], "base");
    setBranch(root, "main", base);
    const branch = commitTree(root, { "README.md": "x", "docs/backlog.md": "d" }, [base], "branch");
    setBranch(root, E177A_BRANCH, branch);
    return runCli(["check", path.join(F, "fanout-wave7.md"), "e177a", "--repo", root]);
  })();
  assert.equal(outOfBounds.status, 1, "check exits 1 when out-of-bounds files are found");
  assert.match(outOfBounds.stdout, /fanout check: e177a — \d+ file\(s\) changed, \d+ out of bounds/);
});

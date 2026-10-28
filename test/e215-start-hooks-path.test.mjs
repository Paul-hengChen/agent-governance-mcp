// Coded by @qa-engineer
// E215 (T-E215-02): `agc feature start` warns, once and on stderr, when the repository's relative
// `core.hooksPath` names a directory that primary has but the fresh lane worktree lacks (husky's
// git-ignored `.husky/_`), because git then runs NO hooks in the lane. It never creates anything.
// Spec: specs/e217-lane-lifecycle-gaps.md (AC-E215-1..6; AC-E215-7 is the unmodified e291 suite,
// AC-E215-8 a diff grep). Every fixture repository is built in os.tmpdir() at runtime, and every
// "quiet" case is compared with a run of the same fixture without core.hooksPath, so no output
// literal of the surrounding start lines is pinned here.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const gitStatus = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const exists = (p) => {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

const HOOKS_MISSING_RE = /agc feature start — warning: core\.hooksPath "/;
const hooksWarning = (v) =>
  `agc feature start — warning: core.hooksPath "${v}" is a relative path that the primary checkout has but the lane ` +
  `worktree does not — git runs NO hooks in this lane until it exists; recreate it inside the lane with the tool ` +
  `that generated it (for husky: \`npx husky\`)`;

// Primary with a husky-shaped layout: tracked `.husky/commit-msg`, git-ignored generated `.husky/_/`,
// tracked `.githooks/`. `hooksPath` (when given) is set in the shared repo config.
function makeRepo({ hooksPath, extraUntracked = {} } = {}) {
  const r = mkTmp("e215-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, ".gitignore"), ".husky/_/\n");
  writeFile(path.join(r, "README.md"), "x\n");
  writeFile(path.join(r, ".husky", "commit-msg"), "#!/bin/sh\n");
  writeFile(path.join(r, ".githooks", "commit-msg"), "#!/bin/sh\n");
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  writeFile(path.join(r, ".husky", "_", "h"), "generated\n");
  for (const [rel, body] of Object.entries(extraUntracked)) writeFile(path.join(r, rel), body);
  if (hooksPath !== undefined) git(r, ["config", "core.hooksPath", hooksPath]);
  return r;
}

// Runs `feature start <ticket>-x`; output is normalized so two fixtures compare byte for byte.
function start(repo, { ticket = "e215a", laneArg, env, extra = [] } = {}) {
  const lane = laneArg ?? path.join(mkTmp("e215-lane-"), "lane");
  const res = spawnSync(process.execPath, [AGC_INIT, "feature", "start", `${ticket}-x`, "--path", lane, ...extra], {
    cwd: repo,
    encoding: "utf-8",
    env: env ?? process.env,
  });
  const P = fs.realpathSync(repo);
  const norm = (s) => s.split(P).join("<P>").split(repo).join("<P>").split(lane).join("<L>");
  return { res, lane, out: norm(res.stdout), err: norm(res.stderr), P };
}
const excludeRules = (repo) =>
  fs
    .readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8")
    .split("\n")
    .filter((l) => l.length > 0 && !l.startsWith("#"));

// ============================================================================
// AC-E215-1 — warn
// ============================================================================
test("AC-E215-1: a relative hooksPath missing in the lane but present in primary warns once on stderr; stdout unchanged", () => {
  const base = start(makeRepo());
  assert.equal(base.res.status, 0, base.res.stderr);

  const withHooks = start(makeRepo({ hooksPath: ".husky/_" }));
  assert.equal(withHooks.res.status, 0, withHooks.res.stderr);
  const warnings = withHooks.err.split("\n").filter((l) => HOOKS_MISSING_RE.test(l));
  assert.deepEqual(warnings, [hooksWarning(".husky/_")], "exactly one e215.hooks-missing line, {v} = .husky/_");
  assert.equal(withHooks.out, base.out, "stdout byte-identical to the run without core.hooksPath");
  assert.equal(
    withHooks.err.split("\n").filter((l) => !HOOKS_MISSING_RE.test(l)).join("\n"),
    base.err,
    "the rest of stderr is unchanged",
  );
});

// ============================================================================
// AC-E215-2 — quiet when there is nothing lane-specific
// ============================================================================
const QUIET_CASES = [
  ["(a) core.hooksPath unset", undefined],
  ["(b) absolute path", "ABS"],
  ["(c) starts with ~", "~/e215-hooks-that-do-not-matter"],
  ["(d) relative and present in the lane (tracked .githooks)", ".githooks"],
  ["(e) relative and missing in primary too", ".missing-everywhere/_"],
];
for (const [label, value] of QUIET_CASES) {
  test(`AC-E215-2: ${label} -> no warning, output identical to a run without core.hooksPath`, () => {
    const base = start(makeRepo());
    assert.equal(base.res.status, 0, base.res.stderr);
    const repo = makeRepo();
    const resolved = value === "ABS" ? path.join(repo, ".husky", "_") : value;
    if (resolved !== undefined) git(repo, ["config", "core.hooksPath", resolved]);
    const run = start(repo);
    assert.equal(run.res.status, 0, run.res.stderr);
    assert.ok(!HOOKS_MISSING_RE.test(run.err), run.err);
    assert.equal(run.out, base.out);
    assert.equal(run.err, base.err);
  });
}

// ============================================================================
// AC-E215-3 — warn only, nothing created
// ============================================================================
test("AC-E215-3: the warning run creates no hooks entry, leaves the lane clean and the shared exclude unchanged", () => {
  const baseRepo = makeRepo();
  start(baseRepo);
  const repo = makeRepo({ hooksPath: ".husky/_" });
  const { res, lane, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(HOOKS_MISSING_RE.test(err), "precondition: the warning fired");
  assert.ok(!exists(path.join(lane, ".husky", "_")), "no .husky/_ entry of any kind (not a dir, not a link)");
  assert.equal(git(lane, ["status", "--porcelain"]), "", "lane status is empty");
  assert.deepEqual(excludeRules(repo), excludeRules(baseRepo), "same shared exclude rules as without core.hooksPath");
  assert.ok(exists(path.join(repo, ".husky", "_", "h")), "primary's generated directory is untouched");
});

// ============================================================================
// AC-E215-4 — refusals and rollback unchanged
// ============================================================================
const REFUSALS = [
  [
    "branch exists",
    (repo) => {
      git(repo, ["branch", "feat/e215r-x"]);
      return {};
    },
    (repo) => assert.ok(gitStatus(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e215r-x"]) === 0),
  ],
  [
    "path exists",
    () => {
      const laneArg = mkTmp("e215-existing-path-");
      return { laneArg };
    },
    (repo) =>
      assert.notEqual(gitStatus(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e215r-x"]), 0, "no branch created"),
  ],
  [
    "path still registered as a worktree",
    (repo) => {
      const laneArg = path.join(mkTmp("e215-registered-"), "lane");
      git(repo, ["worktree", "add", "--detach", laneArg]);
      fs.rmSync(laneArg, { recursive: true, force: true });
      return { laneArg };
    },
    (repo) =>
      assert.notEqual(gitStatus(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e215r-x"]), 0, "no branch created"),
  ],
  [
    "git worktree add fails",
    () => {
      const blocker = path.join(mkTmp("e215-blocker-"), "file");
      fs.writeFileSync(blocker, "a file where a directory parent is needed\n");
      return { laneArg: path.join(blocker, "lane") };
    },
    (repo) =>
      assert.notEqual(gitStatus(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e215r-x"]), 0, "branch rolled back"),
  ],
];
for (const [label, setup, check] of REFUSALS) {
  test(`AC-E215-4: refusal "${label}" prints no hooks warning and behaves as without core.hooksPath`, () => {
    const baseRepo = makeRepo();
    const base = start(baseRepo, { ticket: "e215r", ...setup(baseRepo) });
    const repo = makeRepo({ hooksPath: ".husky/_" });
    const run = start(repo, { ticket: "e215r", ...setup(repo) });
    assert.notEqual(run.res.status, 0, "start must still refuse");
    assert.equal(run.res.status, base.res.status);
    assert.ok(!HOOKS_MISSING_RE.test(run.err), run.err);
    assert.equal(run.out, base.out);
    assert.equal(run.err, base.err);
    check(repo);
    assert.deepEqual(excludeRules(repo), excludeRules(baseRepo));
  });
}

// ============================================================================
// AC-E215-5 — control characters escaped
// ============================================================================
test("AC-E215-5: an ESC byte in a relative hooksPath is shown as \\x1b; no raw control byte on stderr", () => {
  const value = ".hk\x1bdir";
  const repo = makeRepo({ extraUntracked: { [path.join(value, "h")]: "generated\n" }, hooksPath: value });
  const { res, err } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(err.includes(hooksWarning(".hk\\x1bdir")), err);
  assert.ok(!/[\x00-\x09\x0b-\x1f\x7f]/.test(res.stderr), "no raw control byte on stderr");
});

// ============================================================================
// AC-E215-6 — best effort, never fatal
// ============================================================================
test(
  "AC-E215-6: a `git config --get core.hooksPath` exit status other than 0/1 skips the check silently",
  { skip: process.platform === "win32" && "needs a POSIX shell shim" },
  () => {
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf-8" }).trim();
    const shim = mkTmp("e215-git-shim-");
    writeFile(
      path.join(shim, "git"),
      `#!/bin/sh\nif [ "$1" = config ] && [ "$2" = --get ] && [ "$3" = core.hooksPath ]; then\n  echo "fatal: simulated config failure" >&2\n  exit 2\nfi\nexec "${realGit}" "$@"\n`,
    );
    fs.chmodSync(path.join(shim, "git"), 0o755);
    const env = { ...process.env, PATH: `${shim}${path.delimiter}${process.env.PATH}` };

    const base = start(makeRepo());
    const run = start(makeRepo({ hooksPath: ".husky/_" }), { env });
    assert.equal(run.res.status, 0, run.res.stderr);
    assert.ok(!HOOKS_MISSING_RE.test(run.err), "the check is skipped, not warned");
    assert.ok(!run.err.includes("simulated config failure"), "git's own stderr never leaks into start's output");
    assert.equal(run.out, base.out, "normal output");
    assert.equal(run.err, base.err, "no extra stderr");
    assert.ok(exists(run.lane), "the lane was created");
  },
);

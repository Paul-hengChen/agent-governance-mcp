// Coded by @qa-engineer
// Tests that `agc init` run from a subdirectory of a git repo writes
// .git/info/exclude rules anchored under that subdirectory, and that
// `agc check` reads them back the same way (specs/e239-init-subdir-exclude.md
// AC1-AC13). AC14 is checked by grep, not by a test here. AC3 is the existing
// test/e106-init-artifacts-flag.test.mjs suite passing unchanged; this file
// only adds one regression case to it.
//
// Also tests that a subdirectory name containing a backslash or a control
// character is refused for local mode, like the other gitignore-unsafe names
// (specs/e243-init-path-escape-refusal.md AC15-AC20). Those cases follow the
// "E243" banner below. The AC8 and AC13 message patterns match the wider
// refusal text (AC12). AC6/AC7/AC13(E243)/AC8(E243) are code-level
// confirmations in that spec, not separate test cases here. (T-E243-04)
//
// Spec-to-test map:
//   AC1  -> "AC1: subdir default-local writes subdir-prefixed exclude rules"
//   AC2  -> "AC2: scaffold created under subdir is actually ignored by the written rules"
//   AC3  -> test/e106-init-artifacts-flag.test.mjs's existing suite (unmodified) +
//           its appended "AC3 regression (E239): ..." case
//   AC4  -> "AC4: subdir already-tracked warning is subdir-prefixed and repo-root-qualified"
//   AC5  -> "AC5: subdir omitted-flag tracked detection uses subdir-prefixed paths"
//   AC6  -> "AC6: subdir re-run is idempotent, no duplicate exclude lines"
//   AC7  -> "AC7: subdir repo mode still writes no exclude rules"
//   AC8  -> "AC8: gitignore-metacharacter subdir name refuses local mode cleanly"
//   AC9  -> "AC9: gitignore-metacharacter subdir name is fine under explicit repo mode"
//   AC10 -> "AC10: agc check subdir declared-and-matching is silent"
//   AC11 -> "AC11: agc check subdir drift detection mirrors the root case"
//   AC12 -> "AC12: agc check does not cross-contaminate root and subdir artifact rule sets"
//   AC13 -> "AC13: agc check advises rather than mis-tests on a gitignore-unsafe subdir path"
//
// Every scratch repo is a REAL git repository built under os.tmpdir() via
// `git init` + a local identity (never this checkout or the lane worktree,
// and never the ambient global git config) — same discipline as
// test/e106-init-artifacts-flag.test.mjs, which this file is a sibling of.
//
// The bug these tests guard against: without the subdirectory prefix,
// .git/info/exclude gets root-anchored rules (/.current/, /tasks.md,
// /qa_reports/, /review_reports/) even when init runs in `sub`, so
// `git check-ignore -v sub/.current/anything` and `git check-ignore -v
// sub/tasks.md` match nothing and the scaffold shows up as untracked. The
// AC1/AC2 scenario was confirmed to fail that way on the code before the
// fix. (T-E239-02)

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

// Same four rules, re-anchored under a repo-relative prefix — exactly what
// artifactExcludeRulesForPrefix(prefix) in bin/agc-init.mjs computes; this
// test file re-derives it independently (black-box, CLI-level) rather than
// importing the internal helper, mirroring how test/e106-init-artifacts-flag.test.mjs
// asserts against the root-level ARTIFACT_EXCLUDE_RULES constant rather than
// reaching into the module.
function prefixedRules(prefix) {
  return ARTIFACT_EXCLUDE_RULES.map((rule) => `/${prefix}${rule}`);
}

// ---------------------------------------------------------------------------
// Cleanup registry — mirrors test/e106-init-artifacts-flag.test.mjs.
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

function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
}

function readConfig(ws) {
  return JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));
}

function readExclude(repo) {
  return fs.readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8");
}

function excludeLineSet(repo) {
  return new Set(
    readExclude(repo)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#")),
  );
}

function seedConfig(ws, obj) {
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify(obj, null, 2) + "\n");
}

function mkSub(repo, rel = "sub") {
  const sub = path.join(repo, rel);
  fs.mkdirSync(sub, { recursive: true });
  return sub;
}

function checkIgnore(repo, relPath) {
  return spawnSync("git", ["check-ignore", "-v", relPath], { cwd: repo, encoding: "utf-8" });
}

// ---------------------------------------------------------------------------
// AC1 — subdir default-local writes subdir-prefixed exclude rules
// ---------------------------------------------------------------------------
test("AC1: subdir default-local writes subdir-prefixed exclude rules", () => {
  const repo = mkGitRepo("e239-ac1-");
  const sub = mkSub(repo);
  const r = runAgc(sub, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.deepEqual(readConfig(sub), { schema_version: 2, host: "claude-code", artifacts: "local" });

  const lines = excludeLineSet(repo);
  for (const rule of prefixedRules("sub")) {
    assert.ok(lines.has(rule), `expected ${rule} in .git/info/exclude, got: ${[...lines].join(", ")}`);
  }
  // Never the un-prefixed root-anchored strings — this is the exact bug
  // being fixed: writing them from a subdir would silently miss the scaffold.
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.ok(!lines.has(rule), `un-prefixed rule ${rule} must NOT be written for a subdir workspace`);
  }
});

// ---------------------------------------------------------------------------
// AC2 — scaffold created under subdir is actually ignored by the written rules
// ---------------------------------------------------------------------------
test("AC2: scaffold created under subdir is actually ignored by the written rules", () => {
  const repo = mkGitRepo("e239-ac2-");
  const sub = mkSub(repo);
  const r = runAgc(sub, ["init", "--artifacts=local"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  const ig1 = checkIgnore(repo, "sub/.current/anything");
  const ig2 = checkIgnore(repo, "sub/tasks.md");
  assert.equal(ig1.status, 0, `sub/.current/anything must be ignored (stdout=${ig1.stdout} stderr=${ig1.stderr})`);
  assert.equal(ig2.status, 0, `sub/tasks.md must be ignored (stdout=${ig2.stdout} stderr=${ig2.stderr})`);
});

// ---------------------------------------------------------------------------
// AC4 — subdir already-tracked warning is subdir-prefixed and repo-root-qualified
// ---------------------------------------------------------------------------
test("AC4: subdir already-tracked warning is subdir-prefixed and repo-root-qualified", () => {
  const repo = mkGitRepo("e239-ac4-");
  const sub = mkSub(repo);
  fs.mkdirSync(path.join(sub, ".current"), { recursive: true });
  fs.writeFileSync(path.join(sub, ".current", "handoff.md"), "seed\n");
  fs.writeFileSync(path.join(sub, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "pre-existing tracked artifacts under sub/"]);

  const r = runAgc(sub, ["init", "--artifacts=local"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  // Display list is subdir-prefixed.
  assert.match(r.stderr, /^  sub\/\.current\/$/m, `stderr=${r.stderr}`);
  assert.match(r.stderr, /^  sub\/tasks\.md$/m, `stderr=${r.stderr}`);
  // Never the bare, un-prefixed display form.
  assert.doesNotMatch(r.stderr, /^  \.current\/$/m);
  assert.doesNotMatch(r.stderr, /^  tasks\.md$/m);

  // Untrack command targets are subdir-prefixed, and the qualifier is present.
  assert.match(r.stderr, /Untrack them with \(run from the repository root\):/);
  assert.match(r.stderr, /git rm -r --cached sub\/\.current sub\/tasks\.md/);
  assert.match(r.stderr, /Note: history still contains these files after that command\./);

  // Still tracked — agc never runs git rm itself.
  const tracked = git(repo, ["ls-files", "--", "sub/.current", "sub/tasks.md"]).trim().split("\n").filter(Boolean);
  assert.ok(tracked.includes("sub/.current/handoff.md"));
  assert.ok(tracked.includes("sub/tasks.md"));
});

// ---------------------------------------------------------------------------
// AC5 — subdir omitted-flag tracked detection uses subdir-prefixed paths
// ---------------------------------------------------------------------------
test("AC5: subdir omitted-flag tracked detection uses subdir-prefixed paths", () => {
  const repo = mkGitRepo("e239-ac5-");
  const sub = mkSub(repo);
  fs.writeFileSync(path.join(sub, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "pre-existing tracked sub/tasks.md"]);

  const before = readExclude(repo);
  const r = runAgc(sub, ["init"]); // flag OMITTED
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  const cfg = readConfig(sub);
  assert.equal(cfg.artifacts, undefined, "artifacts must stay undeclared, not silently default to local");
  assert.ok(!Object.prototype.hasOwnProperty.call(cfg, "artifacts"));
  assert.equal(readExclude(repo), before, "no exclude rules written when the flag is omitted on a tracked tree");

  assert.match(r.stderr, /already tracked in this repo/);
  assert.match(r.stderr, /^  sub\/tasks\.md$/m, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stderr, /^  tasks\.md$/m, "must never print the un-prefixed root-anchored path");
  assert.match(r.stderr, /re-run with --artifacts=local or --artifacts=repo to choose explicitly/);
});

// ---------------------------------------------------------------------------
// AC6 — subdir re-run is idempotent, no duplicate exclude lines
// ---------------------------------------------------------------------------
test("AC6: subdir re-run is idempotent, no duplicate exclude lines", () => {
  const repo = mkGitRepo("e239-ac6-");
  const sub = mkSub(repo);
  assert.equal(runAgc(sub, ["init", "--artifacts=local"]).status, 0);
  const afterFirst = readExclude(repo);
  const r2 = runAgc(sub, ["init", "--artifacts=local"]);
  assert.equal(r2.status, 0, `exit code (stderr=${r2.stderr})`);
  assert.equal(readExclude(repo), afterFirst, "second run must add zero new lines");

  const nonCommentLines = readExclude(repo)
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith("#"));
  assert.equal(nonCommentLines.length, 4, `expected exactly 4 non-comment lines, got: ${nonCommentLines.join(", ")}`);
});

// ---------------------------------------------------------------------------
// AC7 — subdir repo mode still writes no exclude rules
// ---------------------------------------------------------------------------
test("AC7: subdir repo mode still writes no exclude rules", () => {
  const repo = mkGitRepo("e239-ac7-");
  const sub = mkSub(repo);
  const before = readExclude(repo); // git init's default template
  const r = runAgc(sub, ["init", "--artifacts=repo"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.equal(readExclude(repo), before, ".git/info/exclude must be byte-identical — repo mode writes nothing there");
  assert.deepEqual(readConfig(sub), { schema_version: 2, host: "claude-code", artifacts: "repo" });
});

// ---------------------------------------------------------------------------
// AC8 — gitignore-metacharacter subdir name refuses local mode cleanly
// ---------------------------------------------------------------------------
test("AC8: gitignore-metacharacter subdir name refuses local mode cleanly", () => {
  // Sub-case (a): flag omitted, nothing tracked -> would default to local -> refuses.
  {
    const repo = mkGitRepo("e239-ac8a-");
    const weird = mkSub(repo, "weird[dir]");
    const r = runAgc(weird, ["init"]);
    assert.equal(r.status, 2, `expected exit 2 (stderr=${r.stderr})`);
    assert.match(
      r.stderr,
      /agc init: refusing --artifacts=local — workspace path segment "weird\[dir\]" contains a character unsafe for a gitignore exclude rule \(a wildcard, a backslash, or a control character\), so the exclude rule agc would write could match unintended files or be split across lines\. Rename the directory, or re-run with --artifacts=repo\./,
    );
    assert.ok(!fs.existsSync(path.join(weird, ".current")), "no partial scaffold left behind");
    assert.ok(!fs.existsSync(path.join(weird, "tasks.md")), "no partial scaffold left behind");
  }
  // Sub-case (b): explicit --artifacts=local -> also refuses.
  {
    const repo = mkGitRepo("e239-ac8b-");
    const weird = mkSub(repo, "weird[dir]");
    const r = runAgc(weird, ["init", "--artifacts=local"]);
    assert.equal(r.status, 2, `expected exit 2 (stderr=${r.stderr})`);
    assert.match(r.stderr, /workspace path segment "weird\[dir\]"/);
    assert.ok(!fs.existsSync(path.join(weird, ".current")), "no partial scaffold left behind");
  }
});

// ---------------------------------------------------------------------------
// AC9 — gitignore-metacharacter subdir name is fine under explicit repo mode
// ---------------------------------------------------------------------------
test("AC9: gitignore-metacharacter subdir name is fine under explicit repo mode", () => {
  const repo = mkGitRepo("e239-ac9-");
  const weird = mkSub(repo, "weird[dir]");
  const before = readExclude(repo);
  const r = runAgc(weird, ["init", "--artifacts=repo"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.deepEqual(readConfig(weird), { schema_version: 2, host: "claude-code", artifacts: "repo" });
  assert.equal(readExclude(repo), before, "repo mode writes no exclude rules even under a wildcard-named dir");
});

// ---------------------------------------------------------------------------
// AC10 — agc check subdir declared-and-matching is silent
// ---------------------------------------------------------------------------
test("AC10: agc check subdir declared-and-matching is silent", () => {
  const repo = mkGitRepo("e239-ac10-");
  const sub = mkSub(repo);
  seedConfig(sub, { schema_version: 2, host: "claude-code", artifacts: "local" });
  fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), prefixedRules("sub").join("\n") + "\n");

  const r = runAgc(sub, ["check"]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stderr, /artifacts (drift|undeclared)/, `stderr=${r.stderr}`);
});

// ---------------------------------------------------------------------------
// AC11 — agc check subdir drift detection mirrors the root case
// ---------------------------------------------------------------------------
test("AC11: agc check subdir drift detection mirrors the root case", () => {
  // Sub-case (a): declared local, subdir-prefixed rules never written.
  {
    const repo = mkGitRepo("e239-ac11a-");
    const sub = mkSub(repo);
    seedConfig(sub, { schema_version: 2, host: "claude-code", artifacts: "local" });
    const r = runAgc(sub, ["check"]);
    assert.equal(r.status, 0);
    assert.match(
      r.stderr,
      /artifacts drift: config declares "local" but exclude rules are missing from \.git\/info\/exclude/,
    );
  }
  // Sub-case (b): declared local, rules present, but a subdir artifact path is tracked.
  {
    const repo = mkGitRepo("e239-ac11b-");
    const sub = mkSub(repo);
    seedConfig(sub, { schema_version: 2, host: "claude-code", artifacts: "local" });
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-q", "-m", "tracks sub/.current/.config.json"]);
    fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), prefixedRules("sub").join("\n") + "\n");
    const r = runAgc(sub, ["check"]);
    assert.equal(r.status, 0);
    assert.match(
      r.stderr,
      /artifacts drift: config declares "local" but sub\/\.current\/ is tracked despite local mode/,
      `stderr=${r.stderr}`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC12 — agc check does not cross-contaminate root and subdir artifact rule sets
// ---------------------------------------------------------------------------
test("AC12: agc check does not cross-contaminate root and subdir artifact rule sets", () => {
  const repo = mkGitRepo("e239-ac12-");
  const sub = mkSub(repo);
  seedConfig(sub, { schema_version: 2, host: "claude-code", artifacts: "repo" });
  // Root's own, earlier `agc init --artifacts=local` run left root-anchored rules.
  fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), ARTIFACT_EXCLUDE_RULES.join("\n") + "\n");

  const r = runAgc(sub, ["check"]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(
    r.stderr,
    /artifacts drift/,
    "the root workspace's rules must never count as the subdir workspace's rules",
  );
});

// ---------------------------------------------------------------------------
// AC13 — agc check advises rather than mis-tests on a gitignore-unsafe subdir path
// ---------------------------------------------------------------------------
test("AC13: agc check advises rather than mis-tests on a gitignore-unsafe subdir path", () => {
  const repo = mkGitRepo("e239-ac13-");
  const weird = mkSub(repo, "weird[dir]");
  // Hand-authored, since `agc init` itself would have refused per AC8.
  seedConfig(weird, { schema_version: 2, host: "claude-code", artifacts: "local" });

  const r = runAgc(weird, ["check"]);
  assert.equal(r.status, 0);
  assert.match(
    r.stderr,
    /agc check — cannot verify artifacts drift: workspace path segment "weird\[dir\]" contains a character unsafe for a gitignore exclude rule \(a wildcard, a backslash, or a control character\) — rename the directory, or declare artifacts explicitly via agc init --artifacts=repo/,
  );
  assert.doesNotMatch(
    r.stderr,
    /config declares/,
    "must advise, not attempt (and get wrong) the normal drift() test, which is what config-declares would signal",
  );
});

// ---------------------------------------------------------------------------
// Backslash and control-character subdirectory names. The one shared
// predicate (repoRelativeWorkspacePrefix()'s unsafeSegment, computed via
// GITIGNORE_UNSAFE_SEGMENT_RE) treats a literal backslash and the C0 control
// range (0x01-0x1F) + DEL (0x7F) as unsafe, on top of the gitignore wildcard
// characters. AC15-AC20 below cover these names; AC8/AC13 above match the
// wider refusal text (AC12).
//
// Why these names must be refused for local mode: a pattern that only knows
// the wildcard characters (`/[*?[\]]/`) lets them through, and init then
// writes a `.config.json` declaring "local" plus a wrong exclude rule. A
// backslash segment ("a\b") becomes a rule git reads as `/ab/.current/`, so
// `git check-ignore -v` on the real `a\b/.current/foo` path matches nothing
// and `git status --short` shows the directory as untracked
// (`?? "a\\b/"`). A CR-bearing segment writes a raw 0x0D byte into
// `.git/info/exclude`, splitting the one intended rule across lines. Both
// failures were confirmed on the code before the fix. (E243)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC15 — backslash subdir name refuses local mode cleanly (E243)
// ---------------------------------------------------------------------------
test("AC15: backslash subdir name refuses local mode cleanly", (t) => {
  if (process.platform === "win32") {
    t.skip(
      'a literal backslash can never survive inside one path segment on win32 (path.sep is "\\\\", so it is always consumed as a separator before repoRelativeWorkspacePrefix() tests a segment) — AC13 covers this platform behavior directly',
    );
    return;
  }
  // Sub-case (a): flag omitted, nothing tracked -> would default to local -> refuses.
  {
    const repo = mkGitRepo("e243-ac15a-");
    const weird = mkSub(repo, "a\\b");
    const r = runAgc(weird, ["init"]);
    assert.equal(r.status, 2, `expected exit 2 (stderr=${r.stderr})`);
    assert.match(
      r.stderr,
      /agc init: refusing --artifacts=local — workspace path segment "a\\b" contains a character unsafe for a gitignore exclude rule \(a wildcard, a backslash, or a control character\), so the exclude rule agc would write could match unintended files or be split across lines\. Rename the directory, or re-run with --artifacts=repo\./,
    );
    assert.ok(!fs.existsSync(path.join(weird, ".current")), "no partial scaffold left behind");
    assert.ok(!fs.existsSync(path.join(weird, "tasks.md")), "no partial scaffold left behind");
  }
  // Sub-case (b): explicit --artifacts=local -> also refuses.
  {
    const repo = mkGitRepo("e243-ac15b-");
    const weird = mkSub(repo, "a\\b");
    const r = runAgc(weird, ["init", "--artifacts=local"]);
    assert.equal(r.status, 2, `expected exit 2 (stderr=${r.stderr})`);
    assert.match(r.stderr, /workspace path segment "a\\b"/);
    assert.ok(!fs.existsSync(path.join(weird, ".current")), "no partial scaffold left behind");
  }
});

// ---------------------------------------------------------------------------
// AC16 — CR/LF subdir name refuses local mode cleanly (E243)
// ---------------------------------------------------------------------------
test("AC16: CR/LF subdir name refuses local mode cleanly", (t) => {
  if (process.platform === "win32") {
    t.skip("NTFS forbids embedding 0x00-0x1F in a filename, so a CR- or LF-bearing directory name cannot even be constructed on win32");
    return;
  }
  for (const [label, ch] of [
    ["CR", "\r"],
    ["LF", "\n"],
  ]) {
    const repo = mkGitRepo(`e243-ac16-${label.toLowerCase()}-`);
    const weird = mkSub(repo, `x${ch}y`);
    const r = runAgc(weird, ["init", "--artifacts=local"]);
    assert.equal(r.status, 2, `${label}: expected exit 2 (stderr=${JSON.stringify(r.stderr)})`);
    assert.match(
      r.stderr,
      /agc init: refusing --artifacts=local — workspace path segment/,
      `${label}: refusal message present`,
    );
    assert.ok(!fs.existsSync(path.join(weird, ".current")), `${label}: no partial scaffold left behind`);
    assert.ok(!fs.existsSync(path.join(weird, "tasks.md")), `${label}: no partial scaffold left behind`);
  }
});

// ---------------------------------------------------------------------------
// AC17 — other C0/DEL subdir name refuses local mode cleanly (E243)
// ---------------------------------------------------------------------------
test("AC17: other C0/DEL subdir name refuses local mode cleanly", (t) => {
  if (process.platform === "win32") {
    t.skip("NTFS forbids embedding 0x00-0x1F or 0x7F in a filename, so these directory names cannot even be constructed on win32");
    return;
  }
  // Sampled at minimum per the spec: BEL (0x07) and US (0x1F); DEL (0x7F)
  // added since AC3 covers it explicitly alongside the C0 range.
  for (const [label, ch] of [
    ["BEL", "\x07"],
    ["US", "\x1f"],
    ["DEL", "\x7f"],
  ]) {
    const repo = mkGitRepo(`e243-ac17-${label.toLowerCase()}-`);
    const weird = mkSub(repo, `x${ch}y`);
    const r = runAgc(weird, ["init", "--artifacts=local"]);
    assert.equal(r.status, 2, `${label}: expected exit 2 (stderr=${JSON.stringify(r.stderr)})`);
    assert.match(
      r.stderr,
      /agc init: refusing --artifacts=local — workspace path segment/,
      `${label}: refusal message present`,
    );
    assert.ok(!fs.existsSync(path.join(weird, ".current")), `${label}: no partial scaffold left behind`);
  }
});

// ---------------------------------------------------------------------------
// AC18 — backslash/control-character subdir name is fine under explicit repo mode (E243)
// ---------------------------------------------------------------------------
test("AC18: backslash/control-character subdir name is fine under explicit repo mode", (t) => {
  if (process.platform === "win32") {
    t.skip("backslash and C0/DEL directory names cannot be constructed on win32 (see AC15/AC17)");
    return;
  }
  for (const [label, name] of [
    ["backslash", "a\\b"],
    ["CR", "x\ry"],
    ["ESC", "x\x1by"],
  ]) {
    const repo = mkGitRepo(`e243-ac18-${label.toLowerCase()}-`);
    const weird = mkSub(repo, name);
    const before = readExclude(repo);
    const r = runAgc(weird, ["init", "--artifacts=repo"]);
    assert.equal(r.status, 0, `${label}: exit code (stderr=${r.stderr})`);
    assert.deepEqual(
      readConfig(weird),
      { schema_version: 2, host: "claude-code", artifacts: "repo" },
      `${label}: config stamped`,
    );
    assert.equal(
      readExclude(repo),
      before,
      `${label}: repo mode writes no exclude rules even under an unsafe-segment dir`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC19 — agc check advises rather than mis-tests on a backslash/control-character path (E243)
// ---------------------------------------------------------------------------
test("AC19: agc check advises rather than mis-tests on a backslash/control-character path", (t) => {
  if (process.platform === "win32") {
    t.skip("backslash and C0/DEL directory names cannot be constructed on win32 (see AC15/AC17)");
    return;
  }
  for (const [label, name] of [
    ["backslash", "a\\b"],
    ["CR", "x\ry"],
  ]) {
    const repo = mkGitRepo(`e243-ac19-${label.toLowerCase()}-`);
    const weird = mkSub(repo, name);
    // Hand-authored, since `agc init` itself would have refused per AC15/AC16.
    seedConfig(weird, { schema_version: 2, host: "claude-code", artifacts: "local" });

    const r = runAgc(weird, ["check"]);
    assert.equal(r.status, 0, `${label}: exit code`);
    assert.match(
      r.stderr,
      /agc check — cannot verify artifacts drift: workspace path segment/,
      `${label}: cannot-verify advisory present`,
    );
    assert.doesNotMatch(
      r.stderr,
      /config declares/,
      `${label}: must advise, not attempt the normal drift\(\) test`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC20 — message printed for a CR/LF/ESC segment contains no raw control byte (E243)
// ---------------------------------------------------------------------------
test("AC20: message printed for a CR/LF/ESC segment contains no raw control byte", (t) => {
  if (process.platform === "win32") {
    t.skip("CR/LF/ESC directory names cannot be constructed on win32 (see AC16/AC17)");
    return;
  }
  // init's refusal (AC9's message).
  for (const [label, ch, escaped] of [
    ["CR", "\r", "\\r"],
    ["LF", "\n", "\\n"],
    ["ESC", "\x1b", "\\x1b"],
  ]) {
    const repo = mkGitRepo(`e243-ac20-init-${label.toLowerCase()}-`);
    const weird = mkSub(repo, `g${ch}h`);
    const r = runAgc(weird, ["init", "--artifacts=local"]);
    assert.equal(r.status, 2, `${label}: expected exit 2 (stderr=${JSON.stringify(r.stderr)})`);
    // The message is everything up to the FIRST actual newline in stderr
    // (the usage text that follows a refusal is itself multi-line, so this
    // isolates the one-line message from that unrelated newline-bearing
    // tail rather than asserting zero raw \n anywhere in all of stderr).
    const firstLine = r.stderr.split("\n")[0];
    assert.ok(
      firstLine.includes(`"g${escaped}h"`),
      `${label}: message must show the segment in its escaped display form (firstLine=${JSON.stringify(firstLine)})`,
    );
    assert.ok(
      firstLine.endsWith("Rename the directory, or re-run with --artifacts=repo."),
      `${label}: message must remain one whole line ending in the full sentence — a raw, un-escaped LF in the ` +
        `segment would truncate this line early (firstLine=${JSON.stringify(firstLine)})`,
    );
    assert.ok(
      !firstLine.includes(ch),
      `${label}: message line must contain no raw occurrence of the control byte itself (firstLine=${JSON.stringify(firstLine)})`,
    );
  }

  // agc check's cannot-verify advisory (AC10's message) echoes the same
  // escaped <segment> per the spec — same proof, the other call site.
  for (const [label, ch, escaped] of [
    ["CR", "\r", "\\r"],
    ["ESC", "\x1b", "\\x1b"],
  ]) {
    const repo = mkGitRepo(`e243-ac20-check-${label.toLowerCase()}-`);
    const weird = mkSub(repo, `g${ch}h`);
    seedConfig(weird, { schema_version: 2, host: "claude-code", artifacts: "local" });
    const r = runAgc(weird, ["check"]);
    assert.equal(r.status, 0, `${label}: exit code`);
    const firstLine = r.stderr.split("\n")[0];
    assert.ok(
      firstLine.includes(`"g${escaped}h"`),
      `${label}: agc check message must show the segment in its escaped display form (firstLine=${JSON.stringify(firstLine)})`,
    );
    assert.ok(
      !firstLine.includes(ch),
      `${label}: agc check message line must contain no raw occurrence of the control byte itself (firstLine=${JSON.stringify(firstLine)})`,
    );
  }
});

// ---------------------------------------------------------------------------
// Boundary / security smoke (SOP Phase 3d — always included)
// ---------------------------------------------------------------------------
test("boundary: a wildcard segment nested two levels deep is still refused, naming that inner segment", () => {
  const repo = mkGitRepo("e239-boundary-nested-");
  const nested = mkSub(repo, path.join("pkgs", "wei[rd]"));
  const r = runAgc(nested, ["init"]);
  assert.equal(r.status, 2, `expected exit 2 (stderr=${r.stderr})`);
  assert.match(r.stderr, /workspace path segment "wei\[rd\]"/, `stderr=${r.stderr}`);
  assert.ok(!fs.existsSync(path.join(nested, ".current")), "no partial scaffold left behind");
});

test("boundary: an empty subdirectory name segment (repo root itself) is unaffected by the subdir fix", () => {
  // cwd === repo root: prefix is "", so none of the new subdir behavior
  // applies — this is the root-cwd path AC3 protects, spot-checked here from
  // this file's own fixtures rather than relying solely on the sibling suite.
  const repo = mkGitRepo("e239-boundary-root-");
  const r = runAgc(repo, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  const lines = excludeLineSet(repo);
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.ok(lines.has(rule));
  }
});

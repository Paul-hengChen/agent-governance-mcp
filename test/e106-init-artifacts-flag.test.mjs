// Coded by @qa-engineer
// Tests for the `agc init --artifacts` flag and the matching `agc check` drift
// reports (specs/e106-init-artifacts-flag.md AC1-AC14, plus the CLI-level AC16;
// unit-level narrow typing of the config value (AC15/AC16) lives in
// test/config-versioning.test.mjs — this file adds an end-to-end check (AC16)
// that a real `agc init` write round-trips through the real loadConfig()).
//
// Spec-to-test map:
//   AC1  -> "AC1: no flag defaults to local when nothing is tracked"
//   AC2  -> "AC2: --artifacts=bogus exits 2, usage error, no partial write"
//   AC3  -> "AC3: fresh local writes exclude rules + config key"
//   AC4  -> "AC4: fresh repo writes config key only, no exclude write"
//   AC5  -> "AC5: existing config upserts artifacts key, preserves other keys (untracked case)"
//   AC6  -> "AC6: re-run without flag is a no-op when already declared"
//   AC7  -> "AC7: already-tracked paths are detected and printed, never executed"
//   AC8  -> "AC8: omitted flag on an already-tracked tree leaves the key undeclared and tells the user to choose"
//   AC9  -> "AC9: agc check reports local-mode drift, exit 0" (two sub-cases: missing
//           exclude rules, tracked path despite local mode)
//   AC10 -> "AC10: agc check reports repo-mode drift when an artifact exclude rule is present, exit 0"
//   AC11 -> "AC11: agc check does not confuse LANE_EXCLUDE_RULES entries for artifact drift"
//   AC12 -> "AC12: agc check prints the undeclared-artifacts advisory, exit 0"
//   AC13 -> "AC13: no drift line when declared+actual truly agree (local or repo)"
//   AC14 -> "AC14: local outside a git repo skips the exclude write and notes it, no error"
//   AC16 -> "AC16 (CLI end-to-end): loadConfig() surfaces the artifacts value agc init just wrote"
//
// The scratch repos in the flag and drift cases (AC1/AC3-AC11/AC13/AC16) are
// REAL git repositories built under os.tmpdir() via `git init` + a local
// identity (never this checkout or the lane worktree, and never the ambient
// global git config). The invalid-value, undeclared-advisory and outside-git
// cases (AC2/AC12/AC14) deliberately run outside any prior commit (AC2: empty
// repo, per the spec's own proof) or outside git entirely (AC12/AC14).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../dist/tools/config.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

const ARTIFACT_EXCLUDE_RULES = ["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/"];

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
// helpers
// ---------------------------------------------------------------------------
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

// A real scratch git repo: `git init -b main`, local identity — never relies
// on ambient global git config, and never touches this checkout.
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

function readConfigRaw(ws) {
  return fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8");
}

function readExclude(repo) {
  return fs.readFileSync(path.join(repo, ".git", "info", "exclude"), "utf-8");
}

function seedConfig(ws, obj) {
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify(obj, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// AC1 — no flag defaults to local when nothing is tracked
// ---------------------------------------------------------------------------
test("AC1: no flag defaults to local when nothing is tracked", () => {
  const repo = mkGitRepo("e106-ac1-");
  const r = runAgc(repo, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.deepEqual(readConfig(repo), { schema_version: 2, host: "claude-code", artifacts: "local" });
  const exclude = readExclude(repo);
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.ok(exclude.includes(rule), `expected ${rule} in .git/info/exclude`);
  }
});

// ---------------------------------------------------------------------------
// AC2 — invalid --artifacts value: exit 2, usage error, no partial write
// ---------------------------------------------------------------------------
test("AC2: --artifacts=bogus exits 2, usage error, no partial write", () => {
  const repo = mkGitRepo("e106-ac2-"); // empty temp git repo, per the spec's own proof
  const r = runAgc(repo, ["init", "--artifacts=bogus"]);
  assert.equal(r.status, 2, `expected exit 2 (stderr=${r.stderr})`);
  assert.match(r.stderr, /agc init: --artifacts must be "local" or "repo" \(got "bogus"\)/);
  assert.match(r.stderr, /local\|repo/, "usage text must name the two valid values");
  assert.ok(!fs.existsSync(path.join(repo, ".current")), "no partial scaffold — not even .current/ — on a rejected flag");
});

// ---------------------------------------------------------------------------
// AC3 — fresh local writes exclude rules + config key
// ---------------------------------------------------------------------------
test("AC3: fresh local writes exclude rules + config key", () => {
  const repo = mkGitRepo("e106-ac3-");
  const r = runAgc(repo, ["init", "--artifacts=local"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  const exclude = readExclude(repo);
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.ok(exclude.includes(rule), `expected ${rule} in .git/info/exclude`);
  }
  assert.deepEqual(readConfig(repo), { schema_version: 2, host: "claude-code", artifacts: "local" });
});

// ---------------------------------------------------------------------------
// AC4 — fresh repo writes config key only, no exclude write
// ---------------------------------------------------------------------------
test("AC4: fresh repo writes config key only, no exclude write", () => {
  const repo = mkGitRepo("e106-ac4-");
  // `git init` always creates .git/info/exclude with its own commented
  // default template — the claim under test (AC4) is that --artifacts=repo leaves that
  // file untouched, not that it never exists.
  const before = readExclude(repo);
  const r = runAgc(repo, ["init", "--artifacts=repo"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.equal(readExclude(repo), before, ".git/info/exclude must be byte-identical — repo mode writes nothing there");
  assert.deepEqual(readConfig(repo), { schema_version: 2, host: "claude-code", artifacts: "repo" });
});

// ---------------------------------------------------------------------------
// AC5 — existing config upserts artifacts key, preserves other keys (untracked case)
// ---------------------------------------------------------------------------
test("AC5: existing config upserts artifacts key, preserves other keys (untracked case)", () => {
  const repo = mkGitRepo("e106-ac5-");
  seedConfig(repo, { schema_version: 2, host: "claude-code", driftBaselineIds: ["T1", "T2"] });
  const r = runAgc(repo, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.match(r.stdout, /Updated:.*\.current\/\.config\.json/);
  const cfg = readConfig(repo);
  assert.deepEqual(
    cfg,
    {
      schema_version: 2,
      host: "claude-code",
      driftBaselineIds: ["T1", "T2"],
      artifacts: "local",
    },
    "every pre-existing key must be preserved; artifacts defaults to local when the flag is omitted and nothing is tracked",
  );
  // Byte-preservation outside the spliced region (mirrors upsertHostKey's own
  // formatting-preservation precedent, test/agc-adapters.test.mjs).
  const raw = readConfigRaw(repo);
  assert.ok(raw.includes('"T1"') && raw.includes('"T2"'), "array entries must survive verbatim");
});

// ---------------------------------------------------------------------------
// AC6 — re-run without flag is a no-op when already declared
// ---------------------------------------------------------------------------
test("AC6: re-run without flag is a no-op when already declared", () => {
  const repo = mkGitRepo("e106-ac6-");
  seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "repo" });
  const before = readConfigRaw(repo);
  const r = runAgc(repo, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.equal(readConfigRaw(repo), before, "file must stay byte-identical");
  assert.match(
    r.stdout,
    /Skipped \(already exists\):.*\.current\/\.config\.json/,
    "must report under the existing skip bucket, mirroring the host has-host skip path",
  );
  assert.doesNotMatch(r.stdout, /Updated:.*\.current\/\.config\.json/);
});

// ---------------------------------------------------------------------------
// AC7 — already-tracked paths are detected and printed, never executed
// ---------------------------------------------------------------------------
test("AC7: already-tracked paths are detected and printed, never executed", () => {
  const repo = mkGitRepo("e106-ac7-");
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".current", "handoff.md"), "seed\n");
  fs.writeFileSync(path.join(repo, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "pre-existing tracked artifacts"]);

  const r = runAgc(repo, ["init", "--artifacts=local"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  // Exclude rules and the config key ARE written despite the tracked paths —
  // an explicit --artifacts=local always behaves this way.
  const exclude = readExclude(repo);
  for (const rule of ARTIFACT_EXCLUDE_RULES) {
    assert.ok(exclude.includes(rule), `expected ${rule} in .git/info/exclude`);
  }
  assert.equal(readConfig(repo).artifacts, "local");

  // The warning names the tracked paths, the exact untrack command, and the
  // history note.
  assert.match(r.stderr, /already tracked in this repo/);
  assert.match(r.stderr, /\.current\//);
  assert.match(r.stderr, /tasks\.md/);
  assert.match(r.stderr, /git rm -r --cached/);
  assert.match(r.stderr, /history still contains these files/);

  // The tracked files must STILL be tracked — agc never runs git rm.
  const tracked = git(repo, ["ls-files", "--", ".current", "tasks.md"]).trim().split("\n").filter(Boolean);
  assert.ok(tracked.includes(".current/handoff.md"), ".current/handoff.md must still be tracked after the run");
  assert.ok(tracked.includes("tasks.md"), "tasks.md must still be tracked after the run");
});

// ---------------------------------------------------------------------------
// AC8 — omitted flag on an already-tracked tree leaves the key undeclared
// ---------------------------------------------------------------------------
test("AC8: omitted flag on an already-tracked tree leaves the key undeclared and tells the user to choose", () => {
  const repo = mkGitRepo("e106-ac8-");
  fs.writeFileSync(path.join(repo, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "pre-existing tracked tasks.md"]);

  const before = readExclude(repo); // git init's default template
  const r = runAgc(repo, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  const cfg = readConfig(repo);
  assert.equal(cfg.artifacts, undefined, "artifacts must stay undeclared, not silently default to local");
  assert.ok(!Object.prototype.hasOwnProperty.call(cfg, "artifacts"), "the key itself must be absent, not present-but-undefined");
  assert.equal(readExclude(repo), before, "no exclude rules written when the flag is omitted on a tracked tree");

  assert.match(r.stderr, /already tracked in this repo/);
  assert.match(r.stderr, /tasks\.md/);
  assert.match(r.stderr, /re-run with --artifacts=local or --artifacts=repo to choose explicitly/);

  const tracked = git(repo, ["ls-files", "--", "tasks.md"]).trim();
  assert.equal(tracked, "tasks.md", "tasks.md must still be tracked");
});

// ---------------------------------------------------------------------------
// AC9 — agc check reports local-mode drift, exit 0
// ---------------------------------------------------------------------------
test("AC9: agc check reports local-mode drift, exit 0", () => {
  // Sub-case (a): declared local, but the exclude rules were never written.
  {
    const repo = mkGitRepo("e106-ac9a-");
    seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "local" });
    const r = runAgc(repo, ["check"]);
    assert.equal(r.status, 0);
    assert.match(
      r.stderr,
      /artifacts drift: config declares "local" but exclude rules are missing from \.git\/info\/exclude/,
    );
  }
  // Sub-case (b): declared local, exclude rules present, but a path is tracked.
  {
    const repo = mkGitRepo("e106-ac9b-");
    seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "local" });
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-q", "-m", "tracks .config.json"]);
    fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), ARTIFACT_EXCLUDE_RULES.join("\n") + "\n");
    const r = runAgc(repo, ["check"]);
    assert.equal(r.status, 0);
    assert.match(
      r.stderr,
      /artifacts drift: config declares "local" but \.current\/ is tracked despite local mode/,
    );
  }
});

// ---------------------------------------------------------------------------
// AC10 — agc check reports repo-mode drift when an artifact exclude rule is present
// ---------------------------------------------------------------------------
test("AC10: agc check reports repo-mode drift when an artifact exclude rule is present, exit 0", () => {
  const repo = mkGitRepo("e106-ac10-");
  seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "repo" });
  fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), "/.current/\n");
  const r = runAgc(repo, ["check"]);
  assert.equal(r.status, 0);
  assert.match(
    r.stderr,
    /artifacts drift: config declares "repo" but an artifact exclude rule is present in \.git\/info\/exclude despite repo mode/,
  );
});

// ---------------------------------------------------------------------------
// AC11 — agc check does not confuse LANE_EXCLUDE_RULES entries for artifact drift
// ---------------------------------------------------------------------------
test("AC11: agc check does not confuse LANE_EXCLUDE_RULES entries for artifact drift", () => {
  const repo = mkGitRepo("e106-ac11-");
  seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "repo" });
  fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), ".env\n/node_modules\n/.current/**/base-sha\n");
  const r = runAgc(repo, ["check"]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(
    r.stderr,
    /artifacts drift/,
    "lane-bootstrap exclude entries (agc feature start) must never trip the artifacts-drift check",
  );
});

// ---------------------------------------------------------------------------
// AC12 — agc check prints the undeclared-artifacts advisory, exit 0
// ---------------------------------------------------------------------------
// agc check now always runs the advisory hygiene scan (E234), which may add
// its own `agc check — hygiene` lines (e.g. hyg.kw.none). This case is about the
// artifacts advisory (AC12), so it drops those lines first.
function withoutHygieneLines(stderr) {
  return stderr
    .split("\n")
    .filter((l) => !l.startsWith("agc check — hygiene"))
    .join("\n");
}

test("AC12: agc check prints the undeclared-artifacts advisory, exit 0", () => {
  const ws = mkTmp("e106-ac12-"); // deliberately NOT a git repo — AC12 needs no git state at all
  seedConfig(ws, { schema_version: 2, host: "claude-code" });
  const r = runAgc(ws, ["check"]);
  assert.equal(r.status, 0);
  r.stderr = withoutHygieneLines(r.stderr);
  assert.equal(r.stderr, "agc check — artifacts undeclared — run agc init --artifacts=local|repo\n");
});

// ---------------------------------------------------------------------------
// AC13 — no drift line when declared+actual truly agree (local or repo)
// ---------------------------------------------------------------------------
test("AC13: no drift line when declared+actual truly agree (local or repo)", () => {
  // local: rules present, nothing tracked.
  {
    const repo = mkGitRepo("e106-ac13-local-");
    seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "local" });
    fs.mkdirSync(path.join(repo, ".git", "info"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), ARTIFACT_EXCLUDE_RULES.join("\n") + "\n");
    const r = runAgc(repo, ["check"]);
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stderr, /artifacts (drift|undeclared)/);
  }
  // repo: no ARTIFACT_EXCLUDE_RULES entry present in the exclude file.
  {
    const repo = mkGitRepo("e106-ac13-repo-");
    seedConfig(repo, { schema_version: 2, host: "claude-code", artifacts: "repo" });
    const r = runAgc(repo, ["check"]);
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stderr, /artifacts (drift|undeclared)/);
  }
});

// ---------------------------------------------------------------------------
// AC14 — local outside a git repo skips the exclude write and notes it
// ---------------------------------------------------------------------------
test("AC14: local outside a git repo skips the exclude write and notes it, no error", () => {
  const ws = mkTmp("e106-ac14-");
  assert.ok(!fs.existsSync(path.join(ws, ".git")), "sanity: fixture really is outside git");
  const r = runAgc(ws, ["init", "--artifacts=local"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.deepEqual(readConfig(ws), { schema_version: 2, host: "claude-code", artifacts: "local" });
  assert.match(
    r.stderr,
    /agc init — note: not inside a git repository — skipped \.git\/info\/exclude; recorded "artifacts": "local" in \.current\/\.config\.json/,
  );
});

// ---------------------------------------------------------------------------
// AC16 (CLI end-to-end; unit-level narrow-typing coverage lives in
// test/config-versioning.test.mjs) — loadConfig() surfaces exactly what a
// real `agc init` run just wrote, for both valid values.
// ---------------------------------------------------------------------------
test("AC16 (CLI end-to-end): loadConfig() surfaces the artifacts value agc init just wrote", () => {
  const repoLocal = mkGitRepo("e106-ac16-local-");
  assert.equal(runAgc(repoLocal, ["init", "--artifacts=local"]).status, 0);
  assert.equal(loadConfig(repoLocal).artifacts, "local");

  const repoRepo = mkGitRepo("e106-ac16-repo-");
  assert.equal(runAgc(repoRepo, ["init", "--artifacts=repo"]).status, 0);
  assert.equal(loadConfig(repoRepo).artifacts, "repo");
});

// ---------------------------------------------------------------------------
// Boundary / security smoke (SOP Phase 3d — always included)
// ---------------------------------------------------------------------------
test("boundary: --artifacts with an empty value is rejected like any other invalid value", () => {
  const repo = mkGitRepo("e106-boundary-empty-");
  const r = runAgc(repo, ["init", "--artifacts="]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /agc init: --artifacts must be "local" or "repo" \(got ""\)/);
});

test("boundary: --artifacts as the last argv token with no value attached is rejected, never crashes", () => {
  const repo = mkGitRepo("e106-boundary-noval-");
  const r = runAgc(repo, ["init", "--artifacts"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /agc init: --artifacts must be "local" or "repo" \(got ""\)/);
});

// ---------------------------------------------------------------------------
// Root-cwd regression check (AC3, E239; appended additively under the lane
// test-ownership carve-out in docs/lane-protocol.md §3 — no existing assertion
// above is touched): the subdirectory-anchor fix
// (specs/e239-init-subdir-exclude.md) must leave the root-cwd path
// byte-identical — no workspace-qualifier text, no prefixed rule strings, and
// the already-tracked warning must carry no "(run from the repository root)"
// qualifier, which only ever applies when cwd is a subdirectory. The
// subdirectory cases themselves live in test/e239-init-subdir-exclude.test.mjs
// (qa-engineer's own file).
// ---------------------------------------------------------------------------
test("AC3 regression (E239): root cwd emits no subdir-qualifier text and no prefixed rule strings", () => {
  const repo = mkGitRepo("e106-e239-ac3-");
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".current", "handoff.md"), "seed\n");
  fs.writeFileSync(path.join(repo, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "pre-existing tracked artifacts at root"]);

  const r = runAgc(repo, ["init", "--artifacts=local"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  // The already-tracked warning at root carries NO subdir qualifier — that
  // clause only fires when repoRelativeWorkspacePrefix(...).prefix !== "".
  assert.doesNotMatch(r.stderr, /run from the repository root/);
  assert.match(r.stderr, /Untrack them with:\n  git rm -r --cached \.current tasks\.md\n/);

  // Exclude file carries exactly the four original, un-prefixed strings —
  // never a "/<prefix>/..." variant (e.g. "/sub/.current/").
  const exclude = readExclude(repo);
  const nonCommentLines = new Set(
    exclude
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#")),
  );
  assert.deepEqual(
    nonCommentLines,
    new Set(ARTIFACT_EXCLUDE_RULES),
    "root cwd must write exactly the four un-prefixed rules, byte-identical to pre-E239 behavior",
  );
});

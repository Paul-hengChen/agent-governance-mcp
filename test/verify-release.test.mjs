// Coded by @qa-engineer
// Tests for scripts/verify-release.mjs (specs/e9-release-self-check.md and its
// follow-ups). Each test copies the real script into a temp root and runs it
// against a real git repo with a local bare "origin", so the shipped git logic
// is exercised, not a reimplementation; Check 6 swaps only `gh` for a PATH shim.
// SOP-wording tests grep content/skill-release-engineer.md.
// Spec-to-test map (VR-1..VR-34): specs/e260h-comment-rationale.md (test/verify-release.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync, execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const REAL_VERIFY_SCRIPT = fs.readFileSync(
  path.join(ROOT, "scripts", "verify-release.mjs"),
  "utf-8",
);
const REAL_CHECK_VERSION_SCRIPT = fs.readFileSync(
  path.join(ROOT, "scripts", "check-version.mjs"),
  "utf-8",
);
const SKILL = fs.readFileSync(
  path.join(ROOT, "content", "skill-release-engineer.md"),
  "utf-8",
);

// Sanity: fail loudly (not silently skip) if the real script's shape drifts
// out from under this fixture builder.
assert.ok(
  REAL_VERIFY_SCRIPT.includes('name:\\s*"agent-governance-mcp",\\s*version:\\s*"([^"]+)"'),
  "fixture assumes verify-release.mjs's committed-dist Server() literal regex; update fixtures if this changes",
);

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "QA Fixture",
  GIT_AUTHOR_EMAIL: "qa-fixture@example.com",
  GIT_COMMITTER_NAME: "QA Fixture",
  GIT_COMMITTER_EMAIL: "qa-fixture@example.com",
  GIT_CONFIG_NOSYSTEM: "1",
};

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", env: GIT_ENV }).trim();
}

function writeFixtureFiles(root, { version, indexVersion, distVersion, distContent, changelog }) {
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "verify-release.mjs"), REAL_VERIFY_SCRIPT);
  fs.writeFileSync(path.join(root, "scripts", "check-version.mjs"), REAL_CHECK_VERSION_SCRIPT);
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "agent-governance-mcp", version }, null, 2),
  );
  fs.writeFileSync(
    path.join(root, "index.ts"),
    `new Server({ name: "agent-governance-mcp", version: "${indexVersion}" });\n`,
  );
  if (changelog !== null) {
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), changelog);
  }
  if (distContent !== null) {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "dist", "index.js"),
      distContent ??
        `new Server({ name: "agent-governance-mcp", version: "${distVersion ?? version}" });\n`,
    );
  }
}

function defaultChangelog(version) {
  return `# Changelog\n\n## [${version}] - 2026-01-01\n### Added\n- fixture entry\n`;
}

/**
 * Build a real git repo with a local bare "origin" to drive the script's git
 * logic; returns { root, run }. Options: version (default "1.0.0"),
 * indexVersion and distVersion (default to version), distContent and changelog
 * (null omits the file), tag (fixture shape, default "at-head"; the tag block
 * below explains each), origin ("pushed", "no-upstream", "not-pushed",
 * "unreachable", "none") and distUncommitted (dirty dist/index.js after commit).
 */
function mkFixtureRepo({
  version = "1.0.0",
  indexVersion = version,
  distVersion = version,
  distContent = undefined,
  changelog = defaultChangelog(version),
  tag = "at-head",
  origin = "pushed",
  distUncommitted = false,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-release-"));
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), "verify-release-remote-"));

  git(["init", "-q"], root);
  git(["checkout", "-q", "-b", "main"], root);
  git(["config", "commit.gpgsign", "false"], root);

  writeFixtureFiles(root, { version, indexVersion, distVersion, distContent, changelog });
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", "init"], root);

  const firstCommitSha = git(["rev-parse", "HEAD"], root);

  if (origin !== "none") {
    git(["init", "-q", "--bare"], remote);
    const originUrl = origin === "unreachable" ? path.join(remote, "does-not-exist") : remote;
    git(["remote", "add", "origin", originUrl], root);
  }

  if (origin === "pushed") {
    git(["push", "-q", "-u", "origin", "main"], root);
  } else if (origin === "not-pushed") {
    // Push the first commit, then add a second local-only commit so HEAD
    // diverges from the upstream tracking branch.
    git(["push", "-q", "-u", "origin", "main"], root);
    fs.writeFileSync(path.join(root, "NOTES.md"), "local-only change\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "local only"], root);
  }
  // "no-upstream": origin remote exists but no push / no upstream tracking ref.
  // "unreachable": origin remote points at a nonexistent path (fetch fails).
  // "none": no origin remote configured at all (fetch fails "not found").

  if (tag === "behind-head") {
    // A REAL, non-bookkeeping change after the tag — never tolerated.
    // Deliberately pathed under src/ (not on the bookkeeping allowlist)
    // so this fixture cannot be mistaken for a bookkeeping-only commit (the
    // behind-head test VR-2 was re-pointed here — the fixture must stay unambiguous
    // even though the earlier name "AFTER-TAG.md" was already technically
    // off the allowlist) (AC2/AC3, E141; T-E141-02).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "real-change.js"), "// real change after tag\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "after tag: real change"], root);
  } else if (tag === "behind-head-bookkeeping") {
    // The v3.111.0 shape — exactly ONE commit after the tag
    // touching ONLY SOP step 13a's bookkeeping paths. Must be tolerated:
    // Check 1 OK with an explicit NOTE naming the tolerated count, never a
    // silent pass (AC2, E141).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "handoff.md"), "status: PASS\n");
    fs.writeFileSync(path.join(root, ".current", "metrics.jsonl"), "{}\n");
    fs.writeFileSync(path.join(root, "tasks.md"), "- [x] done\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping"], root);
  } else if (tag === "behind-head-bookkeeping-delete") {
    // Deleting an allowlisted bookkeeping path is tolerated — the path is
    // bookkeeping either way (a non-blocking code-reviewer observation, pinned
    // here as current behaviour: T-E141-01 review observation 4). The file must
    // exist BEFORE the tag so the post-tag commit can delete it.
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "telemetry.jsonl"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "add telemetry sidecar"], root);
    git(["tag", `v${version}`], root);
    git(["rm", "-q", ".current/telemetry.jsonl"], root);
    git(["commit", "-q", "-m", "chore(governance): drop stale telemetry sidecar"], root);
  } else if (tag === "behind-head-bookkeeping-lane") {
    // Since bookkeeping moved into per-lane directories, SOP step 13a stages
    // `.current/<lane>/...` paths, not the flat `.current/...` forms VR-27 above
    // already pins (E174a; lane layout change E123).
    // One post-tag commit touching ONLY lane-scoped bookkeeping paths across
    // two lanes (_primary's handoff.md + telemetry.jsonl, a ticket lane's
    // dispatch.jsonl + usage.jsonl) must still be tolerated as a whole.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "_primary"), { recursive: true });
    fs.mkdirSync(path.join(root, ".current", "e174a"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "_primary", "handoff.md"), "status: PASS\n");
    fs.writeFileSync(path.join(root, ".current", "_primary", "telemetry.jsonl"), "{}\n");
    fs.writeFileSync(path.join(root, ".current", "e174a", "dispatch.jsonl"), "{}\n");
    fs.writeFileSync(path.join(root, ".current", "e174a", "usage.jsonl"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (lane-scoped)"], root);
  } else if (tag === "behind-head-bookkeeping-archived-lane") {
    // A lane literally NAMED "archived" is a distinct, safe lane
    // segment — NOT the excluded "archive" directory (NON_LANE_DIRS).
    // Must be tolerated like any other lane (E174a).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "archived"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "archived", "handoff.md"), "status: PASS\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (archived lane)"], root);
  } else if (tag === "behind-head-bookkeeping-tasks-primary") {
    // A lane's tw_add_task / tw_complete_task write touches
    // `.current/_primary/tasks.md` exactly as it already touches that lane's
    // handoff.md/*.jsonl — one post-tag commit touching ONLY that literal
    // path must still be tolerated, mirroring VR-39's shape one-for-one but
    // for tasks.md (E126 T-E126-04/T-E126-06, spec AC10; E174a).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "_primary"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "_primary", "tasks.md"), "- [x] done\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (_primary tasks.md)"], root);
  } else if (tag === "behind-head-bookkeeping-tasks-lane") {
    // The lane-scoped counterpart: `.current/<lane>/tasks.md` is tolerated too,
    // mirroring VR-39's lane-scoped handoff.md/*.jsonl shape for tasks.md
    // (tickets T-E126-04/T-E126-06, spec AC10).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "e126x"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "e126x", "tasks.md"), "- [x] done\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (lane tasks.md)"], root);
  } else if (tag === "behind-head-bookkeeping-archive-dir") {
    // `.current/archive/...` is the excluded aggregation directory
    // (NON_LANE_DIRS), never a lane (E174a) — a commit touching it must NOT be
    // tolerated even though the shape otherwise mimics a lane-scoped
    // bookkeeping path.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "archive", "2026-01", "e001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".current", "archive", "2026-01", "e001", "handoff.md"),
      "status: PASS\n",
    );
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (archive dir)"], root);
  } else if (tag === "behind-head-bookkeeping-history-dir") {
    // `.current/history/...` is the other excluded directory
    // (NON_LANE_DIRS) — same non-tolerance as the archive-dir case above (E174a).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "history", "2026-01", "e001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".current", "history", "2026-01", "e001", "handoff.md"),
      "status: PASS\n",
    );
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (history dir)"], root);
  } else if (tag === "behind-head-a1-nested-lane") {
    // A human-mandated negative case: a two-segment path under .current/
    // is never a lane — LANE_SEGMENT_RE_SRC/isSafeLaneName only ever match a
    // single path segment. Must NOT be tolerated.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "a", "b"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "a", "b", "handoff.md"), "status: PASS\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (nested path)"], root);
  } else if (tag === "behind-head-a1-dot-lane") {
    // A dot-prefixed lane name is not a safe path segment (human-mandated negative case)
    // (isSafeLaneName's first-char class excludes "."). Must NOT be
    // tolerated.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", ".x"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", ".x", "handoff.md"), "status: PASS\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (dot lane)"], root);
  } else if (tag === "behind-head-a1-config") {
    // .current/.config.json is explicitly NOT a lane file (per the lane-path
    // scope note in the backlog, E174a) and must stay top-level / out of the
    // allowlist (human-mandated negative case).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", ".config.json"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (config)"], root);
  } else if (tag === "behind-head-a1-feature-split") {
    // .current/<lane>/feature-split.md is not a LANE_FILES entry (only
    // handoff.md + the *.jsonl sidecars are) — must NOT be tolerated even
    // though it sits directly under a valid lane dir (human-mandated negative case).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "_primary"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "_primary", "feature-split.md"), "# split\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (feature-split)"], root);
  } else if (tag === "behind-head-nonascii") {
    // A non-ASCII allowlisted filename fails closed (a non-blocking code-reviewer
    // observation, pinned here as current behaviour: T-E141-01 review observation 5) under default
    // core.quotePath — git emits it quoted/octal-escaped, which matches no
    // allowlist regex, so the commit is (correctly) treated as a
    // non-bookkeeping offender rather than silently tolerated.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "métrics.jsonl"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): add metrics sidecar (non-ascii name)"], root);
  } else if (tag === "diverged") {
    // The tag exists but is NOT an ancestor of HEAD (wrong branch /
    // rewritten history) (AC4, E141). Ancestry is a precondition of the tolerance, never
    // a substitute for it — the ORIGINAL "does not point at HEAD" FAIL must
    // stay byte-identical, with no range enumeration appended.
    git(["checkout", "-q", "-b", "release-branch"], root);
    fs.writeFileSync(path.join(root, "RELEASE-ONLY.md"), "tagged on a side branch\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "release commit on side branch"], root);
    git(["tag", `v${version}`], root);
    git(["checkout", "-q", "main"], root);
    fs.writeFileSync(path.join(root, "MAIN-ONLY.md"), "main moved on without the tag\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "main diverges"], root);
  } else if (tag === "at-head") {
    git(["tag", `v${version}`], root);
  }
  // "none": no tag created.

  if (distUncommitted) {
    fs.writeFileSync(
      path.join(root, "dist", "index.js"),
      `new Server({ name: "agent-governance-mcp", version: "${distVersion}" });\n// dirty working-tree edit\n`,
    );
  }

  return { root, remote, firstCommitSha };
}

function runVerify(root, args = []) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), ...args],
    { cwd: root, encoding: "utf-8" },
  );
}

/**
 * Shim `gh` with a real executable on PATH, so the script's own
 * `spawnSync("gh", ...)` lookup runs. `runVerifyWithPath` sets the child's
 * PATH so it finds the shim (or no `gh` at all) while `git` still resolves.
 */
function mkGhShim(scriptBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-"));
  const ghPath = path.join(dir, "gh");
  fs.writeFileSync(ghPath, scriptBody);
  fs.chmodSync(ghPath, 0o755);
  return dir;
}

/**
 * Resolve an executable via a manual PATH walk (no shelling out to
 * `which`/`where`, which would itself be a PATH-resolution dependency).
 */
function resolveOnPath(bin) {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  const dirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, bin + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // not here — keep walking
      }
    }
  }
  throw new Error(`resolveOnPath: could not find '${bin}' on PATH=${process.env.PATH}`);
}

// A PATH holding only the binaries these tests need, and never `gh`: `git`, and
// `cat` for the shims' heredoc bodies (`node` runs via process.execPath). It is
// built from this runner's own PATH because a fixed "/usr/bin:/bin" is not
// gh-less on hosted CI runners, which install `gh` at /usr/bin/gh.
let _noGhSystemPathDir;
function noGhSystemPath() {
  if (_noGhSystemPathDir) return _noGhSystemPathDir;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "no-gh-path-"));
  for (const bin of ["git", "cat"]) {
    fs.symlinkSync(resolveOnPath(bin), path.join(dir, bin));
  }
  _noGhSystemPathDir = dir;
  return dir;
}

// `extraEnv` merges OVER `process.env` (after `PATH`) — every bounded-poll test (E80)
// uses this to pin AGC_VERIFY_CI_WAIT_SECONDS explicitly rather than relying
// on this test process's own (unset) shell inheritance, so a developer's
// exported value can never silently change test behavior (T-E80-01 review
// heads-up).
function runVerifyWithPath(root, pathValue, args = [], extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), ...args],
    { cwd: root, encoding: "utf-8", env: { ...process.env, PATH: pathValue, ...extraEnv } },
  );
}

function ghJsonShim(json) {
  return `#!/bin/sh\ncat <<'EOF'\n${json}\nEOF\n`;
}

// A `gh` shim that returns a DIFFERENT canned response on each successive
// invocation (last response repeats for any calls beyond the list) — used to
// prove the bounded poll loop (E80) actually re-queries `gh` rather than caching its
// first answer. Each response is written to its own file so a multi-line
// JSON payload never has to survive re-quoting inside the shell script body.
function mkGhSequenceShim(jsons) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-seq-"));
  const counterPath = path.join(dir, "counter");
  fs.writeFileSync(counterPath, "0");
  jsons.forEach((json, i) => {
    fs.writeFileSync(path.join(dir, `resp-${i}`), json);
  });
  const lastIndex = jsons.length - 1;
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\nN=$(cat "${counterPath}")\ncat "${dir}/resp-$N"\nif [ "$N" -lt ${lastIndex} ]; then\n  echo $((N + 1)) > "${counterPath}"\nfi\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return dir;
}

// A `gh` shim that always returns the same canned response but records how
// many times it was invoked, via a counter file the test reads back
// afterward — used to prove `AGC_VERIFY_CI_WAIT_SECONDS=0` calls `gh` exactly
// once rather than merely completing quickly (a slow-but-single call and a
// fast-multi-call loop could otherwise both look "instant" to a wall-clock
// assertion alone).
function mkGhCallCounterShim(json) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-count-"));
  const counterPath = path.join(dir, "calls");
  fs.writeFileSync(counterPath, "0");
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\nN=$(cat "${counterPath}")\necho $((N + 1)) > "${counterPath}"\ncat <<'EOF'\n${json}\nEOF\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return { dir, counterPath };
}

// ---------------------------------------------------------------------------
// The release tag is missing (VR-1, AC1)
// ---------------------------------------------------------------------------
test("VR-1 (AC1): tag does not exist -> exit non-zero, failure line names the tag and says it does not exist", () => {
  const { root } = mkFixtureRepo({ version: "1.2.3", tag: "none" });
  const result = runVerify(root, ["v1.2.3"]);
  assert.notEqual(result.status, 0, "missing tag must fail the run");
  assert.match(
    result.stderr,
    /FAIL: tag v1\.2\.3 does not exist/,
    "failure line must name the tag and state it does not exist",
  );
});

// ---------------------------------------------------------------------------
// VR-2: the tag is behind HEAD because of a real (non-bookkeeping) commit. Since
// the bookkeeping tolerance (E141), tag != HEAD fails only for such a commit,
// so the fixture commits src/real-change.js ("behind-head"). The FAIL must name
// the offending sha and path (AC2, AC3).
// ---------------------------------------------------------------------------
test("VR-2 (AC2/AC3): tag exists but HEAD moved on with a REAL (non-bookkeeping) commit -> exit non-zero, failure line names both commits, sha, and offending path; no tolerance note fires", () => {
  const { root, firstCommitSha } = mkFixtureRepo({ version: "2.0.0", tag: "behind-head" });
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.notEqual(firstCommitSha, headSha, "sanity: HEAD must have moved past the tagged commit");

  const result = runVerify(root, ["v2.0.0"]);
  assert.notEqual(result.status, 0, "a non-bookkeeping commit after the tag must still fail the run");
  assert.match(
    result.stderr,
    /FAIL: tag v2\.0\.0 \([0-9a-f]+\) does not point at HEAD \([0-9a-f]+\)/,
    "failure line must name both the tag's commit and HEAD's commit",
  );
  assert.ok(result.stderr.includes(firstCommitSha.slice(0, 7)) || result.stderr.includes(firstCommitSha));
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*src\/real-change\.js/,
    "AC3: the FAIL must name the offending path, not just say 'does not point at HEAD'",
  );
  assert.doesNotMatch(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated/,
    "a real source change must never fire the E141 tolerance note",
  );
});

// ---------------------------------------------------------------------------
// Push-status checks: no upstream / not pushed / fetch failure (VR-3, AC3)
// ---------------------------------------------------------------------------
test("VR-3 (AC3): no upstream tracking branch configured -> exit non-zero, reports 'no upstream tracking branch configured'", () => {
  const { root } = mkFixtureRepo({ version: "3.0.0", tag: "at-head", origin: "no-upstream" });
  const result = runVerify(root, ["v3.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: no upstream tracking branch configured/);
});

test("VR-3 (AC3): local commits not pushed -> exit non-zero, reports both SHAs and 'local commits not pushed'", () => {
  const { root } = mkFixtureRepo({ version: "3.0.1", tag: "at-head", origin: "not-pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "@{u}"], root);
  assert.notEqual(headSha, upstreamSha, "sanity: HEAD must have diverged from upstream");

  const result = runVerify(root, ["v3.0.1"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local commits not pushed/);
  assert.ok(result.stderr.includes(headSha), "failure line must name HEAD's SHA");
  assert.ok(result.stderr.includes(upstreamSha), "failure line must name upstream's SHA");
});

test("VR-3 (AC3): git fetch origin failure (unreachable remote) is itself a FAIL, not silently skipped", () => {
  const { root } = mkFixtureRepo({ version: "3.0.2", tag: "at-head", origin: "unreachable" });
  const result = runVerify(root, ["v3.0.2"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: could not verify against origin:/,
    "an unreachable origin (fetch failure) must be reported as a FAIL, mirroring never silently skipping the push check",
  );
});

test("VR-3 (AC3): no origin remote configured at all -> exit non-zero (fetch fails, no push check silently skipped)", () => {
  const { root } = mkFixtureRepo({ version: "3.0.3", tag: "at-head", origin: "none" });
  const result = runVerify(root, ["v3.0.3"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: could not verify against origin:/);
});

// ---------------------------------------------------------------------------
// When check-version.mjs itself fails, its stderr is propagated verbatim (VR-4, AC4)
// ---------------------------------------------------------------------------
test("VR-4 (AC4): check-version.mjs failing (package.json/index.ts mismatch) -> non-zero exit, its stderr surfaced verbatim, not re-implemented", () => {
  const { root } = mkFixtureRepo({
    version: "4.0.0",
    indexVersion: "4.0.1", // mismatch trips check-version.mjs's own guard
    tag: "at-head",
    origin: "pushed",
  });
  const result = runVerify(root, ["v4.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: check-version\.mjs failed: check:version — version mismatch: package\.json=4\.0\.0 index\.ts=4\.0\.1/,
    "verify-release.mjs must surface check-version.mjs's own stderr verbatim, not a re-derived message",
  );
});

// ---------------------------------------------------------------------------
// The CHANGELOG has no entry for the target version (VR-5, AC5)
// ---------------------------------------------------------------------------
test("VR-5 (AC5): CHANGELOG.md missing entirely -> exit non-zero, failure line names the missing version", () => {
  const { root } = mkFixtureRepo({ version: "5.0.0", changelog: null, tag: "at-head" });
  const result = runVerify(root, ["v5.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: CHANGELOG\.md has no entry for v5\.0\.0/);
});

test("VR-5 (AC5): CHANGELOG.md present but has no heading for the target version -> exit non-zero, names the missing version", () => {
  const { root } = mkFixtureRepo({
    version: "5.0.1",
    changelog: "# Changelog\n\n## [4.9.0] - 2025-12-01\n### Added\n- older entry\n",
    tag: "at-head",
  });
  const result = runVerify(root, ["v5.0.1"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: CHANGELOG\.md has no entry for v5\.0\.1/);
});

// ---------------------------------------------------------------------------
// dist/ has uncommitted working-tree changes (VR-6, AC6)
// ---------------------------------------------------------------------------
test("VR-6 (AC6): dist/ has uncommitted changes -> exit non-zero, says dist must be rebuilt and committed; AC7 sub-check still runs independently and reports OK", () => {
  const { root } = mkFixtureRepo({
    version: "6.0.0",
    distVersion: "6.0.0", // committed dist matches target; only working tree is dirty
    tag: "at-head",
    distUncommitted: true,
  });
  const porcelain = git(["status", "--porcelain", "--", "dist/"], root);
  assert.notEqual(porcelain, "", "sanity: dist/ must show as dirty in git status");

  const result = runVerify(root, ["v6.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: dist\/ has uncommitted changes — rebuild and commit before releasing/,
  );
  assert.ok(
    !result.stderr.includes("committed dist/index.js version"),
    "AC6 failing must not also emit an AC7 mismatch line when the committed artifact itself matches — the two sub-checks are independent",
  );
});

// ---------------------------------------------------------------------------
// The committed dist/index.js at HEAD carries the wrong version (VR-7, AC7)
// ---------------------------------------------------------------------------
test("VR-7 (AC7): committed dist/index.js at HEAD has a stale version -> exit non-zero, failure line names both versions", () => {
  const { root } = mkFixtureRepo({
    version: "7.0.0",
    distVersion: "6.9.9", // committed artifact is stale
    tag: "at-head",
  });
  const porcelain = git(["status", "--porcelain", "--", "dist/"], root);
  assert.equal(porcelain, "", "sanity: working tree must be clean (isolating this to the AC7 sub-check)");

  const result = runVerify(root, ["v7.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: committed dist\/index\.js version \(6\.9\.9\) != target v7\.0\.0/,
  );
  assert.ok(
    !result.stderr.includes("dist/ has uncommitted changes"),
    "a clean working tree must not also trip the AC6 uncommitted-changes line — independent sub-checks",
  );
});

test("VR-7 (AC7): dist/index.js absent at HEAD (never committed) -> exit non-zero, distinct message", () => {
  const { root } = mkFixtureRepo({ version: "7.0.1", distContent: null, tag: "at-head" });
  const result = runVerify(root, ["v7.0.1"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: dist\/index\.js not found at HEAD — was it committed\?/);
});

// ---------------------------------------------------------------------------
// VR-8: all six checks report OK. The fixture origin is a local bare repo, so
// `gh run list` cannot resolve a host and Check 6 degrades to WARN, which still
// reports OK with exit 0. Deliberately not gh-shimmed: it pins what a plain
// `npm test` run hits.
// ---------------------------------------------------------------------------
test("VR-8 (AC8): all 6 checks report OK -> one OK line per check, final ALL CHECKS PASSED line, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "8.0.0", tag: "at-head", origin: "pushed" });
  const result = runVerify(root, ["v8.0.0"]);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  for (const name of [
    "tag-at-HEAD",
    "pushed-to-origin",
    "check-version",
    "CHANGELOG entry",
    "dist committed+parity",
    "CI ground-truth",
  ]) {
    assert.match(result.stdout, new RegExp(`OK: ${name.replace(/[+]/g, "\\+")}`), `expected an OK line for '${name}'`);
  }
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v8\.0\.0\)/);
  assert.equal(
    result.stderr,
    "",
    "a fully passing run must not print anything to stderr — Check 6's graceful degradation warns on stdout only (VR-8 pin)",
  );
  // Check 6 cannot resolve a GitHub host from the fixture's local-bare-repo
  // origin, so it degrades — document that this test's "all OK" run still
  // legitimately includes a WARN (not a masked failure).
  assert.match(
    result.stdout,
    /WARN: CI ground-truth —/,
    "sanity: this fixture has no real GitHub remote, so Check 6 is expected to WARN-degrade even on an all-OK run",
  );
});

test("VR-8 (AC8): multi-cause failure surfaces every FAIL in one run (no short-circuit)", () => {
  // Note: dist VERSION mismatch is deliberately avoided here — check-version.mjs
  // independently reads the same working-tree dist/index.js, so a version
  // mismatch would also trip its own gate and mask the "check-version still
  // OK" assertion below. distUncommitted (AC6) with a matching version keeps
  // check-version.mjs green while still failing verify-release's own
  // dist-committed+parity check, isolating the four intended failures.
  const { root } = mkFixtureRepo({
    version: "8.1.0",
    tag: "none", // the release tag is missing, so the tag check fails (AC1)
    changelog: null, // no CHANGELOG entry, so the changelog check fails (AC5)
    distUncommitted: true, // dirty dist/ fails the dist-clean check (AC6); the version itself still matches
    origin: "no-upstream", // no upstream branch, so the pushed check fails (AC3)
  });
  const result = runVerify(root, ["v8.1.0"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: tag v8\.1\.0 does not exist/);
  assert.match(result.stderr, /FAIL: no upstream tracking branch configured/);
  assert.match(result.stderr, /FAIL: CHANGELOG\.md has no entry for v8\.1\.0/);
  assert.match(result.stderr, /FAIL: dist\/ has uncommitted changes — rebuild and commit before releasing/);
  assert.match(result.stdout, /OK: check-version/, "an unrelated passing check must still report OK in the same run");
  assert.match(result.stderr, /check:release — FAILED \(4 check\(s\) failed\)/);
});

// ---------------------------------------------------------------------------
// VR-11: a red completed CI run at the release commit STOPs the release, and
// every other check still runs and reports OK. The shimmed headSha is the
// fixture's real HEAD (`git rev-parse HEAD`, as the script does): a dummy sha
// would only WARN under sha-matching (E78) and pass for the wrong reason.
// ---------------------------------------------------------------------------
test("VR-11 (E14): shimmed gh reports a red completed run AT the release commit -> exit non-zero, FAIL names conclusion+headSha+url, other 5 checks still OK", () => {
  const { root } = mkFixtureRepo({ version: "10.0.0", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "failure",
          headSha: releaseSha,
          url: "https://example.com/actions/runs/2",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.0"]);
  assert.notEqual(result.status, 0, "a red completed CI run at the release commit must FAIL the release self-check");
  const escapedHeadPrefix = releaseSha.slice(0, 12);
  assert.match(
    result.stderr,
    new RegExp(`FAIL: latest completed CI run on main concluded "failure" \\(head ${escapedHeadPrefix}\\) — https://example\\.com/actions/runs/2`),
    "FAIL line must name the conclusion, the (truncated) head SHA of the release commit, and the run URL",
  );
  for (const name of ["tag-at-HEAD", "pushed-to-origin", "check-version", "CHANGELOG entry", "dist committed+parity"]) {
    assert.match(
      result.stdout,
      new RegExp(`OK: ${name.replace(/[+]/g, "\\+")}`),
      `Check 6 failing must not prevent '${name}' from running and reporting OK`,
    );
  }
  assert.match(result.stderr, /check:release — FAILED \(1 check\(s\) failed\)/);
});

// ---------------------------------------------------------------------------
// Check 6: a green completed CI run AT THE RELEASE COMMIT reports OK with no
// WARN (VR-12; E14; retargeted by T-E78-02, E78). Same retarget rationale as
// the red-run test VR-11 above: the dummy `headSha: "1111...1"` never matched a real fixture
// HEAD, so under E78's sha-matched code this degraded to WARN instead of OK.
// ---------------------------------------------------------------------------
test("VR-12 (E14): shimmed gh reports a successful completed run AT the release commit -> OK line, exit 0, no WARN emitted, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.1", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: releaseSha,
          url: "https://example.com/actions/runs/1",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.1"]);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.ok(
    !result.stdout.includes("WARN: CI ground-truth"),
    "a genuinely green completed run at the release commit must not also degrade — WARN is reserved for cannot-obtain-ground-truth paths",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.0\.1\)/);
  assert.equal(result.stderr, "", "a fully passing run (including a real green Check 6) must not print to stderr");
});

// ---------------------------------------------------------------------------
// VR-17: a green run at a different commit must WARN, not satisfy the check.
// This is the v3.102.2 stale-green regression, where an earlier commit's green
// run was accepted while the release's own CI was still running.
// ---------------------------------------------------------------------------
test("VR-17 (E78): shimmed gh reports a green completed run at a DIFFERENT commit -> WARN (stale-green, v3.102.2 regression), never OK, exit 0, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.6", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const otherSha = "3333333333333333333333333333333333333333";
  assert.notEqual(otherSha, releaseSha, "sanity: the shimmed run's headSha must differ from the release commit");
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: otherSha,
          url: "https://example.com/actions/runs/3",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  // wait=0 (T-E80-02): this test drives the sha-not-found branch, which now
  // bounded-polls by default — pin the budget explicitly rather than let this
  // process's own (unset) env silently give the child a 600s budget.
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.6"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `a stale green run from a different commit must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    new RegExp(`WARN: CI ground-truth — this commit's CI has not completed yet \\(head ${releaseSha.slice(0, 12)} not found among the last 1 completed run\\(s\\) on main\\); continuing without CI verification \\(graceful degradation, E14\\)`),
    "a green run at an unrelated commit must degrade via WARN, naming THIS commit's head, not be accepted as ground truth",
  );
  assert.match(result.stdout, /OK: CI ground-truth/, "the check itself still reports OK — WARN is a degradation, not a failure");
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
});

// ---------------------------------------------------------------------------
// A red run at another commit does not block (VR-18; E78, T-E78-02): a
// completed RED run at a DIFFERENT commit must not block the release either
// — it is just as much "the wrong answer" as a stale green, not a fatal
// mismatch. Only a red run AT the release commit (VR-11) is a FAIL.
// ---------------------------------------------------------------------------
test("VR-18 (E78): shimmed gh reports a red completed run at a DIFFERENT commit -> WARN, does not block, exit 0, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.7", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const otherSha = "4444444444444444444444444444444444444444";
  assert.notEqual(otherSha, releaseSha, "sanity: the shimmed run's headSha must differ from the release commit");
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "failure",
          headSha: otherSha,
          url: "https://example.com/actions/runs/4",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  // Wait budget pinned to 0: same reasoning as the stale-green test VR-17 above —
  // this drives the sha-not-found branch, so pin the budget rather than inherit
  // it (T-E80-02).
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.7"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `a red run belonging to an unrelated commit must never fail THIS release; stderr: ${result.stderr}`);
  assert.match(result.stdout, /WARN: CI ground-truth — this commit's CI has not completed yet/, "an unrelated commit's red run degrades exactly like any other cannot-obtain-ground-truth path");
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// Window coverage (VR-19, E78): the release commit's run is not runs[0] — it
// is buried at position 8 of a 10-run `--limit 10` window, behind several
// unrelated completed runs. Proves the window is genuinely searched with
// `.find`, not just `runs[0]` (which pre-E78 code effectively assumed).
// ---------------------------------------------------------------------------
test("VR-19 (E78): a matching red run found deep in the 10-run window (position 8 of 10) still FAILs", () => {
  const { root } = mkFixtureRepo({ version: "10.0.8", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const decoys = Array.from({ length: 7 }, (_, i) => ({
    conclusion: "success",
    headSha: `${i}`.repeat(40),
    url: `https://example.com/actions/runs/decoy-${i}`,
    updatedAt: "2026-01-01T00:00:00Z",
  }));
  const runs = [
    ...decoys,
    {
      conclusion: "failure",
      headSha: releaseSha,
      url: "https://example.com/actions/runs/deep",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    { conclusion: "success", headSha: "8".repeat(40), url: "https://example.com/actions/runs/decoy-8", updatedAt: "2026-01-01T00:00:00Z" },
    { conclusion: "success", headSha: "9".repeat(40), url: "https://example.com/actions/runs/decoy-9", updatedAt: "2026-01-01T00:00:00Z" },
  ];
  assert.equal(runs.length, 10, "sanity: exactly 10 runs, matching --limit 10");
  assert.equal(runs.indexOf(runs.find((r) => r.headSha === releaseSha)), 7, "sanity: the matching run sits at index 7 (position 8 of 10), not runs[0]");
  const shimDir = mkGhShim(ghJsonShim(JSON.stringify(runs)));
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.8"]);
  assert.notEqual(result.status, 0, "a matching red run buried in the window must still FAIL, proving runs[0] alone is not what's checked");
  assert.match(result.stderr, /FAIL: latest completed CI run on main concluded "failure"/);
  assert.match(result.stderr, /check:release — FAILED \(1 check\(s\) failed\)/);
});

// ---------------------------------------------------------------------------
// VR-20 (E80): a run for this commit that appears on a later `gh` call, not the
// first, resolves to OK, which proves the poll re-queries `gh`.
// ---------------------------------------------------------------------------
test("VR-20 (E80): sha absent on the first gh call, present+success on a later call -> OK, no WARN, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.9", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const notFoundJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: "5".repeat(40),
      url: "https://example.com/actions/runs/decoy-first-call",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
  const foundJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: releaseSha,
      url: "https://example.com/actions/runs/found-second-call",
      updatedAt: "2026-01-01T00:00:05Z",
    },
  ]);
  const shimDir = mkGhSequenceShim([notFoundJson, foundJson]);
  const start = Date.now();
  // budget=5s: POLL_INTERVAL_SECONDS is 20s, so a 5s budget forces exactly
  // one sleep of min(20s, remaining) = 5s between the miss and the match,
  // keeping this test fast while still genuinely exercising the poll-then-
  // resolve path (not just wait=0's single-call shortcut, covered by VR-22).
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.9"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "5",
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.ok(
    !result.stdout.includes("WARN: CI ground-truth"),
    "a sha that resolves before the budget expires must report a genuine OK, never a WARN",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.0\.9\)/);
  assert.equal(result.stderr, "", "a run that resolves mid-poll must not print to stderr");
  assert.ok(elapsedMs < 15000, `poll-then-resolve must complete well within the 5s budget + overhead; took ${elapsedMs}ms`);
});

// ---------------------------------------------------------------------------
// Poll budget expiry (VR-21; E80, T-E80-02(b)): the poll's own budget can expire
// with the sha STILL absent — the sha-matching contract must stay intact on this
// path: the SAME WARN text as the earlier immediate-miss branch (VR-17/VR-18), the check
// still green, exit 0. No new FAIL mode is introduced by adding the poll.
// ---------------------------------------------------------------------------
test("VR-21 (E80): poll budget expires with the sha still absent -> byte-identical pre-E80 WARN text, check green, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.10", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: "6".repeat(40),
          url: "https://example.com/actions/runs/decoy-never-matches",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const start = Date.now();
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.10"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "2",
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, `budget expiry must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    new RegExp(`WARN: CI ground-truth — this commit's CI has not completed yet \\(head ${releaseSha.slice(0, 12)} not found among the last 1 completed run\\(s\\) on main\\); continuing without CI verification \\(graceful degradation, E14\\)`),
    "budget expiry must emit the SAME WARN text as the pre-E80 immediate-miss branch — E78's contract preserved, not inverted, and no new FAIL mode",
  );
  assert.match(result.stdout, /OK: CI ground-truth/, "the check itself still reports OK — budget expiry is a degradation, not a failure");
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
  assert.ok(elapsedMs >= 2000, "the poll must actually have waited out the 2s budget, not returned on the first miss");
  assert.ok(elapsedMs < 15000, `budget expiry must not run long past the configured 2s budget; took ${elapsedMs}ms`);
});

// ---------------------------------------------------------------------------
// Wait-seconds opt-out (VR-22; E80, T-E80-02(c)): AGC_VERIFY_CI_WAIT_SECONDS=0 is
// the documented opt-out — it must perform EXACTLY one `gh` call (not "return fast", which
// a slow single call could also satisfy) and incur no wall-clock wait at
// all, preserving the pre-E80 single-call behavior byte-for-byte.
// ---------------------------------------------------------------------------
test("VR-22 (E80): AGC_VERIFY_CI_WAIT_SECONDS=0 performs exactly one gh call and no wall-clock wait", () => {
  const { root } = mkFixtureRepo({ version: "10.0.11", tag: "at-head", origin: "pushed" });
  const notFoundJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: "7".repeat(40),
      url: "https://example.com/actions/runs/decoy-wait-zero",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
  const { dir: shimDir, counterPath } = mkGhCallCounterShim(notFoundJson);
  const start = Date.now();
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.11"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /WARN: CI ground-truth — this commit's CI has not completed yet/);
  assert.equal(
    fs.readFileSync(counterPath, "utf-8").trim(),
    "1",
    "wait=0 must call gh exactly once, never enter the poll loop",
  );
  assert.ok(elapsedMs < 5000, `wait=0 must not incur any wall-clock poll sleep; took ${elapsedMs}ms`);
});

// ---------------------------------------------------------------------------
// VR-13: with no `gh` binary, Check 6 WARNs on stdout and still reports OK.
// Only a red completed run fails; every path that cannot get ground truth
// degrades. Uses noGhSystemPath() (see above): a fixed PATH resolved the real
// `gh` on hosted CI runners and turned this test red.
// ---------------------------------------------------------------------------
test("VR-13 (E14 degradation): gh binary not on PATH -> WARN on stdout naming gh unavailability, check still OK, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.2", tag: "at-head", origin: "pushed" });
  const result = runVerifyWithPath(root, noGhSystemPath(), ["v10.0.2"]);
  assert.equal(result.status, 0, `a missing gh binary must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — gh CLI unavailable \(ENOENT\); continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
});

// ---------------------------------------------------------------------------
// Check 6 degradation: gh exits non-zero (auth/network/API error) -> WARN on
// stdout carrying gh's own error detail, never a FAIL (VR-14, E14).
// ---------------------------------------------------------------------------
test("VR-14 (E14 degradation): gh exits non-zero (API/auth error) -> WARN on stdout with gh's error surfaced, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.3", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim(
    "#!/bin/sh\necho 'gh: authentication required, run `gh auth login`' 1>&2\nexit 1\n",
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.3"]);
  assert.equal(result.status, 0, `a gh API/auth error must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — gh run list failed: gh: authentication required, run `gh auth login`; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// Check 6 degradation: zero completed CI runs found (e.g. a brand-new repo, or
// CI renamed/disabled) -> WARN on stdout, never a FAIL (VR-15, E14).
// ---------------------------------------------------------------------------
test("VR-15 (E14 degradation): zero completed CI runs on main -> WARN on stdout, never a FAIL, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.4", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim(ghJsonShim("[]"));
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.4"]);
  assert.equal(result.status, 0, `zero completed CI runs must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — no completed CI runs found on origin\/main; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// Check 6 degradation, bonus coverage: unparseable gh stdout (malformed JSON)
// -> WARN on stdout, never a FAIL (VR-16, E14). Beyond the task's named three
// degradation paths (gh missing / API error / zero runs), but exercises the
// JSON.parse try/catch branch the code-reviewer called out by name in
// review_T-EB-03.md as verified-but-not-yet-test-pinned.
// ---------------------------------------------------------------------------
test("VR-16 (E14 degradation, bonus): unparseable gh output -> WARN on stdout, never a FAIL, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.5", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim("#!/bin/sh\necho 'not json at all'\n");
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.5"]);
  assert.equal(result.status, 0, `unparseable gh output must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — could not parse gh run list output; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// The release-engineer SOP step and its Escalation Routes row (content/skill-release-engineer.md) (VR-9, AC9)
// ---------------------------------------------------------------------------
test("VR-9 (AC9): skill-release-engineer.md requires verify-release.mjs after push/gh-release and before the closing write, plus a matching Escalation Routes row", () => {
  assert.match(
    SKILL,
    /9a\.\s*\*\*Release self-check\*\*[\s\S]*?node scripts\/verify-release\.mjs/,
    "SOP step 9a must instruct running node scripts/verify-release.mjs",
  );
  // Step 9a must sit after step 9 (push/gh-release) and before step 12 (closing write).
  const idxStep9 = SKILL.indexOf("**GitHub release**");
  const idxStep9a = SKILL.indexOf("9a. **Release self-check**");
  const idxStep12 = SKILL.indexOf("**Closing write**");
  assert.ok(idxStep9 > -1 && idxStep9a > -1 && idxStep12 > -1, "all three anchor steps must be present");
  assert.ok(idxStep9 < idxStep9a, "step 9a must come after step 9 (push + gh release)");
  assert.ok(idxStep9a < idxStep12, "step 9a must come before the closing write (step 12)");

  assert.match(
    SKILL,
    /\| release self-check reports any FAIL \(`node scripts\/verify-release\.mjs` exits non-zero, SOP step 9a\) \| Blocked \|/,
    "Escalation Routes must have a matching row with status=Blocked",
  );
  assert.ok(
    SKILL.includes(
      "`release-engineer: release self-check failed — <failed check name(s)> — see script output`",
    ),
    "Escalation Routes row must carry the verbatim pending-note text from the spec's Copy/Strings vr.escalation-note entry",
  );
  assert.match(
    SKILL,
    /release self-check reports any FAIL \(`node scripts\/verify-release\.mjs` exits non-zero, SOP step 9a\) \| Blocked \| `release-engineer: release self-check failed — <failed check name\(s\)> — see script output` \| human \|/,
    "Escalation Routes row must route to next_role=human",
  );
  assert.match(
    SKILL,
    /do NOT proceed to the closing write and do NOT emit `Done\. Released <tag>\.` on a FAIL/,
    "SOP step 9a must explicitly forbid the closing write and the done-report on FAIL",
  );

  // Step 9a must separate "the script is polling, let it run" from "WARN and
  // continue only in a degraded environment" (E80), and cite the wait constant
  // by name instead of a duration (E82); VR-9b pins that property.
  assert.match(
    SKILL,
    /the script itself bounded-polls `gh run list` for it \(E80\/E82; default is `DEFAULT_WAIT_SECONDS` in `scripts\/verify-release\.mjs`, overridable via `AGC_VERIFY_CI_WAIT_SECONDS`, `0` to opt out\) before giving up/,
    "step 9a must describe the E80 bounded poll and cite DEFAULT_WAIT_SECONDS in scripts/verify-release.mjs by name, not a restated duration figure (E82(ii))",
  );
  assert.match(
    SKILL,
    /just let this step run to completion, do not treat a poll-in-progress as a WARN to manually re-run around/,
    "step 9a must instruct the operator not to treat an in-progress poll as a WARN needing manual intervention",
  );
  assert.match(
    SKILL,
    /WARN-and-continue \(the check stays green either way, never a release blocker\) is what you get in two cases: the poll's own budget runs out with this sha still not found, or the environment is genuinely degraded/,
    "step 9a must scope WARN-and-continue to exactly two cases — poll-budget expiry or a genuinely degraded environment — not a single undifferentiated catch-all",
  );
});

// ---------------------------------------------------------------------------
// VR-9b (E82): an earlier step 9a wording hardcoded "~10 minutes" and went stale
// when the default changed. This pins the property instead: the poll-budget
// sentence has no duration literal, and the constant it names exists in
// scripts/verify-release.mjs.
// ---------------------------------------------------------------------------
test("VR-9b (E82(ii) behavioral pin): step 9a's CI-poll-budget sentence carries no hardcoded duration literal and sources it from DEFAULT_WAIT_SECONDS", () => {
  const idxStep9a = SKILL.indexOf("9a. **Release self-check**");
  const idxRationaleStart = SKILL.indexOf("<!-- rationale:start -->", idxStep9a);
  const idxStep10 = SKILL.indexOf("10. *(retired", idxStep9a);
  assert.ok(idxStep9a > -1, "step 9a must be present");
  assert.ok(idxRationaleStart > idxStep9a, "step 9a's rationale fence must be present");
  assert.ok(idxStep10 > idxRationaleStart, "step 10's retirement pointer must follow step 9a's rationale fence");
  // (a) covers the operational sentence only, up to the rationale fence:
  // stripRationale removes that fence from every dispatch, and it may keep the
  // old figures as a note to future editors.
  const step9aOperational = SKILL.slice(idxStep9a, idxRationaleStart);

  // (a) No hardcoded duration literal for the CI poll budget in the
  // OPERATIONAL text a release-engineer actually executes. This is the
  // precise staleness class the CI-wait default change was filed against (E82).
  assert.doesNotMatch(
    step9aOperational,
    /~?\d+\s*(seconds?|secs?|minutes?|mins?)\b/i,
    "step 9a's operational text must not carry a hardcoded duration literal for the CI poll budget — cite DEFAULT_WAIT_SECONDS by name instead (E82(ii))",
  );

  // (b) Names the constant, by identifier, as the source of the default.
  assert.match(
    step9aOperational,
    /`DEFAULT_WAIT_SECONDS`\s+in\s+`scripts\/verify-release\.mjs`/,
    "step 9a must cite DEFAULT_WAIT_SECONDS in scripts/verify-release.mjs by name as the source of the poll budget",
  );

  // (c) The named constant must be a real numeric constant in the script. The
  // value 480 is deliberately not pinned here (VR-23 pins the live behaviour),
  // or a value change would make this test stale.
  assert.match(
    REAL_VERIFY_SCRIPT,
    /const\s+DEFAULT_WAIT_SECONDS\s*=\s*\d+\s*;/,
    "scripts/verify-release.mjs must still define DEFAULT_WAIT_SECONDS as a numeric constant — if this fails, step 9a's citation now points at nothing",
  );
});

// ---------------------------------------------------------------------------
// VR-9c: step 13a's non-empty-stage check catches a total staging failure
// only, not partial under-staging; this pins exactly that. Known gap: if
// `find` under-reports (BSD `find` does not follow a symlinked `.current/`), the
// `.jsonl` sidecars are silently left out. `tasks.md` is staged by step 8, not
// 13a (E143). Details: specs/e260h-comment-rationale.md (test/verify-release.test.mjs).
// ---------------------------------------------------------------------------
test("VR-9c (N11): step 13a's non-empty-stage assertion is scoped to catching a fully-empty stage, not partial under-staging", () => {
  const idxStep13a = SKILL.indexOf("13a. **Bookkeeping commit + push**");
  const idxStep13b = SKILL.indexOf("13b. **Bookkeeping close-out check**");
  assert.ok(idxStep13a > -1 && idxStep13b > -1, "steps 13a and 13b must both be present");
  assert.ok(idxStep13a < idxStep13b, "step 13a must precede step 13b");
  const step13aBlock = SKILL.slice(idxStep13a, idxStep13b);

  // The enumerate-then-stage pattern (N9 fix) — never a raw shell glob.
  // The enumeration + stage targets the derived lane dir, not a flat
  // .current/ glob (E174a).
  assert.match(
    step13aBlock,
    /JSONL=\$\(find "\.current\/\$LANE" -maxdepth 1 -name "\*\.jsonl"\)/,
    "13a must enumerate .jsonl sidecars via find under the derived lane dir, never a raw shell glob (E174a)",
  );
  assert.match(
    step13aBlock,
    /git add -- "\.current\/\$LANE\/handoff\.md" \$JSONL/,
    "13a must stage the lane-scoped handoff.md explicitly alongside the enumerated jsonl files (E143: tasks.md is staged by step 8, never by 13a; E174a: lane-scoped path)",
  );
  assert.doesNotMatch(
    step13aBlock,
    /git add -- "\.current\/\$LANE\/handoff\.md" tasks\.md/,
    "E143: 13a's git add must NOT name tasks.md — step 8 owns staging it",
  );
  // The lane is derived via the compiled resolver, never hardcoded to
  // _primary and never re-parsed from the branch name in shell (E174a).
  assert.match(
    step13aBlock,
    /LANE=\$\(node --input-type=module -e "import \{resolveCurrentLane\} from \\"\.\/dist\/tools\/lane-paths\.js\\"; console\.log\(resolveCurrentLane\(process\.cwd\(\)\)\)"\)/,
    "13a must derive $LANE by importing the compiled resolveCurrentLane, never hardcode _primary (E174a cut decision i)",
  );
  assert.match(
    step13aBlock,
    /lane dir \.current\/\$LANE missing — STOP/,
    "13a must STOP if the derived lane's .current/$LANE directory does not exist (E174a)",
  );

  // The guaranteed property: the stage is checked for non-emptiness — this
  // catches a TOTAL staging failure (nothing staged at all). It does NOT
  // verify that every one of the named paths individually landed (N11) —
  // that stronger guarantee is not what this assertion buys, and this test
  // must not be strengthened to claim it does without also changing the SOP
  // text to actually check per-path membership.
  assert.match(
    step13aBlock,
    /if \[ -z "\$\(git diff --cached --name-only\)" \]; then/,
    "13a must assert the cached diff is non-empty before allowing the commit — the total-staging-failure guard",
  );
  assert.match(
    step13aBlock,
    /nothing staged for bookkeeping commit — STOP/,
    "the non-empty-stage assertion's STOP message must be present",
  );

  // Do not proceed to commit on failure — this is the half that actually
  // closes the vacuous-13b-PASS class (code-reviewer round 3, Q2).
  assert.match(
    step13aBlock,
    /If that script exits non-zero, STOP here — do not proceed to `git commit`/,
    "13a must forbid proceeding to git commit when the staging script exits non-zero",
  );
});

// ---------------------------------------------------------------------------
// A tw_get_state read-back follows the closing write (VR-10, AC10)
// ---------------------------------------------------------------------------
test("VR-10 (AC10): skill-release-engineer.md requires a tw_get_state read-back immediately after the closing write, before the final reply", () => {
  const idxStep12 = SKILL.indexOf("**Closing write**");
  const idxStep13 = SKILL.indexOf("**Closing-write read-back**");
  assert.ok(idxStep12 > -1 && idxStep13 > -1, "both the closing write and read-back steps must be present");
  assert.ok(idxStep12 < idxStep13, "the read-back step must come after the closing write step");

  assert.match(
    SKILL,
    /13\.\s*\*\*Closing-write read-back\*\*[\s\S]*?call `tw_get_state` again/,
    "step 13 must instruct calling tw_get_state again after the closing write",
  );
  for (const field of ["last_agent", "status", "next_role", "pending_notes"]) {
    assert.ok(
      SKILL.includes(field),
      `step 13 must name the '${field}' field to confirm against the closing write`,
    );
  }
  assert.match(
    SKILL,
    /do NOT claim "Released"; STOP and surface the mismatch verbatim instead/,
    "a read-back mismatch must STOP the agent rather than let it claim success",
  );
});

// ---------------------------------------------------------------------------
// Security smoke tests — boundary inputs (skill-qa-engineer Phase 3d)
// ---------------------------------------------------------------------------
test("VR-SEC-1: no version argument -> defaults to package.json's version, still runs all checks", () => {
  const { root } = mkFixtureRepo({ version: "9.0.0", tag: "at-head" });
  const result = runVerify(root, []); // no arg at all ("null" boundary — omitted CLI input)
  assert.equal(result.status, 0, `expected default-version resolution to succeed; stderr: ${result.stderr}`);
  assert.match(result.stdout, /target version v9\.0\.0/);
});

test("VR-SEC-2: empty-string version argument -> falsy CLI arg falls back to package.json's version (same branch as omitted), not a crash or an injection surface", () => {
  // `""` is falsy in JS, so `rawArg ? ... : packageJsonVersion` takes the
  // same fallback branch as no argument at all (VR-SEC-1) — documented here
  // as observed behavior, not a bug: an empty string never reaches the
  // regex-validation branch, and it never reaches git/fs unvalidated.
  const { root } = mkFixtureRepo({ version: "9.0.1", tag: "at-head" });
  const result = runVerify(root, [""]);
  assert.equal(result.status, 0, `expected fallback-to-default to succeed; stderr: ${result.stderr}`);
  assert.match(result.stdout, /target version v9\.0\.1/);
});

test("VR-SEC-3: version argument with shell metacharacters -> rejected by regex validation, never reaches a shell (execFileSync/spawnSync array-argv, no injection)", () => {
  const { root } = mkFixtureRepo({ version: "9.0.2", tag: "at-head" });
  const marker = path.join(root, "INJECTED");
  const result = runVerify(root, [`1.0.0; touch ${marker}`]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid target version/);
  assert.ok(!fs.existsSync(marker), "a shell-metacharacter payload must never execute as a shell command");
});

test("VR-SEC-4: oversized version argument -> rejected by regex validation, exits cleanly without crashing", () => {
  const { root } = mkFixtureRepo({ version: "9.0.3", tag: "at-head" });
  const oversized = "9".repeat(100_000);
  const result = runVerify(root, [oversized]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid target version/);
});

// ---------------------------------------------------------------------------
// The 480s default poll budget and the --close-out mode, per
// specs/e82-e84-release-verify-tooling.md AC1/AC3/AC4 (T-E8284-02, E82/E84).
// ---------------------------------------------------------------------------

// VR-23 (E82): with AGC_VERIFY_CI_WAIT_SECONDS unset the budget defaults to 480s,
// read from the script's first "...left in budget" line, not grepped from source:
// a grep passes when a comment says 480 and the constant differs. The child is
// spawned and killed at the first poll line, so the test takes milliseconds.
test("VR-23 (AC1, E82): AGC_VERIFY_CI_WAIT_SECONDS unset -> first poll line reports ~480s left in budget, never ~600s", async () => {
  const { root } = mkFixtureRepo({ version: "10.0.12", tag: "at-head", origin: "pushed" });
  const decoyJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: "9".repeat(40),
      url: "https://example.com/actions/runs/decoy-default-budget",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
  const shimDir = mkGhShim(ghJsonShim(decoyJson));
  const env = { ...process.env, PATH: `${shimDir}:${noGhSystemPath()}` };
  delete env.AGC_VERIFY_CI_WAIT_SECONDS; // must be genuinely unset, not inherited from this test's own shell

  const child = spawn(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), "v10.0.12"],
    { cwd: root, env },
  );

  let stdout = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  let remainingSeconds;
  try {
    remainingSeconds = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `timed out waiting for the first poll-progress line; stdout so far: ${stdout}; stderr: ${stderr}`,
          ),
        );
      }, 15_000);
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        const m = stdout.match(/polling again in \d+s \(~(\d+)s left in budget\)/);
        if (m) {
          clearTimeout(timer);
          resolve(Number(m[1]));
        }
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  } finally {
    child.kill("SIGKILL");
  }

  assert.ok(
    remainingSeconds >= 470 && remainingSeconds <= 480,
    `expected the default poll budget to be ~480s (the E82 fix), never ~600s (the pre-fix default); observed ~${remainingSeconds}s left after the first gh call`,
  );
});

// ---------------------------------------------------------------------------
// VR-24 (E84): --close-out FAILs when HEAD is ahead of @{u}, names the ahead
// count and never runs Check 1. The fixture adds one local commit on top of
// the pushed one, so a reversed `HEAD..@{u}` range would be empty and pass;
// only the correct `@{u}..HEAD` fails, so the test discriminates direction.
// ---------------------------------------------------------------------------
test("VR-24 (AC3, E84): --close-out FAILs when HEAD is ahead of upstream, names the ahead count, never runs tag-at-HEAD", () => {
  const { root } = mkFixtureRepo({ version: "10.0.13", tag: "at-head", origin: "not-pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "@{u}"], root);
  assert.notEqual(headSha, upstreamSha, "sanity: HEAD must have moved past the pushed upstream");
  const aheadCount = Number(git(["rev-list", "--count", "@{u}..HEAD"], root));
  assert.equal(aheadCount, 1, "sanity: fixture must carry exactly one unpushed local commit");

  const result = runVerify(root, ["--close-out"]);

  assert.notEqual(
    result.status,
    0,
    `expected --close-out to FAIL when HEAD is ahead of upstream; stdout: ${result.stdout}`,
  );
  assert.match(
    result.stderr,
    /FAIL: HEAD is 1 commit\(s\) ahead of upstream origin\/main — not pushed/,
    "failure line must name the ahead commit count",
  );
  assert.match(
    result.stderr,
    /check:release — FAILED \(1 check\(s\) failed\)/,
    "close-out's own failure summary must report exactly one failed check",
  );
  assert.equal(
    result.stdout,
    "",
    "the ahead-of-upstream check is single-shot (no progress lines) and must not run any other check quietly",
  );
  assert.ok(
    !result.stdout.includes("OK: tag-at-HEAD"),
    "--close-out must never run Check 1 (tag-at-HEAD), pass or fail",
  );
  assert.ok(
    !result.stdout.includes("target version"),
    "--close-out must never resolve a version, even on the FAIL path",
  );
  assert.ok(
    !result.stderr.includes("CLOSE-OUT PASSED") && !result.stdout.includes("ALL CHECKS PASSED"),
    "a FAILing close-out run must not print either PASSED summary line",
  );
});

// ---------------------------------------------------------------------------
// Close-out success (VR-25; AC4, E84): --close-out exits 0 with a distinct
// CLOSE-OUT PASSED line when HEAD == upstream, and demonstrably never runs Checks 1/3/4/5/6
// — asserted on the ABSENCE of their `OK:`/check-name output, not merely on
// exit 0 (an exit-0-only pin would equally pass a build that silently
// skipped every check for the wrong reason).
// ---------------------------------------------------------------------------
test("VR-25 (AC4, E84): --close-out exits 0, prints CLOSE-OUT PASSED, and skips Checks 1/3/4/5/6 (absence asserted, not just exit 0)", () => {
  const { root } = mkFixtureRepo({ version: "10.0.14", tag: "at-head", origin: "pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "@{u}"], root);
  assert.equal(headSha, upstreamSha, "sanity: HEAD must equal its pushed upstream");

  const result = runVerify(root, ["--close-out"]);

  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /check:release — CLOSE-OUT PASSED/);
  assert.equal(result.stderr, "", "a passing close-out run must not print to stderr");
  assert.ok(
    !result.stdout.includes("ALL CHECKS PASSED"),
    "must print the distinct close-out summary line, not the normal-mode one",
  );

  for (const [checkLabel, okLine] of [
    ["Check 1 (tag-at-HEAD)", "OK: tag-at-HEAD"],
    ["Check 3 (check-version)", "OK: check-version"],
    ["Check 4 (CHANGELOG entry)", "OK: CHANGELOG entry"],
    ["Check 5 (dist committed+parity)", "OK: dist committed+parity"],
    ["Check 6 (CI ground-truth)", "OK: CI ground-truth"],
  ]) {
    assert.ok(!result.stdout.includes(okLine), `${checkLabel} must not run in --close-out mode`);
  }
  assert.ok(
    !result.stdout.includes("target version"),
    "--close-out must not resolve or require a version argument",
  );
  assert.ok(
    result.stdout.includes("OK: ahead-of-upstream"),
    "close-out's own single check must still report OK when HEAD == upstream",
  );
});

// ---------------------------------------------------------------------------
// Close-out never resolves a version (VR-26; AC4, E84): strengthens the
// close-out success test VR-25 — --close-out must not even ATTEMPT to resolve a version. A deliberately-corrupt package.json (invalid JSON)
// would throw if the version-resolution code path executed at all; since
// that code sits OUTSIDE the runCheck wrapper, an uncaught throw there would
// crash the process (a stack trace + non-zero exit), never CLOSE-OUT PASSED.
// ---------------------------------------------------------------------------
test("VR-26 (AC4, E84): --close-out still passes against a fixture whose package.json is invalid JSON — version is never read", () => {
  const { root } = mkFixtureRepo({ version: "10.0.15", tag: "at-head", origin: "pushed" });
  fs.writeFileSync(path.join(root, "package.json"), "{ this is not valid JSON");

  const result = runVerify(root, ["--close-out"]);

  assert.equal(
    result.status,
    0,
    `a corrupt package.json must not matter in --close-out mode; stderr: ${result.stderr}`,
  );
  assert.match(result.stdout, /check:release — CLOSE-OUT PASSED/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// Check 1's bookkeeping-commit tolerance (specs/e141-tag-at-head-bookkeeping-tolerance.md):
// the tolerance itself, its two guard rails (the ancestry precondition and
// Check 2's independence) and two code-reviewer observations worth a pin.
// ---------------------------------------------------------------------------

// Bookkeeping-only range is tolerated (VR-27; AC2, E141): the human's stated
// bar, half 1 — a single post-tag commit touching ONLY the SOP step 13a bookkeeping paths (the v3.111.0
// shape: .current/handoff.md + .current/metrics.jsonl + tasks.md in one
// commit) must be TOLERATED — Check 1 OK, with an explicit NOTE naming the
// tolerated commit count so the audit trail shows a tolerance fired rather
// than a silent pass.
test("VR-27 (AC2, E141): one post-tag commit touching only .current/handoff.md + .current/*.jsonl + tasks.md -> Check 1 OK with tolerance NOTE, exit 0 (v3.111.0 shape)", () => {
  const { root } = mkFixtureRepo({ version: "3.111.0", tag: "behind-head-bookkeeping" });
  const tagSha = git(["rev-list", "-n", "1", "v3.111.0"], root);
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.notEqual(tagSha, headSha, "sanity: the bookkeeping commit must move HEAD past the tag");
  // Push the bookkeeping commit too, so this test isolates Check 1's
  // tolerance in a fully-clean run (Check 2's own unpushed scenario is
  // pinned separately by VR-30) — mkFixtureRepo pushes origin BEFORE the
  // tag block runs, so any post-tag commit is unpushed by construction
  // unless re-pushed here.
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v3.111.0"]);
  assert.equal(result.status, 0, `bookkeeping-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v3\.111\.0/,
    "a tolerated pass must say so explicitly and name the tolerated count",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

// Tag == HEAD is unchanged (VR-28; AC1, E141): it stays byte-identical to the
// behaviour before the tolerance existed — the equality path returns before any new code runs, so no
// tolerance note is ever printed even though the tolerance machinery now
// exists in the same check.
test("VR-28 (AC1, E141): tag == HEAD -> plain 'OK: tag-at-HEAD', no tolerance note, byte-identical to pre-E141 behaviour", () => {
  const { root } = mkFixtureRepo({ version: "4.0.0", tag: "at-head" });

  const result = runVerify(root, ["v4.0.0"]);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /^OK: tag-at-HEAD$/m);
  assert.doesNotMatch(
    result.stdout,
    /NOTE: tag-at-HEAD/,
    "the equality path is not the tolerance path — it must never emit the NOTE",
  );
});

// Ancestry precondition (VR-29; AC4, E141): ancestry is a precondition of the
// tolerance, never a substitute for it. A tag on a divergent branch (not an ancestor of HEAD)
// keeps the ORIGINAL "does not point at HEAD" FAIL, with no range
// enumeration appended — the tolerance code path is never reached because
// the ancestry check short-circuits first.
test("VR-29 (AC4, E141): tag is NOT an ancestor of HEAD (diverged branch) -> original FAIL preserved, no range enumeration, no tolerance note", () => {
  const { root } = mkFixtureRepo({ version: "5.0.0", tag: "diverged" });
  const tagSha = git(["rev-list", "-n", "1", "v5.0.0"], root);
  const headSha = git(["rev-parse", "HEAD"], root);

  const isAncestor = spawnSync("git", ["merge-base", "--is-ancestor", tagSha, headSha], {
    cwd: root,
  });
  assert.notEqual(isAncestor.status, 0, "sanity: the fixture's tag must NOT be an ancestor of HEAD");

  const result = runVerify(root, ["v5.0.0"]);
  assert.notEqual(result.status, 0, "a non-ancestor tag must still fail the run");
  assert.match(
    result.stderr,
    new RegExp(`FAIL: tag v5\\.0\\.0 \\(${tagSha}\\) does not point at HEAD \\(${headSha}\\)`),
  );
  assert.doesNotMatch(
    result.stderr,
    /commit\(s\) in range/,
    "AC4: ancestry precondition failing must never fall through to range enumeration",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// VR-30 (E141): a tolerated Check 1 must never make an unpushed release look
// clean; Check 2 compares HEAD with @{u} directly. mkFixtureRepo pushes before
// the tag block runs, so this fixture's bookkeeping commit is unpushed.
test("VR-30 (AC5, E141): genuinely unpushed bookkeeping commit -> Check 1 tolerates it (OK+NOTE) but Check 2 still FAILs 'local commits not pushed'", () => {
  const { root } = mkFixtureRepo({
    version: "6.0.0",
    tag: "behind-head-bookkeeping",
    origin: "pushed",
  });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "origin/main"], root);
  assert.notEqual(headSha, upstreamSha, "sanity: the bookkeeping commit must be unpushed");

  const result = runVerify(root, ["v6.0.0"]);
  assert.notEqual(result.status, 0, "an unpushed bookkeeping commit must still fail the overall run");
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\)/,
    "Check 1 must tolerate the bookkeeping commit and say so",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.match(
    result.stderr,
    /FAIL:.*local commits not pushed/,
    "Check 2 must independently FAIL — the tolerance must never mask an unpushed release",
  );
});

// Deleting a bookkeeping path is tolerated (VR-31): a post-tag commit that
// DELETES an allowlisted bookkeeping path is tolerated — a non-blocking
// code-reviewer observation, pinned as documented current behaviour. The path
// is bookkeeping either way, whether it is written or removed; see review
// observation 4 in T-E141-01 (E141).
test("VR-31 (E141, observation 4 pin): a post-tag commit deleting an allowlisted bookkeeping file is tolerated -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "7.0.0", tag: "behind-head-bookkeeping-delete" });
  // Push the tolerated commit too, isolating Check 1 (see VR-27's comment).
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v7.0.0"]);
  assert.equal(result.status, 0, `deleting a bookkeeping path must be tolerated; stderr: ${result.stderr}`);
  assert.match(result.stdout, /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\)/);
});

// A non-ASCII filename fails closed (VR-32): a non-ASCII allowlisted filename
// fails CLOSED — a non-blocking code-reviewer observation, pinned as documented
// current behaviour (E141, T-E141-01 review observation 5). Under default core.quotePath, git reports the path
// quoted/octal-escaped, which matches none of the allowlist regexes, so the
// commit is (correctly) treated as touching a non-bookkeeping path rather
// than silently tolerated.
test("VR-32 (E141, observation 5 pin): a non-ASCII allowlisted filename fails CLOSED -> Check 1 FAIL naming the offending (quoted) path, no tolerance note", () => {
  const { root } = mkFixtureRepo({ version: "8.0.0", tag: "behind-head-nonascii" });

  const result = runVerify(root, ["v8.0.0"]);
  assert.notEqual(result.status, 0, "a non-ASCII bookkeeping-shaped filename must fail closed, not pass");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*current/,
    "the FAIL must name the offending (quoted) path rather than silently passing",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// Lane-path shapes of Check 1's bookkeeping tolerance (VR-39..VR-42, E174a):
// per-lane bookkeeping files, plus archive/ and history/, which are never lanes.
// ---------------------------------------------------------------------------

test("VR-39 (E174a): a post-tag commit touching only .current/_primary/{handoff.md,telemetry.jsonl} + .current/e174a/{dispatch.jsonl,usage.jsonl} -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "11.0.0", tag: "behind-head-bookkeeping-lane" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v11.0.0"]);
  assert.equal(result.status, 0, `lane-scoped bookkeeping-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v11\.0\.0/,
    "a tolerated pass must say so explicitly, same as the flat-path shape",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

test("VR-40 (E174a): a lane literally named 'archived' is tolerated (distinct from the excluded 'archive' directory)", () => {
  const { root } = mkFixtureRepo({ version: "11.1.0", tag: "behind-head-bookkeeping-archived-lane" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v11.1.0"]);
  assert.equal(result.status, 0, `the 'archived' lane must be tolerated; stderr: ${result.stderr}`);
  assert.match(result.stdout, /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\)/);
  assert.match(result.stdout, /OK: tag-at-HEAD/);
});

test("VR-41 (E174a): a post-tag commit touching .current/archive/... is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "11.2.0", tag: "behind-head-bookkeeping-archive-dir" });

  const result = runVerify(root, ["v11.2.0"]);
  assert.notEqual(result.status, 0, "a commit touching .current/archive/... must fail, not be tolerated");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*archive/,
    "the FAIL must name the offending .current/archive/... path",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-42 (E174a): a post-tag commit touching .current/history/... is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "11.3.0", tag: "behind-head-bookkeeping-history-dir" });

  const result = runVerify(root, ["v11.3.0"]);
  assert.notEqual(result.status, 0, "a commit touching .current/history/... must fail, not be tolerated");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*history/,
    "the FAIL must name the offending .current/history/... path",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// Look-alike lane paths are rejected (VR-43..VR-46; human-mandated negative
// cases, E174a): each of these paths superficially resembles an allowlisted lane-scoped bookkeeping path
// but must NOT be tolerated. Each fixture's post-tag commit touches exactly
// one such path; Check 1 must FAIL, not silently pass.
// ---------------------------------------------------------------------------

test("VR-43 (A1): .current/a/b/handoff.md (two-segment path, never a lane) is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "12.0.0", tag: "behind-head-a1-nested-lane" });

  const result = runVerify(root, ["v12.0.0"]);
  assert.notEqual(result.status, 0, ".current/a/b/handoff.md must fail, not be tolerated");
  assert.match(result.stderr, /commit\(s\) in range touch non-bookkeeping paths:.*current\/a\/b/);
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-44 (A1): .current/.x/handoff.md (dot-prefixed lane name, not a safe path segment) is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "12.1.0", tag: "behind-head-a1-dot-lane" });

  const result = runVerify(root, ["v12.1.0"]);
  assert.notEqual(result.status, 0, ".current/.x/handoff.md must fail, not be tolerated");
  assert.match(result.stderr, /commit\(s\) in range touch non-bookkeeping paths:.*current\/\.x/);
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-45 (A1): .current/.config.json is NOT tolerated -> Check 1 FAIL (it is explicitly not a lane file)", () => {
  const { root } = mkFixtureRepo({ version: "12.2.0", tag: "behind-head-a1-config" });

  const result = runVerify(root, ["v12.2.0"]);
  assert.notEqual(result.status, 0, ".current/.config.json must fail, not be tolerated");
  assert.match(result.stderr, /commit\(s\) in range touch non-bookkeeping paths:.*config\.json/);
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-46 (A1): .current/_primary/feature-split.md is NOT tolerated -> Check 1 FAIL (not a LANE_FILES entry)", () => {
  const { root } = mkFixtureRepo({ version: "12.3.0", tag: "behind-head-a1-feature-split" });

  const result = runVerify(root, ["v12.3.0"]);
  assert.notEqual(result.status, 0, ".current/_primary/feature-split.md must fail, not be tolerated");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*feature-split\.md/,
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// VR-47: drift guard between the script's LANE_SEGMENT_RE_SRC (plus its
// archive/history exclusion) and dist/tools/lane-paths.js (isSafeLaneName,
// NON_LANE_DIRS). It reads the regex source from the committed script through
// `new Function`, so escaping is read as node reads it, and checks both sides
// over a probe set; changing either side alone fails.
// ---------------------------------------------------------------------------

test("VR-47 (A2): verify-release.mjs's LANE_SEGMENT_RE_SRC + archive/history exclusion stay mirrored to dist/tools/lane-paths.js isSafeLaneName / NON_LANE_DIRS", async () => {
  const { isSafeLaneName, NON_LANE_DIRS } = await import("../dist/tools/lane-paths.js");

  // Extract LANE_SEGMENT_RE_SRC's runtime value from the REAL committed
  // script text via the real JS engine, not a hand-rolled string unescaper.
  const declMatch = REAL_VERIFY_SCRIPT.match(/const LANE_SEGMENT_RE_SRC = "[^\n]*";/);
  assert.ok(
    declMatch,
    "scripts/verify-release.mjs must define LANE_SEGMENT_RE_SRC as a single-line string const — update this test's extraction if the declaration shape changes",
  );
  // eslint-disable-next-line no-new-func -- literal is the script's own committed source text, not external input.
  const laneSegSrc = new Function(`${declMatch[0]}\nreturn LANE_SEGMENT_RE_SRC;`)();

  // The archive/history exclusion, parsed out of the extracted source
  // itself (never hand-typed), then compared against NON_LANE_DIRS by set
  // equality — the human-mandated requirement (A2), not just a spot-check.
  const lookaheadMatch = laneSegSrc.match(/^\(\?!\(\?:([A-Za-z|]+)\)\\\/\)/);
  assert.ok(
    lookaheadMatch,
    "LANE_SEGMENT_RE_SRC must open with a (?!(?:<names>)\\/) exclusion lookahead — update this test's extraction if the shape changes",
  );
  const excludedInScript = new Set(lookaheadMatch[1].split("|"));
  assert.deepStrictEqual(
    [...excludedInScript].sort(),
    [...NON_LANE_DIRS].sort(),
    "verify-release.mjs's excluded-directory names must set-equal dist/tools/lane-paths.js's NON_LANE_DIRS — either side changing alone must turn this red",
  );

  // Acceptance is derived from the dist exports over a probe set (SAFE_LANE_RE
  // is not exported). The exclusion lookahead peeks for a following "/", so it
  // is tested inside a full `.current/<lane>/handoff.md` path.
  const scriptRe = new RegExp(`^\\.current\\/${laneSegSrc}\\/handoff\\.md$`);
  const scriptAccepts = (candidate) => scriptRe.test(`.current/${candidate}/handoff.md`);
  const distAccepts = (candidate) => isSafeLaneName(candidate) && !NON_LANE_DIRS.has(candidate);

  const probes = [
    "_primary",
    "e174a",
    "archive",
    "history",
    "archived",
    "historyx",
    "Archive",
    "HISTORY",
    "archiv",
    "-x",
    ".x",
    "a.b",
    "a b",
    "",
    "a/b",
    "_",
    "9",
    "e1-2",
    "x\n",
    "a_b-2",
    "9-abc",
    "___",
    "e123b9",
  ];
  for (const candidate of probes) {
    assert.equal(
      scriptAccepts(candidate),
      distAccepts(candidate),
      `LANE_SEGMENT_RE_SRC and isSafeLaneName()+NON_LANE_DIRS disagree on ${JSON.stringify(candidate)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// VR-33 (E147): tag at commit A, a bookkeeping-only commit B on top. Check 6
// used to resolve the sha from HEAD (B), missing A's run and even failing on
// B's deliberately red run; it now resolves from the tag (A) first.
// ---------------------------------------------------------------------------
test("VR-33 (AC1, E147): tag at commit A, bookkeeping-only commit B on top (HEAD) -> Check 6 resolves/matches against A, never polls or matches B", () => {
  const { root, firstCommitSha } = mkFixtureRepo({
    version: "10.1.0",
    tag: "behind-head-bookkeeping",
    origin: "pushed",
  });
  const releaseTagSha = git(["rev-list", "-n", "1", "v10.1.0"], root);
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.equal(releaseTagSha, firstCommitSha, "sanity: the tag names commit A");
  assert.notEqual(headSha, firstCommitSha, "sanity: HEAD (B, the bookkeeping commit) must have moved past A");
  // Push B too, so this test isolates Check 6 in an otherwise fully-clean run
  // (mkFixtureRepo pushes origin BEFORE the tag block runs, so the post-tag
  // bookkeeping commit is unpushed by construction unless re-pushed here —
  // same reasoning as VR-27).
  git(["push", "-q", "origin", "main"], root);

  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: firstCommitSha, // A — the commit the release tag actually names
          url: "https://example.com/actions/runs/100",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          // B — the bookkeeping commit at HEAD. If Check 6 regressed to
          // resolving releaseSha from HEAD instead of the tag, it would match
          // THIS entry instead and FAIL the release off a bookkeeping
          // commit's (fabricated, deliberately red) CI status.
          conclusion: "failure",
          headSha,
          url: "https://example.com/actions/runs/101",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ]),
    ),
  );

  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.1.0"]);
  assert.equal(
    result.status,
    0,
    `Check 6 must resolve/match against tag commit A, not HEAD (B); stderr: ${result.stderr}`,
  );
  assert.match(
    result.stdout,
    /OK: CI ground-truth/,
    "a green run recorded against the release tag's own commit must report OK",
  );
  assert.ok(
    !result.stdout.includes("WARN: CI ground-truth"),
    "the matching run for A exists in the shimmed list — this must not degrade to WARN",
  );
  assert.doesNotMatch(
    result.stderr,
    /FAIL: latest completed CI run/,
    "Check 6 must never surface B's fabricated red run — B is not the commit being released",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.1\.0\)/);
});

// ---------------------------------------------------------------------------
// VR-34 (E147): with no tag, Check 6 falls back to HEAD. A shimmed green run at
// HEAD's sha must still match; VR-1 and VR-8 only show no crash without a tag.
// ---------------------------------------------------------------------------
test("VR-34 (AC2, E147): no tag exists yet -> Check 6's releaseSha falls back to HEAD (unchanged), matches a green run recorded against HEAD's own sha", () => {
  const { root } = mkFixtureRepo({ version: "10.2.0", tag: "none", origin: "pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);

  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha,
          url: "https://example.com/actions/runs/200",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );

  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.2.0"]);
  // Check 1 (tag-at-HEAD) still FAILs (no tag exists) — Check 6 runs
  // independently (no short-circuit, per VR-8's pin) and must still
  // resolve/match against HEAD, unchanged.
  assert.match(result.stderr, /FAIL: tag v10\.2\.0 does not exist/);
  assert.match(
    result.stdout,
    /OK: CI ground-truth/,
    "the pre-tag fallback (HEAD) must still match a run recorded against HEAD's own sha",
  );
  assert.ok(!result.stdout.includes("WARN: CI ground-truth"));
});

// ---------------------------------------------------------------------------
// Check 6 derives the CI branch from the checkout (deriveCIBranch, E165), so a
// release from a maintenance branch queries that branch's runs, not main's.
// VR-35..VR-38: branch and workflow flags, detached HEAD lenient and strict,
// fallback to the local branch. Existing fixtures push "main", so earlier tests
// are unaffected. This shim records its own argv to prove which flags `gh` got,
// or that it was never called.
function mkGhArgvCaptureShim() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-argv-"));
  const argvPath = path.join(dir, "argv");
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\necho "$@" > "${argvPath}"\necho '[]'\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return { dir, argvPath };
}

test("VR-35 (E165): non-main fixture branch -> gh run list receives --branch <that branch> AND --workflow CI", () => {
  const { root } = mkFixtureRepo({ version: "10.3.0", tag: "none", origin: "pushed" });
  // A release cut from a maintenance/hotfix branch, not main — the shape
  // this file's branch-derivation comment names as the motivating regression (E165).
  git(["checkout", "-q", "-b", "release/10.3.x"], root);
  git(["push", "-q", "-u", "origin", "release/10.3.x"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const argv = fs.readFileSync(argvPath, "utf-8").trim();
  assert.match(argv, /(^|\s)--branch release\/10\.3\.x(\s|$)/, `gh must be queried for the checkout's own branch; argv: ${argv}`);
  assert.match(argv, /(^|\s)--workflow CI(\s|$)/, `gh must still be scoped to the CI workflow (E165 non-negotiable AC); argv: ${argv}`);
});

test("VR-36 (E165): detached HEAD, lenient -> gh is NEVER invoked, WARN on stdout, exit 0, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.3.1", tag: "none", origin: "pushed" });
  git(["checkout", "-q", "--detach"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `a detached HEAD must never fail the lenient CI check; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — detached HEAD — no branch to query CI runs for; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
  assert.equal(
    fs.existsSync(argvPath),
    false,
    "gh must not be invoked at all when no branch can be derived (detached HEAD)",
  );
});

test("VR-37 (E165): detached HEAD, --ci-check --strict -> gh is NEVER invoked, FAIL on stderr, exit 1", () => {
  const { root } = mkFixtureRepo({ version: "10.3.2", tag: "none", origin: "pushed" });
  git(["checkout", "-q", "--detach"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check", "--strict"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 1, "detached HEAD must FAIL the strict pre-tag gate, not degrade");
  assert.match(
    result.stderr,
    /FAIL: CI ground-truth — detached HEAD — no branch to query CI runs for — refusing to proceed under the strict pre-tag gate/,
  );
  assert.equal(
    fs.existsSync(argvPath),
    false,
    "gh must not be invoked at all when no branch can be derived (detached HEAD), even under --strict",
  );
});

test("VR-38 (E165): no upstream tracking configured -> falls back to the current local branch name for the CI query", () => {
  const { root } = mkFixtureRepo({ version: "10.3.3", tag: "none", origin: "no-upstream" });
  // "no-upstream" (mkFixtureRepo): origin remote exists but main was never
  // pushed/tracked. Move to a second local-only branch so a pass here can
  // only be explained by the current-branch fallback, never by an upstream
  // this fixture deliberately never configured.
  git(["checkout", "-q", "-b", "hotfix/local-only"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const argv = fs.readFileSync(argvPath, "utf-8").trim();
  assert.match(
    argv,
    /(^|\s)--branch hotfix\/local-only(\s|$)/,
    `gh must be queried for the current local branch when no upstream is configured; argv: ${argv}`,
  );
  assert.match(argv, /(^|\s)--workflow CI(\s|$)/, `argv: ${argv}`);
});

// ---------------------------------------------------------------------------
// Tasks-ledger bookkeeping tolerance (VR-48, VR-49; E126): `.current/_primary/tasks.md`
// and `.current/<lane>/tasks.md`, mirroring VR-39 and VR-40. The lane regex reuses
// LANE_SEGMENT_RE_SRC, which VR-47 already pins, so the drift guard is not extended.
// ---------------------------------------------------------------------------

test("VR-48 (E126 AC10): a post-tag commit touching only .current/_primary/tasks.md -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "13.0.0", tag: "behind-head-bookkeeping-tasks-primary" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v13.0.0"]);
  assert.equal(result.status, 0, `_primary/tasks.md-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v13\.0\.0/,
    "a tolerated pass must say so explicitly, same as the handoff.md/*.jsonl shapes",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

test("VR-49 (E126 AC10): a post-tag commit touching only .current/<lane>/tasks.md -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "13.1.0", tag: "behind-head-bookkeeping-tasks-lane" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v13.1.0"]);
  assert.equal(result.status, 0, `lane-scoped tasks.md-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v13\.1\.0/,
    "a tolerated pass must say so explicitly, same as the lane-scoped handoff.md/*.jsonl shape",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

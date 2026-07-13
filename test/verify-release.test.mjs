// Coded by @qa-engineer
// Tests for specs/e9-release-self-check.md AC1-AC10 (E9 — release self-check
// script + SOP wiring), authored per T-E9-04 (QA build scope, pre-authorized
// new-file creation per the human-approved cut — skill-qa-engineer Phase 3a
// normally requires asking before creating a parallel test file).
//
// scripts/verify-release.mjs resolves its own `root` from `import.meta.url`
// (dirname of the script file, one level up) and every git check runs with
// `cwd: root` — so, exactly like test/check-version.test.mjs, each test
// copies the REAL script byte-for-byte into a temp fixture root's scripts/
// dir and drives it against a REAL, fully-controlled git repo (a local temp
// "origin" bare repo stands in for the remote — no network access, no mocked
// git output). This exercises the actual shipped git logic (tag resolution,
// upstream tracking, fetch failure, dist parity) rather than a
// reimplementation. VR-9/VR-10 (AC9/AC10) are grep-based SOP-text assertions
// against content/skill-release-engineer.md, following the
// test/release-staging.test.mjs precedent for prompt-text-is-the-contract
// features.
//
// Spec-to-Test map:
//   AC1 (tag missing)                                -> VR-1
//   AC2 (tag exists, not at HEAD)                     -> VR-2
//   AC3 (no upstream / not pushed / fetch failure)     -> VR-3
//   AC4 (check-version.mjs fails, stderr propagated)   -> VR-4
//   AC5 (CHANGELOG missing entry)                      -> VR-5
//   AC6 (dist uncommitted changes)                     -> VR-6
//   AC7 (committed dist parity mismatch)                -> VR-7
//   AC8 (all 6 checks report OK -> OK lines + ALL PASSED) -> VR-8
//   AC9 (SOP step 9a + Escalation Routes row)            -> VR-9
//   AC10 (post-closing-write tw_get_state read-back)     -> VR-10
//   Security smoke (boundary inputs)                     -> VR-SEC-1..4
//
// T-EB-04 (E14, backlog row + T-EB-01) additions — Check 6 "CI ground-truth":
//   Check 6 red (definitively failed completed run)      -> VR-11
//   Check 6 green (shimmed success, no WARN emitted)      -> VR-12
//   Check 6 degradation: gh binary missing (ENOENT)       -> VR-13
//   Check 6 degradation: gh exits non-zero (auth/API err)  -> VR-14
//   Check 6 degradation: zero completed runs               -> VR-15
//   Check 6 degradation: unparseable gh output (bonus)    -> VR-16
// These use a `gh` shim on PATH (a tiny executable script placed in a temp
// dir prepended to PATH) rather than the real `gh` binary — the fixture-repo
// convention above still drives every git-facing check exactly as before;
// only Check 6's external `gh` dependency is substituted.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

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
 * Build a fully-controlled real git repo (with a local bare "origin") to
 * drive scripts/verify-release.mjs's actual git logic. Returns { root, run }.
 *
 * Options:
 *   version           target/package.json version (default "1.0.0")
 *   indexVersion      index.ts Server() version (default = version)
 *   distVersion       committed dist/index.js Server() version (default = version)
 *   distContent       raw override for dist/index.js content (null = omit file)
 *   changelog         raw CHANGELOG.md content (null = omit file)
 *   tag               "at-head" | "behind-head" | "none" (default "at-head")
 *   origin            "pushed" | "no-upstream" | "not-pushed" | "unreachable" | "none"
 *   distUncommitted   if true, dirty the working-tree dist/index.js after commit
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
    git(["tag", `v${version}`], root);
    fs.writeFileSync(path.join(root, "AFTER-TAG.md"), "commit after tag\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "after tag"], root);
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
 * Check 6 (E14) shims `gh` via a real executable on PATH rather than mocking
 * spawnSync — this exercises the actual `spawnSync("gh", ...)` resolution
 * path in scripts/verify-release.mjs, mirroring the "drive the real script
 * against a real environment" convention the rest of this file uses for git.
 *
 * `runVerifyWithPath` overrides the CHILD PROCESS's PATH so verify-release.mjs
 * finds the shim (or, for the gh-missing case, finds no `gh` at all) while
 * `git` still resolves from a real system path — isolating Check 6 without
 * disturbing Checks 1-5.
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

// A PATH containing ONLY the external binaries this test file legitimately
// needs and NOTHING ELSE (crucially, never `gh`): `git` (Checks 1/2/5's
// `execFileSync("git", ...)` and check-version.mjs's git calls — `node`
// itself is invoked via the absolute `process.execPath`, and
// check-version.mjs's `execSync` shells out to the literal `/bin/sh`, not a
// PATH-resolved `sh`) plus `cat` (the `ghJsonShim` fixtures' `#!/bin/sh`
// bodies pipe their canned JSON through `cat <<'EOF' ... EOF`, an external
// command the shell resolves via PATH — `echo`-only shim bodies need
// nothing extra, since `echo` is a shell builtin).
//
// A fixed "/usr/bin:/bin" (the prior approach) is NOT a safe "no gh" PATH on
// every host: GitHub's ubuntu-latest hosted runner image installs the `gh`
// CLI via apt at /usr/bin/gh, so that static path silently stops being
// gh-less in CI (VR-13 root cause — it degraded to the real `gh`, which then
// hit the gh-run-list-failed branch instead of ENOENT, and only the ENOENT
// wording was pinned). Building the shim from whatever this test runner's
// OWN environment actually resolves makes the "no gh anywhere on PATH"
// guarantee hold on any machine, not just ones shaped like a macOS/Homebrew
// checkout.
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

function runVerifyWithPath(root, pathValue, args = []) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), ...args],
    { cwd: root, encoding: "utf-8", env: { ...process.env, PATH: pathValue } },
  );
}

function ghJsonShim(json) {
  return `#!/bin/sh\ncat <<'EOF'\n${json}\nEOF\n`;
}

// ---------------------------------------------------------------------------
// VR-1 (AC1): tag missing
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
// VR-2 (AC2): tag exists but points at a commit other than HEAD
// ---------------------------------------------------------------------------
test("VR-2 (AC2): tag exists but points at a commit other than HEAD -> exit non-zero, failure line names both commits", () => {
  const { root, firstCommitSha } = mkFixtureRepo({ version: "2.0.0", tag: "behind-head" });
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.notEqual(firstCommitSha, headSha, "sanity: HEAD must have moved past the tagged commit");

  const result = runVerify(root, ["v2.0.0"]);
  assert.notEqual(result.status, 0, "a stale tag (not at HEAD) must fail the run");
  assert.match(
    result.stderr,
    /FAIL: tag v2\.0\.0 \([0-9a-f]+\) does not point at HEAD \([0-9a-f]+\)/,
    "failure line must name both the tag's commit and HEAD's commit",
  );
  assert.ok(result.stderr.includes(firstCommitSha.slice(0, 7)) || result.stderr.includes(firstCommitSha));
});

// ---------------------------------------------------------------------------
// VR-3 (AC3): push-status checks — no upstream / not pushed / fetch failure
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
// VR-4 (AC4): check-version.mjs itself fails -> stderr propagated verbatim
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
// VR-5 (AC5): CHANGELOG has no entry for the target version
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
// VR-6 (AC6): dist/ has uncommitted working-tree changes
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
// VR-7 (AC7): committed dist/index.js at HEAD carries the wrong version
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
// VR-8 (AC8): all six checks report OK (title corrected T-EB-04 — Check 6/E14
// landed after this test was first authored against 5 checks; the loop
// below was asserting OK lines by name, never a count, so it stayed green
// through E14 by accident rather than by design — see review_T-EB-03.md).
// Check 6 is included in the OK-line loop below: the fixture's origin is a
// local bare repo, not a real GitHub remote, so `gh run list` cannot resolve
// a host and Check 6 degrades via WARN — but a WARN is not a fail, so it
// still reports OK and the run still exits 0 with empty stderr. This is
// intentionally NOT gh-shimmed (unlike VR-11..VR-16 below): it pins the
// real, unmodified environment behavior a bare `npm test` run hits.
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
    tag: "none", // AC1 fails
    changelog: null, // AC5 fails
    distUncommitted: true, // AC6 fails (version itself still matches)
    origin: "no-upstream", // AC3 fails
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
// VR-11 (E14, T-EB-01): Check 6 — a definitively red completed CI run on main
// STOPs the release; every other check still runs and reports OK (no
// short-circuit), matching the Checks-run-independently invariant already
// pinned for VR-8's multi-cause-failure test.
// ---------------------------------------------------------------------------
test("VR-11 (E14): shimmed gh reports a red completed run -> exit non-zero, FAIL names conclusion+headSha+url, other 5 checks still OK", () => {
  const { root } = mkFixtureRepo({ version: "10.0.0", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "failure",
          headSha: "2222222222222222222222222222222222222222",
          url: "https://example.com/actions/runs/2",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.0"]);
  assert.notEqual(result.status, 0, "a red completed CI run must FAIL the release self-check");
  assert.match(
    result.stderr,
    /FAIL: latest completed CI run on main concluded "failure" \(head 222222222222\) — https:\/\/example\.com\/actions\/runs\/2/,
    "FAIL line must name the conclusion, the (truncated) head SHA, and the run URL",
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
// VR-12 (E14): Check 6 — a green completed CI run reports OK with no WARN.
// ---------------------------------------------------------------------------
test("VR-12 (E14): shimmed gh reports a successful completed run -> OK line, exit 0, no WARN emitted, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.1", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: "1111111111111111111111111111111111111111",
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
    "a genuinely green completed run must not also degrade — WARN is reserved for cannot-obtain-ground-truth paths",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.0\.1\)/);
  assert.equal(result.stderr, "", "a fully passing run (including a real green Check 6) must not print to stderr");
});

// ---------------------------------------------------------------------------
// VR-13 (E14): Check 6 degradation — gh binary missing (ENOENT) -> WARN on
// stdout, check still reports OK, release still exits 0. The ONLY failure
// mode is a definitively red completed run (VR-11); every "cannot obtain
// ground truth" path must degrade gracefully, never block a release on
// missing/unconfigured tooling.
//
// CI-flake fix (post-v3.83.0, VR-13 CI Fix): this test previously ran with a
// hardcoded `PATH="/usr/bin:/bin"`, reasoning "git lives there but gh
// doesn't" — true on a macOS/Homebrew checkout, false on GitHub's
// ubuntu-latest hosted runner, which installs the `gh` CLI via apt at
// /usr/bin/gh. There, this PATH resolved the REAL gh, which (unauthenticated,
// no GH_TOKEN) exited non-zero with an auth error — the WARN text for that
// path is pinned by VR-14, not this test's ENOENT wording — turning this test
// red on every CI run since v3.83.0. `noGhSystemPath()` builds the "no gh
// anywhere" PATH from whatever `git` THIS test process's own PATH resolves
// to, so the guarantee holds on any host, not just ones shaped like this
// author's machine.
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
// VR-14 (E14 degradation): Check 6 — gh exits non-zero (auth/network/API
// error) -> WARN on stdout carrying gh's own error detail, never a FAIL.
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
// VR-15 (E14 degradation): Check 6 — zero completed CI runs found (e.g. a
// brand-new repo, or CI renamed/disabled) -> WARN on stdout, never a FAIL.
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
// VR-16 (E14 degradation, bonus coverage): unparseable gh stdout (malformed
// JSON) -> WARN on stdout, never a FAIL. Beyond the task's named three
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
// VR-9 (AC9): content/skill-release-engineer.md SOP step + Escalation Routes row
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
});

// ---------------------------------------------------------------------------
// VR-10 (AC10): post-closing-write tw_get_state read-back
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

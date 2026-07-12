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
//   AC8 (all 5 checks pass -> OK lines + ALL PASSED)     -> VR-8
//   AC9 (SOP step 9a + Escalation Routes row)            -> VR-9
//   AC10 (post-closing-write tw_get_state read-back)     -> VR-10
//   Security smoke (boundary inputs)                     -> VR-SEC-1..4

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
// VR-8 (AC8): all five checks pass
// ---------------------------------------------------------------------------
test("VR-8 (AC8): all 5 checks pass -> one OK line per check, final ALL CHECKS PASSED line, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "8.0.0", tag: "at-head", origin: "pushed" });
  const result = runVerify(root, ["v8.0.0"]);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  for (const name of ["tag-at-HEAD", "pushed-to-origin", "check-version", "CHANGELOG entry", "dist committed+parity"]) {
    assert.match(result.stdout, new RegExp(`OK: ${name.replace(/[+]/g, "\\+")}`), `expected an OK line for '${name}'`);
  }
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v8\.0\.0\)/);
  assert.equal(result.stderr, "", "a fully passing run must not print anything to stderr");
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

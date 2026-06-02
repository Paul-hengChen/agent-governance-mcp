// Coded by @qa-engineer
// Tests for spec: specs/release-engineer-complete-staging.md (v3.22.1).
//
// Spec-to-Test map:
//   AC1 (explicit directory enumeration)           -> t-ac1-directory-list
//   AC2 (pre-commit git diff --cached --stat)      -> t-ac2-verify-cmd, t-fixture-a, t-fixture-b
//   AC3 (inverted failure-mode wording)            -> t-ac3-failure-mode-wording
//   AC4 (post-commit spec-file sanity check)       -> t-ac4-post-commit-check, t-fixture-c, t-fixture-d
//   AC5 (shim reinforcement hint, <=2 sentences)   -> t-ac5-shim-hint
//   AC6 (this test file itself exercises fixtures) -> t-fixture-a, t-fixture-b, t-fixture-c, t-fixture-d
//   AC7 (npm test green)                           -> exercised by running npm test
//   AC8/AC9 (version 3.22.1)                       -> subagent-templates.test.mjs "v3.22.1 AC9"
//
// WHY: the release-engineer SOP lives purely in prompt text
// (content/skill-release-engineer.md), loaded by tw_switch_role("release-engineer").
// There is no server enforcement — the contract IS the SOP wording reaching the
// haiku-tier agent. These tests pin (a) that the staging instruction enumerates
// required directories explicitly, (b) that the pre-commit verify step is present,
// (c) that the failure-mode wording is inverted (source dirs are EXPECTED, not
// blocked), and (d) that the post-commit spec-file sanity check fires with the
// verbatim AC4 error string. Behavioral-simulation fixtures use mocked git output
// (strings, not real git processes) consistent with test/feature-scope-gate.test.mjs
// and test/researcher-deep-research.test.mjs patterns.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = fs.readFileSync(
  path.join(ROOT, "content", "skill-release-engineer.md"),
  "utf-8",
);
const SHIM = fs.readFileSync(
  path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Content-assertion helpers (mirror the SOP logic in pure JS so fixtures
// can exercise branching without spawning a real git process).
// ---------------------------------------------------------------------------

// The directories the SOP declares as feature source dirs (AC1, AC2, AC3).
const FEATURE_DIRS = ["lib/", "tools/", "schema/", "guards/", "prompts/", "bin/", "scripts/", "content/", "templates/", "specs/", "test/", "qa_reports/", "review_reports/", "transport/"];

/**
 * Simulate the pre-commit verification logic described in AC2:
 * given a mock `git status --short` output and a mock `git diff --cached --stat`
 * output, return { pass: boolean, missing: string[] }.
 *
 * A staging set is FAIL if any FEATURE_DIR that has changes in `git status` is
 * absent from `git diff --cached --stat`. "Metadata-only" staging (only
 * package.json / index.ts / CHANGELOG.md / README.md / dist/) is a FAIL when
 * source dirs have pending edits.
 */
function simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat) {
  // Which feature dirs appear changed in git status?
  const changedDirs = FEATURE_DIRS.filter((d) => gitStatusShort.includes(d));
  // Which feature dirs appear in the cached diff?
  const stagedDirs = FEATURE_DIRS.filter((d) => gitDiffCachedStat.includes(d));
  // Missing = changed but not staged
  const missing = changedDirs.filter((d) => !stagedDirs.includes(d));
  return { pass: missing.length === 0, missing };
}

/**
 * Simulate the post-commit sanity check described in AC4:
 * given a mock `git diff HEAD~1 --name-only` output and the active_feature name,
 * return { pass: boolean, errorMsg: string | null }.
 *
 * The spec file `specs/<active_feature>.md` MUST appear in the diff.
 * If absent, emit the verbatim AC4 error string.
 */
function simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature) {
  const specFile = `specs/${activeFeature}.md`;
  if (gitDiffHeadNameOnly.includes(specFile)) {
    return { pass: true, errorMsg: null };
  }
  return {
    pass: false,
    errorMsg: `Release commit incomplete: specs/${activeFeature}.md is absent from the commit. Stage missing files and amend or create a fix commit.`,
  };
}

// ---------------------------------------------------------------------------
// Phase 1 — Content assertion tests (AC1–AC5)
// ---------------------------------------------------------------------------

test("AC1: skill-release-engineer.md enumerates required staging directories explicitly", () => {
  // Contract: the git add instruction must name each required directory by path.
  // Abstract language ("touched files", "all relevant files") is prohibited.
  for (const dir of FEATURE_DIRS) {
    assert.ok(
      SKILL.includes(dir),
      `skill-release-engineer.md must mention '${dir}' in the staging instruction (AC1)`,
    );
  }
  // The metadata files must also be present in the staging instruction
  for (const meta of ["package.json", "index.ts", "CHANGELOG.md", "README.md", "dist/"]) {
    assert.ok(
      SKILL.includes(meta),
      `skill-release-engineer.md must mention '${meta}' in the staging instruction (AC1)`,
    );
  }
  // Must NOT use the old abstract phrasing
  assert.ok(
    !SKILL.includes("git add <touched files"),
    "skill-release-engineer.md must NOT contain the old 'git add <touched files' abstract phrasing (AC1)",
  );
});

test("AC2: skill-release-engineer.md includes pre-commit 'git diff --cached --stat' verify step", () => {
  // Contract: the SOP must instruct the agent to run git diff --cached --stat
  // and cross-reference against git status --short before committing.
  assert.match(
    SKILL,
    /git diff --cached --stat/,
    "SOP must reference 'git diff --cached --stat' as the pre-commit verify command (AC2)",
  );
  assert.match(
    SKILL,
    /git status --short/,
    "SOP must reference 'git status --short' for cross-reference (AC2)",
  );
  // Metadata-only staging with source dirs having changes must be a FAIL signal
  assert.match(
    SKILL,
    /Metadata-only staging[\s\S]*?FAIL signal/,
    "SOP must declare metadata-only staging as a FAIL signal when source dirs have pending edits (AC2)",
  );
});

test("AC3: failure-mode wording is inverted — source dirs are EXPECTED, not blocked", () => {
  // Contract (v3.22.1 fix): the old 'release-artifact whitelist' stop condition
  // must be replaced with inverted framing: feature source files are EXPECTED;
  // only UNRELATED uncommitted changes trigger STOP.
  assert.ok(
    !SKILL.includes("release-artifact whitelist"),
    "skill-release-engineer.md must NOT contain 'release-artifact whitelist' (old framing replaced by AC3)",
  );
  assert.match(
    SKILL,
    /EXPECTED in a release commit/,
    "failure-mode section must declare feature source files as EXPECTED (AC3)",
  );
  assert.match(
    SKILL,
    /UNRELATED uncommitted changes/i,
    "failure-mode section must limit STOP condition to UNRELATED paths (AC3)",
  );
  assert.match(
    SKILL,
    /Pre-existing uncommitted changes found in <path> — this path is unrelated to the active feature\. Commit or stash it first\./,
    "failure-mode must include the verbatim AC3 stop-condition string (AC3)",
  );
});

test("AC4: skill-release-engineer.md includes post-commit spec-file sanity check with verbatim error string", () => {
  // Contract: after git commit, the agent must run git diff HEAD~1 --name-only
  // and verify specs/<active_feature>.md appears. If not, STOP with exact wording.
  assert.match(
    SKILL,
    /git diff HEAD~1 --name-only/,
    "SOP must reference 'git diff HEAD~1 --name-only' as the post-commit check command (AC4)",
  );
  assert.match(
    SKILL,
    /specs\/<active_feature>\.md/,
    "post-commit check must reference 'specs/<active_feature>.md' (AC4)",
  );
  // Verbatim AC4 error string
  assert.ok(
    SKILL.includes(
      "Release commit incomplete: specs/<active_feature>.md is absent from the commit. Stage missing files and amend or create a fix commit.",
    ),
    "SOP must contain the verbatim AC4 error string (AC4)",
  );
});

test("AC5: release-engineer.md shim contains a reinforcement hint (<=2 sentences)", () => {
  // Contract: the shim must remind haiku-tier that staging scope = all upstream work,
  // not just files edited in the current turn. The hint is <=2 sentences and must
  // NOT alter the watermark line or the tw_get_state/tw_switch_role invocation.
  assert.match(
    SHIM,
    /ALL uncommitted upstream work/,
    "shim must mention 'ALL uncommitted upstream work' in the hint (AC5)",
  );
  assert.match(
    SHIM,
    /not just files you edited this turn/,
    "shim must clarify 'not just files you edited this turn' (AC5)",
  );
  // Watermark line must be preserved verbatim
  assert.match(
    SHIM,
    /CRITICAL: End every reply with `— @release-engineer \(haiku\)` per Constitution §1 \(watermark\)\./,
    "shim watermark line must be preserved verbatim (AC5)",
  );
  // tw_get_state / tw_switch_role invocations must be preserved
  assert.match(SHIM, /tw_get_state/, "shim must preserve tw_get_state instruction (AC5)");
  assert.match(SHIM, /tw_switch_role/, "shim must preserve tw_switch_role instruction (AC5)");
  // Hint length: extract it and count sentences (rough heuristic: periods/! after a word)
  // The reinforcement hint is the third non-frontmatter paragraph.
  // We verify the whole shim body is not bloated — shim should stay compact.
  const bodyLines = SHIM.split("\n").filter((l) => l.trim() && !l.startsWith("---") && !l.startsWith("#"));
  const hintLine = bodyLines.find(
    (l) => l.includes("ALL uncommitted upstream work") || l.includes("Staging scope"),
  );
  assert.ok(hintLine, "shim must have a hint line about staging scope (AC5)");
  // Count sentences in the hint line (split on '. ' or '.' at end-of-string)
  const sentences = hintLine.split(/\.\s+|\.$/).filter(Boolean);
  assert.ok(
    sentences.length <= 2,
    `shim hint must be <=2 sentences; found ${sentences.length}: ${hintLine} (AC5)`,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 — Behavioral-simulation fixtures (AC6 / spec §Design Decisions §5)
// ---------------------------------------------------------------------------

test("Fixture A (AC2, AC6): metadata-only staged output triggers FAIL when source dirs have changes", () => {
  // Simulate: git status shows content/ and specs/ have uncommitted changes,
  // but git diff --cached --stat shows only metadata files staged.
  // Expected: simulatePreCommitVerify returns FAIL with missing dirs listed.

  const gitStatusShort = [
    " M content/skill-release-engineer.md",
    " M specs/release-engineer-complete-staging.md",
    " M templates/claude-code-agents/release-engineer.md",
    " M package.json",
    " M index.ts",
    " M CHANGELOG.md",
    " M dist/index.js",
  ].join("\n");

  const gitDiffCachedStat = [
    // Only metadata files staged — source dirs absent
    " package.json         |  2 +-",
    " index.ts             |  2 +-",
    " CHANGELOG.md         |  8 ++++++++",
    " README.md            |  4 ++--",
    " dist/index.js        | 10 +++++-----",
    " 5 files changed, 14 insertions(+), 6 deletions(-)",
  ].join("\n");

  const result = simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat);
  assert.equal(result.pass, false, "Fixture A: metadata-only staging must produce FAIL");
  assert.ok(result.missing.includes("content/"), "Fixture A: content/ must be in missing list");
  assert.ok(result.missing.includes("specs/"), "Fixture A: specs/ must be in missing list");
  assert.ok(result.missing.includes("templates/"), "Fixture A: templates/ must be in missing list");
  assert.equal(result.missing.length, 3, "Fixture A: exactly 3 source dirs must be flagged as missing");
});

test("Fixture B (AC1, AC3, AC6): complete staging passes pre-commit verify", () => {
  // Simulate: git status shows all feature dirs have changes,
  // and git diff --cached --stat shows them all staged.
  // Expected: simulatePreCommitVerify returns pass=true, no missing dirs.

  const gitStatusShort = [
    " M content/skill-release-engineer.md",
    " M templates/claude-code-agents/release-engineer.md",
    " M specs/release-engineer-complete-staging.md",
    " M test/release-staging.test.mjs",
    " M qa_reports/review_T460-T462.md",
    " M package.json",
    " M index.ts",
    " M CHANGELOG.md",
    " M dist/index.js",
  ].join("\n");

  const gitDiffCachedStat = [
    " content/skill-release-engineer.md    | 18 ++++++++++--------",
    " templates/claude-code-agents/release-engineer.md |  3 +++",
    " specs/release-engineer-complete-staging.md | 117 ++++++++++++++",
    " test/release-staging.test.mjs        | 210 +++++++++++++++++++++++",
    " qa_reports/review_T460-T462.md       |  42 +++++",
    " package.json                         |   2 +-",
    " index.ts                             |   2 +-",
    " CHANGELOG.md                         |   8 +++++++",
    " dist/index.js                        |  10 ++++--",
    " 9 files changed, 399 insertions(+), 15 deletions(-)",
  ].join("\n");

  const result = simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat);
  assert.equal(result.pass, true, "Fixture B: complete staging must produce PASS");
  assert.equal(result.missing.length, 0, "Fixture B: no feature dirs should be flagged as missing");
});

test("Fixture C (AC4, AC6): post-commit check fires with verbatim AC4 error when spec file absent", () => {
  // Simulate: git diff HEAD~1 --name-only shows metadata bumps only;
  // specs/release-engineer-complete-staging.md is missing.
  // Expected: simulatePostCommitCheck returns pass=false with the exact AC4 error string.

  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = [
    "CHANGELOG.md",
    "README.md",
    "dist/index.js",
    "index.ts",
    "package.json",
  ].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature);
  assert.equal(result.pass, false, "Fixture C: missing spec file must produce FAIL");
  assert.equal(
    result.errorMsg,
    "Release commit incomplete: specs/release-engineer-complete-staging.md is absent from the commit. Stage missing files and amend or create a fix commit.",
    "Fixture C: error message must match verbatim AC4 error string",
  );
});

test("Fixture D (AC4, AC6): post-commit check passes silently when spec file present", () => {
  // Simulate: git diff HEAD~1 --name-only includes the spec file.
  // Expected: simulatePostCommitCheck returns pass=true, no error.

  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = [
    "CHANGELOG.md",
    "README.md",
    "content/skill-release-engineer.md",
    "dist/index.js",
    "index.ts",
    "package.json",
    "qa_reports/review_T460-T462.md",
    "specs/release-engineer-complete-staging.md",
    "templates/claude-code-agents/release-engineer.md",
    "test/release-staging.test.mjs",
  ].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature);
  assert.equal(result.pass, true, "Fixture D: spec file present must produce PASS");
  assert.equal(result.errorMsg, null, "Fixture D: no error message when spec file is present");
});

// ---------------------------------------------------------------------------
// Phase 3 — Repo-scan guard: no source dir silently falls out of releases
// ---------------------------------------------------------------------------

// Directories that are NOT source code and are excluded from staging.
const EXCLUDED_DIRS = new Set([
  "node_modules", "dist", ".git", ".backup", ".current", ".github", ".claude",
  "docs", "research",
]);

// Metadata files explicitly staged (not dirs).
const METADATA_PATTERNS = ["tsconfig.json", "package.json", "index.ts", "CHANGELOG.md", "README.md"];

test("AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list", () => {
  // Scan the repo root for directories that contain .ts or .mjs source files.
  // Any such directory that is NOT in EXCLUDED_DIRS must appear in FEATURE_DIRS
  // so that a new source dir can't silently fall out of releases.
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  const sourceDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !EXCLUDED_DIRS.has(e.name))
    .filter((e) => {
      // Check if directory contains at least one .ts or .mjs file (direct children)
      try {
        const children = fs.readdirSync(path.join(ROOT, e.name));
        return children.some((c) => c.endsWith(".ts") || c.endsWith(".mjs"));
      } catch {
        return false;
      }
    })
    .map((e) => `${e.name}/`);

  const missing = sourceDirs.filter((d) => !FEATURE_DIRS.includes(d));
  assert.deepEqual(
    missing,
    [],
    `Source directories missing from FEATURE_DIRS (would be omitted from releases): ${missing.join(", ")}. ` +
    `Add them to FEATURE_DIRS in this test and to the git add enumeration in content/skill-release-engineer.md SOP step 7.`,
  );
});

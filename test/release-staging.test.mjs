// Coded by @qa-engineer
// Tests for spec: specs/release-engineer-complete-staging.md (v3.22.1);
// backlog.md E44/E49 rows (docs/backlog.md:161,172) for the T-E44-01/T-E49-01
// conditional-check rework, mini-chain, backlog rows ARE the spec.
//
// Spec-to-Test map:
//   AC1 (explicit directory enumeration)           -> t-ac1-directory-list
//   AC2 (pre-commit git diff --cached --stat)      -> t-ac2-verify-cmd, t-fixture-a, t-fixture-b
//   AC3 (inverted failure-mode wording)            -> t-ac3-failure-mode-wording
//   AC4 (post-commit spec-file check, E44 conditional:
//        REQUIRE/SKIP/UNCLASSIFIABLE)              -> t-ac4-post-commit-check, t-fixture-c..h,
//                                                      "AC4 branch exhaustiveness"
//   AC5 (shim reinforcement hint, <=2 sentences)   -> t-ac5-shim-hint
//   AC6 (this test file itself exercises fixtures) -> t-fixture-a, t-fixture-b, t-fixture-c..h
//   AC7 (npm test green)                           -> exercised by running npm test
//   AC8/AC9 (version 3.22.1)                       -> subagent-templates.test.mjs "v3.22.1 AC9"
//   E49 step 7a (ticket-code SET derivation, working-tree +
//        PREV_TAG membership predicate)            -> "E49 step 7a" test block below
//
// WHY: the release-engineer SOP lives purely in prompt text
// (content/skill-release-engineer.md), loaded by tw_switch_role("release-engineer").
// There is no server enforcement — the contract IS the SOP wording reaching the
// haiku-tier agent. These tests pin (a) that the staging instruction enumerates
// required directories explicitly, (b) that the pre-commit verify step is present,
// (c) that the failure-mode wording is inverted (source dirs are EXPECTED, not
// blocked), (d) that the post-commit spec-file sanity check's three branches
// (REQUIRE/SKIP/UNCLASSIFIABLE, E44) fire correctly and mutually exclusively, and
// (e) that step 7a's ticket-code SET derivation (E49) is coupled to the file
// content that actually shipped, not to substring presence alone — the derivation
// changed twice during review (review_reports/review_T-E4X-03.md rounds 1-3:
// slug-hunting over commit prose -> committed-history --diff-filter=A, silently
// EMPTY on 2 of the last 6 releases -> working-tree enumeration with the git range
// used only as a membership predicate, APPROVED round 3). Behavioral-simulation
// fixtures use mocked git output (strings, not real git processes) consistent with
// test/feature-scope-gate.test.mjs and test/researcher-deep-research.test.mjs
// patterns.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { getTsConfigSourceDirs } from "../dist/lib/tsconfig-source-dirs.js";
import { composeConstitution } from "../dist/prompts/build.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = fs.readFileSync(
  path.join(ROOT, "content", "skill-release-engineer.md"),
  "utf-8",
);
const SHIM = fs.readFileSync(
  path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
  "utf-8",
);
const CONST15 = fs.readFileSync(
  path.join(ROOT, "content", "const-15-core-tail.md"),
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
 * Detect whether a handoff's `scope_decision_why` free-text field records a
 * backlog-row-as-spec mini-chain (PM/architect skipped, backlog rows serve as
 * the spec) — the SKIP-branch trigger from E44 (content/skill-release-engineer.md:87).
 *
 * NOTE (F6, non-blocking, review_reports/review_T-E4X-03.md round 1): this is
 * inherently a judgement call over free text — `scope_decision_why` is optional
 * and unstructured (`z.string().max(2000).optional()`, tools/registry.ts) and no
 * schema field encodes chain shape. This function models a reasonable release-
 * engineer reading of the signal (both "mini-chain" and a PM/architect-skipped
 * marker present) for fixture purposes; it is not a claim that the real SOP step
 * is mechanically decidable — F6 documents that gap and is out of this ticket's
 * scope to close.
 */
function scopeDecisionWhyRecordsMiniChain(scopeDecisionWhy) {
  if (!scopeDecisionWhy) return false;
  return (
    /mini-chain/i.test(scopeDecisionWhy) &&
    /pm(\s*\/\s*|\s+)?arch(itect)?\s*(skip|skipped)/i.test(scopeDecisionWhy)
  );
}

// A realistic mini-chain scope_decision_why, in the shape this repo's own
// handoff actually carries for this feature (tw_get_state, active_feature
// e44-e49-release-sop-conditional-checks): "... mini-chain sr-engineer ->
// code-reviewer -> qa-engineer, PM/ARCH skipped ...".
const MINI_CHAIN_SCOPE_WHY =
  "Backlog rows ARE the spec -> mini-chain sr-engineer -> code-reviewer -> qa-engineer, PM/ARCH skipped (E35-E38/E45/E46 pattern).";

// A non-mini-chain scope_decision_why (full PM/architect chain) — must NOT
// trigger the SKIP branch even though a spec file might still be missing from
// the diff for unrelated reasons.
const FULL_CHAIN_SCOPE_WHY =
  "Full PM/architect chain authored specs/some-feature.md; scope decision: single-feature, straightforward addition.";

const AC4_REQUIRE_STOP =
  "Release commit incomplete: specs/<active_feature>.md is absent from the commit. Stage missing files and amend or create a fix commit.";

const AC4_UNCLASSIFIABLE_STOP =
  "AC4 unclassifiable: no specs/<active_feature>.md in the tree and scope_decision_why does not record a backlog-row-as-spec mini-chain — record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.";

/**
 * Simulate the post-commit sanity check described in AC4 (E44, conditional on
 * dispatch shape — content/skill-release-engineer.md step 8's "Post-commit
 * sanity check (AC4)" bullet, three branches):
 * given a mock `git diff HEAD~1 --name-only` output, the active_feature name,
 * whether `specs/<active_feature>.md` exists ANYWHERE in the working tree, and
 * the handoff's `scope_decision_why` text, return
 * { pass: boolean, branch: "REQUIRE"|"SKIP"|"UNCLASSIFIABLE", errorMsg: string|null }.
 *
 * Branch logic (exhaustive over specExistsInTree x recordsMiniChain):
 *   - specExistsInTree === true  -> REQUIRE, UNCONDITIONALLY (spec-in-tree wins
 *     over SKIP even when scope_decision_why also records a mini-chain — the
 *     branch is keyed on the spec's existence, never on the mini-chain signal).
 *   - specExistsInTree === false AND scope_decision_why records a mini-chain -> SKIP
 *   - specExistsInTree === false AND it does NOT                             -> UNCLASSIFIABLE
 */
function simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, specExistsInTree, scopeDecisionWhy) {
  const specFile = `specs/${activeFeature}.md`;

  if (specExistsInTree) {
    if (gitDiffHeadNameOnly.includes(specFile)) {
      return { pass: true, branch: "REQUIRE", errorMsg: null };
    }
    return {
      pass: false,
      branch: "REQUIRE",
      errorMsg: `Release commit incomplete: specs/${activeFeature}.md is absent from the commit. Stage missing files and amend or create a fix commit.`,
    };
  }

  if (scopeDecisionWhyRecordsMiniChain(scopeDecisionWhy)) {
    return { pass: true, branch: "SKIP", errorMsg: null };
  }

  return {
    pass: false,
    branch: "UNCLASSIFIABLE",
    errorMsg:
      "AC4 unclassifiable: no specs/<active_feature>.md in the tree and scope_decision_why does not record a backlog-row-as-spec mini-chain — record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.",
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

test("AC4 (E44): skill-release-engineer.md's post-commit check is conditional on dispatch shape — REQUIRE/SKIP/UNCLASSIFIABLE, three named branches", () => {
  // Contract (E44, docs/backlog.md:161): the post-commit check is no longer a
  // single unconditional STOP — exactly one of three named branches fires,
  // depending on whether specs/<active_feature>.md exists anywhere in the tree
  // and whether scope_decision_why records a backlog-row-as-spec mini-chain.
  assert.match(SKILL, /\*\*REQUIRE branch\*\*/, "SOP must name the REQUIRE branch (E44)");
  assert.match(SKILL, /\*\*SKIP branch\*\*/, "SOP must name the SKIP branch (E44)");
  assert.match(SKILL, /\*\*UNCLASSIFIABLE branch\*\*/, "SOP must name the UNCLASSIFIABLE branch (E44)");

  // REQUIRE branch retains the pre-E44 mechanics verbatim.
  assert.match(
    SKILL,
    /git diff HEAD~1 --name-only/,
    "REQUIRE branch must still reference 'git diff HEAD~1 --name-only' as the post-commit check command (AC4)",
  );
  assert.match(
    SKILL,
    /specs\/<active_feature>\.md/,
    "post-commit check must reference 'specs/<active_feature>.md' (AC4)",
  );

  // REQUIRE branch: byte-identical pre-E44 STOP string (F5 — non-weakening).
  assert.ok(
    SKILL.includes(AC4_REQUIRE_STOP),
    "SOP must contain the verbatim, byte-identical pre-E44 REQUIRE STOP string (AC4/F5)",
  );

  // UNCLASSIFIABLE branch: verbatim string, INCLUDING the F6 remedy clause
  // (review round 2 amendment), and distinct from the REQUIRE STOP string.
  assert.ok(
    SKILL.includes(AC4_UNCLASSIFIABLE_STOP),
    "SOP must contain the verbatim UNCLASSIFIABLE string including the F6 remedy clause ('... record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.'), distinct from the REQUIRE STOP string (AC4/F6)",
  );
  assert.notEqual(
    AC4_REQUIRE_STOP,
    AC4_UNCLASSIFIABLE_STOP,
    "REQUIRE and UNCLASSIFIABLE STOP strings must be textually distinct (sanity check on the fixtures above)",
  );

  // SKIP branch: self-documenting log line naming which branch fired.
  assert.match(
    SKILL,
    /AC4: SKIP branch/,
    "SKIP branch must log a line naming itself as the fired branch, so the next reader sees a deliberate decision, not an omission (E44)",
  );
});

test("AC5: release-engineer.md shim contains a reinforcement hint (<=2 sentences)", () => {
  // Contract: the shim must remind haiku-tier that staging scope = all upstream work,
  // not just files edited in the current turn. The hint is <=2 sentences and must
  // NOT alter the watermark line or the tw_get_state/tw_switch_role invocation.
  // Watermark line is now tier-agnostic (v3.58.0, C5a re-baseline) — see
  // test/subagent-templates.test.mjs v3.21.1/v3.21.2 for the rationale.
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
    /CRITICAL: End every reply with `— @release-engineer \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\./,
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

test("Fixture C (AC4/REQUIRE, AC6): REQUIRE branch fires with verbatim AC4 error when spec exists in tree but is absent from the commit", () => {
  // Simulate a PM/architect-chain release: specs/release-engineer-complete-staging.md
  // exists in the tree, but git diff HEAD~1 --name-only shows metadata bumps only.
  // Expected: simulatePostCommitCheck returns pass=false, branch=REQUIRE, with the
  // exact byte-identical pre-E44 AC4 error string.

  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = [
    "CHANGELOG.md",
    "README.md",
    "dist/index.js",
    "index.ts",
    "package.json",
  ].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ true, /* scopeDecisionWhy */ "");
  assert.equal(result.pass, false, "Fixture C: missing spec file must produce FAIL");
  assert.equal(result.branch, "REQUIRE", "Fixture C: spec-in-tree must select the REQUIRE branch");
  assert.equal(
    result.errorMsg,
    "Release commit incomplete: specs/release-engineer-complete-staging.md is absent from the commit. Stage missing files and amend or create a fix commit.",
    "Fixture C: error message must match verbatim AC4 error string",
  );
});

test("Fixture D (AC4/REQUIRE, AC6): REQUIRE branch passes silently when spec file exists in tree and is present in the commit", () => {
  // Simulate: specs/release-engineer-complete-staging.md exists in the tree and
  // git diff HEAD~1 --name-only includes it.
  // Expected: simulatePostCommitCheck returns pass=true, branch=REQUIRE, no error.

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

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ true, /* scopeDecisionWhy */ "");
  assert.equal(result.pass, true, "Fixture D: spec file present must produce PASS");
  assert.equal(result.branch, "REQUIRE", "Fixture D: spec-in-tree must select the REQUIRE branch");
  assert.equal(result.errorMsg, null, "Fixture D: no error message when spec file is present");
});

test("Fixture E (AC4/SKIP, AC6): SKIP branch passes when no spec exists in the tree and scope_decision_why records a mini-chain", () => {
  // Simulate this repo's own dispatch shape: no specs/<active_feature>.md
  // anywhere, scope_decision_why records a backlog-row-as-spec mini-chain.
  const activeFeature = "e44-e49-release-sop-conditional-checks";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "content/skill-release-engineer.md", "index.ts", "package.json"].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ false, MINI_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, true, "Fixture E: no spec in tree + mini-chain scope_decision_why must produce PASS");
  assert.equal(result.branch, "SKIP", "Fixture E: must select the SKIP branch");
  assert.equal(result.errorMsg, null, "Fixture E: SKIP branch never emits a STOP error message");
});

test("Fixture F (AC4/UNCLASSIFIABLE, AC6): UNCLASSIFIABLE branch fires with the verbatim string when scope_decision_why is empty", () => {
  const activeFeature = "some-untracked-feature";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "index.ts", "package.json"].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ false, /* scopeDecisionWhy */ "");
  assert.equal(result.pass, false, "Fixture F: no spec in tree + empty scope_decision_why must produce FAIL");
  assert.equal(result.branch, "UNCLASSIFIABLE", "Fixture F: must select the UNCLASSIFIABLE branch");
  assert.equal(
    result.errorMsg,
    AC4_UNCLASSIFIABLE_STOP,
    "Fixture F: error message must match the verbatim UNCLASSIFIABLE string, including the F6 remedy clause",
  );
});

test("Fixture G (AC4/UNCLASSIFIABLE, AC6): UNCLASSIFIABLE branch also fires when scope_decision_why is non-empty but does not record a mini-chain", () => {
  const activeFeature = "some-untracked-feature";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "index.ts", "package.json"].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ false, FULL_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, false, "Fixture G: no spec in tree + non-mini-chain scope_decision_why must produce FAIL");
  assert.equal(result.branch, "UNCLASSIFIABLE", "Fixture G: must select the UNCLASSIFIABLE branch");
  assert.equal(
    result.errorMsg,
    AC4_UNCLASSIFIABLE_STOP,
    "Fixture G: error message must match the verbatim UNCLASSIFIABLE string even with non-empty, non-mini-chain scope_decision_why text",
  );
});

test("Fixture H (AC4/REQUIRE non-weakening, F6): spec-in-tree wins over SKIP even when scope_decision_why records a mini-chain", () => {
  // This is the pin the round-1/round-2 review explicitly required: a PM-chain
  // release with a missing spec must still hard-STOP even if, by whatever
  // accident, scope_decision_why also happens to read like a mini-chain record.
  // REQUIRE is keyed on the spec's existence in the tree, never on the
  // mini-chain signal — the two are not weighed against each other.
  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "index.ts", "package.json"].join("\n"); // spec absent from commit

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ true, MINI_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, false, "Fixture H: spec-in-tree + missing-from-commit must still FAIL even with mini-chain scope_decision_why");
  assert.equal(result.branch, "REQUIRE", "Fixture H: spec-in-tree must win over SKIP regardless of scope_decision_why");
  assert.equal(
    result.errorMsg,
    "Release commit incomplete: specs/release-engineer-complete-staging.md is absent from the commit. Stage missing files and amend or create a fix commit.",
    "Fixture H: the STOP string must be byte-identical to the pre-E44 wording — unweakened by the mini-chain signal",
  );
});

test("AC4 branch exhaustiveness: exactly one of REQUIRE/SKIP/UNCLASSIFIABLE fires for every (specExistsInTree x recordsMiniChain) combination", () => {
  const activeFeature = "exhaustiveness-check-feature";
  const combos = [
    { specExistsInTree: true, scopeDecisionWhy: "", expectedBranch: "REQUIRE" },
    { specExistsInTree: true, scopeDecisionWhy: MINI_CHAIN_SCOPE_WHY, expectedBranch: "REQUIRE" },
    { specExistsInTree: false, scopeDecisionWhy: MINI_CHAIN_SCOPE_WHY, expectedBranch: "SKIP" },
    { specExistsInTree: false, scopeDecisionWhy: "", expectedBranch: "UNCLASSIFIABLE" },
  ];
  const seenBranches = new Set();
  for (const { specExistsInTree, scopeDecisionWhy, expectedBranch } of combos) {
    const result = simulatePostCommitCheck(/* diff never contains the spec */ "", activeFeature, specExistsInTree, scopeDecisionWhy);
    assert.equal(
      result.branch,
      expectedBranch,
      `specExistsInTree=${specExistsInTree}, scope_decision_why=${JSON.stringify(scopeDecisionWhy)} must yield branch=${expectedBranch}, got ${result.branch}`,
    );
    seenBranches.add(result.branch);
  }
  assert.deepEqual(
    [...seenBranches].sort(),
    ["REQUIRE", "SKIP", "UNCLASSIFIABLE"],
    "all three branches must be reachable, and exactly one must fire per combination (total + mutually exclusive)",
  );
});

// ---------------------------------------------------------------------------
// Phase 3 — Repo-scan guard: no source dir silently falls out of releases
// ---------------------------------------------------------------------------

test("AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list", () => {
  // WHY: the authoritative list of TypeScript source roots is tsconfig.json
  // `include`. Deriving the expected dirs from it means a newly added source
  // directory triggers a guard failure automatically — no manual update to any
  // test-side list required. This replaces the old hand-maintained EXCLUDED_DIRS
  // heuristic, which was the drift source that let transport/ slip out of
  // release staging in v3.24.0.
  //
  // AC-B6.3: guard uses getTsConfigSourceDirs, not EXCLUDED_DIRS.
  // AC-B6.4: if tsconfig lists a dir absent from FEATURE_DIRS, the assertion
  //           surfaces it automatically (naming the missing dir).
  const tsconfigPath = path.join(ROOT, "tsconfig.json");
  const tsconfigDirs = getTsConfigSourceDirs(tsconfigPath);

  // The helper returns dir names without trailing slashes; FEATURE_DIRS uses
  // trailing slashes — normalise before comparing.
  const tsconfigDirsWithSlash = tsconfigDirs.map((d) => `${d}/`);

  const missing = tsconfigDirsWithSlash.filter((d) => !FEATURE_DIRS.includes(d));
  assert.deepEqual(
    missing,
    [],
    `Source directories from tsconfig.json missing from FEATURE_DIRS: ${missing.join(", ")}. ` +
    `Add them to FEATURE_DIRS in this test and to the git add enumeration in content/skill-release-engineer.md.`,
  );

  // Sanity: the helper must return at least the six dirs known to be in tsconfig
  // at the time this test was written — guards against a broken import or a
  // tsconfig that was accidentally emptied.
  const knownDirs = ["tools/", "guards/", "prompts/", "schema/", "transport/", "lib/"];
  for (const d of knownDirs) {
    assert.ok(
      tsconfigDirsWithSlash.includes(d),
      `getTsConfigSourceDirs must return '${d}' (present in tsconfig.json include at B6 authoring time)`,
    );
  }
});

// ---------------------------------------------------------------------------
// Phase 4 — C13: release-engineer legal handoff write path (v3.49.0)
// ---------------------------------------------------------------------------
// WHY: specs/c13-release-engineer-write-path.md AC5 replaced the old
// "Side-channel constraint" workaround with a CRITICAL Hard rule telling
// release-engineer to STOP on any tw_* ⛔ rejection rather than hand-edit
// .current/handoff.md or tasks.md (the exact anti-pattern the v3.48.0
// incident exhibited). AC6/AC7 require the same STOP reminder — plus a
// driftBaselineIds reminder — to also land as dual-anchored, ≤2-sentence
// reinforcement hints in the haiku-tier template shim, and require both to
// survive as regression-testable literals. We pin load-bearing substrings
// (not whole paragraphs) so future rewording that preserves intent doesn't
// spuriously fail, but silent removal of the STOP instruction or the
// driftBaselineIds reminder does.

test("C13-AC5: skill-release-engineer.md contains the verbatim CRITICAL STOP-on-⛔ rule", () => {
  // Contract: the Hard rules section must instruct STOP + hand-back on ANY
  // tw_* ⛔ rejection, and must explicitly forbid hand-editing BOTH
  // .current/handoff.md and tasks.md — the two files the incident's
  // hand-edit workaround touched / could touch.
  assert.match(
    SKILL,
    /On any ⛔ rejection from any tw_\* tool call \(including but not limited to TRANSITION_REJECTED\), STOP immediately and hand back to the coordinator\/human\./,
    "skill-release-engineer.md must contain the verbatim CRITICAL STOP-on-⛔ rule opening (C13-AC5)",
  );
  assert.match(
    SKILL,
    /NEVER hand-edit \.current\/handoff\.md or tasks\.md directly to work around a rejection — this applies regardless of role and is a Constitution §3 violation\./,
    "skill-release-engineer.md must contain the verbatim CRITICAL STOP-on-⛔ rule's hand-edit-ban clause (C13-AC5)",
  );
});

test("C13-AC5: skill-release-engineer.md no longer contains the old stamp-as-upstream-caller workaround language", () => {
  // Contract: AC5 requires the "Side-channel constraint" bullet to be
  // REPLACED — release-engineer now stamps agent_id="release-engineer"
  // directly, not "the upstream caller's identifier".
  assert.ok(
    !SKILL.includes("the upstream caller's identifier"),
    "skill-release-engineer.md must NOT retain the old stamp-as-upstream-caller workaround phrasing (C13-AC5)",
  );
});

test("C13-AC6/AC7: release-engineer.md shim contains the verbatim STOP-on-⛔ reinforcement hint", () => {
  // Contract: AC6.1 — a STOP-on-⛔-rejection reminder mirroring AC5's Hard
  // rule, ≤2 sentences, present in the template shim (not just the skill
  // file) so haiku-tier context-budget pressure can't drop it.
  assert.match(
    SHIM,
    /CRITICAL: On any ⛔ rejection from any tw_\* tool call, STOP immediately and hand back to the coordinator\/human\./,
    "release-engineer.md shim must contain the verbatim STOP-on-⛔ reinforcement hint (C13-AC6/AC7)",
  );
  assert.match(
    SHIM,
    /NEVER hand-edit `\.current\/handoff\.md` or `tasks\.md` to work around a rejection\./,
    "release-engineer.md shim must forbid hand-editing both handoff.md and tasks.md verbatim (C13-AC6/AC7)",
  );
});

test("C13-AC6/AC7: release-engineer.md shim contains the verbatim driftBaselineIds reinforcement hint", () => {
  // Contract: AC6.2 — a driftBaselineIds append reminder mirroring SOP step
  // 10/9's text, addressing the incident's third defect (the step existed
  // but was skipped under haiku-tier load with no shim-level anchor).
  assert.match(
    SHIM,
    /append this release's shipped task IDs to `driftBaselineIds`/,
    "release-engineer.md shim must remind to append shipped task IDs to driftBaselineIds (C13-AC6/AC7)",
  );
  assert.match(
    SHIM,
    /Skipping it makes every shipped task resurface as drift noise next session\./,
    "release-engineer.md shim must state the consequence of skipping the driftBaselineIds append verbatim (C13-AC6/AC7)",
  );
});

test("C13-AC6: shim watermark and tw_get_state/tw_switch_role invocation lines are unaltered by the new hints", () => {
  // Contract: AC6 explicitly forbids altering the watermark line or the
  // tw_get_state / tw_switch_role instruction while adding the two hints.
  // Watermark line is now tier-agnostic (v3.58.0, C5a re-baseline).
  assert.match(
    SHIM,
    /CRITICAL: End every reply with `— @release-engineer \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\./,
    "shim watermark line must be preserved verbatim (C13-AC6)",
  );
  assert.match(
    SHIM,
    /call `tw_get_state` then `tw_switch_role\("release-engineer"\)`/,
    "shim tw_get_state/tw_switch_role invocation line must be preserved verbatim (C13-AC6)",
  );
});

// ---------------------------------------------------------------------------
// Phase 5 — D10: release-engineer git-stop-rule (non-fast-forward push /
// concurrent-release collision)
// ---------------------------------------------------------------------------
// WHY: specs/d10-release-engineer-git-stop-rule.md documents an incident where
// a haiku-tier release-engineer hit a non-fast-forward push (a concurrent D2
// session had advanced main) and "resolved" it by aborting a rebase and
// running `git reset HEAD~1`, discarding its own committed release — only the
// reflog made recovery possible. AC1-AC3 require a Hard rule + matching
// Escalation Routes row in content/skill-release-engineer.md that forbids
// destructive git recovery and instead routes to a Blocked handoff with the
// local release-commit SHA. AC4 requires a mirroring ≤2-sentence
// reinforcement hint in the haiku-tier shim, without touching the watermark
// or tw_get_state/tw_switch_role lines. AC5 requires this test file to pin
// the verbatim Copy/Strings substrings from both files, following the same
// load-bearing-substring convention as the AC1-AC5/C13 tests above — we pin
// substrings (not whole paragraphs) so future rewording that preserves
// intent doesn't spuriously fail, but silent removal of the STOP rule,
// the forbidden-command list, or the Blocked/SHA/hand-back contract does.

test("D10-AC1: skill-release-engineer.md Hard rule STOPs on non-fast-forward push / collision and forbids destructive git recovery", () => {
  // Contract: the Hard rule must instruct immediate STOP and explicitly
  // forbid git reset / rebase / checkout --force / clean as workarounds —
  // the exact anti-pattern the D10 incident exhibited.
  assert.ok(
    SKILL.includes(
      "STOP immediately — NEVER run `git reset`, `git rebase`, `git checkout --force`, or `git clean` to work around it.",
    ),
    "skill-release-engineer.md must contain the verbatim D10 stop-clause forbidding destructive git recovery (D10-AC1)",
  );
});

test("D10-AC2: skill-release-engineer.md Hard rule routes to status=Blocked with the local release-commit SHA, handing back for coordinator recovery", () => {
  // Contract: instead of self-recovering, the rule must instruct writing
  // status=Blocked with the local release-commit SHA in pending_notes and
  // handing back — never attempting recovery itself. Pinned as two
  // substrings (spec's own Copy/Strings table elides the middle with "..."),
  // both of which must survive intact.
  assert.ok(
    SKILL.includes(
      "write `status=Blocked` with the local release-commit SHA in `pending_notes`",
    ),
    "skill-release-engineer.md must instruct writing status=Blocked with the local release-commit SHA in pending_notes (D10-AC2)",
  );
  assert.ok(
    SKILL.includes("and hand back for coordinator recovery."),
    "skill-release-engineer.md must instruct handing back for coordinator recovery, not self-recovery (D10-AC2)",
  );
});

test("D10-AC1/AC2: skill-release-engineer.md Hard rule includes the worked pending_notes example and the incident-reason clause", () => {
  // Contract: the Hard rule gives a literal pending_notes=[...] example
  // (this file's existing convention for other Blocked examples) plus the
  // D10 incident rationale, so the rule reads as self-justifying under
  // context pressure rather than a bare directive.
  assert.ok(
    SKILL.includes(
      'pending_notes=["release-engineer: push rejected (non-fast-forward) — local release commit <sha> not on remote, needs coordinator recovery"]',
    ),
    "skill-release-engineer.md must contain the verbatim D10 worked pending_notes example (D10-AC1/AC2)",
  );
  assert.ok(
    SKILL.includes(
      "Reason (D10): a haiku-tier release-engineer hit exactly this collision, aborted a rebase, and ran `git reset HEAD~1`, discarding its own committed release — only the reflog made recovery possible.",
    ),
    "skill-release-engineer.md must contain the verbatim D10 incident-reason clause (D10-AC1/AC2)",
  );
});

test("D10-AC3: skill-release-engineer.md Escalation Routes table has a matching non-fast-forward/collision row (Blocked, SHA pending-note, human)", () => {
  // Contract: the Escalation Routes table row must name the trigger, carry
  // status=Blocked, the canonical SHA pending-note (deliberately identical
  // to the Hard rule's worked example per spec's paired-wording intent),
  // and next_role=human.
  assert.match(
    SKILL,
    /\| non-fast-forward push rejection \/ concurrent-release collision \(D10\) \| Blocked \|/,
    "skill-release-engineer.md Escalation Routes table must have a D10 row with status=Blocked (D10-AC3)",
  );
  assert.ok(
    SKILL.includes(
      "`release-engineer: push rejected (non-fast-forward) — local release commit <sha> not on remote, needs coordinator recovery`",
    ),
    "skill-release-engineer.md Escalation Routes row must carry the verbatim backtick-wrapped D10 pending-note (D10-AC3)",
  );
  assert.match(
    SKILL,
    /non-fast-forward push rejection \/ concurrent-release collision \(D10\) \| Blocked \| `release-engineer: push rejected \(non-fast-forward\) — local release commit <sha> not on remote, needs coordinator recovery` \| human \|/,
    "skill-release-engineer.md Escalation Routes D10 row must route to next_role=human (D10-AC3)",
  );
});

test("D10-AC4: release-engineer.md shim contains the verbatim D10 reinforcement hint (<=2 sentences)", () => {
  // Contract: the shim must mirror the Hard rule's STOP instruction and
  // forbidden-command list as a compact, C13-pattern reinforcement hint —
  // the anchor that survives even under haiku-tier context pressure.
  const hint =
    "CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP — NEVER `git reset`, `git rebase`, `git checkout --force`, or `git clean`. Write `status=Blocked` with the local release commit SHA in `pending_notes` and hand back to the coordinator/human for recovery.";
  assert.ok(
    SHIM.includes(hint),
    "release-engineer.md shim must contain the verbatim D10 reinforcement hint (D10-AC4)",
  );
  const sentences = hint.split(/\.\s+|\.$/).filter(Boolean);
  assert.ok(
    sentences.length <= 2,
    `D10 shim hint must be <=2 sentences; found ${sentences.length} (D10-AC4)`,
  );
});

test("D10-AC4: shim watermark and tw_get_state/tw_switch_role invocation lines are unaltered by the D10 hint", () => {
  // Contract: AC4 explicitly forbids altering the watermark line or the
  // tw_get_state/tw_switch_role instruction while adding the D10 hint —
  // same non-regression guard as the C13 hints above, re-asserted here so a
  // future edit specifically to the D10 hint region can't silently clobber
  // either anchor line.
  assert.match(
    SHIM,
    /CRITICAL: End every reply with `— @release-engineer \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\./,
    "shim watermark line must be preserved verbatim (D10-AC4)",
  );
  assert.match(
    SHIM,
    /call `tw_get_state` then `tw_switch_role\("release-engineer"\)`/,
    "shim tw_get_state/tw_switch_role invocation line must be preserved verbatim (D10-AC4)",
  );
});

// ---------------------------------------------------------------------------
// Phase 6 — E7: governed git surface (generalized sanctioned-git-ops
// whitelist, ALL roles)
// ---------------------------------------------------------------------------
// WHY: specs/e7-governed-git-surface.md generalizes D10's release-engineer-only
// STOP rule into one core-tagged constitution bullet (content/const-15-core-tail.md
// §6) binding every role, and turns release-engineer's own D10 bullet into a
// pointer rather than a restatement. AC1 pins the new §6 bullet's load-bearing
// verbs (sanctioned + forbidden) and the STOP/Blocked/hand-back phrase, all in
// the SAME bullet (so the pointer-vs-restatement split can't silently drift the
// two halves apart). AC2 pins the cross-reference sentence appended to the
// existing D10 bullet. AC5 (non-regression) is already covered by the D10-AC1
// through D10-AC4 tests above, unmodified — those substrings still had to
// survive byte-identical for this section's tests to be meaningful at all;
// re-asserting that overlap here would be redundant, not additional coverage.

test("E7-AC1: content/const-15-core-tail.md §6 carries the sanctioned-git-ops whitelist bullet — sanctioned verbs, forbidden verbs, and the STOP/Blocked/hand-back phrase, all in the same bullet (spec AC1)", () => {
  const bulletMatch = CONST15.match(/- \*\*Sanctioned git operations \(ALL roles\)\*\*:.*$/m);
  assert.ok(bulletMatch, "must carry the 'Sanctioned git operations (ALL roles)' bullet in const-15-core-tail.md §6");
  const bullet = bulletMatch[0];

  // Sanctioned verbs (load-bearing — AC1)
  for (const verb of ["`git add`", "`git commit`", "`git tag`", "fast-forward `git push`"]) {
    assert.ok(bullet.includes(verb), `sanctioned-git-ops bullet must whitelist ${verb} (E7-AC1)`);
  }

  // Forbidden verbs (load-bearing — AC1)
  for (const verb of ["`git reset`", "`git rebase`", "`git clean`", "force-push (`git push --force`)", "`git checkout --force`"]) {
    assert.ok(bullet.includes(verb), `sanctioned-git-ops bullet must forbid ${verb} (E7-AC1)`);
  }
  assert.ok(bullet.includes("FORBIDDEN"), "forbidden verbs must be flagged FORBIDDEN (E7-AC1)");

  // STOP -> Blocked -> hand-back phrase, same bullet (load-bearing — AC1)
  assert.ok(bullet.includes("STOP immediately"), "must instruct immediate STOP on a wall (E7-AC1)");
  assert.ok(bullet.includes("`status: Blocked`"), "must instruct writing status: Blocked (E7-AC1)");
  assert.ok(
    bullet.includes("git state (branch, local commit SHA, what triggered the STOP)") && bullet.includes("`pending_notes`"),
    "must instruct capturing branch/local SHA/trigger in pending_notes (E7-AC1)",
  );
  assert.ok(bullet.includes("hand back to the coordinator/human"), "must instruct handing back to the coordinator/human (E7-AC1)");
  assert.ok(bullet.includes("never run a destructive fix unsupervised"), "must forbid unsupervised destructive fixes (E7-AC1)");

  // Read-only git stays permitted, generalizing D10 (not itself a forbidden op)
  assert.ok(
    bullet.includes("Read-only git (`diff`, `log`, `status`, `show`) is always permitted"),
    "must explicitly permit read-only git ops (E7-AC1)",
  );
});

test("E7-AC3: content/const-15-core-tail.md is tagged 'core' in prompts/constitution-manifest.ts, so the new bullet ships on every dispatch arm (spec AC3)", () => {
  const manifestSrc = fs.readFileSync(path.join(ROOT, "prompts", "constitution-manifest.ts"), "utf-8");
  const fragmentEntry = manifestSrc.match(/\{[^{}]*file:\s*"const-15-core-tail\.md"[^{}]*\}/s);
  assert.ok(fragmentEntry, "const-15-core-tail.md must have a fragment entry in prompts/constitution-manifest.ts (E7-AC3)");
  assert.match(
    fragmentEntry[0],
    /tag:\s*"core"/,
    "const-15-core-tail.md's manifest entry must be tag: \"core\" so includeSegment(\"core\", ...) ships it on every dispatch arm (E7-AC3)",
  );
});

test("E7-AC1/AC3: the sanctioned-git-ops bullet reaches the COMPOSED (not raw) constitution text on both the tightest (lite, non-design) and broadest (full-chain, design-armed) dispatch arms (spec AC1's composed-text requirement, AC3)", () => {
  // AC3's own proof text calls out "the new AC1 pinning test itself running
  // against the composed (not raw) constitution text" — the raw-fragment
  // assertions above (E7-AC1) pin the bullet's content; this test pins its
  // REACHABILITY through composeConstitution() on the narrowest arm (lite,
  // no chain, no design — the arm most likely to accidentally drop a
  // core-tagged fragment) and the broadest arm, closing the gap between
  // "the fragment file has the bullet" and "every dispatch arm ships it".
  const lite = composeConstitution({ chain: false, design: false });
  const full = composeConstitution({ chain: true, design: true });
  assert.ok(
    lite.includes("**Sanctioned git operations (ALL roles)**"),
    "composeConstitution({chain:false, design:false}) (lite, tightest arm) must carry the sanctioned-git-ops bullet (E7-AC1/AC3)",
  );
  assert.ok(
    full.includes("**Sanctioned git operations (ALL roles)**"),
    "composeConstitution({chain:true, design:true}) (full-chain, design-armed, broadest arm) must carry the sanctioned-git-ops bullet (E7-AC1/AC3)",
  );
});

test("E7-AC2: content/skill-release-engineer.md's D10 bullet cross-references the new general §6 sanctioned-git-ops whitelist by name/section, pointer-only (spec AC2)", () => {
  assert.ok(
    /§6/.test(SKILL) || /general git-ops whitelist/i.test(SKILL),
    "skill-release-engineer.md must reference the general §6 git-ops rule by section number or name (E7-AC2)",
  );
  assert.ok(
    SKILL.includes(
      "one source of truth is the general git-ops whitelist in Constitution §6 (Security & Privacy), binding ALL roles",
    ),
    "skill-release-engineer.md's D10 bullet must carry the verbatim §6 cross-reference sentence (E7-AC2)",
  );
  assert.ok(
    SKILL.includes("this bullet retains only the release-engineer recovery mechanics"),
    "the cross-reference must explicitly scope the D10 bullet down to recovery mechanics only, pointer not restatement (E7-AC2)",
  );
});

// ---------------------------------------------------------------------------
// Phase 7 — E49/E50: step 7a ticket-code SET derivation (working-tree
// enumeration + PREV_TAG membership predicate, unioned across qa_reports/ and
// review_reports/)
// ---------------------------------------------------------------------------
// WHY: review_reports/review_T-E4X-03.md and review_reports/review_T-E50-02.md
// document that this derivation's literal text changed FOUR times across two
// tickets:
//   round 1 (E49) — hunt ticket/feature SLUGS in commit subjects/bodies. Wrong
//     on the exact release it was written for: v3.95.0 yielded {E37,E38}
//     (disjoint from the right answer {E45,E46}), because shipped tickets
//     appear in the range only as bare codes, never as slugs (F1/F2/F3).
//   round 2 (E49) — committed history only (`git log --diff-filter=A`). Fixed
//     F1-F3, but silently returns EMPTY on v3.93.0 and v3.94.0 — 2 of the last
//     6 releases — because qa_reports/ evidence is routinely UNTRACKED at
//     step-7a time (step 8's `git add qa_reports/` is what first commits it).
//     Combined with "zero matches = silent no-op", this is a regression versus
//     the pre-E49 rule, which archived those releases correctly by
//     working-tree existence (F7 — the round-2 BLOCKING finding).
//   round 3 (E49, APPROVED) — enumerate root-level qa_reports/ files as they
//     sit in the WORKING TREE right now, and use the git range only as a
//     MEMBERSHIP TEST against PREV_TAG's tree. Backtested against all six of
//     this repo's last releases in six detached worktrees, reproducing every
//     "actually archived" outcome including the two that round 2 returned
//     empty for. Round 3 also recorded N4 (non-blocking then): an
//     empty/unresolvable PREV_TAG baseline makes `grep -vxFf` pass its WHOLE
//     input through — a mass-sweep hazard, explicitly left unfixed.
//   E50 round 1 — (a) closed N4 with a guard, but shipped it as a single
//     global flag (F9: permanently wedges any workspace that has never
//     produced a review_reports/ tree) and (b) added zero-match logging that
//     expanded an UNBOUND `$CODES` variable, printing `{∅}` on every release,
//     including non-empty ones (F8) — CHANGES_REQUESTED.
//   E50 round 2 (APPROVED, shipped) — F8 closed by binding `CODES=$( { ... } |
//     ... )`; F9 closed by splitting the single flag into per-tree
//     STOP_QA/STOP_RR/EXCLUDE_QA/EXCLUDE_RR, so an absent or never-seeded
//     review_reports/ tree no longer blocks qa_reports/'s half and does not
//     recur release after release. (c) extends the whole predicate to
//     review_reports/ under a PARALLEL archive dir (never folded into
//     qa_reports/archive/ — the two streams share basenames, verified against
//     the real v3.96.0 review_T-E4X-03.md collision).
// These tests pin the ACTUALLY SHIPPED (E50 round 2) text and behavior — not
// any earlier draft — per review_T-E50-02.md's "Test-coverage note for
// T-E50-03" (12 items, sequenced by consequence).

// Model of the shipped filename -> code extraction (E50 round 2, F8/attack 1):
//   sed -E 's#.*<slash>##' | grep -oE '^[a-z_]*T-[A-Za-z0-9]+-' \
//     | sed -E 's/^[a-z_]*T-//; s/-$//' | tr 'a-z' 'A-Z'
// (literal shell text elided above to avoid a stray "*<slash>" closing this
// block comment early — the shell strips the leading directory with a basic
// sed substitution). Operates on a BASENAME (callers strip the directory
// themselves via path.posix.basename, matching the shipped pipeline's own
// ordering). Returns the uppercased code, or null when the filename carries
// no `T-<CODE>-` segment reachable from an anchored `[a-z_]*` prefix run.
function codeFromFilename(basename) {
  const m = basename.match(/^[a-z_]*T-([A-Za-z0-9]+)-/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Model of the shipped step-7a derivation for a SINGLE tree (qa_reports/):
 *   find qa_reports -maxdepth 1 -type f | sort \
 *     | grep -vxFf <(git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/)
 * followed by codeFromFilename per resulting basename (N2: a filename with no
 * `T-<CODE>-` segment is still admitted as a candidate FILE, contributing no
 * code).
 *
 * @param {string[]} workingTreeFiles - every qa_reports/-rooted path that
 *   exists in the working tree right now, at any depth (models what a naive
 *   recursive listing would include, so the -maxdepth 1 behavior below is
 *   itself under test rather than assumed).
 * @param {string[]} prevTagTreeFiles - `git ls-tree -r --name-only "$PREV_TAG"
 *   -- qa_reports/` output: paths that existed in the previous release's tree.
 */
function deriveCodesFromWorkingTree(workingTreeFiles, prevTagTreeFiles) {
  // `find qa_reports -maxdepth 1 -type f`: only DIRECT children of qa_reports/;
  // archive/ subdirectory entries are structurally invisible to -maxdepth 1,
  // never candidates at all (subsumes the old explicit archive/ exclusion).
  const rootFiles = workingTreeFiles.filter((f) => path.posix.dirname(f) === "qa_reports");
  const prevTagSet = new Set(prevTagTreeFiles);
  // `grep -vxFf <(git ls-tree ...)`: drop any line that is an EXACT full-line
  // match against a path that already existed in PREV_TAG's tree. A file
  // counts as new to this release when absent from that tree — whether it got
  // there by being committed within the range, or by never having been
  // committed at all (untracked).
  const admitted = rootFiles.filter((f) => !prevTagSet.has(f)).sort();
  const codes = new Set();
  for (const f of admitted) {
    const code = codeFromFilename(path.posix.basename(f));
    if (code) codes.add(code);
  }
  return { admitted, codes: [...codes].sort() };
}

/**
 * Model of the shipped per-tree empty-baseline guard (E50 round 2 — F9),
 * content/skill-release-engineer.md step 7a "Empty-baseline guard" bullet.
 * STOP is reserved for "no baseline for this tree AND something at its root
 * an unbounded sweep would take"; EXCLUDE covers "tree absent" or "baseline
 * empty AND nothing at root to protect" — the self-healing, non-recurring
 * case round 1 conflated with STOP.
 */
function deriveGuardFlags({
  prevTag,
  qaDirExists = true,
  qaBaselineNonEmpty = false,
  qaRootFilesPresent = false,
  rrDirExists = true,
  rrBaselineNonEmpty = false,
  rrRootFilesPresent = false,
} = {}) {
  const flags = { STOP_QA: false, STOP_RR: false, EXCLUDE_QA: false, EXCLUDE_RR: false };
  if (!prevTag) {
    // Genuinely global: an unset PREV_TAG means there is no baseline for ANY
    // tree, a property of the repository, not of a tree.
    flags.STOP_QA = true;
    flags.STOP_RR = true;
    return flags;
  }
  if (!qaDirExists) flags.EXCLUDE_QA = true;
  else if (qaBaselineNonEmpty) {
    /* baseline present -- qa_reports/ included in the derivation below */
  } else if (qaRootFilesPresent) flags.STOP_QA = true;
  else flags.EXCLUDE_QA = true;

  if (!rrDirExists) flags.EXCLUDE_RR = true;
  else if (rrBaselineNonEmpty) {
    /* baseline present -- review_reports/ included in the derivation below */
  } else if (rrRootFilesPresent) flags.STOP_RR = true;
  else flags.EXCLUDE_RR = true;

  return flags;
}

/**
 * Model of the shipped union derivation across BOTH trees (E50): each
 * non-excluded tree contributes its own admitted set, and `<CODES>` is the
 * union of codes derived from either. An excluded tree contributes nothing
 * (models the shell's `[ -z "$EXCLUDE_QA" ] && find ... | ...` short-circuit
 * — the excluded tree's pipeline never runs at all).
 */
function deriveCodesUnion({
  qaWorkingTree = [],
  qaPrevTagTree = [],
  rrWorkingTree = [],
  rrPrevTagTree = [],
  excludeQa = false,
  excludeRr = false,
} = {}) {
  const admitted = [];
  if (!excludeQa) {
    const { admitted: qaAdmitted } = deriveCodesFromWorkingTree(qaWorkingTree, qaPrevTagTree);
    admitted.push(...qaAdmitted);
  }
  if (!excludeRr) {
    const rootFiles = rrWorkingTree.filter((f) => path.posix.dirname(f) === "review_reports");
    const prevSet = new Set(rrPrevTagTree);
    admitted.push(...rootFiles.filter((f) => !prevSet.has(f)));
  }
  const codes = new Set();
  for (const f of admitted) {
    const code = codeFromFilename(path.posix.basename(f));
    if (code) codes.add(code);
  }
  return { admitted: [...admitted].sort(), codes: [...codes].sort() };
}

/**
 * Model of the shipped PARALLEL destination resolution (E50, item (c)): each
 * source tree gets its OWN archive dir, never folded together — the pin that
 * matters against a real basename collision (review_T-E4X-03.md existed
 * simultaneously at qa_reports/archive/.../ and review_reports/ root within
 * the same v3.96.0 commit).
 */
function resolveDestination(sourceTree, activeFeature) {
  return `${sourceTree}/archive/${activeFeature}/`;
}

/** Resolve the per-file moves a set of admitted candidates would produce. */
function resolveMoves({ qaAdmitted = [], rrAdmitted = [], activeFeature }) {
  const moves = [];
  for (const f of qaAdmitted) {
    moves.push({ from: f, to: `${resolveDestination("qa_reports", activeFeature)}${path.posix.basename(f)}` });
  }
  for (const f of rrAdmitted) {
    moves.push({ from: f, to: `${resolveDestination("review_reports", activeFeature)}${path.posix.basename(f)}` });
  }
  return moves;
}

test("E49 step 7a: skill text pins the ACTUALLY SHIPPED derivation literally, both lines, plus PREV_TAG's resolution", () => {
  assert.match(
    SKILL,
    /PREV_TAG=\$\(git describe --tags --abbrev=0\)/,
    "SOP must define PREV_TAG via `git describe --tags --abbrev=0` (E49)",
  );
  assert.ok(
    SKILL.includes("find qa_reports -maxdepth 1 -type f | sort"),
    "SOP must enumerate root-level qa_reports/ files via `find qa_reports -maxdepth 1 -type f | sort` — the WORKING-TREE enumeration line (E49, round 3 shipped text)",
  );
  assert.ok(
    SKILL.includes('grep -vxFf <(git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/)'),
    "SOP must use `git ls-tree -r --name-only \"$PREV_TAG\" -- qa_reports/` as a MEMBERSHIP predicate via grep -vxFf — the round 3 shipped text (E49)",
  );
});

test("E50 step 7a (N14 CLOSED — pin repointed at the EXECUTABLE CODES= fence): does not resurrect the round-2 committed-history-only rule (a substring pin on the round-2 command must fail)", () => {
  // N14 (review_T-E50-02.md round 2): the PRE-EXISTING version of this test
  // anchored on `/```\n(\s*find qa_reports -maxdepth 1[\s\S]*?)```/`, which
  // matches the FIRST fence beginning "find qa_reports -maxdepth 1" — after
  // E50, that is the ILLUSTRATIVE fence (content/skill-release-engineer.md's
  // "Derive the ticket-code SET" prose block), not the CODES= fence the role
  // actually executes. Reintroducing `git log`/`--diff-filter=A` into the
  // CODES= fence would have left that stale pin green. Repointed here at the
  // fence that opens with the `CODES=$( {` binding (E50 round 2, F8).
  const fenceMatch = SKILL.match(/```\n(\s*CODES=\$\( \{[\s\S]*?)```/);
  assert.ok(fenceMatch, "must find step 7a's EXECUTABLE CODES= fenced derivation code block");
  const fence = fenceMatch[1];
  assert.ok(fence.includes("CODES="), "sanity: the matched fence must actually contain the CODES= binding, not the illustrative fence");
  assert.ok(
    !/git log/.test(fence),
    "the EXECUTABLE CODES= fence must not invoke `git log` — that is the round-2 committed-history rule (F7 regression class)",
  );
  assert.ok(
    !/diff-filter/.test(fence),
    "the EXECUTABLE CODES= fence must not contain --diff-filter=A — that is the round-2 rule that returned EMPTY on 2 of the last 6 releases (F7)",
  );
  assert.ok(
    fence.includes('git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/'),
    "the CODES= fence must use git ls-tree as qa_reports/'s membership predicate",
  );
  assert.ok(
    fence.includes('git ls-tree -r --name-only "$PREV_TAG" -- review_reports/'),
    "the CODES= fence must use git ls-tree as review_reports/'s membership predicate too (E50)",
  );
});

test("E50 step 7a (N14 follow-up): the illustrative fence and the executable CODES= fence carry an identical find/grep -vxFf predicate pair per tree", () => {
  // N14's remedy is sequenced: this ticket repoints the pin (test above); a
  // follow-up ticket collapses the two fences into one, since every future
  // edit to the membership predicate currently has to be made twice and only
  // one copy is under test. Until that lands, pin that the duplicate cannot
  // silently diverge.
  const illustrativeMatch = SKILL.match(/```\n(\s*find qa_reports -maxdepth 1[\s\S]*?)```/);
  const executableMatch = SKILL.match(/```\n(\s*CODES=\$\( \{[\s\S]*?)```/);
  assert.ok(illustrativeMatch && executableMatch, "both fences must be present in the shipped text");

  const normalize = (s) =>
    s
      .replace(/\[ -z "\$EXCLUDE_(QA|RR)" \] && /g, "") // only the executable fence gates each pipeline on EXCLUDE_*
      .replace(/\\\n/g, " ") // shell line-continuation, not a semantic difference
      .replace(/\s+/g, " ")
      .trim();

  const illustrative = normalize(illustrativeMatch[1]);
  const executable = normalize(executableMatch[1]);
  for (const tree of ["qa_reports", "review_reports"]) {
    const pairRe = new RegExp(
      `find ${tree} -maxdepth 1 -type f \\| sort \\| grep -vxFf <\\(git ls-tree -r --name-only "\\$PREV_TAG" -- ${tree}/\\)`,
    );
    const fromIllustrative = illustrative.match(pairRe);
    const fromExecutable = executable.match(pairRe);
    assert.ok(fromIllustrative, `illustrative fence must contain the ${tree}/ find/grep -vxFf pair`);
    assert.ok(fromExecutable, `executable fence must contain the ${tree}/ find/grep -vxFf pair`);
    assert.equal(
      fromIllustrative[0],
      fromExecutable[0],
      `${tree}/'s find/grep -vxFf pair must stay byte-identical (modulo the EXCLUDE_* guard clause and whitespace) between the two fences until they are collapsed into one`,
    );
  }
});

test("E49 step 7a (F7 regression — the single most important assertion in this suite): v3.93.0 shape — evidence untracked at root, absent from PREV_TAG's tree, still yields a non-empty code", () => {
  // v3.93.0's own evidence file (review_T-E36-01.md) was NEVER committed at
  // qa_reports/ root in any commit — untracked at step-7a time, the norm, not
  // the exception. The round-2 committed-history rule returned EMPTY here
  // (`git log --diff-filter=A` sees no add event for an untracked file). An
  // empty result here silently orphans evidence without failing the release
  // (combined with "zero matches = silent no-op") — this is the exact defect
  // class F7 exists to close.
  const workingTree = ["qa_reports/review_T-E36-01.md"];
  const prevTagTree = []; // v3.92.1's qa_reports/ tree does not contain this file
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E36"], "v3.93.0 shape (untracked-at-root) must yield {E36}, NOT the empty set (F7)");
});

test("E49 step 7a (F7 regression): v3.94.0 shape — two untracked-at-root files yield {E37,E38}, not empty", () => {
  const workingTree = ["qa_reports/review_T-E37-01.md", "qa_reports/review_T-E38-01.md"];
  const prevTagTree = []; // v3.93.0's qa_reports/ tree does not contain either file
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E37", "E38"], "v3.94.0 shape (untracked-at-root, two files) must yield {E37,E38}, NOT the empty set (F7)");
});

test("E49 step 7a: committed-in-range case still works — the exact v3.94.0..7b49d81^ shape yields {E45,E46}", () => {
  // The release that motivated E49: v3.95.0 shipped E45 and E46 together under
  // active_feature "e46-...", and both evidence files WERE committed at root
  // within the range (this is the shape round 1's slug-hunting rule got wrong,
  // and round 2's fix got right).
  const workingTree = ["qa_reports/review_T-E45-01.md", "qa_reports/review_T-E46-01.md"];
  const prevTagTree = []; // v3.94.0's qa_reports/ tree does not contain either file
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E45", "E46"], "the committed-in-range case must still yield {E45,E46} — the working-tree rule subsumes it, doesn't regress it");
});

test("E49 step 7a: non-retroactivity — a file already recorded in PREV_TAG's tree is excluded, even though it is still sitting orphaned at root", () => {
  // At the NEXT release after v3.95.0, `git ls-tree -r --name-only v3.95.0 --
  // qa_reports/` DOES contain qa_reports/review_T-E45-01.md (round 3,
  // "Non-retroactivity — CONFIRMED"), so it must NOT re-enter <CODES> — the
  // orphan stays T-E49-02's manual one-off sweep, not a job for this rule.
  const workingTree = ["qa_reports/review_T-E45-01.md"];
  const prevTagTree = ["qa_reports/review_T-E45-01.md"];
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, [], "a file already present in PREV_TAG's tree must be excluded — non-retroactive by construction");
});

test("E49 step 7a (F4 negative fixture): a bare-code prose mention with no evidence file produces no code", () => {
  // 5a9a824, inside the v3.95.0 range, filed E39-E44 as OPEN and named them as
  // bare codes in the commit body — but added no qa_reports/ file for any of
  // them. <CODES> is evidence-file-backed, not ship-backed: a prose mention
  // alone must not enter the set.
  const workingTree = ["qa_reports/review_T-E45-01.md", "qa_reports/review_T-E46-01.md"];
  const prevTagTree = [];
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  for (const bareCode of ["E39", "E40", "E41", "E42", "E43", "E44"]) {
    assert.ok(!codes.includes(bareCode), `bare-code prose mention ${bareCode} (no evidence file) must not enter <CODES> (F4)`);
  }
  assert.deepEqual(codes, ["E45", "E46"], "only the codes with an actual evidence file must be admitted");
});

test("E49 step 7a: already-archived evidence never re-enters, in both the rename and untracked-add shapes", () => {
  // An archive move records as a rename (git diff --cached --name-status:
  // R100 qa_reports/review_*.md -> qa_reports/archive/.../review_*.md), which
  // -maxdepth 1 already excludes by not descending into archive/ at all; when
  // rename detection doesn't fire (untracked source), it lands as an A under
  // archive/ instead of at root, same exclusion applies.
  const workingTree = [
    "qa_reports/archive/e46-qa-spec-defect-status-rule/review_T-E45-01.md", // rename form
    "qa_reports/archive/e37-design-auditor-post-pass-edge/review_T-E37-01.md", // untracked-add form
    "qa_reports/review_T-E46-01.md", // the one genuinely new root file
  ];
  const prevTagTree = [];
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E46"], "archive/-rooted paths must never surface as candidates — -maxdepth 1 excludes them structurally, in both the rename and untracked-add shapes");
});

test("E49 step 7a (N2): filenames with no T-<CODE>- substring (expected-red_*) are admitted as files but contribute no code", () => {
  const workingTree = [
    "qa_reports/review_T-E45-01.md",
    "qa_reports/expected-red_e44-e49-release-sop-conditional-checks.txt",
  ];
  const prevTagTree = [];
  const { admitted, codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E45"], "expected-red_* must not contribute a spurious code (N2)");
  assert.ok(
    admitted.includes("qa_reports/expected-red_e44-e49-release-sop-conditional-checks.txt"),
    "expected-red_* is still admitted as a candidate FILE (moved by its own SOP bullet) even though it contributes no code to <CODES>",
  );
});

test("E50 step 7a (Item 0 — F9 CLOSED, N4 hazard closed): an empty PREV_TAG baseline WITH root files present now STOPs instead of admitting every root-level file", () => {
  // This test REPLACES, in place, the prior pin at this exact location that
  // asserted deriveCodesFromWorkingTree(["...E45...","...OLD..."], []) ->
  // ["E45","OLD"] as "current (unguarded) behavior ... NOT this ticket's to
  // fix" (round 3's N4). review_T-E50-02.md's Item 0 is explicit: E50 exists
  // to close exactly this hazard, so leaving that pin standing beside a new
  // guard test would assert the mass-sweep this ticket was written to kill —
  // two tests pinning opposite behaviors is a contradiction, and the stale
  // one reads as sanction for the permissive path. Rewritten in place; the
  // ["E45","OLD"] fixture is carried forward as the set that must NOT be
  // produced.
  const workingTree = ["qa_reports/review_T-E45-01.md", "qa_reports/review_T-OLD-01.md"];
  const prevTagTree = []; // empty baseline: no tags yet, or PREV_TAG predates qa_reports/

  const flags = deriveGuardFlags({
    prevTag: "v1.0.0",
    qaDirExists: true,
    qaBaselineNonEmpty: prevTagTree.length > 0,
    qaRootFilesPresent: workingTree.some((f) => path.posix.dirname(f) === "qa_reports"),
  });
  assert.equal(
    flags.STOP_QA,
    true,
    "an empty qa_reports/ baseline WHILE qa_reports/ root holds files an unbounded sweep would take must STOP (F9) — the exact shape the pre-E50 pin called permissive-by-design",
  );
  assert.equal(flags.EXCLUDE_QA, false, "STOP and EXCLUDE are mutually exclusive outcomes for the same tree in the same run");

  // Sanity: the underlying per-file derivation logic is UNCHANGED by E50 (it
  // is the guard that gates whether it may run, not the derivation itself)
  // — so this remains the exact dangerous set F9's guard exists to keep the
  // SOP from ever deriving on this input.
  const { codes: wouldHaveBeenDerived } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(
    wouldHaveBeenDerived,
    ["E45", "OLD"],
    "carried-forward fixture: this is the mass-sweep set that must never be produced when the guard is honored (per-tree STOP fires before this derivation is reached)",
  );
});

test("E49/E44 step-order pin: step 7a precedes step 8 in the file, and 7a's derivation does not depend on the release commit's own content (guards F2's class from returning)", () => {
  const idx7a = SKILL.indexOf("7a. **Archive shipped feature's qa_reports**");
  const idx8 = SKILL.indexOf("8. **Commit + tag + push**");
  assert.ok(idx7a > -1, "must find step 7a's header text");
  assert.ok(idx8 > -1, "must find step 8's header text");
  assert.ok(idx7a < idx8, "step 7a must precede step 8 in file order — 7a's moves must land IN the release commit step 8 creates");

  // F2 (round 1 BLOCKING, CLOSED round 2): the round-1 worked example silently
  // read state from the future — slugs that exist only inside the release
  // commit itself, which does not exist yet when 7a runs. Guard against that
  // defect class returning: 7a's own section must not reference the release
  // commit's own diff/content.
  const section7a = SKILL.slice(idx7a, idx8);
  assert.ok(
    !/git diff HEAD~1/.test(section7a),
    "step 7a must not reference the release commit's own diff (HEAD~1) — that commit does not exist yet at 7a time (F2 regression class)",
  );
  assert.ok(
    !/git show HEAD\b/.test(section7a),
    "step 7a must not reference the release commit's own content via `git show HEAD` (F2 regression class)",
  );
});

// ---------------------------------------------------------------------------
// Phase 8 — E50: step 7a per-tree empty-baseline guard, review_reports/
// extension, and the extraction-chain filename-shape matrix.
// review_reports/review_T-E50-02.md, "Test-coverage note for T-E50-03 —
// FINAL, supersedes Round 1" (12 items, ordered by consequence). Items 0
// (guard flip) and 1 (N14 fence repoint) are addressed in place above; the
// remainder follow here.
// ---------------------------------------------------------------------------

test("E50 step 7a (Item 3 — 14-row filename-shape matrix, attack 1): the shipped extraction chain produces exactly these codes, or none", () => {
  const cases = [
    ["review_T-RELSOP-01.md", "RELSOP"], // v3.91.0 depends on this shape
    ["review_T-E4X-03.md", "E4X"], // alphanumeric code preserved
    ["visual_T-E36-01.md", "E36"], // visual_ prefix handled
    ["review_T-E11E12-02.md", "E11E12"], // matches a real multi-ticket task id
    ["review_T-C7-CR.md", "C7"], // trailing non-numeric segment
    ["T-E51-01.md", "E51"], // no review_/visual_ prefix at all -- [a-z_]* matches empty
    ["expected-red_e50-release-sop-step7a-hardening.txt", null], // moved by its own bullet, never enters <CODES>
    ["expected-red_T-E51-01.txt", null], // adversarial: a real code embedded in an expected-red_ name still must not enter <CODES>
    ["review_C1-02.md", null], // legacy pre-convention name (no T-<CODE>- token)
    ["review_b8.md", null], // legacy pre-convention name
    ["README.md", null], // no prefix, no T-<CODE>- token
    ["REVIEW_T-E51-01.md", null], // uppercase prefix breaks the lowercase [a-z_]* class
    ["review_t-e51-01.md", null], // lowercase "t-" breaks the literal uppercase "T-" match
    ["review_T-PGAT.md", null], // N16: no trailing "-<segment>" after the code, invisible end-to-end
  ];
  for (const [filename, expected] of cases) {
    assert.equal(
      codeFromFilename(filename),
      expected,
      `${filename} must derive ${expected === null ? "no code" : `"${expected}"`}`,
    );
  }
});

test("E50 step 7a (N15, recorded not fixed): the [a-z_]* prefix class is wider than review_/visual_ and over-accepts a stray non-convention filename", () => {
  // Non-blocking per review_T-E50-02.md — not fixed in this ticket, pinned so
  // the over-accept is visible in the suite rather than rediscovered.
  assert.equal(codeFromFilename("notes_about_T-E99-01_backup.md"), "E99");
  assert.equal(codeFromFilename("archive_T-E51-01.md"), "E51");
});

test("E50 step 7a (F9 — per-tree guard, all shapes): tree absent, baseline empty with/without root files, and the globally-unset PREV_TAG case", () => {
  // Tree absent -> EXCLUDE; the other tree is unaffected.
  assert.deepEqual(
    deriveGuardFlags({ prevTag: "v1.0.0", rrDirExists: false, qaBaselineNonEmpty: true }),
    { STOP_QA: false, STOP_RR: false, EXCLUDE_QA: false, EXCLUDE_RR: true },
  );

  // Baseline empty + zero root files -> EXCLUDE (nothing to protect, nothing to sweep).
  let flags = deriveGuardFlags({ prevTag: "v1.0.0", qaBaselineNonEmpty: false, qaRootFilesPresent: false });
  assert.equal(flags.EXCLUDE_QA, true, "empty baseline with nothing at root must EXCLUDE, not STOP");
  assert.equal(flags.STOP_QA, false);

  // Baseline empty + root files present -> STOP (the real N4 hazard).
  flags = deriveGuardFlags({ prevTag: "v1.0.0", qaBaselineNonEmpty: false, qaRootFilesPresent: true });
  assert.equal(flags.STOP_QA, true, "empty baseline with root files present must STOP");
  assert.equal(flags.EXCLUDE_QA, false);

  // PREV_TAG unset -> both trees STOP, unconditionally (genuinely global: no
  // baseline exists for ANY tree, a property of the repo, not of a tree).
  assert.deepEqual(
    deriveGuardFlags({ prevTag: "", qaBaselineNonEmpty: true, rrDirExists: false }),
    { STOP_QA: true, STOP_RR: true, EXCLUDE_QA: false, EXCLUDE_RR: false },
  );

  // Baseline non-empty -> neither STOP nor EXCLUDE; the tree participates normally.
  assert.deepEqual(
    deriveGuardFlags({ prevTag: "v1.0.0", qaBaselineNonEmpty: true, rrBaselineNonEmpty: true }),
    { STOP_QA: false, STOP_RR: false, EXCLUDE_QA: false, EXCLUDE_RR: false },
  );
});

test("E50 step 7a (Item 4 — F9 CLOSED, the permanent-wedge shape from round 1): a workspace whose review_reports/ tree never exists proceeds across THREE CONSECUTIVE releases, not just once", () => {
  // Round 1's F9 finding: a global-OR guard STOPped this shape at release 2
  // and recurred at release 3, forever -- self-inflicted, since nothing in
  // the loop ever creates review_reports/. A fix that merely DEFERS the STOP
  // (e.g. only clears at release 2) would still fail this test, because it
  // asserts the SAME workspace shape at three consecutive tags. Mature
  // workspace: qa_reports/ already has a non-empty baseline BEFORE this
  // fixture's window (a "review_T-PRIOR-01.md" from an earlier release) so
  // qa_reports/'s own guard outcome is "included" throughout, isolating
  // review_reports/'s permanent absence as the only variable under test.
  const releases = [
    {
      prevTag: "v1.0.0",
      qaWorkingTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md"],
      qaPrevTagTree: ["qa_reports/review_T-PRIOR-01.md"],
    },
    {
      prevTag: "v1.1.0",
      qaWorkingTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md", "qa_reports/review_T-NEXT-01.md"],
      qaPrevTagTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md"],
    },
    {
      prevTag: "v1.2.0",
      qaWorkingTree: [
        "qa_reports/review_T-PRIOR-01.md",
        "qa_reports/review_T-NEW-01.md",
        "qa_reports/review_T-NEXT-01.md",
        "qa_reports/review_T-FOUR-01.md",
      ],
      qaPrevTagTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md", "qa_reports/review_T-NEXT-01.md"],
    },
  ];
  const expectedNewCode = ["NEW", "NEXT", "FOUR"];
  releases.forEach((release, i) => {
    const flags = deriveGuardFlags({
      prevTag: release.prevTag,
      qaDirExists: true,
      qaBaselineNonEmpty: release.qaPrevTagTree.length > 0,
      qaRootFilesPresent: true,
      rrDirExists: false, // review_reports/ has NEVER been created in this workspace
    });
    assert.equal(flags.EXCLUDE_RR, true, `release ${i + 1}: an absent review_reports/ tree must EXCLUDE, not STOP`);
    assert.equal(flags.STOP_QA, false, `release ${i + 1}: the qa_reports/ half must be unaffected by review_reports/'s permanent absence`);
    const { codes } = deriveCodesUnion({
      qaWorkingTree: release.qaWorkingTree,
      qaPrevTagTree: release.qaPrevTagTree,
      excludeRr: true,
    });
    assert.ok(
      codes.includes(expectedNewCode[i]),
      `release ${i + 1} must still derive its own new code (${expectedNewCode[i]}) -- the wedge from round 1 must not recur or merely defer`,
    );
  });
});

test("E50 step 7a (Item 5/7 — seven-release backtest, union adds zero extra codes on real history): union(qa_reports, review_reports) equals the qa_reports column on all seven releases", () => {
  // Ported from review_reports/review_T-E50-02.md's round-2 seven-release
  // table (re-run against the shipped guard + CODES= blocks in seven detached
  // worktrees). review_reports/'s <CODES> is always a SUBSET of the same
  // release's qa_reports/ set in this repo's actual history -- the union
  // therefore adds nothing extra, on every row.
  const releases = [
    { tag: "v3.91.0", qa: ["E25", "E27", "E28", "E29", "E30", "E32", "E33", "RELSOP"], rr: ["E25", "E32"] },
    { tag: "v3.92.0", qa: ["E34"], rr: ["E34"] },
    { tag: "v3.92.1", qa: ["E35"], rr: ["E35"] },
    { tag: "v3.93.0", qa: ["E36"], rr: ["E36"] },
    { tag: "v3.94.0", qa: ["E37", "E38"], rr: ["E37", "E38"] },
    { tag: "v3.95.0", qa: ["E45", "E46"], rr: ["E45", "E46"] },
    { tag: "v3.96.0", qa: ["E44", "E49", "E4X"], rr: ["E4X"] }, // the highest-value row: review_reports/ contributes at all
  ];
  for (const { tag, qa, rr } of releases) {
    const qaWorkingTree = qa.map((c) => `qa_reports/review_T-${c}-01.md`);
    const rrWorkingTree = rr.map((c) => `review_reports/review_T-${c}-01.md`);
    const { codes } = deriveCodesUnion({ qaWorkingTree, qaPrevTagTree: [], rrWorkingTree, rrPrevTagTree: [] });
    assert.deepEqual(
      codes,
      [...qa].sort(),
      `${tag}: union must equal the qa_reports column exactly -- review_reports/ contributes nothing beyond it in this repo's real history`,
    );
  }
});

test("E50 step 7a (Item 6 — the real v3.96.0 collision): identical basenames in both trees resolve to distinct, non-clobbering destinations", () => {
  const activeFeature = "e44-e49-release-sop-conditional-checks";
  const moves = resolveMoves({
    qaAdmitted: ["qa_reports/review_T-E4X-03.md"],
    rrAdmitted: ["review_reports/review_T-E4X-03.md"],
    activeFeature,
  });
  assert.equal(moves.length, 2, "both files must be scheduled to move -- neither may be dropped because of the shared basename");
  const destinations = moves.map((m) => m.to);
  assert.equal(
    new Set(destinations).size,
    2,
    "the two destinations must differ -- a single shared destination would make `mv -n` silently skip whichever file arrives second (the real v3.96.0 collision)",
  );
  assert.ok(destinations.includes("qa_reports/archive/e44-e49-release-sop-conditional-checks/review_T-E4X-03.md"));
  assert.ok(destinations.includes("review_reports/archive/e44-e49-release-sop-conditional-checks/review_T-E4X-03.md"));
});

test("E50 step 7a (Item 7 — real v3.96.0 shape): E44/E49 enter <CODES> from qa_reports/ alone; the review_reports/ move matches nothing for them and no-ops", () => {
  const qaWorkingTree = ["qa_reports/review_T-E44-01.md", "qa_reports/review_T-E49-01.md", "qa_reports/review_T-E4X-03.md"];
  const rrWorkingTree = ["review_reports/review_T-E4X-03.md"];
  const { codes } = deriveCodesUnion({ qaWorkingTree, qaPrevTagTree: [], rrWorkingTree, rrPrevTagTree: [] });
  assert.deepEqual(codes, ["E44", "E49", "E4X"], "union must include E44/E49 from qa_reports/ alone plus E4X from both trees");

  // The review_reports/ move bullet matches root files whose id is in
  // <CODES> -- with no E44/E49 file present in review_reports/, it moves
  // nothing for those two codes; only E4X's file (genuinely present in both
  // trees) moves, from each tree to its OWN archive dir (Item 6).
  const rrMoved = rrWorkingTree.filter((f) => codes.some((c) => path.posix.basename(f).includes(`T-${c}-`)));
  assert.deepEqual(
    rrMoved,
    ["review_reports/review_T-E4X-03.md"],
    "review_reports/ must not fabricate moves for codes that exist only in qa_reports/, and a retried mv -n over the same match stays idempotent",
  );
});

test("E50 step 7a (Item 8 — covers: sweep stays in its own tree): a review_reports/*.md file whose covers: line matches <CODES> resolves to review_reports/archive/, never qa_reports/archive/", () => {
  const activeFeature = "e44-e49-release-sop-conditional-checks";
  const coversLine = "covers: T-E4X-03, T-E44-01, T-E49-01";
  const codes = ["E44", "E49", "E4X"];
  const coveredIds = coversLine.replace(/^covers:\s*/, "").split(",").map((s) => s.trim());
  const intersects = coveredIds.some((id) => codes.some((c) => id === `T-${c}` || id.startsWith(`T-${c}-`)));
  assert.ok(intersects, "sanity: this covers: line does intersect <CODES>");

  // Destination is resolved per SOURCE TREE, never by which codes matched --
  // a review_reports/*.md file's covers: sweep can never land in
  // qa_reports/archive/, and symmetrically.
  assert.equal(resolveDestination("review_reports", activeFeature), `review_reports/archive/${activeFeature}/`);
  assert.notEqual(resolveDestination("review_reports", activeFeature), resolveDestination("qa_reports", activeFeature));
});

test("E50 step 7a (Item 9 — non-retroactivity, highest-consequence regression pin): a baseline containing a review_reports/ root file excludes that id, even across the 103 legacy files", () => {
  // Real v3.96.0 shape (review_T-E50-02.md round 2): E45 sits in v3.95.0's
  // review_reports/ baseline because the coordinator's manual R100 cleanup
  // committed it there. The NEXT release must not re-derive E45 from
  // review_reports/ even though the rule correctly does NOT know or care WHY
  // it is already in the baseline -- a bug here mass-relocates the project's
  // entire code-review history.
  const rrWorkingTree = ["review_reports/review_T-E45-01.md", "review_reports/review_T-E51-01.md"];
  const rrPrevTagTree = ["review_reports/review_T-E45-01.md"]; // already recorded in the previous release's tree
  const { codes } = deriveCodesUnion({ rrWorkingTree, rrPrevTagTree });
  assert.deepEqual(codes, ["E51"], "E45 must be excluded -- it is already in PREV_TAG's review_reports/ tree, non-retroactive by construction");

  // Scaled check: a legacy review_reports/ root file already in every recent
  // baseline (the 103 pre-E50 files at that root are all in this shape) must
  // never be swept into a new feature's <CODES>, no matter how old.
  const legacyFile = "review_reports/review_T-RELSOP-01.md"; // v3.91.0-era, in every baseline since
  const { codes: legacyCodes } = deriveCodesUnion({
    rrWorkingTree: [legacyFile, ...rrWorkingTree],
    rrPrevTagTree: [legacyFile, ...rrPrevTagTree],
  });
  assert.ok(
    !legacyCodes.includes("RELSOP"),
    "a legacy review_reports/ file already in every recent baseline must never be swept into a new feature's <CODES>",
  );
});

test("E50 step 7a (Item 4 continued — directory absence on disk): review_reports/ not present at all is EXCLUDE, not an error, and contributes nothing", () => {
  // `find review_reports -maxdepth 1` exits 1 with "No such file or
  // directory" when the tree is absent -- a real path a teamwork-lite
  // consumer workspace takes (code-reviewer never dispatched, so
  // review_reports/ never comes into existence). The guard must route this
  // to EXCLUDE before any find/grep runs against the missing directory.
  const flags = deriveGuardFlags({ prevTag: "v3.96.0", rrDirExists: false });
  assert.equal(flags.EXCLUDE_RR, true);
  assert.equal(flags.STOP_RR, false);
  const { codes, admitted } = deriveCodesUnion({
    qaWorkingTree: ["qa_reports/review_T-E50-01.md"],
    qaPrevTagTree: [],
    rrWorkingTree: ["review_reports/review_T-SHOULD-NOT-APPEAR-01.md"], // must never be consulted when excluded
    rrPrevTagTree: [],
    excludeRr: true,
  });
  assert.deepEqual(codes, ["E50"], "an excluded review_reports/ tree must contribute nothing, even if a caller mistakenly passes it working-tree data");
  assert.ok(!admitted.some((f) => f.startsWith("review_reports/")), "no review_reports/ path may enter the admitted set when EXCLUDE_RR is set");
});

test("E50 step 7a: the guard block precedes the CODES= derivation, mkdir, and move bullets, and performs no writes itself", () => {
  const idx7a = SKILL.indexOf("7a. **Archive shipped feature's qa_reports**");
  const guardIdx = SKILL.indexOf("STOP_QA= STOP_RR= EXCLUDE_QA= EXCLUDE_RR=");
  const codesIdx = SKILL.indexOf("CODES=$( {");
  const mkdirIdx = SKILL.indexOf("`mkdir -p` the archive dir for each tree that is NOT");
  assert.ok(idx7a > -1 && guardIdx > -1 && codesIdx > -1 && mkdirIdx > -1, "must locate step 7a, the guard block, the CODES= derivation, and the mkdir bullet");
  assert.ok(idx7a < guardIdx, "the guard must live inside step 7a");
  assert.ok(guardIdx < codesIdx, "the guard must precede the CODES= derivation -- a guard evaluated after the sweep is worthless");
  assert.ok(codesIdx < mkdirIdx, "the CODES= derivation must precede the mkdir bullet");

  const guardFence = SKILL.match(/```\n(\s*STOP_QA= STOP_RR=[\s\S]*?)```/);
  assert.ok(guardFence, "must find the guard's fenced code block");
  const guard = guardFence[1];
  assert.ok(!/\bmv\b/.test(guard), "the guard block must contain no `mv` -- it must not itself be capable of sweeping");
  assert.ok(!/mkdir/.test(guard), "the guard block must contain no `mkdir`");
  assert.ok(!/git add/.test(guard), "the guard block must contain no `git add`");
});

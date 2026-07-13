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

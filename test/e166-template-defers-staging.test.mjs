// Coded by @qa-engineer
// Tests that the release-engineer agent template defers to the skill's staging list instead
// of restating it (docs/backlog.md row E166, Wave 4.5 L-RELTOOL; no spec file). Contract:
// templates/claude-code-agents/release-engineer.md drops its own path list and defers to
// content/skill-release-engineer.md step 8a ("Stage explicitly") and its "Pre-commit
// verify" sub-step. Cases T-E166-01a/b/c.
// Rationale: specs/e260f-comment-rationale.md (test/e166-template-defers-staging.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const TEMPLATE_PATH = path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md");
const SKILL_PATH = path.join(ROOT, "content", "skill-release-engineer.md");

const TEMPLATE = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const SKILL = fs.readFileSync(SKILL_PATH, "utf-8");

test("T-E166-01a: template names NO staging path list — a restated run of directory paths would fail this", () => {
  // The old template line restated a subset as backtick spans of directories plus
  // package.json etc. Detect that SHAPE generically (>=3 consecutive whitespace-separated
  // tokens each ending in "/") so the assertion fails if ANY path list, old, shorter or
  // newly invented, is restated.
  const restatedDirListPattern = /(?:\b[\w.-]+\/[ \t]+){2,}\b[\w.-]+\//;
  const match = TEMPLATE.match(restatedDirListPattern);
  assert.equal(
    match,
    null,
    `template must not restate a staging directory-path list (T-E166-01); found: ${match?.[0]}`,
  );

  // Belt-and-suspenders: none of the specific directories the old list named
  // appear as a bare backticked path anywhere in the template.
  for (const dir of ["lib/", "tools/", "schema/", "guards/", "gates/", "qa_reports/", "review_reports/"]) {
    assert.ok(
      !TEMPLATE.includes(`\`${dir}`) && !new RegExp(`\`[^\`]*\\b${dir.replace("/", "\\/")}`).test(TEMPLATE),
      `template must not restate the old path list entry "${dir}" (T-E166-01)`,
    );
  }
});

test("T-E166-01b [E404 re-pin]: the template carries no staging line and no step 8a reference; staging lives only in the SOP / prepare phase", () => {
  // Why: E404 slimmed the template to watermark + load + one re-baseline hint + RELAY, so the
  // staging reinforcement line (and its step 8a pointer, a step that no longer exists) is gone.
  assert.ok(!TEMPLATE.includes("Staging scope"), "template must carry no staging-scope line");
  assert.ok(!/step 8a/.test(TEMPLATE), "template must not name SOP step 8a");
  assert.ok(!TEMPLATE.includes("Stage explicitly"), 'template must not name the "Stage explicitly" anchor');
  assert.ok(!TEMPLATE.includes("Pre-commit verify"), 'template must not name the "Pre-commit verify" anchor');
});

test("T-E166-01c [E394 re-pin AC-S6/AC-P3]: the staging contract the template defers to now lives in the `prepare` phase — SOP step 12 delegates it, scripts/release.mjs holds the single normative list and the pre-commit verify, and the history keeps the named anchors", () => {
  // The rewritten SOP no longer has step 8a: the explicit list and the pre-commit verify run inside `prepare`.
  const prepareStep = SKILL.match(/^12\. Prepare \(.*$/m);
  assert.ok(prepareStep, "content/skill-release-engineer.md must contain the prepare step (12) (T-E166-01)");
  assert.match(
    prepareStep[0],
    /staging and citation checks, release commit/,
    "the prepare step must own staging, its completeness check and the release commit (T-E166-01)",
  );
  assert.match(SKILL, /\| exit 30 STAGING_INCOMPLETE \| Blocked \|/, "an incomplete stage must be a Blocked escalation row (STOP on any missing path)");

  const script = fs.readFileSync(path.join(ROOT, "scripts", "release.mjs"), "utf-8");
  // "Stage explicitly": one normative, existence-pre-filtered list, staged by explicit pathspec, never from memory.
  assert.match(script, /export const STAGE_PATHS = Object\.freeze\(/, "the script must hold the single normative staging list (T-E166-01)");
  assert.match(script, /export function planStage\(\{ changed, exists \}\)[\s\S]*?exists\(m\)/, "the list must be existence-pre-filtered (T-E166-01)");
  assert.match(script, /\["add", "--", \.\.\.plan\]/, "staging must be by explicit pathspec list (T-E166-01)");
  // "Pre-commit verify": the staged set is checked for completeness before the commit; a miss stops.
  assert.match(script, /export function checkStagingCompleteness\(/, "the pre-commit verify must exist as checkStagingCompleteness (T-E166-01)");
  assert.match(script, /throw new ReleaseStop\("STAGING_INCOMPLETE", `\$\{verdict\.problems\.join/, "an incomplete stage must STOP before the commit (T-E166-01)");

  // The named anchors the template cites are kept verbatim in the history file.
  const history = fs.readFileSync(path.join(ROOT, "specs", "release-sop-history.md"), "utf-8");
  assert.match(history, /\*\*Stage explicitly\*\*/, 'history must keep the "Stage explicitly" anchor (T-E166-01)');
  assert.match(history, /\*\*Pre-commit verify \(AC2\)\*\*/, 'history must keep the "Pre-commit verify" anchor (T-E166-01)');
});

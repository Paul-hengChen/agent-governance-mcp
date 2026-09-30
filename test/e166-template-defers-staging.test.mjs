// Coded by @qa-engineer
// Tests that the release-engineer agent template defers to the skill's staging
// list instead of restating it (T-E166-01, docs/backlog.md row E166, Wave 4.5
// L-RELTOOL).
//
// No specs/<feature>.md exists for this mini-chain ticket (PM/architect
// skipped per the human-approved cut recorded in the handoff's
// scope_decision_why) — the spec IS docs/backlog.md's E166 row plus that
// scope_decision_why text. New file, not an extension of
// test/release-staging.test.mjs: that file's AC1-AC5 pin
// content/skill-release-engineer.md's OWN canonical staging list (unchanged
// by this ticket) and the shim's <=2-sentence reinforcement-hint shape
// (which the new wording also satisfies, confirmed green below) — none of
// its existing assertions check for ABSENCE of a restated path list or that
// the shim points at a specific SOP anchor, which is what this ticket actually
// changed (E166). Disclosed per the dispatch brief's "your call; disclose it."
//
// Contract under test (docs/backlog.md E166 / scope_decision_why):
//   templates/claude-code-agents/release-engineer.md (T-E166-01) drops its
//   OWN restated staging path list and defers to content/skill-
//   release-engineer.md step 8a's enumerated list ("Stage explicitly") and
//   its "Pre-commit verify" sub-step — never restating a shorter/staler copy
//   a haiku-tier agent could follow instead of the single normative list.
//
// Test map (criterion -> test name):
//   AC (no restated path list)         -> T-E166-01a
//   AC (defers to SOP step 8a by name) -> T-E166-01b
//   AC (anchors exist in step 8a)      -> T-E166-01c

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
  // The pre-fix line 11 restated a subset as two backtick spans:
  //   `lib/ tools/ schema/ guards/ gates/ prompts/ bin/ transport/ scripts/
  //    content/ templates/ specs/ test/ qa_reports/ review_reports/`
  //   plus metadata `package.json index.ts CHANGELOG.md README.md dist/`
  // Detect that SHAPE generically (>=3 consecutive whitespace-separated
  // tokens each ending in "/") rather than grepping for the old literal
  // list, so this assertion actually fails if ANY path list — the old one,
  // a shorter one, or a newly-invented one — is restated in the template,
  // per the dispatch brief's requirement.
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

test("T-E166-01b: template's staging line defers to the SOP's step 8a by name (\"Stage explicitly\" / \"Pre-commit verify\")", () => {
  const stagingLine = TEMPLATE.split("\n").find((l) => l.includes("Staging scope includes ALL uncommitted upstream work"));
  assert.ok(stagingLine, "template must still carry its staging-scope reinforcement line (T-E166-01)");
  assert.match(stagingLine, /step 8a/, "staging line must point to SOP step 8a by name (T-E166-01)");
  assert.match(
    stagingLine,
    /"Stage explicitly"/,
    'staging line must name the "Stage explicitly" anchor (T-E166-01)',
  );
  // "Pre-commit verify" is named either on the same line or the sentence
  // immediately following it — both read as the single staging paragraph.
  assert.match(
    TEMPLATE,
    /"Pre-commit verify"/,
    'template must name the "Pre-commit verify" anchor (T-E166-01)',
  );
});

test("T-E166-01c: the named anchors exist in content/skill-release-engineer.md, inside step 8a", () => {
  const step8aStart = SKILL.indexOf("\n8a. ");
  const step8bStart = SKILL.indexOf("\n8b. ");
  assert.ok(step8aStart !== -1, "content/skill-release-engineer.md must contain a step 8a (T-E166-01)");
  assert.ok(step8bStart !== -1, "content/skill-release-engineer.md must contain a step 8b (T-E166-01)");
  assert.ok(step8aStart < step8bStart, "step 8a must precede step 8b (T-E166-01)");

  const step8aBody = SKILL.slice(step8aStart, step8bStart);
  assert.match(
    step8aBody,
    /\*\*Stage explicitly\*\*/,
    'step 8a must contain the "Stage explicitly" anchor the template defers to (T-E166-01)',
  );
  assert.match(
    step8aBody,
    /\*\*Pre-commit verify \(AC2\)\*\*/,
    'step 8a must contain the "Pre-commit verify" anchor the template defers to (T-E166-01)',
  );
});

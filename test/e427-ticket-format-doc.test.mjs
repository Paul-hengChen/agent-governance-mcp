// Coded by @qa-engineer
// Test (T-E427-01) for specs/e427-ci-scenario-tests.md AC16: docs/ticket-format.md is the one document a person or
// agent without this tooling starts from. It must say, in its general part, what the CI check of named tests
// expects of a ticket (done only, `test` verifications only, the full nested title, the one function another
// runner supplies, the rename rule), and leave repo-specific names to the closing tooling section. The general part
// rules of test/e422-ticket-format-doc.test.mjs and test/e455-ticket-checker-strict.test.mjs (no link, no repo path,
// no ticket id other than the example's) apply to the new section too; those suites run alongside this one.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC = fs.readFileSync(path.join(ROOT, "docs", "ticket-format.md"), "utf8");

const HEADING = "## Named tests checked in CI";
const EXAMPLE_HEADING = "\n## Example ticket\n";
const TOOLING_HEADING = "\n## Checking with this repository's tooling\n";

/** The `## ` section body under `heading`, up to the next level-2 heading. */
function section(md, heading) {
  const start = md.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const rest = md.slice(start + heading.length + 2);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

test("AC16 the format doc explains the CI check of named tests in the general part and names the tooling in the closing section", () => {
  // WHY: a ticket author on any runner must learn the rules from the general part alone (scope, title rule,
  // readResults, rename), and the repo's own checker, adapter, CI step and exit codes belong only in the tooling part.
  const at = DOC.indexOf(`\n${HEADING}\n`);
  assert.ok(at >= 0, `heading "${HEADING}" exists`);
  assert.ok(at < DOC.indexOf(EXAMPLE_HEADING), "the new section is in the general part, before ## Example ticket");

  const s = section(DOC, HEADING);
  // Scope: done tickets only, `test` verifications only, the other kinds named as out of scope.
  assert.match(s, /`done`/, "names the done status");
  assert.ok(s.includes("Verification: test"), "names the `Verification: test` form");
  for (const kind of ["automated test", "command", "device-or-person"]) {
    assert.ok(s.includes(kind), `names ${kind} as not checked`);
  }
  // Full nested title joined by " > ".
  assert.ok(s.includes(" > "), "states the ` > ` join of the full nested title");
  assert.match(s, /nested/i, "states the full nested title rule");
  // The one function another project supplies.
  assert.ok(s.includes("readResults(resultsPath)"), "names readResults(resultsPath)");
  for (const word of ["file", "title", "status", "passed", "failed", "skipped"]) {
    assert.match(s, new RegExp(`\\b${word}\\b`), `describes the entry field / status ${word}`);
  }
  // Rename rule.
  assert.match(s, /renam/i, "states the rename rule");
  assert.match(s, /same change/i, "the ticket is updated in the same change");
  // General-part hygiene for the new section itself (the e422 / e455 rules).
  assert.doesNotMatch(s, /\]\(|https?:\/\//, "no link");
  assert.doesNotMatch(s, /\b(docs|scripts|templates|specs|tools|content|test|dist)\//, "no repo path");
  assert.deepEqual((s.match(/\b[A-Z]\d{2,}\b/g) ?? []).filter((id) => id !== "E900" && id !== "E899"), [], "no ticket id");

  // The closing tooling section names the checker, the adapter, the CI step and the exit codes.
  const t0 = DOC.indexOf(TOOLING_HEADING);
  assert.ok(t0 >= 0, "the tooling section is kept");
  assert.equal(DOC.slice(t0 + TOOLING_HEADING.length).search(/^## /m), -1, "the tooling section stays last");
  const tooling = DOC.slice(t0);
  assert.ok(tooling.includes("scripts/check-scenario-tests.mjs"), "names the checker");
  assert.ok(tooling.includes("scripts/scenario-results-node.mjs"), "names the adapter");
  assert.ok(tooling.includes("Check ticket scenario tests"), "names the CI step");
  const afterChecker = tooling.slice(tooling.indexOf("scripts/check-scenario-tests.mjs"));
  for (const code of ["0", "1", "2"]) {
    assert.match(afterChecker, new RegExp(`\\b${code}\\b`), `states exit code ${code} for the checker`);
  }
});

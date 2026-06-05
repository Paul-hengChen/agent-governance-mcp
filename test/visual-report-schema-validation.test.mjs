// Coded by @qa-engineer
// Tests for the v3.26.0 visual-report SCHEMA validator (Constitution §3.2):
//   validateVisualReport(content)            — pure section/row validator
//   validateVisualReports(ws, taskIds)        — per-task composition over files
//   designDeclaresStructuralAssertions(ws,f)  — backwards-compat opt-in signal
// Closes the CDE-OOBE false-PASS hole: existence + widget-shape was insufficient;
// this gate rejects PASS on missing sections, failed/unverified canonical-state
// or structural-assertion rows, or a non-PASS verdict.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  validateVisualReport,
  validateVisualReports,
  designDeclaresStructuralAssertions,
} from "../dist/tools/evidence-file.js";

// A fully-clearing v3.26 report.
const GOOD = `# Visual — T01
## Widget Shape Verification
- [x] widget.stepper — rendered

## Canonical State Verification
- [x] language — selected=English, scroll=centered; impl matches

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| primary.button.accent | all | accent #3C5AAA | token | pass |
| focus.row.bar | language | full-width bar | node | pass |

## Region Diff
### language
No material difference in compare region.

## Allowed Differences

## Verdict — PASS
`;

function tmpWs() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agc-vrs-"));
}
function writeVisual(ws, id, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `visual_${id}.md`), body, "utf-8");
}
function writeDesign(ws, feature, body) {
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${feature}.md`), body, "utf-8");
}

test("AC-1: a complete report with all rows pass + PASS verdict → ok", () => {
  const v = validateVisualReport(GOOD);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.deepEqual(v.missingSections, []);
  assert.deepEqual(v.failedCanonicalStates, []);
  assert.deepEqual(v.failedStructuralAssertions, []);
  assert.equal(v.verdictPass, true);
});

test("AC-2: a missing required section blocks (ok:false, lists it)", () => {
  const noStructural = GOOD.replace(/## Structural Assertions[\s\S]*?\n## Region Diff/, "## Region Diff");
  const v = validateVisualReport(noStructural);
  assert.equal(v.ok, false);
  assert.ok(v.missingSections.includes("Structural Assertions"));
});

test("AC-3: an unchecked canonical-state row is a failure", () => {
  const bad = GOOD.replace("- [x] language — selected", "- [ ] language — selected");
  const v = validateVisualReport(bad);
  assert.equal(v.ok, false);
  assert.equal(v.failedCanonicalStates.length, 1);
});

test("AC-4: a structural assertion with result != pass is a failure", () => {
  const bad = GOOD.replace("| focus.row.bar | language | full-width bar | node | pass |",
                           "| focus.row.bar | language | full-width bar | node | fail |");
  const v = validateVisualReport(bad);
  assert.equal(v.ok, false);
  assert.deepEqual(v.failedStructuralAssertions, ["focus.row.bar"]);
});

test("AC-4b: a blank/unverified structural result is also a failure", () => {
  const bad = GOOD.replace("| focus.row.bar | language | full-width bar | node | pass |",
                           "| focus.row.bar | language | full-width bar | node |  |");
  const v = validateVisualReport(bad);
  assert.equal(v.ok, false);
  assert.deepEqual(v.failedStructuralAssertions, ["focus.row.bar"]);
});

test("AC-5: header + separator rows are not counted as assertion failures", () => {
  // GOOD has a header row + separator + 2 pass rows → zero failures.
  const v = validateVisualReport(GOOD);
  assert.deepEqual(v.failedStructuralAssertions, []);
});

test("AC-6: a non-PASS verdict blocks even when rows clear", () => {
  const bad = GOOD.replace("## Verdict — PASS", "## Verdict — FAIL (pixel drift)");
  const v = validateVisualReport(bad);
  assert.equal(v.ok, false);
  assert.equal(v.verdictPass, false);
});

test("AC-7: validateVisualReports aggregates only failing task ids", () => {
  const ws = tmpWs();
  writeVisual(ws, "T01", GOOD);
  writeVisual(ws, "T02", GOOD.replace("| node | pass |\n", "| node | fail |\n"));
  const r = validateVisualReports(ws, ["T01", "T02"]);
  assert.equal(r.ok, false);
  assert.ok(!("T01" in r.byTaskId), "T01 passes, not listed");
  assert.ok("T02" in r.byTaskId, "T02 fails, listed");
});

test("AC-8: missing visual file is skipped here (existence enforced upstream)", () => {
  const ws = tmpWs();
  const r = validateVisualReports(ws, ["T99"]);
  assert.equal(r.ok, true); // no file → not validated here
});

test("AC-9: designDeclaresStructuralAssertions true only when section present", () => {
  const ws = tmpWs();
  writeDesign(ws, "feat", "## Mode\nfigma\n## Visual Structural Assertions\n| a | b | c | d |\n");
  assert.equal(designDeclaresStructuralAssertions(ws, "feat"), true);

  const ws2 = tmpWs();
  writeDesign(ws2, "feat", "## Mode\nfigma\n## Visual Baselines\n| a | b | c | d |\n");
  assert.equal(designDeclaresStructuralAssertions(ws2, "feat"), false);

  // no design file
  assert.equal(designDeclaresStructuralAssertions(tmpWs(), "feat"), false);
});

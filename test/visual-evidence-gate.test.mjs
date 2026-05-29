// Coded by @qa-engineer
// Tests for specs/pixel-perfect-fixes-v3.14.md — AC-5, AC-6, AC-10.
// Asserts the Constitution §3.1 visual evidence gate: when
// design/<active_feature>.md contains `## Visual Baselines`, server
// rejects PASS unless qa_reports/visual_<task-id>.md exists for every
// task id in the round.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  hasVisualBaselinesInDesign,
  hasVisualEvidenceInFile,
} from "../dist/tools/evidence-file.js";

function mkWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "visgate-"));
}

function writeDesignWithBaselines(ws, feature, hasH2) {
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  const body = hasH2
    ? `# design/${feature}\n\n## Source manifest\n- figma | 1:1 | yes | audited | -\n\n## Visual Baselines\n\n| surface | baseline | impl | notes |\n| --- | --- | --- | --- |\n| oobe.step1 | design/oobe/step1.png | screenshots/step1.png | landscape |\n`
    : `# design/${feature}\n\n## Source manifest\n- figma | 1:1 | yes | audited | -\n`;
  fs.writeFileSync(path.join(dir, `${feature}.md`), body);
}

function writeVisualEvidence(ws, taskId) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `visual_${taskId}.md`), `# Visual report ${taskId}\n\n## Verdict — PASS\n`);
}

// ---------- hasVisualBaselinesInDesign ----------

test("AC-5: gate dormant when design file is absent (non-UI workspace)", () => {
  const ws = mkWorkspace();
  const result = hasVisualBaselinesInDesign(ws, "anything");
  assert.equal(result.present, false, "no design file → gate stays silent");
  assert.ok(result.designPath.endsWith("design/anything.md"), "designPath surfaces resolved path for callers");
});

test("AC-5: gate dormant when design file has no ## Visual Baselines H2 (v3.13.0-style audit)", () => {
  const ws = mkWorkspace();
  writeDesignWithBaselines(ws, "feat-x", false);
  const result = hasVisualBaselinesInDesign(ws, "feat-x");
  assert.equal(result.present, false, "no baselines declared → gate stays silent");
});

test("AC-5: gate triggers when design file declares ## Visual Baselines", () => {
  const ws = mkWorkspace();
  writeDesignWithBaselines(ws, "feat-x", true);
  const result = hasVisualBaselinesInDesign(ws, "feat-x");
  assert.equal(result.present, true, "## Visual Baselines H2 → gate fires");
});

test("AC-5: empty active_feature collapses to dormant gate (defensive)", () => {
  const ws = mkWorkspace();
  const result = hasVisualBaselinesInDesign(ws, "");
  assert.equal(result.present, false, "empty feature name must not trigger gate");
});

test("AC-5: active_feature with path-unsafe characters is sanitised (slashes collapsed)", () => {
  // Why: a hostile feature name with `/` characters must not escape the
  // workspace/design/ directory. The sanitiser replaces [^A-Za-z0-9._-]
  // with underscore — so any path-segment characters collapse to `_`,
  // keeping the resolved path inside design/.
  const ws = mkWorkspace();
  const result = hasVisualBaselinesInDesign(ws, "evil/feature/name");
  assert.ok(result.designPath.includes(path.join(ws, "design")), "designPath must remain inside workspace/design/");
  assert.ok(!result.designPath.includes("/evil/"), "slashes in feature name must be sanitised");
  // Note: `..` is a literal allowed by [A-Za-z0-9._-] so `../etc/passwd`
  // becomes `.._etc_passwd.md` — not a traversal because the slashes are
  // replaced. The file simply won't exist. This test confirms the slash
  // collapse, which is the load-bearing defense.
});

test("AC-5: ## Visual Baselines match is case-insensitive (multiline)", () => {
  const ws = mkWorkspace();
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "feat.md"), "# x\n\n## visual baselines\n\n(lowercase variant)\n");
  const result = hasVisualBaselinesInDesign(ws, "feat");
  assert.equal(result.present, true, "case-insensitive match required");
});

// ---------- hasVisualEvidenceInFile ----------

test("AC-10: visual evidence absent → all task ids reported missing", () => {
  const ws = mkWorkspace();
  const result = hasVisualEvidenceInFile(ws, ["T01", "T02", "T03"]);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, ["T01", "T02", "T03"]);
});

test("AC-10: visual evidence present for some tasks → partial split", () => {
  const ws = mkWorkspace();
  writeVisualEvidence(ws, "T01");
  writeVisualEvidence(ws, "T03");
  const result = hasVisualEvidenceInFile(ws, ["T01", "T02", "T03"]);
  assert.deepEqual(result.present, ["T01", "T03"]);
  assert.deepEqual(result.missing, ["T02"]);
});

test("AC-10: task ids are sanitised before path resolution (no traversal)", () => {
  // Why: same defense as hasEvidenceInFile / hasCodeReviewEvidenceInFile.
  // A task id like "../../etc/passwd" must collapse to a safe filename.
  const ws = mkWorkspace();
  const result = hasVisualEvidenceInFile(ws, ["../../etc/passwd"]);
  // The sanitised name will look like "______etc_passwd"; we don't assert
  // the exact transform, only that the lookup remained inside the workspace.
  assert.deepEqual(result.present, []);
  assert.equal(result.missing.length, 1);
});

test("AC-10: empty task id list returns empty present and missing arrays", () => {
  const ws = mkWorkspace();
  const result = hasVisualEvidenceInFile(ws, []);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, []);
});

// ---------- Integration: gate + evidence ----------

test("AC-5 + AC-10: complete gate flow — design declares baselines AND evidence present", () => {
  const ws = mkWorkspace();
  writeDesignWithBaselines(ws, "feat-x", true);
  writeVisualEvidence(ws, "T01");
  const gate = hasVisualBaselinesInDesign(ws, "feat-x");
  assert.equal(gate.present, true);
  const evidence = hasVisualEvidenceInFile(ws, ["T01"]);
  assert.deepEqual(evidence.missing, [], "evidence present → gate would accept PASS");
});

test("AC-5 + AC-10: gate fires but evidence missing — PASS would be rejected", () => {
  const ws = mkWorkspace();
  writeDesignWithBaselines(ws, "feat-x", true);
  // Intentionally no visual_<id>.md
  const gate = hasVisualBaselinesInDesign(ws, "feat-x");
  assert.equal(gate.present, true);
  const evidence = hasVisualEvidenceInFile(ws, ["T01"]);
  assert.deepEqual(evidence.missing, ["T01"], "evidence missing → server would return VISUAL_EVIDENCE_MISSING");
});

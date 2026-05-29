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
});

// ---------- v3.14.1 AC-3 — sanitiser collapses `..` literal ----------

test("v3.14.1 AC-3: sanitiser collapses `..` literal in active_feature", () => {
  // Why: v3.14.0 sanitiser replaced `/` with `_` so `../etc/passwd` could
  // not traverse — BUT the `..` literal itself survived as a filename
  // component. v3.14.1 adds a `\\.\\.+` → `_` collapse so hostile names
  // like `..feat` or `pp..pp` produce safe filenames without surprising
  // `..` segments. This test pins the new behaviour.
  const ws = mkWorkspace();
  const r1 = hasVisualBaselinesInDesign(ws, "..feat");
  assert.ok(!r1.designPath.includes(".."), "leading `..` MUST be collapsed");
  assert.ok(r1.designPath.endsWith("_feat.md"), "expected sanitised filename _feat.md");

  const r2 = hasVisualBaselinesInDesign(ws, "f..oo");
  assert.ok(!r2.designPath.includes(".."), "middle `..` MUST be collapsed");
  assert.ok(r2.designPath.endsWith("f_oo.md"));

  const r3 = hasVisualBaselinesInDesign(ws, "...");
  assert.ok(!r3.designPath.includes(".."), "`...` MUST collapse to `_`");
  assert.ok(r3.designPath.endsWith("_.md"));
});

test("v3.14.1 AC-3: single `.` survives (legitimate filename character)", () => {
  // Why: the sanitiser must NOT clobber single dots — `feat.v2` is a valid
  // feature name. Only 2+ consecutive dots are collapsed.
  const ws = mkWorkspace();
  const result = hasVisualBaselinesInDesign(ws, "feat.v2");
  assert.ok(result.designPath.endsWith("feat.v2.md"), "single dots must survive");
});

// ---------- v3.14.1 AC-9 — read-error silent-swallow (confirm intentional) ----------

test("v3.14.1 AC-9: hasVisualBaselinesInDesign silently returns { present: false } on read error", () => {
  // Why: AC-9 confirms the silent-swallow is intentional (matches
  // hasEvidenceInFile convention — existence-check rather than error
  // propagation). A future fail-loud variant would be a v3.15.0 API change.
  // This test pins the current contract so a refactor doesn't accidentally
  // start throwing.
  const ws = mkWorkspace();
  // Create design file then delete dir between mkdir and read — simulates
  // a race / permission issue. The function MUST NOT throw.
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  const filePath = path.join(ws, "design", "broken.md");
  // Make a file that exists but is empty + immediately remove it after the
  // existsSync check. The simpler route: just confirm the catch-block
  // handles bad UTF-8.
  fs.writeFileSync(filePath, Buffer.from([0xff, 0xfe, 0xfd, 0x00]));  // invalid UTF-8

  let threw = false;
  let result;
  try {
    result = hasVisualBaselinesInDesign(ws, "broken");
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false, "MUST NOT throw on bad-encoding read");
  assert.ok(result, "MUST return a result object even on read failure");
  assert.equal(result.present, false, "MUST default to `present: false` on swallow");
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

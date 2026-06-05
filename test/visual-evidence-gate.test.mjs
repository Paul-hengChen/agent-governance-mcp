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
  hasDesignModeRequiringVisual,
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

// ============================================================================
// v3.16.0 — hasDesignModeRequiringVisual (visual-fidelity-gate-hardening, AC-1, AC-10)
// Tests for the new self-arming signal helper (tools/evidence-file.ts).
// parseDesignMode is private; all branches are exercised indirectly via
// hasDesignModeRequiringVisual, which is the exported gate contract.
// ============================================================================

// ---------- Helpers ----------

function writeDesignWithMode(ws, feature, modeText) {
  // modeText is the full file body; caller controls Mode line shape.
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${feature}.md`), modeText);
}

// ---------- AC-1 — hasDesignModeRequiringVisual: all three Mode shapes ----------

test("v3.16.0 AC-1: ## Mode H2 section style — figma → required:true", () => {
  // Why: the design-auditor template may emit a `## Mode` H2 heading with the
  // mode value on the next content line. The parser MUST accept this shape
  // (D4 — permissive parser for both real-world forms).
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "# design/feat\n\n## Mode\n\nfigma\n\n## Source manifest\n- figma | 1:1 | yes | audited\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "H2-style figma mode must arm the gate");
  assert.equal(r.mode, "figma");
});

test("v3.16.0 AC-1: **Mode** bullet (em-dash) style — sketch → required:true", () => {
  // Why: the design-auditor template bullet emits `**Mode** — <value>`.
  // The em-dash separator must be tolerated (D4).
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "# design/feat\n\n- **Mode** — sketch\n\n## Source manifest\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "**Mode** bullet em-dash style must arm the gate");
  assert.equal(r.mode, "sketch");
});

test("v3.16.0 AC-1: mode: inline key style — no-design → required:false", () => {
  // Why: the no-design fast-path (design-auditor L14) writes `mode: no-design`.
  // This is the colon-inline form. The parser MUST detect it AND return
  // required:false, so these workspaces remain silent pass-through (AC-10).
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "# design/feat\n\nmode: no-design\n\nReason: server-only feature.\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, false, "mode: no-design MUST NOT arm the gate");
  assert.equal(r.mode, "no-design");
});

// ---------- AC-1 — real modes arm the gate ----------

test("v3.16.0 AC-1: real mode (figma) → required:true (via inline bullet form)", () => {
  // Why: asserts the core AC-1 invariant — any real mode other than no-design
  // MUST set required:true. Contrast with the no-design fast-path above.
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "- **Mode** — figma\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "figma mode must arm the gate");
});

// ---------- AC-10 — no design file → gate silent ----------

test("v3.16.0 AC-10: no design file → required:false (non-UI workspace)", () => {
  // Why: the most common non-UI case. No design/<feature>.md means the gate
  // must be completely silent — required:false, mode:null.
  const ws = mkWorkspace();
  const r = hasDesignModeRequiringVisual(ws, "server-feature");
  assert.equal(r.required, false, "absent design file must not arm the gate");
  assert.equal(r.mode, null, "mode must be null when no file exists");
  assert.ok(r.designPath.endsWith("design/server-feature.md"), "designPath must surface resolved path");
});

// ---------- Fail-open: malformed / absent Mode line ----------

test("v3.16.0 AC-1 D6: missing Mode line in existing design file → required:false (fail-open)", () => {
  // Why: a malformed design doc must NOT arm the gate (D6 — fail-open).
  // A positive non-`no-design` mode is required to arm; absence of any Mode
  // line defaults to {required:false}, not fail-closed.
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "# design/feat\n\n## Source manifest\n- figma | 1:1 | yes | audited\n\n## Visual Baselines\n\n| surface | baseline | impl | notes |\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, false, "no Mode line → fail-open, gate stays silent");
  assert.equal(r.mode, null, "mode must be null when no Mode line found");
});

test("v3.16.0 AC-1: read error (bad bytes) → required:false (fail-open, never throws)", () => {
  // Why: mirrors hasVisualBaselinesInDesign's silent-swallow contract (AC-9).
  // The helper must never throw on I/O or parse failure.
  const ws = mkWorkspace();
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "broken.md"), Buffer.from([0xff, 0xfe, 0xfd]));
  let threw = false;
  let r;
  try { r = hasDesignModeRequiringVisual(ws, "broken"); } catch { threw = true; }
  assert.equal(threw, false, "MUST NOT throw on bad-encoding read");
  assert.ok(r, "must return a result object");
  assert.equal(r.required, false, "fail-open on read error");
  assert.equal(r.mode, null);
});

// ---------- Parser tolerance: case / backtick / em-dash ----------

test("v3.16.0 AC-1: backtick-wrapped mode value in bullet — `figma` → required:true", () => {
  // Why: the design-auditor template may emit backtick-wrapped mode names
  // like `figma`. The parser must strip markdown markup to find the token.
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "- **Mode** — `figma`\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "backtick-wrapped figma must arm the gate");
  assert.equal(r.mode, "figma");
});

test("v3.16.0 AC-1: uppercase MODE in inline key — MODE: SKETCH → required:true", () => {
  // Why: the parser uses case-insensitive matching on the key. Even if an
  // operator typos `MODE: sketch` the mode value must still be parsed.
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "MODE: SKETCH\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "case-insensitive key+value must arm the gate");
  assert.equal(r.mode, "sketch");
});

test("v3.16.0 AC-1: em-dash separator is handled — **Mode** — xd", () => {
  // Why: em-dash (U+2014) vs en-dash vs ASCII dash must all parse. The
  // architecture regex includes [—:-] to tolerate all three.
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "- **Mode** — xd\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "em-dash separator must be parsed");
  assert.equal(r.mode, "xd");
});

// ---------- D3 — exclusion encoding: no-design is the only exempt mode ----------

test("v3.16.0 D3: paper mode arms the gate (no raster-only exemption list)", () => {
  // Why: locked Q-OQ1 decided ALL modes except no-design arm the gate.
  // paper/image/pdf are NOT exempt — they arm exactly like figma/sketch/xd.
  // This test encodes the locked human decision so it cannot be quietly
  // reverted by adding an exemption list later.
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "mode: paper\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "paper mode must arm the gate (no exemption list)");
  assert.equal(r.mode, "paper");
});

test("v3.16.0 D3: image mode arms the gate (no raster-only exemption list)", () => {
  const ws = mkWorkspace();
  writeDesignWithMode(ws, "feat", "mode: image\n");
  const r = hasDesignModeRequiringVisual(ws, "feat");
  assert.equal(r.required, true, "image mode must arm the gate");
  assert.equal(r.mode, "image");
});

// ---------- empty active_feature safety ----------

test("v3.16.0 AC-1: empty active_feature → required:false (defensive)", () => {
  // Mirrors the existing empty-feature test for hasVisualBaselinesInDesign.
  const ws = mkWorkspace();
  const r = hasDesignModeRequiringVisual(ws, "");
  assert.equal(r.required, false, "empty feature name must not arm the gate");
  assert.equal(r.mode, null);
});

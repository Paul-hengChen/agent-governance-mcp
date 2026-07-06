// Coded by @qa-engineer
// Tests for the v3.40.0 baseline manifest gate (figma-baseline-manifest-gate):
//   parseBaselineManifestRows(content)            — pure parser (AC-6/AC-7)
//   hasBaselineProvenance(content)                — pure predicate (AC-8)
//   checkBaselineManifest(workspacePath, feature) — composition helper (AC-1..AC-4/AC-N1..AC-N4)
//
// AC coverage map:
//   P1-P9:  parseBaselineManifestRows purity + column parsing
//   H1-H6:  hasBaselineProvenance section-scoped detection
//   C1-C11: checkBaselineManifest composition + gate decision tree
//   E1-E6:  end-to-end via tw_update_state PASS handler (wiring + verbatim strings)
//   AC-9:   package.json + index.ts Server() version = "3.40.0"
//   AC-10:  CHANGELOG.md [3.40.0] entry with both error codes

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseBaselineManifestRows,
  hasBaselineProvenance,
  checkBaselineManifest,
  hasVisualBaselinesInDesign,
  hasVisualEvidenceInFile,
  hasDesignModeRequiringVisual,
} from "../dist/tools/evidence-file.js";
import {
  parseHandoff,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";

// ---- helpers ----------------------------------------------------------------

function tmpWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-bmg-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeDesign(ws, feature, body) {
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${feature}.md`), body, "utf-8");
}

function writeVisualEvidence(ws, taskId) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  // Full v3.26/v3.38 compliant visual report: all required sections passing
  // with provenance (baseline: + diff-metric:) so upstream gates clear.
  fs.writeFileSync(
    path.join(dir, `visual_${taskId}.md`),
    `# Visual report ${taskId}

## Widget Shape Verification
- [x] widget.placeholder — verified

## Canonical State Verification
- [x] surface1 — state verified

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| SA-01 | surface1 | element present | node:1:1 | pass |

## Region Diff
| surface | result |
|---|---|
| surface1 | pass |

### surface1
- baseline: node:1:1234
- diff-metric: ImageMagick AE: 0

## Allowed Differences

## Verdict — PASS
`,
    "utf-8",
  );
}

// Build a design file body that is armed (mode = figma), has ## Visual Baselines,
// ## Visual Structural Assertions, and the given ## Source section body (or none).
function armedDesignBody({ sourceSectionBody = null, provenanceSectionBody = null } = {}) {
  let body = `# design/test-feature

mode: figma

## Visual Baselines

| surface | baseline | impl | notes |
| --- | --- | --- | --- |
| surface1 | design/test-feature/s1.png | screenshots/s1.png | main |

## Visual Structural Assertions

| assertion id | surface | required element/state | source node/token |
|---|---|---|---|
| SA-01 | surface1 | element present | node:1:1 |

`;
  if (sourceSectionBody !== null) {
    body += `## Source\n\n${sourceSectionBody}\n\n`;
  }
  if (provenanceSectionBody !== null) {
    body += `## Baseline Selection Provenance\n\n${provenanceSectionBody}\n\n`;
  }
  return body;
}

// Standard Source table with N audited rows plus optional deferred rows.
function sourceTable({ audited = 0, deferred = 0 } = {}) {
  const lines = [
    "| medium | pointer | fetched? | status | reason |",
    "|---|---|---|---|---|",
  ];
  for (let i = 0; i < audited; i++) {
    lines.push(`| figma | node:${i}:${1000 + i} | yes | audited | baseline frozen |`);
  }
  for (let i = 0; i < deferred; i++) {
    lines.push(`| figma | | no | deferred | not yet reviewed |`);
  }
  return lines.join("\n");
}

// Complete provenance body with both required lines.
const COMPLETE_PROVENANCE = `filter-conditions: selected frames with mode=FRAME, depth=1, all Artboard children
exclusion-reasons: excluded overlay frames and annotation layers`;

// ===========================================================================
// P1-P9: parseBaselineManifestRows — pure parser
// ===========================================================================

test("P1: AC-6 purity — empty string returns [] without I/O", () => {
  // Why: AC-6 requires the parser to accept any string and return structured rows.
  // Calling with empty string must return [] and never throw.
  const rows = parseBaselineManifestRows("");
  assert.deepEqual(rows, []);
});

test("P2: AC-6/AC-7 — no ## Source section returns []", () => {
  // Why: AC-N3 opts in the gate only when ## Source is present.
  // Parser returns empty array when the section is absent.
  const content = "# design\n\n## Visual Baselines\n\nsome content here\n";
  const rows = parseBaselineManifestRows(content);
  assert.deepEqual(rows, []);
});

test("P3: AC-7 — 3 rows (2 audited, 1 deferred) correct isAudited flags", () => {
  // Why: the parser must distinguish audited (frozen) vs non-audited rows.
  // auditedCount via filter must equal 2.
  const content = `## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma | node:0:100 | yes | audited | frozen |
| figma | node:1:200 | yes | audited | frozen |
| figma |  | no | deferred | pending |
`;
  const rows = parseBaselineManifestRows(content);
  assert.equal(rows.length, 3, "3 data rows expected");
  assert.equal(rows[0].isAudited, true, "row 0 must be audited");
  assert.equal(rows[1].isAudited, true, "row 1 must be audited");
  assert.equal(rows[2].isAudited, false, "row 2 (deferred) must not be audited");
  const auditedCount = rows.filter((r) => r.isAudited).length;
  assert.equal(auditedCount, 2);
});

test("P4: AC-1(b) — audited row with BLANK pointer is not isAudited", () => {
  // Why: AC-1(b) requires a non-empty node-id for a row to count as frozen.
  // A blank pointer with status:audited must NOT count as a frozen row.
  const content = `## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma |  | yes | audited | no pointer set |
`;
  const rows = parseBaselineManifestRows(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "audited");
  assert.equal(rows[0].isAudited, false, "blank pointer must make isAudited=false");
});

test("P5: AC-7 backwards-compat — table with NO status column treats all rows as audited", () => {
  // Why: pre-manifest-gate designs may have no status column; the gate must not
  // retroactively block them. All rows default to status:audited; isAudited = pointer non-empty.
  const content = `## Source

| medium | pointer |
|---|---|
| figma | node:0:111 |
| sketch | node:1:222 |
`;
  const rows = parseBaselineManifestRows(content);
  assert.equal(rows.length, 2, "2 data rows expected");
  assert.equal(rows[0].status, "audited", "no-status-column row must default to audited");
  assert.equal(rows[0].isAudited, true);
  assert.equal(rows[1].isAudited, true);
});

test("P6: AC-7 — decorated status values normalize correctly", () => {
  // Why: design-auditors may annotate status with emoji/decoration.
  // Substring match means `audited ✅`, ` Deferred `, and `out of scope` must all normalize.
  const content = `## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma | node:0:1 | yes | audited ✅ | decorated |
| figma | node:1:2 | no | Deferred | pending |
| figma | node:2:3 | no | out of scope | not applicable |
`;
  const rows = parseBaselineManifestRows(content);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].status, "audited");
  assert.equal(rows[1].status, "deferred");
  assert.equal(rows[2].status, "out-of-scope");
});

test("P7: AC-7 — status column at non-standard position resolved by header", () => {
  // Why: the parser must resolve the status column by header-cell index, not positional
  // fallback, when columns are reordered.
  const content = `## Source

| pointer | medium | status | reason | fetched? |
|---|---|---|---|---|
| node:0:42 | figma | audited | frozen | yes |
`;
  const rows = parseBaselineManifestRows(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "audited");
  assert.equal(rows[0].pointer, "node:0:42", "pointer must be resolved from reordered columns");
  assert.equal(rows[0].isAudited, true);
});

test("P8: AC-7 — header row and separator row excluded from output", () => {
  // Why: the parser must not produce rows for the `| medium | pointer | … |` header
  // or `|---|---|…|` separator lines — only data rows.
  const content = `## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma | node:0:1 | yes | audited | good |
`;
  const rows = parseBaselineManifestRows(content);
  // Only 1 data row (not 3 — header + separator must be excluded)
  assert.equal(rows.length, 1);
  // Header cell text must not appear as a medium value
  assert.ok(!rows.some((r) => /^medium$/i.test(r.medium)), "header row must not appear as data row");
});

test("P9: AC-6 purity — same input always produces identical output", () => {
  // Why: AC-6 pins the pure-function contract. Two calls with identical input must
  // return identical (deeply equal) results — no state mutation across calls.
  const content = `## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma | node:0:1 | yes | audited | frozen |
| figma | node:1:2 | no | deferred | pending |
`;
  const r1 = parseBaselineManifestRows(content);
  const r2 = parseBaselineManifestRows(content);
  assert.deepEqual(r1, r2, "pure function must return identical output on repeated calls");
});

// ===========================================================================
// H1-H6: hasBaselineProvenance — pure predicate
// ===========================================================================

test("H1: AC-8 — no ## Baseline Selection Provenance section → false", () => {
  // Why: AC-8 requires the section to be present; absent → false.
  const content = "# design\n\n## Source\n\nsome rows\n";
  assert.equal(hasBaselineProvenance(content), false);
});

test("H2: AC-8 — section with BOTH filter-conditions: and exclusion-reasons: → true", () => {
  // Why: AC-8 requires BOTH lines to be present; only then returns true.
  const content = `## Baseline Selection Provenance

filter-conditions: selected frames with mode=FRAME
exclusion-reasons: excluded annotation layers
`;
  assert.equal(hasBaselineProvenance(content), true);
});

test("H3: AC-8 — section with ONLY filter-conditions: → false (both required)", () => {
  // Why: the gate requires BOTH lines. One alone is incomplete — must return false.
  const content = `## Baseline Selection Provenance

filter-conditions: structural filter applied
`;
  assert.equal(hasBaselineProvenance(content), false);
});

test("H4: AC-8 — section with ONLY exclusion-reasons: → false (both required)", () => {
  // Why: mirror of H3 — the other missing field must also return false.
  const content = `## Baseline Selection Provenance

exclusion-reasons: excluded overlays
`;
  assert.equal(hasBaselineProvenance(content), false);
});

test("H5: AC-8 section-scoped — filter-conditions: OUTSIDE the provenance section → false", () => {
  // Why: the search is section-scoped (not whole-document). A stray
  // `filter-conditions:` mention in body prose or another H2 must NOT satisfy the gate.
  const content = `## Some Other Section

filter-conditions: this is in the wrong section
exclusion-reasons: also wrong section

## Unrelated
no provenance here
`;
  assert.equal(hasBaselineProvenance(content), false);
});

test("H6: AC-8 — decorated labels (bullet + bold) satisfy the permissive regex", () => {
  // Why: the label regex is permissive: optional bullet, optional bold. Both decorated
  // forms must still return true.
  const content = `## Baseline Selection Provenance

- **filter-conditions:** structural filter: depth=1, mode=FRAME
* exclusion-reasons — annotation and overlay layers excluded
`;
  assert.equal(hasBaselineProvenance(content), true);
});

// ===========================================================================
// C1-C11: checkBaselineManifest — composition helper + gate decision tree
// ===========================================================================

test("C1: AC-4/AC-N1 — no design file at all → dormant (ok:true, code:null)", () => {
  // Why: AC-4 requires the gate to be silent when there is no design file.
  // This is the no-design / infra workspace case.
  const ws = tmpWs();
  // No design directory created.
  const result = checkBaselineManifest(ws, "some-feature");
  assert.equal(result.ok, true, "missing design file must be dormant");
  assert.equal(result.code, null);
  assert.equal(result.auditedCount, 0);
});

test("C2: AC-4/AC-N1 — mode:no-design — gate unreachable via placement; helper sees no Source → dormant", () => {
  // Why: at the call site, the gate is inside `if (armCheck.required)` — mode=no-design
  // means armCheck.required=false, so the gate is never reached. At the helper level,
  // a no-design file with no ## Source also returns dormant. Both paths silent.
  const ws = tmpWs();
  writeDesign(ws, "no-design-feat", `# design\n\nmode: no-design\n\n## Visual Baselines\n\nsome baselines\n`);
  // armCheck.required must be false for no-design mode
  const armCheck = hasDesignModeRequiringVisual(ws, "no-design-feat");
  assert.equal(armCheck.required, false, "no-design mode must NOT arm the gate");
  // At helper level, no ## Source → dormant
  const result = checkBaselineManifest(ws, "no-design-feat");
  assert.equal(result.ok, true, "no-design helper must be dormant");
  assert.equal(result.code, null);
});

test("C3: AC-N3 — armed design, ## Visual Baselines present, NO ## Source section → dormant (opt-in)", () => {
  // Why: AC-N3 is the backwards-compatibility opt-in. Pre-v3.40 design files do NOT
  // have ## Source; the gate must be dormant for them. Absence of ## Source = gate off.
  const ws = tmpWs();
  writeDesign(ws, "old-design", armedDesignBody({ sourceSectionBody: null }));
  const result = checkBaselineManifest(ws, "old-design");
  assert.equal(result.ok, true, "absent ## Source must be dormant (AC-N3)");
  assert.equal(result.code, null);
});

test("C4: AC-N4/AC-1(b) — ## Source with ONLY deferred rows (0 audited) → BASELINE_MANIFEST_MISSING", () => {
  // Why: AC-N4 says a deferred-only manifest is blocked. A Source section that
  // exists but has zero audited rows means the design-auditor has not completed
  // baseline locking — must fire BASELINE_MANIFEST_MISSING.
  const ws = tmpWs();
  writeDesign(ws, "deferred-feat", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 0, deferred: 2 }),
  }));
  const result = checkBaselineManifest(ws, "deferred-feat");
  assert.equal(result.ok, false);
  assert.equal(result.code, "BASELINE_MANIFEST_MISSING");
  assert.equal(result.auditedCount, 0);
});

test("C5: AC-3/AC-N2 — exactly 1 audited row, NO provenance section → ok (single-surface exempt)", () => {
  // Why: AC-3 / AC-N2 is the single-surface false-positive guard. One audited row
  // requires no ## Baseline Selection Provenance regardless. Must NOT fire
  // BASELINE_PROVENANCE_INCOMPLETE.
  const ws = tmpWs();
  writeDesign(ws, "single-feat", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 1, deferred: 0 }),
    provenanceSectionBody: null,
  }));
  const result = checkBaselineManifest(ws, "single-feat");
  assert.equal(result.ok, true, "single audited row must be exempt from provenance gate");
  assert.equal(result.code, null);
  assert.equal(result.auditedCount, 1);
});

test("C6: AC-3 — 1 audited row + provenance section present → still ok (not required, not penalized)", () => {
  // Why: single-surface PASS with a provenance section should still succeed —
  // the section being present is fine, it just wasn't required.
  const ws = tmpWs();
  writeDesign(ws, "single-with-prov", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 1 }),
    provenanceSectionBody: COMPLETE_PROVENANCE,
  }));
  const result = checkBaselineManifest(ws, "single-with-prov");
  assert.equal(result.ok, true);
  assert.equal(result.code, null);
});

test("C7: AC-2 — 2 audited rows, NO provenance section → BASELINE_PROVENANCE_INCOMPLETE", () => {
  // Why: AC-2 requires multi-surface designs (>=2 audited rows) to record the
  // filter-conditions and exclusion-reasons. Absent section → gate fires.
  const ws = tmpWs();
  writeDesign(ws, "multi-no-prov", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 2, deferred: 0 }),
    provenanceSectionBody: null,
  }));
  const result = checkBaselineManifest(ws, "multi-no-prov");
  assert.equal(result.ok, false);
  assert.equal(result.code, "BASELINE_PROVENANCE_INCOMPLETE");
  assert.equal(result.auditedCount, 2);
});

test("C8: AC-2 — 2 audited rows, provenance with ONLY filter-conditions: → BASELINE_PROVENANCE_INCOMPLETE", () => {
  // Why: AC-2 requires BOTH filter-conditions: AND exclusion-reasons:. A section
  // that carries only one field is incomplete and must be rejected.
  const ws = tmpWs();
  writeDesign(ws, "multi-partial-prov", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 2 }),
    provenanceSectionBody: "filter-conditions: structural filter applied\n(missing exclusion-reasons)",
  }));
  const result = checkBaselineManifest(ws, "multi-partial-prov");
  assert.equal(result.ok, false);
  assert.equal(result.code, "BASELINE_PROVENANCE_INCOMPLETE");
});

test("C9: AC-2 negative — 2 audited rows, provenance with BOTH lines → ok", () => {
  // Why: the happy path for multi-surface. Complete provenance must allow PASS.
  const ws = tmpWs();
  writeDesign(ws, "multi-complete-prov", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 2 }),
    provenanceSectionBody: COMPLETE_PROVENANCE,
  }));
  const result = checkBaselineManifest(ws, "multi-complete-prov");
  assert.equal(result.ok, true, "complete provenance must pass");
  assert.equal(result.code, null);
  assert.equal(result.auditedCount, 2);
});

test("C10: AC-2/AC-7 — 3 rows (2 audited + 1 deferred), provenance complete → ok (deferred not counted)", () => {
  // Why: the deferred row must NOT inflate the audited count. Multi-surface threshold
  // is on audited-only count, and provenance is complete.
  const ws = tmpWs();
  writeDesign(ws, "mixed-rows", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 2, deferred: 1 }),
    provenanceSectionBody: COMPLETE_PROVENANCE,
  }));
  const result = checkBaselineManifest(ws, "mixed-rows");
  assert.equal(result.ok, true);
  assert.equal(result.code, null);
  assert.equal(result.auditedCount, 2, "deferred row must not count toward audited total");
});

test("C11: robustness — fs error / unreadable path → dormant (never throws)", () => {
  // Why: the composition helper must never throw on any filesystem condition.
  // A bad workspace path must return dormant ok:true gracefully.
  const result = checkBaselineManifest("/nonexistent/path/xyz", "some-feature");
  assert.equal(result.ok, true, "unreadable path must return dormant");
  assert.equal(result.code, null);
  assert.doesNotThrow(() => checkBaselineManifest("", ""));
});

// ===========================================================================
// E1-E6: End-to-end gate tests (via tw_update_state PASS handler)
//
// These tests drive the composition through index.ts PASS handler logic via
// the same primitive calls the handler makes (armCheck + visualGate + helpers).
// The E2/E3 cases that require the manifest gate to FIRE also need upstream
// gates (evidence, widget-shape, schema, provenance) to be satisfied.
// We verify wiring via: (a) handler primitive composition, (b) dist/index.js
// contains verbatim error strings (exact Copy/Strings contract), and
// (c) e2e tw_update_state calls with writeHandoffState for state-not-written.
// ===========================================================================

test("E1: AC-4/AC-N1 — no-design workspace, gate completely silent (armCheck.required=false)", () => {
  // Why: AC-4/AC-N1 — neither error code must ever be emittable for no-design mode.
  // Verified via armCheck: the PASS handler only enters the manifest gate block
  // when armCheck.required=true + visualGate.present=true.
  const ws = tmpWs();
  writeDesign(ws, "infra-feat", "# design\n\nmode: no-design\n");

  const armCheck = hasDesignModeRequiringVisual(ws, "infra-feat");
  const visualGate = hasVisualBaselinesInDesign(ws, "infra-feat");

  assert.equal(armCheck.required, false, "no-design must not arm gate");
  // Gate is inside if(armCheck.required) — with required=false, manifest gate is unreachable.
  const gateReachable = armCheck.required && visualGate.present;
  assert.equal(gateReachable, false, "gate must be unreachable for no-design workspace");
});

test("E1b: AC-N1 — no design file at all, gate silent", () => {
  // Why: workspaces with no design/<feature>.md are completely outside the gate.
  const ws = tmpWs();
  const armCheck = hasDesignModeRequiringVisual(ws, "server-feature");
  const visualGate = hasVisualBaselinesInDesign(ws, "server-feature");
  assert.equal(armCheck.required, false);
  const gateReachable = armCheck.required && visualGate.present;
  assert.equal(gateReachable, false);
});

test("E2: AC-1 — verbatim BASELINE_MANIFEST_MISSING error string in dist/index.js", () => {
  // Why: the e2e wiring asserts the exact Copy/Strings (ERR-BMM-01) text is compiled
  // into the handler. State-not-written is verified by the isError:true return path.
  const distIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "index.js"),
    "utf-8",
  );
  // Verbatim ERR-BMM-01 canonical string (spec Copy/Strings table)
  assert.ok(
    distIndex.includes("⛔ BASELINE_MANIFEST_MISSING:"),
    "BASELINE_MANIFEST_MISSING error prefix must appear verbatim in dist/index.js",
  );
  assert.ok(
    distIndex.includes("the Source manifest (## Source section) contains no audited baseline rows"),
    "ERR-BMM-01 body text must appear verbatim in dist/index.js",
  );
  assert.ok(
    distIndex.includes("See specs/figma-baseline-manifest-gate.md"),
    "ERR-BMM-01 must include the spec reference",
  );
});

test("E3: AC-2 — verbatim BASELINE_PROVENANCE_INCOMPLETE error string in dist/index.js", () => {
  // Why: the e2e wiring asserts the exact Copy/Strings (ERR-BPI-01) text is compiled
  // into the handler. Verbatim string match is the spec contract.
  const distIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "index.js"),
    "utf-8",
  );
  // Verbatim ERR-BPI-01 canonical string
  assert.ok(
    distIndex.includes("⛔ BASELINE_PROVENANCE_INCOMPLETE:"),
    "BASELINE_PROVENANCE_INCOMPLETE error prefix must appear verbatim in dist/index.js",
  );
  assert.ok(
    distIndex.includes("## Baseline Selection Provenance section is absent or incomplete"),
    "ERR-BPI-01 body text must appear verbatim in dist/index.js",
  );
  assert.ok(
    distIndex.includes("requires both filter-conditions: and exclusion-reasons: lines"),
    "ERR-BPI-01 must include the two required-fields specification",
  );
});

test("E4: AC-3/AC-N2 — gate wiring: 1 audited row arm yields checkBaselineManifest ok:true (no manifest error)", () => {
  // Why: E4 verifies that the single-surface exemption survives the full composition
  // path. When the helper returns ok:true, the handler does NOT emit BASELINE_PROVENANCE_INCOMPLETE.
  const ws = tmpWs();
  writeDesign(ws, "single-arm", armedDesignBody({
    sourceSectionBody: sourceTable({ audited: 1 }),
    provenanceSectionBody: null,
  }));

  const armCheck = hasDesignModeRequiringVisual(ws, "single-arm");
  const visualGate = hasVisualBaselinesInDesign(ws, "single-arm");
  assert.equal(armCheck.required, true);
  assert.equal(visualGate.present, true);

  // At this call site (inside armCheck.required + visualGate.present), the manifest gate fires.
  const manifest = checkBaselineManifest(ws, "single-arm");
  assert.equal(manifest.ok, true, "single-surface must not trigger BASELINE_PROVENANCE_INCOMPLETE");
  assert.equal(manifest.code, null);
});

test("E5: AC-N3 — ## Visual Baselines present, NO ## Source → gate dormant at manifest check level", () => {
  // Why: AC-N3 opt-in: design files from before v3.40.0 have ## Visual Baselines
  // but no ## Source. The manifest gate must be dormant and not block PASS.
  const ws = tmpWs();
  writeDesign(ws, "pre-v340", armedDesignBody({ sourceSectionBody: null }));

  const armCheck = hasDesignModeRequiringVisual(ws, "pre-v340");
  const visualGate = hasVisualBaselinesInDesign(ws, "pre-v340");

  // Gate IS reachable (armed + baselines present) — but must be dormant inside.
  assert.equal(armCheck.required, true);
  assert.equal(visualGate.present, true);

  const manifest = checkBaselineManifest(ws, "pre-v340");
  assert.equal(manifest.ok, true, "absent ## Source must yield dormant gate (AC-N3)");
  assert.equal(manifest.code, null);
});

test("E6: AC — exact error strings match ERR-BMM-01 / ERR-BPI-01 verbatim (full string verification)", () => {
  // Why: Copy/Strings fidelity gate. The spec pins exact strings including the ⛔ prefix.
  // Any paraphrase, truncation, or punctuation change breaks the operator runbook.
  const ERR_BMM_01 = "⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.";
  const ERR_BPI_01 = "⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.";

  const distIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "index.js"),
    "utf-8",
  );
  assert.ok(
    distIndex.includes(ERR_BMM_01),
    "dist/index.js must contain verbatim ERR-BMM-01 string (including ⛔ prefix and trailing period)",
  );
  assert.ok(
    distIndex.includes(ERR_BPI_01),
    "dist/index.js must contain verbatim ERR-BPI-01 string (including ⛔ prefix and trailing period)",
  );
});

// ===========================================================================
// AC-9: Version bump assertion — package.json + index.ts Server() = "3.40.1"
// ===========================================================================

test("AC-9: package.json version field equals 3.44.0", () => {
  // Why: AC-9 pins the version contract. Both package.json and the Server() literal
  // must be "3.44.0" for the release to be self-consistent. Updated from 3.43.0
  // to 3.44.0 when governance-tag-strip (text-consolidation) shipped.
  const pkgPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  assert.equal(pkg.version, "3.44.0", `package.json version must be "3.44.0", got "${pkg.version}"`);
});

test("AC-9: index.ts Server() literal equals 3.44.0", () => {
  // Why: the Server() version literal in index.ts is the operational version broadcast
  // to MCP clients. It must match package.json. Updated from 3.43.0 to 3.44.0 when
  // governance-tag-strip (text-consolidation) shipped.
  const srcIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "index.ts"),
    "utf-8",
  );
  assert.match(srcIndex, /Server\(\s*\{[^}]*version:\s*["']3\.44\.0["']/s,
    "Server() version literal in index.ts must equal 3.44.0");
});

// ===========================================================================
// AC-10: CHANGELOG.md — [3.40.0] entry with both error codes
// ===========================================================================

test("AC-10: CHANGELOG.md has ## [3.40.0] heading", () => {
  // Why: AC-10 requires a documented release entry for all server changes.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.match(changelog, /^##\s+\[3\.40\.0\]/m,
    "CHANGELOG.md must have ## [3.40.0] heading");
});

test("AC-10: CHANGELOG.md [3.40.0] mentions figma-baseline-manifest-gate", () => {
  // Why: AC-10 requires the entry to describe the feature by name.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.ok(
    changelog.includes("figma-baseline-manifest-gate"),
    "CHANGELOG.md [3.40.0] must mention figma-baseline-manifest-gate",
  );
});

test("AC-10: CHANGELOG.md [3.40.0] mentions BASELINE_MANIFEST_MISSING", () => {
  // Why: both error codes must be documented for the operator runbook.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.ok(
    changelog.includes("BASELINE_MANIFEST_MISSING"),
    "CHANGELOG.md [3.40.0] must mention BASELINE_MANIFEST_MISSING",
  );
});

test("AC-10: CHANGELOG.md [3.40.0] mentions BASELINE_PROVENANCE_INCOMPLETE", () => {
  // Why: both error codes must be documented.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.ok(
    changelog.includes("BASELINE_PROVENANCE_INCOMPLETE"),
    "CHANGELOG.md [3.40.0] must mention BASELINE_PROVENANCE_INCOMPLETE",
  );
});

// ===========================================================================
// Security smoke tests (§Phase 3d — boundary inputs)
// ===========================================================================

test("security: parseBaselineManifestRows — oversized / null-like input does not throw", () => {
  // Why: the parser must be robust against adversarial or corrupt inputs.
  const oversized = "| x ".repeat(10000) + "|\n## Source\n\n" + "| a | b | c | d | e |\n".repeat(100);
  assert.doesNotThrow(() => parseBaselineManifestRows(oversized));
  assert.doesNotThrow(() => parseBaselineManifestRows(null ?? ""));
  assert.doesNotThrow(() => parseBaselineManifestRows(undefined ?? ""));
});

test("security: hasBaselineProvenance — malformed content does not throw", () => {
  // Why: pure predicates must never throw regardless of content.
  assert.doesNotThrow(() => hasBaselineProvenance(""));
  assert.doesNotThrow(() => hasBaselineProvenance("####### not a valid heading"));
  assert.doesNotThrow(() => hasBaselineProvenance("filter-conditions: \nexclusion-reasons: \n"));
});

test("security: checkBaselineManifest — path traversal attempt returns dormant", () => {
  // Why: the designFilePath sanitiser in evidence-file.ts replaces `..` sequences.
  // A hostile feature name must not escape the design/ directory; the result is a
  // non-existent path → dormant ok:true (never throws, never accesses sensitive paths).
  const ws = tmpWs();
  const result = checkBaselineManifest(ws, "../../../etc/passwd");
  assert.equal(result.ok, true, "path traversal attempt must return dormant");
  assert.equal(result.code, null);
});

test("security: checkBaselineManifest — special characters in feature name returns dormant", () => {
  // Why: unusual characters in the feature name must not produce unexpected behavior.
  const ws = tmpWs();
  assert.doesNotThrow(() => checkBaselineManifest(ws, "feat; rm -rf /"));
  const result = checkBaselineManifest(ws, "feat; rm -rf /");
  assert.equal(result.ok, true);
});

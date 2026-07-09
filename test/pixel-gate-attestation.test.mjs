// Coded by @qa-engineer
// Tests for the v3.42.0 pixel-gate attestation feature (qa-visual-pixel-gate-attestation):
//   isPlaceholderDiffMetric(value)                    — pure predicate (AC-1/AC-10)
//   parsePixelGateAttestation(body)                   — pure predicate (AC-3/AC-10)
//   parseVisualProvenanceRows(content)                — pure parser (pixelGateComplete field added)
//   checkPixelGateAttestation(workspacePath, taskIds) — fs composition helper (AC-2/AC-4/AC-5/AC-7/AC-8)
//   dist/index.js verbatim error strings              — Copy/Strings gate (AC-9)
//
// AC coverage map (cross-referenced to specs/qa-visual-pixel-gate-attestation.md):
//   PD1-PD11: isPlaceholderDiffMetric — placeholder set members, null, whitespace/case variants, non-placeholder
//   PA1-PA8:  parsePixelGateAttestation — attestation detection, AC-3 label-line variants, edge cases
//   PR1-PR4:  parseVisualProvenanceRows — pixelGateComplete field correctly populated
//   CK1-CK10: checkPixelGateAttestation — composition helper + gate decision tree
//   E1-E5:    dist/index.js verbatim error strings (PIXEL_GATE_ATTESTATION_MISSING, VISUAL_PROVENANCE_MISSING.placeholder)
//   AC-4:     carry-forward surfaces exempt from attestation
//   AC-5:     B1-LLM-fallback surface must still carry pixel_gate_complete: true (NOT exempt)
//   AC-7:     non-armed / no-design workspace — gate dormant
//   AC-8:     legacy pre-provenance report (no baseline:) — gate dormant

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  isPlaceholderDiffMetric,
  parsePixelGateAttestation,
  parseVisualProvenanceRows,
  checkPixelGateAttestation,
  checkVisualProvenance,
  hasDesignModeRequiringVisual,
  hasVisualBaselinesInDesign,
} from "../dist/gates/visual.js";

// ---- helpers ----------------------------------------------------------------

function tmpWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-pga-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeVisualReport(ws, taskId, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `visual_${taskId}.md`), body, "utf-8");
}

function writeDesign(ws, feature, body) {
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${feature}.md`), body, "utf-8");
}

// Minimal armed design file (mode=figma, has ## Visual Baselines).
const ARMED_DESIGN = `# design/test-feature

mode: figma

## Visual Baselines

| surface | baseline | impl | notes |
| --- | --- | --- | --- |
| surface1 | design/surface1.png | screenshots/s1.png | main |
`;

// A minimal visual report body with one surface that carries all provenance fields:
// baseline + a real diff-metric + pixel_gate_complete: true. Used as the "happy path".
function happyPathReport(surfaceId = "surface1") {
  return `# Visual report

## Widget Shape Verification
- [x] widget.placeholder — verified

## Canonical State Verification
- [x] ${surfaceId} — state verified

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| SA-01 | ${surfaceId} | element present | node:1:1 | pass |

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
- baseline: sha256:abc123
- diff-metric: 0.002
- pixel_gate_complete: true

## Allowed Differences

## Verdict — PASS
`;
}

// Report with a real baseline but missing pixel_gate_complete (triggers AC-2).
function reportMissingAttestation(surfaceId = "surface1") {
  return `# Visual report

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
- baseline: sha256:abc123
- diff-metric: 0.002

## Verdict — PASS
`;
}

// Report with the carry-forward token (exempt per AC-4).
function carryForwardReport(surfaceId = "surface1") {
  return `# Visual report

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
pass (carried forward — git diff confirms source untouched)

## Verdict — PASS
`;
}

// Report with B1-LLM-fallback token. Exempt from numeric diff-metric (AC-5)
// but STILL requires pixel_gate_complete: true.
function b1FallbackReportWithAttestation(surfaceId = "surface1") {
  return `# Visual report

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
- baseline: sha256:abc123
B1 tool unavailable — LLM fallback
- pixel_gate_complete: true

## Verdict — PASS
`;
}

function b1FallbackReportWithoutAttestation(surfaceId = "surface1") {
  return `# Visual report

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
- baseline: sha256:abc123
B1 tool unavailable — LLM fallback

## Verdict — PASS
`;
}

// Report with a placeholder diff-metric — triggers the VISUAL_PROVENANCE_MISSING gate (AC-1).
function reportWithPlaceholderMetric(metric, surfaceId = "surface1") {
  return `# Visual report

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
- baseline: sha256:abc123
- diff-metric: ${metric}
- pixel_gate_complete: true

## Verdict — PASS
`;
}

// Legacy pre-provenance report — no baseline: line at all (opt-in gate dormant per AC-8).
function legacyReport(surfaceId = "surface1") {
  return `# Visual report

## Region Diff
| surface | result |
|---|---|
| ${surfaceId} | pass |

### ${surfaceId}
(no baseline fingerprint — pre-v3.38 report)

## Verdict — PASS
`;
}

// ===========================================================================
// PD1-PD11: isPlaceholderDiffMetric — pure predicate (AC-1/AC-10)
//
// Contract: true when null, OR when normalized (trim+lower+collapse-spaces)
// value is in DIFF_METRIC_PLACEHOLDERS = {n/a, skipped, skip, dimensionsmatch=false,
// dimensions mismatch, todo, tbd, none, -, ""}.
// false when value is a real numeric string or a non-placeholder token.
// ===========================================================================

test("PD1: AC-1/AC-10 purity — null → true (absent counts as placeholder)", () => {
  // Why: a missing diff-metric: line yields null from the parser; the gate must
  // treat it as a placeholder (no pixel gate ran). Contract: null → true.
  assert.equal(isPlaceholderDiffMetric(null), true);
});

test("PD2: AC-1 — empty string → true (bare 'diff-metric:' with no value)", () => {
  // Why: "" is an explicit DIFF_METRIC_PLACEHOLDERS member so a bare label line
  // with no value is rejected by the same code path.
  assert.equal(isPlaceholderDiffMetric(""), true);
});

test("PD3: AC-1 — 'n/a' (exact, lowercase) → true", () => {
  assert.equal(isPlaceholderDiffMetric("n/a"), true);
});

test("PD4: AC-1 — 'N/A' (uppercase) → true (case-insensitive)", () => {
  // Why: normalization lowercases before set lookup.
  assert.equal(isPlaceholderDiffMetric("N/A"), true);
});

test("PD5: AC-1 — '  N/A  ' (padded whitespace) → true (trimmed)", () => {
  // Why: normalization trims before lowercasing and set lookup.
  assert.equal(isPlaceholderDiffMetric("  N/A  "), true);
});

test("PD6: AC-1 — 'skipped' → true", () => {
  assert.equal(isPlaceholderDiffMetric("skipped"), true);
});

test("PD7: AC-1 — 'skip' → true", () => {
  assert.equal(isPlaceholderDiffMetric("skip"), true);
});

test("PD8: AC-1 — 'dimensionsMatch=false' (comparator form) → true (normalized to dimensionsmatch=false)", () => {
  // Why: the comparator emits this mixed-case token. Normalization (lowercase) folds it
  // onto the "dimensionsmatch=false" set member. This is AC-6's mechanism.
  assert.equal(isPlaceholderDiffMetric("dimensionsMatch=false"), true);
});

test("PD9: AC-1 — 'dimensions mismatch' (human-prose variant) → true", () => {
  // Why: "dimensions mismatch" is the human-written prose variant of the comparator token.
  assert.equal(isPlaceholderDiffMetric("dimensions mismatch"), true);
});

test("PD10: AC-1 — each remaining placeholder member → true", () => {
  // Why: spec AC-1 enumerates the full placeholder set. All members must return true.
  // Tested in bulk to avoid repetition; individual tests above cover the tricky ones.
  const members = ["todo", "tbd", "none", "-"];
  for (const m of members) {
    assert.equal(isPlaceholderDiffMetric(m), true, `"${m}" must be a placeholder`);
    assert.equal(isPlaceholderDiffMetric(m.toUpperCase()), true, `"${m.toUpperCase()}" must be a placeholder (case-insensitive)`);
  }
});

test("PD11: AC-1 — real numeric / non-placeholder values → false", () => {
  // Why: the gate must NOT reject real diff-metrics emitted by tools. A false positive
  // here would make the happy path impossible to reach.
  const real = [
    "0",
    "0.0",
    "0.002",
    "1234",
    "ImageMagick AE: 0",
    "0 px",
    "B1 tool unavailable — LLM fallback",  // AC-5: NOT a placeholder
    "0.5%",
    "pass: 99.8% similar",
    "42 diff pixels",
  ];
  for (const v of real) {
    assert.equal(isPlaceholderDiffMetric(v), false, `"${v}" must NOT be a placeholder`);
  }
});

// ===========================================================================
// PA1-PA8: parsePixelGateAttestation — pure predicate (AC-3/AC-10)
//
// Contract: true iff the prose body contains a pixel_gate_complete: label-line
// whose value (emphasis-stripped, trimmed, lowercased) === "true".
// Uses the same permissive label-line regex as baseline: / diff-metric:.
// ===========================================================================

test("PA1: AC-3/AC-10 — empty string → false (no I/O, no throw)", () => {
  // Why: AC-10 requires the parser to be pure and never throw. Empty input → false.
  assert.equal(parsePixelGateAttestation(""), false);
  assert.doesNotThrow(() => parsePixelGateAttestation(""));
});

test("PA2: AC-3 — canonical form '- pixel_gate_complete: true' → true", () => {
  // Why: this is the canonical form documented in spec Copy/Strings as
  // pixel_gate_complete.attestation_line. Must be recognized.
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: true"), true);
});

test("PA3: AC-3 — 'pixel_gate_complete: true' (no bullet) → true", () => {
  // Why: the permissive regex makes the leading bullet optional. A bare label-line works.
  assert.equal(parsePixelGateAttestation("pixel_gate_complete: true"), true);
});

test("PA4: AC-3 — case-insensitive value: 'TRUE', 'True', 'TRUE  ' → true", () => {
  // Why: AC-3 says value normalizes (trim+lowercase) to "true". Mixed-case must match.
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: TRUE"), true);
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: True"), true);
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: TRUE  "), true);
});

test("PA5: AC-3 — bold decoration '**pixel_gate_complete:** true' → true", () => {
  // Why: AC-3 permits the same bold-label decoration as baseline: / diff-metric:.
  assert.equal(parsePixelGateAttestation("- **pixel_gate_complete:** true"), true);
});

test("PA6: AC-3 — '* pixel_gate_complete: true' (asterisk bullet) → true", () => {
  // Why: the permissive regex accepts both - and * bullets.
  assert.equal(parsePixelGateAttestation("* pixel_gate_complete: true"), true);
});

test("PA7: AC-3 — value 'false' → false (only exact 'true' satisfies)", () => {
  // Why: AC-3 says "Any value other than `true` MUST NOT satisfy AC-2."
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: false"), false);
});

test("PA8: AC-3 — absent line → false; non-'true' values → false", () => {
  // Why: the gate is a positive declaration. Missing or wrong-value lines must return false.
  assert.equal(parsePixelGateAttestation("- baseline: sha256:abc\n- diff-metric: 0"), false);
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: yes"), false);
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: 1"), false);
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: done"), false);
  assert.equal(parsePixelGateAttestation("- pixel_gate_complete: "), false);
});

// ===========================================================================
// PR1-PR4: parseVisualProvenanceRows — pixelGateComplete field (AC-3/AC-10)
//
// The parser now emits pixelGateComplete:boolean per row. Tests confirm the new
// field is correctly populated without breaking existing fields.
// ===========================================================================

test("PR1: AC-10 — pixelGateComplete:true when line present in surface body", () => {
  // Why: the new pixelGateComplete field must be set to true when the surface's
  // prose sub-section carries '- pixel_gate_complete: true'.
  const content = `## Region Diff
| surface | result |
|---|---|
| surface1 | pass |

### surface1
- baseline: sha256:abc
- diff-metric: 0.002
- pixel_gate_complete: true
`;
  const rows = parseVisualProvenanceRows(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].surfaceId, "surface1");
  assert.equal(rows[0].pixelGateComplete, true);
});

test("PR2: AC-10 — pixelGateComplete:false when line absent", () => {
  // Why: missing attestation line must yield pixelGateComplete:false so the
  // composition helper (checkPixelGateAttestation) can collect the offense.
  const content = `## Region Diff
| surface | result |
|---|---|
| surface1 | pass |

### surface1
- baseline: sha256:abc
- diff-metric: 0.002
`;
  const rows = parseVisualProvenanceRows(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pixelGateComplete, false);
});

test("PR3: AC-4 — carry-forward row has isCarryForward:true AND pixelGateComplete respected", () => {
  // Why: carry-forward rows are exempt from attestation (AC-4). The parser must
  // correctly set isCarryForward and pixelGateComplete independently so the gate
  // can apply the exemption without additional logic.
  const content = `## Region Diff
| surface | result |
|---|---|
| surface1 | pass |

### surface1
pass (carried forward — git diff confirms source untouched)
`;
  const rows = parseVisualProvenanceRows(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isCarryForward, true);
  // pixelGateComplete will be false (no attestation line); exemption is at gate level.
  assert.equal(rows[0].pixelGateComplete, false);
});

test("PR4: AC-5 — B1-fallback row has isFallback:true AND pixelGateComplete detected", () => {
  // Why: B1-fallback rows are NOT exempt from attestation (AC-5). The parser must
  // correctly set isFallback:true (for the provenance gate's exemption) and
  // pixelGateComplete:true if the attestation line is present (for the attestation gate).
  const content = `## Region Diff
| surface | result |
|---|---|
| surface1 | pass |

### surface1
- baseline: sha256:abc
B1 tool unavailable — LLM fallback
- pixel_gate_complete: true
`;
  const rows = parseVisualProvenanceRows(content);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isFallback, true);
  assert.equal(rows[0].pixelGateComplete, true);
});

// ===========================================================================
// CK1-CK10: checkPixelGateAttestation — composition helper + gate decision tree
// ===========================================================================

test("CK1: AC-8 — legacy pre-provenance report (no baseline:) → gate dormant (ok:true)", () => {
  // Why: AC-8 says the gate is opt-in. A report with no baseline: fingerprint anywhere
  // predates the provenance contract → the attestation gate must be dormant (not fire).
  // The opt-in arm is: "if no row has a non-null fingerprint → contribute zero offenses."
  const ws = tmpWs();
  writeVisualReport(ws, "T01", legacyReport("surface1"));
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, true, "legacy report (no baseline:) must not trigger the attestation gate");
  assert.deepEqual(result.offendingByTaskId, {});
});

test("CK2: AC-2 — report with baseline: but missing pixel_gate_complete: → ok:false, offense emitted", () => {
  // Why: AC-2 says a non-carry-forward surface missing pixel_gate_complete: true
  // must be rejected with PIXEL_GATE_ATTESTATION_MISSING. This is the core AC-2 case.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", reportMissingAttestation("checkout-panel"));
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, false, "missing attestation must cause gate failure");
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(Array.isArray(offenses) && offenses.length > 0, "offenses must be non-empty");
  assert.ok(
    offenses.some((o) => o.includes("checkout-panel")),
    `offense must name the offending surface: ${JSON.stringify(offenses)}`,
  );
});

test("CK3: AC-2 happy path — report with baseline: AND pixel_gate_complete: true → ok:true", () => {
  // Why: the happy path. A surface carrying all three provenance fields incl. attestation
  // must allow PASS through this gate.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", happyPathReport("surface1"));
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, true, "complete report must pass the attestation gate");
  assert.deepEqual(result.offendingByTaskId, {});
});

test("CK4: AC-4 — carry-forward surface without attestation → exempt (gate passes)", () => {
  // Why: AC-4 says carry-forward surfaces are exempt. The carry-forward token
  // ("pass (carried forward — git diff confirms source untouched)") is proof the
  // implementation was not retouched; no re-diff and no attestation needed.
  const ws = tmpWs();
  // Need at least one non-carry-forward surface with a real baseline to opt-in the gate,
  // then the carry-forward surface must be exempt.
  const report = `# Visual report

## Region Diff
| surface | result |
|---|---|
| main-panel | pass |
| legacy-widget | pass |

### main-panel
- baseline: sha256:abc123
- diff-metric: 0.001
- pixel_gate_complete: true

### legacy-widget
pass (carried forward — git diff confirms source untouched)
`;
  writeVisualReport(ws, "T01", report);
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, true, "carry-forward surface without attestation must be exempt (AC-4)");
  assert.deepEqual(result.offendingByTaskId, {});
});

test("CK5: AC-5 — B1-LLM-fallback surface WITHOUT pixel_gate_complete: true → gate FAILS (NOT exempt)", () => {
  // Why: AC-5 explicitly says the B1-LLM-fallback path is a valid execution of the
  // pixel gate, not a skip. The LLM comparison is still a pixel gate execution.
  // Therefore the surface is NOT exempt from pixel_gate_complete: true — unlike AC-4
  // carry-forward. This test verifies the AC-5 rule: isFallback does NOT short-circuit.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", b1FallbackReportWithoutAttestation("hero-banner"));
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, false, "B1-fallback surface without attestation must FAIL (NOT exempt — AC-5)");
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(
    offenses.some((o) => o.includes("hero-banner")),
    `B1-fallback offense must name the surface: ${JSON.stringify(offenses)}`,
  );
});

test("CK6: AC-5 — B1-LLM-fallback surface WITH pixel_gate_complete: true → gate PASSES", () => {
  // Why: when the B1-fallback surface carries the attestation, the LLM comparison was
  // completed and the attestation confirms it. Gate must pass.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", b1FallbackReportWithAttestation("hero-banner"));
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, true, "B1-fallback surface with attestation must pass (AC-5)");
  assert.deepEqual(result.offendingByTaskId, {});
});

test("CK7: AC-7 — no design file / no-design workspace: gate unreachable by placement", () => {
  // Why: AC-7 says the gate must be dormant for no-design workspaces.
  // The gate is inside `if (armCheck.required)` in index.ts, so it is never
  // reached when armCheck.required=false. Verify the arm signal correctly returns
  // false for a no-design / missing design file workspace.
  const ws = tmpWs();
  // No design/ directory at all → required:false.
  const armCheck = hasDesignModeRequiringVisual(ws, "some-feature");
  assert.equal(armCheck.required, false, "missing design file must not arm the gate (AC-7)");

  // Explicit no-design mode → required:false.
  writeDesign(ws, "infra-feature", "# design\n\nmode: no-design\n");
  const armCheck2 = hasDesignModeRequiringVisual(ws, "infra-feature");
  assert.equal(armCheck2.required, false, "mode:no-design must not arm the gate (AC-7)");

  // The composition helper itself (checkPixelGateAttestation) never receives armed calls
  // for these workspaces. Even if called directly, a missing visual report = dormant.
  const result = checkPixelGateAttestation(ws, ["T01"]);
  assert.equal(result.ok, true, "helper is dormant when no visual report exists");
});

test("CK8: AC-2 — multiple task ids, partial failure → offendingByTaskId contains only failing ids", () => {
  // Why: in a multi-task PASS, only the failing task ids must appear in offendingByTaskId.
  // Tasks with ok reports must not pollute the offense list.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", happyPathReport("surface1"));    // passes
  writeVisualReport(ws, "T02", reportMissingAttestation("surface2")); // fails
  const result = checkPixelGateAttestation(ws, ["T01", "T02"]);
  assert.equal(result.ok, false);
  assert.ok(!("T01" in result.offendingByTaskId), "T01 must not appear in offenses");
  assert.ok("T02" in result.offendingByTaskId, "T02 must appear in offenses");
});

test("CK9: AC-2 — missing visual report file → skipped (dormant, not blocked)", () => {
  // Why: checkPixelGateAttestation skips absent files (existence is enforced upstream
  // by hasVisualEvidenceInFile). A missing file must not cause a false-positive offense.
  const ws = tmpWs();
  // No visual report written for T99.
  const result = checkPixelGateAttestation(ws, ["T99"]);
  assert.equal(result.ok, true, "absent visual report must be skipped (not an offense)");
});

test("CK10: robustness — unreadable path → never throws, returns ok:true", () => {
  // Why: AC-10 says fs helpers must never throw. A bad workspace path must return ok:true.
  assert.doesNotThrow(() => checkPixelGateAttestation("/nonexistent/path/xyz", ["T01"]));
  const result = checkPixelGateAttestation("/nonexistent/path/xyz", ["T01"]);
  assert.equal(result.ok, true, "unreadable path must return dormant");
});

// ===========================================================================
// AC-1 / checkVisualProvenance — placeholder diff-metric triggers VISUAL_PROVENANCE_MISSING
//
// The provenance gate (checkVisualProvenance) was tightened in v3.42.0 to treat
// placeholder diff-metric values as absent. These tests verify the tightening.
// ===========================================================================

test("AC-1: placeholder diff-metric 'N/A' on armed surface → checkVisualProvenance rejects", () => {
  // Why: AC-1 says a placeholder diff-metric is treated as absent.
  // 'N/A' is a DIFF_METRIC_PLACEHOLDERS member → must be rejected.
  // The error surfaces through VISUAL_PROVENANCE_MISSING (existing error code).
  const ws = tmpWs();
  writeVisualReport(ws, "T01", reportWithPlaceholderMetric("N/A", "hero"));
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, false, "N/A diff-metric must be rejected by provenance gate (AC-1)");
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(
    offenses.some((o) => o.includes("hero") && o.includes("invalid diff-metric value")),
    `expected offense naming 'hero' + 'invalid diff-metric value': ${JSON.stringify(offenses)}`,
  );
});

test("AC-1: placeholder diff-metric 'dimensionsMatch=false' → checkVisualProvenance rejects", () => {
  // Why: AC-6/AC-1 say 'dimensionsMatch=false' (the comparator's emit on scale mismatch)
  // is a placeholder. It must be rejected — the pixel gate did not run to completion.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", reportWithPlaceholderMetric("dimensionsMatch=false", "surface1"));
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, false, "dimensionsMatch=false diff-metric must be rejected (AC-1/AC-6)");
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(
    offenses.some((o) => o.includes("invalid diff-metric value")),
    `expected 'invalid diff-metric value' offense: ${JSON.stringify(offenses)}`,
  );
});

test("AC-1: non-placeholder diff-metric '0 px' on armed surface → checkVisualProvenance passes", () => {
  // Why: a real tool output must NOT be rejected. '0 px' is not in the placeholder set.
  const ws = tmpWs();
  writeVisualReport(ws, "T01", reportWithPlaceholderMetric("0 px", "surface1"));
  // Note: the report has pixel_gate_complete: true (added by reportWithPlaceholderMetric).
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true, "real diff-metric '0 px' must pass provenance gate");
});

test("AC-5: B1-fallback token as diff-metric → provenance gate passes (NOT a placeholder)", () => {
  // Why: AC-5 explicitly says 'B1 tool unavailable — LLM fallback' is NOT a placeholder.
  // It proves the LLM-fallback execution path ran to completion.
  // checkVisualProvenance short-circuits via isFallback so it passes even without a metric.
  const ws = tmpWs();
  const report = `# Visual report

## Region Diff
| surface | result |
|---|---|
| surface1 | pass |

### surface1
- baseline: sha256:abc123
B1 tool unavailable — LLM fallback
- diff-metric: B1 tool unavailable — LLM fallback
- pixel_gate_complete: true
`;
  writeVisualReport(ws, "T01", report);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true, "B1-fallback token as diff-metric must NOT be rejected (AC-5)");
});

// ===========================================================================
// E1-E5: End-to-end verbatim error strings (dist/index.js) — Copy/Strings gate (AC-9)
// ===========================================================================

// Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
// body (including the pixel-gate attestation strings) compiles into
// dist/tools/handoff-orchestrator.js, not dist/index.js.
const DIST_INDEX = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "tools", "handoff-orchestrator.js"),
  "utf-8",
);
// gate-registry refactor (A10): the PIXEL_GATE_ATTESTATION_MISSING hint body
// (everything after the `⛔ CODE: ${listing}. ` prefix) is now sourced from
// gates/registry.ts (gate("...").hintStatic), so its verbatim text compiles
// into dist/gates/registry.js. The `⛔ PIXEL_GATE_ATTESTATION_MISSING:` prefix
// stays at the orchestrator emit site (DIST_INDEX above).
const DIST_REGISTRY = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "gates", "registry.js"),
  "utf-8",
);

test("E1: AC-9 — verbatim PIXEL_GATE_ATTESTATION_MISSING error prefix in dist/index.js", () => {
  // Why: the operator runbook and error envelope require the exact ⛔ prefix.
  // Any truncation or paraphrase breaks the runbook. Copy/Strings gate.
  assert.ok(
    DIST_INDEX.includes("⛔ PIXEL_GATE_ATTESTATION_MISSING:"),
    "PIXEL_GATE_ATTESTATION_MISSING error prefix must appear verbatim in dist/index.js",
  );
});

test("E2: AC-9 — PIXEL_GATE_ATTESTATION_MISSING message names the required fix line", () => {
  // Why: AC-9 says the error must name "the exact line the agent must add to fix it."
  // The spec Copy/Strings pins this as '- pixel_gate_complete: true'.
  assert.ok(
    DIST_REGISTRY.includes("'- pixel_gate_complete: true'"),
    "error message must include the exact fix line '- pixel_gate_complete: true' (AC-9)",
  );
});

test("E3: AC-9 — PIXEL_GATE_ATTESTATION_MISSING message mentions carry-forward exemption", () => {
  // Why: AC-9 requires the error to include which surfaces are exempt (carry-forward).
  // The compiled dist splits the string across template literal lines, so we check for
  // the carry-forward token that must appear adjacent in the concatenation.
  assert.ok(
    DIST_REGISTRY.includes("Carry-forward"),
    "error message must mention carry-forward exemption (AC-9)",
  );
  assert.ok(
    DIST_REGISTRY.includes("surfaces are exempt"),
    "error message must include 'surfaces are exempt' (AC-9)",
  );
});

test("E4: AC-9 — PIXEL_GATE_ATTESTATION_MISSING message includes spec reference", () => {
  // Why: AC-9 actionable-error requirement: the spec reference tells the agent where
  // to find the full requirement. Must appear verbatim.
  assert.ok(
    DIST_REGISTRY.includes("See specs/qa-visual-pixel-gate-attestation.md"),
    "error message must include the spec reference (AC-9)",
  );
});

test("E5: AC-9 — full verbatim PIXEL_GATE_ATTESTATION_MISSING copy string in dist/index.js", () => {
  // Why: the spec Copy/Strings table pins the full error envelope. The compiled dist
  // splits the string across template literal concatenation lines, so we verify each
  // clause that must appear in the source text. Any paraphrase or truncation breaks
  // the operator runbook.
  // The clauses below match the three string segments as emitted by index.ts:
  //   `⛔ PIXEL_GATE_ATTESTATION_MISSING: ${listing}. Each non-carry-forward `  (line 1)
  //   `surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' `  (line 2)
  //   `in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward `  (line 3)
  //   `surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.`  (line 4)
  assert.ok(
    DIST_INDEX.includes("⛔ PIXEL_GATE_ATTESTATION_MISSING:"),
    "PIXEL_GATE_ATTESTATION_MISSING prefix (clause 1) must appear in dist/index.js",
  );
  assert.ok(
    DIST_REGISTRY.includes("Each non-carry-forward"),
    "clause 'Each non-carry-forward' must appear in dist/gates/registry.js",
  );
  assert.ok(
    DIST_REGISTRY.includes("surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true'"),
    "clause naming the fix file and line must appear verbatim in dist/gates/registry.js",
  );
  assert.ok(
    DIST_REGISTRY.includes("in its ### <surface id> prose sub-section under ## Region Diff."),
    "clause naming the sub-section location must appear verbatim in dist/gates/registry.js",
  );
  assert.ok(
    DIST_REGISTRY.includes("surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md."),
    "exemption + spec-reference clause must appear verbatim in dist/gates/registry.js",
  );
});

// ===========================================================================
// AC-9: Version bump assertions — package.json + index.ts Server() coherence
// Relaxed per specs/c7-version-assertion-ownership.md AC-3/AC-4 (v3.54.0+):
// self-updating, no hardcoded target version — a routine version bump never
// requires a qa-engineer edit here again.
// ===========================================================================

test("AC-9: package.json version field is valid semver >= historical floor 3.42.0", () => {
  // Why: AC-9 originally pinned "package.json version == <exact release>", which
  // required a qa-engineer test edit on every single release (a quiet §2 exception
  // by precedent — see specs/c7-version-assertion-ownership.md Problem Statement).
  // Relaxed to what the AC actually needs: valid semver shape + a monotonic floor at
  // the version this AC-9 originally shipped in (3.42.0, per this file's own section
  // header). Numeric tuple comparison, not string comparison, so a value like "3.100.0"
  // doesn't falsely fail against a "3.42.0" floor. Passes unmodified at every future
  // version.
  const pkgPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, `package.json version must be valid semver, got "${pkg.version}"`);

  const FLOOR = [3, 42, 0];
  const tuple = pkg.version.split(".").map(Number);
  const meetsFloor =
    tuple[0] > FLOOR[0] ||
    (tuple[0] === FLOOR[0] && tuple[1] > FLOOR[1]) ||
    (tuple[0] === FLOOR[0] && tuple[1] === FLOOR[1] && tuple[2] >= FLOOR[2]);
  assert.ok(
    meetsFloor,
    `package.json version ${pkg.version} must be numerically >= historical floor 3.42.0`,
  );
});

test("AC-9: index.ts Server() literal matches package.json version (dynamic cross-file coherence)", () => {
  // Why: the Server() version literal is broadcast to MCP clients — it must agree with
  // package.json. Rather than hardcoding both sides to a release literal (requiring a
  // qa-engineer edit every bump), this reads package.json at test time and checks it
  // against the extracted index.ts literal — the same invariant scripts/check-version.mjs
  // already enforces dynamically. Passes unmodified across future major/minor bumps.
  const pkgPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const srcIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "index.ts"),
    "utf-8",
  );
  const match = srcIndex.match(/Server\(\s*\{[^}]*version:\s*["']([^"']+)["']/s);
  assert.ok(match, "index.ts must contain a Server({ ..., version: \"...\" }) literal");
  assert.equal(
    match[1],
    pkg.version,
    `Server() version literal ("${match[1]}") must equal package.json version ("${pkg.version}")`,
  );
});

// ===========================================================================
// AC-9: CHANGELOG.md — [3.42.0] entry mentions the feature and both error codes
// ===========================================================================

test("AC-9: CHANGELOG.md has ## [3.42.0] heading", () => {
  // Why: every server version bump must have a changelog entry for operators.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.match(changelog, /^##\s+\[3\.42\.0\]/m, "CHANGELOG.md must have ## [3.42.0] heading");
});

test("AC-9: CHANGELOG.md [3.42.0] mentions qa-visual-pixel-gate-attestation", () => {
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.ok(
    changelog.includes("qa-visual-pixel-gate-attestation"),
    "CHANGELOG.md [3.42.0] must mention the feature name",
  );
});

test("AC-9: CHANGELOG.md [3.42.0] mentions PIXEL_GATE_ATTESTATION_MISSING", () => {
  // Why: error codes must be documented for operator runbooks.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.ok(
    changelog.includes("PIXEL_GATE_ATTESTATION_MISSING"),
    "CHANGELOG.md [3.42.0] must mention PIXEL_GATE_ATTESTATION_MISSING",
  );
});

test("AC-9: CHANGELOG.md [3.42.0] mentions VISUAL_PROVENANCE_MISSING (placeholder extension)", () => {
  // Why: AC-1's tightening of checkVisualProvenance surfaces under the existing
  // VISUAL_PROVENANCE_MISSING error code. The CHANGELOG must document this extension.
  const changelog = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "CHANGELOG.md"),
    "utf-8",
  );
  assert.ok(
    changelog.includes("VISUAL_PROVENANCE_MISSING"),
    "CHANGELOG.md [3.42.0] must mention VISUAL_PROVENANCE_MISSING (placeholder extension)",
  );
});

// ===========================================================================
// Security smoke tests (§Phase 3d — boundary inputs)
// ===========================================================================

test("security: isPlaceholderDiffMetric — oversized string does not throw", () => {
  // Why: pure functions must be robust against adversarial inputs.
  const oversized = "x".repeat(100000);
  assert.doesNotThrow(() => isPlaceholderDiffMetric(oversized));
  assert.equal(isPlaceholderDiffMetric(oversized), false, "oversized real-looking value must not be a placeholder");
});

test("security: parsePixelGateAttestation — malformed/oversized content does not throw", () => {
  // Why: pure predicates must never throw regardless of content shape.
  const oversized = "- pixel_gate_complete: true\n".repeat(10000);
  assert.doesNotThrow(() => parsePixelGateAttestation(oversized));
  assert.doesNotThrow(() => parsePixelGateAttestation("####### ## #### malformed"));
  assert.doesNotThrow(() => parsePixelGateAttestation("\x00\x01\x02"));
});

test("security: checkPixelGateAttestation — path traversal attempt returns dormant", () => {
  // Why: a hostile feature-derived task id must not escape the qa_reports/ directory.
  // The sanitiser in evidence-file.ts replaces non-alnum chars; the result is a
  // non-existent path → dormant ok:true (never throws, never accesses sensitive paths).
  const ws = tmpWs();
  const result = checkPixelGateAttestation(ws, ["../../../etc/passwd"]);
  assert.equal(result.ok, true, "path traversal attempt must return dormant");
  assert.doesNotThrow(() => checkPixelGateAttestation(ws, ["feat; rm -rf /"]));
});

test("security: isPlaceholderDiffMetric — whitespace-only string → true (normalizes to empty)", () => {
  // Why: a value of only spaces/tabs trims to "" which is in the placeholder set.
  assert.equal(isPlaceholderDiffMetric("   "), true, "whitespace-only must normalize to '' and be a placeholder");
  assert.equal(isPlaceholderDiffMetric("\t\n"), true, "tab+newline must normalize to '' and be a placeholder");
});

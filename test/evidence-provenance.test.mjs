// Coded by @qa-engineer
// Tests for the v3.38.0 baseline-provenance gate (qa-visual-baseline-provenance):
//   parseVisualProvenanceRows(content)          — pure parser (AC-9)
//   checkVisualProvenance(workspacePath, ids)    — composition helper (AC-1..AC-6)
//
// AC coverage map:
//   AC-1: diffed surface missing baseline:             → flagged
//   AC-2: diffed surface missing diff-metric:          → flagged
//   AC-3: carry-forward surface                        → exempt
//   AC-4: B1 tool unavailable — LLM fallback           → satisfies diff-metric
//   AC-6: D2 presence-gated opt-in (zero baseline lines → gate dormant)
//   AC-9: pure function — same input, same output, no I/O
//   D1:   placeholder blacklist + emphasis-strip

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseVisualProvenanceRows,
  checkVisualProvenance,
} from "../dist/tools/evidence-file.js";

// ---- helpers ----------------------------------------------------------------

function tmpWs() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agc-prov-"));
}

function writeVisual(ws, id, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `visual_${id}.md`), body, "utf-8");
}

// Verbatim tokens required by spec Copy/Strings — must match ac-3/ac-4 exactly.
const CARRY_FORWARD_TOKEN = "pass (carried forward — git diff confirms source untouched)";
const B1_UNAVAILABLE_TOKEN = "B1 tool unavailable — LLM fallback";

// A minimal well-formed Region Diff section with one normally-diffed surface.
function regionDiffWith(surfaceId, extraBodyLines) {
  return `## Region Diff\n| surface | result |\n|---|---|\n| ${surfaceId} | pass |\n\n### ${surfaceId}\n${extraBodyLines}\n`;
}

// ===========================================================================
// parseVisualProvenanceRows — pure parser
// ===========================================================================

test("AC-9 purity: empty string → empty array (no I/O)", () => {
  // Calling with empty string must return [] and not throw or read any file.
  const rows = parseVisualProvenanceRows("");
  assert.deepEqual(rows, []);
});

test("AC-9 purity: same input always returns same output", () => {
  const content = regionDiffWith("hero", "- baseline: abc123\n- diff-metric: 0 px");
  const r1 = parseVisualProvenanceRows(content);
  const r2 = parseVisualProvenanceRows(content);
  assert.deepEqual(r1, r2);
});

test("AC-9: no Region Diff section → returns []", () => {
  const rows = parseVisualProvenanceRows("## Verdict — PASS\nsome text");
  assert.deepEqual(rows, []);
});

test("AC-9: parser return shape — all five fields present", () => {
  const content = regionDiffWith("checkout", "- baseline: sha256:abc\n- diff-metric: odiff: 3 px");
  const rows = parseVisualProvenanceRows(content);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.ok("surfaceId" in r, "surfaceId field");
  assert.ok("fingerprint" in r, "fingerprint field");
  assert.ok("diffMetric" in r, "diffMetric field");
  assert.ok("isCarryForward" in r, "isCarryForward field");
  assert.ok("isFallback" in r, "isFallback field");
});

// ---------------------------------------------------------------------------
// Baseline line parsing
// ---------------------------------------------------------------------------

test("D1: well-formed baseline line captured correctly", () => {
  const content = regionDiffWith("panel", "- baseline: node:0:1234\n- diff-metric: 0 px");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.fingerprint, "node:0:1234");
});

test("D1 emphasis-strip: **baseline:** xyz → fingerprint = 'xyz'", () => {
  const content = regionDiffWith("hero", "**baseline:** sha256:deadbeef\n- diff-metric: 0 px");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.fingerprint, "sha256:deadbeef");
});

test("D1 backtick-strip: baseline: `sha256:abc` → fingerprint = 'sha256:abc'", () => {
  const content = regionDiffWith("surface1", "- baseline: `sha256:abc`\n- diff-metric: 2 px");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.fingerprint, "sha256:abc");
});

test("D1 placeholder blacklist: <fingerprint> → fingerprint null", () => {
  const content = regionDiffWith("surface2", "- baseline: <fingerprint>\n- diff-metric: 0 px");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: TODO → fingerprint null", () => {
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "- baseline: TODO\n- diff-metric: x"));
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: TBD → fingerprint null", () => {
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "- baseline: TBD\n- diff-metric: x"));
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: N/A → fingerprint null", () => {
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "- baseline: N/A\n- diff-metric: x"));
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: none → fingerprint null", () => {
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "- baseline: none\n- diff-metric: x"));
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: bare dash → fingerprint null", () => {
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "- baseline: -\n- diff-metric: x"));
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: empty value (bare colon, last line) → fingerprint null", () => {
  // 'baseline:' (nothing after colon) as the last line in the block should yield null.
  // The regex requires at least 1 non-empty char after the separator; bare 'baseline:' → no match → null.
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "baseline:\n"));
  assert.equal(row.fingerprint, null);
});

test("D1 placeholder blacklist: whitespace-only value before next field → fingerprint null", () => {
  // BUG SENTINEL: 'baseline:   ' followed by '- diff-metric: x' on the next line.
  // The BASELINE_LINE_RE's trailing \s*$ can consume a newline and capture the next line
  // as the fingerprint. This test documents the correct expected behavior (null) — the
  // parser must not capture the diff-metric line as the baseline value.
  // If this test fails, the regex in BASELINE_LINE_RE uses .+? which crosses newlines via \s*$;
  // fix: use [^\n]+? instead of .+? in both BASELINE_LINE_RE and DIFF_METRIC_LINE_RE.
  const [row] = parseVisualProvenanceRows(regionDiffWith("s", "baseline:   \n- diff-metric: x"));
  assert.equal(row.fingerprint, null,
    "Whitespace-only baseline: must yield null fingerprint — regex must not cross the line boundary to capture the diff-metric line");
});

test("D1: missing baseline line entirely → fingerprint null", () => {
  const content = regionDiffWith("hero", "- diff-metric: 0 px\nsome other text");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.fingerprint, null);
});

// ---------------------------------------------------------------------------
// diff-metric line parsing
// ---------------------------------------------------------------------------

test("diff-metric: numeric value captured", () => {
  const content = regionDiffWith("s", "- baseline: abc123\n- diff-metric: ImageMagick AE: 0");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.diffMetric, "ImageMagick AE: 0");
});

test("diff-metric: absent → diffMetric null", () => {
  const content = regionDiffWith("s", "- baseline: sha256:xyz\nsome text");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.diffMetric, null);
});

// ---------------------------------------------------------------------------
// Carry-forward detection
// ---------------------------------------------------------------------------

test("AC-3: carry-forward token sets isCarryForward=true", () => {
  const body = `${CARRY_FORWARD_TOKEN}\nsome extra text`;
  const content = regionDiffWith("surface-cf", body);
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.isCarryForward, true);
});

test("AC-3: non-carry-forward surface has isCarryForward=false", () => {
  const content = regionDiffWith("hero", "- baseline: abc\n- diff-metric: 0 px");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.isCarryForward, false);
});

// ---------------------------------------------------------------------------
// B1-unavailable fallback detection
// ---------------------------------------------------------------------------

test("AC-4: B1 fallback token sets isFallback=true", () => {
  const body = `- baseline: node:1:99\n- diff-metric: ${B1_UNAVAILABLE_TOKEN}`;
  const content = regionDiffWith("surface-b1", body);
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.isFallback, true);
  // When the token is used as the diff-metric value the diff-metric is non-null
  assert.ok(row.diffMetric !== null);
});

test("AC-4: normal surface without fallback token has isFallback=false", () => {
  const content = regionDiffWith("hero", "- baseline: sha256:aaa\n- diff-metric: 0 px");
  const [row] = parseVisualProvenanceRows(content);
  assert.equal(row.isFallback, false);
});

// ---------------------------------------------------------------------------
// Multi-surface reports
// ---------------------------------------------------------------------------

test("parser returns one row per sub-heading, in source order", () => {
  const content = `## Region Diff
| surface | result |
|---|---|
| A | pass |
| B | pass |
| C | pass |

### A
- baseline: hash-a
- diff-metric: 0 px

### B
${CARRY_FORWARD_TOKEN}

### C
- baseline: node:1:42
- diff-metric: ${B1_UNAVAILABLE_TOKEN}
`;
  const rows = parseVisualProvenanceRows(content);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].surfaceId, "A");
  assert.equal(rows[1].surfaceId, "B");
  assert.equal(rows[2].surfaceId, "C");
  assert.equal(rows[0].fingerprint, "hash-a");
  assert.equal(rows[1].isCarryForward, true);
  assert.equal(rows[2].isFallback, true);
});

// ===========================================================================
// checkVisualProvenance — composition helper + gate logic
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-6 / D2: presence-gated opt-in
// ---------------------------------------------------------------------------

test("AC-6: report with ZERO baseline lines → gate dormant (ok:true)", () => {
  const ws = tmpWs();
  // Legacy report: no baseline: line anywhere in Region Diff prose.
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| hero | pass |

### hero
Some prose but no baseline or diff-metric lines.

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true, "gate must be dormant for legacy report");
  assert.deepEqual(result.offendingByTaskId, {});
});

test("AC-6: at least one baseline: line → strict mode arms whole report", () => {
  const ws = tmpWs();
  // Surface A has baseline:, surface B has neither → B is an offense once A opts in.
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| A | pass |
| B | pass |

### A
- baseline: sha256:goodhash
- diff-metric: 0 px

### B
No provenance fields here.

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, false, "B must be flagged once A opts the report in");
  assert.ok("T01" in result.offendingByTaskId);
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(offenses.some((o) => o.includes("B") && o.includes("no baseline:")));
});

// ---------------------------------------------------------------------------
// AC-1: missing baseline → flagged
// ---------------------------------------------------------------------------

test("AC-1: diffed surface missing baseline: → flagged with 'no baseline:'", () => {
  const ws = tmpWs();
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| hero | pass |
| panel | pass |

### hero
- baseline: sha256:abc
- diff-metric: 2 px

### panel
- diff-metric: 0 px

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, false);
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(offenses.some((o) => o.startsWith("panel") && o.includes("no baseline:")),
    `expected 'panel: no baseline:' in ${JSON.stringify(offenses)}`);
});

// ---------------------------------------------------------------------------
// AC-2: missing diff-metric → flagged
// ---------------------------------------------------------------------------

test("AC-2: diffed surface missing diff-metric: → flagged with 'no diff-metric:'", () => {
  const ws = tmpWs();
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| hero | pass |
| panel | pass |

### hero
- baseline: sha256:abc
- diff-metric: 0 px

### panel
- baseline: sha256:def

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, false);
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(offenses.some((o) => o.startsWith("panel") && o.includes("no diff-metric:")),
    `expected 'panel: no diff-metric:' in ${JSON.stringify(offenses)}`);
});

// ---------------------------------------------------------------------------
// AC-3: carry-forward exempt
// ---------------------------------------------------------------------------

test("AC-3: carry-forward surface exempt — no baseline or diff-metric required", () => {
  const ws = tmpWs();
  // surface A opts the report in; surface B is carry-forward → exempt.
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| A | pass |
| B | pass |

### A
- baseline: sha256:goodhash
- diff-metric: 1 px

### B
${CARRY_FORWARD_TOKEN}

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true,
    `carry-forward surface must be exempt. offenses: ${JSON.stringify(result.offendingByTaskId)}`);
});

test("AC-3: carry-forward surface does not need fingerprint even when report is in strict mode", () => {
  const ws = tmpWs();
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| diffed | pass |
| cf | pass |

### diffed
- baseline: node:0:42
- diff-metric: 0 px

### cf
${CARRY_FORWARD_TOKEN}

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// AC-4: B1-unavailable fallback satisfies diff-metric, but baseline still required
// ---------------------------------------------------------------------------

test("AC-4: B1 fallback satisfies diff-metric when baseline is present → ok", () => {
  const ws = tmpWs();
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| hero | pass |

### hero
- baseline: node:1:1234
- diff-metric: ${B1_UNAVAILABLE_TOKEN}

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true,
    `B1 fallback + real baseline must pass. offenses: ${JSON.stringify(result.offendingByTaskId)}`);
});

test("AC-4: B1 fallback still requires baseline: — missing baseline is flagged", () => {
  const ws = tmpWs();
  // D4 asymmetry: a fallback must still record a baseline it read.
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| A | pass |
| hero | pass |

### A
- baseline: sha256:seed

### hero
- diff-metric: ${B1_UNAVAILABLE_TOKEN}

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, false,
    "B1 fallback without baseline must still be flagged");
  const offenses = result.offendingByTaskId["T01"];
  assert.ok(offenses.some((o) => o.startsWith("hero") && o.includes("no baseline:")));
});

// ---------------------------------------------------------------------------
// Multi-task gate
// ---------------------------------------------------------------------------

test("multi-task: offense in one task does not penalize a clean task", () => {
  const ws = tmpWs();
  // T01 is fully provenance-clean.
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| hero | pass |

### hero
- baseline: sha256:clean
- diff-metric: 0 px

## Verdict — PASS
`);
  // T02 is opted-in but missing diff-metric for 'panel'.
  writeVisual(ws, "T02", `## Region Diff
| surface | result |
|---|---|
| panel | pass |

### panel
- baseline: sha256:xyz

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01", "T02"]);
  assert.equal(result.ok, false);
  assert.ok(!("T01" in result.offendingByTaskId), "T01 must not appear in offenses");
  assert.ok("T02" in result.offendingByTaskId, "T02 must appear in offenses");
});

// ---------------------------------------------------------------------------
// Missing visual file — skipped silently (existence enforced upstream)
// ---------------------------------------------------------------------------

test("missing visual file is skipped (gate is dormant for absent files)", () => {
  const ws = tmpWs();
  const result = checkVisualProvenance(ws, ["T99"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.offendingByTaskId, {});
});

// ---------------------------------------------------------------------------
// Clean report — fully provenance-compliant → ok
// ---------------------------------------------------------------------------

test("fully-compliant report → ok:true with empty offendingByTaskId", () => {
  const ws = tmpWs();
  writeVisual(ws, "T01", `## Region Diff
| surface | result |
|---|---|
| checkout | pass |
| sidebar  | pass |

### checkout
- baseline: sha256:abc123
- diff-metric: odiff: 0 px (0%)

### sidebar
- baseline: node:0:9999
- diff-metric: ImageMagick AE: 5

## Verdict — PASS
`);
  const result = checkVisualProvenance(ws, ["T01"]);
  assert.equal(result.ok, true, JSON.stringify(result));
});

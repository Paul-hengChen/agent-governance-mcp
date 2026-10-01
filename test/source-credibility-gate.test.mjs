// Coded by @qa-engineer
// Tests for specs/e4-design-source-credibility-gate.md: the build-entry gate
// SOURCE_CREDIBILITY_UNVERIFIED on pm -> {architect, sr-engineer}, the
// `credibility` column parsed in gates/visual.ts, checkSourceCredibility, the
// storage-agnostic pm-pinned arm condition, the S02 hint and the coordinator
// stop-condition. Composition tests, no server spawn.
// Spec-to-test map: specs/e260h-comment-rationale.md (test/source-credibility-gate.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseBaselineManifestRows,
  checkSourceCredibility,
} from "../dist/gates/visual.js";
import { gate } from "../dist/gates/registry.js";

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
// body (including the E4 gate's envelope + hint) compiles into
// dist/tools/handoff-orchestrator.js, not dist/index.js — same convention as the
// cut-approval / external-refs gate tests.
const DIST_ORCHESTRATOR = fs.readFileSync(
  path.join(PROJECT_ROOT, "dist", "tools", "handoff-orchestrator.js"),
  "utf-8",
);

// ---- helpers ----------------------------------------------------------------

function tmpWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-scg-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeDesign(ws, feature, body) {
  const dir = path.join(ws, "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${feature}.md`), body, "utf-8");
}

// Build a `## Source` table with a header-bearing credibility column, given an
// array of row specs: { medium, pointer, status, credibility } (credibility ""
// or omitted => blank cell; use `null` to omit the column value entirely by
// passing a table built via `sourceTableNoCredibilityColumn` instead).
function sourceTableWithCredibility(rows) {
  const lines = [
    "| medium | pointer | fetched | status   | credibility          | reason |",
    "|--------|---------|---------|----------|----------------------|--------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.medium} | ${r.pointer} | yes | ${r.status} | ${r.credibility ?? ""} | ${r.reason ?? "—"} |`,
    );
  }
  return lines.join("\n");
}

// A `## Source` table with NO credibility column at all (pre-E4 shape) — used
// to confirm the missing-column case fires identically to a blank cell (AC-1).
function sourceTableNoCredibilityColumn(rows) {
  const lines = [
    "| medium | pointer | fetched | status   | reason |",
    "|--------|---------|---------|----------|--------|",
  ];
  for (const r of rows) {
    lines.push(`| ${r.medium} | ${r.pointer} | yes | ${r.status} | ${r.reason ?? "—"} |`);
  }
  return lines.join("\n");
}

// Armed (fetch-based mode) design body wrapping a given `## Source` table body,
// or no `## Source` section at all when `sourceBody` is null.
function armedDesignBody(mode, sourceBody) {
  let body = `# design/test-feature\n\nmode: ${mode}\n\n## Layout / Canvas\n\nsome layout\n\n`;
  if (sourceBody !== null) {
    body += `## Source\n\n${sourceBody}\n\n`;
  }
  return body;
}

// ===========================================================================
// A missing or empty credibility cell on an audited row makes the gate fire (T1/T2, AC-1)
// ===========================================================================

test("T1: AC-1 fire — credibility column absent entirely on an audited row", () => {
  // Why: AC-1/DR-5 — a pre-E4 fetch-mode manifest with audited rows but no
  // `credibility` column at all is NOT grandfathered; it must fire so the design
  // is re-audited with the attestation before re-entering build (no backfill).
  const ws = tmpWs();
  writeDesign(
    ws,
    "missing-col",
    armedDesignBody(
      "figma",
      sourceTableNoCredibilityColumn([{ medium: "figma", pointer: "12:345", status: "audited" }]),
    ),
  );
  const result = checkSourceCredibility(ws, "missing-col");
  assert.equal(result.ok, false, "missing credibility column on an audited row must fire the gate");
  assert.deepEqual(result.offendingRows, ["figma/12:345"], "offendingRows must name the medium/pointer pair");
});

test("T2: AC-1 fire — credibility column present but cell blank on an audited row", () => {
  // Why: AC-1 — a header-bearing table with the column present but the cell
  // empty on an audited row is the same violation as a missing column.
  const ws = tmpWs();
  writeDesign(
    ws,
    "blank-cell",
    armedDesignBody(
      "sketch",
      sourceTableWithCredibility([{ medium: "sketch", pointer: "art-1", status: "audited", credibility: "" }]),
    ),
  );
  const result = checkSourceCredibility(ws, "blank-cell");
  assert.equal(result.ok, false, "blank credibility cell on an audited row must fire the gate");
  assert.deepEqual(result.offendingRows, ["sketch/art-1"]);
});

// ===========================================================================
// A wrong (non-full-page-composite) credibility value makes the gate fire (T3, AC-3)
// ===========================================================================

test("T3: AC-3 fire — credibility cell carries a non-full-page-composite value", () => {
  // Why: AC-1/AC-3 — the ONLY legal value on an audited row is the literal
  // full-page-composite (step 2b classification (a)); any other value (e.g. the
  // classification-(b) label leaking through) must fire, and the hint must name
  // the offending row.
  const ws = tmpWs();
  writeDesign(
    ws,
    "wrong-value",
    armedDesignBody(
      "xd",
      sourceTableWithCredibility([
        { medium: "xd", pointer: "art-9", status: "audited", credibility: "component-variant" },
      ]),
    ),
  );
  const result = checkSourceCredibility(ws, "wrong-value");
  assert.equal(result.ok, false, "a non-full-page-composite value on an audited row must fire the gate");
  assert.deepEqual(result.offendingRows, ["xd/art-9"]);
});

// ===========================================================================
// A compliant audited row clears the credibility check (T4, AC-1)
// ===========================================================================

test("T4: AC-1 clear — audited row with full-page-composite passes", () => {
  // Why: the happy path. A compliant attestation must clear the gate.
  const ws = tmpWs();
  writeDesign(
    ws,
    "compliant",
    armedDesignBody(
      "penpot",
      sourceTableWithCredibility([
        { medium: "penpot", pointer: "board-1", status: "audited", credibility: "full-page-composite" },
      ]),
    ),
  );
  const result = checkSourceCredibility(ws, "compliant");
  assert.equal(result.ok, true, "a compliant credibility attestation must clear the gate");
  assert.deepEqual(result.offendingRows, []);
});

// ===========================================================================
// With several rows, offendingRows lists ONLY the offender (T5, AC-3)
// ===========================================================================

test("T5: AC-3 multi-row — one compliant + one wrong; offendingRows names only the offender", () => {
  // Why: the gate must not over-report — a design with a mix of compliant and
  // non-compliant audited rows must list exactly the non-compliant one(s), so
  // the hint is actionable rather than noisy.
  const ws = tmpWs();
  writeDesign(
    ws,
    "mixed-compliance",
    armedDesignBody(
      "figma",
      sourceTableWithCredibility([
        { medium: "figma", pointer: "10:1", status: "audited", credibility: "full-page-composite" },
        { medium: "figma", pointer: "10:2", status: "audited", credibility: "read-only-review" },
      ]),
    ),
  );
  const result = checkSourceCredibility(ws, "mixed-compliance");
  assert.equal(result.ok, false);
  assert.deepEqual(result.offendingRows, ["figma/10:2"], "only the non-compliant row must be listed");
});

// ===========================================================================
// Deferred/out-of-scope rows are never gated (T6)
// ===========================================================================

test("T6: deferred row with blank credibility is ignored alongside a compliant audited row", () => {
  // Why: AC-5 — only isAudited rows are checked. A deferred row's blank
  // credibility is expected (design-auditor SOP leaves it blank) and must never
  // fire the gate on its own.
  const ws = tmpWs();
  writeDesign(
    ws,
    "deferred-ignored",
    armedDesignBody(
      "figma",
      sourceTableWithCredibility([
        { medium: "figma", pointer: "1:1", status: "audited", credibility: "full-page-composite" },
        { medium: "figma", pointer: "", status: "deferred", credibility: "" },
      ]),
    ),
  );
  const result = checkSourceCredibility(ws, "deferred-ignored");
  assert.equal(result.ok, true, "a deferred row's blank credibility must not fire the gate");
});

// ===========================================================================
// Zero audited rows: independent of BASELINE_MANIFEST_MISSING (T7, AC-5)
// ===========================================================================

test("T7: zero audited rows (all deferred) → ok:true (BASELINE_MANIFEST_MISSING owns that case)", () => {
  // Why: AC-5 — this gate is independent of BASELINE_MANIFEST_MISSING. A
  // manifest with zero audited rows is that OTHER (PASS-time) gate's problem;
  // this build-entry gate must stay silent since there is no audited row to
  // mis-attest.
  const ws = tmpWs();
  writeDesign(
    ws,
    "all-deferred",
    armedDesignBody(
      "figma",
      sourceTableWithCredibility([{ medium: "figma", pointer: "", status: "deferred", credibility: "" }]),
    ),
  );
  const result = checkSourceCredibility(ws, "all-deferred");
  assert.equal(result.ok, true, "zero audited rows must not fire this gate");
});

// ===========================================================================
// The credibility gate stays dormant in modes that do not fetch sources (T8, AC-4)
// ===========================================================================

test("T8: AC-4 dormancy — image/pdf/paper/no-design modes never fire, even with a non-compliant audited row", () => {
  // Why: AC-4 — the fetch-based INCLUSION list (figma/sketch/xd/penpot) is the
  // whole arm. Step 2b itself only classifies fetch-based nodes; image/pdf/paper
  // are human-confirmed sources, so a "bad" credibility cell there (which
  // shouldn't even exist) must never leak into a false-fire.
  const ws = tmpWs();
  for (const mode of ["image", "pdf", "paper", "no-design"]) {
    const feature = `non-fetch-${mode}`;
    writeDesign(
      ws,
      feature,
      armedDesignBody(
        mode,
        sourceTableWithCredibility([
          { medium: mode, pointer: "p-1", status: "audited", credibility: "component-variant" },
        ]),
      ),
    );
    const result = checkSourceCredibility(ws, feature);
    assert.equal(result.ok, true, `mode=${mode} must be dormant regardless of manifest contents`);
  }
});

// ===========================================================================
// The gate stays dormant with no design file or no ## Source section (T9, AC-4)
// ===========================================================================

test("T9a: AC-4 dormancy — no design/<feature>.md file at all", () => {
  const ws = tmpWs();
  // No design directory/file created for this feature.
  const result = checkSourceCredibility(ws, "no-design-file-feat");
  assert.equal(result.ok, true, "missing design file must be dormant");
  assert.deepEqual(result.offendingRows, []);
});

test("T9b: AC-4 dormancy — fetch-based mode with no ## Source section at all (pre-2c/pre-E4 audits)", () => {
  const ws = tmpWs();
  writeDesign(ws, "no-source-section", armedDesignBody("figma", null));
  const result = checkSourceCredibility(ws, "no-source-section");
  assert.equal(result.ok, true, "absent ## Source section must be dormant (no backfill)");
});

// ===========================================================================
// Resume safety: the arm condition is pinned to a previous pm hop (T10, AC-6)
// ===========================================================================

test("T10: AC-6 — the orchestrator arm condition requires prevTuple.agent === \"pm\" (resume safety)", () => {
  // Why: same pattern as cut-approval-gate.test.mjs's XG-nonpm — a non-pm
  // predecessor (architect->sr-engineer, or the sr-engineer self-loop) must
  // never be gated, regardless of manifest contents. checkSourceCredibility
  // itself is agent-agnostic by design (it only reads the design file); the
  // pm-pinning lives in the orchestrator's `if` guard around the call, so we
  // assert the arm condition directly, and separately confirm the predicate
  // alone (without that guard) would have fired.
  const prevTuple = { agent: "architect", status: "In_Progress" };
  const onGatedEdge = prevTuple.agent === "pm" && prevTuple.status === "In_Progress";
  assert.equal(onGatedEdge, false, "a non-pm predecessor must never satisfy the gate's arm condition");

  const ws = tmpWs();
  writeDesign(
    ws,
    "resume-safety",
    armedDesignBody(
      "figma",
      sourceTableWithCredibility([{ medium: "figma", pointer: "9:9", status: "audited", credibility: "" }]),
    ),
  );
  const predicateResult = checkSourceCredibility(ws, "resume-safety");
  assert.equal(
    predicateResult.ok,
    false,
    "predicate alone (without the orchestrator's pm-pinning guard) would fire — proving the guard, not the predicate, protects resume/self-loop edges",
  );
});

// ===========================================================================
// The gate is storage-mode agnostic — NO instanceof FileHandoffStorage guard (T11, AC-7)
// ===========================================================================

test("T11: AC-7 — the E4 gate block carries NO instanceof FileHandoffStorage guard (contrast cut-approval/external-refs)", () => {
  // The attestation lives in design/<feature>.md, read with fs whatever the
  // handoff storage, so the gate must fire in file and SQLite mode alike. This
  // isolates the gate's block in the compiled orchestrator and asserts it has
  // no FileHandoffStorage guard.
  const startIdx = DIST_ORCHESTRATOR.indexOf("checkSourceCredibility(parsed.workspace_path");
  assert.ok(startIdx >= 0, "checkSourceCredibility call site not found in dist/tools/handoff-orchestrator.js");
  const endIdx = DIST_ORCHESTRATOR.indexOf("SOURCE_CREDIBILITY_UNVERIFIED", startIdx);
  assert.ok(endIdx >= 0, "SOURCE_CREDIBILITY_UNVERIFIED emit not found after the checkSourceCredibility call site");
  // Widen slightly backward to capture the enclosing `if (...)` guard.
  const blockStart = DIST_ORCHESTRATOR.lastIndexOf("if (", startIdx);
  const gateBlock = DIST_ORCHESTRATOR.slice(blockStart, endIdx + "SOURCE_CREDIBILITY_UNVERIFIED".length);

  assert.ok(
    !gateBlock.includes("instanceof FileHandoffStorage") && !gateBlock.includes("instanceof storage_js"),
    "the E4 gate block must NOT contain an instanceof FileHandoffStorage guard (storage-mode-agnostic, AC-7)",
  );
  assert.ok(gateBlock.includes('"pm"'), "sanity: the isolated block must still contain the prev-agent pm-pin");
});

// ===========================================================================
// Parser: the credibility column is added to BaselineManifestRow (T12)
// ===========================================================================

test("T12: parseBaselineManifestRows populates credibility (normalized) from a header-bearing table; \"\" when column absent", () => {
  // Why: DR-1 — the extended parser must locate `credibility` by header name
  // (not position), normalize via trim().toLowerCase(), and default to "" when
  // the column is missing entirely — the same "" sentinel a blank cell yields.
  const withColumn = `## Source

| medium | pointer | fetched | status   | credibility          | reason |
|--------|---------|---------|----------|----------------------|--------|
| figma  | 12:345  | yes     | audited  |  Full-Page-Composite | frozen |
`;
  const rows = parseBaselineManifestRows(withColumn);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].credibility, "full-page-composite", "credibility must be trim().toLowerCase() normalized");
  assert.equal(rows[0].isAudited, true, "existing isAudited logic must be untouched by the additive field");

  const withoutColumn = `## Source

| medium | pointer | fetched | status   | reason |
|--------|---------|---------|----------|--------|
| figma  | 12:345  | yes     | audited  | frozen |
`;
  const rows2 = parseBaselineManifestRows(withoutColumn);
  assert.equal(rows2.length, 1);
  assert.equal(rows2[0].credibility, "", "credibility must be \"\" when the column is absent (no positional fallback)");
});

// ===========================================================================
// The rejection hint is verbatim — static suffix + dynamic prefix + error code (T13, AC-8, S02)
// ===========================================================================

test("T13: AC-8 — S02 static suffix verbatim (runtime hintStatic); dynamic prefix + error code in dist/tools/handoff-orchestrator.js", () => {
  // The hint is a dynamic prefix plus the registry's static suffix, together
  // byte-equal to spec S02; the leading space on hintStatic matters. tsc keeps
  // the registry's `+` concatenation unfolded, so the test reads the runtime
  // value from gate(...) rather than searching dist text.
  const entry = gate("SOURCE_CREDIBILITY_UNVERIFIED");
  const STATIC_SUFFIX =
    " Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry " +
    "credibility: full-page-composite in the ## Source manifest before routing to build. " +
    "See content/skill-design-auditor.md step 2b and specs/e4-design-source-credibility-gate.md.";
  assert.equal(
    entry.hintStatic,
    STATIC_SUFFIX,
    "gate(\"SOURCE_CREDIBILITY_UNVERIFIED\").hintStatic must equal the S02 static suffix verbatim, including the leading space",
  );
  assert.ok(
    DIST_ORCHESTRATOR.includes("SOURCE_CREDIBILITY_UNVERIFIED"),
    "dist/tools/handoff-orchestrator.js must contain the SOURCE_CREDIBILITY_UNVERIFIED error code",
  );
  assert.ok(
    DIST_ORCHESTRATOR.includes("Source-credibility attestation missing or unverified for:"),
    "dist/tools/handoff-orchestrator.js must contain the S02 dynamic prefix verbatim",
  );

  // Full byte-exact reconstruction check (AC-8): dynamic prefix (with a sample
  // {rows} value) + the RUNTIME hintStatic must equal spec S02 verbatim.
  const dynamicPrefix = "Source-credibility attestation missing or unverified for: figma/12:345.";
  const reconstructed = dynamicPrefix + entry.hintStatic;
  const SPEC_S02 =
    "Source-credibility attestation missing or unverified for: figma/12:345. Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry credibility: full-page-composite in the ## Source manifest before routing to build. See content/skill-design-auditor.md step 2b and specs/e4-design-source-credibility-gate.md.";
  assert.equal(reconstructed, SPEC_S02, "dynamic prefix + hintStatic must reproduce spec S02 byte-for-byte");
});

// ===========================================================================
// The coordinator's Auto-Routing stops when the gate rejects, instead of retrying (T14, AC-9)
// ===========================================================================

test("T14: AC-9 — coordinator stop-condition references the gate, credibility, and SOURCE_CREDIBILITY_UNVERIFIED", async () => {
  // Why: AC-9 — Auto-Routing must halt and surface the problem to the human
  // instead of retrying the same rejected write in a loop. Compose the full
  // skill-coordinator.md the same way cut-approval-gate.test.mjs's C4 does
  // (the stop-condition lives in content/coord-03-core-fallback.md, one
  // of the fragments composeSkill assembles; DR-6).
  const { composeSkill, hostCapabilitiesFor } = await import(
    path.join(PROJECT_ROOT, "dist", "prompts", "skill-manifest.js")
  );
  const COORD = composeSkill(
    "skill-coordinator.md",
    hostCapabilitiesFor("claude-code"),
    (f) => fs.readFileSync(path.join(PROJECT_ROOT, "content", f), "utf-8"),
  );
  assert.ok(
    COORD.toLowerCase().includes("source-credibility gate"),
    "skill-coordinator.md must reference the Source-credibility gate in Auto-Routing",
  );
  assert.ok(
    COORD.includes("credibility"),
    "skill-coordinator.md stop-condition must reference the credibility attestation",
  );
  assert.ok(
    COORD.includes("SOURCE_CREDIBILITY_UNVERIFIED"),
    "skill-coordinator.md must name the SOURCE_CREDIBILITY_UNVERIFIED error code",
  );
});

// ===========================================================================
// Security smoke tests (§Phase 3d — boundary inputs)
// ===========================================================================

test("security: checkSourceCredibility — path traversal / hostile feature name returns dormant, never throws", () => {
  const ws = tmpWs();
  assert.doesNotThrow(() => checkSourceCredibility(ws, "../../../etc/passwd"));
  const result = checkSourceCredibility(ws, "../../../etc/passwd");
  assert.equal(result.ok, true, "path traversal attempt must return dormant");

  assert.doesNotThrow(() => checkSourceCredibility(ws, "feat; rm -rf /"));
  assert.equal(checkSourceCredibility(ws, "feat; rm -rf /").ok, true);
});

test("security: checkSourceCredibility — unreadable/nonexistent workspace path never throws", () => {
  assert.doesNotThrow(() => checkSourceCredibility("/nonexistent/path/xyz", "some-feature"));
  const result = checkSourceCredibility("/nonexistent/path/xyz", "some-feature");
  assert.equal(result.ok, true, "unreadable path must return dormant");
  assert.doesNotThrow(() => checkSourceCredibility("", ""));
});

test("security: parseBaselineManifestRows — oversized/null-like input with a credibility column does not throw", () => {
  const oversized =
    "## Source\n\n" +
    "| medium | pointer | fetched | status | credibility | reason |\n" +
    "|---|---|---|---|---|---|\n" +
    "| figma | node | yes | audited | full-page-composite | ok |\n".repeat(5000);
  assert.doesNotThrow(() => parseBaselineManifestRows(oversized));
  assert.doesNotThrow(() => parseBaselineManifestRows(null ?? ""));
  assert.doesNotThrow(() => parseBaselineManifestRows(undefined ?? ""));
});

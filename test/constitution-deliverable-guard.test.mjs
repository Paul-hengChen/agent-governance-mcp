// Coded by @qa-engineer
// Regression guard for the false-PASS class: a constitution deliverable is
// reported done but the marker strings were never actually written to the file.
//
// Spec-to-Test map (feature: constitution-v3.27-sync-consistency):
//   A3 (version header)      -> t-a3-version-header
//   A1 (tw_sync pre-flight)  -> t-a1-tw-sync-preflight
//   A2 (visual report schema)-> t-a2-visual-report-incomplete, t-a2-visual-assertions-required,
//                               t-a2-required-sections
//   A4 (wording correction)  -> t-a4-new-wording-present, t-a4-old-wording-absent
//   B1 (terse carve-outs)    -> t-b1-assumption-gap, t-b1-acceptance-criteria
//   B2 (design-baseline scope)-> t-b2-scope-baseline, t-b2-fidelity-defect
//   B3 (intra-section priority)-> t-b3-override-markers, t-b3-circuit-breaker,
//                                t-b3-inter-document-priority
//
// WHY: no prior test reads content/constitution.md, so a deliverable could be
// committed as "done" without any of its text ever landing. This file pins
// each v3.27.0 edit by asserting load-bearing marker strings so CI turns RED
// the moment a required phrase is removed or was never written.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

// compose-not-strip (ticket A9, DR-6): content/constitution.md is retired (AC8);
// composeConstitution({chain:true,design:true}) reproduces it byte-for-byte
// (Option R, architecture DR-1), so every marker-string assertion below is
// unaffected by this mechanical swap.
const { composeConstitution } = await import(
  path.join(ROOT, "dist", "prompts", "build.js")
);
const CONSTITUTION = composeConstitution({ chain: true, design: true });

// ---------------------------------------------------------------------------
// REQUIRED_VISUAL_SECTIONS is read directly from the compiled output of
// tools/evidence-file.ts so the test self-syncs when the array changes.
// If the import fails (dist not built yet), the test itself will fail loudly —
// that is intentional: "build before test" is already required by the project.
//
// If you change REQUIRED_VISUAL_SECTIONS in tools/evidence-file.ts (line 342),
// rebuild (`npm run build`) and this test automatically reflects the new set.
// ---------------------------------------------------------------------------
const { REQUIRED_VISUAL_SECTIONS_EXPORT } = await (async () => {
  // evidence-file.ts does not export REQUIRED_VISUAL_SECTIONS directly (it is
  // `const` not `export const`). We derive it from the built JS by extracting
  // the names from a validateVisualReport call on a known-missing input, since
  // that returns the missingSections array. A simpler approach: parse the TS
  // source for the array literal so we don't need an export.
  const src = fs.readFileSync(
    path.join(ROOT, "gates", "visual.ts"),
    "utf-8",
  );
  // Match the REQUIRED_VISUAL_SECTIONS array literal in tools/evidence-file.ts.
  // Sync point: tools/evidence-file.ts:342 — REQUIRED_VISUAL_SECTIONS.
  const m = src.match(
    /const REQUIRED_VISUAL_SECTIONS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  assert.ok(
    m,
    "REQUIRED_VISUAL_SECTIONS array not found in tools/evidence-file.ts — sync check failed",
  );
  const names = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(
    names.length >= 6,
    `Expected ≥6 required sections, got ${names.length}`,
  );
  return { REQUIRED_VISUAL_SECTIONS_EXPORT: names };
})();

describe("constitution-deliverable-guard (v3.27.0)", () => {
  // -------------------------------------------------------------------------
  // A3 — Version header
  // Asserts: constitution header carries a version ≥ v3.27 (not the stale v3.14.1
  // value that existed before this work). Must match v3.x.y pattern AND NOT be
  // exactly v3.14.1.
  // -------------------------------------------------------------------------
  test("A3 (t-a3-version-header): header matches v3.x.y pattern and is not stale v3.14.1", () => {
    const firstLine = CONSTITUTION.split("\n")[0];
    assert.match(
      firstLine,
      /^# Constitution v3\.\d+\.\d+/,
      "First line must be '# Constitution v3.<major>.<minor>' version header",
    );
    assert.ok(
      !firstLine.includes("v3.14.1"),
      "Constitution must not carry the stale v3.14.1 version — deliverable A3 not landed",
    );
  });

  // -------------------------------------------------------------------------
  // A1 — tw_sync in §3 pre-flight context
  // Asserts: `tw_sync` appears in the pre-flight bullet (§3) so the state-sync
  // rules explicitly include the new reconcile operation.
  // -------------------------------------------------------------------------
  test("A1 (t-a1-tw-sync-preflight): tw_sync is listed in the §3 pre-flight bullet", () => {
    // The pre-flight bullet starts with "**Pre-flight read**" and must enumerate tw_sync.
    const preflightIdx = CONSTITUTION.indexOf("**Pre-flight read**");
    assert.ok(
      preflightIdx !== -1,
      "§3 Pre-flight read bullet not found in constitution",
    );
    // Find the bullet line (extends to the next newline).
    const bulletEnd = CONSTITUTION.indexOf("\n", preflightIdx);
    const bulletLine =
      bulletEnd === -1
        ? CONSTITUTION.slice(preflightIdx)
        : CONSTITUTION.slice(preflightIdx, bulletEnd);
    assert.ok(
      bulletLine.includes("tw_sync"),
      "The pre-flight bullet must include `tw_sync` — deliverable A1 not landed",
    );
  });

  // -------------------------------------------------------------------------
  // A2 — Visual report schema gate error codes
  // Asserts: both new error-code names appear in the constitution text.
  // -------------------------------------------------------------------------
  test("A2 (t-a2-visual-report-incomplete): VISUAL_REPORT_INCOMPLETE error code present", () => {
    assert.ok(
      CONSTITUTION.includes("VISUAL_REPORT_INCOMPLETE"),
      "VISUAL_REPORT_INCOMPLETE error code must be in the constitution — deliverable A2 not landed",
    );
  });

  test("A2 (t-a2-visual-assertions-required): VISUAL_ASSERTIONS_REQUIRED error code present", () => {
    assert.ok(
      CONSTITUTION.includes("VISUAL_ASSERTIONS_REQUIRED"),
      "VISUAL_ASSERTIONS_REQUIRED error code must be in the constitution — deliverable A2 not landed",
    );
  });

  // A2 — Required visual sections
  // Each name in REQUIRED_VISUAL_SECTIONS (tools/evidence-file.ts:342) must
  // appear verbatim in the constitution §3.1 description so users can find the
  // contract without reading TypeScript source.
  // Sync point: if tools/evidence-file.ts REQUIRED_VISUAL_SECTIONS changes,
  // rebuild and re-run; the constitution prose must be updated to match.
  test("A2 (t-a2-required-sections): all REQUIRED_VISUAL_SECTIONS names appear verbatim in constitution", () => {
    for (const name of REQUIRED_VISUAL_SECTIONS_EXPORT) {
      assert.ok(
        CONSTITUTION.includes(name),
        `Required visual section name "${name}" (from tools/evidence-file.ts:342) not found in constitution — A2 sync gap`,
      );
    }
  });

  // -------------------------------------------------------------------------
  // A4 — Wording correction: "accepted and owned by the qa chain at PASS time"
  // replaces the old "authored under the qa chain".
  // -------------------------------------------------------------------------
  test("A4 (t-a4-new-wording-present): corrected wording 'accepted and owned by the qa chain at PASS time' is present", () => {
    assert.ok(
      CONSTITUTION.includes("accepted and owned by the qa chain at PASS time"),
      "New A4 wording 'accepted and owned by the qa chain at PASS time' not found — deliverable A4 not landed",
    );
  });

  test("A4 (t-a4-old-wording-absent): stale wording 'authored under the qa chain' is absent", () => {
    assert.ok(
      !CONSTITUTION.includes("authored under the qa chain"),
      "Old A4 wording 'authored under the qa chain' still present — deliverable A4 not fully landed",
    );
  });

  // -------------------------------------------------------------------------
  // B1 — Terse carve-outs: §1 word cap must not apply to assumption gaps or
  // acceptance criteria.
  // -------------------------------------------------------------------------
  test("B1 (t-b1-assumption-gap): terse carve-out 'assumption gap' is present", () => {
    assert.ok(
      CONSTITUTION.includes("assumption gap"),
      "'assumption gap' carve-out must appear in §1 Terse rule — deliverable B1 not landed",
    );
  });

  test("B1 (t-b1-acceptance-criteria): terse carve-out 'acceptance criteria' is present", () => {
    assert.ok(
      CONSTITUTION.includes("acceptance criteria"),
      "'acceptance criteria' carve-out must appear in §1 Terse rule — deliverable B1 not landed",
    );
  });

  // -------------------------------------------------------------------------
  // B2 — Design-baseline scope: new §1 MVP exception prose must include the
  // canonical phrases that define the design-baseline concept.
  // -------------------------------------------------------------------------
  test("B2 (t-b2-scope-baseline): 'scope baseline' phrase is present", () => {
    assert.ok(
      CONSTITUTION.includes("scope baseline"),
      "'scope baseline' must appear in the §1 design-baseline exception — deliverable B2 not landed",
    );
  });

  test("B2 (t-b2-fidelity-defect): 'fidelity defect' phrase is present", () => {
    assert.ok(
      CONSTITUTION.includes("fidelity defect"),
      "'fidelity defect' must appear in the §1 design-baseline exception — deliverable B2 not landed",
    );
  });

  // -------------------------------------------------------------------------
  // B3 — Intra-document priority tie-breaker
  // Asserts: the override line for §1 by §2/§3/§6/§7 and a circuit-breaker phrase
  // are present, AND the inter-document priority line is preserved.
  // -------------------------------------------------------------------------
  test("B3 (t-b3-override-markers): intra-constitution override line mentions safety/correctness sections overriding efficiency/style", () => {
    assert.ok(
      CONSTITUTION.includes("safety/correctness rules"),
      "'safety/correctness rules' override phrase must be in constitution — deliverable B3 not landed",
    );
    assert.ok(
      CONSTITUTION.includes("efficiency/style rules"),
      "'efficiency/style rules' phrase must be in constitution — deliverable B3 not landed",
    );
  });

  test("B3 (t-b3-circuit-breaker): §5 circuit-breaker phrase is present under Document Priority", () => {
    // The tie-breaker section references §5 anti-loop as the circuit breaker.
    assert.ok(
      CONSTITUTION.includes("anti-loop trips"),
      "'anti-loop trips' circuit-breaker phrase must be in constitution — deliverable B3 not landed",
    );
  });

  test("B3 (t-b3-inter-document-priority): inter-document priority line is preserved", () => {
    // The Document Priority section must still carry the workspace/CLAUDE.md > Constitution order.
    assert.ok(
      CONSTITUTION.includes("Document Priority"),
      "'Document Priority' section must still exist — B3 must not have removed it",
    );
    assert.ok(
      CONSTITUTION.includes(".antigravityrules"),
      "Inter-document priority line referencing .antigravityrules must be preserved",
    );
    assert.ok(
      CONSTITUTION.includes("Higher-priority document wins on conflict"),
      "Inter-document priority tie-breaker sentence must be preserved",
    );
  });
});

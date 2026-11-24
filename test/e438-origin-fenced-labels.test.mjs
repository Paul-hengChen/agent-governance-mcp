// Coded by @qa-engineer
// E438 (prompt-content-hygiene): bare ticket / version labels (E4, v3.14.0, R10 ...) outside the origin fence
// reach every dispatched agent as noise, and four of them were used as NAMES another sentence cites. The fix
// wraps each label in <!-- origin:start -->...<!-- origin:end --> (stripped from every bundle) or renames /
// deletes it. This file pins the 45 sites of the spec's E438 table:
//   AC-E438-1  the dispatch-bundle line carries no label;
//   AC-E438-2  the source still holds the label inside an origin fence (wrap sites) / the rename / the deletion;
//   AC-E438-3  each renamed reference resolves to a heading that exists in the dispatch bundle.
// Spec: specs/e437-prompt-content-hygiene.md (E438 table, AC-E438-1..3).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
const { composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { applyTextTransforms } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));
const dispatch = (t) => applyTextTransforms(t, { fullDetail: false });
const O = "<!-- origin:start -->";
const E = "<!-- origin:end -->";
const fenced = (span) => `${O}${span}${E}`;

/**
 * [site, file, anchor, fencedSpan, labelsThatMustVanish]
 * anchor = text on the line that sits OUTSIDE the fence, so it identifies the line in the source and in the bundle;
 * fencedSpan = exact text that must be inside an origin fence in source.
 */
const WRAP = [
  [1, "const-02-design-mvp.md", "**Visual Widgets exception", " (v3.14.0)", ["v3.14.0"]],
  [2, "const-13-design-chain-s4.md", "`## Mode` is ≠ `no-design` (the", " v3.16.0", ["v3.16.0"]],
  [3, "const-15-core-tail.md", "isolation/set-aside tool", "; E25", ["E25"]],
  [4, "coord-02-host-dispatch.md", "rather than rejected on read", " (E300)", ["E300"]],
  [5, "coord-03-core-fallback.md", "the mismatch signal", " (E99)", ["E99"]],
  [6, "coord-03-core-fallback.md", "**Feature-Scope Gate**", " (E1)", ["(E1)"]],
  [7, "coord-03-core-fallback.md", "**Lane findings are numbered at finish time**", " (E179)", ["E179"]],
  [8, "coord-03-core-fallback.md", "**Bookkeeping never lands on local `main`**", " (E297)", ["E297"]],
  [9, "coord-03-core-fallback.md", "inside its own tree", " (E301)", ["E301"]],
  [10, "coord-05-core-visual-drift.md", "*Sequential-context assumption + reconcile*", " (R10)", ["R10"]],
  [11, "skill-design-auditor.md", "**Design = scope baseline (Constitution §1", ", v3.27.0", ["v3.27.0"]],
  [12, "skill-design-auditor.md", "`credibility` column", " (E4)", ["(E4)"]],
  [13, "skill-design-auditor.md", "- **Visual Widgets**", " (v3.14.0)", ["v3.14.0"]],
  [14, "skill-design-auditor.md", "**Visual Structural Assertions** *(MANDATORY when mode ≠ no-design", "; v3.26.0, R3/R-VIS", ["v3.26.0", "R-VIS"]],
  [15, "skill-design-auditor.md", "**Record the attestation", " (E4)", ["(E4)"]],
  [16, "skill-design-auditor.md", "**Mechanical baseline selection", " (v3.39.0)", ["v3.39.0"]],
  [18, "skill-integrator.md", "## Governance state", " (D11)", ["D11"]],
  [19, "skill-integrator.md", "accepts", " (E177a)", ["E177a"]],
  [20, "skill-integrator.md", "as the Monitor command", " (E177b)", ["E177b"]],
  [21, "skill-integrator.md", "--mailbox-root <lanes-root>/_mailbox --base <sha>`", " (E177a)", ["E177a"]],
  [22, "skill-integrator.md", "for handoff state transitions that arrive without mail", " (E178b)", ["E178b"]],
  [23, "skill-integrator.md", "the addendum names its trigger", ", E298", ["E298"]],
  [24, "skill-integrator.md", "**CI fallback and flake rule", " (E298)", ["E298"]],
  [25, "skill-integrator.md", "**Verifier dispatch", " (E192, D10)", ["E192", "D10"]],
  [26, "skill-integrator.md", "The five verifier constraints", " (E192)", ["E192"]],
  [27, "skill-integrator.md", "run `node <agc install>/scripts/merge-invariants.mjs`", " (E126)", ["E126"]],
  [28, "skill-integrator.md", "no `tw_update_state` on the integration branch", " (the E222 precedent)", ["E222"]],
  [29, "skill-integrator.md", "the single writer", " (E124)", ["E124"]],
  [30, "skill-integrator.md", "It allocates ticket ids", " (E124)", ["E124"]],
  [31, "skill-integrator.md", "moves `.current/<lane>/` to history", " (E125)", ["E125"]],
  [33, "skill-pm.md", "- **Visual Widgets**", " (v3.14.0)", ["v3.14.0"]],
  [34, "skill-pm.md", "**Source-Credibility Gate**", " (E4)", ["(E4)"]],
  // E434 re-pin: path only (the visual sub-skill is now skill-reviewer-visual.md).
  [37, "skill-reviewer-visual.md", "### Step A.0 — Baseline Source-of-Truth", " (v3.39.0)", ["v3.39.0"]],
  [38, "skill-reviewer-visual.md", "### Actual-Capture Output Convention", " (E30)", ["E30"]],
  [41, "skill-sr-engineer.md", "the step 7a format", " (C15)", ["C15"]],
  [43, "skill-architect.md", "the visual gate", " (R1)", ["R1"]],
  [44, "skill-pm.md", "blurs role ownership", " (A10)", ["A10"]],
];

for (const [site, file, anchor, span, labels] of WRAP) {
  test(`AC-E438-1/2 site ${site}: ${file} label ${JSON.stringify(span.trim())} is origin-fenced in source and absent from the dispatch bundle`, () => {
    const source = src(file);
    // AC-E438-2: the fenced span sits on a source line that carries the anchor
    const lines = source.split("\n").filter((l) => l.includes(anchor));
    assert.ok(lines.length >= 1, `anchor present: ${anchor}`);
    assert.ok(lines.some((l) => l.includes(fenced(span))), `source line with anchor must carry ${fenced(span)}`);
    // AC-E438-1: no dispatch line that carries the anchor still has the label
    const bundleLines = dispatch(source).split("\n").filter((l) => l.includes(anchor));
    assert.ok(bundleLines.length >= 1, `anchor survives into the dispatch bundle: ${anchor}`);
    for (const l of bundleLines) {
      for (const lab of labels) assert.ok(!l.includes(lab), `dispatch line still carries "${lab}": ${l.slice(0, 120)}`);
    }
  });
}

test("AC-E438-1/2 site 14: R3/R-VIS and v3.26.0 leave the dispatch bundle and the parenthesis stays well-formed", () => {
  const l = dispatch(src("skill-design-auditor.md")).split("\n").find((x) => x.includes("**Visual Structural Assertions**"));
  assert.ok(l.includes("*(MANDATORY when mode ≠ no-design)*"), "stripped form is '*(MANDATORY when mode ≠ no-design)*'");
});

// E433: qa-engineer is the test author; its Phase 1.5 (site 35), the Visual Widgets checklist line (site 36)
// and the Phase 3.5 line (site 45) left the SOP, so the labels those sites cleaned are re-pinned as absent.
test("AC-E438-1/2 site 35: skill-qa-engineer carries no 'v3.14.0' label and no Phase 1.5 sentence", () => {
  const s = src("skill-qa-engineer.md");
  assert.ok(!s.includes("v3.14.0"), "no v3.14.0 label anywhere in the source");
  assert.ok(!s.includes("Phase 1.5"), "the visual compare phase left the qa SOP (E434 owns the visual judge)");
});

// --- deletions and renames: sites 17, 36, 39, 40, 42, 45 ---

test("AC-E438-1/2 site 36: skill-qa-engineer carries no 'Visual Widgets shape checklist' sentence and no version label before it", () => {
  const s = src("skill-qa-engineer.md");
  assert.ok(!s.includes("Visual Widgets shape checklist"), "the checklist sentence left the qa SOP");
  assert.ok(!s.includes("the v3.14.0 Visual Widgets shape checklist"), "old wording gone");
});

test("AC-E438-1/2 site 45: skill-qa-engineer carries no '(pre-E3)' label", () => {
  const s = src("skill-qa-engineer.md");
  assert.ok(!s.includes("pre-E3"), "no pre-E3 label anywhere in the source");
});

test("AC-E438-3 renames: the four renamed references use the new names and the old id-as-name forms are gone from content and templates", () => {
  const files = fs.readdirSync(path.join(ROOT, "content")).filter((f) => f.endsWith(".md") && f !== "constitution-rationale.md");
  const all = files.map((f) => src(f)).join("\n");
  assert.ok(src("skill-design-auditor.md").includes("(Constitution §1 *Design-sourced assets*)"), "site 17 rename");
  assert.ok(src("skill-sr-engineer.md").includes("(Constitution §1 Design-sourced assets.)"), "site 39 rename (v3.28.0 dropped)");
  assert.ok(src("skill-sr-engineer.md").includes("(Constitution §1 Visual Widgets exception)"), "site 40 rename");
  assert.ok(src("skill-architect.md").includes("(skill-sr-engineer *Scoped Render Self-Check*)"), "site 42 rename");
  for (const old of ["§1 v3.14.0 exception", "§1 v3.28.0", "Design-sourced assets v3.28.0", "sr-engineer R5"]) {
    assert.ok(!all.includes(old), `old name "${old}" must not remain in content/**`);
  }
  const dir = path.join(ROOT, "templates", "claude-code-agents");
  const tpl = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf-8")).join("\n");
  for (const old of ["§1 v3.14.0 exception", "§1 v3.28.0", "sr-engineer R5"]) assert.ok(!tpl.includes(old), `old name "${old}" absent from templates`);
});

test("AC-E438-3: each new reference name matches a heading that exists in the dispatch bundle (design arm)", () => {
  const constitution = dispatch(composeConstitution({ chain: true, design: true }));
  assert.match(constitution, /\*\*Visual Widgets exception\*\*:/, "Constitution §1 Visual Widgets exception heading");
  assert.match(constitution, /\*\*Design-sourced assets\*\*/, "Constitution §1 Design-sourced assets heading");
  assert.match(dispatch(src("skill-sr-engineer.md")), /\*\*Scoped Render Self-Check\*\*/, "skill-sr-engineer Scoped Render Self-Check heading survives (its label is fenced)");
});

// E435 rewrites these lines in place (marker clause, judge label, PASS restriction); the rewrite must keep each
// origin fence where one was, and add no bare label to the dispatch bundle. Anchors survive the rewrite.
test("AC-E438-1/2 (E435): lines E435 rewrites keep their origin fences and carry no bare label in the dispatch bundle", () => {
  const LABEL = /\bE\d+[a-z]?\b|\bv\d+\.\d+\.\d+\b/;
  const SITES = [
    ["const-08-chain-31-mid.md", "Completed-Tasks Gate", " (v3.100.0, E40)"],
    ["skill-pm.md", "**Bugfix mode**", " (v3.73.0, E2)"],
    ["coord-03-core-fallback.md", "**Hop counter scope**", " (v3.67.0, D2)"],
    ["skill-pm.md", "8. `tw_update_state(active_feature=<name>", null],
    ["const-06-chain-31-head.md", "`tw_complete_task` require the chain's judge", null],
    ["const-11-design-chain-32.md", "server-restricted to", null],
    ["coord-07-core-sop.md", "**(ii) mini-chain**", null],
    ["skill-architect.md", "7. Otherwise: `tw_update_state(", null],
  ];
  for (const [f, anchor, span] of SITES) {
    const s = src(f);
    const line = s.split("\n").find((l) => l.includes(anchor));
    assert.ok(line, `${f}: anchor line present: ${anchor}`);
    if (span) assert.ok(line.includes(fenced(span)), `${f}: anchor line keeps ${fenced(span)}`);
    const out = dispatch(s).split("\n").find((l) => l.includes(anchor));
    const m = out && out.match(LABEL);
    assert.ok(out && !m, `${f}: dispatch line "${anchor}" carries bare label "${m && m[0]}"`);
  }
});

test("AC-E438-1: the dispatch bundles of the files whose every label was a site carry no bare ticket/version label", () => {
  // integrator (sites 18-32), reviewer-visual (was qa-visual, E434; 7/37/38 + E437 8), coord-03 (5-9): after the strip no E<n> / v<n>.<n>.<n> token remains.
  const LABEL = /\bE\d+[a-z]?\b|\bv\d+\.\d+\.\d+\b/;
  for (const f of ["skill-integrator.md", "skill-reviewer-visual.md", "coord-03-core-fallback.md"]) {
    for (const line of dispatch(src(f)).split("\n")) {
      const m = line.match(LABEL);
      assert.ok(!m, `${f}: bare label "${m && m[0]}" in dispatch bundle line: ${line.slice(0, 140)}`);
    }
  }
});

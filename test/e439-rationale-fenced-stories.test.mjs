// Coded by @qa-engineer
// E439 (prompt-content-hygiene): an incident story sitting next to the rule it produced costs every dispatched
// agent tokens for "why" prose it never acts on. The 11 sites of the spec's E439 table move the story inside
// <!-- rationale:start -->...<!-- rationale:end --> (stripped from dispatch bundles, kept in full-detail), and the
// rule left outside the fence must still stand alone. Site 1 (const-11 §3.2 preamble) is ruled R1 = b: deleted,
// not fenced (§3.x stays rationale-free; the story lives in content/constitution-rationale.md).
//   AC-E439-1  dispatch bundle: story absent, rule present verbatim, one assertion per site;
//   AC-E439-2  full-detail bundle: the story is still there, between the markers (site 5 punctuation aside);
//   AC-E439-3  fence shape: no new asymmetric span (render-structure.test.mjs owns the sweep; the block-style
//              sites 3 and 8 are pinned here so the fence placement cannot regress to the glue shape).
// Spec: specs/e437-prompt-content-hygiene.md (E439 table, Fence placement constraint).
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
const fullDetail = (t) => applyTextTransforms(t, { fullDetail: true });
const RS = "<!-- rationale:start -->";
const RE = "<!-- rationale:end -->";
const squash = (t) => t.replace(/\s+/g, " ");

// [site, file, story (inside the fence), rule (left outside, must survive in the dispatch bundle)]
const SITES = [
  [2, "skill-pm.md",
    'This section closes the gap where a column-scroller widget was never enumerated → primitive `<input type="date">` shipped → no role had grounds to reject.',
    "**Cross-reference to Constitution §1**: when a widget is listed here, sr-engineer substituting an HTML primitive constitutes scope violation, not MVP compliance. If `design/<feature>.md` exists and contains a `## Visual Widgets` section"],
  [3, "skill-architect.md",
    "Closes the gap where `design/<feature>.md` carried Visual Baselines but no role owned building the comparator",
    "The architect's job here is to make sure PM did this — if the spec's task list omits the harness task, block back to PM."],
  [4, "skill-design-auditor.md",
    '(a prior audit "resolved" baselines to the wrong frames by name)',
    "Name- or number-matching alone is INSUFFICIENT."],
  [5, "skill-design-auditor.md",
    "Closes the gap where PM-only widget enumeration relied on free-form judgement.",
    "Design-auditor is the upstream owner because the design source carries the component names"],
  [6, "skill-design-auditor.md",
    "(`research/mode-feature-process-retrospective.md` §四#7: toggle ON had two Figma variants but was compressed into one, producing an incorrect implementation)",
    "Collapsing a context-dependent property into one answer bakes a wrong spec."],
  [7, "skill-design-auditor.md",
    "P2 was saved by this behaviour; P1 was reopened for lack of it (see `research/mode-feature-process-retrospective.md` §四#2).",
    "Do NOT transcribe values from the wrong node type; the guardrail fires BEFORE any values are written to the audit artifact. `image`/`pdf`/`paper`/`no-design` modes skip this gate"],
  [8, "skill-design-auditor.md",
    "(Method and rationale: `research/figma-baselines.md`.)",
    "Empty-shell guard from step 4 still applies to every selected node."],
  [9, "skill-sr-engineer.md",
    "(a prior rollout invented boxed-chips + copy)",
    "**Inventing a layout/row style is a scope violation, not a default**."],
  [10, "skill-sr-engineer.md",
    "(a prior rollout shipped grey `#333` primary buttons while accent `#3C5AAA` sat unused)",
    "A declared focus/selected/accent token that renders nowhere is a **build-gate failure** — fix before handoff."],
  [11, "skill-qa-visual.md",
    "(this once cost a full pixelmatch forensics round to clear a false alarm)",
    "Actuals written next to committed baselines dirty git status on every run, making a real visual regression indistinguishable from routine overwrite at a glance."],
];

for (const [site, file, story, rule] of SITES) {
  test(`AC-E439-1 site ${site}: ${file} story is fenced in source, absent from the dispatch bundle, and the rule left outside stands alone`, () => {
    const source = src(file);
    const fences = [...source.matchAll(/<!-- rationale:start -->([\s\S]*?)<!-- rationale:end -->/g)].map((m) => m[1]);
    assert.ok(fences.some((f) => squash(f).includes(squash(story))), `story is inside a rationale fence: ${story.slice(0, 60)}`);
    const d = squash(dispatch(source));
    // the story's distinguishing words must be gone from the dispatch bundle
    const probe = story.replace(/^[(\s]+|[).\s]+$/g, "").slice(0, 50);
    assert.ok(!d.includes(squash(probe)), `story leaks into the dispatch bundle: ${probe}`);
    assert.ok(d.includes(squash(rule)), `rule left outside the fence must be present verbatim: ${rule.slice(0, 80)}`);
  });

  test(`AC-E439-2 site ${site}: ${file} full-detail bundle still carries the story between the markers`, () => {
    const fd = fullDetail(src(file));
    assert.ok(fd.includes(RS) && fd.includes(RE), "markers survive in the full-detail bundle");
    const spans = [...fd.matchAll(/<!-- rationale:start -->([\s\S]*?)<!-- rationale:end -->/g)].map((m) => squash(m[1]));
    assert.ok(spans.some((s) => s.includes(squash(story))), `story kept inside the fence in full-detail: ${story.slice(0, 60)}`);
  });
}

test("AC-E439-1/2 site 5: the story ends in '.' (not ';') and the rule starts 'Design-auditor' (capital D) — the one punctuation exception", () => {
  const source = src("skill-design-auditor.md");
  assert.ok(source.includes(`${RS} Closes the gap where PM-only widget enumeration relied on free-form judgement.${RE} Design-auditor is the upstream owner`), "site 5 exact shape");
  assert.ok(!source.includes("free-form judgement; design-auditor"), "old ';' + lowercase form gone");
});

test("AC-E439-1 site 1 (R1 = b): the const-11 §3.2 preamble is deleted — absent from source, both bundles, and the heading is followed directly by the first bullet", () => {
  const source = src("const-11-design-chain-32.md");
  for (const gone of ["Hard governance rules that emerged from a visual false-PASS retrospective", "The decisive failure was a", "proved insufficient, so these are also server-enforced", "report-schema\nvalidation"]) {
    assert.ok(!source.includes(gone), `source no longer carries: ${gone.slice(0, 50)}`);
  }
  assert.ok(!source.includes(RS), "§3.x stays rationale-free: no fence added in const-11");
  assert.match(source, /### 3\.2 Visual Verdict Authority & Separation of Duties<!-- origin:start --> \(v3\.26\.0\)<!-- origin:end -->\n\n- \*\*Visual verdict is qa-visual-owned\.\*\*/, "heading then first bullet");
  for (const opts of [{ chain: true, design: true }, { chain: false, design: true }]) {
    const c = composeConstitution(opts);
    assert.ok(!c.includes("false-PASS retrospective"), `constitution (${JSON.stringify(opts)}) carries no preamble`);
    // §3.2 is a chain-only segment; the lite composition does not load it at all
    if (opts.chain) assert.ok(dispatch(c).includes("### 3.2 Visual Verdict Authority & Separation of Duties\n\n- **Visual verdict is qa-visual-owned.**"), "dispatch: heading directly followed by its rule bullets");
  }
  // the story still exists in the non-normative rationale file (one-way ref)
  assert.ok(fs.readFileSync(path.join(ROOT, "content", "constitution-rationale.md"), "utf-8").includes("false-PASS"), "story kept in constitution-rationale.md");
});

test("AC-E439-3: the block-style fences (sites 3 and 8) do not glue the next line onto the rule in the dispatch bundle", () => {
  // Site 8 is block-style: marker alone on its own line, so the stripped bundle keeps the next bullet on its own line.
  const da = dispatch(src("skill-design-auditor.md"));
  assert.ok(da.includes("Empty-shell guard from step 4 still applies to every selected node.\n   - **Server-enforced at PASS"), "site 8: next bullet starts its own line");
  // Site 3 keeps a non-newline character after rationale:end, so no fusion with the following block either.
  const ar = dispatch(src("skill-architect.md"));
  assert.ok(ar.includes("block back to PM.\n\n  #### Baseline Reachability Matrix"), "site 3: blank line + next heading preserved");
});

// Coded by @qa-engineer
// Tests for spec: specs/e393-builder-judge-core.md (AC-A1, AC-A2, AC-B, AC-B11-eq, AC-C, AC-C01).
// WHY: the builder ≠ judge role-collapse guard used to live only in the design-only §3.2
// fragment while core SOP fragments cited it as a hard floor; E393 moved it into core §3 so every
// composition that loads a citation also carries the rule, and replaced bare round numbers with
// named caps so a Limits-table change cannot leave stale numbers in body text. These tests pin
// the contract (rule present once per composition, citations resolve, no bare caps), not a base sha.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { stripRationale, stripOriginTags, composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));

const C = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
const count = (hay, needle) => hay.split(needle).length - 1;

const ANCHOR = "**Builder ≠ judge (role-collapse guard)**:";
// The AC-A1 bullet as shipped (human ruling t3: the "— even a role run inline ... —" aside was trimmed).
const BULLET =
  "- **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change MUST NOT author its code-review verdict, its qa verdict (visual verdict included), or its PASS. With no independent judge context available, the work stops at `status=Blocked` (\"awaiting independent QA\") — never a builder-signed verdict.";

const COMBOS = [
  { chain: false, design: false },
  { chain: false, design: true },
  { chain: true, design: false },
  { chain: true, design: true },
];
const label = (o) => `${o.chain ? "chain" : "lite"}/${o.design ? "design" : "non-design"}`;
const strip = (t) => stripRationale(stripOriginTags(t));

test("AC-A1: builder ≠ judge rule is in const-05 §3 and in all four compositions", () => {
  const c05 = C("const-05-core-standards.md");
  const sec3 = c05.slice(c05.indexOf("## 3."), c05.indexOf("## 4."));
  assert.ok(sec3.length > 0, "const-05 must have a §3 section");
  assert.equal(count(c05, ANCHOR), 1, "anchor appears exactly once in const-05");
  assert.ok(sec3.includes(ANCHOR), "the rule sits inside const-05 §3 (State Synchronisation)");
  assert.ok(sec3.includes(BULLET), "the as-shipped bullet text is present verbatim");
  for (const o of COMBOS) {
    const full = composeConstitution(o);
    assert.equal(count(full, ANCHOR), 1, `${label(o)} fullDetail: anchor exactly once`);
    assert.equal(count(strip(full), ANCHOR), 1, `${label(o)} stripped: anchor survives stripping exactly once`);
    assert.ok(strip(full).includes(BULLET), `${label(o)} stripped: bullet intact (core rule, not rationale)`);
  }
});

test("AC-A2: const-11 §3.2 keeps its header and exactly two visual bullets", () => {
  const c11 = C("const-11-design-chain-32.md");
  assert.ok(c11.includes("### 3.2 Visual Verdict Authority & Separation of Duties"), "§3.2 header kept");
  assert.equal(count(c11, "Builder ≠ judge"), 0, "the moved bullet is gone");
  assert.ok(!/builder/i.test(c11), "no 'builder' wording remains in const-11");
  const bullets = c11.split("\n").filter((l) => l.startsWith("- **"));
  assert.equal(bullets.length, 2, "exactly two bullets remain");
  assert.ok(bullets[0].startsWith("- **Visual verdict is qa-visual-owned."));
  assert.ok(bullets[1].startsWith("- **No global-frame metric."));
});

test("AC-B: every builder ≠ judge citation resolves in each composition that loads it", () => {
  const citing = [
    ["const-04-design-surgical.md", "§3 builder ≠ judge", (o) => o.design],
    ["coord-02-host-dispatch.md", "§3 builder ≠ judge", (o) => o.chain],
    ["coord-03-core-fallback.md", "builder ≠ judge, §3)", (o) => o.chain],
    ["coord-05-core-visual-drift.md", "§3 builder ≠ judge", (o) => o.chain],
    ["coord-07-core-sop.md", "§3 builder ≠ judge", (o) => o.chain],
    ["skill-integrator.md", "§3 builder ≠ judge", (o) => o.chain],
    ["skill-sr-engineer.md", "(§3 builder ≠ judge)", (o) => o.chain],
    ["skill-qa-visual.md", "§3 builder ≠ judge provenance", (o) => o.chain && o.design],
  ];
  const stale = [/§3\.2 builder/, /builder≠judge/, /builder ≠ judge, §3\.2/, /builder \(§3\.2\)/];
  for (const [file, wording, loadedIn] of citing) {
    const text = C(file);
    assert.ok(text.includes(wording), `${file} cites the new anchor wording (${wording})`);
    for (const re of stale) assert.doesNotMatch(text, re, `${file} has no stale §3.2 builder form ${re}`);
    for (const o of COMBOS.filter(loadedIn)) {
      assert.equal(count(composeConstitution(o), ANCHOR), 1, `${file} loads in ${label(o)}, whose constitution must carry the rule`);
    }
  }
  // skill-qa-engineer cites the rule through its escalation prose rather than the anchor; it must at
  // least not carry a stale §3.2 builder form.
  for (const re of stale) assert.doesNotMatch(C("skill-qa-engineer.md"), re);
  // The adapter line loads in all four compositions' hosts.
  for (const o of COMBOS) assert.equal(count(composeConstitution(o), ANCHOR), 1, `adapter citation resolves in ${label(o)}`);
});

test("AC-B11: adapter template line equals the CLAUDE.md adapter line", () => {
  const line = (f) => fs.readFileSync(path.join(ROOT, f), "utf-8").split("\n").filter((l) => l.startsWith("- Subagent dispatch:"));
  const tpl = line("templates/agent-adapters/claude.md");
  const doc = line("CLAUDE.md");
  assert.equal(tpl.length, 1, "template has exactly one Subagent-dispatch line");
  assert.equal(doc.length, 1, "CLAUDE.md has exactly one Subagent-dispatch line");
  assert.equal(Buffer.compare(Buffer.from(tpl[0]), Buffer.from(doc[0])), 0, "byte-identical");
  assert.ok(tpl[0].includes("voids Constitution §3 builder != judge"), "ASCII §3 anchor present");
  assert.ok(!tpl[0].includes("§3.2"), "no stale §3.2");
});

test("AC-C: named sites restate no bare round number", () => {
  // const-06 / 08 / 09 / 12: no bare round-number forms at all.
  for (const f of ["const-06-chain-31-head.md", "const-08-chain-31-mid.md", "const-09-design-chain-vround.md", "const-12-chain-r10-s4.md"]) {
    assert.doesNotMatch(C(f), /Round \d|round \d|>= ?\d|up to \d|\d more rounds/, `${f} has a bare round number`);
  }
  // Named-cap phrasing per row.
  assert.ok(C("const-06-chain-31-head.md").includes("cap of QA FAILs is exhausted"), "C02 qa_round cap named");
  assert.ok(C("const-08-chain-31-mid.md").includes("cap of code-reviewer FAILs is exhausted"), "C03 review_round cap named");
  const c09 = C("const-09-design-chain-vround.md");
  assert.ok(c09.includes("any round past it locks"), "C04 visual_round cap named");
  assert.ok(c09.includes("Split escalation (`visual_split`)"), "C05a");
  assert.ok(c09.includes("once `visual_round` reaches the `visual_split` threshold"), "C05a");
  assert.ok(c09.includes("grinding the remaining rounds"), "C05b");
  assert.ok(c09.includes("from the `visual_split` threshold through the `visual_round` cap; mandatory route past the cap"), "C05c");
  const c12 = C("const-12-chain-r10-s4.md");
  assert.ok(c12.includes("up to the\n`review_round` cap"), "C07 review_round cap named");
  assert.ok(c12.includes("(up to the `qa_round` cap)"), "C08 qa_round cap named");
  // skill-qa-engineer / skill-qa-visual / skill-sr-engineer.
  const qe = C("skill-qa-engineer.md");
  assert.ok(qe.includes("*Escalation Routes: unresolved at the `qa_round` cap*"), "C09");
  assert.ok(qe.includes("Once the `qa_round` cap of prior FAILs is exhausted"), "C10");
  assert.ok(qe.includes("| unresolved at the `qa_round` cap | FAIL | `QA: <task-id> unresolved at the qa_round cap` | pm |"), "C11");
  const qv = C("skill-qa-visual.md");
  assert.ok(qv.includes("Past the `visual_round` cap, only"), "C12 visual_round cap named");
  assert.ok(qv.includes("| FAIL past the `visual_round` cap |"), "C13");
  const sr = C("skill-sr-engineer.md");
  assert.ok(sr.includes("`visual_round` ≥ `visual_split` and you assess"), "C14");
  assert.ok(sr.includes("(`visual_round` ≥ `visual_split`, cannot converge within budget)"), "C15");
  for (const f of ["skill-sr-engineer.md", "skill-qa-visual.md", "skill-qa-engineer.md"]) {
    assert.doesNotMatch(C(f), /visual_round >= 3|Round 3|Round 4|Round 6|visual round 6/, `${f} has a bare cap number`);
  }
  // qa Escalation Routes table keeps its 7 data rows (rename only).
  const routes = qe.slice(qe.indexOf("## Escalation Routes"));
  const rows = routes.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| situation") && !l.startsWith("|---"));
  assert.equal(rows.length, 7, "Escalation Routes table keeps 7 data rows");
});

test("AC-C01: Limits table has the visual_split row", () => {
  const head = C("const-01-core-head.md");
  assert.ok(head.startsWith("# Constitution\n"), "AC5: constitution header is the version-free '# Constitution'");
  const row = head.split("\n").find((l) => l.startsWith("| `visual_split` threshold"));
  assert.ok(row, "visual_split row exists in the Limits table");
  const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
  assert.equal(cells[1], "3", "visual_split value is 3");
  assert.ok(/`visual_round`/.test(cells[2]), "meaning names visual_round");
  for (const o of COMBOS) assert.ok(composeConstitution(o).includes(row), `${label(o)} carries the Limits row`);
});

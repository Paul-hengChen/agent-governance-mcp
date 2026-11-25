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
  "- **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change MUST NOT author its code-review verdict (visual verdict included) or its PASS. With no independent judge context available, the work stops at `status=Blocked` (\"awaiting an independent judge\") — never a builder-signed verdict.";

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

// E434 re-pin: the first bullet names the judge's sub-skill (const11.head) and §3.2 adds the measure-first
// rule (const11.measure), so the bullet count is no longer pinned; the builder ≠ judge move still is.
test("AC-A2: const-11 §3.2 keeps its header, opens with the reviewer-visual verdict bullet and keeps the no-global-frame bullet", () => {
  const c11 = C("const-11-design-chain-32.md");
  assert.ok(c11.includes("### 3.2 Visual Verdict Authority & Separation of Duties"), "§3.2 header kept");
  assert.equal(count(c11, "Builder ≠ judge"), 0, "the moved bullet is gone");
  assert.ok(!/builder/i.test(c11), "no 'builder' wording remains in const-11");
  const bullets = c11.split("\n").filter((l) => l.startsWith("- **"));
  assert.ok(bullets.length >= 2, "at least the two visual bullets remain");
  assert.ok(bullets[0].startsWith("- **Visual verdict is reviewer-visual-owned.**"), "first bullet is const11.head");
  assert.ok(bullets.some((b) => b.startsWith("- **No global-frame metric.")), "no-global-frame bullet kept");
});

// E435 (T-E435-41 Copy row): there is one chain, so the §3.2 enforcement sentence and its rationale
// restate the PASS restriction unconditionally; "on the test-first chain" would imply a second chain
// whose PASS someone else may write (AC7).
test("AC-A3 (E435): const-11 §3.2 enforcement and its rationale restrict status=PASS to code-reviewer with no chain condition", () => {
  const c11 = C("const-11-design-chain-32.md");
  const rat = C("constitution-rationale.md");
  assert.ok(c11.includes("the judge's PASS, and `status=PASS` is server-restricted to\n  `agent_id=\"code-reviewer\"`"), "const-11 line 10 per Copy");
  assert.ok(rat.includes("PASS, and `status=PASS` is server-restricted to\n`agent_id=\"code-reviewer\"`"), "rationale line 149 per Copy");
  for (const [f, t] of [["const-11", c11], ["rationale", rat]]) assert.ok(!t.includes("on the test-first chain"), `${f} names no test-first chain`);
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
    ["skill-reviewer-visual.md", "§3 builder ≠ judge", (o) => o.chain && o.design],
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

test("AC-C (E435): named sites restate no bare round number", () => {
  // const-06 / 08 / 09 / 12: no bare round-number forms at all.
  for (const f of ["const-06-chain-31-head.md", "const-08-chain-31-mid.md", "const-09-design-chain-vround.md", "const-12-chain-r10-s4.md"]) {
    assert.doesNotMatch(C(f), /Round \d|round \d|>= ?\d|up to \d|\d more rounds/, `${f} has a bare round number`);
  }
  // Named-cap phrasing per row.
  // E433 (D10): the qa FAIL loop is gone; const-06 names the review_round and sr_return caps instead.
  assert.ok(C("const-06-chain-31-head.md").includes("toward the `sr_return` cap, past which that return is rejected"), "C02 sr_return cap named");
  assert.ok(C("const-08-chain-31-mid.md").includes("cap of code-reviewer FAILs is exhausted"), "C03 review_round cap named");
  // E434 (ruling 7): const-09 no longer runs a visual counter; a visual rejection counts in `review_round` and a
  // shrinking pixel difference runs into the named `fix_try` cap (C04/C05 retired with the visual loop).
  const c09 = C("const-09-design-chain-vround.md");
  assert.ok(c09.includes("counts once in `review_round`"), "C04 visual rejections counted in review_round");
  assert.ok(c09.includes("at the `fix_try` cap of tries that do not shrink it"), "C05 the fix_try cap named, no bare number");
  assert.ok(!c09.includes("visual_split") && !c09.includes("visual_round"), "C05 split threshold and visual counter retired");
  const c12 = C("const-12-chain-r10-s4.md");
  assert.ok(c12.includes("past the `review_round` cap only pm may take the feature"), "C07 review_round cap named (E433 loop wording)");
  assert.ok(c12.includes("Each sr-engineer return to qa-engineer counts toward the `sr_return` cap, past which that return is rejected until pm re-enters (file mode only); a scenario that cannot be built stops to pm (Blocked), never to qa-engineer."), "C08 sr_return cap named");
  // skill-qa-engineer / skill-qa-visual / skill-sr-engineer.
  const qe = C("skill-qa-engineer.md");
  // E433: qa-engineer writes no FAIL, so its qa_round cap rows are gone (C09-C11); the cap it meets is sr_return.
  // E435 (T-E435-32 Copy): the qa round counter and its code leave the SOP altogether.
  assert.ok(!qe.includes("`qa_round` cap"), "C09-C11 the qa SOP restates no qa_round cap");
  assert.ok(!/qa_round|QA_ROUND_EXCEEDED/.test(qe), "C09-C11 (E435) the qa SOP names no qa_round counter or QA_ROUND_EXCEEDED");
  assert.ok(qe.includes("counts toward the `sr_return` cap, which the server checks on your claim"), "qa SOP names the sr_return cap");
  // E434: the visual sub-skill (skill-reviewer-visual) has no visual_round cap rows (C12/C13 retired); sr's
  // split route (C14/C15) became the pixel-progress rule, which names the `fix_try` cap.
  const rv = C("skill-reviewer-visual.md");
  assert.ok(!rv.includes("visual_round"), "C12/C13 no visual_round cap in the visual sub-skill");
  const sr = C("skill-sr-engineer.md");
  assert.ok(!sr.includes("visual_split"), "C14/C15 split route retired");
  assert.ok(sr.includes("only tries that do not shrink it count toward the `fix_try` cap"), "C14 the fix_try cap named");
  for (const f of ["skill-sr-engineer.md", "skill-reviewer-visual.md", "skill-qa-engineer.md"]) {
    assert.doesNotMatch(C(f), /visual_round >= 3|Round 3|Round 4|Round 6|visual round 6/, `${f} has a bare cap number`);
  }
  // qa Escalation Routes table: the 2 test-author rows (scenario defect, interface collision) after E433.
  const routes = qe.slice(qe.indexOf("## Escalation Routes"));
  const rows = routes.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| situation") && !l.startsWith("|---"));
  assert.equal(rows.length, 2, "Escalation Routes table keeps its 2 data rows");
});

// E434 re-pin (ruling 7): the visual counter and split threshold left the Limits table; the `fix_try` cap
// row that bounds pixel iteration stays and loads in every composition.
test("AC-C01: Limits table has no visual_split / visual_round cap row; the fix_try cap row stays (E434)", () => {
  const head = C("const-01-core-head.md");
  assert.ok(head.startsWith("# Constitution\n"), "AC5: constitution header is the version-free '# Constitution'");
  const lines = head.split("\n");
  assert.ok(!lines.some((l) => l.startsWith("| `visual_split` threshold")), "no visual_split row");
  assert.ok(!lines.some((l) => l.startsWith("| `visual_round` cap")), "no visual_round cap row");
  const row = lines.find((l) => l.startsWith("| `fix_try` cap"));
  assert.ok(row, "fix_try cap row exists in the Limits table");
  for (const o of COMBOS) {
    const c = composeConstitution(o);
    assert.ok(c.includes(row), `${label(o)} carries the fix_try Limits row`);
    assert.ok(!c.includes("`visual_split` threshold"), `${label(o)} carries no visual_split row`);
  }
});

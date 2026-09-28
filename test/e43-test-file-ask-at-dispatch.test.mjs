// Coded by @qa-engineer
// Tests for ticket E43 (docs/backlog.md, order 7) — T-E43-02.
//
// The defect E43 closed: Constitution §2's *Conditional test writing* bullet said
// "qa-engineer MUST ask the user before creating any [test file]", which a Task-dispatched
// subagent cannot do — no ask channel, no resumption path. Its only available compliances
// were (a) halt the round and lose the context or (b) decide and disclose; E38's QA round
// took (b) and recorded the deviation. A rule everyone must violate to function teaches
// that rules are negotiable, so the fix moves the ask UPSTREAM to the dispatcher, who is
// reachable by a human at brief time.
//
// Ticket-to-Test map (the backlog row is the spec — mini-chain, no specs/ file):
//   fix (i) dispatcher decides            -> t-e43-branch-a-reads-the-brief,
//                                            t-e43-coord02-template-line,
//                                            t-e43-coord02-rule-is-target-conditional
//   round-1 F1 (two-sided outcome)        -> t-e43-branch-c-is-two-sided
//   round-1 F2 (branches must partition)  -> t-e43-branches-partition-with-catch-all
//   no-silent-either-direction            -> t-e43-no-silent-create-or-skip
//   retired unexecutable form is gone     -> t-e43-retired-form-absent-everywhere
//   §2 no-restatement + brief-first       -> t-e43-qa-sop-defers-to-const2
//   cross-file label coherence            -> t-e43-placement-label-is-one-string
//   normative text must not be stripped   -> t-e43-branches-survive-strip
//   guard-the-guard (must red pre-fix)    -> t-e43-assertions-red-against-pre-e43-text
//
// WHY these are CLASS assertions where possible (E66 option (ii) / E69 precedent, both of
// which paid off): the realistic regression is not "someone deletes branch (b)" — it is
// someone adding a fourth branch that reintroduces a fall-through, adding a conditional
// template line without stating when it applies, or drifting the `Test-file placement`
// label in one of the three files that must agree on it. Instance pins on today's wording
// would miss all three.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const CONTENT = path.join(ROOT, "content");

const { applyTextTransforms } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));

const read = (f) => fs.readFileSync(path.join(CONTENT, f), "utf-8");
const CONST05 = read("const-05-core-standards.md");
const COORD02 = read("coord-02-host-dispatch.md");
const QA_SOP = read("skill-qa-engineer.md");

// The label the dispatcher writes, the SOP reads, and §2 branch (a) points at. One string,
// three files — drift here is silent (the brief carries a line nobody is told to read).
const PLACEMENT_LABEL = "Test-file placement";

// Hermetic fixture: the exact pre-E43 §2 sentence. Embedded as a literal, NOT read from
// git history — test/render-structure.test.mjs's E77 meta-test forbids history-as-fixture.
const PRE_E43_BULLET =
  "- **Conditional test writing** (qa-engineer): Not every task needs new tests. If existing test files cover the scope, modify them. If NO relevant test file exists, qa-engineer MUST ask the user before creating any — do not assume.";

function conditionalBullet(text) {
  const line = text.split("\n").find((l) => l.includes("**Conditional test writing**"));
  assert.ok(line, "const-05 must still carry a *Conditional test writing* bullet");
  return line;
}

// Split the bullet into its lettered branches: "(a) ... ; (b) ... ; (c) ... ." Returns the
// span of each branch, keyed by letter, so assertions target a branch rather than the line.
function branches(bullet) {
  const out = new Map();
  const re = /\(([a-z])\)\s([^;]*?)(?=;\s\([a-z]\)\s|\.\s[A-Z])/g;
  let m;
  // FIRST match per letter wins: the bullet's trailing rationale sentence legitimately
  // says "never compliant under (c)", and a last-wins parser would silently overwrite the
  // real branch span with that back-reference — which is exactly how a parser bug turns
  // these pins into decoration.
  while ((m = re.exec(bullet)) !== null) if (!out.has(m[1])) out.set(m[1], m[2]);
  return out;
}

test("t-e43-branches-partition-with-catch-all (round-1 F2): §2's branches are ordered and the LAST one is a true catch-all", () => {
  const b = branches(conditionalBullet(CONST05));
  const letters = [...b.keys()];
  assert.deepEqual(letters, ["a", "b", "c"], `expected exactly branches a,b,c — got ${letters.join(",")}`);

  // The class invariant, not an instance pin: whatever the last branch says, its predicate
  // must be residual ("otherwise"), so no acting context can fall through all of them. The
  // pre-fix round-1 text failed exactly here — (b) required a reachable human and (c)
  // required Task dispatch, leaving an unattended inline run uncovered.
  const last = b.get(letters[letters.length - 1]);
  assert.match(last, /^otherwise\b/i, `the last branch must be a catch-all beginning "otherwise" — got: ${last.slice(0, 80)}`);
  assert.match(last, /no reachable human/i, "the catch-all must name the no-reachable-human case, not only Task dispatch");
});

test("t-e43-branch-a-reads-the-brief (fix (i)): branch (a) is the dispatcher-resolved path", () => {
  const a = branches(conditionalBullet(CONST05)).get("a");
  assert.match(a, /brief/i, "branch (a) must key on the dispatch brief");
  assert.match(a, /pre-authoriz/i, "branch (a) must accept a pre-authorization, not only a named file");
  assert.match(a, /no ask/i, "branch (a) must state that no ask is owed once the brief resolved it");
});

test("t-e43-branch-c-is-two-sided (round-1 F1): the catch-all permits BOTH creating and judging none needed", () => {
  const c = branches(conditionalBullet(CONST05)).get("c");
  assert.match(c, /create/i, "the catch-all must permit creating the file");
  assert.match(c, /no new test is warranted/i,
    "the catch-all must ALSO permit concluding no new test is warranted — the bullet's own first sentence says not every task needs tests, and T-E52-01's round required exactly that outcome");
  assert.match(c, /pending_notes/, "the catch-all must require disclosure in pending_notes");
  assert.match(c, /qa_review/, "the catch-all must require disclosure in qa_review");
});

test("t-e43-no-silent-create-or-skip: both unaccountable outcomes are barred, not just one", () => {
  const bullet = conditionalBullet(CONST05);
  assert.match(bullet, /Never create, and never skip, silently\./,
    "once the catch-all permits a no-test outcome, the silent-SKIP direction needs the same bar as silent creation — barring only one trades one unaccountable outcome for another");
});

test("t-e43-retired-form-absent-everywhere: the unexecutable pre-E43 instruction survives in no content file", () => {
  // Class assertion across every constitution fragment and role SOP, not just the two
  // files this ticket edited: the whole point of E43 is that this instruction cannot be
  // complied with under Task dispatch, so a copy of it anywhere is the same defect.
  const files = fs.readdirSync(CONTENT).filter((f) => /^(const-\d\d-|coord-\d\d-|skill-).*\.md$/.test(f));
  assert.ok(files.length > 20, "sanity: the content/ sweep must actually be finding fragments");
  const offenders = files.filter((f) => /MUST ask the user before creating/i.test(read(f)) || /ask the user whether tests are needed/i.test(read(f)));
  assert.deepEqual(offenders, [], `these files still carry the unexecutable ask: ${offenders.join(", ")}`);
});

test("t-e43-coord02-template-line (fix (i)): the Dispatch Brief Template carries the placement line", () => {
  const fence = COORD02.split("````")[1] ?? "";
  assert.ok(fence.includes("Assignment:"), "sanity: located the Dispatch Brief Template fence");
  assert.match(fence, new RegExp(`^${PLACEMENT_LABEL}:`, "m"),
    "the template must carry the placement line — this is where the ask actually gets resolved, at brief time, by the one actor a human can reach");
});

test("t-e43-coord02-rule-is-target-conditional: every 'included ONLY when' rule names a line that exists in the fence", () => {
  const fence = COORD02.split("````")[1] ?? "";
  const prose = COORD02.split("````").slice(2).join("````");

  // Class assertion: the fill-instructions prose and the fence must not drift apart. Each
  // conditional-inclusion rule must govern a line the fence actually has; otherwise the
  // template grows lines nobody is told when to include, or documents lines it lost.
  const governed = [...prose.matchAll(/`([^`]+)` line is (?:likewise )?(?:target-conditional|included ONLY when)/g)].map((m) => m[1]);
  assert.ok(governed.length >= 2, `expected at least the cut_approved and ${PLACEMENT_LABEL} rules — found: ${governed.join(", ")}`);
  for (const label of governed) {
    assert.ok(fence.includes(label), `the prose states an inclusion rule for \`${label}\`, but no such line exists in the template fence`);
  }
  assert.ok(governed.includes(PLACEMENT_LABEL), `${PLACEMENT_LABEL} must be one of the target-conditional lines`);

  // ...and the placement rule must stay CONDITIONAL on a qa-engineer target. Made
  // unconditional it would re-break every non-qa brief, which is why this is pinned
  // separately from mere presence.
  const ruleSentence = prose.split(/(?<=\.)\s/).find((s) => s.includes(PLACEMENT_LABEL));
  assert.ok(ruleSentence, "the placement inclusion rule must be stated in prose, not left implicit");
  assert.match(ruleSentence, /ONLY when/, "the placement line must be target-conditional, never unconditional");
  assert.match(ruleSentence, /qa-engineer/, "the condition must name the qa-engineer target");
});

test("t-e43-qa-sop-defers-to-const2: Phase 3a reads the brief first and defers to §2 without restating it", () => {
  const phase3a = QA_SOP.split("\n").find((l) => l.includes("**Test File Discovery**"));
  assert.ok(phase3a, "skill-qa-engineer must still carry Phase 3a Test File Discovery");
  assert.match(phase3a, new RegExp(`\`${PLACEMENT_LABEL}\``),
    "Phase 3a must tell qa to read the brief's placement line — the dispatcher's resolution is useless if the acting role is never pointed at it");
  assert.match(phase3a, /Constitution §2/, "Phase 3a must defer to §2 by reference");

  // The constitution preamble forbids skills restating its rules. Enumerating the branches
  // here would fork the rule into two copies that can drift — which is how this SOP came to
  // carry a contradicting copy of the ask in the first place.
  assert.doesNotMatch(phase3a, /\(a\).*\(b\).*\(c\)/s, "Phase 3a must NOT re-enumerate §2's branches");
});

test("t-e43-placement-label-is-one-string: the dispatcher, the SOP, and §2 agree on one label", () => {
  assert.ok(COORD02.includes(PLACEMENT_LABEL), "coord-02 (dispatcher side) must use the label");
  assert.ok(QA_SOP.includes(PLACEMENT_LABEL), "skill-qa-engineer (reader side) must use the same label");
  // §2 refers to the mechanism generically ("your dispatch brief names ..."), so it is
  // pinned on the concept, not the literal — but it must point at the coordinator SOP that
  // owns the line, so a reader can find it.
  const bullet = conditionalBullet(CONST05);
  assert.match(bullet, /skill-coordinator/, "§2 must point at the coordinator SOP that owns the brief line");
  assert.match(bullet, /Dispatch Brief Template/, "§2 must name the template by its heading");
});

test("t-e43-branches-survive-strip: the normative branch text is delivered in NON-fullDetail bundles too", () => {
  // Guards the efficiency temptation recorded in review_reports/review_T-E43-01.md Round 2:
  // rationale-fencing part of this bullet would strip it from every non-fullDetail bundle.
  // Fencing the CAUSAL clause is a legitimate future option; fencing any part of the three
  // branches, or the halting prohibition, would silently delete the rule from the bundle
  // every dispatched role actually receives.
  const rendered = applyTextTransforms(CONST05, { fullDetail: false });
  const bullet = conditionalBullet(rendered);
  const b = branches(bullet);
  assert.deepEqual([...b.keys()], ["a", "b", "c"], "all three branches must survive the strip passes");
  assert.match(bullet, /Halting the round to ask is never compliant/, "the halting prohibition is normative and must survive the strip passes");
  assert.doesNotMatch(bullet, /origin:start|rationale:start/, "no fence markers may leak into delivered text");
});

test("t-e43-assertions-red-against-pre-e43-text (guard-the-guard): the pins above genuinely detect the pre-E43 wording", () => {
  // A regression pin that cannot fail against the defect it names is decoration. Replay the
  // three load-bearing assertions against the hermetic pre-E43 literal and require each to
  // throw. (E69/E76/E77 precedent: demonstrate the red, don't assert the green only.)
  assert.throws(() => {
    const b = branches(PRE_E43_BULLET);
    assert.deepEqual([...b.keys()], ["a", "b", "c"]);
  }, "the pre-E43 bullet had no lettered branches at all — the partition pin must red on it");

  assert.throws(() => {
    assert.match(PRE_E43_BULLET, /Never create, and never skip, silently\./);
  }, "the no-silent pin must red on the pre-E43 bullet");

  assert.throws(() => {
    assert.doesNotMatch(PRE_E43_BULLET, /MUST ask the user before creating/i);
  }, "the retired-form sweep must red on the pre-E43 bullet");

  // And the round-1 text (branches present, but (c) pinned to Task dispatch and
  // create-only) must red on BOTH round-1 findings — otherwise the F1/F2 pins would have
  // passed the very draft the code reviewer rejected.
  const ROUND1_BULLET =
    "- **Conditional test writing** (qa-engineer): If NO relevant test file exists, resolve placement by the channel actually available to you: (a) your dispatch brief names the target test file(s) or pre-authorizes creation → proceed on it, no ask; (b) no such line, but a human is reachable in your own context → ask before creating; (c) Task-dispatched, brief silent, no ask channel → decide, create, and disclose the choice in BOTH `pending_notes` and `qa_review`. Never create silently.";
  const r1 = branches(ROUND1_BULLET);
  assert.throws(() => assert.match(r1.get("c"), /^otherwise\b/i), "F2 pin must red on the round-1 draft");
  assert.throws(() => assert.match(r1.get("c"), /no new test is warranted/i), "F1 pin must red on the round-1 draft");
});

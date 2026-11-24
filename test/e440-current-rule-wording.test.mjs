// Coded by @qa-engineer
// E440 (prompt-content-hygiene): a sentence that describes how the prompt CHANGED ("is REMOVED", "is retired",
// "pre-v3.20.0 behavior", "no remaining routing convention") makes the agent read history instead of the rule in
// force. The six sites of the spec's E440 table are restated as the current rule (site 2 is deleted outright).
// Sentences that still guide the reading of OLD state files ("a legacy `resume_of:` line ... is inert") describe
// the present behaviour toward legacy input, so they stay byte-identical.
//   AC-E440-1  each of the six sites reads exactly as the rewritten text, and no content/*.md carries the old phrases;
//   AC-E440-2  the legacy-inert sentences are kept verbatim.
// Spec: specs/e437-prompt-content-hygiene.md (E440 table, AC-E440-1..2).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const src = (f) => fs.readFileSync(path.join(CONTENT, f), "utf-8");
const { applyTextTransforms } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));
const dispatch = (t) => applyTextTransforms(t, { fullDetail: false });
const count = (h, n) => h.split(n).length - 1;

// E433 re-pin: Phase 1.5 left the qa SOP (test author, E434 owns the visual judge), so neither the
// rewritten sentence nor the old 'is REMOVED' escape-clause wording may appear in it any more.
test("AC-E440-1 site 1: skill-qa-engineer carries neither the Phase 1.5 deferral sentence nor the old 'is REMOVED' wording", () => {
  const s = src("skill-qa-engineer.md");
  assert.equal(count(s, "No `pending_notes` deferral substitutes for it"), 0, "the Phase 1.5 rule left the qa SOP");
  assert.ok(!s.includes('The escape clause "Phase 1.5 deferred" in `pending_notes` is REMOVED'), "old sentence gone");
  assert.ok(!dispatch(s).includes("is REMOVED"), "no 'is REMOVED' phrasing in the dispatch bundle");
});

test("AC-E440-1 site 2: coord-03 Fallback paragraph ends at the fallback rule; the 'pre-v3.20.0 behavior' sentence is deleted", () => {
  const s = src("coord-03-core-fallback.md");
  assert.ok(!s.includes("This is the pre-v3.20.0 behavior"), "deleted");
  assert.ok(!s.includes("no tw_* tool surface has changed"), "its tail clause is gone with it");
  const para = s.split("\n").find((l) => l.startsWith("**Fallback (`tw_switch_role`)**"));
  assert.ok(para.endsWith("Call `tw_switch_role(<next_role>)` and follow the returned SOP in the same context."), "Fallback paragraph ends with the preceding fallback-rule sentence");
});

test("AC-E440-1 site 3: coord-03 hop-counter rule ends 'do NOT compute, cache, or write it yourself.' (old counter clause removed)", () => {
  const s = src("coord-03-core-fallback.md");
  assert.ok(s.includes("Read it from `tw_get_state`; do NOT compute, cache, or write it yourself. WHEN a feature's `hop_count` is already at/over"), "rewritten text in place");
  assert.ok(!s.includes("the old in-memory counter is retired"), "old clause gone");
});

test("AC-E440-1 site 4: coord-03 NEW-TICKETS.md rule reads 'A root `NEW-TICKETS.md` is not a channel for lane ticket candidates.'", () => {
  const s = src("coord-03-core-fallback.md");
  assert.equal(count(s, "A root `NEW-TICKETS.md` is not a channel for lane ticket candidates."), 1);
  assert.ok(!s.includes("convention is retired for lane ticket candidates"), "old sentence gone");
});

test("AC-E440-1 site 5: coord-02 dispatch-brief line ends the dispatch_pins clause without the retired-convention parenthetical", () => {
  const s = src("coord-02-host-dispatch.md");
  assert.ok(s.includes("quoting the first-class `dispatch_pins` field directly. The known-drift line is ALWAYS present"), "rewritten text in place");
  assert.ok(!s.includes("convention is retired, C14"), "old parenthetical (and its C14 label) gone");
});

test("AC-E440-1 site 6: const-05 reads '`pending_notes` is free text for humans (situation description, rationale) and carries no routing.'", () => {
  const s = src("const-05-core-standards.md");
  assert.ok(s.includes("`pending_notes` is free text for humans (situation description, rationale) and carries no routing."), "rewritten text in place");
  assert.ok(!s.includes("no remaining routing convention"), "old wording gone");
});

test("AC-E440-1: no content/*.md carries the four old phrases (the spec's grep returns nothing)", () => {
  const files = fs.readdirSync(CONTENT).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const s = src(f);
    for (const phrase of ["pre-v3.20.0", "is REMOVED", "is retired", "no remaining routing convention"]) {
      assert.ok(!s.includes(phrase), `content/${f} still carries "${phrase}"`);
    }
  }
});

test("AC-E440-1: the rewritten sites survive into a real dispatch bundle (coord-02/03, const-05)", () => {
  for (const [f, text] of [
    ["coord-03-core-fallback.md", "do NOT compute, cache, or write it yourself."],
    ["coord-03-core-fallback.md", "A root `NEW-TICKETS.md` is not a channel for lane ticket candidates."],
    ["coord-02-host-dispatch.md", "quoting the first-class `dispatch_pins` field directly."],
    ["const-05-core-standards.md", "carries no routing."],
  ]) assert.ok(dispatch(src(f)).includes(text), `${f} dispatch bundle carries: ${text}`);
});

test("AC-E440-2: the legacy-inert sentences are byte-identical (they guide the reading of old state files, not history)", () => {
  assert.equal(
    count(src("const-08-chain-31-mid.md"), "a legacy `resume_of: <role>` line in `pending_notes` is inert"),
    1,
    "const-08 Amend-Resume Edge sentence kept",
  );
  assert.equal(
    count(src("skill-pm.md"), "a legacy `resume_of:` line inside `pending_notes` is inert"),
    1,
    "skill-pm Amend-Resume declaration sentence kept",
  );
  // every `legacy ... inert` sentence in content/** is kept: the count is the base count (4), none was rewritten away
  const total = fs
    .readdirSync(CONTENT)
    .filter((f) => f.endsWith(".md"))
    .reduce((n, f) => n + (src(f).match(/legacy[^.\n]*inert/g) || []).length, 0);
  assert.equal(total, 4, "all four `legacy … inert` sentences in content/** remain");
});

// E435: resume_of accepts only "code-reviewer"; the current-rule sentences that set the field name that one
// target, and no content/*.md describes qa-engineer as a resume_of value (pm -> qa-engineer is an ordinary edge).
test("AC-E440-2 (E435): the resume_of rule sentences name code-reviewer as the only resume target", () => {
  assert.equal(count(src("const-08-chain-31-mid.md"), "setting the first-class `resume_of` handoff field to `code-reviewer`"), 1, "const-08 Amend-Resume Edge");
  assert.equal(count(src("skill-pm.md"), 'set the first-class `resume_of` field to `"code-reviewer"`'), 1, "skill-pm Amend-Resume declaration");
  const QA_TARGET = /`resume_of`[^.\n]{0,60}?(?:to|=|:|names)\s*`?"?qa-engineer/;
  for (const f of fs.readdirSync(CONTENT).filter((x) => x.endsWith(".md"))) {
    assert.doesNotMatch(src(f), QA_TARGET, `content/${f} names qa-engineer as a resume_of target`);
  }
});

// Coded by @qa-engineer
// Tests for feature: e164-e167-content-wave45 (docs/backlog.md rows E164/E167 +
// NEW-TICKETS.md L-CONTENT-NEW-1/NEW-3; L-CONTENT-NEW-5 resolved in-cut).
// Content-assertion tests, independent of the sr-engineer/code-reviewer claims in
// review_reports/review_T-E164-01.md — these read the shipped prose directly.
//
// Spec-to-Test map:
//   AC1 (8b: normal-budget-first, lowered-budget-only-after-first-kill, hung run
//        ends in printed strict FAIL)                  -> t-ac1-*
//   AC2 (fix_try-capped re-runs -> Blocked/human; Escalation Routes 8b row
//        consistent; 8b STOP deletes unpushed local tag before the Blocked write) -> t-ac2-*
//   AC3 (9a carries the budget note, names DEFAULT_WAIT_SECONDS, no "480")  -> t-ac3-*
//   AC4 (8c separates tag-create from tag-push; step labels unrenumbered)  -> t-ac4-*
//   AC5 (E164+E167 single edit pass)                    -> not test-assertable;
//        recorded in qa_reports/review_T-E164-02.md per the dispatch brief.
//   AC6 (lite: no inline `id | desc |` list; points at skill-pm Cut-Approval Gate) -> t-ac6-*
//   AC7 (skill-pm `touches` excludes governance bookkeeping)               -> t-ac7-*
//
// WHY: this is a prose-only content lane (no executable code path touched), so the
// contract under test is that the shipped WORDING actually encodes the approved
// decisions (docs/backlog.md E164/E167 rows, handoff scope_decision_why) — not that
// some code compiles. A plausible-sounding paraphrase that silently drops the
// sequencing, the named cap, or the tag-deletion clause would defeat the whole
// point of the fix while still "reading fine" on a skim; these tests pin the
// load-bearing phrases and their relative order so a future edit that regresses
// the wording fails CI instead of shipping quietly.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const RELEASE_ENGINEER = fs.readFileSync(path.join(ROOT, "content", "skill-release-engineer.md"), "utf-8");
const COORDINATOR_LITE = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");

// Isolate step 8b's body: from its numbered marker to the next numbered step marker (8c).
function extractStep(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  assert.ok(startIdx >= 0, `expected to find step marker ${JSON.stringify(startMarker)}`);
  const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
  assert.ok(endIdx > startIdx, `expected to find step marker ${JSON.stringify(endMarker)} after ${JSON.stringify(startMarker)}`);
  return content.slice(startIdx, endIdx);
}

const STEP_8B = extractStep(RELEASE_ENGINEER, "8b. **CI gate**", "\n8c. **Tag + push**");
const STEP_8C = extractStep(RELEASE_ENGINEER, "8c. **Tag + push**", "\n9. **GitHub release**");
const STEP_9A = extractStep(RELEASE_ENGINEER, "9a. **Release self-check**", "<!-- rationale:start -->");

// ---------------------------------------------------------------------------
// AC1: step 8b — first attempt with normal budget; after first host silent
// kill, re-run with AGC_VERIFY_CI_WAIT_SECONDS below host timeout; a hung run
// then ends in a printed strict FAIL.
// ---------------------------------------------------------------------------

test("AC1: 8b makes the first CI-gate attempt with the normal budget", () => {
  assert.match(
    STEP_8B,
    /make the FIRST attempt with the normal budget/,
    "8b must sequence the first attempt at the normal (unlowered) budget",
  );
  assert.match(
    STEP_8B,
    /Do NOT lower the budget pre-emptively/,
    "8b must forbid lowering the budget before the first attempt (the green-path hazard C1 fixed)",
  );
});

test("AC1: 8b lowers AGC_VERIFY_CI_WAIT_SECONDS below the host timeout only after the first silent kill", () => {
  assert.match(
    STEP_8B,
    /Only after that first host-level silent kill, re-run the identical command with `AGC_VERIFY_CI_WAIT_SECONDS` set below the host's command timeout/,
    "8b must gate the lowered-budget re-run on having already observed one host-level silent kill",
  );
  // Ordering: "first attempt, normal budget" must precede the "only after first kill, lower it" clause,
  // which must precede the hung-run consequence — this is the sequencing C1 required, not just presence.
  const firstAttemptIdx = STEP_8B.indexOf("make the FIRST attempt with the normal budget");
  const lowerAfterKillIdx = STEP_8B.indexOf("Only after that first host-level silent kill");
  assert.ok(firstAttemptIdx >= 0 && lowerAfterKillIdx > firstAttemptIdx, "normal-budget-first must precede lower-after-kill in step 8b's prose");
});

test("AC1: 8b states a hung run ends in a printed strict FAIL, not another silent kill", () => {
  assert.match(
    STEP_8B,
    /a run that hangs now ends in the script's own printed strict `FAIL:`/,
    "8b must state that the consequence of a genuinely hung run, once the budget is lowered, is a printed strict FAIL",
  );
  const lowerAfterKillIdx = STEP_8B.indexOf("Only after that first host-level silent kill");
  const hungConsequenceIdx = STEP_8B.indexOf("a run that hangs now ends in the script's own printed strict");
  assert.ok(lowerAfterKillIdx >= 0 && hungConsequenceIdx > lowerAfterKillIdx, "hung-run-ends-in-FAIL consequence must follow the lower-after-kill clause");
});

// ---------------------------------------------------------------------------
// AC2: silent-kill re-runs bounded by the NAMED fix_try cap (no bare number)
// -> Blocked/human; Escalation Routes 8b row consistent; 8b STOP deletes the
// unpushed local tag before the Blocked write (C2 / L-CONTENT-NEW-5).
// ---------------------------------------------------------------------------

test("AC2: consecutive silent-kill re-runs are bounded by the named fix_try cap, not a bare number", () => {
  const capSentenceMatch = STEP_8B.match(/Consecutive silent-kill re-runs are bounded by the `fix_try` cap[\s\S]{0,400}?do not keep re-running\./);
  assert.ok(capSentenceMatch, "8b must state the fix_try-cap sentence verbatim through its 'do not keep re-running' clause");
  const capSentence = capSentenceMatch[0];
  assert.match(capSentence, /STOP `status="Blocked"`, `next_role="human"`/, "hitting the cap must route to Blocked/human");
  // The cap must be named (`fix_try`), never restated as a bare integer next to "cap" —
  // that is exactly the staleness hazard the file's own DEFAULT_WAIT_SECONDS convention avoids.
  assert.ok(
    !/\bcap (?:of|is|=|:)\s*\d+/i.test(capSentence) && !/\(\s*\d+\s*\)\s*(?:consecutive|re-runs|retries|attempts)/i.test(capSentence),
    "the fix_try cap must not be restated as a bare number in the same sentence",
  );
});

test("AC2: the Escalation Routes step-8b row is consistent with the fix_try-capped, sequenced re-run wording", () => {
  const rowMatch = RELEASE_ENGINEER.match(/\| CI gate failure \(step 8b:[\s\S]*?\| human \|/);
  assert.ok(rowMatch, "Escalation Routes must retain a step-8b CI-gate-failure row");
  const row = rowMatch[0];
  assert.match(row, /`fix_try` cap/, "the Escalation Routes row must name the fix_try cap (not a bare number)");
  assert.match(row, /the first attempt with the normal budget, and only after the first host kill with the budget set below the host timeout/, "the row's re-run guidance must match 8b's sequencing");
});

test("AC2: every 8b STOP deletes any unpushed local tag with `git tag -d` before the Blocked write", () => {
  assert.match(
    STEP_8B,
    /On every 8b STOP, before that Blocked write, delete any local tag created ahead of this gate per 8c\*\* \(`git tag -d vX\.Y\.Z`\)/,
    "the printed-result STOP path must delete the unpushed local tag before the Blocked write",
  );
  const capSentenceMatch = STEP_8B.match(/Consecutive silent-kill re-runs are bounded by the `fix_try` cap[\s\S]{0,400}?do not keep re-running\./);
  assert.match(capSentenceMatch[0], /deleting any unpushed local tag first, as above/, "the cap-exhaustion STOP path must also delete the unpushed local tag before the Blocked write");
  // This must never touch a published tag — the No force pushes Hard rule stays intact.
  assert.match(STEP_8B, /This never touches a published tag/, "8b must state the tag deletion is scoped to an unpushed (local-only) tag");
});

// ---------------------------------------------------------------------------
// AC3: 9a carries the budget note, names DEFAULT_WAIT_SECONDS, and contains no
// "480" literal in that note.
// ---------------------------------------------------------------------------

test("AC3: 9a carries the sequenced budget note and names DEFAULT_WAIT_SECONDS", () => {
  assert.match(
    STEP_9A,
    /Step 8b's sequenced budget advice applies to this poll too, since it shares the knob/,
    "9a must cross-reference 8b's sequenced budget advice, since Check 6's poll shares the same knob",
  );
  assert.match(STEP_9A, /`DEFAULT_WAIT_SECONDS`/, "9a must name DEFAULT_WAIT_SECONDS rather than restating its value");
});

test("AC3: the 9a note contains no bare '480' literal", () => {
  assert.ok(!STEP_9A.includes("480"), "9a's step body must not restate the DEFAULT_WAIT_SECONDS figure as a bare '480' literal");
});

// ---------------------------------------------------------------------------
// AC4: 8c separates `git tag -a` (local/reversible, permitted after step 8a
// completes, before 8b) from `git push origin vX.Y.Z` (only after CI-CHECK
// PASSED); step labels 8a/8b/8c/9/9a present and unrenumbered.
// ---------------------------------------------------------------------------

test("AC4: 8c's tag-create bullet is local/reversible and permitted after step 8a completes, including before 8b", () => {
  const tagCreateMatch = STEP_8C.match(/- `git tag -a vX\.Y\.Z[\s\S]*?\(see 8b\)\./);
  assert.ok(tagCreateMatch, "8c must retain the git tag -a bullet with its full reversibility/timing clause");
  const tagCreate = tagCreateMatch[0];
  assert.match(tagCreate, /local and reversible \(undo with `git tag -d vX\.Y\.Z`\)/, "the tag-create bullet must call the local tag reversible");
  assert.match(tagCreate, /any time after step 8a completes/, "the tag-create bullet must permit creation any time after step 8a completes (not merely after its commit)");
  assert.match(tagCreate, /including before 8b/, "the tag-create bullet must explicitly permit the pre-8b window (E167)");
});

test("AC4: 8c's tag-push bullet is gated strictly on CI-CHECK PASSED and is the irreversible act", () => {
  const tagPushMatch = STEP_8C.match(/- `git push origin vX\.Y\.Z`[\s\S]*?`CI-CHECK PASSED`\./);
  assert.ok(tagPushMatch, "8c must retain the git push origin bullet gated on CI-CHECK PASSED");
  assert.match(tagPushMatch[0], /the one irreversible act/, "the tag-push bullet must be the one identified as irreversible, not the tag-create bullet");
});

test("AC4: step labels 8a/8b/8c/9/9a are present and unrenumbered", () => {
  for (const label of ["8a. **Commit + push branch**", "8b. **CI gate**", "8c. **Tag + push**", "9. **GitHub release**", "9a. **Release self-check**"]) {
    assert.ok(RELEASE_ENGINEER.includes(label), `expected unrenumbered step label ${JSON.stringify(label)} to survive`);
  }
});

// ---------------------------------------------------------------------------
// AC6: content/skill-coordinator-lite.md contains no `id | desc |` column list
// and points to skill-pm's Cut-Approval Gate.
// ---------------------------------------------------------------------------

test("AC6: skill-coordinator-lite.md no longer inlines an `id | desc |` cut-header column list", () => {
  assert.ok(!COORDINATOR_LITE.includes("id | desc |"), "lite must not restate a stale inline cut-header column list");
});

test("AC6: skill-coordinator-lite.md points at skill-pm's Cut-Approval Gate for the cut header", () => {
  assert.match(
    COORDINATOR_LITE,
    /header per skill-pm \*Cut-Approval Gate\*/,
    "lite's cut-approval halt bullet must point at skill-pm's Cut-Approval Gate rather than restate the header",
  );
});

// ---------------------------------------------------------------------------
// AC7: content/skill-pm.md `touches` definition excludes tasks.md, .current/**,
// qa_reports/**, review_reports/**.
// ---------------------------------------------------------------------------

test("AC7: skill-pm.md `touches` definition excludes governance bookkeeping paths", () => {
  const touchesMatch = SKILL_PM.match(/`touches` = the actual repo paths\/globs the ticket writes[^\n]*\n/);
  assert.ok(touchesMatch, "skill-pm.md must retain the `touches` definition line");
  const line = touchesMatch[0];
  assert.match(line, /excluding governance bookkeeping/, "the touches definition must state the governance-bookkeeping exclusion");
  for (const excluded of ["`tasks.md`", "`.current/\\*\\*`", "`qa_reports/\\*\\*`", "`review_reports/\\*\\*`"]) {
    assert.match(line, new RegExp(excluded), `touches exclusion must name ${excluded}`);
  }
});

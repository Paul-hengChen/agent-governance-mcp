// Coded by @qa-engineer
// Tests pinning the release-engineer SOP CI-wait/tag wording and the lite-coordinator / PM
// cut-list wording (feature e164-e167-content-wave45; docs/backlog.md rows E164/E167),
// independent of review_reports/archive/e164-e167-content-wave45/review_T-E164-01.md.
// Case names are prefixed AC<N>; AC5 (one edit pass) is not test-assertable, see
// qa_reports/archive/e164-e167-content-wave45/review_T-E164-02.md.
// Rationale: specs/e260f-comment-rationale.md (test/e164-e167-content.test.mjs).

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
// E394 re-pin: the rewritten SOP states each rule once and delegates the mechanics to scripts/release.mjs; the
// base step 8b/8c/9a prose moved verbatim into specs/release-sop-history.md. Rule assertions run against the SOP
// and the script; the verbatim wording assertions run against the history extracts.
const HISTORY = fs.readFileSync(path.join(ROOT, "specs", "release-sop-history.md"), "utf-8");
const RELEASE_SCRIPT = fs.readFileSync(path.join(ROOT, "scripts", "release.mjs"), "utf-8");
const HOST_KILL = RELEASE_ENGINEER.slice(
  RELEASE_ENGINEER.indexOf("**Host kill**"),
  RELEASE_ENGINEER.indexOf("## Escalation Routes"),
);
const PUBLISH_STEP = RELEASE_ENGINEER.match(/^13\. Publish:.*$/m)?.[0] ?? "";

// Isolate step 8b's body: from its numbered marker to the next numbered step marker (8c).
function extractStep(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  assert.ok(startIdx >= 0, `expected to find step marker ${JSON.stringify(startMarker)}`);
  const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
  assert.ok(endIdx > startIdx, `expected to find step marker ${JSON.stringify(endMarker)} after ${JSON.stringify(startMarker)}`);
  return content.slice(startIdx, endIdx);
}

const STEP_8B = extractStep(HISTORY, "8b. **CI gate**", "\n8c. **Tag + push**");
const STEP_8C = extractStep(HISTORY, "8c. **Tag + push**", "\n9. **GitHub release**");
const STEP_9A = extractStep(HISTORY, "9a. **Release self-check**", "<!-- rationale:start -->");
assert.ok(HOST_KILL.length > 20 && PUBLISH_STEP.length > 0, "the rewritten SOP must carry the Host kill paragraph and the publish step");

// ---------------------------------------------------------------------------
// AC1: step 8b — first attempt with normal budget; after first host silent
// kill, re-run with AGC_VERIFY_CI_WAIT_SECONDS below host timeout; a hung run
// then ends in a printed strict FAIL.
// ---------------------------------------------------------------------------

test("AC1 [E394 re-pin AC-P4/AC-P10]: the first CI-gate attempt uses the normal budget — the SOP lowers the budget only after the first kill; the history keeps 8b's verbatim sequencing", () => {
  assert.match(HOST_KILL, /After the first kill, set `AGC_VERIFY_CI_WAIT_SECONDS`/, "SOP: the budget is lowered only after the first kill, never pre-emptively");
  assert.ok(!/pre-emptive|before the first/i.test(PUBLISH_STEP), "SOP step 13 must not pre-emptively lower the budget");
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

test("AC1 [E394 re-pin AC-P4/AC-P10]: AGC_VERIFY_CI_WAIT_SECONDS is lowered below the host timeout only after the first silent kill (SOP Host kill rule; verbatim 8b sequencing in the history)", () => {
  assert.match(
    HOST_KILL,
    /a phase killed before it printed `release: <phase> OK` or a `RELEASE_STOP` line is silence, not a result — re-run the same command\. After the first kill, set `AGC_VERIFY_CI_WAIT_SECONDS` and `AGC_RELEASE_MERGE_WAIT_SECONDS` below the host timeout/,
    "SOP: a silent kill is no result; re-run, and set the budgets below the host timeout only after the first kill",
  );
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

test("AC1 [E394 re-pin AC-P4/AC-P10]: a hung run ends in a printed strict FAIL, not another silent kill (the script's bounded poll prints CI-CHECK FAILED; verbatim 8b text in the history)", () => {
  const verify = fs.readFileSync(path.join(ROOT, "scripts", "verify-release.mjs"), "utf-8");
  assert.ok(verify.includes("DEFAULT_WAIT_SECONDS") && verify.includes("AGC_VERIFY_CI_WAIT_SECONDS"), "the script must bound its CI poll with a named, env-overridable budget");
  assert.ok(RELEASE_SCRIPT.includes('"CI_GATE_FAILED"') && /\| exit 41 CI_GATE_FAILED \| Blocked \|/.test(RELEASE_ENGINEER), "a failed gate is a printed CI_GATE_FAILED stop with its own Blocked row");
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

test("AC2 [E394 re-pin AC-P4]: consecutive silent-kill re-runs are bounded by the named fix_try cap, not a bare number (SOP + history)", () => {
  assert.match(HOST_KILL, /At the `fix_try` cap use row \*host-killed phase\*/, "SOP: the cap is the named fix_try, routed to the host-killed-phase row");
  assert.ok(!/\bcap (?:of|is|=|:)\s*\d+/i.test(HOST_KILL), "SOP: the fix_try cap must not be restated as a bare number");
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

test("AC2 [E394 re-pin AC-P4]: the Escalation Routes rows are consistent with the fix_try-capped, sequenced re-run wording (SOP: host-killed-phase row hands back to the human; history keeps the verbatim 8b row)", () => {
  const sopRow = RELEASE_ENGINEER.match(/^\| host-killed phase at the `fix_try` cap \| Blocked \| .*\| — \|$/m);
  assert.ok(sopRow, "the SOP must carry a host-killed-phase-at-the-fix_try-cap Blocked row (no next_role: hands back to the human)");
  assert.match(sopRow[0], /killed by the host <n> times, no result printed/, "the SOP row must name the no-result cap condition");
  const rowMatch = HISTORY.match(/\| CI gate failure \(step 8b:[\s\S]*?\| human \|/);
  assert.ok(rowMatch, "the history must keep the verbatim step-8b CI-gate-failure row");
  const row = rowMatch[0];
  assert.match(row, /`fix_try` cap/, "the Escalation Routes row must name the fix_try cap (not a bare number)");
  assert.match(row, /the first attempt with the normal budget, and only after the first host kill with the budget set below the host timeout/, "the row's re-run guidance must match 8b's sequencing");
});

test("AC2 (E297 re-pin) [E394 re-pin AC-S7]: 8b STOPs carry no local-tag cleanup — no tag exists before the merge (SOP has no tag deletion; the script tags only after the gate and merge)", () => {
  assert.ok(!RELEASE_ENGINEER.includes("delete any local tag") && !RELEASE_ENGINEER.includes("deleting any unpushed local tag"), "the SOP must carry no tag-deletion clause");
  assert.match(RELEASE_ENGINEER, /tags are immutable \(never move, delete or re-create one/, "SOP: tags are never deleted or re-created");
  // The tag is created on the main merge commit in 8c, so the former
  // "delete any local tag created ahead of this gate" clauses are retired.
  assert.ok(!STEP_8B.includes("delete any local tag created ahead of this gate"), "8b must not carry the retired pre-gate tag-deletion clause");
  assert.ok(!STEP_8B.includes("deleting any unpushed local tag first"), "the cap-exhaustion STOP path must not carry the retired tag-deletion clause");
  assert.match(STEP_8B, /No tag exists at this point/, "8b must state no tag exists at the gate, so a STOP undoes nothing");
  assert.match(STEP_8B, /Consecutive silent-kill re-runs are bounded by the `fix_try` cap[\s\S]{0,400}?do not keep re-running\./, "the cap-exhaustion STOP path must remain");
});

// ---------------------------------------------------------------------------
// AC3: 9a carries the budget note, names DEFAULT_WAIT_SECONDS, and contains no
// "480" literal in that note.
// ---------------------------------------------------------------------------

test("AC3 [E394 re-pin AC-P10]: the sequenced budget note names DEFAULT_WAIT_SECONDS (history 9a) and the SOP shares one Host kill rule across the CI poll and the merge wait", () => {
  assert.match(HOST_KILL, /\(steps 12, 13, 16\)/, "SOP: one host-kill rule covers prepare, publish and close-out");
  assert.match(
    STEP_9A,
    /Step 8b's sequenced budget advice applies to this poll too, since it shares the knob/,
    "9a must cross-reference 8b's sequenced budget advice, since Check 6's poll shares the same knob",
  );
  assert.match(STEP_9A, /`DEFAULT_WAIT_SECONDS`/, "9a must name DEFAULT_WAIT_SECONDS rather than restating its value");
});

test("AC3 [E394 re-pin AC-P10]: neither the 9a note (history) nor the SOP's budget text contains a bare '480' literal", () => {
  assert.ok(!HOST_KILL.includes("480") && !PUBLISH_STEP.includes("480"), "the SOP must not restate the DEFAULT_WAIT_SECONDS figure");
  assert.ok(!STEP_9A.includes("480"), "9a's step body must not restate the DEFAULT_WAIT_SECONDS figure as a bare '480' literal");
});

// ---------------------------------------------------------------------------
// AC4: 8c separates `git tag -a` (local/reversible, permitted after step 8a
// completes, before 8b) from `git push origin vX.Y.Z` (only after CI-CHECK
// PASSED); step labels 8a/8b/8c/9/9a present and unrenumbered.
// ---------------------------------------------------------------------------

test("AC4 (E297 re-pin) [E394 re-pin AC-S7/AC-P10]: the tag follows the merge on the pulled merge commit (SOP publish step + script order); history keeps 8c's local/reversible tag-create bullet", () => {
  assert.match(PUBLISH_STEP, /merges with `--auto --merge`, pulls `main`, tags the merge commit, pushes the tag/, "SOP: publish merges, pulls main, then tags the merge commit, then pushes the tag");
  const publish = RELEASE_SCRIPT.slice(RELEASE_SCRIPT.indexOf("async function stepPublish("));
  assert.ok(publish.indexOf("pullMain(ctx") < publish.indexOf('["tag", "-a", tag'), "script: pull main before tagging");
  const tagCreateMatch = STEP_8C.match(/- `git tag -a vX\.Y\.Z[\s\S]*?until the next bullet\./);
  assert.ok(tagCreateMatch, "8c must retain the git tag -a bullet with its full reversibility/timing clause");
  const tagCreate = tagCreateMatch[0];
  assert.match(tagCreate, /local and reversible \(undo with `git tag -d vX\.Y\.Z`\)/, "the tag-create bullet must call the local tag reversible");
  assert.match(tagCreate, /on that HEAD/, "the tag-create bullet must tag the pulled main merge commit");
  assert.ok(!tagCreate.includes("any time after step 8a completes"), "the retired early-tag allowance must be gone");
  assert.ok(!tagCreate.includes("including before 8b"), "the retired pre-8b window must be gone");
});

test("AC4 [E394 re-pin AC-S7/AC-P10]: the tag push is gated strictly on CI-CHECK PASSED (SOP + script order) and is the irreversible act (history 8c)", () => {
  assert.match(PUBLISH_STEP, /only `CI-CHECK PASSED` continues/, "SOP: only CI-CHECK PASSED lets publish continue");
  const publish = RELEASE_SCRIPT.slice(RELEASE_SCRIPT.indexOf("async function stepPublish("));
  assert.ok(publish.indexOf('"CI-CHECK PASSED"') > -1 && publish.indexOf('"CI-CHECK PASSED"') < publish.indexOf('["push", "origin", tag]'), "script: the CI-CHECK PASSED check precedes the tag push");
  const tagPushMatch = STEP_8C.match(/- `git push origin vX\.Y\.Z`[\s\S]*?`CI-CHECK PASSED`\./);
  assert.ok(tagPushMatch, "8c must retain the git push origin bullet gated on CI-CHECK PASSED");
  assert.match(tagPushMatch[0], /the one irreversible act/, "the tag-push bullet must be the one identified as irreversible, not the tag-create bullet");
});

test("AC4 [E394 re-pin AC-P3/AC-P10]: the rewritten SOP has contiguous step labels 1..17 (renumbered whole); the base 8a/8b/8c/9/9a labels survive verbatim in the history", () => {
  const nums = [...RELEASE_ENGINEER.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(nums, Array.from({ length: 17 }, (_, i) => i + 1), "SOP step labels must be 1..17, in order, none skipped or duplicated");
  for (const label of ["8a. **Commit + push branch**", "8b. **CI gate**", "8c. **Tag + push**", "9. **GitHub release**", "9a. **Release self-check**"]) {
    assert.ok(HISTORY.includes(label), `expected base step label ${JSON.stringify(label)} to survive in the history`);
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

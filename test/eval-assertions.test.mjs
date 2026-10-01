// Coded by @qa-engineer
// Zero-cost self-test of the D4 behavioral-eval harness checkers (test/eval/lib/assertions.mjs):
// one compliant and one violating fixture per checker, so the live runner's verdicts can be
// trusted before it spends API budget. Runs inside plain `npm test`.
// Spec: specs/d4-behavioral-eval-harness.md (AC-1..AC-6).
// Rationale: specs/e260g-comment-rationale.md (test/eval-assertions.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSERTIONS_PATH = path.join(ROOT, "test", "eval", "lib", "assertions.mjs");

const {
  checkWatermark,
  checkTerseCap,
  checkEscalationShape,
  checkBannedPhrases,
} = await import(ASSERTIONS_PATH);

// ---------------------------------------------------------------------------
// AC-1 — purity guarantee: no I/O, no network, all four are synchronous.
// WHY: assertions.mjs's own module header declares "no I/O and no network
//      call". This is the formal proof, not just a comment claim — mirrors
//      the t-no-io-imports convention in test/watermark-check.test.mjs.
// ---------------------------------------------------------------------------

test("t-no-io-imports: assertions.mjs has no I/O or network module imports", () => {
  const src = fs.readFileSync(ASSERTIONS_PATH, "utf-8");
  assert.ok(!src.includes('from "node:fs"'), 'must not import "node:fs"');
  assert.ok(!src.includes('from "node:http"'), 'must not import "node:http"');
  assert.ok(!src.includes('from "node:https"'), 'must not import "node:https"');
  assert.ok(!src.includes("fetch("), "must not call fetch()");
  assert.ok(!src.includes("import("), "must not use dynamic import()");
});

test("t-all-sync: all four checkers return synchronously (no Promise)", () => {
  const results = [
    checkWatermark("x\n— @lite (haiku)", "lite", "haiku"),
    checkTerseCap("short reply"),
    checkEscalationShape('tw_update_state(status=FAIL, agent_id="x", next_role="y", pending_notes=["z"])'),
    checkBannedPhrases("plain text"),
  ];
  for (const r of results) {
    assert.ok(!(r instanceof Promise), "checker must not return a Promise");
    assert.equal(typeof r.pass, "boolean", "result.pass must be a boolean");
    assert.equal(typeof r.reason, "string", "result.reason must be a string");
  }
});

// ---------------------------------------------------------------------------
// AC-2 — checkWatermark
// WHY: the eval harness and the coordinator's live post-validation
//      (validateWatermark in dist/lib/watermark-check.js) MUST never
//      disagree on what counts as present/absent — that's the whole point
//      of reusing rather than re-implementing.
// ---------------------------------------------------------------------------

test("t-watermark-pass: reply ending with the canonical watermark passes", () => {
  const reply = "Implemented the change.\n\n— @sr-engineer (opus)";
  const result = checkWatermark(reply, "sr-engineer", "opus");
  assert.equal(result.pass, true, "canonical watermark must pass");
});

test("t-watermark-fail: reply with no watermark fails", () => {
  const reply = "Implemented the change.";
  const result = checkWatermark(reply, "sr-engineer", "opus");
  assert.equal(result.pass, false, "missing watermark must fail");
  assert.match(result.reason, /absent or mismatched/);
});

test("t-watermark-uses-validateWatermark: mismatched name/tier is treated as absent (delegates, not reimplements)", async () => {
  // If checkWatermark re-implemented its own looser regex, a wrong name/tier
  // might slip through. validateWatermark treats mismatch as absent — this
  // proves checkWatermark inherits that exact behavior via delegation.
  const reply = "Done.\n— @wrong-role (haiku)";
  const result = checkWatermark(reply, "lite", "haiku");
  assert.equal(result.pass, false, "mismatched name/tier must fail, same as validateWatermark");
});

// ---------------------------------------------------------------------------
// AC-3 — checkTerseCap
// WHY: Constitution §1 states the terse cap is "the ONLY output-length
//      policy" with exactly four documented exemptions. Each exemption is
//      tested individually so a future edit that narrows or drops one is
//      caught here, not in a live (paid) run.
// ---------------------------------------------------------------------------

test("t-terse-pass-short: reply at or under the word cap passes", () => {
  const result = checkTerseCap("Implemented per spec. Tests green. Build clean.");
  assert.equal(result.pass, true, "short reply must pass");
});

test("t-terse-fail-long-no-exemption: long reply with no exemption fails", () => {
  const reply =
    "I have gone ahead and carefully reviewed the entire codebase in great " +
    "detail and I believe that everything looks good and ready to proceed " +
    "forward with the next steps of this particular engineering task today.";
  const result = checkTerseCap(reply);
  assert.equal(result.pass, false, "long reply with no exemption must fail");
  assert.match(result.reason, /no exemption matched/);
});

test("t-terse-exempt-table: long reply containing a markdown pipe table is exempt", () => {
  const reply =
    "Here is the cut for approval, please review each row carefully before we proceed:\n" +
    "| id | desc | depends_on |\n" +
    "|---|---|---|\n" +
    "| T-01 | do the thing | none |";
  const result = checkTerseCap(reply);
  assert.equal(result.pass, true, "table-bearing reply must be exempt");
  assert.match(result.reason, /structured artifact/);
});

test("t-terse-exempt-escalation: long reply containing a canonical Blocked/FAIL escalation call is exempt", () => {
  const reply =
    "The spec is genuinely ambiguous about which authentication flow to use and I cannot proceed without a decision, so I am stopping here: " +
    'tw_update_state(status=Blocked, agent_id="pm", next_role="sr-engineer", pending_notes=["PM: ambiguous — auth flow undecided"])';
  const result = checkTerseCap(reply);
  assert.equal(result.pass, true, "escalation-bearing reply must be exempt");
  assert.match(result.reason, /blocker\/escalation/);
});

test("t-terse-exempt-assumption-gap: long reply flagging an assumption gap is exempt", () => {
  const reply =
    "Assumption: the input list is already deduplicated upstream, so I did not add a dedup pass here, please confirm this is correct before I continue further.";
  const result = checkTerseCap(reply);
  assert.equal(result.pass, true, "assumption-gap reply must be exempt");
  assert.match(result.reason, /assumption-gap/);
});

test("t-terse-exempt-acceptance-criteria: long reply stating acceptance criteria is exempt", () => {
  const reply =
    "Per the spec, AC-3 requires the terse-cap checker to honor all four documented exemptions exactly as written in the constitution fragment.";
  const result = checkTerseCap(reply);
  assert.equal(result.pass, true, "AC-stating reply must be exempt");
  assert.match(result.reason, /acceptance-criteria/);
});

// AC-4: checkEscalationShape. Field order is free, but all four keys are mandatory and status
// must be Blocked|FAIL; a missing key or a stray status=PASS breaks routing in production.

test("t-escalation-pass-field-order-free: canonical call passes regardless of key order", () => {
  const reply =
    'tw_update_state(next_role="sr-engineer", status=FAIL, pending_notes=["code-reviewer: CHANGES_REQUESTED — missing null check"], agent_id="code-reviewer")';
  const result = checkEscalationShape(reply);
  assert.equal(result.pass, true, "reordered canonical call must still pass");
});

test("t-escalation-fail-missing-key: call missing agent_id fails", () => {
  const reply =
    'tw_update_state(status=Blocked, next_role="sr-engineer", pending_notes=["PM: ambiguous — need decision"])';
  const result = checkEscalationShape(reply);
  assert.equal(result.pass, false, "call missing agent_id must fail");
  assert.match(result.reason, /agent_id/);
});

test("t-escalation-fail-bad-status: call with status=PASS (not Blocked|FAIL) fails", () => {
  const reply =
    'tw_update_state(status=PASS, agent_id="qa-engineer", next_role="sr-engineer", pending_notes=["QA: T-01 PASS"])';
  const result = checkEscalationShape(reply);
  assert.equal(result.pass, false, "non-Blocked/FAIL status must fail the escalation-shape check");
  assert.match(result.reason, /not Blocked or FAIL/);
});

test("t-escalation-fail-no-call: plain prose with no tw_update_state call fails", () => {
  const reply = "I am blocked on this task and cannot proceed further right now.";
  const result = checkEscalationShape(reply);
  assert.equal(result.pass, false, "prose with no canonical call must fail");
  assert.match(result.reason, /no tw_update_state/);
});

// ---------------------------------------------------------------------------
// AC-5 — checkBannedPhrases
// WHY: these four phrases are the exact NO YAPPING banned list from
//      Constitution §1 — a checker that misses even one lets a real
//      regression (a haiku reply that slips into filler) through silently.
// ---------------------------------------------------------------------------

test("t-banned-pass: clean reply with no banned phrases passes", () => {
  const result = checkBannedPhrases("Implemented and tests pass.");
  assert.equal(result.pass, true, "clean reply must pass");
});

test("t-banned-fail: reply containing banned phrases fails and names them", () => {
  const result = checkBannedPhrases("好的，我將開始執行任務，現在開始。");
  assert.equal(result.pass, false, "reply with banned phrases must fail");
  assert.match(result.reason, /好的/);
  assert.match(result.reason, /我將/);
  assert.match(result.reason, /現在/);
});

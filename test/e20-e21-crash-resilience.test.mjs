// Coded by @qa-engineer
// Tests that the qa-engineer and sr-engineer role SOPs carry two rules: a long test or
// build run finishes (or is collected) within the same turn (E20), and a crash checkpoint
// written as an ordinary lease-refreshing write precedes a long regression run (E21). Only
// content/skill-qa-engineer.md and content/skill-sr-engineer.md are checked; the spec is
// the backlog rows. Test ids: QA/SR-E20-1/2 same-turn; QA/SR-E21-1..4 checkpoint.
// Rationale: specs/e260f-comment-rationale.md (test/e20-e21-crash-resilience.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

const SKILL_QA = readContentFile("skill-qa-engineer.md");
const SKILL_SR = readContentFile("skill-sr-engineer.md");

// --- Long runs end in the same turn: "HARD — long runs end in-turn" (E20) ---

test("QA-E20-1: skill-qa-engineer.md Hard rules carries the E20 hard line with its origin tag", () => {
  assert.match(
    SKILL_QA,
    /- \*\*HARD — long runs end in-turn\*\*<!-- origin:start --> \(E20\)<!-- origin:end -->:/,
    "must locate the E20 hard-line bullet heading with its (E20) origin tag in the Hard rules block",
  );
});

test("QA-E20-2: skill-qa-engineer.md's E20 hard line states the synchronous-or-poll-harvested-same-turn contract", () => {
  const lineMatch = SKILL_QA.match(/^- \*\*HARD — long runs end in-turn\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full E20 hard-line bullet");
  assert.ok(
    lineMatch[0].includes("run synchronously to completion") || lineMatch[0].includes("backgrounded and poll-harvested"),
    "the line must describe the synchronous-to-completion OR same-turn poll-harvest legal moves",
  );
  assert.ok(
    lineMatch[0].includes("In_Progress"),
    "the line must ground the rule in In_Progress having no 'waiting' state (the E20 incident's root cause)",
  );
});

test("SR-E20-1: skill-sr-engineer.md step 4b carries the E20 hard line with its origin tag", () => {
  assert.match(
    SKILL_SR,
    /4b\. \*\*HARD — long runs end in-turn\*\*<!-- origin:start --> \(E20\)<!-- origin:end -->:/,
    "must locate step 4b's E20 hard-line heading with its (E20) origin tag",
  );
});

test("SR-E20-2: skill-sr-engineer.md's step 4b states the same synchronous-or-poll-harvested-same-turn contract as the qa-engineer copy", () => {
  const lineMatch = SKILL_SR.match(/^4b\. \*\*HARD — long runs end in-turn\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full step 4b line");
  assert.ok(
    lineMatch[0].includes("long builds/suites run synchronously to completion") ||
      lineMatch[0].includes("backgrounded and poll-harvested"),
    "the line must describe the synchronous-to-completion OR same-turn poll-harvest legal moves",
  );
});

// --- Crash checkpoint written as an ordinary write (E21) -------------------

test("QA-E21-1: skill-qa-engineer.md Phase 4 carries the E21 crash-checkpoint bullet with its origin tag", () => {
  assert.match(
    SKILL_QA,
    /- \*\*Crash checkpoint\*\*<!-- origin:start --> \(E21\)<!-- origin:end -->:/,
    "must locate the E21 crash-checkpoint bullet heading with its (E21) origin tag under Phase 4",
  );
});

test("QA-E21-2: skill-qa-engineer.md's crash-checkpoint bullet fires before the full regression run and passes no bookkeeping argument", () => {
  const lineMatch = SKILL_QA.match(/^   - \*\*Crash checkpoint\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full crash-checkpoint bullet line");
  assert.ok(
    lineMatch[0].includes("BEFORE launching the full regression run"),
    "the bullet must checkpoint BEFORE the full regression run, not after",
  );
  assert.ok(!lineMatch[0].includes("bookkeeping_write"), "the checkpoint is an ordinary write: no bookkeeping argument");
  assert.ok(lineMatch[0].includes('agent_id="qa-engineer"'), "the checkpoint write must stamp agent_id=\"qa-engineer\"");
});

test("QA-E21-3: skill-qa-engineer.md's crash-checkpoint bullet appears strictly before the 'Build gate' line of the Run step", () => {
  const checkpointIdx = SKILL_QA.indexOf("**Crash checkpoint**");
  const buildIdx = SKILL_QA.indexOf("Build gate (Constitution §2 *Build gate*)");
  assert.ok(checkpointIdx > 0 && buildIdx > 0, "both anchors must exist");
  assert.ok(checkpointIdx < buildIdx, "the crash checkpoint must precede the build/regression run, not follow it");
});

test("QA-E21-4: skill-qa-engineer.md's crash-checkpoint bullet says the checkpoint is an ordinary write that refreshes the lease", () => {
  const lineMatch = SKILL_QA.match(/^   - \*\*Crash checkpoint\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full crash-checkpoint bullet line");
  assert.ok(
    lineMatch[0].includes("an ordinary write that refreshes the lease"),
    "a checkpoint is written by a live role, so it must extend the feature lease — the bullet must say so",
  );
  assert.ok(!/administrative|untouched|file-mode only/.test(lineMatch[0]), "no lease-untouched or file-mode-only wording");
});

test("SR-E21-1: skill-sr-engineer.md step 4a carries the E21 crash-checkpoint step with its origin tag", () => {
  assert.match(
    SKILL_SR,
    /4a\. \*\*Crash checkpoint before long steps\*\*<!-- origin:start --> \(E21\)<!-- origin:end -->:/,
    "must locate step 4a's E21 crash-checkpoint heading with its (E21) origin tag",
  );
});

test("SR-E21-2: skill-sr-engineer.md's step 4a fires before any long-running build/suite and passes no bookkeeping argument", () => {
  const lineMatch = SKILL_SR.match(/^4a\. \*\*Crash checkpoint before long steps\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full step 4a line");
  assert.ok(
    lineMatch[0].includes("BEFORE launching any long-running build/suite"),
    "step 4a must checkpoint BEFORE the long-running step, not after",
  );
  assert.ok(!lineMatch[0].includes("bookkeeping_write"), "step 4a is an ordinary write: no bookkeeping argument");
  assert.ok(lineMatch[0].includes('agent_id="sr-engineer"'), "the checkpoint write must stamp agent_id=\"sr-engineer\"");
});

test("SR-E21-3: skill-sr-engineer.md's step 4a sits strictly between step 4 (Implement) and step 5 (type/lint)", () => {
  const sopStart = SKILL_SR.indexOf("## SOP");
  const step4Idx = SKILL_SR.indexOf("4. Read the relevant", sopStart);
  const step4aIdx = SKILL_SR.indexOf("4a. **Crash checkpoint", sopStart);
  const step5Idx = SKILL_SR.indexOf("5. Run type/lint", sopStart);
  assert.ok(step4Idx > 0 && step4aIdx > 0 && step5Idx > 0, "all three anchors must exist in the SOP");
  assert.ok(step4Idx < step4aIdx && step4aIdx < step5Idx, "4a must sit strictly between step 4 and step 5");
});

test("SR-E21-4: skill-sr-engineer.md's step 4a says the checkpoint is an ordinary write that refreshes the lease", () => {
  const lineMatch = SKILL_SR.match(/^4a\. \*\*Crash checkpoint before long steps\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full step 4a line");
  assert.ok(
    lineMatch[0].includes("an ordinary write that refreshes the lease"),
    "a checkpoint is written by a live role, so it must extend the feature lease — step 4a must say so",
  );
  assert.ok(!/administrative|untouched|file-mode only/.test(lineMatch[0]), "no lease-untouched or file-mode-only wording");
});

// --- Cross-file consistency: both SOP copies describe the same contract (an
// ordinary write that refreshes the lease) in the same words.

test("CROSS-1: both E21 bullets describe an ordinary write that refreshes the lease, with no bookkeeping argument", () => {
  const qaLine = SKILL_QA.match(/^   - \*\*Crash checkpoint\*\*.*$/m)[0];
  const srLine = SKILL_SR.match(/^4a\. \*\*Crash checkpoint before long steps\*\*.*$/m)[0];
  for (const [who, line] of [["qa-engineer", qaLine], ["sr-engineer", srLine]]) {
    assert.match(line, /an ordinary write that refreshes the lease/, `${who} copy must say the checkpoint refreshes the lease`);
    assert.ok(!line.includes("bookkeeping_write"), `${who} copy must not pass a bookkeeping argument`);
  }
});

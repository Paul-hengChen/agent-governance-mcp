// Coded by @qa-engineer
// Tests for backlog E20/E21 (docs/backlog.md) / T-E20-01, T-E21-01.
// Spec = the two backlog table rows themselves (E20, E21) — content-only,
// mini-chain (sr -> code-reviewer -> qa), no specs/<feature>.md file, per the
// handoff's scope_decision_why. Both fixes are two-line additions to
// content/skill-qa-engineer.md and content/skill-sr-engineer.md; templates
// were confirmed (by sr-engineer, re-confirmed here) to be thin pointers that
// need no mirror edit — this suite pins ONLY the two skill files.
//
// Spec-to-Test map:
//   E20 hard line present verbatim in skill-qa-engineer.md Hard rules  -> QA-E20-1, QA-E20-2
//   E20 hard line present verbatim in skill-sr-engineer.md step 4b     -> SR-E20-1, SR-E20-2
//   E21 crash-checkpoint bullet in skill-qa-engineer.md Phase 4        -> QA-E21-1, QA-E21-2, QA-E21-3
//   E21 crash-checkpoint step in skill-sr-engineer.md step 4a          -> SR-E21-1, SR-E21-2, SR-E21-3
//   Both E21 bullets carry the qa-added "(file-mode only)" accuracy
//     caveat (bookkeeping_write is file-mode-only per tools/registry.ts
//     + handoff-orchestrator.ts — see QA review doc) -> QA-E21-4, SR-E21-4
//   Byte/token budgets absorbing these four new lines stay green        -> covered by
//     test/context-budget.test.mjs (skill-sr cap) and
//     test/qa-visual-skill-split.test.mjs AC-5 (skill-qa-engineer.md cap),
//     re-baselined in the same round as this file — not duplicated here.

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

// --- E20: "HARD — long runs end in-turn" ------------------------------------

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

// --- E21: crash checkpoint via bookkeeping_write ----------------------------

test("QA-E21-1: skill-qa-engineer.md Phase 4 carries the E21 crash-checkpoint bullet with its origin tag", () => {
  assert.match(
    SKILL_QA,
    /- \*\*Crash checkpoint\*\*<!-- origin:start --> \(E21\)<!-- origin:end -->:/,
    "must locate the E21 crash-checkpoint bullet heading with its (E21) origin tag under Phase 4",
  );
});

test("QA-E21-2: skill-qa-engineer.md's crash-checkpoint bullet fires BEFORE the full regression run and names bookkeeping_write=true", () => {
  const lineMatch = SKILL_QA.match(/^   - \*\*Crash checkpoint\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full crash-checkpoint bullet line");
  assert.ok(
    lineMatch[0].includes("BEFORE launching the full regression run"),
    "the bullet must checkpoint BEFORE the full regression run, not after",
  );
  assert.ok(lineMatch[0].includes('bookkeeping_write=true'), "the bullet must invoke bookkeeping_write=true");
  assert.ok(lineMatch[0].includes('agent_id="qa-engineer"'), "the checkpoint write must stamp agent_id=\"qa-engineer\"");
});

test("QA-E21-3: skill-qa-engineer.md's crash-checkpoint bullet appears strictly before the 'Project build: ZERO errors' line in Phase 4", () => {
  const checkpointIdx = SKILL_QA.indexOf("**Crash checkpoint**");
  const buildIdx = SKILL_QA.indexOf("Project build: ZERO errors");
  assert.ok(checkpointIdx > 0 && buildIdx > 0, "both anchors must exist");
  assert.ok(checkpointIdx < buildIdx, "the crash checkpoint must precede the build/regression run, not follow it");
});

test("QA-E21-4: skill-qa-engineer.md's crash-checkpoint bullet carries the qa-added file-mode-only accuracy caveat", () => {
  const lineMatch = SKILL_QA.match(/^   - \*\*Crash checkpoint\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full crash-checkpoint bullet line");
  assert.ok(
    lineMatch[0].includes("(file-mode only)"),
    "bookkeeping_write is file-mode-only (tools/registry.ts + handoff-orchestrator.ts ignore it in SQLite mode) — the bullet must say so",
  );
});

test("SR-E21-1: skill-sr-engineer.md step 4a carries the E21 crash-checkpoint step with its origin tag", () => {
  assert.match(
    SKILL_SR,
    /4a\. \*\*Crash checkpoint before long steps\*\*<!-- origin:start --> \(E21\)<!-- origin:end -->:/,
    "must locate step 4a's E21 crash-checkpoint heading with its (E21) origin tag",
  );
});

test("SR-E21-2: skill-sr-engineer.md's step 4a fires BEFORE any long-running build/suite and names bookkeeping_write=true", () => {
  const lineMatch = SKILL_SR.match(/^4a\. \*\*Crash checkpoint before long steps\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full step 4a line");
  assert.ok(
    lineMatch[0].includes("BEFORE launching any long-running build/suite"),
    "step 4a must checkpoint BEFORE the long-running step, not after",
  );
  assert.ok(lineMatch[0].includes('bookkeeping_write=true'), "step 4a must invoke bookkeeping_write=true");
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

test("SR-E21-4: skill-sr-engineer.md's step 4a carries the qa-added file-mode-only accuracy caveat", () => {
  const lineMatch = SKILL_SR.match(/^4a\. \*\*Crash checkpoint before long steps\*\*.*$/m);
  assert.ok(lineMatch, "must locate the full step 4a line");
  assert.ok(
    lineMatch[0].includes("(file-mode only)"),
    "bookkeeping_write is file-mode-only (tools/registry.ts + handoff-orchestrator.ts ignore it in SQLite mode) — step 4a must say so",
  );
});

// --- Cross-file consistency: both copies describe the SAME bookkeeping_write
// contract actually implemented server-side (tools/handoff-orchestrator.ts
// L323-357, L1147-1153: file-mode only, preserves on-disk last_updated
// verbatim on a same-feature write; rejected with
// BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE on a feature change). Both SOP
// lines say "administrative write" + "lease timestamp"/"lease-timestamp" —
// pin that neither drifted from that contract in wording.

test("CROSS-1: both E21 bullets describe an administrative write that does not refresh the lease timestamp (matches the server contract)", () => {
  const qaLine = SKILL_QA.match(/^   - \*\*Crash checkpoint\*\*.*$/m)[0];
  const srLine = SKILL_SR.match(/^4a\. \*\*Crash checkpoint before long steps\*\*.*$/m)[0];
  assert.match(qaLine, /administrative write.*lease timestamp untouched/, "qa-engineer copy must describe the lease-timestamp-untouched contract");
  assert.match(srLine, /administrative write.*does NOT refresh the lease timestamp/, "sr-engineer copy must describe the lease-timestamp-not-refreshed contract");
});

// Coded by @qa-engineer
// Tests for specs/pixel-perfect-fixes-v3.14.md — AC-4.
// Asserts skill-sr-engineer SOP carries the Phase 0.5 Design-Aware
// Pre-Flight directive AND that it sits BETWEEN Task-Size Check and the
// implementation step (so the cap gate fires before reading design files).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const SKILL_SR = path.join(PROJECT_ROOT, "content", "skill-sr-engineer.md");
const SKILL_ARCHITECT = path.join(PROJECT_ROOT, "content", "skill-architect.md");

test("AC-4: skill-sr-engineer SOP contains a Phase 0.5 Design-Aware Pre-Flight step", () => {
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  // Step is numbered 3a (between Task-Size Check at step 3 and Implement at step 4).
  assert.match(body, /3a\.\s+\*\*Design-Aware Pre-Flight\*\*/, "step 3a must exist and be labelled Design-Aware Pre-Flight");
  assert.match(body, /Design-Aware Pre-Flight.*v3\.14\.0/i, "v3.14.0 tag must be present for grep-stability");
});

test("AC-4: Phase 0.5 mandates reading design/<active_feature>.md BEFORE any file edit", () => {
  // Why: the whole point is that sr-engineer reads the design BEFORE
  // touching code (so it can't rationalise a primitive after the fact).
  // The SOP must use "BEFORE" with strong wording.
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  assert.match(body, /BEFORE any file edit/, "must require pre-flight before edits");
  assert.match(body, /design\/<active_feature>\.md/, "must reference the standard design file path");
});

test("AC-4: Phase 0.5 enumerates the 3 things to Read (design file, Visual Widgets row, baseline paths)", () => {
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  assert.match(body, /Read `?design\/<active_feature>\.md`? end-to-end/i, "must Read design file end-to-end");
  assert.match(body, /Visual Widgets.*row/i, "must Read relevant Visual Widgets row");
  assert.match(body, /baseline path/i, "must Read declared baseline paths");
});

test("AC-4: Phase 0.5 skips silently when no design file (non-UI work)", () => {
  // Backwards-compat AC-13: a server/CLI workspace must NOT pay the
  // pre-flight cost. Skip silently when design file is absent.
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  assert.match(body, /Skip silently when no `?design\/<active_feature>\.md`?/i, "must declare silent skip on absent design");
});

test("AC-4: Phase 0.5 references the Constitution §1 Visual Widgets exception", () => {
  // Why: the cross-reference ensures sr-engineer reads the rule, not just
  // the procedural step. Without it the directive is unmoored — operators
  // would not know WHY they have to read the design.
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  assert.match(body, /Constitution\s*§1\s*v3\.14\.0\s*exception/i, "must reference §1 exception");
  assert.match(body, /scope violation/i, "must restate the scope-violation framing");
});

test("AC-4: Phase 0.5 wires the split-escalation guidance for visual_round >= 3", () => {
  // The implementer-side mirror of the §3.1 split escalation. sr-engineer
  // needs to know when to abandon and ask PM to split, instead of grinding
  // to threshold renegotiation.
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  assert.match(body, /visual_round\s*>=\s*3/, "must reference visual_round >= 3 threshold");
  assert.match(body, /visual_split_requested:/, "must include the pending_notes token");
  assert.match(body, /next_role:\s*pm/, "must route to pm");
});

test("AC-4: SOP step ordering — Task-Size Check (3) BEFORE Phase 0.5 (3a) BEFORE Implement (4)", () => {
  // Why: ordering matters for fail-fast. Task-Size Check first → if the
  // task is too big, STOP without paying the design-read cost. Phase 0.5
  // second → if the task fits the budget AND has a design, read it.
  // Implement last.
  const body = fs.readFileSync(SKILL_SR, "utf-8");
  const taskSizeIdx = body.indexOf("**Task-Size Check**");
  const phase05Idx = body.indexOf("**Design-Aware Pre-Flight**");
  const implementIdx = body.search(/4\.\s+Read the relevant/);
  assert.ok(taskSizeIdx > 0, "Task-Size Check must exist");
  assert.ok(phase05Idx > taskSizeIdx, "Phase 0.5 must come AFTER Task-Size Check");
  assert.ok(implementIdx > phase05Idx, "Implement (step 4) must come AFTER Phase 0.5 (3a)");
});

// ---------- AC-3: skill-architect Visual Harness companion (closely related to Phase 0.5) ----------

test("AC-3: skill-architect declares Visual Harness as conditional MANDATORY schema section", () => {
  const body = fs.readFileSync(SKILL_ARCHITECT, "utf-8");
  assert.match(body, /\*\*Visual Harness\*\*.*v3\.14\.0.*MANDATORY when.*design\/<feature>\.md/i, "Visual Harness must be conditional-mandatory");
  assert.match(body, /OMIT entirely otherwise/, "non-UI features must omit the section entirely");
});

test("AC-3: skill-architect Visual Harness lists the 6 required sub-fields", () => {
  // Why: the architecture spec enumerates exactly what the harness section
  // must specify. Each sub-field is load-bearing for the qa-engineer
  // Phase 1.5 PASS gate to function.
  const body = fs.readFileSync(SKILL_ARCHITECT, "utf-8");
  for (const field of [
    /\*\*Test runner\*\*/,
    /\*\*Viewport list\*\*/,
    /\*\*Diff library \+ threshold\*\*/,
    /\*\*CI command\*\*/,
    /\*\*Font \/ rendering pinning\*\*/,
    /\*\*Task ordering rule\*\*/,
  ]) {
    assert.match(body, field, `Visual Harness must declare ${field}`);
  }
});

test("AC-3: skill-architect Visual Harness Gate (4a) blocks back to PM if harness task missing", () => {
  // Why: without this gate, PM could skip enumerating the harness task and
  // sr-engineer would have nothing to build. The architect's job is to
  // *verify* PM did the task-list work, not to add the task itself.
  const body = fs.readFileSync(SKILL_ARCHITECT, "utf-8");
  assert.match(body, /4a\.\s+\*\*Visual Harness Gate\*\*/, "step 4a Visual Harness Gate must exist");
  assert.match(body, /visual harness task missing/i, "block message must name the missing task");
  assert.match(body, /next_role:\s*pm/, "block must route back to PM");
});

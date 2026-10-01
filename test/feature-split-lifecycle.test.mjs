// Coded by @qa-engineer
// Tests for spec: specs/feature-split-lifecycle.md (AC1-AC7; test names carry the labels).
// The Feature-Scope Gate writes a persistent .current/feature-split.md; without lifecycle tracking
// a finished unit looks like a pending one and the coordinator may redo work. Pins the status
// column, the PASS-to-done reconcile, the resume-skip-done rule and by-id hydration, all prompt-layer
// contract in the coordinator SOP text.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// content/skill-coordinator.md no longer exists: all 3 render paths compose
// the coordinator SOP through composeSkill/SKILL_SEGMENTS. Rebuild the full
// text through the real composer (taskTool:true reproduces the old file
// byte-for-byte) instead of reading a file that no longer exists.
// (d6-host-capability-compose-axis, T-D6-04)
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const COORD = composeSkill(
  "skill-coordinator.md",
  hostCapabilitiesFor("claude-code"),
  (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8"),
);

function gateSection() {
  const a = COORD.indexOf("## Feature-Scope Gate");
  const b = COORD.indexOf("## Design-source detection", a);
  assert.ok(a >= 0 && b > a, "gate section must exist");
  return COORD.slice(a, b);
}

test("AC1: Split Table has a status column, pre-filled pending", () => {
  const sec = gateSection();
  assert.match(sec, /\|\s*status\s*\|/, "Split Table must include a status column");
  assert.match(sec, /\|\s*pending\s*\|/, "rows must be pre-filled status: pending");
  assert.match(sec, /`status` starts `pending`/, "schema note must state status starts pending");
});

test("AC2: done-marking reconciles split.md against handoff PASS", () => {
  const sec = gateSection();
  // a row flips to done when its feature id matches the handoff active_feature at PASS
  assert.match(sec, /reconcile/i, "resume must reconcile the plan");
  assert.match(sec, /active_feature[\s\S]*PASS[\s\S]*done|PASS[\s\S]*flip[\s\S]*done/i, "PASS feature must flip its row to done");
});

test("AC3: existing plan resumes — does NOT regenerate", () => {
  const sec = gateSection();
  assert.match(sec, /Existing `\.current\/feature-split\.md`/, "must branch on an existing plan");
  assert.match(sec, /do NOT re-assess or regenerate/i, "existing plan must not be regenerated");
  assert.match(sec, /next `pending` row/i, "resume must take the next pending row");
});

test("AC4: a done row is never re-run", () => {
  assert.match(gateSection(), /Never re-run a `done` row/i, "done rows must never re-run");
});

test("AC5: by-id resume hydrates the named row", () => {
  const sec = gateSection();
  assert.match(sec, /human named one.*feature id|do F0/i, "human may name a row to resume");
  assert.match(sec, /hydrate/i, "named row must be hydrated as the feature input");
});

test("AC6: gate section footprint stays within the raised ~550 budget", () => {
  const approxTokens = Math.ceil(gateSection().length / 4);
  assert.ok(approxTokens <= 550, `gate section ~${approxTokens} tok must stay <= ~550`);
});

test("AC7: single-feature / no-plan path is preserved (no lifecycle overhead)", () => {
  const sec = gateSection();
  // the no-plan branch still does the text-only single/multi judgement
  assert.match(sec, /No existing `\.current\/feature-split\.md`/, "no-plan branch must exist");
  assert.match(sec, /single-feature.*continue/i, "single-feature still continues with no interruption");
});

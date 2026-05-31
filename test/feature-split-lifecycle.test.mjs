// Coded by @qa-engineer
// Tests for spec: specs/feature-split-lifecycle.md.
// Spec-to-Test map:
//   AC1 (status column)            -> t-status-column
//   AC2 (done-marking on PASS)     -> t-done-marking
//   AC3 (resume — no regenerate)   -> t-resume-no-regen
//   AC4 (no redo)                  -> t-no-redo
//   AC5 (by-id resume)             -> t-by-id-resume
//   AC6 (footprint ≤ ~550)         -> t-footprint
//   AC7 (single-feature unaffected)-> t-no-plan-path
//
// WHY: the Feature-Scope Gate writes a persistent .current/feature-split.md; without
// lifecycle tracking a finished unit looks identical to a pending one, so the
// coordinator can't resume safely and may redo work. These tests pin the status
// column, the PASS→done reconcile, the resume-skip-done rule, and by-id hydration —
// all prompt-layer contract that lives only in skill-coordinator.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COORD = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");

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

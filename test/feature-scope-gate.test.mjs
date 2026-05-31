// Coded by @qa-engineer
// Tests for spec: specs/feature-scope-gate.md.
// Spec-to-Test map:
//   AC1 (placement)            -> t-section-before-design, t-sop-step
//   AC2 (text-only, no fetch)  -> t-text-only
//   AC3 (single vs multi)      -> t-verdict-branches
//   AC4 (split schema)         -> t-schema-columns
//   AC5 (footprint cap)        -> t-footprint
//   AC6 (lite unaffected)      -> t-lite-clean
//
// WHY: the Feature-Scope Gate lives purely in prompt text (skill-coordinator.md),
// loaded by the coordinator. There is no server enforcement — the contract IS the
// SOP wording reaching the agent. These tests pin (a) that the gate exists, is
// positioned upstream of design-source detection, and stays text-only, (b) that the
// human-fill schema keeps its figma-link + notes columns, and (c) that the always-on
// footprint stays bounded (this skill is injected every session) and never leaks
// into the lite skill.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COORD = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");
const LITE = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");

// Extract the gate section body (between its heading and the next H2).
function gateSection() {
  const a = COORD.indexOf("## Feature-Scope Gate");
  assert.ok(a >= 0, "Feature-Scope Gate section must exist");
  const b = COORD.indexOf("## Design-source detection", a);
  assert.ok(b > a, "Design-source detection must follow the gate");
  return COORD.slice(a, b);
}

test("AC1: Feature-Scope Gate section precedes Design-source detection", () => {
  const g = COORD.indexOf("## Feature-Scope Gate");
  const d = COORD.indexOf("## Design-source detection");
  assert.ok(g > 0 && g < d, "gate section must appear before design-source detection");
});

test("AC1: SOP has a Feature-Scope Gate step before the Complexity Scope Gate step", () => {
  const gate = COORD.indexOf("**Feature-Scope Gate**");
  const scope = COORD.indexOf("**Apply Complexity Scope Gate**");
  assert.ok(gate > 0, "SOP must reference the Feature-Scope Gate step");
  assert.ok(gate < scope, "Feature-Scope Gate step must run before the Complexity Scope Gate");
});

test("AC2: gate is text-only and forbids fetching a design", () => {
  const sec = gateSection();
  assert.match(sec, /Text-only/i, "gate must declare text-only assessment");
  assert.match(sec, /never open a design|don't fetch|do not fetch/i, "gate must forbid fetching/opening a design");
  // extraction stays downstream in design-auditor
  assert.match(sec, /design-auditor/, "gate must defer extraction to design-auditor");
});

test("AC3: verdict branches — single→continue, multi→STOP+ask", () => {
  const sec = gateSection();
  assert.match(sec, /single-feature.*continue|continue.*routing/i, "single-feature must continue");
  assert.match(sec, /multi-feature[\s\S]*STOP/i, "multi-feature must STOP");
  assert.match(sec, /\.current\/feature-split\.md/, "multi-feature must write the split-plan artifact");
});

test("AC4: split schema keeps human-owned figma link + notes columns", () => {
  const sec = gateSection();
  assert.match(sec, /# Feature Split Plan/, "schema must carry its title verbatim");
  assert.match(sec, /figma link/, "schema must have a figma link column");
  assert.match(sec, /notes \/ 注意事項/, "schema must have the bilingual notes column verbatim");
  assert.match(sec, /## Assessment[\s\S]*## Split Table[\s\S]*## How to proceed/, "schema must have Assessment + Split Table + How to proceed");
});

test("AC5: gate section footprint stays bounded (always-on budget)", () => {
  // The skill is injected every session; the gate must not re-inflate the bundle
  // the v3.16.2 reduction trimmed. Section is ~330 tok; cap generously at ~425.
  const sec = gateSection();
  const approxTokens = Math.ceil(sec.length / 4);
  assert.ok(approxTokens <= 425, `gate section ~${approxTokens} tok must stay <= ~425 (AC5 footprint)`);
});

test("AC6: the gate does NOT leak into the lite coordinator skill", () => {
  assert.ok(!LITE.includes("Feature-Scope Gate"), "lite skill must remain free of the gate");
  assert.ok(!LITE.includes("feature-split.md"), "lite skill must not reference the split artifact");
});

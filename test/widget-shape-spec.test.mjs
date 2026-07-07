// Coded by @qa-engineer
// Tests for specs/pixel-perfect-fixes-v3.14.md — AC-1, AC-2.
// Asserts the SOP markdown for skill-pm + skill-design-auditor carries
// the Visual Widgets schema contract. Server enforcement of widget content
// is deferred to v3.15.0 (architecture §A); these tests lint the SOPs.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const SKILL_PM = path.join(PROJECT_ROOT, "content", "skill-pm.md");
const SKILL_DESIGN_AUDITOR = path.join(PROJECT_ROOT, "content", "skill-design-auditor.md");
const SKILL_QA_VISUAL = path.join(PROJECT_ROOT, "content", "skill-qa-visual.md");
// compose-not-strip (ticket A9, DR-6): content/constitution.md is retired (AC8);
// composeConstitution({chain:true,design:true}) reproduces it byte-for-byte
// (Option R, architecture DR-1). CONSTITUTION is now the composed TEXT itself
// (was a path) — both `fs.readFileSync(CONSTITUTION, ...)` call sites below are
// updated to use the text directly.
const { composeConstitution } = await import(path.join(PROJECT_ROOT, "dist", "prompts", "build.js"));
const CONSTITUTION = composeConstitution({ chain: true, design: true });

// ---------- AC-1: skill-pm Visual Widgets schema ----------

test("AC-1: skill-pm.md declares Visual Widgets as a required H2 section", () => {
  const body = fs.readFileSync(SKILL_PM, "utf-8");
  // The required section list lives under "Spec Schema". Visual Widgets
  // must appear as a bullet AND carry the v3.14.0 tag for grep-stability.
  assert.match(body, /-\s+\*\*Visual Widgets\*\*\s*\(v3\.14\.0\)/, "skill-pm must list Visual Widgets as v3.14.0 schema bullet");
});

test("AC-1: Visual Widgets schema names the 3-column table format", () => {
  const body = fs.readFileSync(SKILL_PM, "utf-8");
  assert.match(body, /3-column table.*widget id.*description.*source-node/is, "schema must specify 3-column widget id | description | source-node");
});

test("AC-1: skill-pm explicitly enumerates primitive-vs-widget examples", () => {
  // Why: the section's purpose is to prevent sr-engineer from rationalising
  // an HTML primitive over a widget. The spec must give concrete examples
  // covering the cde-oobe class of failure (DateTime picker → input).
  const body = fs.readFileSync(SKILL_PM, "utf-8");
  assert.match(body, /column-scroller.*<input type="date">/i, "must enumerate column-scroller vs input[type=date]");
  assert.match(body, /virtual.*keyboard/i, "must enumerate virtual on-screen keyboard");
  assert.match(body, /segmented.*<select>/i, "must enumerate custom segmented vs select");
});

test("AC-1: Visual Widgets section requires N/A row for no-widget features (NOT omission)", () => {
  // Why: explicit absence — making the section mandatory prevents teams
  // from quietly forgetting it. The N/A row is the "I deliberately have
  // no widgets" signal.
  const body = fs.readFileSync(SKILL_PM, "utf-8");
  assert.match(body, /N\/A.*feature has no non-primitive widgets/, "N/A row must be specified for absence");
});

test("AC-1: skill-pm cross-references Constitution §1 Visual Widgets exception", () => {
  const body = fs.readFileSync(SKILL_PM, "utf-8");
  assert.match(body, /Constitution\s*§1/, "must cross-ref Constitution §1 for the MVP exception");
  assert.match(body, /scope violation/i, "must declare primitive substitution = scope violation");
});

// ---------- AC-2: design-auditor extraction contract ----------

test("AC-2: skill-design-auditor declares Visual Widgets in Artifact Schema", () => {
  const body = fs.readFileSync(SKILL_DESIGN_AUDITOR, "utf-8");
  assert.match(body, /-\s+\*\*Visual Widgets\*\*\s*\(v3\.14\.0\)/, "design-auditor must list Visual Widgets as v3.14.0 schema bullet");
});

test("AC-2: widget-shape heuristics table enumerates the 8 known cases", () => {
  // Why: the heuristics list is what turns "look at the Figma layer names"
  // into a deterministic extraction step. Each row must name a match
  // pattern, the widget shape, and the primitive to AVOID.
  const body = fs.readFileSync(SKILL_DESIGN_AUDITOR, "utf-8");
  for (const pattern of [
    /Picker.*column-scroller/i,
    /Keyboard.*virtual/i,
    /Segmented.*segmented/i,
    /Scrollbar.*scrollbar/i,
    /Stepper.*stepper/i,
    /Accordion.*accordion/i,
    /Slider.*slider/i,
    /Toggle.*toggle/i,
  ]) {
    assert.match(body, pattern, `heuristics must cover ${pattern}`);
  }
});

test("AC-2: heuristics include 'verify with PM' tag for uncertain matches", () => {
  // Why: a heuristic that's too strict over-fires; one that's too lax
  // under-fires. The "verify with PM" escape valve lets the auditor surface
  // edge cases instead of swallowing them.
  const body = fs.readFileSync(SKILL_DESIGN_AUDITOR, "utf-8");
  assert.match(body, /verify with PM/i, "auditor must have an explicit uncertainty escape route");
});

test("AC-2: heuristics distinguish widget from styled primitive (out-of-scope clause)", () => {
  // Why: without this, the heuristics would over-flag (e.g. every styled
  // <button> would become a "widget"). The carve-out keeps Visual Tokens
  // and Visual Widgets non-overlapping.
  const body = fs.readFileSync(SKILL_DESIGN_AUDITOR, "utf-8");
  assert.match(body, /Out-of-scope.*restyled CSS/i, "must declare restyled primitives as Visual Token, not Visual Widget");
});

test("AC-2: PM copies Visual Widgets verbatim from design-auditor output", () => {
  // Round-trip: design-auditor produces the table, PM consumes it. The
  // copy-verbatim instruction lives in skill-pm; AC-2 also asks the
  // auditor side to declare its output is meant to be copied.
  const auditorBody = fs.readFileSync(SKILL_DESIGN_AUDITOR, "utf-8");
  const pmBody = fs.readFileSync(SKILL_PM, "utf-8");
  assert.match(auditorBody, /PM copies this verbatim into `specs\/<feature>\.md`/, "auditor must declare verbatim copy contract");
  assert.match(pmBody, /design\/<feature>\.md.*Visual Widgets/i, "PM must reference design/<feature>.md Visual Widgets");
});

// ---------- R6: skill-qa-visual widget shape verification (SOP-level enforcement) ----------

test("R6: skill-qa-visual carries the Widget Shape Verification checklist", () => {
  const body = fs.readFileSync(SKILL_QA_VISUAL, "utf-8");
  assert.match(body, /Widget Shape Verification/, "Step A H2 must exist");
  assert.match(body, /Step A.*Widget Shape Checklist/is, "Step A heading must declare Widget Shape Checklist");
});

test("R6: checklist rule — shape miss precedes pixel diff (gates Step B)", () => {
  const body = fs.readFileSync(SKILL_QA_VISUAL, "utf-8");
  assert.match(body, /shape FAIL precedes pixel diff/i, "rule must declare shape > pixel priority");
  assert.match(body, /do NOT proceed to Step B/i, "shape miss must short-circuit Step B");
});

// ---------- R5: Constitution §1 MVP exception ----------

test("R5: Constitution §1 carries the Visual Widgets exception clause", () => {
  const body = CONSTITUTION;
  // The exception MUST be a sub-bullet of **MVP strict** (per arch),
  // and MUST name "scope violation" explicitly.
  assert.match(body, /Visual Widgets exception\s*\(v3\.14\.0\)/, "exception clause must be tagged v3.14.0");
  assert.match(body, /scope violation, NOT MVP compliance/i, "must declare primitive substitution = scope violation");
});

test("R5: exception clause is nested under MVP strict (not a top-level rule)", () => {
  // Why: keeping the exception adjacent to the rule it modifies is what
  // makes the contract readable. A floating top-level clause would be lost.
  const body = CONSTITUTION;
  const mvpIdx = body.indexOf("**MVP strict**");
  const exceptionIdx = body.indexOf("Visual Widgets exception");
  const surgicalIdx = body.indexOf("**Surgical changes**");
  assert.ok(mvpIdx < exceptionIdx, "exception must come AFTER MVP strict");
  assert.ok(exceptionIdx < surgicalIdx, "exception must come BEFORE next top-level rule (Surgical changes)");
});

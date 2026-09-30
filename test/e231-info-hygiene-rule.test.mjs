// Coded by @qa-engineer
// Tests that the information-hygiene and generic-citation rule bullets are
// present in the constitution and survive composition in every dispatch
// mode. Spec: specs/e231-info-hygiene-rule.md. (E231)
//
// Spec-to-Test map:
//   AC1 -> "AC1" tests below (both new bullets' key phrases, verbatim, in
//          content/const-15-core-tail.md §6)
//   AC2 -> "AC2" test below (both bullets survive composition on all four
//          dispatch arms: lite/chain x design/non-design, because
//          const-15-core-tail.md is core-tagged and includeSegment("core", …)
//          returns true unconditionally)
//   AC3, AC4, AC5, AC6 are covered elsewhere per the spec's own Test surfaces
//   line: AC3 by a direct `git diff` read (not a standing test — a one-line
//   CONTRIBUTING.md sentence has no ongoing regression risk of its own beyond
//   what test/compose-equivalence.test.mjs already pins for composed output);
//   AC4 by the test/context-budget.test.mjs size ceilings; AC5 is implied by AC1 asserting the bullets are
//   ADDITIONS (the surrounding §5/§6/§7 text this file reads is untouched by
//   construction — any accidental edit to it would desync this file's own
//   phrase anchors); AC6 is a repo-wide `git diff --stat` scope check, not a
//   unit of composed output this file's helpers can observe.
//
// The new bullets keep the spec's own line
// wrapping (content/const-15-core-tail.md wraps prose at ~90 columns), so
// every phrase below is checked against a WHITESPACE-NORMALIZED copy of the
// fragment (all runs of whitespace collapsed to a single space) rather than
// against the raw multi-line source — a phrase that happens to straddle a
// wrap point must still match.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const CONST15 = fs.readFileSync(path.join(ROOT, "content", "const-15-core-tail.md"), "utf-8");
const norm = (text) => text.replace(/\s+/g, " ").trim();
const NORM_CONST15 = norm(CONST15);

const { composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));

// Both bullets' key phrases, verbatim (whitespace-normalized). Grouped so a
// failure names exactly which clause went missing rather than one opaque
// giant-string mismatch.
const INFO_HYGIENE_PHRASES = [
  "**Information hygiene**: No durable output — code comments, specs, qa/review reports, `pending_notes`, handoff, commit messages, PR bodies, CHANGELOG — may contain security-sensitive detail:",
  "an employer-internal URL or work-item link",
  "a third-party client/project codename",
  "a design-tool file key",
  "a credential,",
  "an absolute local path/username.",
  "Describe by class, never the literal string.",
  "No artifact type is exempt.",
  "A value a tool's input schema requires verbatim (e.g. an absolute workspace path) is protocol, not prose.",
];

const GENERIC_CITATION_PHRASES = [
  "**Generic citation**: The same output must read without this repo's own tooling context —",
  "no governance jargon (round/gate/`tw_*`/PASS-FAIL)",
  "no bare ticket id or AC reference standing alone as the explanation (pair it with plain language on the same line)",
  "and cite only tracked paths.",
  "Machine-validated fields (handoff YAML keys, filename conventions, status enums)",
  "governance-internal artifacts (qa/review reports, `pending_notes`, handoff) are exempt from this bullet.",
];

test("AC1: content/const-15-core-tail.md §6 carries the Information hygiene bullet — all five leak classes, full durable-output list, no author exemption, protocol carve-out", () => {
  assert.match(CONST15, /## 6\. Security & Privacy/, "§6 heading must be present");
  for (const phrase of INFO_HYGIENE_PHRASES) {
    assert.ok(NORM_CONST15.includes(phrase), `const-15 §6 Information hygiene bullet missing phrase: ${JSON.stringify(phrase)}`);
  }
  // The full durable-output list, checked item by item (a future rewording
  // that dropped just one of these — e.g. pending_notes or handoff, the two
  // artifact classes the spec calls out by name as commonly-assumed-exempt —
  // would still pass a looser "the bullet exists" check but must fail here.
  for (const artifact of [
    "code comments",
    "specs",
    "qa/review reports",
    "`pending_notes`",
    "handoff",
    "commit messages",
    "PR bodies",
    "CHANGELOG",
  ]) {
    assert.ok(NORM_CONST15.includes(artifact), `Information hygiene bullet's durable-output list missing: ${artifact}`);
  }
});

test("AC1: content/const-15-core-tail.md §6 carries the Generic citation bullet — no-bare-id clause, cite-tracked-paths, both exemptions", () => {
  for (const phrase of GENERIC_CITATION_PHRASES) {
    assert.ok(NORM_CONST15.includes(phrase), `const-15 §6 Generic citation bullet missing phrase: ${JSON.stringify(phrase)}`);
  }
});

test("AC1: the two bullets sit in §6, after Tool-internal ops and before ## 7. Cognitive Discipline (placement, not just presence)", () => {
  const toolInternalIdx = CONST15.indexOf("**Tool-internal ops**");
  const infoHygieneIdx = CONST15.indexOf("**Information hygiene**");
  const genericCitationIdx = CONST15.indexOf("**Generic citation**");
  const section7Idx = CONST15.indexOf("## 7. Cognitive Discipline");
  assert.ok(toolInternalIdx >= 0, "Tool-internal ops bullet must exist (this ticket appends after it, never inserts before)");
  assert.ok(infoHygieneIdx > toolInternalIdx, "Information hygiene bullet must come after Tool-internal ops");
  assert.ok(genericCitationIdx > infoHygieneIdx, "Generic citation bullet must come after Information hygiene");
  assert.ok(section7Idx > genericCitationIdx, "Generic citation bullet must come before ## 7. Cognitive Discipline");
});

test("AC2: both new bullets ship on all four dispatch arms (lite/chain x design/non-design) — const-15 is core-tagged", () => {
  const arms = [
    { chain: false, design: false },
    { chain: false, design: true },
    { chain: true, design: false },
    { chain: true, design: true },
  ];
  for (const arm of arms) {
    const composed = norm(composeConstitution(arm));
    const label = `chain=${arm.chain}, design=${arm.design}`;
    assert.ok(composed.includes("**Information hygiene**:"), `Information hygiene bullet missing on arm ${label}`);
    assert.ok(composed.includes("**Generic citation**:"), `Generic citation bullet missing on arm ${label}`);
    // one class-level phrase per bullet, so a future accidental design/chain
    // fence placed around the bullets (moving them out of the always-on
    // core segment) is caught on every arm, not only by presence of the bold
    // heading text.
    assert.ok(composed.includes("No artifact type is exempt."), `Information hygiene "no exemption" clause missing on arm ${label}`);
    assert.ok(
      composed.includes("governance-internal artifacts (qa/review reports, `pending_notes`, handoff) are exempt from this bullet."),
      `Generic citation exemption clause missing on arm ${label}`,
    );
  }
});

// Coded by @qa-engineer
// Tests for spec: specs/researcher-deep-research-integration.md.
// Spec-to-Test map: AC-1 -> t1; AC-2 -> t2; AC-3 -> t3; AC-4 -> t4;
//                   AC-5 -> t5 (built-prompt trigger behaviour via buildResearcherPrompt).
//
// WHY: the researcher role's deep-research wiring lives purely in prompt text
// (skill-researcher.md), loaded verbatim by buildPromptForRole. There is no
// server-enforced trigger — the contract IS the SOP wording reaching the agent.
// These tests pin that wording so a future edit can't silently drop the
// standalone-default-deep rule or the /deep-research invocation directive.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const SKILL = fs.readFileSync(
  path.join(PROJECT_ROOT, "content", "skill-researcher.md"),
  "utf-8",
);

test("AC-1: standalone invocation with no declared depth defaults to deep", () => {
  // Contract: a bare researcher call (no `researcher_depth:` in pending_notes)
  // must default to `deep` so it auto-runs the deep-research harness.
  assert.match(
    SKILL,
    /Standalone default[\s\S]*?no `researcher_depth:` declared[\s\S]*?defaults to `deep`/,
    "Depth clause must declare standalone (undeclared) default = deep",
  );
});

test("AC-2: deep depth directs invoking the /deep-research skill then distilling", () => {
  assert.match(
    SKILL,
    /At `deep` depth, invoke the `\/deep-research` skill/,
    "SOP must direct /deep-research invocation at deep depth",
  );
  assert.match(
    SKILL,
    /distil[\s\S]*?Findings Schema/,
    "deep-research output must be distilled into the Findings Schema",
  );
});

test("AC-3: graceful fallback when /deep-research is unavailable", () => {
  assert.match(
    SKILL,
    /If `\/deep-research` is unavailable, fall back to manual web search/,
    "SOP must define a manual-search fallback (no hard failure)",
  );
});

test("AC-4: shallow depth does NOT force /deep-research (cost-frugal path preserved)", () => {
  assert.match(
    SKILL,
    /At `shallow` depth, do NOT invoke `\/deep-research`/,
    "shallow path must explicitly skip /deep-research",
  );
});

test("AC-5: built researcher prompt carries the deep-research directives (trigger behaviour)", async () => {
  // The directives are only effective if buildPromptForRole actually inlines
  // skill-researcher.md into the prompt the agent receives. Assert through the
  // real builder, not just the raw file, to verify the wiring end-to-end.
  const { buildResearcherPrompt } = await import(
    path.join(PROJECT_ROOT, "dist", "prompts", "researcher.js")
  );
  const text = buildResearcherPrompt(PROJECT_ROOT).messages[0].content.text;
  assert.match(text, /Standalone default[\s\S]*?defaults to `deep`/, "built prompt must carry default-deep rule");
  assert.match(text, /invoke the `\/deep-research` skill/, "built prompt must carry deep-research invocation");
  assert.match(text, /fall back to manual web search/, "built prompt must carry fallback wording");
});

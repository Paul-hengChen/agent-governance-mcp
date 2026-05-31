// Coded by @qa-engineer
// Tests for spec: specs/researcher-deep-research-integration.md.
// Spec-to-Test map: AC-1 -> t1; AC-2 -> t2; AC-3 -> t3; AC-4 -> t4;
//                   AC-5 -> t5 (built-prompt trigger behaviour via buildResearcherPrompt).
//
// WHY: the researcher role's deep-research wiring lives purely in prompt text
// (skill-researcher.md), loaded verbatim by buildPromptForRole. There is no
// server-enforced trigger — the contract IS the SOP wording reaching the agent.
// These tests pin that wording so a future edit can't silently drop the
// standalone-default-shallow rule (v3.16.1: standalone is the cost-frugal path,
// deep is opt-in and must warn on token cost) or the /deep-research directive.

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

test("AC-1: standalone invocation with no declared depth defaults to shallow", () => {
  // Contract (v3.16.1): a bare researcher call (no `researcher_depth:` in
  // pending_notes) must default to `shallow` — the cost-frugal path that does
  // NOT spawn the /deep-research harness. deep is opt-in only.
  assert.match(
    SKILL,
    /Standalone default[\s\S]*?no `researcher_depth:` declared[\s\S]*?defaults to `shallow`/,
    "Depth clause must declare standalone (undeclared) default = shallow",
  );
  assert.match(
    SKILL,
    /`deep` is \*\*opt-in only\*\*/,
    "deep must be opt-in only, not the standalone default",
  );
});

test("AC-2: deep depth warns on token cost, then invokes /deep-research and distils", () => {
  // v3.16.1: deep must FIRST warn the user the harness is token-expensive and
  // confirm before launching — the cost guardrail that justifies the default flip.
  assert.match(
    SKILL,
    /At `deep` depth, FIRST warn[\s\S]*?token-expensive[\s\S]*?confirm before launching/,
    "SOP must warn + confirm before launching /deep-research at deep depth",
  );
  assert.match(
    SKILL,
    /Then invoke the `\/deep-research` skill/,
    "SOP must still direct /deep-research invocation at deep depth (after the warning)",
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

test("AC-4: shallow depth (the default) does NOT force /deep-research (cost-frugal path preserved)", () => {
  assert.match(
    SKILL,
    /At `shallow` depth \(the \*\*default\*\*\), do NOT invoke `\/deep-research`/,
    "shallow path must explicitly skip /deep-research and be marked the default",
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
  assert.match(text, /Standalone default[\s\S]*?defaults to `shallow`/, "built prompt must carry default-shallow rule");
  assert.match(text, /At `deep` depth, FIRST warn[\s\S]*?token-expensive/, "built prompt must carry the deep-depth token-cost warning");
  assert.match(text, /invoke the `\/deep-research` skill/, "built prompt must carry deep-research invocation");
  assert.match(text, /fall back to manual web search/, "built prompt must carry fallback wording");
});

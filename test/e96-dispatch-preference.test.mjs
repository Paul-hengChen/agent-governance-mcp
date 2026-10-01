// Coded by @qa-engineer
// Tests that the coordinator SOP prefers real subagent dispatch (Task) and falls back to
// in-context role switching only when Task is genuinely unavailable; a host system-prompt
// nudge is not a reason once the user has asked for the chain. The spec is the backlog row
// (option (i)). Each test checks the SHAPE of a guarantee, not an exact sentence.
// Rationale: specs/e260g-comment-rationale.md (test/e96-dispatch-preference.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const CONTENT_DIR = path.join(ROOT, "content");

const { composeSkill, hostCapabilitiesFor } = await import(
  path.join(ROOT, "dist", "prompts", "skill-manifest.js")
);

const readContent = (f) => fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
const coord02 = readContent("coord-02-host-dispatch.md");
const coord03 = readContent("coord-03-core-fallback.md");

// ---------------------------------------------------------------------------
// 1. coord-02: explicit /teamwork (or equivalent) invocation IS the dispatch
//    request — the anti-nudge premise the fallback-taking heuristic must not
//    override.
// ---------------------------------------------------------------------------

test("t-anti-nudge-request: coord-02 states an explicit /teamwork invocation (or equivalent explicit coordinator entry) IS the user's subagent-dispatch request", () => {
  assert.match(
    coord02,
    /explicit `\/teamwork` invocation \(or equivalent explicit coordinator entry\) IS/,
    "coord-02 must name an explicit /teamwork invocation (or equivalent explicit entry) as satisfying the host nudge's own condition",
  );
  assert.match(
    coord02,
    /not a reason to take the Fallback below/i,
    "coord-02 must state the host-prompt nudge is NOT grounds for the fallback once the user has already asked via /teamwork",
  );
});

// ---------------------------------------------------------------------------
// 2. Compose-axis property: the WHEN/DO §3.2 surfacing rule must be
//    host:claude-code-gated (the round-1 defect: it must NOT compose under
//    the lean/undefined-host default, where the SOP offers no dispatch
//    mechanism at all and the rule would fire on every compliant hop).
// ---------------------------------------------------------------------------

const WHEN_DO_MARKER = /DO surface it in chat as a §3\.2 builder ≠ judge downgrade/;

test("t-when-do-compose-axis-absent-lean: the WHEN/DO §3.2 surfacing rule is ABSENT from the lean (undefined host) composition", () => {
  const lean = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), readContent);
  assert.doesNotMatch(
    lean,
    WHEN_DO_MARKER,
    "lean composition (no host / non-Claude-Code hosts) must NOT carry the surfacing rule — that profile's SOP offers no Task dispatch mechanism at all, so the rule would announce the SOP's own prescribed behavior on every hop (round-1 false-positive defect)",
  );
});

test("t-when-do-compose-axis-present-cc: the WHEN/DO §3.2 surfacing rule IS present under the claude-code (taskTool:true) composition", () => {
  const cc = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent);
  const occurrences = (cc.match(new RegExp(WHEN_DO_MARKER.source, "g")) || []).length;
  assert.equal(
    occurrences,
    1,
    "claude-code composition must carry the surfacing rule exactly once — this is the only profile where the Task capability the rule presupposes actually exists",
  );
});

test("t-when-do-same-fragment-as-dispatch-mechanic: the WHEN/DO rule lives in coord-02 (host:claude-code), NOT coord-03 (core)", () => {
  // Pins the fix itself, not just its compose outcome: the rule and the Task
  // capability it assumes must be in the SAME fragment, so they can never
  // land on opposite sides of the host-capability axis again. (D6)
  assert.match(coord02, WHEN_DO_MARKER, "coord-02 (host:claude-code) must carry the WHEN/DO surfacing rule");
  assert.doesNotMatch(coord03, WHEN_DO_MARKER, "coord-03 (core, composes on every host) must NOT carry the WHEN/DO surfacing rule");
});

// ---------------------------------------------------------------------------
// 3. coord-03: fallback conditioned on genuine unavailability, self-contained,
//    and the bare "graceful and silent" framing retired.
// ---------------------------------------------------------------------------

test("t-fallback-genuine-unavailability: coord-03's fallback is conditioned on genuine tool unavailability", () => {
  assert.match(
    coord03,
    /reserved for genuine tool unavailability/,
    "the fallback line must be scoped to genuine unavailability, not any host-prompt nudge",
  );
  assert.match(
    coord03,
    /host advertises no `Task` tool, or the `Task` call returns a tool-error/,
    "the two disjuncts (no advertised Task tool; a Task call that errors/unknown-subagent-types) must both be present as the genuine-unavailability test",
  );
});

test("t-fallback-self-contained: coord-03's fallback conditioning names its own conditions, with no cross-fragment back-reference into coord-02", () => {
  // Scoped to the Fallback paragraph itself (its first line/sentence group) —
  // coord-03 legitimately contains OTHER, same-file "...above" self-references
  // elsewhere (the Claim-vs-state "row above", the Cut-approval "writer
  // obligation above"); those point within the same file, not into another
  // fragment, and the code review deliberately left them alone (C2).
  // What must be gone is a pointer FROM the fallback line INTO coord-02's
  // text, e.g. the retired "(the fallback heuristic above)".
  const fallbackPara = coord03.split("\n\n")[0];
  assert.match(fallbackPara, /^\*\*Fallback \(`tw_switch_role`\)\*\*/, "test is scoped to the Fallback paragraph — fixture assumption changed?");
  assert.doesNotMatch(
    fallbackPara,
    /\babove\b/i,
    'the Fallback paragraph must not point at "the heuristic above" (or any other cross-fragment pointer) — round-1 C2: a lean-profile reader receives coord-03 without coord-02 and the pointer would dangle',
  );
  // unknown-subagent-type must be independently RESTATED in coord-03, not just
  // referenced — a self-contained restatement is what makes the fragment safe
  // to compose without its sibling.
  assert.match(fallbackPara, /unknown-subagent-type/, "coord-03's Fallback paragraph must independently name the unknown-subagent-type condition, not defer to coord-02");
});

test("t-fallback-silent-framing-retired: the bare, unqualified \"graceful and silent\" framing is gone from coord-03", () => {
  assert.doesNotMatch(
    coord03,
    /graceful and silent/,
    'the pre-E96 "degradation is graceful and silent" framing must be retired — E96 exists because taking the fallback under a host-prompt nudge must never pass silently',
  );
});

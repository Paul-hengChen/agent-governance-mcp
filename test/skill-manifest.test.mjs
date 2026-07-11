// Coded by @qa-engineer
// Tests for spec: specs/d6-host-capability-compose-axis.md + its architecture doc.
// T-D6-04 (a): host-state unit tests for prompts/skill-manifest.ts (composeSkill,
// hostCapabilitiesFor, includeSkillSegment) and the config `host` precedence /
// `.current/` whole-file-override / unsplit-passthrough contracts the three call
// sites (prompts/build.ts, tools/role.ts switchRole, bin/agent-governance-context.mjs)
// depend on.
//
// Spec-to-Test map:
//   AC1 (taskTool:true includes host fragments)         -> t-full-includes-host,
//                                                           t-golden-byte-identity
//   AC2 (taskTool:false excludes host fragments)         -> t-lean-excludes-host,
//                                                           t-lean-exact-core-concat
//   AC3 (absent/unknown signal defaults SAFE/lean)       -> t-hostcaps-default-lean,
//                                                           t-buildPromptForRole-default-lean
//   AC4 (ConstitutionSegment/includeSegment shape reuse) -> t-includeSkillSegment-pure,
//                                                           implicit in composeSkill shape below
//   AC5 (golden byte-identity, full composition)         -> t-golden-byte-identity
//   AC7 (both host states covered; suite stays green)    -> whole file
//
// Precedence-order coverage (architecture Interface Contracts, composeSkill):
//   (1) whole-file `.current/` override, bypassing host filtering entirely
//       -> t-override-bypass-lean, t-override-bypass-full
//   (2) registry fragments filtered by predicate                 -> the AC1/AC2 tests
//   (3) unsplit skill -> whole-file passthrough, host-independent -> t-unsplit-passthrough,
//       t-switchRole-unsplit-host-independent
// Config `host` field precedence (explicit config wins over the in-server lean
// default; the hook's structural CC default is a caller-side ternary, not this
// module's concern) -> t-config-host-precedence-full-path,
//                       t-config-host-precedence-lean-default

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const CONTENT_DIR = path.join(ROOT, "content");
const GOLDEN = path.join(ROOT, "test", "fixtures", "compose-golden", "skill-coordinator-monolith.txt");

const {
  composeSkill,
  hostCapabilitiesFor,
  includeSkillSegment,
  SKILL_SEGMENTS,
} = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { switchRole } = await import(path.join(ROOT, "dist", "tools", "role.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

function readContent(f) {
  return fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
}

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twd6-skillmanifest-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// ---------------------------------------------------------------------------
// hostCapabilitiesFor — pure capability map (architecture Interface Contracts)
// ---------------------------------------------------------------------------

test("hostCapabilitiesFor: \"claude-code\" is the only host string that yields taskTool:true", () => {
  assert.deepEqual(hostCapabilitiesFor("claude-code"), { taskTool: true });
});

test("t-hostcaps-default-lean — AC3 safe default: absent/unknown/empty host all yield taskTool:false", () => {
  for (const host of [undefined, "", "cursor", "continue", "anti-gravity", "Claude-Code", "claude_code"]) {
    assert.deepEqual(
      hostCapabilitiesFor(host),
      { taskTool: false },
      `hostCapabilitiesFor(${JSON.stringify(host)}) must default lean (case/spelling variants are NOT the canonical "claude-code" string)`,
    );
  }
});

// ---------------------------------------------------------------------------
// includeSkillSegment — pure predicate (mirrors constitution-manifest's includeSegment)
// ---------------------------------------------------------------------------

test("t-includeSkillSegment-pure: \"core\" always includes; \"host:claude-code\" gates strictly on caps.taskTool", () => {
  assert.equal(includeSkillSegment("core", { taskTool: true }), true);
  assert.equal(includeSkillSegment("core", { taskTool: false }), true);
  assert.equal(includeSkillSegment("host:claude-code", { taskTool: true }), true);
  assert.equal(includeSkillSegment("host:claude-code", { taskTool: false }), false);
});

// ---------------------------------------------------------------------------
// AC5 — golden byte-identity: composeSkill under the full-capability profile
// reproduces the retired monolith byte-for-byte. Compared against the FROZEN
// fixture (test/fixtures/compose-golden/skill-coordinator-monolith.txt), never
// the live content/skill-coordinator.md, which T-D6-04 retires in this same PR.
// ---------------------------------------------------------------------------

test("t-golden-byte-identity (AC1/AC5): composeSkill(\"skill-coordinator.md\", {taskTool:true}) === frozen golden monolith, byte-for-byte", () => {
  const golden = fs.readFileSync(GOLDEN, "utf-8");
  const composed = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent);
  assert.equal(composed, golden, "full-capability composition must reproduce the golden monolith exactly (Option R invariant)");
  assert.equal(composed.length, golden.length, "byte length must also match exactly (defends against any invisible whitespace drift)");
});

test("t-full-includes-host (AC1): full composition contains every host-tagged fragment's unique content", () => {
  const full = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent);
  assert.match(full, /\*\*Subagent Dispatch \(Claude Code\)\*\*/, "must include coord-02 dispatch prose");
  assert.match(full, /## Subagent Reply Watermark Validation/, "must include coord-04 watermark prose");
  assert.match(full, /## Subagent Token Observability/, "must include coord-06 token-observability prose");
  assert.match(full, /Token Budget Brake/, "must include coord-06 token-budget-brake prose");
});

// ---------------------------------------------------------------------------
// AC2 — lean composition excludes every host-tagged fragment, keeps every core
// fragment. Verified two ways: (a) negative/positive content assertions on the
// unique per-fragment markers above, AND (b) exact string equality against an
// INDEPENDENTLY concatenated core-only reconstruction (hardcoded fragment list,
// not derived from SKILL_SEGMENTS — so a registry bug can't hide from this test).
// ---------------------------------------------------------------------------

test("t-lean-excludes-host (AC2): lean composition (taskTool:false) drops every host-tagged fragment's unique content", () => {
  const lean = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), readContent);
  assert.doesNotMatch(lean, /\*\*Subagent Dispatch \(Claude Code\)\*\*/, "lean must NOT include coord-02 dispatch prose");
  assert.doesNotMatch(lean, /## Subagent Reply Watermark Validation/, "lean must NOT include coord-04 watermark prose");
  assert.doesNotMatch(lean, /## Subagent Token Observability/, "lean must NOT include coord-06 token-observability prose");
  assert.doesNotMatch(lean, /Dispatch Brief Template/, "lean must NOT include the coord-02 dispatch brief template");
});

test("t-lean-keeps-core (AC2/AC3): lean composition still carries the tw_switch_role fallback and the SOP (non-CC hosts must not lose shared rules)", () => {
  const lean = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), readContent);
  assert.match(lean, /Fallback \(`tw_switch_role`\)/, "lean must retain the core fallback instruction (non-CC host's own routing rule)");
  assert.match(lean, /## SOP/, "lean must retain the core SOP section");
  assert.match(lean, /## Visual Verdict Boundary/, "lean must retain the core Visual Verdict Boundary section");
  assert.match(lean, /recommended_model: sonnet/, "lean must retain the frontmatter (lives in the first CORE fragment, coord-01)");
});

test("t-lean-exact-core-concat (AC2): lean composition equals the exact concatenation of ONLY the core-tagged fragments, in document order", () => {
  // Independent oracle: hardcoded fragment list (not read from SKILL_SEGMENTS)
  // so this test would catch a registry mis-tag, not just re-confirm it.
  const expectedLean = [
    "coord-01-core-head.md",
    "coord-03-core-fallback.md",
    "coord-05-core-visual-drift.md",
    "coord-07-core-sop.md",
  ].map(readContent).join("");
  const lean = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), readContent);
  assert.equal(lean, expectedLean, "lean composition must equal the exact core-fragment concatenation — no more, no less");
});

test("SKILL_SEGMENTS registry: skill-coordinator.md's 7 fragments carry exactly 4 core + 3 host:claude-code tags, in document order", () => {
  const segs = SKILL_SEGMENTS["skill-coordinator.md"];
  assert.ok(Array.isArray(segs) && segs.length === 7, "registry must list exactly 7 ordered fragments");
  const tags = segs.map((s) => s.tag);
  assert.deepEqual(tags, ["core", "host:claude-code", "core", "host:claude-code", "core", "host:claude-code", "core"]);
});

// ---------------------------------------------------------------------------
// Unsplit-skill passthrough (precedence 3): a skill filename absent from
// SKILL_SEGMENTS composes as the whole file, identically regardless of caps.
// ---------------------------------------------------------------------------

test("t-unsplit-passthrough: composeSkill on an unsplit skill (skill-pm.md) is whole-file passthrough, host-independent", () => {
  const whole = readContent("skill-pm.md");
  const full = composeSkill("skill-pm.md", hostCapabilitiesFor("claude-code"), readContent);
  const lean = composeSkill("skill-pm.md", hostCapabilitiesFor(undefined), readContent);
  assert.equal(full, whole, "unsplit skill under taskTool:true must equal the raw file verbatim");
  assert.equal(lean, whole, "unsplit skill under taskTool:false must ALSO equal the raw file verbatim (AC6(b): unsplit skills are byte-identical on every path)");
  assert.equal(full, lean, "unsplit skill composition must be host-independent");
});

// ---------------------------------------------------------------------------
// Whole-file `.current/` override bypass (precedence 1): an explicit workspace
// override wins over BOTH fragment composition and host filtering — even when
// caps would otherwise select the lean or the full profile.
// ---------------------------------------------------------------------------

test("t-override-bypass-lean: a whole-file .current/ override returns verbatim under taskTool:false, bypassing fragment filtering", () => {
  const overrideText = "# OVERRIDDEN SKILL TEXT — workspace-local, no fragments\n";
  const hasOverride = (f) => f === "skill-coordinator.md";
  const load = (f) => (f === "skill-coordinator.md" ? overrideText : readContent(f));
  const out = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), load, hasOverride);
  assert.equal(out, overrideText, "override must be returned verbatim, not fragment-filtered");
});

test("t-override-bypass-full: a whole-file .current/ override returns verbatim under taskTool:true too (override wins regardless of caps)", () => {
  const overrideText = "# OVERRIDDEN SKILL TEXT — workspace-local, no fragments\n";
  const hasOverride = (f) => f === "skill-coordinator.md";
  const load = (f) => (f === "skill-coordinator.md" ? overrideText : readContent(f));
  const out = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), load, hasOverride);
  assert.equal(out, overrideText, "override must win even when caps.taskTool is true (precedence 1 beats precedence 2 unconditionally)");
});

test("composeSkill: no hasOverride callback provided (optional param) falls through to fragment composition, not a crash", () => {
  const out = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), readContent);
  assert.match(out, /Fallback \(`tw_switch_role`\)/, "with no hasOverride arg, composition proceeds via the fragment registry");
});

// ---------------------------------------------------------------------------
// Config `host` field precedence — end-to-end through the real call site
// (prompts/build.ts buildPromptForRole), which is what actually derives
// hostCaps from loadConfig(workspacePath).host. composeSkill itself is
// caps-source-agnostic; this is the integration proof the wiring works.
// ---------------------------------------------------------------------------

test("t-config-host-precedence-lean-default (AC3): buildPromptForRole with NO .current/.config.json composes skill-coordinator.md LEAN (in-server GetPrompt default)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const text = buildPromptForRole("skill-coordinator.md", "teamwork", ws, false, "workspace_path arg", true).messages[0].content.text;
  assert.doesNotMatch(text, /\*\*Subagent Dispatch \(Claude Code\)\*\*/, "no config host -> lean: no Task-dispatch prose in the composed prompt");
  assert.match(text, /Fallback \(`tw_switch_role`\)/, "no config host -> lean still retains the core fallback instruction");
  fs.rmSync(ws, { recursive: true, force: true });
});

test("t-config-host-precedence-full-path (explicit config wins): .current/.config.json {\"host\":\"claude-code\"} composes skill-coordinator.md FULL via buildPromptForRole", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify({ host: "claude-code" }));
  const text = buildPromptForRole("skill-coordinator.md", "teamwork", ws, false, "workspace_path arg", true).messages[0].content.text;
  assert.match(text, /\*\*Subagent Dispatch \(Claude Code\)\*\*/, "explicit host:\"claude-code\" config must restore Task-dispatch prose on the in-server path");
  assert.match(text, /## Subagent Reply Watermark Validation/, "explicit host config must restore watermark-validation prose");
  fs.rmSync(ws, { recursive: true, force: true });
});

test("t-config-host-precedence: an unrecognized host string (e.g. \"cursor\") still composes LEAN, same as absent", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify({ host: "cursor" }));
  const text = buildPromptForRole("skill-coordinator.md", "teamwork", ws, false, "workspace_path arg", true).messages[0].content.text;
  assert.doesNotMatch(text, /\*\*Subagent Dispatch \(Claude Code\)\*\*/, "unrecognized host must NOT be treated as claude-code");
  fs.rmSync(ws, { recursive: true, force: true });
});

test("t-config-host-precedence: a workspace-local whole-file .current/skill-coordinator.md override wins even with host:\"claude-code\" configured", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify({ host: "claude-code" }));
  const overrideText = "---\nrecommended_model: sonnet\n---\n# Workspace override skill text\n";
  fs.writeFileSync(path.join(ws, ".current", "skill-coordinator.md"), overrideText);
  const text = buildPromptForRole("skill-coordinator.md", "teamwork", ws, false, "workspace_path arg", true).messages[0].content.text;
  assert.match(text, /Workspace override skill text/, "whole-file override must win over fragment composition even when host caps would otherwise be full");
  assert.doesNotMatch(text, /\*\*Subagent Dispatch \(Claude Code\)\*\*/, "override text must be used verbatim — no fragment content should leak in");
  fs.rmSync(ws, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// switchRole (tools/role.ts) — the second render path. No role in
// ROLE_SKILL_MAP maps to a split skill today (only skill-coordinator.md is
// split, and it is not switchRole-reachable — code-reviewer's dormant-path
// note), so host filtering has no OBSERVABLE effect via switchRole yet. This
// pins the invariant that DOES hold today: an unsplit skill's switchRole
// output is host-independent, regardless of the workspace's declared host.
// ---------------------------------------------------------------------------

test("t-switchRole-unsplit-host-independent: switchRole(\"sr-engineer\", ws) returns identical sop text with and without host:\"claude-code\" configured", () => {
  const wsLean = mkWorkspace();
  const wsFull = mkWorkspace();
  fs.writeFileSync(path.join(wsFull, ".current", ".config.json"), JSON.stringify({ host: "claude-code" }));
  const leanResp = JSON.parse(switchRole("sr-engineer", wsLean));
  const fullResp = JSON.parse(switchRole("sr-engineer", wsFull));
  assert.equal(leanResp.sop, fullResp.sop, "unsplit skill-sr-engineer.md must be identical via switchRole regardless of host config");
  fs.rmSync(wsLean, { recursive: true, force: true });
  fs.rmSync(wsFull, { recursive: true, force: true });
});

test("t-switchRole-does-not-throw: switchRole succeeds for every ROLE_SKILL_MAP role on a workspace with no config at all (AC3 default path, no crash)", () => {
  const ws = mkWorkspace();
  for (const role of ["pm", "researcher", "design-auditor", "sr-engineer", "code-reviewer", "qa-engineer", "architect", "doc-writer", "release-engineer"]) {
    const resp = JSON.parse(switchRole(role, ws));
    assert.ok(!resp.error, `switchRole("${role}") must not error on a config-less workspace: ${resp.error}`);
    assert.ok(resp.sop && resp.sop.length > 0, `switchRole("${role}") must return non-empty sop text`);
  }
  fs.rmSync(ws, { recursive: true, force: true });
});

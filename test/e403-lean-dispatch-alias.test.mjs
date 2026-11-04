// Coded by @qa-engineer
// E403: the coord-03 Fallback sentence is composed on every host, so on a host without Claude Code's
// subagent tool it must not name a `Task` tool that nothing defines. The alias lives only in
// coord-02 (host:claude-code), so the claude-code reading must stay unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const load = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8");

const FALLBACK_HEAD = "**Fallback (`tw_switch_role`)**";
const DISJUNCTS = "the host advertises no subagent-dispatch tool, or the dispatch call returns a tool-error / unknown-subagent-type";
const ALIAS = "`Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`";

const fallbackParagraph = (text) => {
  const start = text.indexOf(FALLBACK_HEAD);
  assert.notEqual(start, -1, "composition carries the Fallback paragraph");
  const end = text.indexOf("\n\n", start);
  return text.slice(start, end === -1 ? undefined : end);
};

test("AC1: lean (no-host) composition's Fallback paragraph is host-neutral", () => {
  const p = fallbackParagraph(composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), load));
  assert.ok(p.includes(DISJUNCTS), "carries the host-neutral disjuncts verbatim");
  assert.ok(!p.includes("`Task`"), "no undefined `Task` tool noun on a host without the alias");
  assert.ok(!p.includes("Task("), "no Task( call form either");
});

test("AC1: a non-Claude-Code host string composes the same host-neutral paragraph", () => {
  const p = fallbackParagraph(composeSkill("skill-coordinator.md", hostCapabilitiesFor("cursor"), load));
  assert.ok(p.includes(DISJUNCTS));
  assert.ok(!p.includes("`Task`") && !p.includes("Task("));
});

test("AC2: claude-code composition defines the alias before the Fallback paragraph, with the same noun", () => {
  const full = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), load);
  const aliasAt = full.indexOf(ALIAS);
  const fbAt = full.indexOf(FALLBACK_HEAD);
  assert.notEqual(aliasAt, -1, "coord-02 alias sentence present");
  assert.ok(aliasAt < fbAt, "alias precedes the Fallback paragraph");
  assert.ok(fallbackParagraph(full).includes("subagent-dispatch tool"), "Fallback uses the alias's noun");
});

test("AC2: coord-02 is the only place the alias is defined (lean composition lacks it)", () => {
  const lean = composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), load);
  assert.ok(!lean.includes(ALIAS), "lean composition must not carry the host:claude-code alias");
  assert.ok(load("coord-02-host-dispatch.md").includes(ALIAS), "coord-02 still defines it");
});

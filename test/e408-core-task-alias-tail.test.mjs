// Coded by @qa-engineer
// E408: coord-02 (host:claude-code) is the only place `Task(...)` is defined, but six sentences in
// the core fragments (coord-03/05/07) load on every host. On a host without that alias they must not
// name an undefined `Task` tool; the claude-code reading must stay unchanged. Also pins the lite
// template tail (G2-19) and the role.ts comment (G2-23). Resident-hygiene: per-site checks locate a
// line by its unique replacement text, never by line number or a fixed base sha.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const load = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");

const CORE = [
  "coord-01-core-head.md",
  "coord-03-core-fallback.md",
  "coord-05-core-visual-drift.md",
  "coord-07-core-sop.md",
];
const ALIAS = "`Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`";

// "Task-free": drop tasks.md / _task / completed_tasks substrings, then no `Task` remains.
const taskLines = (text) =>
  text.split("\n").filter((l) => l.replace(/tasks\.md|_task|completed_tasks/g, "").includes("Task"));

const SITES = [
  ["coord-03-core-fallback.md", "a dispatched subagent call returns", ["`Task(subagent_type=<role>, …)` call returns"]],
  ["coord-03-core-fallback.md", "the dispatched subagent call fail this session", ["the `Task(...)` fail this session"]],
  ["coord-03-core-fallback.md", "the subagent-dispatch tool or the `tw_switch_role` fallback)", ["`Task(subagent_type=<role>, …)` or the `tw_switch_role` fallback)"]],
  ["coord-03-core-fallback.md", "on the resume call to the subagent-dispatch tool —", ["on the resume `Task(...)` call —"]],
  ["coord-05-core-visual-drift.md", "(subagent-dispatch tool or `tw_switch_role`)", ["(Task or `tw_switch_role`)"]],
  ["coord-07-core-sop.md", "(subagent-dispatch tool if available,", ["(Task-tool subagent if available,"]],
];

test("AC1: no-host and non-claude-code composition is Task-free line by line", () => {
  for (const host of [undefined, "cursor"]) {
    const text = composeSkill("skill-coordinator.md", hostCapabilitiesFor(host), load);
    assert.deepEqual(taskLines(text), [], `host ${host}: composition has no Task line`);
  }
});

test("AC1: each core fragment read on its own is Task-free", () => {
  for (const f of CORE) assert.deepEqual(taskLines(load(f)), [], `${f} is Task-free`);
});

test("AC2: each of the six sites carries its replacement once, on one line, and the old span is gone", () => {
  for (const [file, repl, olds] of SITES) {
    const text = load(file);
    const hits = text.split("\n").filter((l) => l.includes(repl));
    assert.equal(hits.length, 1, `${file}: replacement occurs on exactly one line: ${repl}`);
    for (const old of olds) assert.ok(!text.includes(old), `${file}: old span removed: ${old}`);
  }
});

test("AC3: claude-code composition defines the alias once, before every E408 site", () => {
  const full = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), load);
  assert.equal(full.split(ALIAS).length - 1, 1, "alias sentence occurs exactly once");
  const aliasAt = full.indexOf(ALIAS);
  for (const [, repl] of SITES) {
    const at = full.indexOf(repl);
    assert.ok(at > aliasAt, `site follows the alias definition: ${repl}`);
  }
});

test("AC3: the only Task-bearing coordinator fragments are the claude-code-tagged ones", () => {
  const frags = fs.readdirSync(path.join(ROOT, "content")).filter((f) => /^coord-0\d-.*\.md$/.test(f));
  const bearing = frags.filter((f) => taskLines(load(f)).length > 0).sort();
  assert.deepEqual(bearing, ["coord-02-host-dispatch.md", "coord-04-host-watermark.md", "coord-06-host-token.md"]);
});

test("AC5: lite template line 9 ends with the forbid + tier sentences; no server claim, no Task", () => {
  const raw = read("templates", "claude-code-agents", "lite.md");
  const lines = raw.replace(/\n$/, "").split("\n");
  const l9 = lines[8];
  assert.ok(l9.includes("`content/skill-coordinator-lite.md`"), "line 9 still points at the lite SOP");
  const forbid = "(that SOP's Hard rules forbid them).";
  const tier =
    "The `model: haiku` pin deliberately differs from the skill's `recommended_model: sonnet`: when a coordinator dispatches this subagent it validates the reply watermark, while a direct session has no such check (`specs/d8-lite-recommended-model.md` Amendment, AC8).";
  assert.ok(l9.endsWith(`Do NOT call any tw_* write tools ${forbid} ${tier}`), "forbid then tier, one space");
  assert.ok(!raw.includes("server rejects"), "no overstated server claim");
  assert.deepEqual(taskLines(raw), [], "template is Task-free");
  assert.match(raw, /^model: haiku$/m, "haiku pin untouched");
  assert.equal(lines.length, 11, "11 lines");
  assert.match(lines.at(-1), /— @lite \(haiku\)/, "haiku example suffix stays last");
});

test("AC6: role.ts comment reflects transitions.ts; map still carries doc-writer and release-engineer", () => {
  const src = read("tools", "role.ts");
  const want = [
    "  // Post-chain roles. doc-writer is intentionally absent from tools/transitions.ts",
    "  // AgentName + ALLOWED_TRANSITIONS: callers set agent_id to the upstream chain role",
    '  // when invoking tw_update_state on its behalf (skill-doc-writer.md "Side-channel',
    '  // constraint" clause). release-engineer is in AgentName and opens on the',
    "  // qa-engineer:PASS -> release-engineer:In_Progress edge there (v3.49.0, C13).",
  ];
  assert.ok(src.includes(want.join("\n")), "five comment lines present contiguously");
  assert.ok(!src.includes('skill-release-engineer.md "Side-channel'), "stale release-engineer pointer gone");
  assert.ok(!src.includes("integrator"), "e178a AC4: no integrator in role.ts");
  assert.match(src, /"doc-writer"/);
  assert.match(src, /"release-engineer"/);
  assert.match(read("tools", "transitions.ts"), /"release-engineer"/, "release-engineer is in transitions.ts");
});

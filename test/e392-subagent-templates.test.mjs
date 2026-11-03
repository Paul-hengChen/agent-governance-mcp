// Coded by @qa-engineer
// Acceptance tests for specs/e392-subagent-templates.md (AC1-AC5, AC7-AC9, AC12).
// WHY these exist: three Claude Code subagent-facing texts contradicted the code
// (a Task-dispatched @teamwork could not load its SOP; release-engineer was
// labelled haiku although pinned opus; `Task(...)` was never defined). The tests
// pin the contract the fix establishes: `coordinator` is a context-loading
// switchRole destination ONLY (never a chain role), and the three texts agree
// with the code. They assert stable structure of real files and never diff
// against a fixed base sha (resident-test hygiene).
// Requires a built tree (`npm run build`).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const CONTENT_DIR = path.join(ROOT, "content");

const { switchRole } = await import(path.join(ROOT, "dist", "tools", "role.js"));
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const { applyTextTransforms } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));
const { parseSkillFile } = await import(path.join(ROOT, "dist", "tools", "skill-frontmatter.js"));
const { expandPartials } = await import(path.join(ROOT, "dist", "prompts", "partials-manifest.js"));
const { TOOL_REGISTRY } = await import(path.join(ROOT, "dist", "tools", "registry.js"));
const { ALLOWED_TRANSITIONS } = await import(path.join(ROOT, "dist", "tools", "transitions.js"));

const DISPATCH_HEADING = "**Subagent Dispatch (Claude Code)**";
const WATERMARK_HEADING = "## Subagent Reply Watermark Validation";
const ALIAS =
  "`Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`; Task-dispatched and Task-spawned mean dispatched through it.";

function readContent(f) {
  return fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
}
function readRepo(...p) {
  return fs.readFileSync(path.join(ROOT, ...p), "utf-8");
}
function mkWorkspace(config) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e392-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  if (config) fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify(config));
  return ws;
}
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
function expectedSop(host) {
  const load = (f) => readContent(f);
  const raw = composeSkill("skill-coordinator.md", hostCapabilitiesFor(host), load);
  return applyTextTransforms(parseSkillFile(expandPartials(raw, load)).body, { fullDetail: false });
}

const coord01Model = parseSkillFile(readContent("coord-01-core-head.md")).frontmatter.recommended_model;

// ---------------------------------------------------------------------------
// AC1 / AC2 / AC3 — switchRole("coordinator") renders the host-filtered SOP
// ---------------------------------------------------------------------------

test("AC1: switchRole(\"coordinator\") on a claude-code workspace returns the full coordinator SOP with host:claude-code fragments", () => {
  const ws = mkWorkspace({ host: "claude-code" });
  try {
    const resp = JSON.parse(switchRole("coordinator", ws));
    assert.ok(!resp.error, `unexpected error: ${resp.error}`);
    assert.equal(resp.role, "coordinator");
    assert.ok(resp.sop && resp.sop.length > 0, "sop must be non-empty");
    assert.ok(resp.sop.startsWith("# Skill: coordinator"), "sop must start with the coordinator heading");
    assert.ok(resp.sop.includes(DISPATCH_HEADING), "claude-code profile must carry coord-02 dispatch section");
    assert.ok(resp.sop.includes(WATERMARK_HEADING), "claude-code profile must carry coord-04 watermark validation");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("AC2: switchRole(\"coordinator\") on a no-config workspace returns the lean SOP without host:claude-code fragments", () => {
  const ws = mkWorkspace();
  try {
    const resp = JSON.parse(switchRole("coordinator", ws));
    assert.ok(!resp.error, `unexpected error: ${resp.error}`);
    assert.ok(resp.sop && resp.sop.length > 0, "sop must be non-empty");
    assert.ok(resp.sop.startsWith("# Skill: coordinator"));
    assert.ok(!resp.sop.includes(DISPATCH_HEADING), "lean profile drops coord-02");
    assert.ok(!resp.sop.includes(WATERMARK_HEADING), "lean profile drops coord-04");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

for (const [label, config, host] of [
  ["claude-code", { host: "claude-code" }, "claude-code"],
  ["no-config", null, undefined],
]) {
  test(`AC3: switchRole("coordinator") parity — ${label}: frontmatter model, no markers, byte-identical to the shared compose pipeline`, () => {
    const ws = mkWorkspace(config);
    try {
      const resp = JSON.parse(switchRole("coordinator", ws));
      assert.ok(coord01Model, "coord-01 frontmatter must declare recommended_model");
      assert.equal(resp.recommended_model, coord01Model, "recommended_model must come from coord-01 frontmatter");
      assert.ok(resp.instruction.includes(coord01Model), "instruction must name the model tier");
      assert.ok(!resp.sop.includes("<!-- origin:"), "origin markers must be stripped");
      assert.ok(!resp.sop.includes("<!-- rationale:"), "rationale markers must be stripped");
      assert.equal(resp.sop, expectedSop(host), "sop must be byte-identical to the shared composition pipeline output");
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  });
}

// ---------------------------------------------------------------------------
// AC4 — both enums accept `coordinator`
// ---------------------------------------------------------------------------

test("AC4: tw_switch_role inputSchema enum and zod enum both accept coordinator and are the same 10-value set", async () => {
  const entry = TOOL_REGISTRY.find((e) => e.name === "tw_switch_role");
  assert.ok(entry, "tw_switch_role must be registered");
  const enumVals = entry.inputSchema.properties.role.enum;
  assert.ok(enumVals.includes("coordinator"), "inputSchema enum must contain coordinator");
  assert.equal(enumVals.length, 10, "9 existing roles + coordinator");
  assert.equal(new Set(enumVals).size, 10, "no duplicates");

  // Registry entries expose inputSchema + run (not zodSchema): zod acceptance is
  // observed through run(). Every inputSchema value must pass zod; an outsider must not.
  const ws = mkWorkspace();
  try {
    for (const role of enumVals) {
      const result = await entry.run({ workspace_path: ws, role });
      const body = JSON.parse(result.content[0].text);
      assert.ok(!body.error, `zod/handler must accept role "${role}": ${body.error}`);
    }
    await assert.rejects(
      () => Promise.resolve().then(() => entry.run({ workspace_path: ws, role: "not-a-role" })),
      "zod enum must still reject unknown roles (enum sets equal, not widened to string)",
    );
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC5 — coordinator is NOT a chain role
// ---------------------------------------------------------------------------

test("AC5: coordinator is not a chain role (ALLOWED_TRANSITIONS keys, next_role enum, dispatch_pins properties)", () => {
  for (const key of ALLOWED_TRANSITIONS.keys()) {
    assert.ok(!key.startsWith("coordinator:"), `ALLOWED_TRANSITIONS must not key on coordinator (got ${key})`);
  }
  for (const targets of ALLOWED_TRANSITIONS.values()) {
    for (const t of targets) assert.notEqual(t.agent, "coordinator", "coordinator must not be a transition target");
  }
  const update = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
  const props = update.inputSchema.properties;
  assert.ok(!props.next_role.enum.includes("coordinator"), "next_role enum must not include coordinator");
  assert.ok(!Object.keys(props.dispatch_pins.properties).includes("coordinator"), "dispatch_pins must not include coordinator");
  assert.equal(Object.keys(props.dispatch_pins.properties).length, 8, "dispatch_pins keeps its 8 role names");
});

// ---------------------------------------------------------------------------
// AC7 — teamwork template line 9 (+ E280 tightened regex)
// ---------------------------------------------------------------------------

const TEAMWORK_LOAD =
  "This subagent runs the agc coordinator (full) SOP under a pinned Sonnet tier. On invocation, call `tw_get_state` then `tw_detect_drift`, then load the SOP via `tw_switch_role(\"coordinator\")` and follow it exclusively. `content/skill-coordinator.md` is only the SOP's logical name — no such file exists on disk; the server composes the SOP from the ordered `content/coord-01..07-*.md` fragments per `prompts/skill-manifest.ts`, filtered by the workspace's `.current/.config.json` `host`.";

// The pre-E392 line 9, quoted as a fixture: the tightened regex must reject it.
const PRE_E392_LINE9 =
  "This subagent runs the agc coordinator (full) SOP from `content/skill-coordinator.md` under a pinned Sonnet tier. On invocation, call `tw_get_state` then `tw_detect_drift`, then follow the coordinator SOP exclusively (load it via the Read tool, NOT via tw_switch_role — coordinator is not in the RoleName enum).";

test("AC7: teamwork template line 9 is the tw_switch_role(\"coordinator\") sentence, byte-for-byte", () => {
  const lines = readRepo("templates", "claude-code-agents", "teamwork.md").split("\n");
  assert.equal(lines[8], TEAMWORK_LOAD);
  assert.ok(!lines[8].includes("via the Read tool"));
  assert.ok(!lines[8].includes("not in the RoleName enum"));
  assert.ok(lines[8].includes("`content/skill-coordinator.md`"), "logical name string kept");
});

test("AC7: FILE_PATH_DELEGATES.teamwork regex matches the new line 9 and rejects the pre-E392 text", () => {
  const src = readRepo("test", "subagent-templates.test.mjs");
  const m = src.match(/"teamwork":\s*(\/.+\/),\n/);
  assert.ok(m, "FILE_PATH_DELEGATES.teamwork regex literal not found");
  const re = new RegExp(m[1].slice(1, -1));
  assert.ok(re.test(TEAMWORK_LOAD), "tightened regex must match the new sentence");
  assert.ok(!re.test(PRE_E392_LINE9), "tightened regex must NOT match the pre-E392 line 9");
});

// ---------------------------------------------------------------------------
// AC8 / AC9 — release-engineer leaves the haiku tier
// ---------------------------------------------------------------------------

test("AC8: release-engineer template has no example reply suffix and no (haiku) text; ends with the driftBaselineIds paragraph", () => {
  const raw = readRepo("templates", "claude-code-agents", "release-engineer.md");
  assert.ok(!raw.includes("Example reply suffix:"));
  assert.ok(!raw.includes("(haiku)"));
  assert.ok(raw.endsWith("\n"), "file ends with a newline");
  const lines = raw.replace(/\n$/, "").split("\n");
  assert.equal(lines.length, 23, "file ends at line 23");
  assert.ok(lines[22].includes("driftBaselineIds"), "last line is the driftBaselineIds paragraph");
  assert.ok(lines[22].trim() !== "", "no trailing blank line");
});

test("AC9: @release-engineer is absent from the coord-04 haiku list and from the claude-code composition", () => {
  const line5 = readContent("coord-04-host-watermark.md").split("\n")[4];
  assert.ok(line5.includes("Haiku-tier subagents (`@lite`, `@doc-writer`)"), "line 5 carries the two-role haiku list");
  assert.ok(!/Haiku-tier subagents \([^)]*@release-engineer/.test(line5), "release-engineer must not be in the haiku list");
  const composed = expectedSop("claude-code");
  assert.ok(composed.includes("Haiku-tier subagents (`@lite`, `@doc-writer`)"));
  assert.ok(!/Haiku-tier subagents \([^)]*@release-engineer/.test(composed));
});

// ---------------------------------------------------------------------------
// AC12 — Task(...) alias defined once
// ---------------------------------------------------------------------------

test("AC12: coord-02 defines the Task(...) alias exactly once, directly after the dispatch heading on line 1", () => {
  const raw = readContent("coord-02-host-dispatch.md");
  assert.equal(count(raw, ALIAS), 1, "alias sentence appears exactly once in coord-02");
  const line1 = raw.split("\n")[0];
  assert.ok(
    line1.startsWith(`${DISPATCH_HEADING} — preferred when available. ${ALIAS} A host system prompt nudging`),
    "alias sits between 'preferred when available. ' and 'A host system prompt nudging'",
  );
});

test("AC12: the claude-code composition carries the alias once; the lean composition carries it zero times", () => {
  assert.equal(count(expectedSop("claude-code"), ALIAS), 1);
  assert.equal(count(expectedSop(undefined), ALIAS), 0);
});

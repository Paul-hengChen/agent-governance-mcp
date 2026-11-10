// Coded by @qa-engineer
// E376 (lane e359, specs/e359-server-core-fixes.md AC-E376-1, 2, 4). Invariant: the state block injected into
// every role prompt and the SessionStart hook omits the previous hop's dispatch_mechanism_tier, like
// tw_get_state does since E184, so the next writer self-reports instead of copying. The record on disk
// is untouched, and every other key (dispatch_mechanism included) renders as before, in the same order.
// AC-E376-3 and AC-E376-5 are proven by running the named unmodified suites and the golden capture.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { buildPromptForRole, renderHandoffStateBlock } from "../dist/prompts/build.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = path.join(ROOT, "bin", "agent-governance-context.mjs");

function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e376-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seed(ws, extra = {}) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e376-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: "sr-engineer",
    dispatchMechanism: "task",
    dispatchMechanismTier: "opus",
    ...extra,
  });
  resetSession(ws);
}

// First fenced ```json block after the state heading (the fence is >= 3 backticks).
function stateJson(text) {
  const start = text.indexOf("## 📍 Current Project State");
  assert.ok(start >= 0, "state heading present");
  const m = text.slice(start).match(/(`{3,})json\n([\s\S]*?)\n\1/);
  assert.ok(m, "fenced json state block present");
  return { raw: m[2], parsed: JSON.parse(m[2]), block: text.slice(start) };
}

function renderBuild(ws) {
  return buildPromptForRole("skill-qa-engineer.md", "e376", ws, false).messages[0].content.text;
}

function runHook(ws) {
  const out = execFileSync("node", [HOOK], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: ws },
    encoding: "utf-8",
  });
  return JSON.parse(out).hookSpecificOutput.additionalContext;
}

test("AC-E376-1: buildPromptForRole state block has no dispatch_mechanism_tier, keeps dispatch_mechanism, other keys and order intact", async () => {
  const ws = mkWs();
  await seed(ws);
  const state = parseHandoff(ws);
  assert.equal(state.dispatch_mechanism_tier, "opus", "precondition: the parsed record carries the tier");
  const { parsed } = stateJson(renderBuild(ws));
  assert.equal("dispatch_mechanism_tier" in parsed, false);
  assert.equal(parsed.dispatch_mechanism, "task");
  const expectedKeys = Object.keys(state).filter((k) => k !== "dispatch_mechanism_tier");
  assert.deepEqual(Object.keys(parsed), expectedKeys, "same keys in the same order, minus the one key");
  for (const k of expectedKeys) {
    if (k === "pending_notes") continue; // free text is sanitized (backticks added), covered by e137 round-trip
    assert.deepEqual(parsed[k], JSON.parse(JSON.stringify(state[k])), `key ${k} unchanged`);
  }
});

test("AC-E376-2: the SessionStart hook block also omits the tier and is byte-identical to the buildPromptForRole block", async () => {
  const ws = mkWs();
  await seed(ws);
  const fromBuild = stateJson(renderBuild(ws));
  const fromHook = stateJson(runHook(ws));
  assert.equal("dispatch_mechanism_tier" in fromHook.parsed, false);
  assert.equal(fromHook.parsed.dispatch_mechanism, "task");
  assert.equal(fromHook.raw, fromBuild.raw, "both sites render the same JSON bytes");
  assert.equal(fromHook.block.split("\n## ")[0].trimEnd(), fromBuild.block.split("\n## ")[0].trimEnd());
});

test("AC-E376-4: the record is untouched; handoff.md and parseHandoff still carry the tier after a render", async () => {
  const ws = mkWs();
  await seed(ws);
  renderBuild(ws);
  assert.match(
    fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8"),
    /^dispatch_mechanism_tier: "?opus"?$/m,
  );
  assert.equal(parseHandoff(ws).dispatch_mechanism_tier, "opus");
});

test("AC-E376 direct renderer: omits only the top-level key; a nested look-alike key and a note mentioning it survive", async () => {
  const ws = mkWs();
  await seed(ws, { pendingNotes: ["dispatch_mechanism_tier: opus mentioned in a note"] });
  const state = parseHandoff(ws);
  const block = renderHandoffStateBlock(state);
  const m = block.match(/(`{3,})json\n([\s\S]*?)\n\1/);
  assert.ok(m);
  const parsed = JSON.parse(m[2]);
  assert.equal("dispatch_mechanism_tier" in parsed, false);
  assert.match(JSON.stringify(parsed.pending_notes), /dispatch_mechanism_tier: opus mentioned/);

  const nested = { ...state, extra: { dispatch_mechanism_tier: "kept" } };
  const parsedNested = JSON.parse(renderHandoffStateBlock(nested).match(/(`{3,})json\n([\s\S]*?)\n\1/)[2]);
  assert.equal(parsedNested.extra.dispatch_mechanism_tier, "kept", "only the top-level key is dropped");
});

test("AC-E376-3 (direct): with no tier in the state the renderer output is unchanged (key order preserved, no tier key added)", async () => {
  const ws = mkWs();
  await seed(ws, { dispatchMechanism: undefined, dispatchMechanismTier: undefined });
  const state = parseHandoff(ws);
  assert.equal("dispatch_mechanism_tier" in state, false);
  const parsed = JSON.parse(renderHandoffStateBlock(state).match(/(`{3,})json\n([\s\S]*?)\n\1/)[2]);
  assert.deepEqual(Object.keys(parsed), Object.keys(state));
});

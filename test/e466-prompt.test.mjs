// Coded by @qa-engineer
// Tests (T-E466-01) for docs/tickets/E466.md S1, S2 and S7 (specs/e466-conductor.md, Build contract S1/S2/S7
// and Copy / Strings prompt.description, sop.conductor).
// WHY (S1): the conductor is a human-started, long-lived session; admitting it as a tw_switch_role / agent_id
// role would put a window-driving session inside the governed chain. It must be an appended (fourteenth)
// prompt — a reorder would change every adopter's prompt list — while the role enum stays as it is.
// WHY (S2): the conductor's whole value is its loop and its limits: the first integrator is opened from an
// approved discussion record, every later one with a take-over line naming the manifest and the wave, the run
// ends at the last wave with a notice to the human, and it never starts another manifest (a new manifest always
// needs the human). It writes no handoff state, so its SOP must not even name the state-writing tool.
// WHY (S7): all sessions share one account; one session (the conductor) must own every wake after a usage-limit
// reset, and a weekly-paused lane is woken only on the human's word.
// Served text is checked for adopter safety (no bare ticket id). Every title starts with its scenario id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const count = (hay, needle) => hay.split(needle).length - 1;
const BARE_TICKET_RE = /\bE\d{2,4}[a-z]?\b/;

// Copy / Strings prompt.description (verbatim).
const DESCRIPTION =
  "Conductor — open a fresh integrator session for each wave of an approved fan-out manifest, check its wave-done report, close it. Human-started; writes no handoff state.";
// Copy / Strings sop.conductor, frozen verbatim from the cut into a fixture.
const SOP_EXPECTED = read("test", "fixtures", "e466", "skill-conductor.expected.md");
const FIRST_12 = ["sr-engineer", "researcher", "pm", "qa-engineer", "teamwork", "teamwork-lite", "architect", "design-auditor", "code-reviewer", "doc-writer", "release-engineer", "integrator"];

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});
function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e466-prompt-"));
  made.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

/** The composed `conductor` prompt text as an MCP client receives it (constitution + SOP + state block). */
async function composedConductor() {
  const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
  const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
  setActiveStorage(new FileHandoffStorage());
  return buildPromptForRole("skill-conductor.md", DESCRIPTION, mkWs()).messages[0].content.text;
}

/** The SOP file, read only when it exists so a missing file fails with a clear message. */
function sopFile() {
  const p = path.join(ROOT, "content", "skill-conductor.md");
  assert.ok(fs.existsSync(p), "content/skill-conductor.md exists");
  return fs.readFileSync(p, "utf-8");
}

function spawnAndAwait(messages, targetId, waitMs = 30000) {
  return new Promise((resolve) => {
    const p = spawn("node", [path.join(ROOT, "dist", "index.js")], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let settled = false;
    const finish = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(ceiling);
      p.kill();
      resolve(msg ?? null);
    };
    p.stdout.on("data", (d) => {
      stdout += d.toString();
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg && msg.id === targetId) {
            finish(msg);
            return;
          }
        } catch {
          // partial line: reprocessed on the next data event
        }
      }
    });
    p.stderr.on("data", () => {});
    p.on("close", () => finish(null));
    for (const m of messages) p.stdin.write(JSON.stringify(m) + "\n");
    const ceiling = setTimeout(() => finish(null), waitMs);
  });
}
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "qa-test", version: "0" } } };

// ---------------------------------------------------------------------------------------------------------------
// S1 — the conductor is a registered prompt-only role
// ---------------------------------------------------------------------------------------------------------------

test("S1: the prompt list holds fourteen prompts with conductor appended last, and tw_switch_role rejects conductor as a role", async () => {
  const { PROMPT_REGISTRY, TOOL_REGISTRY } = await import(path.join(ROOT, "dist", "tools", "registry.js"));

  // Registry: an append, the first thirteen untouched in order.
  assert.equal(PROMPT_REGISTRY.length, 14, "fourteen prompts");
  assert.deepEqual(PROMPT_REGISTRY.slice(0, 13).map((e) => e.name), [...FIRST_12, "spec-workshop"], "the first thirteen untouched, in order");
  assert.deepEqual(PROMPT_REGISTRY[13], {
    name: "conductor",
    description: DESCRIPTION,
    skillFile: "skill-conductor.md",
    arguments: PROMPT_REGISTRY[0].arguments,
  });
  assert.deepEqual(PROMPT_REGISTRY[13].arguments.map((a) => a.name), ["workspace_path"]);

  // The prompt list a client requests over stdio.
  const list = await spawnAndAwait([INIT, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "prompts/list" }], 2);
  assert.ok(list && list.result, `received prompts/list response: ${JSON.stringify(list).slice(0, 200)}`);
  assert.equal(list.result.prompts.length, 14, "prompts/list returns fourteen prompts");
  const entry = list.result.prompts.find((x) => x.name === "conductor");
  assert.ok(entry, "conductor listed");
  assert.equal(entry.description, DESCRIPTION);

  // tw_switch_role: the role enum is unchanged, so conductor is rejected at the boundary.
  const sw = TOOL_REGISTRY.find((t) => t.name === "tw_switch_role");
  assert.ok(sw, "tw_switch_role registered");
  assert.ok(!sw.inputSchema.properties.role.enum.includes("conductor"), "advertised role enum excludes conductor");
  const rejects = async (role) => {
    try {
      const r = await sw.run({ workspace_path: mkWs(), role });
      return r.isError === true;
    } catch {
      return true;
    }
  };
  assert.equal(await rejects("conductor"), true, "tw_switch_role rejects role conductor");
  assert.equal(await rejects("pm"), false, "control: a real role is accepted");
  assert.ok(!/conductor/.test(read("tools", "role.ts")), "tools/role.ts does not mention conductor");
  assert.ok(!/conductor/.test(read("tools", "transitions.ts")), "tools/transitions.ts does not mention conductor");

  // The builder file the Build contract names, shaped like prompts/integrator.ts.
  const ts = read("prompts", "conductor.ts");
  assert.ok(ts.includes("// MCP Prompt: conductor role. Prompt only — not a tw_switch_role /\n// agent_id role."), "header comment");
  assert.match(ts, /buildPromptForRole\(\s*\n?\s*"skill-conductor\.md"/, "thin buildPromptForRole wrapper over skill-conductor.md");
});

// ---------------------------------------------------------------------------------------------------------------
// S2 — the conductor SOP states its loop and limits
// ---------------------------------------------------------------------------------------------------------------

test("S2: the composed conductor prompt states the loop (fan-out <record> first, 接手 <manifest> + wave later, notify and stop after the last wave, never another manifest) and the SOP has no tw_update_state", async () => {
  const sop = sopFile();
  assert.equal(sop, SOP_EXPECTED, "content/skill-conductor.md is sop.conductor verbatim");
  assert.match(sop, /^---\nrecommended_model: opus\n---\n/, "frontmatter recommended_model: opus");

  const text = await composedConductor();
  assert.ok(text.includes("# Skill: conductor"), "the composed prompt carries the SOP body");
  const body = sop.replace(/^---\n[\s\S]*?\n---\n/, "");
  for (const para of body.split("\n\n").map((p) => p.trim()).filter(Boolean)) {
    assert.ok(text.includes(para), `composed prompt carries the SOP paragraph: ${para.slice(0, 80)}`);
  }

  // Start from an approved discussion record; the first integrator gets `fan-out <record>`.
  assert.ok(text.includes("gives it the path of an approved discussion record"), "starts from an approved discussion record");
  assert.ok(text.includes("`conductor.mjs open --record <discussion record>`: it opens the first integrator window and sends the integrator prompt line followed by `fan-out <record>`"), "first integrator opened with fan-out <record>");
  // Every later integrator: `接手 <manifest>` and the wave number.
  assert.ok(text.includes("opens the next wave's integrator with the integrator prompt line followed by `接手 <manifest>，開始第 <n> 波次`"), "later integrators opened with 接手 <manifest> and the wave number");
  // After the last wave: notify the human and stop; never another manifest.
  assert.ok(text.includes("notify the human that every wave of the manifest is done, and stop"), "after the last wave: notify the human and stop");
  assert.ok(text.includes("Never start another manifest: a new manifest always needs the human."), "never starts another manifest");

  // No tw_update_state instruction anywhere in the SOP (the constitution in the bundle may name the tool; the
  // conductor's own text never does).
  assert.equal(count(sop, "tw_update_state"), 0, "the conductor SOP contains no tw_update_state string");
  assert.ok(sop.includes("It writes no handoff state"), "the SOP states it writes no handoff state");

  // Served text is adopter-safe.
  assert.ok(!BARE_TICKET_RE.test(sop), "no bare ticket id in the served SOP");
  assert.ok(!BARE_TICKET_RE.test(DESCRIPTION), "no bare ticket id in the prompt description");
});

// ---------------------------------------------------------------------------------------------------------------
// S7 — waking after usage limits
// ---------------------------------------------------------------------------------------------------------------

test("S7: the conductor SOP wakes the paused integrator and paused-stopped lanes after its own automatic continue, and paused-weekly lanes only after the human says the weekly limit reset", async () => {
  const sop = sopFile();
  const text = await composedConductor();
  const lines = sop.split("\n");
  const at = lines.indexOf("## Usage limits");
  assert.ok(at >= 0, "## Usage limits section present");
  const end = lines.findIndex((l, i) => i > at && l.startsWith("## "));
  const section = lines.slice(at, end < 0 ? lines.length : end).join("\n");

  // Session-limit reset: after the conductor's own automatic continue — wake the integrator, re-run the launcher.
  assert.ok(section.includes("After the conductor's own automatic continue following a session-limit reset"), "the trigger is the conductor's own automatic continue after a session-limit reset");
  assert.ok(section.includes("wake the paused integrator (`conductor.mjs wake`)"), "wakes the paused integrator");
  assert.ok(section.includes("re-run the launcher (`node <agc install>/scripts/lane-launch.mjs <manifest>`) to wake `paused-stopped` lanes"), "re-runs the launcher to wake paused-stopped lanes");
  // Weekly reset: only on the human's word, with the weekly-wake option.
  assert.ok(section.includes("After the human says the weekly limit has reset, also wake `paused-weekly` lanes with the launcher's weekly-wake option (`lane-launch.mjs <manifest> --wake-weekly`)"), "paused-weekly lanes woken with --wake-weekly after the human's word");
  // Order: the session-limit wake comes first, the weekly wake after it.
  assert.ok(section.indexOf("paused-stopped") < section.indexOf("paused-weekly"), "session-limit wake stated before the weekly wake");
  assert.ok(text.includes(section.split("\n").slice(2).join("\n").trim()), "the composed prompt serves the Usage limits text");
  assert.ok(!BARE_TICKET_RE.test(section), "no bare ticket id in the served section");
});

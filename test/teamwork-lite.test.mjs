// Coded by @qa-engineer
// Tests for /teamwork-lite prompt entry point (spec: lite-mode-coordinator).
// Spec-to-Test map: AC1→t1, AC2→t2, AC3→t3+t5, AC4→t4, AC5→entire suite (load/build).
// AC6 (README) is verified manually in T42, not here.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

test("AC1: content/skill-coordinator-lite.md exists with required sections + hard rules", () => {
  const skillPath = path.join(PROJECT_ROOT, "content", "skill-coordinator-lite.md");
  assert.ok(fs.existsSync(skillPath), "skill file must exist");
  const body = fs.readFileSync(skillPath, "utf-8");

  // Required sections per AC1
  assert.match(body, /^#\s+Skill:\s+coordinator-lite/m, "title section");
  assert.match(body, /##\s+Persona/, "Persona section");
  assert.match(body, /##\s+Output rule/, "Output rule section");
  assert.match(body, /##\s+SOP/, "SOP section");

  // AC1 hard rules
  assert.match(body, /tw_detect_drift/, "must mention drift check policy");
  assert.match(body, /tw_switch_role/, "must mention no role switching");
  assert.ok(
    /no chain|direct execution|no routing|execute directly/i.test(body),
    "must mention direct-execute orientation",
  );
  assert.match(body, /tw_get_state/, "must mention pre-flight tw_get_state");
});

test("AC2: prompts/coordinator-lite.ts exports buildCoordinatorLitePrompt", async () => {
  const tsPath = path.join(PROJECT_ROOT, "prompts", "coordinator-lite.ts");
  assert.ok(fs.existsSync(tsPath), "source file must exist");
  const distPath = path.join(PROJECT_ROOT, "dist", "prompts", "coordinator-lite.js");
  assert.ok(fs.existsSync(distPath), "compiled file must exist");

  const mod = await import(distPath);
  assert.equal(typeof mod.buildCoordinatorLitePrompt, "function", "named export must be a function");

  // Call it and verify shape
  const result = mod.buildCoordinatorLitePrompt(PROJECT_ROOT);
  assert.ok(result && typeof result === "object", "returns PromptResult");
  assert.equal(typeof result.description, "string", "description is string");
  assert.ok(Array.isArray(result.messages) && result.messages.length === 1, "1 message");
  const text = result.messages[0].content.text;
  assert.match(text, /Skill:\s+coordinator-lite/, "loaded lite skill");
  assert.match(text, /^#\s+Constitution\s+v/m, "loaded constitution");
});

test("AC3: ListPromptsRequestSchema response includes 'teamwork-lite'", async () => {
  const { spawn } = await import("node:child_process");
  const dist = path.join(PROJECT_ROOT, "dist", "index.js");
  const p = spawn("node", [dist], { stdio: ["pipe", "pipe", "pipe"] });

  let stdout = "";
  p.stdout.on("data", (d) => { stdout += d.toString(); });
  p.stderr.on("data", () => {}); // suppress

  const send = (msg) => p.stdin.write(JSON.stringify(msg) + "\n");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "qa-test", version: "0" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "prompts/list" });

  await new Promise((r) => setTimeout(r, 1200));
  p.kill();

  const promptList = stdout.split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).find((m) => m && m.id === 2);

  assert.ok(promptList, "received prompts/list response");
  const names = promptList.result.prompts.map((x) => x.name);
  assert.ok(names.includes("teamwork-lite"), `teamwork-lite missing from ${names.join(",")}`);
  assert.ok(names.includes("teamwork"), "teamwork (full) still registered");
});

test("AC4: 'teamwork-lite' is in RAG_SKIP_ROLES (no PRD chunk injection)", async () => {
  // RAG_SKIP_ROLES is module-private; verify via grep on the built source.
  const built = fs.readFileSync(path.join(PROJECT_ROOT, "dist", "prompts", "build.js"), "utf-8");
  assert.match(
    built,
    /RAG_SKIP_ROLES[\s\S]{0,200}["']teamwork-lite["']/,
    "compiled build.js must include 'teamwork-lite' in RAG_SKIP_ROLES",
  );
});

test("AC3b: GetPromptRequestSchema dispatches 'teamwork-lite' correctly", async () => {
  const { spawn } = await import("node:child_process");
  const dist = path.join(PROJECT_ROOT, "dist", "index.js");
  const p = spawn("node", [dist], { stdio: ["pipe", "pipe", "pipe"] });

  let stdout = "";
  p.stdout.on("data", (d) => { stdout += d.toString(); });
  p.stderr.on("data", () => {});

  const send = (msg) => p.stdin.write(JSON.stringify(msg) + "\n");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "qa-test", version: "0" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "prompts/get", params: { name: "teamwork-lite", arguments: { workspace_path: PROJECT_ROOT } } });

  await new Promise((r) => setTimeout(r, 1500));
  p.kill();

  const getRes = stdout.split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).find((m) => m && m.id === 2);

  assert.ok(getRes, "received prompts/get response");
  assert.ok(getRes.result, `expected result, got: ${JSON.stringify(getRes).slice(0, 200)}`);
  const text = getRes.result.messages[0].content.text;
  assert.match(text, /Skill:\s+coordinator-lite/, "dispatched to lite skill");
  assert.match(text, /^#\s+Constitution\s+v/m, "constitution still loaded (single source of truth)");
});

test("Boundary: unknown workspace_path still returns prompt (graceful, no crash)", async () => {
  const mod = await import(path.join(PROJECT_ROOT, "dist", "prompts", "coordinator-lite.js"));
  // Empty string path — buildPromptForRole resolves content via PROJECT_ROOT fallback
  const result = mod.buildCoordinatorLitePrompt("/nonexistent/path/xyzzy");
  assert.ok(result && result.messages && result.messages.length === 1, "still returns a result");
  // Constitution / skill loaded from content/ fallback; state block should say "No handoff state"
  const text = result.messages[0].content.text;
  assert.match(text, /Skill:\s+coordinator-lite/, "skill still loaded");
});

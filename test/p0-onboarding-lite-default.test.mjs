// Coded by @qa-engineer
// Tests for spec: p0-onboarding-lite-default.
// Covers bin/agc-init.mjs scaffolding (T43), package.json bin wiring (T44),
// and bin/agent-governance-context.mjs lite-default variant switching (T45).
// Spec-to-Test map lives in qa_reports/review_p0-onboarding-lite-default.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { parseHandoff } from "../dist/tools/handoff.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const HOOK = path.join(PROJECT_ROOT, "bin", "agent-governance-context.mjs");

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runInit(cwd, args = ["init"]) {
  return spawnSync(process.execPath, [AGC_INIT, ...args], {
    cwd,
    encoding: "utf-8",
  });
}

function runHook(cwd, env = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, ...env },
    encoding: "utf-8",
  });
}

test("AC1: agc init creates handoff/.config/tasks with expected templates", () => {
  const ws = mkTmp("agc-init-ac1-");
  const r = runInit(ws);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.match(r.stdout, /Created: \.current\/handoff\.md, \.current\/\.config\.json, tasks\.md/);

  const handoff = fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
  assert.match(handoff, /^---\nschema_version: 1\n/, "handoff has schema_version: 1");
  assert.match(handoff, /active_feature: ""/, "handoff has empty active_feature");
  assert.match(handoff, /status: "Not_Started"/, "handoff status Not_Started");
  assert.match(handoff, /last_agent: "pm"/, "handoff last_agent pm");
  assert.match(handoff, /qa_round: 0/, "handoff qa_round 0");

  const cfg = JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));
  assert.deepEqual(cfg, { schema_version: 1 });

  const tasks = fs.readFileSync(path.join(ws, "tasks.md"), "utf-8");
  assert.match(tasks, /^# Tasks/m);
  assert.match(tasks, /## Completed/);
});

test("AC2: agc init leaves existing files byte-for-byte unchanged on re-run", () => {
  const ws = mkTmp("agc-init-ac2-");
  assert.equal(runInit(ws).status, 0);

  const handoffPath = path.join(ws, ".current", "handoff.md");
  const tasksPath = path.join(ws, "tasks.md");
  const handoffBefore = fs.readFileSync(handoffPath);
  const tasksBefore = fs.readFileSync(tasksPath);

  // Second run.
  const r = runInit(ws);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Skipped \(already exists\): .*handoff\.md.*\.config\.json.*tasks\.md/);

  assert.deepEqual(fs.readFileSync(handoffPath), handoffBefore, "handoff unchanged");
  assert.deepEqual(fs.readFileSync(tasksPath), tasksBefore, "tasks unchanged");
});

test("AC3: agc init scaffold parses via parseHandoff with Not_Started + pm + empty arrays", () => {
  const ws = mkTmp("agc-init-ac3-");
  assert.equal(runInit(ws).status, 0);

  const state = parseHandoff(ws);
  assert.ok(state, "parseHandoff returns state");
  assert.equal(state.status, "Not_Started");
  assert.equal(state.last_agent, "pm");
  assert.equal(state.active_feature, "");
  assert.equal(state.qa_round, 0);
  assert.deepEqual(state.completed_tasks, []);
  assert.deepEqual(state.pending_notes, []);
});

test("AC4: package.json bin.agc maps to bin/agc-init.mjs and the file is executable", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
  assert.equal(pkg.bin.agc, "./bin/agc-init.mjs", "bin.agc points at agc-init.mjs");
  assert.ok(fs.existsSync(AGC_INIT), "agc-init.mjs exists");
  const mode = fs.statSync(AGC_INIT).mode;
  // owner execute bit must be set so `npx agc` works after install
  assert.ok((mode & 0o100) !== 0, "agc-init.mjs has owner execute bit");
});

test("AC5: hook without AGC_DEFAULT_SKILL injects coordinator-lite skill + Coordinator-Lite prose", () => {
  const ws = mkTmp("agc-hook-ac5-");
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  const env = { ...process.env };
  delete env.AGC_DEFAULT_SKILL;
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: ws,
    env: { ...env, CLAUDE_PROJECT_DIR: ws },
    encoding: "utf-8",
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.match(ctx, /Coordinator-Lite mode/, "intro prose names Coordinator-Lite");
  assert.match(ctx, /# Skill: coordinator-lite/, "injects lite skill body");
  assert.doesNotMatch(ctx, /# Skill: coordinator\n/, "does NOT inject full coordinator skill");
});

test("AC6: hook with AGC_DEFAULT_SKILL=full injects full coordinator skill + Coordinator mode prose", () => {
  const ws = mkTmp("agc-hook-ac6-");
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  const r = runHook(ws, { AGC_DEFAULT_SKILL: "full" });
  assert.equal(r.status, 0);
  const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /currently in Coordinator mode/, "intro prose names full Coordinator");
  assert.match(ctx, /# Skill: coordinator\n/, "injects full coordinator skill body");
  assert.doesNotMatch(ctx, /# Skill: coordinator-lite/, "does NOT inject lite skill");
});

test("security smoke: agc with no subcommand exits non-zero and prints usage to stderr", () => {
  const ws = mkTmp("agc-init-usage-");
  const r = runInit(ws, []);
  assert.notEqual(r.status, 0, "exits non-zero");
  assert.match(r.stderr, /Usage: agc init/);
  // Idempotency invariant: nothing should be written when usage is shown.
  assert.equal(fs.existsSync(path.join(ws, ".current")), false);
  assert.equal(fs.existsSync(path.join(ws, "tasks.md")), false);
});

test("security smoke: hook in a non-managed workspace exits 0 silently", () => {
  const ws = mkTmp("agc-hook-silent-");
  // No .current/, no tasks.md, no TODO.md → hook should no-op.
  const r = runHook(ws);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "", "no stdout emitted");
});

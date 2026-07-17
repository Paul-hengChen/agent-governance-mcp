// Coded by @qa-engineer
// Tests for spec: p0-onboarding-lite-default.
// Covers bin/agc-init.mjs scaffolding (T43), package.json bin wiring (T44),
// and bin/agent-governance-context.mjs lite-default variant switching (T45).
// Spec-to-Test map lives in qa_reports/review_p0-onboarding-lite-default.md.
//
// AC1/AC2/AC3 contract-flip (E34, 2026-07-17, qa-engineer): `agc init` used
// to seed `.current/handoff.md` with a `pm:Not_Started` tuple that has NO
// outgoing ALLOWED_TRANSITIONS edge — every consumer workspace was dead on
// arrival (live incident, VS-NDI-Receiver). The fix (bin/agc-init.mjs) stops
// writing handoff.md entirely: the transition matrix's only fresh-workspace
// key is `null:null` (file absent), so the first `pm:In_Progress` write
// creates it via the normal edge. AC1/AC2/AC3 below are re-pinned to this new
// contract; see qa_reports/expected-red_e34-agc-init-dead-end-seed.txt and
// qa_reports/review_T-E34-01.md for the full disposition.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { parseHandoff } from "../dist/tools/handoff.js";
import { ALLOWED_TRANSITIONS } from "../dist/tools/transitions.js";

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

test("AC1: agc init creates .config.json + tasks.md with expected templates, no handoff.md (re-pinned E34)", () => {
  const ws = mkTmp("agc-init-ac1-");
  const r = runInit(ws);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.match(r.stdout, /Created: \.current\/\.config\.json, tasks\.md/);
  assert.doesNotMatch(r.stdout, /handoff\.md/, "stdout must never mention handoff.md — init no longer scaffolds it (E34)");

  assert.equal(
    fs.existsSync(path.join(ws, ".current", "handoff.md")),
    false,
    "agc init must NOT create .current/handoff.md (E34 — a seeded prev tuple dead-ends ALLOWED_TRANSITIONS)",
  );

  const cfg = JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));
  assert.deepEqual(cfg, { schema_version: 1 });

  const tasks = fs.readFileSync(path.join(ws, "tasks.md"), "utf-8");
  assert.match(tasks, /^# Tasks/m);
  assert.match(tasks, /## Completed/);
});

test("AC2: agc init leaves .config.json and tasks.md byte-for-byte unchanged on re-run (re-pinned E34)", () => {
  const ws = mkTmp("agc-init-ac2-");
  assert.equal(runInit(ws).status, 0);

  const cfgPath = path.join(ws, ".current", ".config.json");
  const tasksPath = path.join(ws, "tasks.md");
  const cfgBefore = fs.readFileSync(cfgPath);
  const tasksBefore = fs.readFileSync(tasksPath);

  // Second run.
  const r = runInit(ws);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Skipped \(already exists\): \.current\/\.config\.json, tasks\.md/);
  assert.doesNotMatch(r.stdout, /handoff\.md/, "re-run stdout must never mention handoff.md (E34)");

  assert.deepEqual(fs.readFileSync(cfgPath), cfgBefore, ".config.json unchanged");
  assert.deepEqual(fs.readFileSync(tasksPath), tasksBefore, "tasks.md unchanged");
  assert.equal(
    fs.existsSync(path.join(ws, ".current", "handoff.md")),
    false,
    "re-run must still not create handoff.md",
  );
});

test("AC3: agc init leaves handoff.md absent — parseHandoff returns null post-init (re-pinned E34)", () => {
  const ws = mkTmp("agc-init-ac3-");
  assert.equal(runInit(ws).status, 0);

  // The sanctioned fresh-workspace tuple is null:null — i.e. handoff.md being
  // ABSENT, not a seeded Not_Started/pm template. parseHandoff must reflect
  // that: no file to parse, no state.
  const state = parseHandoff(ws);
  assert.equal(state, null, "parseHandoff must return null — no handoff.md is the sanctioned fresh-workspace tuple (E34)");
});

test("REGRESSION (E34): agc init never seeds a handoff.md whose (last_agent,status) tuple lacks an ALLOWED_TRANSITIONS edge", () => {
  // Outlives the specific "no handoff.md at all" shape above: if some future
  // refactor reintroduces a seeded template, this pins the invariant that
  // actually matters — whatever gets seeded (if anything) MUST have a live
  // outgoing edge, so no consumer workspace can be dead on arrival again.
  const ws = mkTmp("agc-init-regression-e34-");
  const r = runInit(ws);
  assert.equal(r.status, 0);

  const handoffPath = path.join(ws, ".current", "handoff.md");
  if (fs.existsSync(handoffPath)) {
    const state = parseHandoff(ws);
    assert.ok(state, "a seeded handoff.md must parse cleanly");
    const key = `${state.last_agent ?? "null"}:${state.status ?? "null"}`;
    assert.ok(
      ALLOWED_TRANSITIONS.has(key),
      `seeded tuple "${key}" has no ALLOWED_TRANSITIONS edge — every consumer workspace would be dead on arrival (the exact E34 incident)`,
    );
  } else {
    // Current contract: init creates NO handoff.md at all — the strongest
    // form of the invariant (file absent = the sanctioned null:null tuple,
    // which DOES have outgoing edges per ALLOWED_TRANSITIONS).
    assert.ok(ALLOWED_TRANSITIONS.has("null:null"), "sanity: null:null must itself be a live edge");
  }
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
  assert.match(r.stderr, /Usage: agc <command>/);
  assert.match(r.stderr, /\binit\b/);
  assert.match(r.stderr, /\bcheck\b/);
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

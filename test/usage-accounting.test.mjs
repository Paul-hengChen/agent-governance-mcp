// Coded by @qa-engineer
// Tests for specs/d2-server-brake-accounting.md — the durable, hook-appended
// token-usage sidecar (tools/usage-accounting.ts) and its PostToolUse writer
// (bin/agent-governance-usage-hook.mjs), T-D2-05.
//
// Spec-to-Test map:
//   AC-5 (durable, out-of-band usage record, not hand-summed) -> t-append-*,
//                                                                 t-hook-writes-record
//   AC-4 (crash/compaction — fresh read reconstructs the
//         feature-scoped token total from disk)                -> t-crash-*
//   AC-7 (no duplicate/conflated telemetry streams — disjoint
//         key sets vs telemetry.jsonl)                          -> t-ac7-*
//   AC-9 (opt-in; absence of tokenBudgetPerFeature = zero
//         behavior change / no sidecar writes)                  -> t-hook-noop-*
//
// WHY: the token-usage sidecar is D2's second breaker (alongside hop_count).
// It is deliberately NOT governed by the handoff.ts 4-step mutating-tool
// contract — it's a best-effort, lock-free, never-throw append the
// PostToolUse hook performs out-of-band from the coordinator's own memory.
// These tests pin the pure module (append/sum) in isolation, the opt-in hook
// contract end-to-end (spawning the real bin/ script against real stdin
// payloads), and the crash-survival property that motivated this feature in
// the first place.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  usagePath,
  appendUsageRecord,
  sumUsageForFeature,
} from "../dist/tools/usage-accounting.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const HOOK_SCRIPT = path.join(ROOT, "bin", "agent-governance-usage-hook.mjs");

function mkWs(prefix = "usage-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function readUsageLines(ws) {
  const p = usagePath(ws);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// ============================================================================
// usagePath
// ============================================================================

test("t-usagepath: usagePath resolves to <ws>/.current/usage.jsonl", () => {
  assert.equal(usagePath("/tmp/some-ws"), path.join("/tmp/some-ws", ".current", "usage.jsonl"));
});

// ============================================================================
// AC-5: appendUsageRecord — durable, best-effort append
// ============================================================================

test("t-append-creates-file: appendUsageRecord creates .current/usage.jsonl and writes one JSON line", () => {
  const ws = mkWs();
  appendUsageRecord(ws, {
    ts: "2026-07-10T00:00:00.000Z",
    feature: "feat-a",
    dispatch: "sr-engineer",
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  });
  const lines = readUsageLines(ws);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].feature, "feat-a");
  assert.equal(lines[0].dispatch, "sr-engineer");
  assert.deepEqual(lines[0].usage, { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
});

test("t-append-creates-current-dir: appendUsageRecord creates .current/ if missing entirely", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "usage-nodir-"));
  // Note: no .current/ dir created (unlike mkWs).
  assert.equal(fs.existsSync(path.join(ws, ".current")), false);
  appendUsageRecord(ws, {
    ts: "2026-07-10T00:00:00.000Z",
    feature: "feat-b",
    dispatch: "qa-engineer",
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  });
  assert.ok(fs.existsSync(usagePath(ws)), ".current/usage.jsonl must exist after appendUsageRecord creates the dir");
});

test("t-append-appends-not-truncates: multiple appendUsageRecord calls accumulate lines, never truncate", () => {
  const ws = mkWs();
  for (let i = 0; i < 5; i++) {
    appendUsageRecord(ws, {
      ts: `2026-07-10T00:00:0${i}.000Z`,
      feature: "feat-c",
      dispatch: "sr-engineer",
      usage: { input_tokens: i, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
  }
  assert.equal(readUsageLines(ws).length, 5);
});

test("t-append-never-throws: appendUsageRecord swallows a write failure instead of throwing (best-effort, D3 discipline)", () => {
  // Point workspacePath at a location where ".current" cannot be created —
  // a FILE (not a directory) already occupies that path segment.
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "usage-blocked-"));
  fs.writeFileSync(path.join(ws, ".current"), "i am a file, not a directory");
  assert.doesNotThrow(() => {
    appendUsageRecord(ws, {
      ts: "2026-07-10T00:00:00.000Z",
      feature: "feat-d",
      dispatch: "sr-engineer",
      usage: { input_tokens: 1, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
  }, "an fs failure inside appendUsageRecord must be swallowed, never thrown");
});

// ============================================================================
// AC-5/DR-5: sumUsageForFeature — feature-scoped running total
// ============================================================================

test("t-sum-absent-file: sumUsageForFeature returns 0 when usage.jsonl does not exist (hook not wired / no dispatches yet)", () => {
  const ws = mkWs();
  assert.equal(sumUsageForFeature(ws, "any-feature"), 0);
});

test("t-sum-feature-scoped: sumUsageForFeature sums ONLY lines matching the given feature (DR-5)", () => {
  const ws = mkWs();
  appendUsageRecord(ws, { ts: "t1", feature: "feat-x", dispatch: "sr-engineer", usage: { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  appendUsageRecord(ws, { ts: "t2", feature: "feat-y", dispatch: "sr-engineer", usage: { input_tokens: 9999, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  appendUsageRecord(ws, { ts: "t3", feature: "feat-x", dispatch: "qa-engineer", usage: { input_tokens: 50, output_tokens: 25, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  assert.equal(sumUsageForFeature(ws, "feat-x"), 175, "must sum only feat-x lines (100 + 50 + 25), ignoring feat-y's 9999");
  assert.equal(sumUsageForFeature(ws, "feat-y"), 9999, "feat-y's own total must be independent");
  assert.equal(sumUsageForFeature(ws, "feat-z"), 0, "an unrecorded feature sums to 0");
});

test("t-sum-all-four-usage-keys: sumUsageForFeature sums all 4 canonical usage.* fields", () => {
  const ws = mkWs();
  appendUsageRecord(ws, {
    ts: "t1",
    feature: "feat-sum4",
    dispatch: "sr-engineer",
    usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 },
  });
  assert.equal(sumUsageForFeature(ws, "feat-sum4"), 100);
});

test("t-sum-skips-malformed-lines: sumUsageForFeature skips torn/unparseable lines without throwing", () => {
  const ws = mkWs();
  appendUsageRecord(ws, { ts: "t1", feature: "feat-torn", dispatch: "sr-engineer", usage: { input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  // Simulate a torn concurrent-append line: append a raw, malformed fragment.
  fs.appendFileSync(usagePath(ws), '{"ts":"t2","feature":"feat-to\n', "utf-8");
  appendUsageRecord(ws, { ts: "t3", feature: "feat-torn", dispatch: "sr-engineer", usage: { input_tokens: 5, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  assert.doesNotThrow(() => sumUsageForFeature(ws, "feat-torn"));
  assert.equal(sumUsageForFeature(ws, "feat-torn"), 15, "torn line must be skipped; the two well-formed records still sum");
});

test("t-sum-ignores-non-numeric-usage-values: non-numeric usage.* fields contribute 0, never NaN/throw", () => {
  const ws = mkWs();
  fs.appendFileSync(
    usagePath(ws),
    JSON.stringify({ ts: "t1", feature: "feat-badval", dispatch: "sr-engineer", usage: { input_tokens: "not-a-number", output_tokens: 10, cache_read_input_tokens: null, cache_creation_input_tokens: undefined } }) + "\n",
    "utf-8",
  );
  const total = sumUsageForFeature(ws, "feat-badval");
  assert.equal(total, 10, "only the well-formed numeric field (output_tokens: 10) contributes; malformed fields default to 0");
  assert.ok(Number.isFinite(total), "total must never be NaN");
});

test("t-sum-missing-usage-object: a record with no usage object at all contributes 0, does not throw", () => {
  const ws = mkWs();
  fs.appendFileSync(usagePath(ws), JSON.stringify({ ts: "t1", feature: "feat-nousage", dispatch: "sr-engineer" }) + "\n", "utf-8");
  assert.equal(sumUsageForFeature(ws, "feat-nousage"), 0);
});

test("t-sum-empty-file: sumUsageForFeature returns 0 for a zero-byte usage.jsonl", () => {
  const ws = mkWs();
  fs.writeFileSync(usagePath(ws), "", "utf-8");
  assert.equal(sumUsageForFeature(ws, "anything"), 0);
});

// ============================================================================
// AC-7: usage.jsonl vs telemetry.jsonl — disjoint key sets
// ============================================================================

test("t-ac7-disjoint-keys: a usage.jsonl record's key set is disjoint from telemetry.jsonl's documented shape", () => {
  const ws = mkWs();
  appendUsageRecord(ws, {
    ts: "2026-07-10T00:00:00.000Z",
    feature: "feat-ac7",
    dispatch: "sr-engineer",
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  });
  const [record] = readUsageLines(ws);
  const usageKeys = new Set(Object.keys(record));
  // telemetry.jsonl's documented shape (tools/telemetry.ts / D3 spec):
  // { ts, gate, error_code, agent_id, feature }.
  const telemetryOnlyKeys = ["gate", "error_code", "agent_id"];
  for (const k of telemetryOnlyKeys) {
    assert.ok(!usageKeys.has(k), `usage.jsonl record must not carry telemetry-only key "${k}"`);
  }
  assert.ok(usageKeys.has("dispatch"), "usage.jsonl record must carry its own distinguishing key 'dispatch', absent from telemetry.jsonl");
  assert.deepEqual([...usageKeys].sort(), ["dispatch", "feature", "ts", "usage"].sort());
});

test("t-ac7-separate-files: usage.jsonl and telemetry.jsonl are two distinct files, never conflated", () => {
  const ws = mkWs();
  appendUsageRecord(ws, { ts: "t1", feature: "f", dispatch: "sr-engineer", usage: { input_tokens: 1, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  assert.notEqual(usagePath(ws), path.join(ws, ".current", "telemetry.jsonl"));
  assert.ok(fs.existsSync(usagePath(ws)));
  assert.equal(fs.existsSync(path.join(ws, ".current", "telemetry.jsonl")), false, "writing a usage record must not create/touch telemetry.jsonl");
});

// ============================================================================
// AC-4: crash/compaction — a fresh read (no in-memory total) reconstructs the
// feature-scoped token total purely from disk
// ============================================================================

test("t-crash-reconstruct: N independent appendUsageRecord calls (simulating N separate dispatch processes) sum correctly on a completely fresh read", () => {
  const ws = mkWs();
  // Each call here is independent — no shared in-memory accumulator is ever
  // threaded between them, exactly as if each were a separate coordinator
  // dispatch's PostToolUse hook invocation (a fresh node process in reality).
  const perDispatch = [1000, 2500, 750, 4200, 300];
  for (const n of perDispatch) {
    appendUsageRecord(ws, {
      ts: new Date().toISOString(),
      feature: "crash-recon-feat",
      dispatch: "sr-engineer",
      usage: { input_tokens: n, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
  }
  const expected = perDispatch.reduce((a, b) => a + b, 0);
  // The "coordinator" reconstructing after a crash/compaction calls
  // sumUsageForFeature fresh — it holds no running total of its own.
  assert.equal(sumUsageForFeature(ws, "crash-recon-feat"), expected);
});

test("t-crash-reconstruct-mixed-features: reconstruction stays feature-scoped even when other features interleave in the same file", () => {
  const ws = mkWs();
  appendUsageRecord(ws, { ts: "t1", feature: "feat-alpha", dispatch: "sr-engineer", usage: { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  appendUsageRecord(ws, { ts: "t2", feature: "feat-beta", dispatch: "qa-engineer", usage: { input_tokens: 200, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  appendUsageRecord(ws, { ts: "t3", feature: "feat-alpha", dispatch: "code-reviewer", usage: { input_tokens: 300, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  appendUsageRecord(ws, { ts: "t4", feature: "feat-beta", dispatch: "sr-engineer", usage: { input_tokens: 400, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  assert.equal(sumUsageForFeature(ws, "feat-alpha"), 400, "feat-alpha's crash-time total must reconstruct to exactly its own lines' sum");
  assert.equal(sumUsageForFeature(ws, "feat-beta"), 600, "feat-beta's crash-time total must reconstruct independently");
});

// ============================================================================
// AC-9 / opt-in hook contract: bin/agent-governance-usage-hook.mjs
// ============================================================================

function runHook(payload, { cwd, timeoutMs = 5000 } = {}) {
  const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf-8",
    timeout: timeoutMs,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });
  return result;
}

function writeConfig(ws, config) {
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify(config), "utf-8");
}

test("t-hook-noop-no-config-file: no .config.json at all -> hook writes nothing, exits 0 (AC-9)", () => {
  const ws = mkWs();
  const result = runHook({ tool_name: "Task", cwd: ws, tool_input: { subagent_type: "sr-engineer" }, tool_response: { usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
  assert.equal(result.status, 0, `hook must always exit 0; stderr: ${result.stderr}`);
  assert.equal(fs.existsSync(usagePath(ws)), false, "no .config.json (absent tokenBudgetPerFeature) must produce zero sidecar writes");
});

test("t-hook-noop-config-without-budget-key: .config.json present but tokenBudgetPerFeature key absent -> no sidecar write (AC-9)", () => {
  const ws = mkWs();
  writeConfig(ws, { taskPaths: ["tasks.md"] });
  const result = runHook({ tool_name: "Task", cwd: ws, tool_response: { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(usagePath(ws)), false, "absent tokenBudgetPerFeature key must produce zero behavior change (AC-9)");
});

for (const badBudget of [0, -100, NaN, Infinity, "500000"]) {
  test(`t-hook-noop-invalid-budget-${String(badBudget)}: tokenBudgetPerFeature=${String(badBudget)} (non-positive/non-finite/non-numeric) -> no sidecar write`, () => {
    const ws = mkWs();
    // NaN/Infinity don't survive JSON.stringify as themselves; write raw JSON text directly to exercise the exact on-disk shape.
    const raw = typeof badBudget === "string"
      ? JSON.stringify({ tokenBudgetPerFeature: badBudget })
      : `{"tokenBudgetPerFeature": ${Number.isFinite(badBudget) ? badBudget : (Number.isNaN(badBudget) ? "null" : '"Infinity"')}}`;
    fs.writeFileSync(path.join(ws, ".current", ".config.json"), raw, "utf-8");
    const result = runHook({ tool_name: "Task", cwd: ws, tool_response: { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
    assert.equal(result.status, 0);
    assert.equal(fs.existsSync(usagePath(ws)), false, `budget=${String(badBudget)} must not arm the sidecar (AC-9)`);
  });
}

test("t-hook-noop-malformed-config-json: malformed .config.json (unparseable) -> no-op, no throw, exit 0", () => {
  const ws = mkWs();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), "{ this is not valid json", "utf-8");
  const result = runHook({ tool_name: "Task", cwd: ws, tool_response: { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
  assert.equal(result.status, 0, "malformed config must not crash the hook (best-effort, never-throw discipline)");
  assert.equal(fs.existsSync(usagePath(ws)), false);
});

test("t-hook-noop-wrong-tool-name: tool_name !== 'Task' -> no-op even with a valid opt-in config", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  const result = runHook({ tool_name: "Read", cwd: ws, tool_response: { usage: { input_tokens: 999, output_tokens: 999, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(usagePath(ws)), false, "a non-Task tool must never trigger a usage write, config or not");
});

test("t-hook-noop-no-current-dir: workspace has no .current/ at all -> no-op (unmanaged workspace)", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "usage-unmanaged-"));
  const result = runHook({ tool_name: "Task", cwd: ws, tool_response: { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(ws, ".current")), false, "an unmanaged workspace must not gain a .current/ dir just from the hook running");
});

test("t-hook-noop-malformed-stdin: unparseable stdin payload -> no-op, exit 0 (never blocks the real Task result)", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  const result = runHook("{ not json at all", { cwd: ws });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(usagePath(ws)), false);
});

test("t-hook-writes-record: a valid Task dispatch with tokenBudgetPerFeature set DOES append a usage.jsonl record (positive control)", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---\nschema_version: 9\nactive_feature: "hook-write-feat"\nstatus: "In_Progress"\nlast_updated: "2026-07-10T00:00:00.000Z"\n---\n# Handoff\n`,
  );
  const result = runHook({
    tool_name: "Task",
    cwd: ws,
    tool_input: { subagent_type: "sr-engineer" },
    tool_response: { usage: { input_tokens: 1234, output_tokens: 567, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 } },
  }, { cwd: ws });
  assert.equal(result.status, 0, `hook must exit 0; stderr: ${result.stderr}`);
  const lines = readUsageLines(ws);
  assert.equal(lines.length, 1, "a valid opt-in Task dispatch must append exactly one record");
  assert.equal(lines[0].feature, "hook-write-feat", "feature must be read from handoff.md active_feature");
  assert.equal(lines[0].dispatch, "sr-engineer", "dispatch must be read from tool_input.subagent_type");
  assert.deepEqual(lines[0].usage, { input_tokens: 1234, output_tokens: 567, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 });
});

test("t-hook-missing-usage-fields-default-zero: tool_response.usage with missing/non-numeric fields defaults them to 0", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  const result = runHook({
    tool_name: "Task",
    cwd: ws,
    tool_input: { subagent_type: "qa-engineer" },
    tool_response: { usage: { input_tokens: 42 /* others absent */ } },
  }, { cwd: ws });
  assert.equal(result.status, 0);
  const [record] = readUsageLines(ws);
  assert.deepEqual(record.usage, { input_tokens: 42, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
});

test("t-hook-no-usage-anywhere-all-zeros: no tool_response.usage and no agent-*.jsonl fallback source -> all-zeros record, still written (opt-in armed)", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  const result = runHook({ tool_name: "Task", cwd: ws, tool_input: { subagent_type: "sr-engineer" } }, { cwd: ws });
  assert.equal(result.status, 0);
  const [record] = readUsageLines(ws);
  assert.ok(record, "a record must still be written when the hook is armed, even with all-zero usage");
  assert.deepEqual(record.usage, { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
});

test("t-hook-feature-null-when-no-handoff: dispatch.feature is null when handoff.md is absent (best-effort, never throws)", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  // No handoff.md written in this workspace.
  const result = runHook({ tool_name: "Task", cwd: ws, tool_input: { subagent_type: "pm" }, tool_response: { usage: { input_tokens: 5, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }, { cwd: ws });
  assert.equal(result.status, 0);
  const [record] = readUsageLines(ws);
  assert.equal(record.feature, null);
});

test("t-hook-empty-stdin: zero-byte stdin -> no-op, exit 0", () => {
  const ws = mkWs();
  writeConfig(ws, { tokenBudgetPerFeature: 500000 });
  const result = runHook("", { cwd: ws });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(usagePath(ws)), false);
});

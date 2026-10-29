// Coded by @qa-engineer
// E308 / E303 source-level proofs (specs/e308-tier-enum-and-zod-telemetry.md AC1, AC2, AC4,
// AC5, AC6, AC11): the model-tier vocabulary has one source, stale wording is gone, and the
// zod-telemetry emission lives in tools/, not index.ts, and the gates/registry.ts mapping line is intact. Grep-style on purpose —
// they guard against a second literal copy creeping back.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;

const PARSE = read("tools/handoff-parse.ts");
const REGISTRY = read("tools/registry.ts");
const ORCH = read("tools/handoff-orchestrator.ts");
const FM = read("tools/skill-frontmatter.ts");
const GATES = read("gates/registry.ts");

test("E308-AC1: no literal four-value tier array in handoff-parse.ts; it re-exports MODEL_TIERS", async () => {
  assert.equal(count(PARSE, '"opus", "sonnet", "haiku", "fable"'), 0);
  const p = await import("../dist/tools/handoff-parse.js");
  const s = await import("../dist/tools/skill-frontmatter.js");
  assert.deepEqual([...p.DISPATCH_PIN_TIER_VALUES], [...s.MODEL_TIERS]);
  assert.equal(p.DISPATCH_PIN_TIER_VALUES, s.MODEL_TIERS);
});

test("E308-AC1b: skill-frontmatter.ts imports nothing from tools/ (keeps the single source cycle-free)", () => {
  const imports = FM.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
  for (const l of imports) {
    assert.ok(!/from\s+["']\.\/(?!skill-frontmatter)/.test(l) && !/from\s+["']\.\.\//.test(l), `unexpected local import: ${l}`);
  }
});

test("E308-AC2: registry.ts has no literal enum: [\"opus\", \"sonnet\", \"haiku\", \"fable\"]", () => {
  assert.equal(count(REGISTRY, 'enum: ["opus", "sonnet", "haiku", "fable"]'), 0);
});

test("E308-AC4: handoff-orchestrator.ts has no literal 'opus, sonnet, haiku, fable'", () => {
  assert.equal(count(ORCH, "opus, sonnet, haiku, fable"), 0);
});

test("E308-AC5: DispatchPinTier is no longer declared or exported anywhere in tools/ or gates/", () => {
  for (const dir of ["tools", "gates"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith(".ts"))) {
      assert.ok(!read(`${dir}/${f}`).includes("DispatchPinTier"), `${dir}/${f} mentions DispatchPinTier`);
    }
  }
});

test("E308-AC6: stale 'no gate' wording is gone from the dispatch_pins zod comment and inputSchema description (scoped; other 'no gate' hits are unrelated)", () => {
  const zodStart = REGISTRY.indexOf("dispatch_pins: z");
  const commentStart = REGISTRY.lastIndexOf("E300", zodStart);
  const zodBlock = REGISTRY.slice(Math.max(0, commentStart - 200), zodStart);
  assert.ok(zodBlock.includes("dispatch_pins"), "located the dispatch_pins zod comment block");
  const descStart = REGISTRY.indexOf('"Human model-tier pins per role');
  assert.ok(descStart > 0);
  const descBlock = REGISTRY.slice(descStart, REGISTRY.indexOf("\n", descStart));
  for (const block of [zodBlock, descBlock]) {
    assert.ok(!block.includes("File-mode only, no gate"));
    assert.ok(!block.includes("Advisory bookkeeping — no gate"));
  }
  assert.ok(descBlock.includes(
    "The value enum is enforced at the tool boundary in file and SQLite mode alike (DISPATCH_PIN_TIER_REJECTED); the map itself gates no transition and is persisted in file mode only.",
  ));
  assert.ok(count(REGISTRY, "DISPATCH_PIN_TIER_REJECTED") >= 3);
});

test("E303-AC11a: gates/registry.ts keeps the mapping line exactly once and no '(none)' (NON_REVIEWER_VERDICT_REJECTED now mapped, E365)", () => {
  assert.equal(count(GATES, "DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md"), 1);
  assert.equal(count(GATES, "(none)"), 0);
  assert.equal(count(GATES, 'hintStatic: "is not a model tier; allowed: opus, sonnet, haiku, fable"'), 1);
});

test("E303-AC11b: gates/registry.ts mapping line is a whole comment line naming coord-02-host-dispatch.md", () => {
  // Content check, not a diff against a lane base (a base-relative diff cannot survive later lanes).
  const lines = GATES.split("\n").filter((l) => l.includes("DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md"));
  assert.deepEqual(lines, ["//   DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md"]);
});

test("E303-AC11c: index.ts carries no zod-telemetry emission; it lives in tools/registry.ts", () => {
  // Content check, not a diff against a lane base, so the release version-literal bump cannot trip it.
  const INDEX = read("index.ts");
  assert.equal(/emit\w*Telemetry/.test(INDEX), false);
  assert.ok(REGISTRY.includes("emitZodGateTelemetry"));
});

test("E303-AC12: no new gate code beyond E139 (35 entries) and DISPATCH_PIN_TIER_REJECTED is the only tool-boundary producer", async () => {
  const { GATE_REGISTRY } = await import("../dist/gates/registry.js");
  assert.equal(GATE_REGISTRY.length, 35);
  const tb = GATE_REGISTRY.filter((g) => g.producer === "tool-boundary").map((g) => g.errorCode);
  assert.deepEqual(tb, ["DISPATCH_PIN_TIER_REJECTED"]);
});

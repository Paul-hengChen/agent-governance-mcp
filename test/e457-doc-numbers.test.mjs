// Coded by @qa-engineer
// Tests for specs/e453-served-text-v5.md AC13-AC15 (ticket E457: doc numbers).
// WHY: the contributor docs said the write path runs an 18-step pipeline over 35 gates while the server runs
// 17 steps and registers 33 gates, and nothing caught the drift. AC13/AC14 pin the corrected lines (spec
// `## Copy / Strings`, verbatim); AC15 binds every pipeline-length and gate-count statement in five docs to
// the live `UPDATE_STATE_GATE_PIPELINE.length` / `GATE_REGISTRY.length` (read from dist/), so the next change
// to either count fails here until the docs follow. The checker also runs on mutated text, so a checker that
// silently matches nothing cannot pass. Text checks normalise runs of whitespace to one space.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const imp = (...p) => import(pathToFileURL(path.join(ROOT, ...p)).href);
const norm = (s) => s.replace(/\s+/g, " ");
const has = (hay, needle) => norm(hay).includes(norm(needle));

const { GATE_REGISTRY } = await imp("dist", "gates", "registry.js");
const { UPDATE_STATE_GATE_PIPELINE } = await imp("dist", "tools", "handoff-orchestrator.js");
const LIVE = { steps: UPDATE_STATE_GATE_PIPELINE.length, gates: GATE_REGISTRY.length };

// ------------------------------------------------------------------ Copy / Strings (spec, verbatim)

const COPY = {
  "arch.cap_overrides": "│      the cap overrides:                                         │",
  "arch.hop_override": "│        hop_count ≥ 14 (HOP_CAP_EXCEEDED): role change → pm      │",
  "arch.gate_entries": "Gate metadata (error code, owning role, exemptions) is declared once per gate in `gates/registry.ts` — 33 entries covering the pipeline gates plus the read-path and task-tool gates.",
  "contrib.orchestrator": "  handoff-orchestrator.ts #   tw_update_state / tw_get_state + the 17-step",
  "contrib.gate_defs": "  registry.ts             #   GATE_REGISTRY — 33 gate definitions",
  "contrib.layout_test": "test/                     # node --test suites + eval/ harness",
  "contrib.guards": "3. **Guards + gates** — `guards/session.ts` (pre-flight check) and `guards/file-lock.ts` (O_EXCL lock + mtime freshness), then the 17-step `UPDATE_STATE_GATE_PIPELINE` in `tools/handoff-orchestrator.ts` with predicates under `gates/`.",
  "contrib.testing": "`test/` holds the `node --test` suites covering guards, transitions and round caps, every gate in `GATE_REGISTRY`, drift and sync, schema migrations, prompt composition and context budget, the agc adapters, and RAG.",
  "config.caveat_gates": "The state machine in `tools/transitions.ts` and the 33 gates registered in `gates/registry.ts` are code, not text — drift between your custom constitution and the code yields confusing rejections.",
};

// ------------------------------------------------------------------ the doc-number checker (AC15)

// A statement is `<n>-step` / `<n> steps` (pipeline length) or `<n> entries` / `<n> gate definitions` /
// `<n> gates` (gate count). A number preceded by `§`, `.` or a digit is not a statement (`§3.1 gates`).
// Returns one finding per statement whose number differs from the live count.
function checkDocNumbers(text, live) {
  const findings = [];
  const re = /(?<![§.\d])(\d+)(-step\b| steps\b| entries\b| gate definitions\b| gates\b)/g;
  for (const m of norm(text).matchAll(re)) {
    const kind = m[2].includes("step") ? "steps" : "gates";
    const n = Number(m[1]);
    if (n !== live[kind]) findings.push({ statement: m[0], kind, found: n, expected: live[kind] });
  }
  return findings;
}

const DOCS = ["CLAUDE.md", "README.md", "CONTRIBUTING.md", "docs/architecture.md", "docs/config.md"];

// ================================================================== AC13

test("AC13: CONTRIBUTING, architecture and config state 17 steps and 33 gates, and CONTRIBUTING carries no test-file count", () => {
  const contrib = read("CONTRIBUTING.md");
  const cl = contrib.split("\n");
  assert.ok(cl.includes(COPY["contrib.orchestrator"]), "layout row: the 17-step pipeline (contrib.orchestrator)");
  assert.ok(cl.includes(COPY["contrib.gate_defs"]), "layout row: 33 gate definitions (contrib.gate_defs)");
  assert.ok(cl.includes(COPY["contrib.layout_test"]), "layout row for test/ carries no file count (contrib.layout_test)");
  assert.ok(cl.includes(COPY["contrib.guards"]), "Guards + gates item says 17-step (contrib.guards)");
  assert.ok(has(contrib, COPY["contrib.testing"]), "Testing paragraph carries no file count (contrib.testing)");
  assert.doesNotMatch(norm(contrib), /\b\d+ test files\b/, "no test-file count anywhere in CONTRIBUTING.md");
  assert.ok(has(read("docs", "architecture.md"), COPY["arch.gate_entries"]), "architecture: 33 entries (arch.gate_entries)");
  assert.ok(has(read("docs", "config.md"), COPY["config.caveat_gates"]), "config caveat: 33 gates registered (config.caveat_gates)");
});

// ================================================================== AC14

test("AC14: architecture step 1 box lists four cap overrides, HOP_CAP_EXCEEDED after the SR_RETURN_CAP line, every box line 67 characters wide", () => {
  // WHY: step 1 (TRANSITION_VALIDATION) also applies the hop cap; the box listed three overrides.
  const ls = read("docs", "architecture.md").split("\n");
  const s1 = ls.findIndex((l) => l.includes(" 1 TRANSITION_VALIDATION"));
  const s2 = ls.findIndex((l) => l.includes(" 2 FEATURE_LEASE"));
  assert.ok(s1 >= 0 && s2 > s1, "step 1 and step 2 rows found");
  const step1 = ls.slice(s1, s2);
  assert.ok(step1.includes(COPY["arch.cap_overrides"]), "step 1 says 'the cap overrides:' (arch.cap_overrides)");
  const sr = step1.findIndex((l) => l.includes("(SR_RETURN_CAP)"));
  assert.ok(sr >= 0, "SR_RETURN_CAP line present");
  assert.equal(step1[sr + 1], COPY["arch.hop_override"], "the next line is arch.hop_override");
  const overrides = step1.filter((l) => /≥ \d+ \(/.test(l));
  assert.equal(overrides.length, 4, `four override lines: ${overrides.join(" / ")}`);
  // The box that holds step 1: the last top border above it to the first bottom border below step 2.
  const top = ls.slice(0, s1).map((l) => l.startsWith("┌")).lastIndexOf(true);
  const bottom = ls.findIndex((l, i) => i > s2 && l.startsWith("└"));
  assert.ok(top >= 0 && bottom > s2, "pipeline box bounds found");
  for (let i = top; i <= bottom; i++) {
    assert.equal([...ls[i]].length, 67, `box line ${i + 1} is 67 characters: ${ls[i]}`);
  }
});

// ================================================================== AC15

test("AC15: every pipeline-length and gate-count statement in the five docs equals the live counts; the checker reports mutated numbers", () => {
  // Checker sanity on mutated text first: each wrong statement is reported, correct and § numbers are not.
  const wrongSteps = LIVE.steps + 1;
  const wrongGates = LIVE.gates + 2;
  for (const s of [`the ${wrongSteps}-step pipeline`, `${wrongGates} entries`, `${wrongGates} gate definitions`, `${wrongSteps} gates`]) {
    assert.equal(checkDocNumbers(s, LIVE).length, 1, `mutation reported: ${s}`);
  }
  assert.deepEqual(checkDocNumbers("18-step, 35 entries, 35 gate definitions and 18 gates", { steps: 17, gates: 33 }).map((f) => f.statement),
    ["18-step", "35 entries", "35 gate definitions", "18 gates"], "the spec's four mutation strings are each reported");
  assert.deepEqual(checkDocNumbers(`the ${LIVE.steps}-step pipeline, ${LIVE.steps} steps, ${LIVE.gates} entries, ${LIVE.gates} gate definitions, ${LIVE.gates} gates`, LIVE), [], "correct statements are not reported");
  assert.deepEqual(checkDocNumbers("the §3.1 gates and v4.18 gates", LIVE), [], "a number after § or . is not a statement");
  assert.equal(checkDocNumbers(`${wrongGates}\n  entries`, LIVE).length, 1, "a wrapped statement is still a statement");

  // The five docs.
  const all = [];
  for (const f of DOCS) for (const x of checkDocNumbers(read(f), LIVE)) all.push(`${f}: "${x.statement}" (expected ${x.expected})`);
  assert.deepEqual(all, [], `doc numbers disagree with the server:\n${all.join("\n")}`);
});

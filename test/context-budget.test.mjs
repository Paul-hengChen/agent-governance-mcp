// Coded by @qa-engineer
// Tests for spec: specs/context-budget-reduction.md.
// Spec-to-Test map:
//   AC1 (measurement)          -> t-measure-runs, t-measure-labels
//   AC2 (reduction)            -> t-strip-reduces, t-lean-under-target
//   AC3 (enforcement preserved)-> t-lite-omits-chain, t-lite-keeps-universal,
//                                 t-full-keeps-chain, t-hook-lite, t-hook-full
//   AC4 (no routing regression)-> t-full-keeps-chain (chain roles still receive
//                                 §3.1/§4 verbatim; transition logic untouched —
//                                 covered by the existing transitions test suite)
//   DR-3 (3-copy regex parity) -> t-regex-equivalence
//
// WHY: the always-on token reduction works by stripping the chain-only sections
// (constitution §3.1, §4) from LITE contexts only. The risk is twofold — (a) the
// strip silently drops a rule a lite agent still needs, or (b) the three copies
// of the stripper regex drift. These tests pin both: lite loses ONLY chain rules,
// chain roles keep everything, and all three regex copies stay identical.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const CONSTITUTION = fs.readFileSync(path.join(ROOT, "content", "constitution.md"), "utf-8");
const approxTokens = (t) => Math.ceil(t.length / 4);

const { stripChainOnly } = await import(path.join(ROOT, "dist", "prompts", "build.js"));

// Markers that prove a section is present/absent in a rendered bundle.
const CHAIN_MARKERS = ["3.1 Server-enforced chain", "4. Routing Chain"];
const UNIVERSAL_MARKERS = ["NO YAPPING", "Strict typing", "Anti-Loop Circuit Breaker", "Access Denied", "Cognitive Discipline"];

// --- AC2: reduction -------------------------------------------------------

test("AC2: stripChainOnly removes the chain-only block and is idempotent", () => {
  const lean = stripChainOnly(CONSTITUTION);
  assert.ok(lean.length < CONSTITUTION.length, "stripped constitution must be shorter than raw");
  assert.equal(stripChainOnly(lean), lean, "stripChainOnly must be idempotent");
  // no-marker passthrough is the safety default (workspace override without fences)
  assert.equal(stripChainOnly("no markers here"), "no markers here", "text without markers is unchanged");
});

test("AC2: lean always-on bundle is below the raw baseline and within target (<= 2100 ~tok)", () => {
  // v3.22.0 Decision 7: cap raised from 2000 → 2100 to accommodate the new
  // ## Subagent Reply Watermark Validation section (~84 tokens) added to
  // skill-coordinator-lite.md. The pre-v3.22 lean bundle sat at 1996/2000;
  // after the watermark section it reached 2080. 2100 is a +5% relaxation
  // still well below the full coordinator bundle (~3500+ tokens).
  const liteSkill = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
  const SEP = "\n\n---\n\n";
  const raw = approxTokens(CONSTITUTION + SEP + liteSkill);
  const lean = approxTokens(stripChainOnly(CONSTITUTION) + SEP + liteSkill);
  assert.ok(lean < raw, `lean (${lean}) must be < raw (${raw})`);
  assert.ok(lean <= 2100, `lean always-on (${lean} ~tok) must meet the <= 2100 target`);
});

// --- AC3: enforcement preserved ------------------------------------------

test("AC3: lite (stripped) constitution OMITS chain-only sections", () => {
  const lean = stripChainOnly(CONSTITUTION);
  for (const m of CHAIN_MARKERS) {
    assert.ok(!lean.includes(m), `lite constitution must NOT contain chain-only marker: ${m}`);
  }
  assert.ok(!lean.includes("chain-only:start"), "fence markers themselves must be removed");
});

test("AC3: lite (stripped) constitution RETAINS all universal rules", () => {
  const lean = stripChainOnly(CONSTITUTION);
  for (const m of UNIVERSAL_MARKERS) {
    assert.ok(lean.includes(m), `lite constitution must still contain universal rule: ${m}`);
  }
});

test("AC3/AC4: full (chain-role) constitution RETAINS chain-only sections verbatim", () => {
  // Chain roles receive the raw constitution — the rules that drive the
  // server-enforced transitions must reach them unchanged.
  for (const m of [...CHAIN_MARKERS, ...UNIVERSAL_MARKERS]) {
    assert.ok(CONSTITUTION.includes(m), `full constitution must contain: ${m}`);
  }
});

test("AC3: exactly one balanced chain-only fence wraps §3.1 + §4", () => {
  const starts = (CONSTITUTION.match(/<!-- chain-only:start -->/g) || []).length;
  const ends = (CONSTITUTION.match(/<!-- chain-only:end -->/g) || []).length;
  assert.equal(starts, 1, "exactly one chain-only:start marker");
  assert.equal(ends, 1, "exactly one chain-only:end marker");
  const block = CONSTITUTION.slice(
    CONSTITUTION.indexOf("<!-- chain-only:start -->"),
    CONSTITUTION.indexOf("<!-- chain-only:end -->"),
  );
  for (const m of CHAIN_MARKERS) {
    assert.ok(block.includes(m), `fence must wrap chain section: ${m}`);
  }
});

// --- AC3: SessionStart hook integration ----------------------------------

function runHook(env) {
  const out = execFileSync("node", [path.join(ROOT, "bin", "agent-governance-context.mjs")], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, ...env },
    encoding: "utf-8",
  });
  return JSON.parse(out).hookSpecificOutput.additionalContext;
}

test("AC3: SessionStart hook LITE output strips chain sections, keeps universal", () => {
  const ctx = runHook({ AGC_DEFAULT_SKILL: "lite" });
  for (const m of CHAIN_MARKERS) assert.ok(!ctx.includes(m), `lite hook must omit: ${m}`);
  for (const m of UNIVERSAL_MARKERS) assert.ok(ctx.includes(m), `lite hook must keep: ${m}`);
});

test("AC3: SessionStart hook FULL output retains chain sections", () => {
  const ctx = runHook({ AGC_DEFAULT_SKILL: "full" });
  for (const m of [...CHAIN_MARKERS, ...UNIVERSAL_MARKERS]) {
    assert.ok(ctx.includes(m), `full hook must contain: ${m}`);
  }
});

// --- AC1: measurement script ---------------------------------------------

test("AC1: measure-context-cost script runs headlessly and exits 0", () => {
  // execFileSync throws on non-zero exit — reaching the assert means exit 0.
  const out = execFileSync("node", [path.join(ROOT, "scripts", "measure-context-cost.mjs")], {
    encoding: "utf-8",
  });
  assert.ok(out.length > 0, "script must produce output");
});

test("AC1: measure script prints the spec'd Copy/Strings labels + token table", () => {
  const out = execFileSync("node", [path.join(ROOT, "scripts", "measure-context-cost.mjs")], {
    encoding: "utf-8",
  });
  // Copy/Strings contract (spec Copy/Strings table): verbatim labels.
  assert.ok(out.includes("Always-on context budget"), "must print measure.report.title verbatim");
  assert.ok(
    out.includes("TOTAL always-on (constitution + default skill)"),
    "must print measure.report.total verbatim",
  );
  assert.match(out, /~tokens/, "must print a token column");
});

// --- DR-3: 3-copy regex parity -------------------------------------------

test("DR-3: all three stripChainOnly regex copies are identical", () => {
  // build.ts (TS→dist) and the hook (.mjs) intentionally duplicate the stripper
  // across a module boundary; the measure script holds a third copy. They MUST
  // stay byte-identical or lite/full contexts diverge silently.
  const files = [
    path.join(ROOT, "prompts", "build.ts"),
    path.join(ROOT, "bin", "agent-governance-context.mjs"),
    path.join(ROOT, "scripts", "measure-context-cost.mjs"),
  ];
  const re = /\.replace\(\/<!-- chain-only:start -->\[\\s\\S\]\*\?<!-- chain-only:end -->\\n\?\/g, ""\)/;
  const hits = files.map((f) => {
    const src = fs.readFileSync(f, "utf-8");
    const m = src.match(re);
    assert.ok(m, `chain-only strip regex must be present in ${path.basename(f)}`);
    return m[0];
  });
  assert.equal(hits[0], hits[1], "build.ts and hook regex must match");
  assert.equal(hits[1], hits[2], "hook and measure-script regex must match");
});

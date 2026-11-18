// Coded by @qa-engineer
// E437 (prompt-content-hygiene): content/** and the lite subagent template ship to every adopter, so a
// path that exists only in the agc repo is a dead lead for the dispatched agent. These tests pin the 13
// sites of the spec's E437 table by file + anchor, on the raw source AND on the dispatch bundle (the
// text an agent actually reads: origin pass + rationale pass).
// Spec: specs/e437-prompt-content-hygiene.md (AC-E437-1..3).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { applyTextTransforms } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

const dispatch = (t) => applyTextTransforms(t, { fullDetail: false });
const lineOf = (text, anchor) => {
  const hits = text.split("\n").filter((l) => l.includes(anchor));
  assert.equal(hits.length, 1, `anchor must hit exactly one line: ${anchor}`);
  return hits[0];
};

const INSTALL_DEF = "(`<agc install>` = agc's install directory, not the workspace)";

// [site#, file, anchor identifying the changed line, banned repo-only citation(s)]
const SITES = [
  [1, "const-10-chain-31-tail.md", "read it and self-correct.", ["specs/qa-flow-enforcement-architecture.md", "Full matrix"]],
  [2, "const-08-chain-31-mid.md", "the server write path always stamps millisecond entropy", ["gates/stamp-provenance.ts", "exact predicate lives"]],
  [4, "coord-02-host-dispatch.md", "`ALLOWED_TRANSITIONS` matrix", ["tools/transitions.ts"]],
  [5, "skill-pm.md", "**Source-Credibility Gate**", ["specs/e4-design-source-credibility-gate.md"]],
  [7, "skill-qa-visual.md", "(§3 builder ≠ judge provenance.)", ["research/figma-baselines.md"]],
  [8, "skill-qa-visual.md", "**Multi-value guard:**", ["research/mode-feature-process-retrospective.md", "§四#7"]],
  [9, "skill-doc-writer.md", "doc-writer is NOT in `ALLOWED_TRANSITIONS`", ["tools/transitions.ts"]],
  [10, "skill-coordinator-lite.md", "Lite has no `agent_id` in the routing chain", ["tools/transitions.ts"]],
];

for (const [n, file, anchor, banned] of SITES) {
  test(`AC-E437-1 site ${n}: content/${file} no longer cites ${banned[0]}`, () => {
    const src = read("content", file);
    const l = lineOf(src, anchor);
    for (const b of banned) assert.ok(!l.includes(b), `${file}: changed line still carries "${b}"`);
    // the deletion must leave the bundle line intact, not an orphan fragment
    const d = lineOf(dispatch(src), anchor);
    for (const b of banned) assert.ok(!d.includes(b), `${file}: dispatch bundle still carries "${b}"`);
  });
}

test("AC-E437-1 site 5/6: the Source-Credibility row and design-auditor step still end as complete sentences (the `See …` sentence is gone)", () => {
  const pm = lineOf(read("content", "skill-pm.md"), "**Source-Credibility Gate**");
  assert.ok(pm.includes("then retry the build handoff. |"), "pm row ends at 'retry the build handoff.'");
  const da = read("content", "skill-design-auditor.md");
  assert.ok(!da.includes("specs/e4-design-source-credibility-gate.md"), "design-auditor no longer cites the e4 spec");
});

test("AC-E437-1 site 3: coord-02 prefixes the templates path with <agc install>/ (the coordinator must open those files)", () => {
  const src = read("content", "coord-02-host-dispatch.md");
  assert.ok(src.includes("copy from `<agc install>/templates/claude-code-agents/`"), "prefixed form present");
  assert.ok(!/[^>]\btemplates\/claude-code-agents\//.test(src.replace(/`<agc install>\/templates\/claude-code-agents\/`/g, "")), "no bare templates/ path left");
});

test("AC-E437-1 site 11: lite SOP names validateWatermark under <agc install>/dist/lib with the inline prefix definition", () => {
  const src = read("content", "skill-coordinator-lite.md");
  const l = lineOf(src, "call `validateWatermark`");
  assert.ok(
    l.includes(`call \`validateWatermark\` from \`<agc install>/dist/lib/watermark-check.js\` ${INSTALL_DEF}; relay \`corrected\`.`),
    "prefixed path + inline definition, verbatim (spec Copy/Strings e437.lite-watermark-path)",
  );
  assert.ok(!/from `dist\/lib\//.test(src), "no bare dist/lib path");
});

test("AC-E437-1/2 sites 12-13 + AC-E437-2: lite.md line 9 carries the <agc install> SOP path with its definition and no spec citation; line 7 CRITICAL is untouched", () => {
  const raw = read("templates", "claude-code-agents", "lite.md");
  const lines = raw.replace(/\n$/, "").split("\n");
  assert.ok(
    lines[8].includes(`follow the coordinator-lite SOP from \`<agc install>/content/skill-coordinator-lite.md\` ${INSTALL_DEF}. Do NOT call`),
    "site 12 verbatim (spec Copy/Strings e437.lite-sop-path)",
  );
  assert.ok(!lines[8].includes("specs/d8-lite-recommended-model.md"), "site 13: spec parenthetical removed");
  assert.ok(lines[8].endsWith("while a direct session has no such check."), "site 13: sentence ends 'has no such check.'");
  assert.ok(!/from `content\//.test(lines[8]), "no bare content/ path");
  // line 7 is E442 (ruled keep): byte-identical to its base wording
  assert.equal(
    lines[6],
    "CRITICAL: End every reply with `— @lite (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).",
    "line 7 CRITICAL untouched (E442)",
  );
});

test("AC-E437-1: the three paths an agent must open carry the <agc install>/ prefix", () => {
  assert.ok(read("content", "coord-02-host-dispatch.md").includes("`<agc install>/templates/claude-code-agents/`"));
  assert.ok(read("content", "skill-coordinator-lite.md").includes("`<agc install>/dist/lib/watermark-check.js`"));
  assert.ok(read("templates", "claude-code-agents", "lite.md").includes("`<agc install>/content/skill-coordinator-lite.md`"));
});

test("AC-E437-3: skill-qa-visual Step C multi-value guard FAIL note is exactly the repo-path-free text", () => {
  const src = read("content", "skill-qa-visual.md");
  assert.ok(src.includes('FAIL it with note: "context-dependent property requires per-context baseline". Per Constitution §3.2'), "note text exact, quote closes right after 'baseline'");
  for (const bundle of [src, dispatch(src)]) {
    assert.ok(!bundle.includes("research/"), "no research/ citation anywhere in skill-qa-visual after E437+E438+E439 sites");
    assert.ok(!bundle.includes("§四#7"), "no retrospective section cite");
  }
});

test("AC-E437-1: a real buildPromptForRole bundle (qa-visual lazy skill and lite coordinator) carries none of the dropped citations", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e437-"));
  try {
    setActiveStorage(new FileHandoffStorage());
    await new FileHandoffStorage().writeState(ws, "e437-fixture", "In_Progress", [], []);
    for (const skill of ["skill-coordinator-lite.md", "skill-doc-writer.md", "skill-pm.md", "skill-qa-visual.md"]) {
      const text = buildPromptForRole(skill, "e437", ws, false).messages[0].content.text;
      for (const b of [
        "specs/qa-flow-enforcement-architecture.md", "gates/stamp-provenance.ts", "tools/transitions.ts",
        "specs/e4-design-source-credibility-gate.md", "research/figma-baselines.md",
        "research/mode-feature-process-retrospective.md", "specs/d8-lite-recommended-model.md",
      ]) assert.ok(!text.includes(b), `${skill} bundle must not cite ${b}`);
    }
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

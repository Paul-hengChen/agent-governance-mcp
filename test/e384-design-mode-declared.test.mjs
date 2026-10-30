// Coded by @qa-engineer
// Tests (T-E384-02) for specs/e384-design-mode-and-handoff-target.md AC-E384-1..3, 5, 6: the Mode a design file
// DECLARES decides the mode; explanatory prose on the same line (`code (not from Figma)`) must not arm a Figma-only
// gate. Every case asserts through BOTH exported entry points over the unexported parseDesignMode:
// checkSourceCredibility (mode + ok) and hasDesignModeRequiringVisual (mode + required). The design file always
// carries an audited `figma` Source row WITHOUT `full-page-composite`, so a wrongly-armed figma mode shows up as
// ok:false (the SOURCE_CREDIBILITY_UNVERIFIED misfire E384 reports). Fixtures: temp workspaces under os.tmpdir().

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { checkSourceCredibility, hasDesignModeRequiringVisual } from "../dist/gates/visual.js";

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const BAD_ROW = [
  "| medium | pointer | fetched | status | credibility | reason |",
  "|--------|---------|---------|--------|-------------|--------|",
  "| figma | 12:345 | yes | audited | component-variant | — |",
].join("\n");

/** Design file = `modeBlock` + a Source table whose audited figma row is NOT full-page-composite. */
function ws(modeBlock) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e384-mode-"));
  made.push(dir);
  fs.mkdirSync(path.join(dir, "design"), { recursive: true });
  fs.writeFileSync(path.join(dir, "design", "feat.md"), `# design/feat\n\n${modeBlock}\n\n## Source\n\n${BAD_ROW}\n`, "utf-8");
  return dir;
}

/** Both entry points must agree on the mode; returns it plus the derived verdicts. */
function both(modeBlock) {
  const dir = ws(modeBlock);
  const c = checkSourceCredibility(dir, "feat");
  const a = hasDesignModeRequiringVisual(dir, "feat");
  assert.equal(c.mode, a.mode, "the two entry points disagree on the mode");
  return { mode: c.mode, ok: c.ok, required: a.required };
}

// Mirrors the credibility gate's fetch-based modes (a stable product contract; pdf/image/paper are not fetched).
const FETCH_MODES = ["figma", "sketch", "xd", "penpot"];

const expectNull = (block) => {
  // WHY: an undeclared mode leaves both gates dormant (the fail-closed misfire is gone).
  const r = both(block);
  assert.equal(r.mode, null, block);
  assert.equal(r.ok, true, `${block}: credibility must not fire`);
  assert.equal(r.required, false, `${block}: visual gates must not arm`);
};
const expectMode = (block, mode) => {
  const r = both(block);
  assert.equal(r.mode, mode, block);
  // BAD_ROW fires the credibility gate for every fetch-based mode only.
  assert.equal(r.ok, !FETCH_MODES.includes(mode), block);
  assert.equal(r.required, mode !== "no-design", block);
};

test("AC-E384-1 declared `code` with a Figma explanation is undeclared (bullet form)", () => {
  expectNull("- **Mode** — code (not from Figma)");
});

test("AC-E384-1 declared `code` with a Figma explanation is undeclared (inline form)", () => {
  expectNull("mode: code — screenshots, not Figma");
});

test("AC-E384-2 H2 form `## Mode` + value line `code (no Figma export)` is undeclared", () => {
  expectNull("## Mode\n\ncode (no Figma export)");
});

test("AC-E384-3 wrappers and case: known value resolves whole", () => {
  expectMode("mode: `figma`", "figma");
  expectMode("- **Mode** — **sketch**", "sketch");
  expectMode("MODE: SKETCH", "sketch");
  expectMode("mode: (xd)", "xd");
  expectMode('mode: "pdf"', "pdf");
  expectMode("mode: 'penpot'", "penpot");
  expectMode("mode: [image]", "image");
  expectMode("mode: _paper_", "paper");
  expectMode("mode: no-design", "no-design");
});

test("AC-E384-3 hyphen prefix of a whole known mode resolves to that mode (no-design first)", () => {
  expectMode("mode: figma-export", "figma");
  expectMode("mode: no-design-v2", "no-design");
});

test("AC-E384-3 tokens not starting with a whole known mode are undeclared", () => {
  for (const v of ["code", "code-figma", "freehand", "figmaexport"]) expectNull(`mode: ${v}`);
});

test("AC-E384-3 an unknown declared value is never scanned past, whatever the prose names", () => {
  expectNull("mode: freehand (figma, sketch and xd all rejected)");
});

test("AC-E384-5 no declared token (line starts with a non-letter) -> pre-E384 earliest-known-mode scan", () => {
  expectMode("mode: <figma> (see board)", "figma");
});

test("AC-E384-6 unknown inline value yields nothing and the H2 candidate is still consulted", () => {
  expectMode("## Mode\n\nfigma\n\n- mode: dark", "figma");
});

test("security smoke: empty and oversized declared values stay undeclared, never throw", () => {
  expectNull("mode: —");
  expectNull(`mode: ${"x".repeat(100_000)}`);
});

// Coded by @qa-engineer
// Tests for specs/e259-comment-scan-languages.md AC27 (docs sync) and AC28
// (the scan's own modules pass the scan's own limits). AC29 and the lane-diff
// agc check output are task evidence, not resident tests: they depend on the
// lane's base commit.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { ROOT } from "./e259-lib.mjs";
import { analyzeText, commentLimits } from "../dist/tools/comment-scan.js";
import { scannedExtensions } from "../dist/tools/comment-langs.js";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const installPara = read("docs/install.md").split("\n").find((l) => l.includes("comment-length scan"));
const configRow = read("docs/config.md").split("\n").find((l) => l.includes("Advisory comment-length scan"));

test("AC27: docs/install.md's scan paragraph and docs/config.md's scan row state the contract", () => {
  assert.ok(installPara && configRow, "paragraph and row exist");
  const needles = [
    "agc check — comments", "not a clean result", "docstring", "heredoc", "%q{}", "backslash-newline", "digit separators",
    "f-string", "interpolation", "NumPy", "rustdoc", "Swift regex literals", "blank lines inside a docstring",
    "`@exception`", "`\\param`", "`<param>`", "`- Parameters`", "`Args:`", "`:param`", "`=begin`",
  ];
  for (const [id, text] of [["install.md", installPara], ["config.md", configRow]]) {
    const named = new Set(text.match(/\.[a-z]+(?![a-z])/g));
    for (const e of scannedExtensions()) assert.ok(named.has(e), `${id} lists ${e}`);
    for (const n of needles) assert.ok(text.includes(n), `${id} mentions ${n}`);
    assert.match(text, /every other file|Every other file/, `${id} says other files are skipped`);
  }
});

test("AC28: every tools/comment-*.ts module passes the scan's own limits, strictly", () => {
  // Contract: the ratio limit applies even below the 50-line exemption, and no block exceeds 7 counted lines.
  const mods = fs.readdirSync(path.join(ROOT, "tools")).filter((f) => /^comment-.*\.ts$/.test(f));
  assert.ok(mods.length >= 10, `expected the scan modules, got ${mods.join(",")}`);
  assert.ok(mods.includes("comment-scan.ts") && mods.includes("comment-lex.ts"));
  for (const f of mods) {
    assert.ok(fs.existsSync(path.join(ROOT, "dist", "tools", f.replace(/\.ts$/, ".js"))), `${f} is built`);
    const a = analyzeText(read(`tools/${f}`));
    const max = Math.max(0, ...a.blocks.map((b) => b.counted));
    assert.ok(max <= commentLimits.maxBlockLines, `${f}: longest block ${max}`);
    const pct = (100 * a.commentLines) / Math.max(1, a.nonBlank);
    assert.ok(pct <= commentLimits.maxRatioPercent, `${f}: comment ratio ${pct.toFixed(1)}%`);
  }
});

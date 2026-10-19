// Coded by @qa-engineer
// Tests (T-E290-02) for specs/e290-lane-protocol-generic.md AC-E290-2, 3, 5, 7, 8, 9.
// WHY: docs/lane-protocol.md is read by every adopter's lanes (E289 points render at the agc install), so it must
// hold only rules true in any repo; this repo's own facts live in docs/lane-protocol-addendum.md, selected by the
// `laneProtocolAddendum` config key. These tests pin that split: the section skeleton other tests rely on stays,
// repo-only strings stay out of the generic file and in the addendum, this repo's render uses the two-layer
// pointer, and neither file's prose leaks into the dispatch prompt (the prompt points at the files, never copies).
// Resident-test hygiene: no fixed sha, no real specs/fanout-*.md; the render uses the frozen e177a fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseManifest, renderPrompt, PROMPT_TEMPLATE_3B } from "../dist/tools/fanout-manifest.js";
import { loadConfig, getConfigError } from "../dist/tools/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const GENERIC = read("docs/lane-protocol.md");
const ADDENDUM = read("docs/lane-protocol-addendum.md");

test("AC-E290-2: generic file keeps exactly the eight base ## headings, §7 last", () => {
  const heads = GENERIC.split("\n").filter((l) => l.startsWith("## "));
  assert.deepEqual(heads, [
    "## 1. 開工",
    "## 2. 檔案邊界",
    "## 3. 執行與驗證",
    "## 4. 新發現",
    "## 5. 信箱（lane ↔ 整合者）",
    "## 6. 收工回報格式",
    "## Lane report: <lane> / <票>",
    "## 7. 中途修 base（整合者把目標分支 merge 進 lane）",
  ]);
});

test("AC-E290-3: repo-only strings are absent from the generic file and present in the addendum", () => {
  const out = [
    "node bin/agc-init.mjs", "npm run build", "rm node_modules", "dist/", "tasks-index-receipt.json",
    "check-md-tables", "test/e130-lane-default.test.mjs", "NEW-TICKETS.md", "node scripts/fanout.mjs",
    "註解 proof", "compose-golden", "context-budget", "content/**", "test/",
  ];
  for (const s of out) assert.ok(!GENERIC.includes(s), `generic file must not contain: ${s}`);
  const inn = [
    "node bin/agc-init.mjs", "npm run build", "rm node_modules", "dist/", ".current/tasks-index-receipt.json",
    "check-md-tables", "test/e130-lane-default.test.mjs", "NEW-TICKETS.md", "node scripts/fanout.mjs check --cut",
    "註解 proof", "每一行改動都是註解", "content/**", "test/fixtures/compose-golden/**", "test/context-budget.test.mjs",
  ];
  for (const s of inn) assert.ok(ADDENDUM.includes(s), `addendum must contain: ${s}`);
});

test("AC-E290-5: this repo's config names the addendum, parses clean, schema_version stays 2", () => {
  assert.equal(loadConfig(ROOT).laneProtocolAddendum, "docs/lane-protocol-addendum.md");
  assert.equal(getConfigError(ROOT), null);
  const raw = JSON.parse(read(".current/.config.json"));
  assert.equal(raw.schema_version, 2);
  assert.ok(fs.existsSync(path.join(ROOT, "docs/lane-protocol-addendum.md")), "key target exists (D6)");
});

const TWO_LAYER =
  "先完整讀 docs/lane-protocol.md（agc 通用規則，包括信箱與回報格式）和 docs/lane-protocol-addendum.md（本 repo 的補充規則），再讀 R1 + R2。";
const UNSET_POINTER = "先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），";

function renderHere() {
  const m = parseManifest(read("test/fixtures/e177a/fanout-wave7.md"));
  const r = renderPrompt(m, "e177a", {
    summary: "S", reading: ["R1", "R2"], mailboxRoot: "/m", primary: ROOT, installRoot: ROOT,
  });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.prompt;
}

test("AC-E290-7: this repo's render carries the two-layer pointer, not the key-unset one", () => {
  const prompt = renderHere();
  assert.ok(prompt.split("\n").includes(TWO_LAYER), "two-layer pointer line present");
  assert.ok(!prompt.includes(UNSET_POINTER), "key-unset pointer absent");
});

const longLines = (text) => text.split("\n").map((l) => l.trim()).filter((l) => l.length > 20);

test("AC-E290-8: no long line of either lane-protocol file is copied into the prompt", () => {
  const prompt = renderHere();
  for (const [name, text] of [["generic", GENERIC], ["addendum", ADDENDUM]]) {
    for (const l of longLines(text)) assert.ok(!prompt.includes(l), `${name} line leaked into prompt: ${l}`);
  }
});

test("AC-E290-9: no trimmed line of either file equals a PROMPT_TEMPLATE_3B line", () => {
  const tpl = new Set(PROMPT_TEMPLATE_3B.split("\n").map((l) => l.trim()).filter((l) => l !== ""));
  for (const [name, text] of [["generic", GENERIC], ["addendum", ADDENDUM]]) {
    for (const l of text.split("\n").map((x) => x.trim())) {
      assert.ok(!tpl.has(l), `${name} line equals a template line: ${l}`);
    }
  }
});

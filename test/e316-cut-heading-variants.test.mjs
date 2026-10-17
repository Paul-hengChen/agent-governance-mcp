// Coded by @qa-engineer
// Tests (T-E316-01) for specs/e283-fanout-handoff-and-ref-check.md AC-E316-1..4: a Markdown renderer shows
// `##<TAB>Cut`, 1-3 leading spaces and lowercase `cut` as a Cut heading, so every such line must count toward
// CUT_SECTION_DUPLICATE; otherwise the table under a variant is never read and a touches cell outside the lane
// could exit 0. All fixtures are in-test manifests / specs under os.tmpdir(); nothing reads real specs/fanout-*.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e316-qa-"));
let seq = 0;

function cli(args) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function tmpFile(name, text) {
  const p = path.join(TMP, `${seq++}-${name}`);
  fs.writeFileSync(p, text);
  return p;
}

const MANIFEST = tmpFile(
  "m.md",
  [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "mailbox: ../lanes/_mailbox",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    "| a | E1 | feat/a | ../lanes/a | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "",
    "## Dispatch pins",
    "- a：`sr-engineer=opus`。",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ].join("\n"),
);

const CUT = [
  "## Cut",
  "",
  "| id | desc | depends_on | est. files | touches | design-link |",
  "|---|---|---|---|---|---|",
  "| T-X-01 | x | none | 1 | `tools/a.ts` | — |",
  "",
].join("\n");
const spec = (extra) => `# x\n\n${CUT}\n${extra}\n`;
const runCut = (text) => cli(["check", "--cut", MANIFEST, "a", tmpFile("spec.md", text)]);
const errCodes = (r) => r.stderr.split("\n").filter((l) => l.startsWith("fanout: error:")).map((l) => l.split(":")[2].trim());

test("baseline: a single valid ## Cut passes check --cut", () => {
  // WHY: every other case is judged against this; without it a red baseline would fake a pass of "equals base".
  const r = runCut(spec(""));
  assert.equal(r.status, 0, r.stderr);
});

test("AC-E316-1 variants are duplicates", () => {
  // WHY: each of these renders as a Cut heading, so a second one shadows/duplicates the checked table.
  const variants = ["##\tCut", " ## Cut", "   ## Cut", "## cut", "## CUT", "## Cut ##"];
  for (const v of variants) {
    const r = runCut(spec(`${v}\n\nbody`));
    assert.equal(r.status, 2, `variant ${JSON.stringify(v)} must exit 2: ${r.stderr}`);
    assert.ok(r.stderr.includes("fanout: error: CUT_SECTION_DUPLICATE:"), `variant ${JSON.stringify(v)}: ${r.stderr}`);
    const line = r.stderr.split("\n").find((l) => l.includes("CUT_SECTION_DUPLICATE"));
    // the valid heading is on line 3, the variant after the table; both line numbers are named
    const nums = line.match(/\d+/g) ?? [];
    assert.ok(nums.includes("3"), `names the valid heading line 3: ${line}`);
    assert.ok(nums.length >= 2, `names both line numbers: ${line}`);
  }
});

test("AC-E316-1 variant placed BEFORE the valid Cut is also a duplicate", () => {
  // WHY: the order must not matter; the shadowing risk exists either way.
  const r = runCut(`# x\n\n## cut\n\nnothing\n\n${CUT}`);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes("CUT_SECTION_DUPLICATE"));
});

test("AC-E316-2 non-variants unchanged", () => {
  // WHY: 4-space indent is a code block, ### is another level, a longer name and `##Cut` are not Cut headings.
  const base = runCut(spec(""));
  for (const v of ["    ## Cut", "### Cut", "## Cut Decisions", "##Cut"]) {
    // placed before the real Cut section so a non-ending heading line cannot land inside the Cut table
    const r = runCut(`# x\n\n${v}\n\nbody\n\n${CUT}`);
    assert.equal(r.status, base.status, `${JSON.stringify(v)}: ${r.stderr}`);
    assert.equal(r.stdout, base.stdout);
    assert.deepEqual(errCodes(r), errCodes(base));
  }
});

test("AC-E316-3 lone variant is CUT_SECTION_ABSENT as before", () => {
  // WHY: only a `## Cut` section is read; a lone variant must not be silently accepted nor reported as duplicate.
  const r = runCut(`# x\n\n## cut\n\n${CUT.split("\n").slice(2).join("\n")}\n`);
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r), ["CUT_SECTION_ABSENT"]);
});

test("AC-E316-4 parseCutSection doc comment names the setext and homoglyph limit", () => {
  // WHY: documented limits are the contract for what the check does not catch.
  const src = fs.readFileSync(path.join(ROOT, "tools", "fanout-manifest.ts"), "utf8");
  const at = src.indexOf("function parseCutSection");
  assert.ok(at > 0, "parseCutSection found");
  const comment = src.slice(src.lastIndexOf("/**", at), at);
  assert.ok(/setext/i.test(comment), "comment mentions setext");
  assert.ok(/homoglyph/i.test(comment), "comment mentions homoglyph");
});

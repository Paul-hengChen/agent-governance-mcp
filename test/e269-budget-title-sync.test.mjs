// Coded by @qa-engineer
// E269 / E274: keeps a cap number in a test TITLE equal to the number the test ASSERTS.
// WHY: zero-headroom caps are re-measured and bumped on nearly every content wave, and the
// title is a second place to forget (fixed by hand three times before this check existed).
// Scope limit: only titles carrying a literal number after "≤" or "<=" are checked; prose such as
// "~1830 lighter" is not. Spec: specs/e269-rule-text-budget.md (AC6, E274 check decision).
// E269_TITLE_SYNC_TARGET overrides the file under check (negative controls run on a copy
// outside the worktree).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = process.env.E269_TITLE_SYNC_TARGET ?? path.join(ROOT, "test", "context-budget.test.mjs");

// Splits source into top-level test() blocks: a block runs from a line starting `test(` (or
// indented `test(` inside a loop) to the line before the next one.
export function splitTestBlocks(src) {
  const lines = src.split("\n");
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (/^\s*test\(/.test(line)) {
      if (cur) blocks.push(cur);
      cur = { title: line, body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) blocks.push(cur);
  return blocks.map((b) => ({ title: b.title, body: b.body.join("\n") }));
}

export function titleCapMismatches(src) {
  const bad = [];
  let checked = 0;
  for (const { title, body } of splitTestBlocks(src)) {
    const m = title.match(/(?:≤|<=)\s*(\d+)/);
    if (!m) continue;
    checked++;
    const titleN = m[1];
    // An asserted cap is a comparison `x <= N` directly followed by "," (the assert message
    // follows); numbers inside message strings never end in a comma, so they are not counted.
    const asserted = [...body.matchAll(/<=\s*(\d+)\s*,/g)].map((x) => x[1]);
    if (!asserted.includes(titleN)) {
      bad.push(`title says ${titleN} but body asserts [${asserted.join(", ") || "none"}]: ${title.trim()}`);
    }
  }
  return { bad, checked };
}

test("E274: every context-budget test title's ≤ N equals an asserted <= N in that test", () => {
  const { bad, checked } = titleCapMismatches(fs.readFileSync(TARGET, "utf-8"));
  assert.ok(checked >= 6, `expected to check the cap-bearing titles (found ${checked}); the parser may have drifted`);
  assert.deepEqual(bad, [], `title/assert cap mismatch:\n${bad.join("\n")}`);
});

test("E274: the checker itself flags a mismatched title and accepts a matching one", () => {
  const good = 'test("x meets ≤ 10 cap", () => {\n  assert.ok(a <= 10, `m`);\n});\n';
  const wrong = 'test("x meets ≤ 11 cap", () => {\n  assert.ok(a <= 10, `m`);\n});\n';
  assert.equal(titleCapMismatches(good).bad.length, 0);
  assert.equal(titleCapMismatches(wrong).bad.length, 1);
});

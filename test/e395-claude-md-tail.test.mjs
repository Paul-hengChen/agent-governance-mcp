// Coded by @qa-engineer
// E395 (specs/e395-claude-md-template-tail): CLAUDE.md carries no stale counts, lists every tools/
// module in the Layout block, and points the pass-count comment at the most recent release. Reads
// only CLAUDE.md and the tools/ directory listing.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf-8");

const count = (hay, needle) => hay.split(needle).length - 1;

const NEW_ROWS = [
  "tools/comment-*.ts",
  "tools/dispatch-log.ts",
  "tools/evidence-lookup.ts",
  "tools/feature-rollup.ts",
  "tools/hygiene-scan.ts",
  "tools/join-precondition.ts",
  "tools/lane-migrate.ts",
  "tools/lane-registry.ts",
  "tools/lane-ticket-allocation.ts",
  "tools/merge-invariants.ts",
  "tools/tasks-lane-migrate.ts",
];

function layoutLines() {
  const m = CLAUDE.match(/## Layout\s+```\n([\s\S]*?)\n```/);
  assert.ok(m, "CLAUDE.md must carry a Layout code block");
  return m[1].split("\n");
}

test("AC-E395-1: CLAUDE.md gives no test-file, gate-definition or registry-entry count", () => {
  // Why: those numbers go stale with the next test file or gate.
  assert.equal(CLAUDE.match(/\b\d+ test files\b/g), null);
  assert.equal(CLAUDE.match(/\b\d+ gate definitions\b/g), null);
  assert.equal(CLAUDE.match(/\(\d+ entries\)/g), null);
});

test("AC-E395-2: the four rewritten sites match their Copy / Strings text verbatim", () => {
  const sites = [
    "metadata is declared once per gate in `gates/registry.ts`.",
    "gates/registry.ts         GATE_REGISTRY — one definition per gate (code, owner, exemptions)",
    "test/                     node --test suites (test/*.test.mjs); test/eval/ = behavioural eval harness",
    "`test/` holds the `node --test` suites covering guards, transitions and round caps, every",
  ];
  for (const s of sites) assert.equal(count(CLAUDE, s), 1, `expected exactly one: ${s}`);
});

test("AC-E395-4: the 11 new Layout rows appear once, at column 0, contiguous and in order between tools/fanout-*.ts and gates/registry.ts", () => {
  const lines = layoutLines();
  const fan = lines.findIndex((l) => l.startsWith("tools/fanout-*.ts"));
  const gate = lines.findIndex((l) => l.startsWith("gates/registry.ts"));
  assert.ok(fan >= 0 && gate > fan, "anchors present and ordered");
  const block = lines.slice(fan + 1, gate);
  assert.equal(block.length, NEW_ROWS.length, "block between the anchors holds exactly the new rows");
  NEW_ROWS.forEach((name, i) => {
    assert.ok(block[i].startsWith(name + " "), `row ${i} starts with ${name}`);
    assert.equal(lines.filter((l) => l.startsWith(name + " ")).length, 1, `${name} appears once`);
  });
});

test("AC-E395-5: every tools/*.ts module is covered by a Layout row or a glob row", () => {
  const rows = layoutLines().map((l) => l.split(/\s+/)[0]);
  const globs = rows.filter((r) => /^tools\/[a-z]+-\*\.ts$/.test(r));
  assert.deepEqual([...globs].sort(), ["tools/comment-*.ts", "tools/fanout-*.ts"], "only the two sanctioned globs");
  const prefixes = globs.map((g) => g.slice("tools/".length).replace("*.ts", ""));
  const files = fs.readdirSync(path.join(ROOT, "tools")).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length > 0);
  const uncovered = files.filter(
    (f) => !rows.includes(`tools/${f}`) && !prefixes.some((p) => f.startsWith(p)),
  );
  assert.deepEqual(uncovered, [], "no tools/ module may be missing from the Layout block");
});

test("AC-E395-6: the npm test comment names the most recent release by date, not 'the latest'", () => {
  assert.equal(count(CLAUDE, "the latest qa_reports"), 0);
  assert.equal(count(CLAUDE, "most recent release"), 1);
  assert.ok(CLAUDE.includes("by release date, not folder name)"));
  const testing = CLAUDE.split("## Testing changes")[1] ?? "";
  assert.equal(count(testing, "suite-result:"), 1, "suite-result: occurs once in the Testing changes section");
});

// E435 (specs/e435-remove-old-path-architecture.md, Copy "Execution Profile sentence" + T-37 row):
// the single judge path leaves no bare qa round cap, and code-reviewer is the judge whose
// in-context run the Execution Profile forbids; qa-engineer is forbidden from writing the
// tests in the builder's context. The pipeline stays 17 steps (OQ (b)).
const E435_EXEC_PROFILE =
  "`code-reviewer` and `qa-engineer` MUST be dispatched via `Task` (agc's shorthand for Claude Code's `Agent` subagent tool): code-reviewer judging in-context, or qa-engineer writing the tests in the builder's context, voids Constitution §3 builder != judge, and the downgrade is invisible to every gate in `GATE_REGISTRY`.";
const execProfileBullet = (s) => s.split("\n").find((l) => l.startsWith("- Subagent dispatch:"));

test("AC-E395-7 (E435): CLAUDE.md and the claude.md adapter template carry the same Execution Profile sentence, naming code-reviewer as the in-context judge", () => {
  const tpl = fs.readFileSync(path.join(ROOT, "templates", "agent-adapters", "claude.md"), "utf-8");
  const mine = execProfileBullet(CLAUDE);
  const theirs = execProfileBullet(tpl);
  assert.ok(mine && theirs, "both files carry the Subagent dispatch bullet");
  assert.equal(mine, theirs, "CLAUDE.md and templates/agent-adapters/claude.md carry the identical bullet");
  assert.equal(count(mine, E435_EXEC_PROFILE), 1, "the bullet carries the Copy sentence verbatim");
  assert.ok(!mine.includes("`Agent` subagent tool): judging in-context voids"), "the old unqualified judge clause is gone");
  assert.ok(mine.startsWith("- Subagent dispatch: invoking `/teamwork` (or any agc role prompt) IS the user's standing request"), "rest of the bullet unchanged (head)");
  assert.ok(mine.endsWith("may still run in-context under budget pressure — no independence property is at stake there."), "rest of the bullet unchanged (tail)");
});

test("AC-E395-8 (E435): the tools/transitions.ts Layout row names no qa ROUND_CAP; the pipeline stays 17-step", () => {
  const row = layoutLines().filter((l) => l.startsWith("tools/transitions.ts "));
  assert.equal(row.length, 1, "one tools/transitions.ts row");
  assert.equal(row[0], "tools/transitions.ts      ALLOWED_TRANSITIONS + round caps (REVIEW_ROUND_CAP=4, VISUAL_ROUND_CAP=6, SR_RETURN_CAP=2)");
  assert.equal(CLAUDE.match(/(?<![A-Z_])ROUND_CAP=/g), null, "no bare ROUND_CAP= anywhere in CLAUDE.md");
  assert.equal(count(CLAUDE, "the 17-step"), 2, "both pipeline mentions still say 17-step");
  assert.equal(CLAUDE.match(/\b1[0-9]-step\b/g).length, 2, "no other step count is named");
});

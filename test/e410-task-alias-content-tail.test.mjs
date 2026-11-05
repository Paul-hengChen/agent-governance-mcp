// Coded by @qa-engineer
// E410: the `Task(...)` alias is defined once, in coord-02 (host:claude-code). The constitution, lite
// and integrator skills load on every host and must not use it undefined. WHY: an agent on a host
// without Claude Code's subagent tool would look for an undefined `Task` tool. Claude Code meaning must
// not move (coord-* untouched). Resident hygiene: reads content/** only; no fixed-sha diff, no specs/fanout-*.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const read = (f) => fs.readFileSync(path.join(CONTENT, f), "utf-8");
const files = fs.readdirSync(CONTENT).filter((f) => /^(const|skill)-.*\.md$/.test(f)).sort();

const SKIP_STARTS = ["TaskStop", "Task-Size", "Task ordering", "Task Format", "Task <id>", "Task list", "Tasks in", "Tasks with", "Tasks →"];
// Occurrence-level alias rule (case-sensitive). Lines containing tasks.md are NOT excluded wholesale.
function aliasOccurrences(line) {
  const hits = [];
  let i = -1;
  while ((i = line.indexOf("Task", i + 1)) !== -1) {
    const rest = line.slice(i);
    if (SKIP_STARTS.some((s) => rest.startsWith(s))) continue;
    if (line.slice(0, i).endsWith("Completed-")) continue;
    hits.push(i);
  }
  return hits;
}

test("AC1: alias rule finds 0 alias occurrences over content/const-*.md + content/skill-*.md", () => {
  assert.ok(files.length > 15, "glob must actually match files");
  const bad = [];
  for (const f of files) read(f).split("\n").forEach((l, n) => { if (aliasOccurrences(l).length) bad.push(`${f}:${n + 1}`); });
  assert.deepEqual(bad, []);
});

test("AC1 control: the rule is occurrence-level (flags tasks.md lines; skips the real non-alias uses)", () => {
  assert.equal(aliasOccurrences("no `tasks.md`, dispatch PM (Task) to write").length, 1);
  assert.equal(aliasOccurrences("desync `tasks.md` via `Task` fan-out").length, 1);
  assert.equal(aliasOccurrences("`TaskStop` and Task-Size and Non-QA Completed-Tasks Gate").length, 0);
  assert.equal(aliasOccurrences("Task-spawned (`Task(x)`)").length, 2);
});

// [file, 1-based line, old span, new span]
const ROWS = [
  ["const-01-core-head.md", 33, "Task-spawned with `model:` pinned by the parent (`Task(subagent_type=…)`)", "Subagent-dispatched with `model:` pinned by the parent"],
  ["const-05-core-standards.md", 9, "Task-dispatched with a silent brief", "dispatched with a silent brief"],
  ["const-08-chain-31-mid.md", 2, "under Task-subagent dispatch — where", "under subagent dispatch — where"],
  ["const-08-chain-31-mid.md", 5, "under Task-subagent dispatch it is", "under subagent dispatch it is"],
  ["const-12-chain-r10-s4.md", 2, "Background/parallel `Task` fan-out", "Background/parallel subagents"],
  ["skill-coordinator-lite.md", 43, "After `Task(subagent_type=…)`,", "After a subagent dispatch,"],
  ["skill-coordinator-lite.md", 49, "ONLY after `Task(…)`;", "ONLY after subagents;"],
  ["skill-integrator.md", 40, "Dispatch code-reviewer / qa-engineer (Task) for", "Dispatch code-reviewer / qa-engineer for"],
  ["skill-integrator.md", 41, "dispatch PM (Task) to write", "dispatch PM to write"],
  ["skill-integrator.md", 78, "**Dispatch PM via Task**", "**Subagent-dispatch PM**"],
  ["skill-integrator.md", 81, "re-dispatch PM via Task to revise", "re-dispatch PM to revise"],
  ["skill-integrator.md", 177, "dispatch `code-reviewer` via Task on", "subagent-dispatch `code-reviewer` on"],
  ["skill-integrator.md", 181, "dispatch `qa-engineer` via Task to", "subagent-dispatch `qa-engineer` to"],
  ["skill-integrator.md", 248, "is not Task-spawned,", "is not a subagent,"],
  ["skill-pm.md", 111, "Task-subagent dispatch: if your turn ends", "Subagent dispatch: if your turn ends"],
];

test("AC2: each site carries its new span, the old span is gone, the line has no `Task` alias", () => {
  for (const [f, n, oldS, newS] of ROWS) {
    const line = read(f).split("\n")[n - 1];
    assert.ok(line.includes(newS), `${f}:${n} must contain: ${newS}`);
    assert.ok(!line.includes(oldS), `${f}:${n} must not contain: ${oldS}`);
    assert.equal(aliasOccurrences(line).length, 0, `${f}:${n} still has an alias`);
  }
});

test("AC2: each edited file keeps its line count", () => {
  const counts = { "const-01-core-head.md": 37, "const-05-core-standards.md": 23, "const-08-chain-31-mid.md": 13, "const-12-chain-r10-s4.md": 22, "skill-coordinator-lite.md": 53, "skill-integrator.md": 249, "skill-pm.md": 120 };
  for (const [f, c] of Object.entries(counts)) assert.equal(read(f).split("\n").length, c, f);
});

test("AC3: no span grows (per-row new <= old; WHY: budget caps are not raised)", () => {
  const pm109Old = "Consolidate them into ONE upfront `AskUserQuestion` call covering ≤ 4 questions (split into 2 batches if more). Record every answer inline in the spec's **Dependencies / Prerequisites** section.";
  const pm109New = "Batch them upfront, inline, numbered, ≤ 4 (2 batches if more), each with a recommended answer; end the turn (as a subagent: via the coordinator). Answers go in **Dependencies / Prerequisites**.";
  const all = [...ROWS.map(([, , o, n]) => [o, n]), [pm109Old, pm109New]];
  assert.equal(all.length, 16);
  let sum = 0;
  for (const [o, n] of all) { assert.ok(n.length <= o.length, `grew: ${n}`); sum += n.length - o.length; }
  assert.ok(sum <= 0);
});

test("AC5: coord-02 keeps its alias definition exactly once; const-01 table rows and const-05 (c) keep their shape", () => {
  const ALIAS = "`Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`";
  const coord = fs.readdirSync(CONTENT).filter((f) => /^coord-.*\.md$/.test(f));
  const total = coord.reduce((a, f) => a + read(f).split(ALIAS).length - 1, 0);
  assert.equal(total, 1);
  assert.equal(read("coord-02-host-dispatch.md").split(ALIAS).length - 1, 1);
  const c01 = read("const-01-core-head.md").split("\n");
  const sep = c01.findIndex((l) => l.startsWith("  | condition | format |")) + 1;
  const rows = [];
  for (let i = sep + 1; /^\s*\|/.test(c01[i]); i++) rows.push(c01[i]);
  assert.equal(rows.length, 2, "watermark table keeps two data rows");
  assert.ok(rows[0].startsWith("  | Subagent-dispatched with `model:` pinned by the parent |"));
  assert.ok(rows[0].includes("`— @<role> (<tier>)`"));
  assert.match(read("const-05-core-standards.md").split("\n")[8], /\(c\) otherwise — dispatched with a silent brief/);
});

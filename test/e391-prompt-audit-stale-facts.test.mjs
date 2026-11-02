// E391 — prompt-audit stale facts. Pins AC-G2-02..AC-G2-26: the removed stale
// strings stay gone and the new pointers resolve. Reads only content/** and
// CLAUDE.md (no fanout manifest, no fixed base sha, no line numbers), so it
// stays valid as the files grow. Why: these facts are prose that silently rots;
// a pointer that names a label/heading must keep resolving to a real target.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const has = (text, s) => text.includes(s);
const count = (text, s) => text.split(s).length - 1;

const C = (f) => read(`content/${f}`);
const claude = read("CLAUDE.md");

function section(text, heading) {
  const start = text.indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `CLAUDE.md section missing: ${heading}`);
  const rest = text.slice(start + 1);
  const next = rest.indexOf("\n## ", 3);
  return next < 0 ? rest : rest.slice(0, next);
}

test("AC-G2-02: release-engineer names GATE_REGISTRY, no gate count", () => {
  const t = C("skill-release-engineer.md");
  assert.equal(count(t, "33 gate definitions"), 0);
  assert.equal(count(t, "`gates/registry.ts` (`GATE_REGISTRY`)"), 1);
});

test("AC-G2-04: rationale names fix_try/read/hop caps, no numbers", () => {
  const t = C("constitution-rationale.md");
  assert.doesNotMatch(t, /max 10 role transitions|max 2 consecutive auto-fix|max 3 reads per target/);
  assert.equal(count(t, "the `fix_try`, `read`, and `hop` caps"), 1);
});

test("AC-G2-05: design-auditor hard limits point at caps; const-01 Limits rows still exist", () => {
  const t = C("skill-design-auditor.md");
  assert.doesNotMatch(t, /max 3 extraction attempts|max 5 files read/);
  assert.equal(count(t, "bounded by the `fix_try` cap and file reads per surface by the `read` cap"), 1);
  const c1 = C("const-01-core-head.md");
  assert.match(c1, /\| `hop` cap \|/);
  assert.match(c1, /\| `fix_try` cap \|/);
  assert.match(c1, /\| `read` cap \|/);
});

test("AC-G2-06: const-08 names the writer-obligation label, which exists in coord-03", () => {
  const c8 = C("const-08-chain-31-mid.md");
  assert.equal(count(c8, "stop-condition 6"), 0);
  assert.equal(count(c8, "`skill-coordinator` *Cut-approval gate writer obligation*"), 1);
  assert.equal(count(C("coord-03-core-fallback.md"), "**Cut-approval gate writer obligation**"), 1);
});

test("AC-G2-07: design-auditor cites skill-pm Gate Summary; the row exists", () => {
  const t = C("skill-design-auditor.md");
  assert.equal(count(t, "2a-bis"), 0);
  assert.equal(count(t, "(`skill-pm` Gate Summary)"), 1);
  assert.equal(count(C("skill-pm.md"), "| **Geometric-Density Split Gate** |"), 1);
});

test("AC-G2-08: constitution file names are const-*.md; doc-writer lists coord-*.md too", () => {
  for (const f of ["constitution-rationale.md", "skill-doc-writer.md"]) {
    assert.equal(count(C(f), "content/constitution.md"), 0, f);
  }
  const r = C("constitution-rationale.md");
  assert.equal(count(r, "Rationale target"), 0);
  assert.equal(count(C("skill-doc-writer.md"), "`content/const-*.md`, `content/coord-*.md`"), 1);
});

test("AC-G2-11: lite says four write tools server-rejected, tw_switch_role SOP-forbidden", () => {
  const t = C("skill-coordinator-lite.md");
  assert.equal(count(t, "will be rejected"), 0);
  assert.equal(count(t, "`tw_rollback_task`: server-rejected; `tw_switch_role`: SOP-forbidden."), 1);
});

test("AC-G2-12: QA skills reference each other as <agc install>/content/...", () => {
  const qe = C("skill-qa-engineer.md");
  const qv = C("skill-qa-visual.md");
  assert.equal(count(qe, "`<agc install>/content/skill-qa-visual.md`"), 4);
  assert.equal(count(qv, "`<agc install>/content/skill-qa-engineer.md`"), 2);
  assert.ok(has(qe, "agc's install directory, not the workspace"));
  for (const t of [qe, qv]) {
    assert.doesNotMatch(t, /`content\/skill-qa-(visual|engineer)\.md`/);
  }
  assert.ok(Buffer.byteLength(qe) <= 18500, "skill-qa-engineer.md byte cap");
});

test("AC-G2-18: bare skill names in const-08 / lite; const-08 review_round cap names the cap (E393: no bare Round 4)", () => {
  assert.doesNotMatch(C("const-08-chain-31-mid.md"), /`skill-(coordinator|pm)\.md`/);
  assert.equal(count(C("skill-coordinator-lite.md"), "`skill-coordinator.md`"), 0);
  // E393 (AC-C03): the bare "(Round 4 of `review_round`)" restatement became a named cap.
  assert.equal(count(C("const-08-chain-31-mid.md"), "(Round 4 of `review_round`)"), 0);
  assert.equal(count(C("const-08-chain-31-mid.md"), "cap of code-reviewer FAILs is exhausted"), 1);
});

test("AC-G2-26: const-15 points at Escalation Routes, an H2 in coord-03", () => {
  assert.equal(count(C("const-15-core-tail.md"), "§Auto-Routing"), 0);
  assert.equal(count(C("const-15-core-tail.md"), "Stop conditions: `skill-coordinator` §Escalation Routes."), 1);
  assert.match(C("coord-03-core-fallback.md"), /^## Escalation Routes$/m);
});

test("AC-G2-03: CLAUDE.md Testing changes carries no pass count or version", () => {
  const s = section(claude, "Testing changes");
  assert.doesNotMatch(s, /1633|at v3\.94\.0/);
  assert.equal(count(s, "suite-result:"), 1);
});

test("AC-G2-13: CLAUDE.md hook paragraph has no size literal and a plain-pipe command", () => {
  const s = section(claude, "Governance context loading");
  assert.doesNotMatch(s, /18\.7 ?KB|27 ?KB/);
  assert.equal(count(s, "node bin/agent-governance-context.mjs | wc -c"), 1);
  assert.equal(count(claude, "mjs \\| wc"), 0);
});

test("AC-G2-15: CLAUDE.md git bullet says tools never write to git; §6 governs workflow", () => {
  const s = section(claude, "What this server does NOT do");
  assert.equal(count(s, "Commit/PR workflow is out of scope"), 0);
  assert.equal(count(s, "never write to git"), 1);
  assert.ok(count(s, "Constitution §6") >= 1);
  assert.ok(has(s.replace(/\s+/g, " "), "`skill-release-engineer` / `skill-integrator` SOPs"));
});

test("AC-G2-24: CLAUDE.md Layout has the new rows and the full check-version row", () => {
  assert.equal(
    (claude.match(/^(lib\/render-boundary\.ts|tools\/lane-paths\.ts|tools\/fanout-\*\.ts|tools\/lane-status\.ts) /gm) || []).length,
    4,
  );
  const cv = claude.split("\n").find((l) => l.startsWith("scripts/check-version.mjs"));
  assert.ok(cv, "check-version row");
  for (const k of ["dist/index.js", "package-lock.json", "CHANGELOG", "git tag: advisory"]) {
    assert.ok(has(cv, k), `check-version row names ${k}`);
  }
  // Rows are added, never moved: anchor rows keep their relative order.
  const order = ["tools/registry.ts ", "tools/handoff-orchestrator.ts ", "tools/rag-coalesce.ts ", "tools/lane-paths.ts ", "gates/registry.ts "];
  const idx = order.map((k) => claude.indexOf(`\n${k}`));
  assert.ok(idx.every((i) => i > 0), "all anchor rows present");
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, "Layout anchor rows keep relative order");
});

// "221 test files" in Testing changes is E391-NEW-2 (filed, out of scope), so
// only gate-definition and pass-count literals are pinned here.
test("changed CLAUDE.md sections add no literal gate-definition or pass counts", () => {
  for (const h of ["Testing changes", "What this server does NOT do", "Governance context loading"]) {
    assert.doesNotMatch(section(claude, h), /\b\d{2,} gate definitions\b|\b\d{3,}\/\d{3,}\b/, h);
  }
});

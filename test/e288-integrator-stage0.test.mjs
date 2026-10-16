// Coded by @qa-engineer
// Tests (T-E288-02) for specs/e288-integrator-stage0-and-test-hygiene.md AC-E288-1..6: the integrator's
// optional Stage 0 (ticket cut) in content/skill-integrator.md and the PM row in content/skill-pm.md.
// Content-structure assertions only: section-bounded slices, ordering by index (never line number), Copy
// literals verbatim. No git, no fixed sha, no real specs/fanout-*.md content (E323 hygiene). Each check is a
// pure function of the SOP text so the negative control can run it on a mutated in-memory copy and see it fail.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const SOP = read("content/skill-integrator.md");
const PM = read("content/skill-pm.md");

const count = (text, needle) => text.split(needle).length - 1;
/** Slice from the first `start` occurrence up to (excluding) the next `end` after it; "" when absent. */
function slice(text, start, end) {
  const a = text.indexOf(start);
  if (a < 0) return "";
  const b = text.indexOf(end, a + start.length);
  return b < 0 ? text.slice(a) : text.slice(a, b);
}
const bodyRows = (section) => section.split("\n").filter((l) => l.startsWith("|")).slice(2);

const H0 = "## Stage 0 — Ticket cut (optional)";
const ROW0 = "| 0. Ticket cut (optional) | Only when the human gives a scope draft or a cross-repo hand-off note: dispatch PM to write the ticket-cut file only; skipped when tickets are already cut |";
const PERM_ROW = "| Stage 0 only: dispatch PM (Task) to write the ticket-cut file — no `tasks.md`, no write-type `tw_*` | Dispatch PM for anything else (spec, tasks, state writes) |";
const PM_ROW = "| **Integrator Stage 0 cut** | The integrator's brief dispatches you for its Stage 0. | Write only the cut file the brief names: one row per ticket under the Cut-Approval header below (`id` = the backlog id, else `NEW-<n>`), then each open question as a `needs human ruling` item. No spec, no `tasks.md`, no write-type `tw_*` (reads stay). Do not halt for approval — the human approves the file with the integrator's manifest. Final reply: the file path. |";
const CUT_HEADER = "`id | desc | depends_on | est. files | touches | design-link`";

// Each check returns an array of failure strings (empty = holds).
function checkAC1(sop) {
  const f = [];
  const gov = sop.indexOf("## Governance state (D11)");
  const h0 = sop.indexOf(H0);
  const s1 = sop.indexOf("## Stage 1 — Fan-out planning");
  if (count(sop, H0) !== 1) f.push("Stage 0 heading must occur exactly once");
  if (!(gov >= 0 && h0 > gov && s1 > h0)) f.push("Stage 0 heading must sit between Governance state (D11) and Stage 1");
  const overview = slice(sop, "## Work overview", "## Permissions");
  const r0 = overview.indexOf("| 0. Ticket cut (optional) |");
  const r1 = overview.indexOf("| 1. Fan-out planning |");
  if (!(r0 >= 0 && r1 > r0)) f.push("Work overview row 0 must sit above the 1. Fan-out planning row");
  const life = slice(sop, "## Lifecycle", "Invocation:");
  const l0 = life.indexOf("| 0 (optional) |");
  const l1 = life.indexOf("| 1 | integrator |");
  if (!(l0 >= 0 && l1 > l0)) f.push("Lifecycle stage-0 row must sit above the stage-1 row");
  if (!sop.includes("`fan-out <feature or wave>` (stages 0–3)")) f.push("invocation line must say stages 0–3");
  return f;
}
function checkAC2(sop) {
  const s = slice(sop, H0, "## Stage 1");
  const f = [];
  if (!s.includes("Skip it when the tickets are already cut")) f.push("must say skip when tickets are already cut");
  if (!/runs only when the human gives a scope draft or a cross-repo hand-off note/.test(s)) f.push("must say it runs only on a scope draft or cross-repo hand-off note");
  return f;
}
function checkAC3(sop) {
  const s = slice(sop, H0, "## Stage 1");
  const f = [];
  for (const lit of ["Dispatch PM via Task", "specs/ticket-cut-<feature>.md", "no spec, no `tasks.md`, no write-type `tw_*` call", "approved together with the manifest at Stage 2", "does not restate this protocol"]) {
    if (!s.includes(lit)) f.push(`Stage 0 must contain: ${lit}`);
  }
  if (!/the PM SOP's \*Integrator Stage 0 cut\* row carries it/.test(s)) f.push("must say the PM SOP row carries the protocol");
  const input = sop.split("\n").find((l) => l.startsWith("Input: tickets PM has already cut")) ?? "";
  if (!input.includes("Stage 0 cut file")) f.push("Stage 1 Input: line must name the Stage 0 cut file");
  const s2 = slice(sop, "## Stage 2", "## Stage 3");
  if (!/one approval covers both/.test(s2)) f.push("Stage 2 must say one approval covers both");
  return f;
}
function checkAC4(sop) {
  const perm = slice(sop, "## Permissions", "## Who you are");
  const f = [];
  if (bodyRows(perm).length !== 5) f.push(`Permissions must have 5 body rows (got ${bodyRows(perm).length})`);
  if (count(perm, PERM_ROW) !== 1) f.push("Permissions must carry the Stage 0 row exactly once, verbatim");
  if (count(perm, "Stage 0 only: dispatch PM") !== 1) f.push("exactly one new Stage 0 permission row");
  if (!perm.includes("| `tw_update_state`; writing any lane's `.current/<lane>/` |")) f.push("existing tw_update_state cannot cell must be unchanged");
  return f;
}
function checkAC5(sop) {
  const s = slice(sop, H0, "## Stage 1");
  const f = [];
  const parts = "**Background** (the settled contract and its sources), **Current state**, **To do**, **Not to do**";
  if (count(s, parts) !== 1) f.push("the four D3 parts must appear once, in order, verbatim");
  if (!s.includes("The human carries its path")) f.push("must say the human carries its path");
  if (!/first Decisions row/.test(s)) f.push("must say the note is the manifest's first Decisions row");
  if (!/`出處` naming the sending repo and the note's repo-relative path \(never an absolute path\)/.test(s)) f.push("出處 must name sending repo + repo-relative path, never absolute");
  return f;
}
function checkAC6(pm) {
  const gs = slice(pm, "## Gate Summary", "Cut-Approval inline cut table header");
  const f = [];
  const rows = gs.split("\n").filter((l) => l.startsWith("| **Integrator Stage 0 cut** |"));
  if (rows.length !== 1) f.push(`exactly one **Integrator Stage 0 cut** row (got ${rows.length})`);
  if (count(gs, PM_ROW) !== 1) f.push("PM row must match the Copy literal verbatim");
  const attest = gs.indexOf("| **Manifest-Tier Self-Attestation** |");
  const stage0 = gs.indexOf("| **Integrator Stage 0 cut** |");
  if (!(attest >= 0 && stage0 > attest)) f.push("row must come after Manifest-Tier Self-Attestation");
  if (count(pm, CUT_HEADER) !== 1) f.push("Cut-Approval header literal must stay present exactly once");
  return f;
}

test("AC-E288-1: Stage 0 heading, Work overview row, Lifecycle row and invocation stages 0–3 are placed correctly", () => {
  assert.deepEqual(checkAC1(SOP), []);
  assert.ok(SOP.includes(ROW0), "overview row 0 verbatim (int.overview.row0)");
});
test("AC-E288-2: Stage 0 is skipped when tickets are cut and runs only on a scope draft / hand-off note", () => {
  assert.deepEqual(checkAC2(SOP), []);
});
test("AC-E288-3: PM via Task writes only the cut file; approved with the manifest; Stage 1 input and Stage 2 updated", () => {
  assert.deepEqual(checkAC3(SOP), []);
});
test("AC-E288-4: Permissions gains exactly one Stage 0 PM row (5 body rows); the tw_update_state cell is unchanged", () => {
  assert.deepEqual(checkAC4(SOP), []);
});
test("AC-E288-5: the cross-repo hand-off note (D3) has four ordered parts, the human carries the path, repo-relative 出處", () => {
  assert.deepEqual(checkAC5(SOP), []);
});
test("AC-E288-6: skill-pm Gate Summary has exactly one Integrator Stage 0 cut row after Manifest-Tier Self-Attestation", () => {
  assert.deepEqual(checkAC6(PM), []);
});

test("AC-E288 negative control: each structural check fails on a mutated in-memory copy", () => {
  // WHY: a check that cannot fail proves nothing; mutate the real text and require each check to flag it.
  const mutate = (text, from, to) => {
    assert.ok(text.includes(from), `mutation anchor present: ${from.slice(0, 40)}`);
    return text.replace(from, to);
  };
  // AC1: misplaced heading (moved after Stage 1) and a missing overview row
  const misplaced = mutate(SOP, H0, "## Stage 0 — moved").replace("## Stage 2 — Approval", `${H0}\n\n## Stage 2 — Approval`);
  assert.notDeepEqual(checkAC1(misplaced), []);
  assert.notDeepEqual(checkAC1(mutate(SOP, ROW0 + "\n", "")), []);
  // AC2: skip sentence removed
  assert.notDeepEqual(checkAC2(mutate(SOP, "Skip it when the tickets are already cut", "Always run it")), []);
  // AC3: approval sentence removed
  assert.notDeepEqual(checkAC3(mutate(SOP, "approved together with the manifest at Stage 2", "approved later")), []);
  // AC4: missing permission row, and a duplicated one
  assert.notDeepEqual(checkAC4(mutate(SOP, PERM_ROW + "\n", "")), []);
  assert.notDeepEqual(checkAC4(mutate(SOP, PERM_ROW + "\n", PERM_ROW + "\n" + PERM_ROW + "\n")), []);
  // AC5: parts out of order
  assert.notDeepEqual(checkAC5(mutate(SOP, "**Current state**, **To do**", "**To do**, **Current state**")), []);
  // AC6: PM row missing, and placed before the attestation row
  assert.notDeepEqual(checkAC6(mutate(PM, PM_ROW + "\n", "")), []);
  const attestLine = PM.split("\n").find((l) => l.startsWith("| **Manifest-Tier Self-Attestation** |"));
  assert.ok(attestLine);
  assert.notDeepEqual(checkAC6(mutate(mutate(PM, PM_ROW + "\n", ""), attestLine, PM_ROW + "\n" + attestLine)), []);
});

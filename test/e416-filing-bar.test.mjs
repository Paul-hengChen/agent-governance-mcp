// Coded by @qa-engineer
// E416 pins: the ticket filing bar is stated at the shipped sites. WHY: without a bar,
// finished tickets spawn follow-up tickets (a loop); these pins keep the bar's key
// clauses from being edited away. Regexes tolerate line wrapping and light rewording.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8").replace(/\s+/g, " ");

test("coord-03: Filing bar paragraph states both admit conditions, the same-ticket fix and report-only notes", () => {
  const s = read("content/coord-03-core-fallback.md");
  assert.match(s, /\*\*Filing bar\*\*/);
  assert.match(s, /confirmed defect that will make users go wrong/);
  assert.match(s, /human asks/);
  assert.match(s, /introduced.{0,60}fixed within the current ticket.{0,40}never filed/);
  assert.match(s, /`recommended` \/ `optional`.{0,80}not proposed as tickets/);
});

test("coord-03: E179 lane-findings paragraph files only findings that clear the bar", () => {
  const s = read("content/coord-03-core-fallback.md");
  assert.match(s, /Lane findings are numbered at finish time/);
  assert.match(s, /new finding that clears the filing bar/);
  assert.ok(s.indexOf("Filing bar") < s.indexOf("Lane findings are numbered"), "bar precedes the E179 paragraph");
});

test("code-reviewer: non-blocking tiers are report-only and a diff-introduced defect is required", () => {
  const s = read("content/skill-code-reviewer.md");
  assert.match(s, /defect this diff introduced is `required`/);
  assert.match(s, /`recommended` and `optional` findings are report-only, never proposed as tickets/);
});

test("integrator 5c-1: full bar inline, reviewer/QA notes listed not filed", () => {
  const s = read("content/skill-integrator.md");
  assert.match(s, /clear the filing bar/);
  assert.match(s, /confirmed defect that will make users go wrong, or one the human asks for/);
  assert.match(s, /introduces?d? goes back to that lane, never filed|introduced goes back to that lane, never filed/);
  assert.match(s, /`recommended` \/ `optional` items are listed in the wave report, not filed/);
});

test("integrator: a red / CHANGES_REQUESTED fix goes to the owning lane, never a new ticket (5b-5, 5b-8, stage 6)", () => {
  const s = read("content/skill-integrator.md");
  const hits = s.match(/owning lane, never a new ticket/g) ?? [];
  assert.ok(hits.length >= 3, `expected >= 3 owning-lane clauses, got ${hits.length}`);
  assert.match(s, /no single owner → report to the human/);
});

test("integrator: the old 'or a new ticket' escape is gone", () => {
  assert.doesNotMatch(read("content/skill-integrator.md"), /or a new ticket/);
});

test("lane-protocol: §4 gate bullet and the final-report template carry the bar", () => {
  const s = read("docs/lane-protocol.md");
  assert.match(s, /門檻/);
  assert.match(s, /確認會讓使用者出錯的缺陷/);
  assert.match(s, /本票自己造成的缺陷.{0,40}merge 前修掉/);
  assert.match(s, /`recommended` \/ `optional` 意見.{0,40}列出，不開票/);
});

test("CLAUDE.md (repo-only): fix-spec self-check bullet is present", () => {
  const s = read("CLAUDE.md");
  assert.match(s, /fix spec that edits `content\/\*\*`/);
  assert.match(s, /exists only in this repo/);
  assert.match(s, /context-budget\.test\.mjs/);
});

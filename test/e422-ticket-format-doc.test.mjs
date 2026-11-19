// Coded by @qa-engineer
// Tests (T-E422-03) for specs/e422-ticket-file-format.md AC3 (doc list) and AC8: docs/ticket-format.md is
// the one document a person or agent without this tooling starts from, so it must explain every field the
// parser knows, every verification form, the three status forms, the forbidden names, the backfill rule,
// the append rule and the backlog-index convention, without pointing at other files; and the embedded
// example and templates/ticket.md must themselves pass the checker, or the doc teaches an invalid ticket.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { TICKET_FIELDS, FORBIDDEN_FIELD_NAMES, TICKET_STATUSES, parseTicketFile } from "../dist/tools/ticket-file.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC = fs.readFileSync(path.join(ROOT, "docs", "ticket-format.md"), "utf8");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e422-doc-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function section(md, heading) {
  const start = md.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const rest = md.slice(start + heading.length + 2);
  const level = heading.match(/^#+/)[0].length;
  const end = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  return end < 0 ? rest : rest.slice(0, end);
}

/** The doc without its example block and its closing tooling section: the "explanations". */
const EXPLANATIONS = DOC
  .replace(/\n## Example ticket\n\n```markdown\n[\s\S]*?\n```\n/, "\n")
  .replace(/\n## Checking with this repository's tooling\n[\s\S]*$/, "\n");

/** The example section; it holds a fenced block with its own "## " lines, so slice by the fence. */
const EXAMPLE = DOC.match(/\n## Example ticket\n\n(```markdown\n[\s\S]*?\n```)\n/)[1];

function runChecker(text, name) {
  const file = path.join(TMP, name);
  fs.writeFileSync(file, text);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-tickets.mjs"), file], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

test("AC8 every field the parser exports has its own row in the field table", () => {
  // WHY: the checker refuses fields the doc does not define, so a field missing here is unusable.
  for (const f of TICKET_FIELDS) {
    assert.ok(DOC.includes(`| \`${f.name}\` |`), `field table row for ${f.name}`);
  }
});

test("AC8 the field table marks required fields yes and source no, matching the parser", () => {
  for (const f of TICKET_FIELDS) {
    const row = DOC.split("\n").find((l) => l.startsWith(`| \`${f.name}\` |`));
    const cells = row.split("|").map((c) => c.trim());
    assert.equal(cells[2], f.required ? "yes" : "no", f.name);
  }
});

test("AC8 all four verification forms are explained, including the device-or-person check text", () => {
  for (const form of [
    "Verification: automated test",
    "Verification: test <test file path> — <test title>",
    "Verification: command <command>",
    "Verification: device-or-person",
    "Verification: device-or-person: <what to check>",
  ]) {
    assert.ok(DOC.includes(form), form);
  }
});

test("AC8 the three status forms are explained and a bare stopped is said to be invalid", () => {
  assert.equal(TICKET_STATUSES.length, 3);
  assert.ok(DOC.includes("| `not started` |"));
  assert.ok(DOC.includes("| `done` |"));
  assert.ok(DOC.includes("| `stopped — <reason>` |"));
  assert.match(DOC, /bare `stopped` with no reason is not valid/);
});

test("AC8 and AC3 the doc lists every forbidden field name the parser exports, as list items", () => {
  assert.ok(FORBIDDEN_FIELD_NAMES.length >= 7);
  const forbiddenSection = section(DOC, "### Field names that are not allowed");
  for (const name of FORBIDDEN_FIELD_NAMES) {
    assert.ok(forbiddenSection.includes(`- \`${name}\``), name);
  }
  for (const required of ["next_role", "agent_id", "handoff", "lane", "round", "evidence", "dispatch"]) {
    assert.ok(FORBIDDEN_FIELD_NAMES.includes(required), required);
  }
});

test("AC8 the backfill rule is stated: automated test is replaced by the test path and title, scenario unchanged", () => {
  const s = section(DOC, "### Filling in the test name later");
  assert.match(s, /Verification: automated test/);
  assert.match(s, /replaced by `Verification: test <test file path> — <test title>`/);
  assert.match(s, /does not change the scenario/);
});

test("AC8 the append rule is stated: last section, same shape plus an Added line, existing scenarios never edited", () => {
  const s = section(DOC, "### Scenarios added during the work");
  assert.match(s, /## Added during build/);
  assert.match(s, /Added: <who>, <YYYY-MM-DD>, <reason>/);
  assert.match(s, /never edited or removed/);
  assert.match(s, /stopped/);
});

test("AC8 the backlog-index convention is stated: the backlog stays the index and points at the file by repository-relative path", () => {
  const s = section(DOC, "## Where ticket files are listed");
  assert.match(s, /backlog stays the index/);
  assert.match(s, /path relative to the repository root/);
  assert.match(s, /not converted/);
});

test("AC8 the explanations hold no link and no path reference to another file", () => {
  // WHY: the doc must be readable on its own; a pointer to a repo-internal file breaks that for adopters.
  assert.doesNotMatch(EXPLANATIONS, /\]\(/);
  assert.doesNotMatch(EXPLANATIONS, /https?:\/\//);
  assert.doesNotMatch(EXPLANATIONS, /\b(docs|scripts|templates|specs|tools|content)\//);
  assert.doesNotMatch(EXPLANATIONS, /\.current|\.config\.json|backlog\.md/);
});

test("AC8 the doc has its main headings: field block, scenarios, example ticket and the tooling section", () => {
  assert.match(DOC, /^## Field block$/m);
  assert.match(DOC, /^## Scenarios$/m);
  assert.match(DOC, /^## Example ticket$/m);
  assert.match(DOC, /^## Checking with this repository's tooling$/m);
});

test("AC8 the doc explains quoting: single quotes, doubled quote, and a warning against double quotes", () => {
  assert.match(DOC, /single quotes/);
  assert.match(DOC, /`it's` becomes `'it''s'`/);
  assert.match(DOC, /Do not use\s+double quotes/);
});

test("AC8 the doc's own quoting example reads back byte for byte through the real parser", () => {
  // WHY: the doc teaches this quoting rule, so its example must survive the parser unchanged.
  const ex = DOC.match(/title: 'Retry 3 times[^\n]*\nallowed paths:[^\n]*\nstatus:[^\n]*/)[0];
  const ticketText = `---\nid: E1\n${ex}\nneeds device or person: no\ndepends on: []\npriority: P1\n---\n\n## Scenarios\n\n### S1 — t\n\n- Given a\n- When b\n- Then c\n- Verification: automated test\n`;
  const res = parseTicketFile(ticketText);
  assert.deepEqual(res.problems, []);
  assert.equal(res.fields.title, "Retry 3 times #flaky on C:\\temp\\new");
  assert.deepEqual(res.fields["allowed paths"], ["**/*.md", "app/[id]/page.tsx", "src/export/csv.ts"]);
  assert.equal(res.fields.status, "stopped — vendor's firmware: late");
});

test("AC8 the embedded Example ticket block, written to a temp file, passes the checker with exit 0", () => {
  const m = EXAMPLE.match(/```markdown\n([\s\S]*?)\n```/);
  assert.ok(m, "a fenced markdown block under ## Example ticket");
  const r = runChecker(m[1] + "\n", "example.md");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok .*example\.md \(4 scenarios\)/);
});

test("AC8 the example is generic: no tracker link, no local path, and it shows an added-during-build scenario", () => {
  const s = EXAMPLE;
  assert.doesNotMatch(s, /https?:\/\//);
  assert.doesNotMatch(s, /\/Users\/|C:\\/);
  assert.match(s, /## Added during build/);
  assert.match(s, /Added: the implementer, \d{4}-\d{2}-\d{2}, /);
});

test("AC8 templates/ticket.md, written to a temp file, passes the checker with exit 0", () => {
  const tpl = fs.readFileSync(path.join(ROOT, "templates", "ticket.md"), "utf8");
  const r = runChecker(tpl, "template.md");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\(1 scenarios\)/);
});

test("AC8 the template carries every required field name and ends with an empty Added during build section", () => {
  const tpl = fs.readFileSync(path.join(ROOT, "templates", "ticket.md"), "utf8");
  for (const f of TICKET_FIELDS.filter((x) => x.required)) {
    assert.ok(tpl.startsWith(`---\n${f.name}:`) || tpl.includes(`\n${f.name}:`), f.name);
  }
  assert.match(tpl, /\n## Added during build\n*$/);
});

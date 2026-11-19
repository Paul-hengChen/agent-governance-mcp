// Coded by @qa-engineer
// Tests (T-E422-03) for specs/e422-ticket-file-format.md AC1-AC7 and AC10: the ticket-file parser
// (dist/tools/ticket-file.js) and the checker CLI (scripts/check-tickets.mjs). A ticket file is the
// contract a person or a later tool starts work from, so every format rule the doc promises must be
// caught before work starts, with a message naming the field or scenario and the right exit code
// (0 valid, 1 problem found, 2 cannot run). Fixtures are written inline into a temp directory.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseTicketFile, TICKET_FIELDS, FORBIDDEN_FIELD_NAMES, TICKET_STATUSES,
} from "../dist/tools/ticket-file.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "check-tickets.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e422-ticket-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
function freshDir() {
  const dir = path.join(TMP, `d${n++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const BASE_FIELDS = {
  id: "E900",
  title: "CSV export adds a header row",
  priority: "P2",
  "depends on": "[E899]",
  "allowed paths": "[src/export/csv.ts, test/export-csv.test.ts]",
  "needs device or person": "no",
  status: "not started",
  source: "",
};

/** Field block text; `over` replaces a value, a null value removes the field, extra keys are added. */
function block(over = {}) {
  const f = { ...BASE_FIELDS, ...over };
  const lines = Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`.trimEnd());
  return ["---", ...lines, "---"].join("\n");
}

function scenario(id, extra = {}) {
  const lines = [`### ${id} — Title of ${id}`, ""];
  const gwt = { given: "- Given a start", when: "- When it happens", then: "- Then a result", ...extra };
  for (const k of ["given", "when", "then"]) if (gwt[k] !== null) lines.push(gwt[k]);
  const ver = extra.verification === undefined ? ["- Verification: automated test"] : extra.verification;
  lines.push(...ver, "");
  return lines.join("\n");
}

function ticket({ fields = {}, scenarios = [scenario("S1")], added = "" } = {}) {
  const parts = [block(fields), "", "## Scenarios", "", ...scenarios];
  if (added) parts.push("## Added during build", "", added);
  return parts.join("\n") + "\n";
}

function writeTicket(dir, name, text) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, text);
  return p;
}

function check(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function checkText(text, name = "t.md") {
  const dir = freshDir();
  const file = writeTicket(dir, name, text);
  return { ...check([file]), file };
}

// ---------- AC1 ----------

test("AC1 a ticket that follows the template with 3 scenarios exits 0 and prints the ok and summary lines", () => {
  // WHY: the ok line carries the scenario count a human reads to confirm the whole file was seen.
  const text = ticket({ scenarios: [scenario("S1"), scenario("S2"), scenario("S3")] });
  const r = checkText(text);
  assert.equal(r.code, 0, r.out + r.err);
  const lines = r.out.trim().split("\n");
  assert.equal(lines[0], `check-tickets: ok ${r.file} (3 scenarios)`);
  assert.equal(lines[lines.length - 1], "check-tickets: 1 file(s), 3 scenario(s), 0 problem(s)");
});

test("AC1 the parser returns the fields and scenarios of a valid ticket with no problems", () => {
  const res = parseTicketFile(ticket({ scenarios: [scenario("S1"), scenario("S2")] }));
  assert.deepEqual(res.problems, []);
  assert.equal(res.fields.id, "E900");
  assert.deepEqual(res.fields["depends on"], ["E899"]);
  assert.deepEqual(res.scenarios.map((s) => s.id), ["S1", "S2"]);
  assert.deepEqual(res.scenarios[0].verification, { kind: "automated-test" });
});

test("AC1 the exported field list names the eight documented fields and only source is optional", () => {
  assert.deepEqual(TICKET_FIELDS.map((f) => f.name), [
    "id", "title", "priority", "depends on", "allowed paths", "needs device or person", "status", "source",
  ]);
  assert.deepEqual(TICKET_FIELDS.filter((f) => !f.required).map((f) => f.name), ["source"]);
});

test("AC1 values stay text: no, 007 and a bare date are not coerced", () => {
  // WHY: a YAML type coercion would turn `no` into false and break the yes/no check.
  const res = parseTicketFile(ticket({ fields: { priority: "007", title: "2026-01-01" } }));
  assert.deepEqual(res.problems, []);
  assert.equal(res.fields.priority, "007");
  assert.equal(res.fields.title, "2026-01-01");
  assert.equal(res.fields["needs device or person"], "no");
});

// ---------- AC2 ----------

test("AC2 a scenario with no verification line exits 1 naming the scenario", () => {
  const text = ticket({ scenarios: [scenario("S1"), scenario("S2", { verification: [] })] });
  const r = checkText(text);
  assert.equal(r.code, 1);
  assert.match(r.out, /scenario S2 has no verification/);
  assert.doesNotMatch(r.out, /scenario S1 has no verification/);
});

test("AC2 a scenario with two verification lines exits 1 naming the scenario", () => {
  const two = ["- Verification: automated test", "- Verification: command npm test"];
  const r = checkText(ticket({ scenarios: [scenario("S1"), scenario("S2", { verification: two })] }));
  assert.equal(r.code, 1);
  assert.match(r.out, /scenario S2 has more than one verification/);
});

test("AC2 a verification line in none of the four forms is reported as unknown with its text", () => {
  const r = checkText(ticket({ scenarios: [scenario("S1", { verification: ["- Verification: ask nicely"] })] }));
  assert.equal(r.code, 1);
  assert.match(r.out, /scenario S1 has an unknown verification "ask nicely"/);
});

test("AC2 all four verification forms parse to their documented kind", () => {
  const forms = [
    ["- Verification: automated test", { kind: "automated-test" }],
    ["- Verification: test test/a.test.ts — it works", { kind: "test", file: "test/a.test.ts", title: "it works" }],
    ["- Verification: command npm run lint", { kind: "command", command: "npm run lint" }],
    ["- Verification: device-or-person", { kind: "device-or-person" }],
    ["- Verification: device-or-person: look at it", { kind: "device-or-person", check: "look at it" }],
  ];
  for (const [line, expected] of forms) {
    const res = parseTicketFile(ticket({
      fields: { "needs device or person": expected.kind === "device-or-person" ? "yes" : "no" },
      scenarios: [scenario("S1", { verification: [line] })],
    }));
    assert.deepEqual(res.problems, [], line);
    assert.deepEqual(res.scenarios[0].verification, expected, line);
  }
});

// ---------- AC3 ----------

test("AC3 a next_role field is refused as forbidden, quoting the name as written", () => {
  const r = checkText(ticket({ fields: { next_role: "qa-engineer" } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /forbidden field name "next_role"/);
  assert.doesNotMatch(r.out, /unknown field "next_role"/);
});

test("AC3 Review Round, lane, dispatch mechanism and Review-Round are all refused as forbidden", () => {
  // WHY: renamed tooling vocabulary must not slip through as a merely unknown field.
  for (const name of ["Review Round", "lane", "dispatch mechanism", "Review-Round", "agent id", "handoff"]) {
    const r = checkText(ticket({ fields: { [name]: "x" } }));
    assert.equal(r.code, 1, name);
    assert.ok(r.out.includes(`forbidden field name "${name}"`), `${name}: ${r.out}`);
  }
});

test("AC3 the field name id is not forbidden even though agent_id contains the word id", () => {
  assert.deepEqual(parseTicketFile(ticket()).problems, []);
});

test("AC3 the forbidden list holds the seven documented names in order", () => {
  assert.deepEqual(
    [...FORBIDDEN_FIELD_NAMES],
    ["next_role", "agent_id", "handoff", "lane", "round", "evidence", "dispatch"],
  );
});

// ---------- AC4 ----------

test("AC4 a ticket missing allowed paths exits 1 with the missing-field line", () => {
  const r = checkText(ticket({ fields: { "allowed paths": null } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /missing field "allowed paths"/);
});

test("AC4 a required field written with no value, and an empty allowed paths list, count as missing", () => {
  assert.match(checkText(ticket({ fields: { title: "" } })).out, /missing field "title"/);
  assert.match(checkText(ticket({ fields: { "allowed paths": "[]" } })).out, /missing field "allowed paths"/);
});

test("AC4 depends on may be an empty list but must be present", () => {
  assert.deepEqual(parseTicketFile(ticket({ fields: { "depends on": "[]" } })).problems, []);
  assert.match(checkText(ticket({ fields: { "depends on": null } })).out, /missing field "depends on"/);
});

test("AC4 status in progress exits 1 with the unknown-status line", () => {
  const r = checkText(ticket({ fields: { status: "in progress" } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown status "in progress" \(expected not started, done, or stopped — <reason>\)/);
});

test("AC4 a bare stopped with no reason is an unknown status", () => {
  for (const s of ["stopped", "stopped —", "stopped - hyphen not dash"]) {
    const r = checkText(ticket({ fields: { status: `'${s}'` } }));
    assert.equal(r.code, 1, s);
    assert.match(r.out, /unknown status/, s);
  }
});

test("AC4 the three status forms are valid: not started, done and stopped with a reason", () => {
  assert.deepEqual([...TICKET_STATUSES], ["not started", "done", "stopped"]);
  for (const s of ["not started", "done", "stopped — waiting on vendor firmware"]) {
    assert.deepEqual(parseTicketFile(ticket({ fields: { status: s } })).problems, [], s);
  }
});

test("AC4 source absent, empty, or a list of number rev revision entries is valid", () => {
  assert.deepEqual(parseTicketFile(ticket({ fields: { source: null } })).problems, []);
  assert.deepEqual(parseTicketFile(ticket({ fields: { source: "" } })).problems, []);
  const res = parseTicketFile(ticket({ fields: { source: "[1234 rev 7, 1240 rev 2]" } }));
  assert.deepEqual(res.problems, []);
  assert.deepEqual(res.fields.source, ["1234 rev 7", "1240 rev 2"]);
});

test("AC4 a source entry that is a URL is refused with the source-entry line", () => {
  // WHY: the tracker item number is the only thing allowed in a public repository, never a link.
  const url = "'https://tracker.example/item/1234'";
  const r = checkText(ticket({ fields: { source: `[${url}]` } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /source entry "https:\/\/tracker\.example\/item\/1234" is not "<number> rev <revision>"/);
});

test("AC4 a list field written as text, and a text field written as a list, name the expected shape", () => {
  assert.match(checkText(ticket({ fields: { "allowed paths": "src/a.ts" } })).out,
    /field "allowed paths" must be a list/);
  assert.match(checkText(ticket({ fields: { title: "[a, b]" } })).out, /field "title" must be text/);
});

// ---------- AC5 ----------

test("AC5 an unknown field owner exits 1 with the unknown-field line", () => {
  const r = checkText(ticket({ fields: { owner: "alice" } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown field "owner"/);
  assert.doesNotMatch(r.out, /forbidden field name "owner"/);
});

// ---------- AC6 ----------

test("AC6 needs device or person no with a device-or-person scenario exits 1 with the mismatch line", () => {
  const sc = scenario("S1", { verification: ["- Verification: device-or-person"] });
  const r = checkText(ticket({ scenarios: [sc] }));
  assert.equal(r.code, 1);
  assert.match(r.out, /"needs device or person" is "no" but 1 scenario\(s\) use device-or-person/);
});

test("AC6 needs device or person yes with no device-or-person scenario exits 1 with the mismatch line", () => {
  const r = checkText(ticket({ fields: { "needs device or person": "yes" } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /"needs device or person" is "yes" but 0 scenario\(s\) use device-or-person/);
});

test("AC6 needs device or person yes with a device-or-person scenario is valid", () => {
  const sc = scenario("S1", { verification: ["- Verification: device-or-person: look"] });
  assert.deepEqual(parseTicketFile(ticket({ fields: { "needs device or person": "yes" }, scenarios: [sc] })).problems, []);
});

test("AC6 a duplicate scenario id is reported", () => {
  const r = checkText(ticket({ scenarios: [scenario("S1"), scenario("S1")] }));
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate scenario id S1/);
});

test("AC6 a scenario missing its Given, When or Then line gets one line per missing keyword", () => {
  for (const [k, kw] of [["given", "Given"], ["when", "When"], ["then", "Then"]]) {
    const r = checkText(ticket({ scenarios: [scenario("S1", { [k]: null })] }));
    assert.equal(r.code, 1, kw);
    assert.match(r.out, new RegExp(`scenario S1 has no ${kw} line`), kw);
  }
  const all = checkText(ticket({ scenarios: [scenario("S1", { given: null, when: null, then: null })] }));
  for (const kw of ["Given", "When", "Then"]) assert.match(all.out, new RegExp(`has no ${kw} line`));
});

test("AC6 And lines do not stand in for a missing keyword but are allowed after one", () => {
  const withAnd = scenario("S1", { then: "- Then a result\n- And another result" });
  assert.deepEqual(parseTicketFile(ticket({ scenarios: [withAnd] })).problems, []);
  const onlyAnd = scenario("S1", { given: "- And only an and" });
  assert.match(parseTicketFile(ticket({ scenarios: [onlyAnd] })).problems.join("\n"), /has no Given line/);
});

test("AC6 a file with a Scenarios heading but no scenario, or no Scenarios section, reports no scenarios", () => {
  assert.match(checkText(ticket({ scenarios: [] })).out, /: no scenarios/);
  assert.match(checkText(`${block()}\n\nJust prose.\n`).out, /: no scenarios/);
});

test("AC6 a file whose first line is not --- reports no field block", () => {
  const r = checkText(`# Title\n\n${ticket()}`);
  assert.equal(r.code, 1);
  assert.match(r.out, /no field block \(the first line must be ---\)/);
});

test("AC6 a field block that never closes reports no field block", () => {
  assert.match(checkText("---\nid: E1\n").out, /no field block/);
});

test("AC6 an invalid YAML field block reports the YAML problem and exits 1", () => {
  const r = checkText(ticket({ fields: { title: "[unclosed" } }));
  assert.equal(r.code, 1);
  assert.match(r.out, /field block is not valid YAML: /);
});

test("AC6 a field block that is a list instead of name: value lines is reported as invalid", () => {
  const r = checkText("---\n- a\n- b\n---\n\n## Scenarios\n\n" + scenario("S1"));
  assert.equal(r.code, 1);
  assert.match(r.out, /field block is not valid YAML/);
});

// ---------- AC7 ----------

const ADDED = [
  "### S4 — Added later", "", "- Given a g", "- When a w", "- Then a t",
  "- Verification: command npm test",
  "- Added: the implementer, 2026-01-15, a column name with a comma broke it", "",
].join("\n");

test("AC7 a scenario under Added during build with a full Added line is valid and counted", () => {
  const text = ticket({ scenarios: [scenario("S1"), scenario("S2")], added: ADDED });
  const r = checkText(text);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\(3 scenarios\)/);
  const res = parseTicketFile(text);
  assert.equal(res.scenarios.length, 3);
  assert.deepEqual(res.scenarios.map((s) => s.addedDuringBuild), [false, false, true]);
});

test("AC7 an added-during-build scenario without an Added line exits 1 naming the scenario", () => {
  const noAdded = ADDED.split("\n").filter((l) => !l.includes("Added:")).join("\n");
  const r = checkText(ticket({ added: noAdded }));
  assert.equal(r.code, 1);
  assert.match(r.out, /scenario S4 added during build has no "Added: <who>, <YYYY-MM-DD>, <reason>" line/);
});

test("AC7 an Added line with a badly shaped date or no reason does not count", () => {
  for (const bad of ["Added: someone, 15-01-2026, why", "Added: someone, 2026-01-15", "Added: someone, 2026-01-15, "]) {
    const text = ADDED.replace(/- Added:.*/, `- ${bad}`);
    assert.match(parseTicketFile(ticket({ added: text })).problems.join("\n"), /scenario S4 added during build/, bad);
  }
});

test("AC7 a ticket with only an Added during build scenario and no ordinary scenario has no scenarios", () => {
  const r = checkText(ticket({ scenarios: [], added: ADDED }));
  assert.match(r.out, /: no scenarios/);
});

test("AC7 a scenario in the ordinary section does not need an Added line", () => {
  assert.deepEqual(parseTicketFile(ticket()).problems, []);
});

// ---------- AC10 ----------

function workspaceWithTickets(files, config) {
  const ws = freshDir();
  const dir = path.join(ws, config ? config.dir : "docs/tickets");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  if (config) {
    fs.mkdirSync(path.join(ws, ".current"));
    fs.writeFileSync(path.join(ws, ".current", ".config.json"),
      JSON.stringify({ schema_version: 2, ticketDir: config.dir }));
  }
  return ws;
}

test("AC10 no arguments and no ticket directory exits 0 with the no-directory line", () => {
  const ws = freshDir();
  const r = check([], ws);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(),
    "check-tickets: no ticket directory at docs/tickets; 0 file(s), 0 scenario(s), 0 problem(s)");
});

test("AC10 no arguments with README.md and two ticket files checks only the two, in name order", () => {
  const ws = workspaceWithTickets({
    "README.md": "# not a ticket\n",
    "b-second.md": ticket({ scenarios: [scenario("S1")] }),
    "a-first.md": ticket({ scenarios: [scenario("S1"), scenario("S2")] }),
    "notes.txt": "ignored",
  });
  const r = check([], ws);
  assert.equal(r.code, 0, r.out + r.err);
  const lines = r.out.trim().split("\n");
  assert.deepEqual(lines, [
    "check-tickets: ok docs/tickets/a-first.md (2 scenarios)",
    "check-tickets: ok docs/tickets/b-second.md (1 scenarios)",
    "check-tickets: 2 file(s), 3 scenario(s), 0 problem(s)",
  ]);
});

test("AC10 the readme exclusion ignores case and the listing does not recurse into subdirectories", () => {
  const ws = workspaceWithTickets({ "Readme.MD": "x", "t.md": ticket() });
  fs.mkdirSync(path.join(ws, "docs/tickets/sub"));
  fs.writeFileSync(path.join(ws, "docs/tickets/sub/deep.md"), "not a ticket");
  const r = check([], ws);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 file\(s\)/);
});

test("AC10 an argument that does not exist exits 2 with the cannot-read line on stderr", () => {
  const ws = freshDir();
  const r = check(["nope.md"], ws);
  assert.equal(r.code, 2);
  assert.match(r.err, /^check-tickets: cannot read nope\.md: /);
  assert.equal(r.out, "");
});

test("AC10 an unknown option exits 2 with the bad-option line", () => {
  const r = check(["--fix"], freshDir());
  assert.equal(r.code, 2);
  assert.match(r.err, /^check-tickets: unknown option --fix/);
});

test("AC10 an explicit file argument is checked whatever its name, including README.md", () => {
  const dir = freshDir();
  const file = writeTicket(dir, "README.md", ticket());
  const r = check([file]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\(1 scenarios\)/);
});

test("AC10 a directory argument follows the same rule as the default directory", () => {
  const dir = freshDir();
  writeTicket(dir, "README.md", "x");
  writeTicket(dir, "one.md", ticket());
  const r = check([dir]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 file\(s\), 1 scenario\(s\), 0 problem\(s\)/);
});

test("AC10 the ticketDir config key redirects the no-argument run to the configured directory", () => {
  const ws = workspaceWithTickets({ "x.md": ticket() }, { dir: "work/tickets" });
  const r = check([], ws);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok work\/tickets\/x\.md/);
});

test("AC10 several files with problems exit 1, list every problem and count them in the summary", () => {
  const dir = freshDir();
  writeTicket(dir, "bad.md", ticket({ fields: { owner: "x", status: "wip" } }));
  writeTicket(dir, "good.md", ticket());
  const r = check([dir]);
  assert.equal(r.code, 1);
  assert.match(r.out, /bad\.md: unknown field "owner"/);
  assert.match(r.out, /bad\.md: unknown status "wip"/);
  assert.match(r.out, /ok .*good\.md/);
  assert.match(r.out, /2 file\(s\), 2 scenario\(s\), 2 problem\(s\)/);
});

// ---------- boundary and robustness (security smoke) ----------

test("boundary an empty file and a whitespace-only file report no field block and never throw", () => {
  for (const text of ["", "\n\n  \n"]) {
    const res = parseTicketFile(text);
    assert.match(res.problems.join("\n"), /no field block/);
    assert.deepEqual(res.scenarios, []);
  }
});

test("boundary CRLF line endings and a leading byte-order mark parse like plain text", () => {
  const text = "﻿" + ticket().replace(/\n/g, "\r\n");
  assert.deepEqual(parseTicketFile(text).problems, []);
});

test("boundary a scenario heading inside a fenced code block is not counted", () => {
  const text = ticket({ scenarios: [scenario("S1") + "\n```\n### S9 — fake\n```\n"] });
  assert.deepEqual(parseTicketFile(text).scenarios.map((s) => s.id), ["S1"]);
});

test("boundary free prose sections before Scenarios are not parsed as scenarios", () => {
  const text = `${block()}\n\n## Context\n\n### Not a scenario — heading in prose\n\nSome prose.\n\n## Scenarios\n\n${scenario("S1")}`;
  const res = parseTicketFile(text);
  assert.deepEqual(res.problems, []);
  assert.deepEqual(res.scenarios.map((s) => s.id), ["S1"]);
});

test("boundary special characters in values and a 500-scenario file are handled without error", () => {
  const many = Array.from({ length: 500 }, (_, i) => scenario(`S${i + 1}`));
  const text = ticket({ fields: { title: "'quote''s <b>&amp; \\n #x'" }, scenarios: many });
  const res = parseTicketFile(text);
  assert.deepEqual(res.problems, []);
  assert.equal(res.scenarios.length, 500);
  assert.equal(res.fields.title, "quote's <b>&amp; \\n #x");
});

test("boundary the checker never writes: the checked directory is byte-identical afterwards", () => {
  // WHY: the module is documented read-only; a checker that edits tickets would hide the problems it reports.
  const dir = freshDir();
  const file = writeTicket(dir, "t.md", ticket({ fields: { owner: "x" } }));
  const before = fs.readFileSync(file, "utf8");
  const listing = fs.readdirSync(dir);
  check([dir]);
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.deepEqual(fs.readdirSync(dir), listing);
});

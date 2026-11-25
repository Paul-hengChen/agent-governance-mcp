// Coded by @qa-engineer
// Tests (T-E455-01) for specs/e455-ticket-checker-strict.md AC1-AC9: the ticket-file checker
// (dist/tools/ticket-file.js, CLI scripts/check-tickets.mjs) and the ticketDir / sisterRepos config rules
// (dist/tools/config.js). The checker ships to adopters as the gate a ticket passes before work starts, so
// every rule the format doc states must be enforced, with a message that names the real problem: a merged
// scenario id, a misleading count mismatch, a fenced example read as a scenario line, a ticket directory that
// sweeps the repo root, or a scenario dropped without a word would each let a broken ticket through.
// Messages are pinned verbatim from the spec's Copy / Strings table. Fixtures are written inline into a temp
// directory; nothing reads the base tree.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseTicketFile } from "../dist/tools/ticket-file.js";
import { loadConfig, getConfigError, resolveTicketDir } from "../dist/tools/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "check-tickets.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e455-ticket-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let n = 0;
function freshDir() {
  const dir = path.join(TMP, `d${n++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- Copy / Strings (verbatim) ----------

const MSG = {
  headingNoSeparator: (heading) =>
    `scenario heading "${heading}" has no " — " between the id and the title, so its title is empty`,
  idShape: (id) => `scenario id "${id}" must start with a letter and hold only letters, digits or -`,
  yesNo: (value) => `field "needs device or person" must be yes or no, not "${value}"`,
  entryNotText: (name, i) => `field "${name}" entry ${i} is not text`,
  entryEmpty: (name, i) => `field "${name}" entry ${i} is empty`,
  addedDate: (id, date) => `scenario ${id} has an Added date "${date}" that is not a real calendar date`,
  sectionAfterAdded: (line) => `section "${line}" comes after "## Added during build", which must be the last section`,
  headingNotRead: (line) =>
    `heading "${line}" is not read as a scenario: it is under a section after "## Added during build"`,
};

/** Unchanged messages the new rules suppress in specific cases. */
const COUNT_MISMATCH_RE = /"needs device or person" is "[^"]*" but \d+ scenario\(s\) use device-or-person/;
const MUST_BE_LIST = (name) => `field "${name}" must be a list`;
const MISSING_ADDED = (id) => `scenario ${id} added during build has no "Added: <who>, <YYYY-MM-DD>, <reason>" line`;

// ---------- fixture builders ----------

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

/** Field block text; `over` replaces a value, a null value removes the field. */
function block(over = {}) {
  const f = { ...BASE_FIELDS, ...over };
  const lines = Object.entries(f).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`.trimEnd());
  return ["---", ...lines, "---"].join("\n");
}

const GWT = ["- Given a start", "- When it happens", "- Then a result"];

/** A scenario with a raw heading text (the part after `### `) and body lines. */
function rawScenario(heading, body = [...GWT, "- Verification: automated test"]) {
  return [`### ${heading}`, "", ...body, ""].join("\n");
}

function scenario(id, body) {
  return rawScenario(`${id} — Title of ${id}`, body);
}

function ticket({ fields = {}, scenarios = [scenario("S1")], tail = "" } = {}) {
  const parts = [block(fields), "", "## Scenarios", "", ...scenarios];
  if (tail) parts.push(tail);
  return parts.join("\n") + "\n";
}

function addedScenario(addedLine, id = "S4") {
  return rawScenario(`${id} — Added later`, [
    ...GWT, "- Verification: command npm test", ...(addedLine === null ? [] : [`- ${addedLine}`]),
  ]);
}

function check(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function checkText(text) {
  const dir = freshDir();
  const file = path.join(dir, "t.md");
  fs.writeFileSync(file, text);
  return { ...check([file]), file };
}

/** Problem lines of a CLI run, with the `check-tickets: <file>: ` prefix removed. */
function cliProblems(r) {
  const prefix = `check-tickets: ${r.file}: `;
  return r.out.split("\n").filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length));
}

function count(list, item) {
  return list.filter((x) => x === item).length;
}

// ---------- AC1 ----------

test("AC1 a scenario heading with no em-dash separator reports heading-no-separator once, keeps id = whole heading and an empty title, adds no id-shape problem, and exits 1", () => {
  // WHY: without " — " the id swallows the title; later per-scenario records keyed by id would inherit the
  // merged text, so the missing separator must be named, once, and not doubled by an id-shape line.
  for (const heading of ["S1 - hyphen not emdash", "S1"]) {
    const text = ticket({ scenarios: [rawScenario(heading)] });
    const res = parseTicketFile(text);
    assert.equal(count(res.problems, MSG.headingNoSeparator(heading)), 1, `${heading}: ${res.problems.join(" / ")}`);
    assert.ok(!res.problems.some((p) => p.startsWith("scenario id \"")), `${heading}: no id-shape line`);
    assert.equal(res.scenarios.length, 1, heading);
    assert.equal(res.scenarios[0].id, heading, "parse shape unchanged: id is the whole heading");
    assert.equal(res.scenarios[0].title, "", "parse shape unchanged: title is empty");
    const r = checkText(text);
    assert.equal(r.code, 1, `${heading}: ${r.out}`);
    assert.equal(count(cliProblems(r), MSG.headingNoSeparator(heading)), 1, r.out);
  }
});

test("AC1 a scenario id that is not a letter followed by letters, digits or - reports id-shape quoting the id, and exits 1", () => {
  // WHY: the doc defines the id shape; an id with spaces or a leading digit cannot key a later record safely.
  for (const id of ["1bad id with spaces", "S 1", "S_1"]) {
    const text = ticket({ scenarios: [rawScenario(`${id} — x`)] });
    const res = parseTicketFile(text);
    assert.equal(count(res.problems, MSG.idShape(id)), 1, `${id}: ${res.problems.join(" / ")}`);
    assert.ok(!res.problems.some((p) => p.startsWith("scenario heading \"")), `${id}: the separator is present`);
    assert.equal(res.scenarios[0].id, id);
    assert.equal(res.scenarios[0].title, "x");
    const r = checkText(text);
    assert.equal(r.code, 1, `${id}: ${r.out}`);
    assert.equal(count(cliProblems(r), MSG.idShape(id)), 1, r.out);
  }
});

test("AC1 well-formed ids S1, csv-header, a and Z9-x with the separator and a title report no heading or id problem", () => {
  // WHY: the new checks must not refuse the id shapes the doc itself gives as valid.
  const ids = ["S1", "csv-header", "a", "Z9-x"];
  const text = ticket({ scenarios: ids.map((id) => scenario(id)) });
  const res = parseTicketFile(text);
  assert.deepEqual(res.problems, []);
  assert.deepEqual(res.scenarios.map((s) => s.id), ids);
  assert.equal(checkText(text).code, 0);
});

// ---------- AC2 ----------

test("AC2 a needs device or person value other than yes or no reports yes-no, not the count-mismatch line, drops the field, and exits 1", () => {
  // WHY: before, "maybe" only surfaced as a scenario-count mismatch, sending the writer to count scenarios
  // instead of fixing the value; the value itself is what is wrong.
  for (const value of ["maybe", "Yes", "true", "' maybe '"]) {
    const shown = value === "' maybe '" ? "maybe" : value;
    for (const sc of [scenario("S1"), scenario("S1", [...GWT, "- Verification: device-or-person: look"])]) {
      const text = ticket({ fields: { "needs device or person": value }, scenarios: [sc] });
      const res = parseTicketFile(text);
      assert.equal(count(res.problems, MSG.yesNo(shown)), 1, `${value}: ${res.problems.join(" / ")}`);
      assert.ok(!res.problems.some((p) => COUNT_MISMATCH_RE.test(p)), `${value}: count-mismatch suppressed`);
      assert.ok(!("needs device or person" in res.fields), `${value}: field absent from fields`);
      const r = checkText(text);
      assert.equal(r.code, 1, `${value}: ${r.out}`);
      assert.equal(count(cliProblems(r), MSG.yesNo(shown)), 1, r.out);
      assert.doesNotMatch(r.out, COUNT_MISMATCH_RE);
    }
  }
});

test("AC2 yes and no, after trimming, keep the count-mismatch behaviour", () => {
  // WHY: the two documented values must still be cross-checked against the device-or-person scenarios.
  const dop = scenario("S1", [...GWT, "- Verification: device-or-person"]);
  assert.deepEqual(parseTicketFile(ticket({ fields: { "needs device or person": "' no '" } })).problems, []);
  assert.deepEqual(
    parseTicketFile(ticket({ fields: { "needs device or person": "yes" }, scenarios: [dop] })).problems, [],
  );
  const mismatch = parseTicketFile(ticket({ fields: { "needs device or person": "no" }, scenarios: [dop] }));
  assert.deepEqual(mismatch.problems, ['"needs device or person" is "no" but 1 scenario(s) use device-or-person']);
});

// ---------- AC3 ----------

test("AC3 a fenced Verification line inside a valid scenario is not a second verification, for ``` and ~~~ fences", () => {
  // WHY: quoting an example verification line in a code block must not break a valid scenario.
  for (const fence of ["```", "~~~"]) {
    for (const quoted of ["Verification: command x", "- Verification: command x"]) {
      const body = [...GWT, "- Verification: automated test", "", fence, quoted, fence];
      const text = ticket({ scenarios: [scenario("S1", body)] });
      const res = parseTicketFile(text);
      assert.deepEqual(res.problems, [], `${fence} ${quoted}`);
      assert.deepEqual(res.scenarios[0].verification, { kind: "automated-test" });
      const r = checkText(text);
      assert.equal(r.code, 0, r.out);
      assert.doesNotMatch(r.out, /has more than one verification/);
    }
  }
});

test("AC3 a Given, When or Then line found only inside a fence does not satisfy the missing-keyword check", () => {
  // WHY: the other direction: an example in a code block must not hide a line the scenario really lacks.
  for (const [i, kw] of [[0, "Given"], [1, "When"], [2, "Then"]]) {
    for (const fence of ["```", "~~~"]) {
      const kept = GWT.filter((_, j) => j !== i);
      const body = [...kept, "- Verification: automated test", "", fence, GWT[i], fence];
      const text = ticket({ scenarios: [scenario("S1", body)] });
      const res = parseTicketFile(text);
      assert.equal(count(res.problems, `scenario S1 has no ${kw} line`), 1, `${kw} ${fence}: ${res.problems.join(" / ")}`);
      const r = checkText(text);
      assert.equal(r.code, 1, r.out);
    }
  }
});

test("AC3 a Verification line found only inside a fence leaves the scenario with no verification", () => {
  for (const fence of ["```", "~~~"]) {
    const body = [...GWT, "", fence, "- Verification: automated test", fence];
    const text = ticket({ scenarios: [scenario("S1", body)] });
    const res = parseTicketFile(text);
    assert.equal(count(res.problems, "scenario S1 has no verification"), 1, `${fence}: ${res.problems.join(" / ")}`);
    assert.equal(checkText(text).code, 1);
  }
});

test("AC3 an Added line found only inside a fence leaves the added-during-build scenario without its Added line", () => {
  const added = rawScenario("S4 — Added later", [
    ...GWT, "- Verification: command npm test", "", "```", "- Added: the implementer, 2026-01-15, a reason", "```",
  ]);
  const text = ticket({ tail: `## Added during build\n\n${added}` });
  const res = parseTicketFile(text);
  assert.equal(count(res.problems, MISSING_ADDED("S4")), 1, res.problems.join(" / "));
  assert.equal(checkText(text).code, 1);
});

test("AC3 a heading inside a fence stays ignored and the fenced lines under it are not scenario lines either", () => {
  // WHY: existing behaviour (fenced headings ignored) must hold alongside the new fenced-line rule.
  const fenced = ["```", "### S9 — fake", "- Given g", "- Verification: automated test", "```"];
  const text = ticket({ scenarios: [scenario("S1", [...GWT, "- Verification: automated test", "", ...fenced])] });
  const res = parseTicketFile(text);
  assert.deepEqual(res.problems, []);
  assert.deepEqual(res.scenarios.map((s) => s.id), ["S1"]);
});

// ---------- AC4 ----------

function ws(config, { tickets, rootFiles } = {}) {
  const dir = freshDir();
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), JSON.stringify(config));
  }
  if (tickets) {
    fs.mkdirSync(path.join(dir, "docs", "tickets"), { recursive: true });
    for (const [name, text] of Object.entries(tickets)) fs.writeFileSync(path.join(dir, "docs", "tickets", name), text);
  }
  for (const [name, text] of Object.entries(rootFiles ?? {})) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

test("AC4 a ticketDir that normalizes to the workspace root or is whitespace-only is dropped silently and the default applies", () => {
  // WHY: "." made the no-argument checker sweep every root .md file; "  " pointed at a directory that never
  // exists, so the checker silently checked nothing. Both are unusable, and dropping is never an error.
  for (const v of [".", "./", "a/..", "  ", "\t", " "]) {
    const dir = ws({ schema_version: 2, ticketDir: v });
    assert.ok(!("ticketDir" in loadConfig(dir)), `${JSON.stringify(v)} must be absent`);
    assert.equal(resolveTicketDir(dir), path.join(dir, "docs/tickets"), JSON.stringify(v));
    assert.equal(getConfigError(dir), null, `${JSON.stringify(v)} must not be an error`);
  }
});

test("AC4 with a whitespace-only ticketDir and docs/tickets holding one valid ticket, the no-argument checker checks docs/tickets", () => {
  for (const v of ["  ", "\t"]) {
    const dir = ws({ schema_version: 2, ticketDir: v }, { tickets: { "x.md": ticket() } });
    const r = check([], dir);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(r.out.trim().split("\n"), [
      "check-tickets: ok docs/tickets/x.md (1 scenarios)",
      "check-tickets: 1 file(s), 1 scenario(s), 0 problem(s)",
    ], JSON.stringify(v));
  }
});

test("AC4 with ticketDir . the no-argument checker never checks the workspace root's .md files", () => {
  const rootFiles = { "notes.md": "# Notes\n\nnot a ticket\n" };
  for (const v of [".", "./", "a/.."]) {
    const withDir = ws({ schema_version: 2, ticketDir: v }, { tickets: { "x.md": ticket() }, rootFiles });
    const r1 = check([], withDir);
    assert.equal(r1.code, 0, r1.out + r1.err);
    assert.doesNotMatch(r1.out, /notes\.md/, JSON.stringify(v));
    assert.deepEqual(r1.out.trim().split("\n"), [
      "check-tickets: ok docs/tickets/x.md (1 scenarios)",
      "check-tickets: 1 file(s), 1 scenario(s), 0 problem(s)",
    ], JSON.stringify(v));
    const noDir = ws({ schema_version: 2, ticketDir: v }, { rootFiles });
    const r2 = check([], noDir);
    assert.equal(r2.code, 0, r2.out + r2.err);
    assert.equal(r2.out.trim(),
      "check-tickets: no ticket directory at docs/tickets; 0 file(s), 0 scenario(s), 0 problem(s)", JSON.stringify(v));
  }
});

test("AC4 sisterRepos entries whose path or owns is whitespace-only are dropped; whitespace-only backlog and contracts strings are left out; non-blank values stay verbatim", () => {
  // WHY: the shared non-empty-string rule now trims, so a value of only spaces counts as empty everywhere it
  // is used; a value with real text and surrounding spaces is still kept byte-verbatim.
  const dir = ws({
    schema_version: 2,
    sisterRepos: [
      { name: "a", path: "  ", owns: "x" },
      { name: "b", path: "../b", owns: "\t" },
      { name: "c", path: "../c", owns: "o", backlog: "  ", contracts: [" ", "README.md", "\t"] },
      { name: "d", path: "../d", owns: " owns ç ", contracts: ["  "] },
    ],
  });
  const cfg = loadConfig(dir);
  assert.equal(getConfigError(dir), null);
  assert.deepEqual(cfg.sisterRepos, [
    { name: "c", path: "../c", owns: "o", contracts: ["README.md"] },
    { name: "d", path: "../d", owns: " owns ç " },
  ]);
});

test("AC4 the usable ticketDir values ./x, a/../b, ..foo/tickets and work/tickets stay usable and verbatim", () => {
  for (const v of ["./x", "a/../b", "..foo/tickets", "work/tickets"]) {
    const dir = ws({ schema_version: 2, ticketDir: v });
    assert.equal(loadConfig(dir).ticketDir, v, v);
    assert.equal(resolveTicketDir(dir), path.join(dir, v), v);
  }
});

// ---------- AC5 ----------

const BLOCK_SEQ_WITH_EMPTY_ITEM = "\n  - E1\n  -";

test("AC5 a list entry that is not text reports entry-not-text with its 1-based position, not must be a list, and drops the field", () => {
  // WHY: "must be a list" was wrong for a value that IS a list; the writer must be pointed at the entry.
  const cases = [
    ["depends on", "[E1, [x]]", [2]],
    ["depends on", "[{k: v}, E2]", [1]],
    ["depends on", BLOCK_SEQ_WITH_EMPTY_ITEM, [2]],
    ["allowed paths", "[src/a.ts, k: v]", [2]],
    ["allowed paths", "[[a], src/a.ts, [b]]", [1, 3]],
    ["source", "[1234 rev 7, [x]]", [2]],
  ];
  for (const [name, value, positions] of cases) {
    const text = ticket({ fields: { [name]: value } });
    const res = parseTicketFile(text);
    const label = `${name}: ${JSON.stringify(value)}`;
    for (const i of positions) {
      assert.equal(count(res.problems, MSG.entryNotText(name, i)), 1, `${label}: ${res.problems.join(" / ")}`);
    }
    assert.equal(res.problems.filter((p) => p.startsWith(`field "${name}" entry `)).length, positions.length, label);
    assert.ok(!res.problems.includes(MUST_BE_LIST(name)), `${label}: no must-be-a-list`);
    assert.ok(!(name in res.fields), `${label}: field absent`);
    const r = checkText(text);
    assert.equal(r.code, 1, `${label}: ${r.out}`);
    assert.ok(!cliProblems(r).includes(MUST_BE_LIST(name)), r.out);
  }
});

test("AC5 a blank-text list entry reports entry-empty with its 1-based position, not must be a list, and drops the field", () => {
  const cases = [
    ["depends on", "[E1, '']", [2]],
    ["depends on", "['  ', E2]", [1]],
    ["allowed paths", "['', src/a.ts, '  ']", [1, 3]],
    ["source", "['', 1234 rev 7]", [1]],
  ];
  for (const [name, value, positions] of cases) {
    const text = ticket({ fields: { [name]: value } });
    const res = parseTicketFile(text);
    const label = `${name}: ${value}`;
    for (const i of positions) {
      assert.equal(count(res.problems, MSG.entryEmpty(name, i)), 1, `${label}: ${res.problems.join(" / ")}`);
    }
    assert.equal(res.problems.filter((p) => p.startsWith(`field "${name}" entry `)).length, positions.length, label);
    assert.ok(!res.problems.includes(MUST_BE_LIST(name)), `${label}: no must-be-a-list`);
    assert.ok(!(name in res.fields), `${label}: field absent`);
    assert.equal(checkText(text).code, 1, label);
  }
});

test("AC5 a list mixing not-text and blank entries reports one problem per bad entry", () => {
  const res = parseTicketFile(ticket({ fields: { "depends on": "[[a], E2, '', {k: v}]" } }));
  const entryProblems = res.problems.filter((p) => p.startsWith('field "depends on" entry ')).sort();
  assert.deepEqual(entryProblems, [
    MSG.entryNotText("depends on", 1), MSG.entryEmpty("depends on", 3), MSG.entryNotText("depends on", 4),
  ].sort());
  assert.ok(!res.problems.includes(MUST_BE_LIST("depends on")));
});

test("AC5 a source list with a bad entry reports only the entry problems, never a source-entry shape line for that field", () => {
  // WHY: one accurate message per entry; a second shape line for the same field would repeat the problem.
  const text = ticket({ fields: { source: "[[x], foo]" } });
  const res = parseTicketFile(text);
  assert.equal(count(res.problems, MSG.entryNotText("source", 1)), 1, res.problems.join(" / "));
  assert.ok(!res.problems.some((p) => p.startsWith("source entry ")), res.problems.join(" / "));
  assert.ok(!res.problems.includes(MUST_BE_LIST("source")));
  assert.ok(!("source" in res.fields));
});

test("AC5 a scalar written where a list is expected still reports must be a list", () => {
  for (const name of ["allowed paths", "depends on"]) {
    const res = parseTicketFile(ticket({ fields: { [name]: "src/a.ts" } }));
    assert.ok(res.problems.includes(MUST_BE_LIST(name)), `${name}: ${res.problems.join(" / ")}`);
    assert.ok(!res.problems.some((p) => p.startsWith(`field "${name}" entry `)), name);
  }
});

// ---------- AC6 ----------

test("AC6 an Added line with the documented shape but an impossible date reports added-date quoting the date, not the missing-Added line, and exits 1", () => {
  // WHY: "2026-13-45" matched the shape and passed; the record of when a scenario was added must be a real date.
  for (const date of ["2026-13-45", "2026-02-30", "2026-00-10", "2026-04-31", "2025-02-29", "2026-01-00", "1900-02-29"]) {
    const text = ticket({ tail: `## Added during build\n\n${addedScenario(`Added: me, ${date}, why`)}` });
    const res = parseTicketFile(text);
    assert.equal(count(res.problems, MSG.addedDate("S4", date)), 1, `${date}: ${res.problems.join(" / ")}`);
    assert.ok(!res.problems.includes(MISSING_ADDED("S4")), `${date}: missing-Added suppressed`);
    const r = checkText(text);
    assert.equal(r.code, 1, `${date}: ${r.out}`);
    assert.equal(count(cliProblems(r), MSG.addedDate("S4", date)), 1, r.out);
  }
});

test("AC6 real calendar dates, leap days included, are valid Added dates", () => {
  for (const date of ["2026-01-15", "2024-02-29", "2000-02-29", "2026-12-31"]) {
    const text = ticket({ tail: `## Added during build\n\n${addedScenario(`Added: me, ${date}, why`)}` });
    assert.deepEqual(parseTicketFile(text).problems, [], date);
  }
});

test("AC6 a badly shaped date keeps the existing missing-Added message and no added-date line", () => {
  const text = ticket({ tail: `## Added during build\n\n${addedScenario("Added: me, 15-01-2026, why")}` });
  const res = parseTicketFile(text);
  assert.equal(count(res.problems, MISSING_ADDED("S4")), 1, res.problems.join(" / "));
  assert.ok(!res.problems.some((p) => p.includes("is not a real calendar date")));
});

// ---------- AC7 ----------

const GOOD_ADDED = addedScenario("Added: the implementer, 2026-01-15, a reason");

test("AC7 a ## section after Added during build is reported once per heading, quoting the heading line, and exits 1", () => {
  // WHY: the doc makes Added during build the last section; anything after it is outside the format.
  const text = ticket({ tail: `## Added during build\n\n${GOOD_ADDED}\n## Notes\n\nSome prose.\n\n## More\n\nMore prose.\n` });
  const res = parseTicketFile(text);
  assert.equal(count(res.problems, MSG.sectionAfterAdded("## Notes")), 1, res.problems.join(" / "));
  assert.equal(count(res.problems, MSG.sectionAfterAdded("## More")), 1, res.problems.join(" / "));
  assert.deepEqual(res.scenarios.map((s) => s.id), ["S1", "S4"]);
  const r = checkText(text);
  assert.equal(r.code, 1, r.out);
  assert.equal(count(cliProblems(r), MSG.sectionAfterAdded("## Notes")), 1, r.out);
});

test("AC7 a ### scenario under a second Scenarios or a second Added during build section is reported as not read and is not a scenario", () => {
  // WHY: before, a second "## Scenarios" silently re-opened scenario parsing and a "### " under "## Notes"
  // was dropped without a word; a scenario must never disappear or slip in unannounced.
  for (const second of ["## Scenarios", "## Added during build", "## Notes"]) {
    const late = rawScenario("S9 — late", [...GWT, "- Verification: automated test", "- Added: me, 2026-01-15, why"]);
    const text = ticket({ tail: `## Added during build\n\n${GOOD_ADDED}\n${second}\n\n${late}` });
    const res = parseTicketFile(text);
    assert.equal(count(res.problems, MSG.sectionAfterAdded(second)), 1, `${second}: ${res.problems.join(" / ")}`);
    assert.equal(count(res.problems, MSG.headingNotRead("### S9 — late")), 1, `${second}: ${res.problems.join(" / ")}`);
    assert.deepEqual(res.scenarios.map((s) => s.id), ["S1", "S4"], second);
    const r = checkText(text);
    assert.equal(r.code, 1, r.out);
    assert.equal(count(cliProblems(r), MSG.headingNotRead("### S9 — late")), 1, r.out);
  }
});

test("AC7 a ticket whose Added during build is the last ## section, with or without scenarios, reports neither message", () => {
  const empty = ticket({ tail: "## Added during build\n" });
  const withOne = ticket({ tail: `## Added during build\n\n${GOOD_ADDED}` });
  const fencedHeading = ticket({ tail: `## Added during build\n\n${GOOD_ADDED}\n\`\`\`\n## Not a section\n### S8 — not a heading\n\`\`\`\n` });
  for (const text of [empty, withOne]) assert.deepEqual(parseTicketFile(text).problems, []);
  const res = parseTicketFile(fencedHeading);
  assert.ok(!res.problems.some((p) => p.includes("comes after \"## Added during build\"")), res.problems.join(" / "));
  assert.ok(!res.problems.some((p) => p.includes("is not read as a scenario")), res.problems.join(" / "));
});

// ---------- AC8 ----------

const DOC = fs.readFileSync(path.join(ROOT, "docs", "ticket-format.md"), "utf8");

function docSection(md, heading) {
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

const sentences = (text) => text.split(/(?<=[.!?])\s+/);
const paragraphs = (text) => text.split(/\n\s*\n/);

test("AC8 the Scenarios section states the heading holds an em dash between the scenario id and the title", () => {
  const intro = docSection(DOC, "## Scenarios").split("\n### ")[0];
  assert.ok(sentences(intro).some((s) => /between/i.test(s) && /\bid\b/i.test(s) && /title/i.test(s)
    && /(—|em dash)/i.test(s)), intro);
});

test("AC8 the doc states that lines inside a fenced code block are not read as headings, Given/When/Then/And, verification or Added lines", () => {
  // WHY: the checker now ignores fenced lines; a writer must learn the rule from the doc, not by trial.
  const hit = paragraphs(EXPLANATIONS).find((p) => /fenced code block/i.test(p) && /not read/i.test(p));
  assert.ok(hit, "a paragraph stating that fenced lines are not read");
  for (const re of [/heading/i, /\bGiven\b/, /\bWhen\b/, /\bThen\b/, /\bAnd\b/, /verification/i, /Added:/]) {
    assert.match(hit, re);
  }
});

test("AC8 the field-block section states that every list entry is non-empty text", () => {
  const fb = docSection(DOC, "## Field block");
  assert.ok(sentences(fb).some((s) => /entr(y|ies)/i.test(s) && /\btext\b/i.test(s)
    && /(non-empty|not empty|not be empty|never empty|cannot be empty)/i.test(s)), "list-entry rule sentence");
});

test("AC8 the needs device or person row still says yes or no and adds that any other value is refused", () => {
  const row = DOC.split("\n").find((l) => l.startsWith("| `needs device or person` |"));
  assert.ok(row, "field table row");
  assert.match(row, /`yes` or `no`/);
  assert.match(row, /(any )?other value[^|]*(refused|rejected|not valid|invalid|reported)/i);
});

test("AC8 the added-during-build section states the date must be a real calendar date and that a ## section after it is reported and its scenarios are not read", () => {
  const s = docSection(DOC, "### Scenarios added during the work");
  assert.ok(sentences(s).some((x) => /date/i.test(x) && /(real|calendar)/i.test(x)), "real calendar date rule");
  assert.ok(sentences(s).some((x) => /after/i.test(x) && /Added during build/.test(x)
    && /(reported|refused|a problem)/i.test(x)), "a section after Added during build is reported");
  assert.match(s, /not read/i);
});

test("AC8 the explanations still hold no link, no repo path and no ticket id beyond the doc's own example ids, and the example still passes the checker", () => {
  // WHY: the doc is read by adopters on its own; new sentences must not point at this repository's files or backlog.
  assert.doesNotMatch(EXPLANATIONS, /\]\(/);
  assert.doesNotMatch(EXPLANATIONS, /https?:\/\//);
  assert.doesNotMatch(EXPLANATIONS, /\b(docs|scripts|templates|specs|tools|content|test|dist)\//);
  const ids = EXPLANATIONS.match(/\b[A-Z]\d{2,}\b/g) ?? [];
  assert.deepEqual(ids.filter((id) => id !== "E900" && id !== "E899"), []);
  const example = DOC.match(/\n## Example ticket\n\n```markdown\n([\s\S]*?)\n```\n/)[1];
  const r = checkText(example + "\n");
  assert.equal(r.code, 0, r.out);
});

// ---------- AC9 ----------

const CONFIG_DOC = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");

/** One `- **<label>**` bullet line from a section. */
function bullet(text, label) {
  const line = text.split("\n").find((l) => l.startsWith(`- **${label}**`));
  assert.ok(line, `bullet ${label}`);
  return line;
}

test("AC9 the ticketDir Usable value bullet names whitespace-only values and values normalizing to . (the workspace root) as unusable", () => {
  const start = CONFIG_DOC.indexOf("### `ticketDir`");
  assert.ok(start >= 0);
  const rest = CONFIG_DOC.slice(start + 5);
  const end = rest.search(/^(###? |---)/m);
  const section = rest.slice(0, end < 0 ? undefined : end);
  const b = bullet(section, "Usable value.");
  assert.match(b, /whitespace/i);
  assert.match(b, /`\.`/);
  assert.match(b, /workspace root/i);
});

test("AC9 the sisterRepos Which entries are dropped bullet states that a string of only whitespace counts as empty", () => {
  const start = CONFIG_DOC.indexOf("### `sisterRepos`");
  assert.ok(start >= 0);
  const b = bullet(CONFIG_DOC.slice(start), "Which entries are dropped.");
  assert.ok(sentences(b).some((s) => /whitespace/i.test(s) && /empty/i.test(s)), b);
});

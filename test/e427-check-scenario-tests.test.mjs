// Coded by @qa-engineer
// Tests (T-E427-01) for specs/e427-ci-scenario-tests.md AC1-AC9, AC11-AC13: scripts/check-scenario-tests.mjs is the
// CI check that a `done` ticket's named tests (`Verification: test <file> — <title>`) exist and passed in the test
// runner's own result file. The point of the check is that the result comes from CI, not from any agent's report, so
// every test here drives the real CLI as a child process from a temporary directory holding a fixture ticket
// directory and a results file, and asserts on the exact Copy / Strings lines and the D9 exit codes.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseTicketFile } from "../dist/tools/ticket-file.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = path.join(ROOT, "scripts", "check-scenario-tests.mjs");
const ADAPTER = "./scripts/scenario-results-node.mjs";
const FIXTURES = path.join(ROOT, "test", "fixtures", "e427");
const BASE_TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e427-check-"));
after(() => fs.rmSync(BASE_TMP, { recursive: true, force: true }));

const P = "check-scenario-tests:";
const RENAME_HINT = "(if it was renamed, update this ticket's Verification line in the same change)";
const USAGE = `${P} usage: node scripts/check-scenario-tests.mjs --results <file> [--tickets <dir>] [--adapter <module>]`;
const NONE = `${P} no named test in a done ticket; results not read`;

const notFound = (t, s, f, ti) => `${P} ${t} ${s}: test not found: ${f} — ${ti} ${RENAME_HINT}`;
const skippedLine = (t, s, f, ti) => `${P} ${t} ${s}: test was skipped: ${f} — ${ti}`;
const failedLine = (t, s, f, ti) => `${P} ${t} ${s}: test failed: ${f} — ${ti}`;
const okSummary = (n, m) => `${P} ok — ${n} named test(s) in ${m} done ticket(s) passed`;
const problemSummary = (k, n, m) => `${P} ${k} problem(s) in ${n} named test(s) from ${m} done ticket(s)`;

/**
 * A ticket file in the docs/ticket-format.md format. `scenarios` is a list of [id, verification text].
 * `needs device or person` is derived the way the format requires (yes iff a device-or-person scenario).
 */
function ticket(id, status, scenarios) {
  const dop = scenarios.some(([, v]) => v.startsWith("device-or-person")) ? "yes" : "no";
  const body = scenarios
    .map(([sid, v]) => `### ${sid} — scenario ${sid}\n\n- Given a starting point\n- When something happens\n- Then a result shows\n- Verification: ${v}\n`)
    .join("\n");
  return [
    "---",
    `id: ${id}`,
    `title: fixture ticket ${id}`,
    "priority: P2",
    "depends on: []",
    "allowed paths: [src/fixture.ts]",
    `needs device or person: ${dop}`,
    `status: ${status}`,
    "---",
    "",
    "## Scenarios",
    "",
    body,
  ].join("\n");
}

let caseNo = 0;
/** A fresh temp working directory with tickets/<name>.md for each given [name, text]; validity-checked. */
function workspace(tickets, { validate = true } = {}) {
  const dir = path.join(BASE_TMP, `case-${++caseNo}`);
  fs.mkdirSync(path.join(dir, "tickets"), { recursive: true });
  for (const [name, text] of tickets) {
    if (validate) {
      // Precondition: the fixture ticket is itself valid, so a red result is the checker's, not the fixture's.
      assert.deepEqual(parseTicketFile(text).problems, [], `fixture ticket ${name} must be valid`);
    }
    fs.writeFileSync(path.join(dir, "tickets", name), text);
  }
  return dir;
}

function withResults(dir, fixture = "results-basic.xml") {
  fs.copyFileSync(path.join(FIXTURES, fixture), path.join(dir, "results.xml"));
  return dir;
}

function run(cwd, args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [CHECKER, ...args], { cwd, encoding: "utf8", env });
  const lines = (s) => s.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l !== "");
  return { code: r.status, out: lines(r.stdout), err: lines(r.stderr), raw: r.stdout + r.stderr };
}

const A = "test/a.test.mjs";

test("AC1 a done ticket whose named test passed exits 0 and prints the ok summary", () => {
  // WHY: the happy path must stay quiet but positive: a done ticket whose test really passed in CI is accepted.
  const dir = withResults(workspace([["t1.md", ticket("T1", "done", [["S1", `test ${A} — passing case`]])]]));
  const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r.code, 0, r.raw);
  assert.ok(r.out.includes(okSummary(1, 1)), r.raw);
});

test("AC2 a done ticket naming a test absent from the results exits 1 with the notFound line and the problem summary", () => {
  // WHY: a ticket must not be marked done on a test that does not exist; the line names ticket, scenario, file and title.
  const dir = withResults(workspace([["t2.md", ticket("T2", "done", [["S1", `test ${A} — missing case`]])]]));
  const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r.code, 1, r.raw);
  assert.ok(r.out.includes(notFound("T2", "S1", A, "missing case")), r.raw);
  assert.ok(r.out.includes(problemSummary(1, 1, 1)), r.raw);
});

test("AC3 a named test recorded as skipped, and one recorded as todo, each fail with the skipped line", () => {
  // WHY: a skipped or todo test did not check anything, so it cannot back a done scenario (D5: both are not passed).
  const dir = withResults(
    workspace([["t3.md", ticket("T3", "done", [["S1", `test ${A} — skipped case`], ["S2", `test ${A} — todo case`]])]]),
  );
  const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r.code, 1, r.raw);
  assert.ok(r.out.includes(skippedLine("T3", "S1", A, "skipped case")), r.raw);
  assert.ok(r.out.includes(skippedLine("T3", "S2", A, "todo case")), r.raw);
  assert.ok(r.out.includes(problemSummary(2, 2, 1)), r.raw);
});

test("AC4 a named test recorded as failed exits 1 with the failed line", () => {
  // WHY: the core promise: a done ticket whose test fails in CI fails the CI step, whatever any agent reported.
  const dir = withResults(workspace([["t4.md", ticket("T4", "done", [["S1", `test ${A} — failing case`]])]]));
  const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r.code, 1, r.raw);
  assert.ok(r.out.includes(failedLine("T4", "S1", A, "failing case")), r.raw);
  assert.ok(r.out.includes(problemSummary(1, 1, 1)), r.raw);
});

test("AC5 with no done ticket (not started / stopped, or no ticket directory) the checker exits 0 with the none line and never opens the results", () => {
  // WHY: only done tickets are a claim; unfinished tickets may name tests that do not exist yet. A repo without
  // tickets (this one, D12) must pass even though the results file it points at does not exist.
  const missing = path.join(BASE_TMP, "does-not-exist", "test-results.xml");
  const dir = workspace([
    ["open.md", ticket("T5A", "not started", [["S1", `test ${A} — not written yet`]])],
    ["halted.md", ticket("T5B", "stopped — waiting on vendor firmware", [["S1", `test ${A} — never written`]])],
  ]);
  const r1 = run(dir, ["--results", missing, "--tickets", "tickets"]);
  assert.equal(r1.code, 0, r1.raw);
  assert.ok(r1.out.includes(NONE), r1.raw);

  const r2 = run(dir, ["--results", missing, "--tickets", "no-such-ticket-dir"]);
  assert.equal(r2.code, 0, r2.raw);
  assert.ok(r2.out.includes(NONE), r2.raw);
});

test("AC6 a done ticket still naming a renamed test fails with the notFound line naming the old title and the rename instruction", () => {
  // WHY: renaming a test silently orphans the ticket's claim; CI must point at the ticket to update (D6), using
  // results produced by the real runner with the repo's adapter reporter, not a hand-written file.
  const dir = workspace([
    ["t6.md", ticket("T6", "done", [["S1", "test test/fixtures/e427/rename-target.mjs — header row comes first"]])],
  ]);
  const xml = path.join(dir, "results.xml");
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const node = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=tap",
      "--test-reporter-destination=stdout",
      `--test-reporter=${ADAPTER}`,
      `--test-reporter-destination=${xml}`,
      "test/fixtures/e427/rename-target.mjs",
    ],
    { cwd: ROOT, encoding: "utf8", env },
  );
  assert.equal(node.status, 0, node.stdout + node.stderr);
  assert.ok(fs.existsSync(xml), "the adapter reporter wrote the results file");

  const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r.code, 1, r.raw);
  const line = notFound("T6", "S1", "test/fixtures/e427/rename-target.mjs", "header row comes first");
  assert.ok(r.out.includes(line), r.raw);
});

test("AC7 the ticket must name the full nested title and the exact file; a leading ./ on the file is accepted", () => {
  // WHY: a bare leaf name or a partial path could match an unrelated test (same title in another suite or file),
  // so only the full ` > `-joined title in the named file counts (D4).
  const cases = [
    [`${A} — outer > inner > leaf`, 0],
    [`./${A} — outer > inner > leaf`, 0],
    [`${A} — leaf`, 1],
    [`${A} — inner > leaf`, 1],
    ["test/b.test.mjs — outer > inner > leaf", 1],
  ];
  for (const [verification, expected] of cases) {
    const dir = withResults(workspace([["t7.md", ticket("T7", "done", [["S1", `test ${verification}`]])]]));
    const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
    assert.equal(r.code, expected, `${verification}\n${r.raw}`);
    if (expected === 0) {
      assert.ok(r.out.includes(okSummary(1, 1)), `${verification}\n${r.raw}`);
    } else {
      const [file, title] = verification.split(" — ");
      assert.ok(r.out.includes(notFound("T7", "S1", file, title)), `${verification}\n${r.raw}`);
    }
  }
});

test("AC8 only `test` verifications are checked; automated test, command and device-or-person scenarios are not", () => {
  // WHY: an unnamed test has nothing to look up, and command / device-or-person checks are not runner results;
  // counting them would fail every honest ticket that uses them.
  const mixed = workspace([
    [
      "t8.md",
      ticket("T8", "done", [
        ["S1", `test ${A} — passing case`],
        ["S2", "automated test"],
        ["S3", "command npm run no-such-script"],
        ["S4", "device-or-person: open the file and compare the columns"],
      ]),
    ],
  ]);
  withResults(mixed);
  const r1 = run(mixed, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r1.code, 0, r1.raw);
  assert.ok(r1.out.includes(okSummary(1, 1)), r1.raw);

  const only = workspace([
    [
      "t8b.md",
      ticket("T8B", "done", [
        ["S1", "automated test"],
        ["S2", "command npm run no-such-script"],
        ["S3", "device-or-person: open the file and compare the columns"],
      ]),
    ],
  ]);
  const r2 = run(only, ["--results", path.join(only, "absent-results.xml"), "--tickets", "tickets"]);
  assert.equal(r2.code, 0, r2.raw);
  assert.ok(r2.out.includes(NONE), r2.raw);
});

test("AC9 a missing results file exits 2 with cannotReadResults, a non-JUnit file exits 2 with cannotParseResults (stderr)", () => {
  // WHY: when there is something to check but no readable result, the check cannot run; passing would hide every
  // missing test and failing as "not found" would blame the tickets (D8, D9).
  const dir = workspace([["t9.md", ticket("T9", "done", [["S1", `test ${A} — passing case`]])]]);
  const missing = path.join(dir, "no-results.xml");
  const r1 = run(dir, ["--results", missing, "--tickets", "tickets"]);
  assert.equal(r1.code, 2, r1.raw);
  assert.ok(
    r1.err.some((l) => l.startsWith(`${P} cannot read results ${missing}: `) && l.length > `${P} cannot read results ${missing}: `.length),
    r1.raw,
  );

  const garbage = path.join(dir, "not-junit.txt");
  fs.copyFileSync(path.join(FIXTURES, "not-junit.txt"), garbage);
  const r2 = run(dir, ["--results", garbage, "--tickets", "tickets"]);
  assert.equal(r2.code, 2, r2.raw);
  assert.ok(
    r2.err.some((l) => l.startsWith(`${P} cannot parse results ${garbage}: `) && l.length > `${P} cannot parse results ${garbage}: `.length),
    r2.raw,
  );
});

test("AC11 --adapter uses another module's readResults; a module without readResults exits 2 with adapterInvalid", () => {
  // WHY: adopters on other runners reuse the checker by supplying one function (D3/D10); the checker must use it
  // instead of its own JUnit reader, and refuse a module that does not provide it.
  const dir = workspace([["t11.md", ticket("T11", "done", [["S1", "test spec/fixed.spec.js — fixed suite > fixed title"]])]]);
  fs.copyFileSync(path.join(FIXTURES, "fixed-adapter.mjs"), path.join(dir, "fixed-adapter.mjs"));
  fs.copyFileSync(path.join(FIXTURES, "no-read-adapter.mjs"), path.join(dir, "no-read-adapter.mjs"));
  // The results file exists but is not XML: exit 0 proves no XML was parsed.
  fs.copyFileSync(path.join(FIXTURES, "not-junit.txt"), path.join(dir, "results.txt"));

  const r1 = run(dir, ["--results", "results.txt", "--tickets", "tickets", "--adapter", "./fixed-adapter.mjs"]);
  assert.equal(r1.code, 0, r1.raw);
  assert.ok(r1.out.includes(okSummary(1, 1)), r1.raw);

  const r2 = run(dir, ["--results", "results.txt", "--tickets", "tickets", "--adapter", "./no-read-adapter.mjs"]);
  assert.equal(r2.code, 2, r2.raw);
  assert.ok(
    r2.err.some((l) => /^check-scenario-tests: adapter \S*no-read-adapter\.mjs has no readResults function$/.test(l)),
    r2.raw,
  );
});

test("AC12 a done ticket with format problems exits 1 with the ticketProblems line", () => {
  // WHY: check-tickets does not run in CI, so a malformed done ticket could hide scenarios from this check (D7).
  const bad = [
    "---",
    "id: T12",
    "title: malformed done ticket",
    "priority: P2",
    "depends on: []",
    "allowed paths: [src/fixture.ts]",
    "needs device or person: no",
    "status: done",
    "---",
    "",
    "## Scenarios",
    "",
    "### S1 — no verification line",
    "",
    "- Given a starting point",
    "- When something happens",
    "- Then a result shows",
    "",
  ].join("\n");
  const parsed = parseTicketFile(bad);
  assert.equal(parsed.fields.status, "done", "fixture precondition: status is done");
  assert.ok(parsed.problems.length > 0, "fixture precondition: the file has a format problem");
  const dir = withResults(workspace([["bad-done.md", bad]], { validate: false }));
  const r = run(dir, ["--results", "results.xml", "--tickets", "tickets"]);
  assert.equal(r.code, 1, r.raw);
  assert.ok(
    r.out.some((l) => /^check-scenario-tests: \S*bad-done\.md: done ticket has format problems; run check-tickets on it$/.test(l)),
    r.raw,
  );
});

test("AC13 a missing --results or an unknown option exits 2 with the usage line on stderr", () => {
  // WHY: a CI step with a typo must not pass silently; a usage error is "cannot run", not "nothing to check".
  const dir = workspace([]);
  const r1 = run(dir, ["--tickets", "tickets"]);
  assert.equal(r1.code, 2, r1.raw);
  assert.ok(r1.err.includes(USAGE), r1.raw);

  const r2 = run(dir, ["--results", "results.xml", "--bogus"]);
  assert.equal(r2.code, 2, r2.raw);
  const i = r2.err.indexOf(`${P} unknown option --bogus`);
  assert.ok(i >= 0, r2.raw);
  assert.equal(r2.err[i + 1], USAGE, "the usage line follows the unknown-option line");
});

test("AC18 an adapter that cannot be imported prints adapterInvalid then adapterLoadError with the reason; a module without readResults prints no adapterLoadError", () => {
  // WHY: a typo in --adapter and a module lacking readResults used to print the same line, so the CI log gave no
  // clue which one happened (amendment 2026-11-25, R2). The adapterInvalid line stays as it was (AC11's anchored
  // assertion), and only an import that threw adds the reason line directly after it; exit stays 2 (cannot run).
  const dir = withResults(workspace([["t18.md", ticket("T18", "done", [["S1", `test ${A} — passing case`]])]]));
  fs.copyFileSync(path.join(FIXTURES, "no-read-adapter.mjs"), path.join(dir, "no-read-adapter.mjs"));
  // Written at run time, never tracked: a deliberately unparseable module must not sit in the repo for other tooling.
  fs.writeFileSync(path.join(dir, "broken-adapter.mjs"), "export function readResults( {\n");

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const invalidRe = (name) => new RegExp(`^check-scenario-tests: adapter \\S*${esc(name)} has no readResults function$`);
  const loadErrorRe = (name) => new RegExp(`^check-scenario-tests: cannot load adapter \\S*${esc(name)}: (.+)$`);

  // A path that does not exist, and a module that exists but does not parse: both are import failures.
  for (const name of ["missing-adapter.mjs", "broken-adapter.mjs"]) {
    const r = run(dir, ["--results", "results.xml", "--tickets", "tickets", "--adapter", `./${name}`]);
    assert.equal(r.code, 2, `${name}: ${r.raw}`);
    const i = r.err.findIndex((l) => invalidRe(name).test(l));
    assert.ok(i >= 0, `${name}: the adapterInvalid line is printed unchanged\n${r.raw}`);
    const m = loadErrorRe(name).exec(r.err[i + 1] ?? "");
    assert.ok(m, `${name}: the adapterLoadError line directly follows adapterInvalid\n${r.raw}`);
    assert.ok(m[1].trim().length > 0, `${name}: the reason is non-empty\n${r.raw}`);
  }

  // The AC11 case: the import succeeds, so there is no load error to report.
  const r3 = run(dir, ["--results", "results.xml", "--tickets", "tickets", "--adapter", "./no-read-adapter.mjs"]);
  assert.equal(r3.code, 2, r3.raw);
  assert.ok(r3.err.some((l) => invalidRe("no-read-adapter.mjs").test(l)), r3.raw);
  assert.ok(!r3.err.some((l) => l.startsWith(`${P} cannot load adapter `)), `an importable module prints no adapterLoadError\n${r3.raw}`);
});

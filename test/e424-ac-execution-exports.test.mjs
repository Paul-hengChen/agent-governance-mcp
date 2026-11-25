// Coded by @qa-engineer
// E424 unit contracts for the new gates/ac-execution.ts exports
// (specs/e424-per-scenario-acceptance-architecture.md, Interface Contracts 1-6).
// They pin the decided open questions the end-to-end AC tests in
// test/e424-per-scenario-acceptance.test.mjs do not reach: citation parsing (OQ-1, OQ-5),
// the last-section rule (OQ-6), the record entry shape (OQ-3, DR-5, DR-6) and the
// rejection text order (Copy ac.ticket.order). The module is imported as a namespace so
// each test reports on its own while an export is still missing.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import * as ace from "../dist/gates/ac-execution.js";

const HINT =
  "Under ## AC Execution Log in a qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count), " +
  "write one line per ticket scenario: \"- <scenario id> — <command or test> — <outcome or exit code> — pass\" " +
  "(or \"— fail\"). Every scenario verified by a test or a command needs a line ending in \"— pass\"; " +
  "device-or-person scenarios are listed for manual verification and never block. The server reads the record " +
  "and the ticket file only and runs nothing; whether each outcome is true stays with the judge.";

function fn(name) {
  assert.equal(typeof ace[name], "function", `gates/ac-execution.ts must export function ${name}`);
  return ace[name];
}

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e424u-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

test("contract 1: AC_TICKET_HINT is Copy ac.ticket.hint verbatim", () => {
  assert.equal(ace.AC_TICKET_HINT, HINT);
});

test("contract 2 (OQ-1): findTicketCitations accepts only an in-dir .md path right after a line-leading Ticket:", () => {
  const find = fn("findTicketCitations");
  const ws = mkWorkspace();
  const cases = [
    ["Ticket: `docs/tickets/e9.md`", ["docs/tickets/e9.md"]],
    ["ticket: docs/tickets/./e9.md", ["docs/tickets/e9.md"]],
    ["  TICKET:   docs/tickets/e9.md trailing words", ["docs/tickets/e9.md"]],
    ["Ticket: E424 (`docs/backlog.md` row)", []],
    ["Ticket: `docs/backlog.md` E109", []],
    ["Ticket: docs/tickets/../backlog.md", []],
    ["Ticket: /abs/docs/tickets/e9.md", []],
    ["Ticket: docs/tickets/e9.txt", []],
    ["Ticket: `docs/tickets/e9.md", []],
    ["Ticket: docs/tickets", []],
    ["See also Ticket: docs/tickets/e9.md", []],
    ["Ticket:", []],
  ];
  for (const [line, want] of cases) {
    assert.deepEqual(find(ws, `# spec\n\n${line}\n`), want, `citation of ${JSON.stringify(line)}`);
  }
});

test("contract 2 (DR-5, OQ-5 dedupe): fenced Ticket: lines are ignored; the same path twice counts once; order kept", () => {
  const find = fn("findTicketCitations");
  const ws = mkWorkspace();
  const spec = [
    "# spec",
    "```",
    "Ticket: docs/tickets/fenced.md",
    "```",
    "~~~",
    "Ticket: docs/tickets/tilde.md",
    "~~~",
    "Ticket: docs/tickets/b.md",
    "Ticket: `docs/tickets/./b.md`",
    "Ticket: docs/tickets/a.md",
    "",
  ].join("\n");
  assert.deepEqual(find(ws, spec), ["docs/tickets/b.md", "docs/tickets/a.md"]);
});

test("contract 2: a configured ticketDir moves the accepted directory", () => {
  const find = fn("findTicketCitations");
  const ws = mkWorkspace();
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify({ ticketDir: "work/tickets" }));
  assert.deepEqual(find(ws, "Ticket: work/tickets/t1.md\n"), ["work/tickets/t1.md"]);
  assert.deepEqual(find(ws, "Ticket: docs/tickets/t1.md\n"), [], "the default directory no longer counts");
});

test("contract 3 (OQ-6): sliceLastAcExecutionLog returns the body of the LAST matching H2, null when none", () => {
  const slice = fn("sliceLastAcExecutionLog");
  const content = [
    "# Review",
    "## r1 — FAIL",
    "## AC Execution Log",
    "- S1 — t — exit 1 — fail",
    "## r2 — PASS",
    "## AC Execution Log",
    "- S1 — t — exit 0 — pass",
    "## Trailer",
    "after",
  ].join("\n");
  const body = slice(content);
  assert.ok(body.includes("exit 0 — pass"), `the current round's section must be chosen; got ${JSON.stringify(body)}`);
  assert.ok(!body.includes("fail"), "the earlier round's section must not leak in");
  assert.ok(!body.includes("after"), "the body ends at the next ## heading");
  assert.equal(slice("# Review\n## Summary\nnothing\n"), null);
  // Schema >= 2 / no pin: a normalized-contains heading also matches; schema 1 keeps the exact anchor.
  const loose = "## Phase 3.5 — AC Execution Log\n- S1 — t — 0 — pass\n";
  assert.ok(slice(loose)?.includes("pass"), "no pin: normalized-contains heading matches");
  assert.equal(slice(loose, 1), null, "evidence schema 1: only the exact anchor matches");
});

test("contract 4 (OQ-3, DR-5, DR-6): parseAcceptanceRecord keeps only id-led ` — ` lines; last field decides pass", () => {
  const parse = fn("parseAcceptanceRecord");
  const section = [
    "- S1 — npm test — exit 0 — pass",
    "* S2 — npm test — exit 1 — fail",
    "S3 — touch x — exit 0 — pass   ",
    "  - S4 — pass",
    "- s1 — npm test — exit 0 — pass",
    "- S9 — not on the ticket — exit 0 — pass",
    "- S5 - hyphen not em dash - pass",
    "- S5—no—spaces—pass",
    "- S6 — t — exit 0 — PASS",
    "- S7 — t — exit 0 — passed",
    "```",
    "- S8 — inside a fence — exit 0 — fail",
    "```",
    "raw output line mentioning S1",
    "- S8",
  ].join("\n");
  const got = parse(section, ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
  assert.deepEqual(got, [
    { id: "S1", pass: true },
    { id: "S2", pass: false },
    { id: "S3", pass: true },
    { id: "S4", pass: true },
    { id: "S6", pass: false },
    { id: "S7", pass: false },
  ]);
});

function writeTicketWs({ spec, tickets = {}, review = null }) {
  const ws = mkWorkspace();
  fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
  fs.writeFileSync(path.join(ws, "specs", "f.md"), spec, "utf-8");
  for (const [rel, text] of Object.entries(tickets)) {
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.writeFileSync(path.join(ws, rel), text, "utf-8");
  }
  if (review !== null) {
    fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
    fs.writeFileSync(path.join(ws, "qa_reports", "review_T01.md"), review, "utf-8");
  }
  return ws;
}

const TICKET = [
  "---",
  "id: E900",
  "title: Fixture ticket",
  "priority: P2",
  "depends on: []",
  "allowed paths: [src/x.ts]",
  "needs device or person: yes",
  "status: not started",
  "---",
  "",
  "## Scenarios",
  "",
  "### S1 — one",
  "- Given a", "- When b", "- Then c",
  "- Verification: command npm test",
  "",
  "### S2 — two",
  "- Given a", "- When b", "- Then c",
  "- Verification: device-or-person: look",
  "",
].join("\n");

test("contract 5: evaluateTicketAcceptance is not armed without an in-dir citation (every list empty)", () => {
  const evaluate = fn("evaluateTicketAcceptance");
  const ws = writeTicketWs({ spec: "# f\n\nTicket: `docs/backlog.md` E1\n  proof: x\n" });
  const r = evaluate(ws, "f", ["T01"]);
  assert.equal(r.armed, false);
  assert.equal(r.rejected, false);
  assert.equal(r.problem, null);
  assert.deepEqual([r.ticketPaths, r.missingIds, r.notPassedIds, r.manualIds], [[], [], [], []]);
  assert.equal(evaluate(ws, "", ["T01"]).armed, false, "empty active feature -> not armed");
  assert.equal(evaluate(ws, "nope", ["T01"]).armed, false, "unreadable spec -> not armed");
});

test("contract 5 (OQ-5): two distinct in-dir citations -> problem many, ticket not evaluated", () => {
  const evaluate = fn("evaluateTicketAcceptance");
  const ws = writeTicketWs({
    spec: "# f\n\nTicket: docs/tickets/a.md\nTicket: docs/tickets/b.md\n",
    tickets: { "docs/tickets/a.md": TICKET, "docs/tickets/b.md": TICKET },
    review: "## AC Execution Log\n- S1 — npm test — 0 — pass\n",
  });
  const r = evaluate(ws, "f", ["T01"]);
  assert.equal(r.armed, true);
  assert.deepEqual(r.problem, { kind: "many" });
  assert.deepEqual(r.ticketPaths, ["docs/tickets/a.md", "docs/tickets/b.md"]);
  assert.deepEqual([r.missingIds, r.notPassedIds, r.manualIds], [[], [], []]);
  assert.equal(r.rejected, true);
  assert.ok(r.checkedPaths.length > 0, "checkedPaths is still filled when a problem is set");
});

test("contract 5: evaluated ticket fills missing / manual ids and specPath; a pass entry clears", () => {
  const evaluate = fn("evaluateTicketAcceptance");
  const spec = "# f\n\nTicket: docs/tickets/a.md\n";
  const wsMiss = writeTicketWs({ spec, tickets: { "docs/tickets/a.md": TICKET }, review: "## AC Execution Log\nprose\n" });
  const r = evaluate(wsMiss, "f", ["T01"]);
  assert.equal(r.specPath, path.join(wsMiss, "specs", "f.md"));
  assert.deepEqual(r.missingIds, ["S1"]);
  assert.deepEqual(r.manualIds, ["S2"]);
  assert.equal(r.rejected, true);
  const wsOk = writeTicketWs({
    spec, tickets: { "docs/tickets/a.md": TICKET }, review: "## AC Execution Log\n- S1 — npm test — 0 — pass\n",
  });
  const ok = evaluate(wsOk, "f", ["T01"]);
  assert.equal(ok.rejected, false);
  assert.deepEqual(ok.missingIds, []);
});

test("contract 6: renderTicketAcceptanceRejection follows Copy ac.ticket.order (problem branch, Inspected fallback)", () => {
  const render = fn("renderTicketAcceptanceRejection");
  const base = {
    armed: true,
    specPath: "/w/specs/f.md",
    ticketPaths: ["docs/tickets/a.md", "docs/tickets/b.md"],
    problem: { kind: "many" },
    missingIds: [],
    notPassedIds: [],
    manualIds: [],
    checkedPaths: [],
    rejected: true,
  };
  assert.equal(
    render(base, "v3"),
    "Spec /w/specs/f.md cites ticket file docs/tickets/a.md; the acceptance record must hold a passing entry for " +
      "every scenario verified by a test or a command. " +
      "The spec cites more than one ticket file (docs/tickets/a.md, docs/tickets/b.md); cite exactly one. " +
      "Inspected: (none — no review file resolved for the listed task(s)). " +
      "Evidence schema: v3. " +
      HINT,
  );
  const evaluated = {
    ...base,
    ticketPaths: ["docs/tickets/a.md"],
    problem: null,
    missingIds: ["S1", "S4"],
    notPassedIds: ["S2"],
    manualIds: ["S3"],
    checkedPaths: ["/w/qa_reports/review_T01.md", "/w/qa_reports/review_X.md"],
  };
  assert.equal(
    render(evaluated, "absent pin (v2 normalized-contains default)"),
    "Spec /w/specs/f.md cites ticket file docs/tickets/a.md; the acceptance record must hold a passing entry for " +
      "every scenario verified by a test or a command. " +
      "No entry for scenario(s): S1, S4. " +
      "Entry not marked pass for scenario(s): S2. " +
      "Awaiting manual verification (does not block PASS): S3. " +
      "Inspected: /w/qa_reports/review_T01.md, /w/qa_reports/review_X.md. " +
      "Evidence schema: absent pin (v2 normalized-contains default). " +
      HINT,
  );
});

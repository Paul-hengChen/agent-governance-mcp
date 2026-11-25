// Coded by @qa-engineer
// E424 per-scenario acceptance (specs/e424-per-scenario-acceptance.md, AC1-AC12 and AC14).
// When a spec cites a ticket file (`Ticket: docs/tickets/<name>.md`), the existing
// AC_EXECUTION_LOG_MISSING step on the judge's PASS must find a "pass" entry in the
// `## AC Execution Log` record for every scenario verified by a test or a command;
// device-or-person scenarios are listed as awaiting manual verification and never block.
// The check is additive: today's proof:-heading check still runs first, unchanged.
// Every AC test drives the real tw_update_state orchestrator (handleUpdateState) in file
// mode with a code-reviewer PASS write on a temp workspace whose other PASS gates pass.
// The record is carried by the write's own qa_review text, which the QA_REVIEW_RECORD step
// appends to qa_reports/review_<id>.md before this step reads it (same seam as
// test/ac-execution.test.mjs I1/I2). Only existing exports are imported, so every test
// reports on its own; the unit contracts live in test/e424-ac-execution-exports.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { handleUpdateState, UPDATE_STATE_GATE_PIPELINE } from "../dist/tools/handoff-orchestrator.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { GATE_REGISTRY } from "../dist/gates/registry.js";
import * as ticketFile from "../dist/tools/ticket-file.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

// Copy `ac.ticket.*` strings, quoted verbatim from the spec's Copy table.
const HINT =
  "Under ## AC Execution Log in a qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count), " +
  "write one line per ticket scenario: \"- <scenario id> — <command or test> — <outcome or exit code> — pass\" " +
  "(or \"— fail\"). Every scenario verified by a test or a command needs a line ending in \"— pass\"; " +
  "device-or-person scenarios are listed for manual verification and never block. The server reads the record " +
  "and the ticket file only and runs nothing; whether each outcome is true stays with the judge.";
const lead = (specPath, ticketPath) =>
  `Spec ${specPath} cites ticket file ${ticketPath}; the acceptance record must hold a passing entry for ` +
  "every scenario verified by a test or a command. ";
const noEntry = (ids) => `No entry for scenario(s): ${ids.join(", ")}. `;
const notPass = (ids) => `Entry not marked pass for scenario(s): ${ids.join(", ")}. `;
const manual = (ids) => `Awaiting manual verification (does not block PASS): ${ids.join(", ")}. `;
const missingFile = (p) => `The cited ticket file could not be read: ${p}. `;
const NO_TICKET_FRAGMENT = "declares ≥1 proof:-annotated AC but no ## AC Execution Log section was found";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e424-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function specPathOf(ws, feature) {
  return path.join(ws, "specs", `${feature}.md`);
}

/** Spec with an optional `Ticket:` citation line and an optional `proof:` line. */
function writeSpec(ws, feature, { ticket = null, proof = false, extraLines = [] } = {}) {
  const lines = [`# ${feature}`, ""];
  if (ticket !== null) lines.push(`Ticket: \`${ticket}\``, "");
  lines.push(...extraLines);
  lines.push("## Acceptance Criteria", "- **AC1** — Given X, when Y, then Z.");
  if (proof) lines.push("  proof: `mycli --version` prints the version.");
  lines.push("");
  fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
  fs.writeFileSync(specPathOf(ws, feature), lines.join("\n"), "utf-8");
}

/**
 * A ticket file in docs/ticket-format.md shape. `scenarios`: [{id, verification, added?}],
 * where verification is the text after "Verification: ".
 */
function ticketText(scenarios) {
  const needsPerson = scenarios.some((s) => s.verification.startsWith("device-or-person")) ? "yes" : "no";
  const out = [
    "---",
    "id: E900",
    "title: Fixture ticket",
    "priority: P2",
    "depends on: []",
    "allowed paths: [src/x.ts]",
    `needs device or person: ${needsPerson}`,
    "status: not started",
    "---",
    "",
    "## Scenarios",
    "",
  ];
  const block = (s) => {
    out.push(`### ${s.id} — scenario ${s.id}`, "", "- Given a state", "- When an action", "- Then a result");
    out.push(`- Verification: ${s.verification}`);
    if (s.added) out.push("- Added: the implementer, 2026-01-15, found during the work");
    out.push("");
  };
  scenarios.filter((s) => !s.added).forEach(block);
  const added = scenarios.filter((s) => s.added);
  if (added.length > 0) {
    out.push("## Added during build", "");
    added.forEach(block);
  }
  return out.join("\n");
}

function writeTicket(ws, rel, scenarios) {
  const abs = path.join(ws, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const text = ticketText(scenarios);
  fs.writeFileSync(abs, text, "utf-8");
  return text;
}

// Three blocking scenarios: a named test, an unnamed automated test (OQ-2) and a command.
const THREE_BLOCKING = [
  { id: "S1", verification: "test test/x.test.mjs — first behaviour" },
  { id: "S2", verification: "automated test" },
  { id: "S3", verification: "command npm test -- x" },
];

function recordLines(entries) {
  return ["## AC Execution Log", ...entries.map(([id, v]) => `- ${id} — npm test -- x — exit 0 — ${v}`), ""].join("\n");
}

async function seedJudgeInProgress(ws, feature) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["code-reviewer: claiming review"],
    lastAgent: "code-reviewer",
  });
  forceSeedStamp(ws);
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T01.md"), "# Code review\n\nVerdict: APPROVED\n");
}

/** The code-reviewer PASS write under test. Returns { isError, text }. */
async function passWrite(ws, feature, qaReview) {
  setActiveStorage(new FileHandoffStorage());
  await seedJudgeInProgress(ws, feature);
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "code-reviewer",
    completed_tasks: ["T01"],
    pending_notes: ["code-reviewer: T01 PASS"],
    qa_review: qaReview,
  });
  return { isError: Boolean(result.isError), text: result.content[0].text };
}

const TICKET_REL = "docs/tickets/e900.md";
const FEATURE = "e424-fixture";

function assertAccepted(r, why) {
  assert.equal(r.isError, false, `${why}; got: ${r.text}`);
  assert.ok(!r.text.includes("AC_EXECUTION_LOG_MISSING"), `${why}; got: ${r.text}`);
}

function assertTicketRejection(r, why) {
  assert.equal(r.isError, true, `${why}; got: ${r.text}`);
  assert.ok(r.text.startsWith("⛔ AC_EXECUTION_LOG_MISSING: T01. "), `${why}; got: ${r.text}`);
}

// ---------------------------------------------------------------------------
// AC1-AC7 — the ticket path
// ---------------------------------------------------------------------------

test("AC1: ticket with three blocking scenarios and a pass entry for each id -> PASS accepted", async () => {
  const ws = mkWorkspace();
  writeTicket(ws, TICKET_REL, THREE_BLOCKING);
  writeSpec(ws, FEATURE, { ticket: TICKET_REL });
  const r = await passWrite(ws, FEATURE, recordLines([["S1", "pass"], ["S2", "pass"], ["S3", "pass"]]));
  assertAccepted(r, "every blocking scenario has a pass entry, so the judge's PASS must land");
});

test("AC2: pass entries for two of three ids -> rejected, the missing id named under ac.ticket.no_entry, recorded ids not named", async () => {
  const ws = mkWorkspace();
  writeTicket(ws, TICKET_REL, THREE_BLOCKING);
  writeSpec(ws, FEATURE, { ticket: TICKET_REL });
  const r = await passWrite(ws, FEATURE, recordLines([["S1", "pass"], ["S3", "pass"]]));
  assertTicketRejection(r, "a blocking scenario with no entry must block PASS (a partial log cannot wave it through)");
  // Full Copy `ac.ticket.order` shape: prefix + lead + no_entry ... Inspected / Evidence schema ... hint.
  const head = "⛔ AC_EXECUTION_LOG_MISSING: T01. " + lead(specPathOf(ws, FEATURE), TICKET_REL) + noEntry(["S2"]);
  assert.ok(r.text.startsWith(head), `text must open with the lead and name exactly S2 missing;\nwant prefix: ${head}\ngot: ${r.text}`);
  assert.ok(!r.text.includes("Entry not marked pass"), "no not-pass sub-reason when every recorded entry passes");
  assert.ok(!r.text.includes("Awaiting manual verification"), "no manual sub-reason without device-or-person scenarios");
  assert.match(r.text, /Inspected: [^\n]*review_T01\.md[^\n]*\. Evidence schema: /, "Inspected / Evidence schema fragments reused from today's emit site");
  assert.ok(r.text.endsWith(HINT), `text must end with Copy ac.ticket.hint verbatim; got: ${r.text}`);
});

test("AC3: one of three entries marked fail -> rejected, that id named under ac.ticket.not_pass", async () => {
  const ws = mkWorkspace();
  writeTicket(ws, TICKET_REL, THREE_BLOCKING);
  writeSpec(ws, FEATURE, { ticket: TICKET_REL });
  const r = await passWrite(ws, FEATURE, recordLines([["S1", "pass"], ["S2", "fail"], ["S3", "pass"]]));
  assertTicketRejection(r, "a recorded-but-failed scenario must block PASS");
  assert.ok(r.text.includes(notPass(["S2"])), `text must name S2 under ac.ticket.not_pass; got: ${r.text}`);
  assert.ok(!r.text.includes("No entry for scenario(s)"), "a recorded id is not missing");
});

test("AC4: an added-during-build blocking scenario without an entry blocks PASS; with a pass entry the same write lands", async () => {
  const scenarios = [
    { id: "S1", verification: "test test/x.test.mjs — first behaviour" },
    { id: "S2", verification: "command npm test -- x" },
    { id: "S9", verification: "command npm test -- added", added: true },
  ];
  // First half: no entry for S9.
  const ws1 = mkWorkspace();
  writeTicket(ws1, TICKET_REL, scenarios);
  writeSpec(ws1, FEATURE, { ticket: TICKET_REL });
  const r1 = await passWrite(ws1, FEATURE, recordLines([["S1", "pass"], ["S2", "pass"]]));
  assertTicketRejection(r1, "a scenario under ## Added during build blocks like any other");
  assert.ok(r1.text.includes(noEntry(["S9"])), `text must name the added id S9; got: ${r1.text}`);
  // Second half: S9 recorded as pass.
  const ws2 = mkWorkspace();
  writeTicket(ws2, TICKET_REL, scenarios);
  writeSpec(ws2, FEATURE, { ticket: TICKET_REL });
  const r2 = await passWrite(ws2, FEATURE, recordLines([["S1", "pass"], ["S2", "pass"], ["S9", "pass"]]));
  assertAccepted(r2, "with a pass entry for the added scenario too, PASS must land");
});

test("AC5: device-or-person never blocks — (a) accepted without its entry; (b) listed under ac.ticket.manual, not as missing", async () => {
  const scenarios = [
    { id: "S1", verification: "test test/x.test.mjs — first behaviour" },
    { id: "S2", verification: "command npm test -- x" },
    { id: "S3", verification: "device-or-person: open the file and compare the columns" },
  ];
  // (a) every blocking scenario passes, S3 has no entry.
  const wsA = mkWorkspace();
  writeTicket(wsA, TICKET_REL, scenarios);
  writeSpec(wsA, FEATURE, { ticket: TICKET_REL });
  const rA = await passWrite(wsA, FEATURE, recordLines([["S1", "pass"], ["S2", "pass"]]));
  assertAccepted(rA, "a device-or-person scenario must never block the judge's PASS");
  // (b) S2 missing -> rejection lists S3 only as awaiting manual verification.
  const wsB = mkWorkspace();
  writeTicket(wsB, TICKET_REL, scenarios);
  writeSpec(wsB, FEATURE, { ticket: TICKET_REL });
  const rB = await passWrite(wsB, FEATURE, recordLines([["S1", "pass"]]));
  assertTicketRejection(rB, "a missing blocking scenario still rejects");
  assert.ok(rB.text.includes(noEntry(["S2"])), `S2 alone is missing; got: ${rB.text}`);
  assert.ok(rB.text.includes(manual(["S3"])), `S3 must be listed after ac.ticket.manual; got: ${rB.text}`);
  assert.ok(
    rB.text.indexOf(noEntry(["S2"])) < rB.text.indexOf(manual(["S3"])),
    "ac.ticket.order: no_entry precedes manual",
  );
  assert.ok(!rB.text.includes("Entry not marked pass"), "S3 must not be named as not passed");
});

test("AC6: no ## AC Execution Log at all — (a) no proof: line -> every blocking id under no_entry; (b) proof: line -> today's text alone", async () => {
  // (a) citation alone arms the ticket check.
  const wsA = mkWorkspace();
  writeTicket(wsA, TICKET_REL, THREE_BLOCKING);
  writeSpec(wsA, FEATURE, { ticket: TICKET_REL, proof: false });
  const rA = await passWrite(wsA, FEATURE, "Looks good; no execution log written.");
  assertTicketRejection(rA, "a ticket citation alone arms the per-scenario check");
  assert.ok(rA.text.includes(noEntry(["S1", "S2", "S3"])), `every blocking id must be named, in ticket order; got: ${rA.text}`);

  // (b) proof: + citation + no section -> byte-identical to the same write with no citation line.
  const wsB = mkWorkspace();
  writeTicket(wsB, TICKET_REL, THREE_BLOCKING);
  writeSpec(wsB, FEATURE, { ticket: TICKET_REL, proof: true });
  const rB = await passWrite(wsB, FEATURE, "Looks good; no execution log written.");
  const wsC = mkWorkspace();
  writeTicket(wsC, TICKET_REL, THREE_BLOCKING);
  writeSpec(wsC, FEATURE, { ticket: null, proof: true });
  const rC = await passWrite(wsC, FEATURE, "Looks good; no execution log written.");
  assert.equal(rB.isError, true, `today's proof: check still rejects; got: ${rB.text}`);
  assert.ok(rB.text.includes(NO_TICKET_FRAGMENT), `today's no-ticket sentence expected; got: ${rB.text}`);
  assert.equal(
    rB.text.split(wsB).join("<WS>"),
    rC.text.split(wsC).join("<WS>"),
    "ac.ticket.order: when both checks fail, today's text is emitted alone, byte-for-byte (no ticket text appended)",
  );
});

test("AC7: cited ticket file missing or unparsable -> rejected (fail closed) with ac.ticket.missing_file / ac.ticket.parse", async () => {
  // Missing file.
  const ws1 = mkWorkspace();
  writeSpec(ws1, FEATURE, { ticket: TICKET_REL });
  const r1 = await passWrite(ws1, FEATURE, recordLines([["S1", "pass"]]));
  assertTicketRejection(r1, "a citation of a file that does not exist must not silently disable the check");
  assert.ok(r1.text.includes(lead(specPathOf(ws1, FEATURE), TICKET_REL)), `lead expected; got: ${r1.text}`);
  assert.ok(r1.text.includes(missingFile(TICKET_REL)), `ac.ticket.missing_file expected; got: ${r1.text}`);
  assert.ok(!r1.text.includes("Awaiting manual verification"), "the ticket was not evaluated: no manual list");

  // Unparsable file: the parser's own first problem is shown verbatim with the count.
  const ws2 = mkWorkspace();
  const broken = ticketText(THREE_BLOCKING).replace("status: not started\n", "");
  const parsed = ticketFile.parseTicketFile(broken);
  assert.ok(parsed.problems.length > 0, "fixture precondition: the broken ticket has parse problems");
  fs.mkdirSync(path.join(ws2, "docs", "tickets"), { recursive: true });
  fs.writeFileSync(path.join(ws2, TICKET_REL), broken, "utf-8");
  writeSpec(ws2, FEATURE, { ticket: TICKET_REL });
  const r2 = await passWrite(ws2, FEATURE, recordLines([["S1", "pass"], ["S2", "pass"], ["S3", "pass"]]));
  assertTicketRejection(r2, "an unparsable cited ticket must fail closed");
  const parseLine =
    `The cited ticket file has ${parsed.problems.length} format problem(s); first: ${parsed.problems[0]}. `;
  assert.ok(r2.text.includes(parseLine), `ac.ticket.parse expected:\n${parseLine}\ngot: ${r2.text}`);
});

// ---------------------------------------------------------------------------
// AC8 — no-ticket path byte-identical (non-regression; green before and after the build)
// ---------------------------------------------------------------------------

test("AC8: no ticket citation -> today's behaviour byte-for-byte (proof: with/without heading, dormant, out-of-dir Ticket: line)", async () => {
  const hintStatic = GATE_REGISTRY.find((g) => g.errorCode === "AC_EXECUTION_LOG_MISSING").hintStatic;
  // The text today's emit site builds (tools/handoff-orchestrator.ts at base), reproduced literally.
  const todayText = (ws) =>
    "⛔ AC_EXECUTION_LOG_MISSING: T01. " +
    `Spec ${specPathOf(ws, FEATURE)} declares ≥1 proof:-annotated AC but no ` +
    "## AC Execution Log section was found for the listed task(s). " +
    'Expected heading: "## AC Execution Log". ' +
    `Inspected: ${path.join(ws, "qa_reports", "review_T01.md")}. ` +
    "Evidence schema: absent pin (v2 normalized-contains default). " +
    hintStatic;

  // (b) proof: and no heading -> today's exact text.
  const wsB = mkWorkspace();
  writeSpec(wsB, FEATURE, { proof: true });
  const rB = await passWrite(wsB, FEATURE, "Looks good; no execution log.");
  assert.equal(rB.isError, true);
  assert.equal(rB.text, todayText(wsB), "no-ticket rejection text must be byte-identical to today's");

  // (a) proof: and the heading present (prose content, no entry lines) -> accepted.
  const wsA = mkWorkspace();
  writeSpec(wsA, FEATURE, { proof: true });
  const rA = await passWrite(wsA, FEATURE, "## AC Execution Log\nAC1: ran it, exit 0. PASS.\n");
  assertAccepted(rA, "no-ticket path: heading presence alone still satisfies the step");

  // Dormant: no proof:, no citation.
  const wsD = mkWorkspace();
  writeSpec(wsD, FEATURE, {});
  assertAccepted(await passWrite(wsD, FEATURE, "Looks good."), "no proof: and no citation -> step dormant");

  // A Ticket: line outside the ticket directory (this repo's specs write these) is not a citation.
  const wsO = mkWorkspace();
  writeSpec(wsO, FEATURE, { proof: true, extraLines: ["Ticket: E109 (`docs/backlog.md` E109 row)", "Ticket: `docs/backlog.md` E109", ""] });
  const rO = await passWrite(wsO, FEATURE, "Looks good; no execution log.");
  assert.equal(rO.text, todayText(wsO), "an out-of-dir Ticket: line must leave today's text unchanged");
  // The rejection's telemetry line is the same as for the write with no Ticket: line.
  const telemetryOf = (ws) =>
    fs.readFileSync(resolveCurrentLanePaths(ws).telemetryPath, "utf-8").replace(/"ts":"[^"]*"/g, '"ts":"<t>"');
  assert.equal(telemetryOf(wsO), telemetryOf(wsB), "telemetry for the no-ticket rejection must be unchanged");
  const wsO2 = mkWorkspace();
  writeSpec(wsO2, FEATURE, { proof: false, extraLines: ["Ticket: `docs/backlog.md` E109", ""] });
  assertAccepted(await passWrite(wsO2, FEATURE, "Looks good."), "an out-of-dir Ticket: line alone does not arm anything");

  // On-disk state of an accepted no-ticket write is the same as without any Ticket: line.
  const handoffOf = (ws) =>
    fs.readFileSync(path.join(ws, ".current", "_primary", "handoff.md"), "utf-8")
      .replace(/^(last_updated|dispatched_at|updated_at):.*$/gm, "$1: <t>")
      .split(ws).join("<WS>");
  assert.equal(handoffOf(wsO2), handoffOf(wsD), "an accepted no-ticket write leaves the same handoff state");
});

// ---------------------------------------------------------------------------
// AC9 — reads files only, executes nothing
// ---------------------------------------------------------------------------

test("AC9: the ticket check runs no scenario command and imports no child_process", async () => {
  const ws = mkWorkspace();
  const marker = path.join(ws, "e424-marker.txt");
  writeTicket(ws, TICKET_REL, [
    { id: "S1", verification: "test test/x.test.mjs — first behaviour" },
    { id: "S2", verification: `command touch ${marker}` },
  ]);
  writeSpec(ws, FEATURE, { ticket: TICKET_REL });
  const r = await passWrite(ws, FEATURE, recordLines([["S1", "pass"]]));
  // The ticket path must have read the ticket (S2 named as missing) ...
  assertTicketRejection(r, "the ticket was read and S2 has no entry");
  assert.ok(r.text.includes(noEntry(["S2"])), `S2 must be named missing; got: ${r.text}`);
  // ... without running its command.
  assert.equal(fs.existsSync(marker), false, "the server must never run a scenario's command");
  const src = fs.readFileSync(path.join(ROOT, "gates", "ac-execution.ts"), "utf-8");
  assert.ok(!src.includes("child_process"), "gates/ac-execution.ts must not import child_process");
});

// ---------------------------------------------------------------------------
// AC10 — file mode only
// ---------------------------------------------------------------------------

test("AC10: the ticket check sits inside the PASS_AC_EXECUTION_LOG step's FileHandoffStorage guard (SQLite dormant)", () => {
  const src = fs.readFileSync(path.join(ROOT, "tools", "handoff-orchestrator.ts"), "utf-8");
  const stepIdx = src.indexOf('name: "PASS_AC_EXECUTION_LOG"');
  assert.ok(stepIdx !== -1, "PASS_AC_EXECUTION_LOG step must exist");
  const nextStepIdx = src.indexOf('name: "', stepIdx + 10);
  const step = src.slice(stepIdx, nextStepIdx === -1 ? undefined : nextStepIdx);
  const callIdx = step.indexOf("evaluateTicketAcceptance(");
  assert.ok(callIdx !== -1, "the step must call evaluateTicketAcceptance(");
  const guardIdx = step.lastIndexOf("if (storage instanceof FileHandoffStorage)", callIdx);
  assert.ok(guardIdx !== -1, "a FileHandoffStorage guard must precede the call inside the step");
  // The guard's block is still open at the call: brace depth from the guard's `{` stays > 0.
  let depth = 0;
  for (let i = step.indexOf("{", guardIdx); i < callIdx; i++) {
    if (step[i] === "{") depth++;
    else if (step[i] === "}") depth--;
    assert.ok(depth > 0, "the FileHandoffStorage guard block closes before the ticket call");
  }
});

// ---------------------------------------------------------------------------
// AC11 — no new gate, step or code; ticket-file exports unchanged (non-regression)
// ---------------------------------------------------------------------------

test("AC11: GATE_REGISTRY stays 33, the pipeline stays 17 steps, and the tools/ticket-file.ts exports keep their shape", () => {
  assert.equal(GATE_REGISTRY.length, 33, "no new gate / error code");
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, 17, "no new pipeline step");
  const step = UPDATE_STATE_GATE_PIPELINE.find((s) => s.name === "PASS_AC_EXECUTION_LOG");
  assert.deepEqual([...step.codes], ["AC_EXECUTION_LOG_MISSING"], "the step keeps its single code");
  assert.deepEqual(
    Object.keys(ticketFile).sort(),
    ["FORBIDDEN_FIELD_NAMES", "TICKET_FIELDS", "TICKET_STATUSES", "parseTicketFile", "runCheckTicketsCli"],
    "no export added to or removed from tools/ticket-file.ts",
  );
  assert.equal(ticketFile.parseTicketFile.length, 1, "parseTicketFile(text) arity unchanged");
  assert.equal(ticketFile.runCheckTicketsCli.length, 2, "runCheckTicketsCli(argv, cwd) arity unchanged");
});

// ---------------------------------------------------------------------------
// AC12 — code-reviewer step 8 states the record format and the ticket rule
// ---------------------------------------------------------------------------

test("AC12: skill-code-reviewer.md step 8 carries Copy sop.step8 verbatim and keeps the E433-pinned substrings", () => {
  const body = fs.readFileSync(path.join(ROOT, "content", "skill-code-reviewer.md"), "utf-8");
  const step8 = body.split("\n").find((l) => l.startsWith("8. **AC Execution**"));
  assert.ok(step8, "step 8 line must exist");
  const sopStep8 =
    "Write each entry as one line, `- <scenario id> — <command or test> — <outcome or exit code> — pass` " +
    "(or `— fail`); raw output may follow below it. When the spec cites a ticket file on a line " +
    "`Ticket: <path to the ticket file>`, the server reads the ticket and rejects PASS `AC_EXECUTION_LOG_MISSING` " +
    "while any scenario verified by a test or a command (added-during-build ones included) has no line ending in " +
    "`— pass`; device-or-person scenarios are listed for manual verification and never block. With no ticket file, " +
    "a `proof:`-annotated AC and no such section, PASS is rejected `AC_EXECUTION_LOG_MISSING`; the server checks " +
    "existence only. The server runs nothing.";
  assert.ok(step8.endsWith(sopStep8), `step 8 must end with Copy sop.step8 verbatim; got:\n${step8}`);
  assert.ok(
    !step8.includes("With a `proof:`-annotated AC and no such section"),
    "the replaced last sentence must be gone",
  );
  for (const s of [
    "**AC Execution**",
    "`## AC Execution Log`",
    "one entry per ticket scenario (per spec AC when there is no ticket file",
    "scenario id, command (or test), raw outcome / exit code, pass/fail",
  ]) {
    assert.ok(step8.includes(s), `E433-pinned substring must stay in step 8: ${s}`);
  }
  // Ships to adopters: no repo-only path and no bare ticket id outside the origin tag.
  const served = step8.replace(/<!-- origin:start -->.*?<!-- origin:end -->/g, "");
  assert.doesNotMatch(served, /\b(specs|gates|tools|docs)\/[\w.-]+/, "no repo-only path in step 8");
  assert.doesNotMatch(served, /\bE\d+\b/, "no bare ticket id in step 8");
});

// ---------------------------------------------------------------------------
// AC14 — additive, never a relaxation (non-regression guard; green before the build)
// ---------------------------------------------------------------------------

test("AC14: proof: + all-device-or-person ticket — no section rejects with today's text; section accepts; no proof: and no section accepts", async () => {
  const allPerson = [
    { id: "S1", verification: "device-or-person: look at it" },
    { id: "S2", verification: "device-or-person: ask a person" },
  ];
  // (a) proof: + citation + no section == the same write with the citation removed.
  const wsA = mkWorkspace();
  writeTicket(wsA, TICKET_REL, allPerson);
  writeSpec(wsA, FEATURE, { ticket: TICKET_REL, proof: true });
  const rA = await passWrite(wsA, FEATURE, "Looks good; no execution log.");
  const wsRef = mkWorkspace();
  writeTicket(wsRef, TICKET_REL, allPerson);
  writeSpec(wsRef, FEATURE, { ticket: null, proof: true });
  const rRef = await passWrite(wsRef, FEATURE, "Looks good; no execution log.");
  assert.equal(rA.isError, true, `a cited ticket must never relax today's proof: check; got: ${rA.text}`);
  assert.equal(
    rA.text.split(wsA).join("<WS>"),
    rRef.text.split(wsRef).join("<WS>"),
    "rejection text must equal the same write without the Ticket: line, byte-for-byte",
  );
  // (b) section present (any content) -> accepted.
  const wsB = mkWorkspace();
  writeTicket(wsB, TICKET_REL, allPerson);
  writeSpec(wsB, FEATURE, { ticket: TICKET_REL, proof: true });
  assertAccepted(
    await passWrite(wsB, FEATURE, "## AC Execution Log\nmanual checks pending.\n"),
    "zero blocking scenarios and today's heading present -> PASS lands",
  );
  // (c) no proof:, no section -> accepted.
  const wsC = mkWorkspace();
  writeTicket(wsC, TICKET_REL, allPerson);
  writeSpec(wsC, FEATURE, { ticket: TICKET_REL, proof: false });
  assertAccepted(await passWrite(wsC, FEATURE, "Looks good."), "an all-device-or-person ticket needs no record");
});

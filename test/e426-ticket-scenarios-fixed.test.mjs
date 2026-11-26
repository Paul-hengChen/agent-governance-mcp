// Coded by @qa-engineer
// Tests (T-E426-01) for specs/e426-ticket-scenarios-fixed.md AC1-AC10. WHY: a ticket file's scenarios are the
// contract; the spec cites them and copies none, and a case they miss is sorted three ways (extends decided
// behaviour -> appended by the planner or the test author with marks; decides new behaviour -> stop; interface
// detail -> the test author). Every SOP that touches the contract must say so, and the judge must read appended
// scenarios. Copy / Strings are pinned verbatim on the raw source AND the served text; AC10 drives the ticket
// checker and the per-scenario PASS check over temp fixtures. FROZEN literals are the base text, never read via git.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const count = (hay, needle) => hay.split(needle).length - 1;
const nonBlank = (lines) => lines.filter((l) => l.trim() !== "");

const { applyTextTransforms } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));
const { FileHandoffStorage, setActiveStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { handleUpdateState } = await import(path.join(ROOT, "dist", "tools", "handoff-orchestrator.js"));
const { writeHandoffState } = await import(path.join(ROOT, "dist", "tools", "handoff.js"));
const { resetSession, markStateRead } = await import(path.join(ROOT, "dist", "guards", "session.js"));
const { forceSeedStamp } = await import("./e148-seed-stamp.mjs");

const dispatch = (t) => applyTextTransforms(t, { fullDetail: false });
/** Raw source and the served dispatch bundle: every content assertion runs on both. */
const bothForms = (rel) => [
  ["raw", read(rel)],
  ["served", dispatch(read(rel))],
];

// ------------------------------------------------------------------ Copy / Strings (spec table, verbatim)
const C = {
  "C-PM1":
    "**With a ticket file** (ticket directory, `ticketDir` in `.current/.config.json`): one line `Ticket: <repository-relative path to the ticket file>`, then the ids of its scenarios, `## Added during build` ones included; copy no Given, When or Then line, the ticket file is the contract. Every scenario carries its own verification line, so `where feasible` below does not apply. **No ticket file**: ",
  "C-PM2":
    "**A case the ticket's scenarios miss**: it extends behaviour the ticket or existing code already decides → append it under the ticket file's `## Added during build` as a scenario with its verification line and `Added: the planner, <YYYY-MM-DD>, <reason>` (format: `<agc install>/docs/ticket-format.md`, `<agc install>` = agc's install directory); it decides new behaviour → Question Batch Gate, never an appended scenario; it is an interface detail (name, parameter, exit code, output format) → leave it to qa-engineer. Never edit or remove a scenario; only you (at the cut) and qa-engineer (while writing tests) append. ",
  "C-QA1": " and `## Added during build`",
  "C-QA2":
    "   h. **A case no scenario covers** (ticket file only; found while writing tests, or named by an sr-engineer return or a code-reviewer rejection): it extends behaviour the ticket or existing code already decides → append it under the ticket file's `## Added during build` (create that section at the end of the file when absent) as a scenario with its verification line and `Added: the test author, <YYYY-MM-DD>, <reason>`, then test it like any other scenario; it decides new behaviour → *Escalation Routes: scenario defect*; it is an interface detail → step c. Never edit or remove a scenario.",
  "C-QA3": " A case no scenario covers → step 4h.",
  "C-SR1":
    " WHEN the build meets a case no scenario covers → DO not build it unasked: one that extends behaviour the ticket or existing code already decides goes back the same way (return route 1, naming the case where the note names the test) for qa-engineer to append and test; one that decides new behaviour stops per *Escalation Routes: scenario cannot be built*. You never append a scenario or write its test.",
  "C-CR1": " and `## Added during build`",
  "C-CR2":
    " A case no scenario covers that extends behaviour the ticket or existing code already decides is a test defect too (qa-engineer appends it under `## Added during build` and tests it); one that decides new behaviour is a scenario defect. An appended scenario without its `Added:` line or its verification line is a test defect.",
  // Item (4) ruled option (a).
  "C-CO7a":
    " A ticket that has a ticket file does not take this shortcut: pm writes its spec, and the spec's `Ticket:` line is what the per-scenario check at PASS reads.",
  // Item (5) ruled option (a): C-TF1 + C-TF2. C-TF1 is wrapped at the doc's line width exactly as the spec shows.
  "C-TF1": [
    "A case that turns up during the work is sorted three ways. When it extends behaviour that the ticket or the",
    "existing code already decides, it is appended as a scenario, with its verification line. When it would decide",
    "new behaviour, it is not appended: the ticket is stopped with the question (see *Batch summary*). When it is",
    "only an interface detail the scenarios leave open, such as a name, a parameter, an exit code or an output",
    "format, the test author decides it and records it in their report. Scenarios are appended only by whoever",
    "plans the work, when it is cut, and by the test author, while writing the tests; whoever builds or reviews the",
    "work and finds such a case hands it to the test author instead.",
  ].join("\n"),
  "C-TF2": "- Added: the test author, 2026-01-15, a column name with a comma broke the header row",
};
// C-PM2 is inserted inside C-PM1 (before its `**No ticket file**: ` tail), so C-PM1 is pinned as head + tail.
const PM1_TAIL = "**No ticket file**: ";
const PM1_HEAD = C["C-PM1"].slice(0, -PM1_TAIL.length);

// ------------------------------------------------------------------ frozen base literals (ce36112)
const FROZEN = {
  // AC2: the no-ticket rules, from `BDD:` through the end of the `proof:` worked example.
  PM_NO_TICKET:
    "BDD: `Given / When / Then`. Each AC must be testable. **`proof:` annotation**<!-- origin:start --> (v3.77.0, E3)<!-- origin:end -->: where feasible — i.e. when an individual AC is provable by ONE command, ONE test (name), or ONE pixel-diff region — the AC carries an indented `proof:` line (first non-whitespace token of its own line, directly under the AC) naming that exact command/test-id/region; code-reviewer, the chain's judge, executes it verbatim at review time. This is a per-AC judgment, NOT a blanket requirement: a genuinely subjective AC (a UX judgment call with no single-command truth) MAY omit `proof:` — do not force fake automation onto criteria that cannot honestly carry it. Worked example:\n  ```markdown\n  - **AC1** — Given the CLI is installed, when `mycli --version` runs, then it prints the package.json version and exits 0.\n    proof: `mycli --version; echo \"exit=$?\"` prints the package.json version followed by `exit=0`.\n  ```",
  // AC5: the sr-engineer Escalation Routes section, unchanged.
  SR_ESCALATION:
    "## Escalation Routes\n\nCall shape: Constitution §3 *Escalation call format* (`agent_id=\"sr-engineer\"`; `next_role` is the first-class field — a `human` row means omit it; a `Blocked` write also carries `blocking_reason`). SOP steps reference rows by situation name.\n\n| situation | status | pending note | next_role |\n|---|---|---|---|\n| awaiting clarification | Blocked | `sr-engineer: awaiting clarification — <question>` | human |\n| task oversized | Blocked | `Task <id> oversized — recommend PM split` | pm |\n| visual structure unspecified | Blocked | `sr-engineer: visual structure unspecified — <surface/state>` | design-auditor |\n| test contradicts a scenario or existing code (return route 1) | In_Progress | `sr-engineer: return to qa-engineer — <test>: <concrete reason>` | qa-engineer |\n| `sr_return` cap reached (`sr_return_count` at the cap) | Blocked | `sr-engineer: sr_return cap reached — <test>: <reason>` | pm |\n| scenario cannot be built (return route 2) | Blocked | `sr-engineer: scenario cannot be built — <scenario id>: <reason>` | pm |\n",
  // AC7: the coord-07 (ii) mini-chain line at base; option (a) appends C-CO7a and changes nothing else.
  CO7_MINI:
    "   - **(ii) mini-chain** — the backlog row itself as the spec, skipping the PM spec and ARCH: open with a pm-stamped write (`agent_id=\"pm\"`, `status=In_Progress`), then qa-engineer → sr-engineer → code-reviewer (the build-entry gates apply to the pm → qa-engineer hop); test-only work takes this mini-chain too. Evidence-only work: code-reviewer alone via the single-role judge-dispatch charter (Constitution §3.1).",
  // AC4: e425's C-QA, which must stay the last bullet of qa step 6.
  E425_C_QA:
    "   - **Ticket verification field**: with a ticket file, replace the `Verification: automated test` line of each scenario you wrote a test for with `Verification: test <test file path> — <full nested title>` (the names of the enclosing groups and of the test, joined by ` > `). Edit only that line, never a Given, When or Then line.",
  // AC6: e425's C-CR (step 4a).
  E425_C_CR:
    "4a. **Named tests**: for each scenario whose verification line names a test (`Verification: test <file> — <title>`), confirm a test with that full nested title exists in that file and its assertions check that scenario; a name that matches no test, or a test that checks something else, is a `required` finding (test defect).",
};

const AC_PREFIX = "- **Acceptance Criteria** — ";
const acLine = (text) => {
  const hits = text.split("\n").filter((l) => l.startsWith(AC_PREFIX));
  assert.equal(hits.length, 1, "exactly one Acceptance Criteria schema bullet");
  return hits[0];
};
const lineWith = (text, anchor) => {
  const hits = text.split("\n").filter((l) => l.includes(anchor));
  assert.equal(hits.length, 1, `anchor must hit exactly one line: ${anchor}`);
  return hits[0];
};

// ------------------------------------------------------------------ AC1

test("AC1: skill-pm's Acceptance Criteria bullet starts with C-PM1 directly after the bullet label (ticket file cited, scenarios not copied, where feasible not applicable)", () => {
  for (const [form, text] of bothForms("content/skill-pm.md")) {
    const l = acLine(text);
    assert.ok(l.startsWith(AC_PREFIX + PM1_HEAD), `${form}: the bullet must open with C-PM1; got: ${l.slice(0, 200)}`);
    assert.equal(count(text, PM1_HEAD), 1, `${form}: C-PM1 once`);
    // C-PM1's tail hands over to the no-ticket rules, which follow it on the same line.
    const tailAt = l.indexOf(PM1_TAIL + "BDD: `Given / When / Then`.");
    assert.ok(tailAt > (AC_PREFIX + PM1_HEAD).length - 1, `${form}: C-PM1's tail \`**No ticket file**: \` leads into the BDD rules`);
  }
});

// ------------------------------------------------------------------ AC2 (expected green at base)

test("AC2: a spec with no ticket file keeps today's rules — the BDD-through-proof-example text is byte-identical to base and `where feasible` remains", () => {
  const raw = read("content/skill-pm.md");
  assert.equal(count(raw, FROZEN.PM_NO_TICKET), 1, "raw: the no-ticket rules are byte-identical to base, once");
  const served = dispatch(raw);
  assert.equal(count(served, dispatch(FROZEN.PM_NO_TICKET)), 1, "served: the no-ticket rules are unchanged, once");
  for (const [form, text] of [["raw", raw], ["served", served]]) {
    const l = acLine(text);
    assert.ok(l.includes("where feasible — i.e. when an individual AC is provable"), `${form}: the where-feasible rule stays on the bullet`);
  }
});

// ------------------------------------------------------------------ AC3

test("AC3: skill-pm carries C-PM2 once, between C-PM1's `does not apply.` and `**No ticket file**: `, on the same line; the file keeps 119 lines", () => {
  const raw = read("content/skill-pm.md");
  assert.equal(raw.replace(/\n$/, "").split("\n").length, 119, "skill-pm keeps its 119 lines (line-number pins elsewhere)");
  for (const [form, text] of bothForms("content/skill-pm.md")) {
    assert.equal(count(text, C["C-PM2"]), 1, `${form}: C-PM2 once`);
    const l = acLine(text);
    assert.ok(
      l.startsWith(AC_PREFIX + PM1_HEAD + C["C-PM2"] + PM1_TAIL + "BDD: `Given / When / Then`. Each AC must be testable."),
      `${form}: label, C-PM1 head, C-PM2, C-PM1 tail, then the BDD rules, in that order on one line`,
    );
  }
});

// ------------------------------------------------------------------ AC4

test("AC4: skill-qa-engineer reads the Added during build section (C-QA1), ends step 4 with sub-step h (C-QA2) before `5. **Run**`, and step 8's sr-engineer return carries C-QA3; e425's C-QA stays last in step 6", () => {
  for (const [form, text] of bothForms("content/skill-qa-engineer.md")) {
    const lines = text.split("\n");
    // Step 3: C-QA1 right after the ticket file's `## Scenarios`.
    const s3 = lineWith(text, "3. **Read first**");
    assert.ok(s3.includes("the ticket file's `## Scenarios`" + C["C-QA1"] + " (ticket directory"), `${form}: step 3 reads ## Added during build too`);
    // Step 4: C-QA2 is the last sub-step, directly after sub-step g, directly before step 5.
    const s4 = lines.findIndex((l) => l.startsWith("4. **Write the tests**"));
    const s5 = lines.findIndex((l) => l.startsWith("5. **Run**"));
    assert.ok(s4 >= 0 && s5 > s4, `${form}: steps 4 and 5 present in order`);
    const step4 = nonBlank(lines.slice(s4 + 1, s5));
    assert.equal(step4[step4.length - 1], C["C-QA2"], `${form}: C-QA2 is the last sub-step of step 4`);
    assert.ok(step4[step4.length - 2].startsWith("   g. **Visual checks**"), `${form}: C-QA2 directly follows sub-step g`);
    assert.equal(lines[s5 - 1], "", `${form}: a blank line separates C-QA2 from step 5`);
    assert.equal(count(text, C["C-QA2"]), 1, `${form}: C-QA2 once`);
    // Step 8: C-QA3 right after the scenario-defect sentence of the sr-engineer return bullet.
    const ret = lineWith(text, "   - **sr-engineer return**");
    assert.ok(
      ret.includes("escalate per *Escalation Routes: scenario defect*." + C["C-QA3"] + " Each return counts toward the `sr_return` cap"),
      `${form}: C-QA3 sits right after the scenario-defect sentence`,
    );
    // e425: C-QA remains the last bullet of step 6.
    const s6 = lines.findIndex((l) => l.startsWith("6. **Record**:"));
    const s7 = lines.findIndex((l) => l.startsWith("7. **Hand off to sr-engineer**"));
    const step6 = nonBlank(lines.slice(s6 + 1, s7));
    assert.equal(step6[step6.length - 1], FROZEN.E425_C_QA, `${form}: e425 C-QA is still the last bullet of step 6`);
  }
});

// ------------------------------------------------------------------ AC5

test("AC5: skill-sr-engineer step 4c carries C-SR1 directly before ` ELSE build to the tests.`; its Escalation Routes are unchanged", () => {
  for (const [form, text] of bothForms("content/skill-sr-engineer.md")) {
    const l = lineWith(text, "4c. **Return routes**");
    assert.ok(
      l.endsWith("— to pm, never to qa-engineer." + C["C-SR1"] + " ELSE build to the tests."),
      `${form}: C-SR1 between the scenario-cannot-be-built route and the ELSE clause`,
    );
    assert.equal(count(text, C["C-SR1"]), 1, `${form}: C-SR1 once`);
  }
  const raw = read("content/skill-sr-engineer.md");
  assert.equal(count(raw, FROZEN.SR_ESCALATION), 1, "raw: Escalation Routes section byte-identical to base");
  assert.equal(count(dispatch(raw), dispatch(FROZEN.SR_ESCALATION)), 1, "served: Escalation Routes section unchanged");
});

// ------------------------------------------------------------------ AC6

test("AC6: skill-code-reviewer Clean context reads the Added during build section (C-CR1); step 4 carries C-CR2 directly after `a rejection reason (test defect).`; step 4a then step 5 follow", () => {
  for (const [form, text] of bothForms("content/skill-code-reviewer.md")) {
    const clean = lineWith(text, "- **Clean context**");
    assert.ok(clean.includes("the ticket file's `## Scenarios`" + C["C-CR1"] + ", `specs/<feature>.md`"), `${form}: Clean context reads ## Added during build`);
    const lines = text.split("\n");
    const s4 = lines.findIndex((l) => l.startsWith("4. **Review the tests**"));
    assert.ok(s4 >= 0, `${form}: step 4 present`);
    assert.ok(
      lines[s4].includes("a rejection reason (test defect)." + C["C-CR2"] + " Accept the open interface details"),
      `${form}: C-CR2 directly after the test-defect sentence, before the interface-details sentence`,
    );
    assert.equal(count(text, C["C-CR2"]), 1, `${form}: C-CR2 once`);
    const after = nonBlank(lines.slice(s4 + 1));
    assert.equal(after[0], FROZEN.E425_C_CR, `${form}: step 4a still directly follows step 4`);
    assert.ok(after[1].startsWith("5. **Review the implementation**"), `${form}: step 5 follows step 4a`);
  }
});

// ------------------------------------------------------------------ AC7 (ruled item (4) -> option (a))

test("AC7: coord-07's (ii) mini-chain bullet is the base line plus C-CO7a at its end, nothing else changed (ruled option (a))", () => {
  for (const [form, text] of bothForms("content/coord-07-core-sop.md")) {
    const l = lineWith(text, "**(ii) mini-chain**");
    assert.equal(l, dispatch(FROZEN.CO7_MINI) + C["C-CO7a"], `${form}: base line + C-CO7a exactly`);
    for (const other of ["may take this mini-chain with no pm session", "with the ticket file itself as the spec"]) {
      assert.ok(!text.includes(other), `${form}: the unruled option text (${other}) is absent`);
    }
  }
});

// ------------------------------------------------------------------ AC8 (ruled item (5) -> option (a))

const TICKET_DOC = () => read("docs/ticket-format.md");
function docSection(md, heading) {
  const start = md.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const rest = md.slice(start + heading.length + 2);
  const end = rest.search(/^#{1,3} /m);
  return end < 0 ? rest : rest.slice(0, end);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e426-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
function runChecker(file) {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-tickets.mjs"), file], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

test("AC8: the ticket-format section Scenarios added during the work ends with the C-TF1 paragraph and the example's Added: line is C-TF2; the example still checks with 4 scenarios (ruled option (a))", () => {
  const doc = TICKET_DOC();
  const sec = docSection(doc, "### Scenarios added during the work");
  assert.ok(
    sec.endsWith("ticket is stopped (`stopped — <reason>`) and re-agreed instead.\n\n" + C["C-TF1"] + "\n\n"),
    `the section ends with the base stop sentence, one blank line, then C-TF1 as wrapped; got tail:\n${sec.slice(-400)}`,
  );
  assert.equal(count(doc, C["C-TF1"]), 1, "C-TF1 once");
  const ex = doc.match(/\n## Example ticket\n\n```markdown\n([\s\S]*?)\n```\n/);
  assert.ok(ex, "the example ticket block is present");
  const exLines = ex[1].split("\n");
  assert.deepEqual(exLines.filter((l) => l.startsWith("- Added: ")), [C["C-TF2"]], "the example's only Added: line is C-TF2");
  assert.ok(!doc.includes("Added: the implementer"), "no `the implementer` who-word left in the doc");
  const file = path.join(TMP, "example.md");
  fs.writeFileSync(file, ex[1] + "\n");
  const r = runChecker(file);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok .*example\.md \(4 scenarios\)/);
});

// ------------------------------------------------------------------ AC9

// Pairing rule (as test/e433-test-first-rules.test.mjs): a clause that gives qa-engineer a judge action and
// neither negates it nor names the judge is a violation.
const JUDGE_TERM = /status=PASS|\bPASS\b(?!_)|tw_complete_task|completed_tasks|tw_rollback_task/;
const QA_ACTOR = /qa-engineer(?!'s)|the test author/;
const NEGATED = /\b(never|not|no|cannot|can't|don't|nor|must not)\b/i;
const JUDGE_NAMED = /code-reviewer|the chain's judge/;
const clauses = (t) =>
  t.split(/(?<=[.;!?])\s+|\n+/).flatMap((s) => s.split(/, | — |: |(?= then )/)).filter((c) => c.trim() !== "");
const REPO_ONLY_PATH = /(?<!<agc install>\/)(?<![\w./-])(docs|specs|test|tools|gates|scripts|prompts|content|dist|templates|research|review_reports|qa_reports)\/[\w.<>*-]/;

test("AC9: every string the lane adds is present and names no repo-only path, no bare ticket id or version label, no backtick-quoted error code, and gives qa-engineer no judge action", () => {
  const ADDED = {
    "content/skill-pm.md": ["C-PM1", "C-PM2"],
    "content/skill-qa-engineer.md": ["C-QA1", "C-QA2", "C-QA3"],
    "content/skill-sr-engineer.md": ["C-SR1"],
    "content/skill-code-reviewer.md": ["C-CR1", "C-CR2"],
    "content/coord-07-core-sop.md": ["C-CO7a"],
    "docs/ticket-format.md": ["C-TF1", "C-TF2"],
  };
  for (const [file, ids] of Object.entries(ADDED)) {
    const raw = read(file);
    for (const id of ids) {
      // C-PM1 ships split around C-PM2 (AC3), so its presence is checked as head + tail.
      const parts = id === "C-PM1" ? [PM1_HEAD, PM1_TAIL] : [C[id]];
      for (const p of parts) assert.ok(raw.includes(p), `${id} is added to ${file}`);
      if (file.startsWith("content/")) for (const p of parts) assert.ok(dispatch(raw).includes(p), `${id} is served from ${file}`);
      const s = C[id];
      assert.doesNotMatch(s, REPO_ONLY_PATH, `${id}: no repo-only path (only <agc install>/… or a pattern)`);
      assert.doesNotMatch(s, /\bE\d{2,4}[a-z]?\b/, `${id}: no bare ticket id`);
      assert.doesNotMatch(s, /\bv\d+\.\d+(\.\d+)?\b/, `${id}: no version label`);
      assert.doesNotMatch(s, /`[A-Z][A-Z0-9]*_[A-Z0-9_]+`/, `${id}: no backtick-quoted error code`);
      const qaVoice = file === "content/skill-qa-engineer.md";
      const bad = clauses(s).filter(
        (c) => JUDGE_TERM.test(c) && (qaVoice || QA_ACTOR.test(c)) && !NEGATED.test(c) && !JUDGE_NAMED.test(c),
      );
      assert.deepEqual(bad, [], `${id}: no clause gives qa-engineer a judge action`);
    }
  }
});

// ------------------------------------------------------------------ AC10 (existing behaviour, expected green at base)

const TICKET_REL = "docs/tickets/E901.md";
const FEATURE = "e426-fixture";
const REASON = "a column name with a comma broke the header row";
const TICKET_TEXT = [
  "---",
  "id: E901",
  "title: CSV export quotes header names",
  "priority: P2",
  "depends on: []",
  "allowed paths: [src/export/csv.ts, test/export-csv.test.ts]",
  "needs device or person: no",
  "status: not started",
  "---",
  "",
  "## Scenarios",
  "",
  "### S1 — Header row comes first",
  "",
  "- Given a report with the columns date, amount and note",
  "- When the report is exported as CSV",
  "- Then the first line is date,amount,note",
  "- Verification: automated test",
  "",
  "### S2 — Empty report still has a header",
  "",
  "- Given a report with no rows",
  "- When the report is exported as CSV",
  "- Then the file holds exactly one line, the header row",
  "- Verification: command npm test -- export-csv",
  "",
  "## Added during build",
  "",
  "### S3 — Header names are quoted when needed",
  "",
  '- Given a column named "amount, net"',
  "- When the report is exported as CSV",
  "- Then that header cell is written in double quotes",
  "- Verification: automated test",
  `- Added: the test author, 2026-01-15, ${REASON}`,
  "",
].join("\n");
// The C-PM1 form: one Ticket: line, the scenario ids (the appended one included), no Given/When/Then line.
const SPEC_TEXT = [`# ${FEATURE}`, "", `Ticket: ${TICKET_REL}`, "", "Scenarios: S1, S2, S3", ""].join("\n");

function mkFixture() {
  const ws = fs.mkdtempSync(path.join(TMP, "ws-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.mkdirSync(path.join(ws, "docs", "tickets"), { recursive: true });
  fs.writeFileSync(path.join(ws, TICKET_REL), TICKET_TEXT);
  fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
  fs.writeFileSync(path.join(ws, "specs", `${FEATURE}.md`), SPEC_TEXT);
  return ws;
}
async function judgePass(ws, logIds) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: FEATURE,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["code-reviewer: claiming review"],
    lastAgent: "code-reviewer",
  });
  forceSeedStamp(ws);
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T01.md"), "# Code review\n\nVerdict: APPROVED\n");
  resetSession(ws);
  markStateRead(ws);
  const log = ["## AC Execution Log", ...logIds.map((id) => `- ${id} — npm test -- export-csv — exit 0 — pass`), ""].join("\n");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: FEATURE,
    status: "PASS",
    agent_id: "code-reviewer",
    completed_tasks: ["T01"],
    pending_notes: ["code-reviewer: T01 PASS"],
    qa_review: log,
  });
  return { isError: Boolean(r.isError), text: r.content[0].text };
}

test("AC10: a C-PM1-form spec citing a ticket with a test-author-appended scenario — the checker counts it, and PASS is rejected naming it until the judge logs a pass line for it", async () => {
  assert.doesNotMatch(SPEC_TEXT, /^\s*-?\s*(Given|When|Then)\b/m, "fixture sanity: the spec copies no Given/When/Then line");
  // (i) the ticket checker reads the ticket and counts the appended scenario.
  const ws0 = mkFixture();
  const c = runChecker(path.join(ws0, TICKET_REL));
  assert.equal(c.code, 0, c.out);
  assert.match(c.out, /ok .*E901\.md \(3 scenarios\)/, "the appended scenario is counted");
  // (ii) no pass line for S3 -> PASS rejected, S3 named; the recorded ids are not named.
  const r1 = await judgePass(mkFixture(), ["S1", "S2"]);
  assert.equal(r1.isError, true, `PASS must be rejected while S3 has no pass line; got: ${r1.text}`);
  assert.ok(r1.text.startsWith("⛔ AC_EXECUTION_LOG_MISSING: T01. "), r1.text);
  assert.ok(r1.text.includes("No entry for scenario(s): S3. "), `the appended scenario S3 is named; got: ${r1.text}`);
  // ... and accepted once every scenario has one.
  const r2 = await judgePass(mkFixture(), ["S1", "S2", "S3"]);
  assert.equal(r2.isError, false, `PASS must land once S1-S3 all have pass lines; got: ${r2.text}`);
});

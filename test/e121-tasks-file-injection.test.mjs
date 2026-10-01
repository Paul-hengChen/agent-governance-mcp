// Coded by @qa-engineer
// Tests that the four mutators in tools/tasks-file.ts (complete, rollback, void, add) refuse caller strings that would forge a task row via
// `$`-expansion (String.replace grammar) or line injection. The pre-fix code also returned success: true, so "no crash" proves nothing: a must-refuse
// case pins an {error} matching /task_id must not contain a line break/, tasks.md byte-identical, the forged id absent, row count unchanged, no .lock left.
// For line-break taskIds it also asserts the message is not a not-found error, telling a stated guard from incidental lookup-order safety.
// Rationale: specs/e260f-comment-rationale.md (test/e121-tasks-file-injection.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { completeTask, rollbackTask, voidTask, addTask, getNextTask } from "../dist/tools/tasks.js";
import { parseTasksFromFile } from "../dist/tools/tasks-file.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

setActiveStorage(new FileHandoffStorage());

// ---------------------------------------------------------------------------
// Fixture helpers (mirror test/e117-void-task.test.mjs; not imported directly
// since that file exports no helpers — mirrored here per the qa dispatch
// brief rather than duplicated wholesale: same sentinel-stamping shape, same
// resetSession/markStateRead sequencing so the freshness guard doesn't trip).
// ---------------------------------------------------------------------------

// Fixtures seed the lane-local ledger directly at `.current/_primary/tasks.md` (no .git, so the lane is the primary lane): a root-level v2 file is the
// index shape and tw_* would throw TASKS_LEDGER_ABSENT. Same approach as test/e117-void-task.test.mjs; migration has its own tests in test/e125a-lane-local-ledgers.test.mjs.
function laneTasksPath(ws) {
  return path.join(ws, ".current", "_primary", "tasks.md");
}

function mkWorkspaceWithTasks(taskBody) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twe121-"));
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n${taskBody}`);
  resetSession(ws);
  markStateRead(ws);
  return ws;
}

function readTasks(ws) {
  return fs.readFileSync(laneTasksPath(ws), "utf-8");
}

function lockExists(ws) {
  return fs.existsSync(`${laneTasksPath(ws)}.lock`);
}

// The forged-row payload used throughout: an LF followed by a live,
// independently-parseable checkbox line for an id ("T-FORGED") that never
// existed. This is the exact class the review measured plants a row and
// moves progress.total on the pre-fix build.
const FORGE_MARKER = "T-FORGED";
function forgedSuffix() {
  return `\n- [ ] ${FORGE_MARKER} forged`;
}

/**
 * Pin the discriminating assertions from THE TRAP (round 3, part 1/9):
 * (a) the field-accurate refusal message, (b) tasks.md byte-identical,
 * (c) the forged marker absent from the whole file, (d) parseTasksFromFile's
 * row count unchanged, (e) no .lock artefact left behind.
 */
function assertDiscriminatingRefusal(ws, resultJson, before, fieldRegex, beforeRowCount) {
  const result = JSON.parse(resultJson);
  assert.equal(result.success, undefined, "a refusal must not also carry success:true");
  assert.match(result.error, fieldRegex, `error must match ${fieldRegex}`);
  const after = readTasks(ws);
  assert.equal(after, before, "tasks.md must be BYTE-IDENTICAL to its pre-call content after a refusal");
  assert.ok(!after.includes(FORGE_MARKER), "the forged marker must be absent from the whole file");
  const rows = parseTasksFromFile(ws);
  assert.equal(rows.length, beforeRowCount, "parseTasksFromFile's row count must be unchanged");
  assert.equal(lockExists(ws), false, "no .lock artefact may be left behind by a refused call");
  return result;
}

// ===========================================================================
// Part 1/9 — THE TRAP, made concrete: the discriminating assertions above,
// run once explicitly against the single worst-case payload (addTaskInFile,
// the only mutator that had NO incidental lookup-failure safety net before
// round 3), with commentary on why the weaker assertions would have passed
// against the pre-fix build.
// ===========================================================================

test("THE TRAP: a forged-row payload in addTask's taskId returns {error}, not success:true — and every weaker assertion would have passed pre-fix", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);
  const forgedId = `T-X${forgedSuffix()}`;

  const resultJson = await addTask(ws, forgedId, "ordinary description", "P");
  const result = assertDiscriminatingRefusal(ws, resultJson, before, /task_id must not contain a line break/, 1);

  // Documented for the reader, not asserted as code: the pre-fix build
  // returned {"success":true,"taskId":"T-X\n- [ ] T-FORGED forged",...} for
  // this exact call (review_reports/review_T-E121-01.md, R3-C1 table) — so
  // `result.success === true`, `no crash`, and `error === undefined` all
  // held against the BROKEN build. None of those would have caught this.
  assert.equal(result.error !== undefined, true);
});

// ===========================================================================
// Parts 2/9-4/9 — the 8 must-refuse cells (field x mutator) + the explicit-
// refusal / negative-lookup-message assertion for the taskId column of
// complete/rollback/void.
// ===========================================================================

test("must-refuse 1/8: completeTask(taskId) with a forged-row payload is refused, not looked up", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  const before = readTasks(ws);
  const forgedId = `T-A${forgedSuffix()}`;

  const resultJson = await completeTask(ws, forgedId, "ordinary note");
  const result = assertDiscriminatingRefusal(ws, resultJson, before, /task_id must not contain a line break/, 2);

  // The explicit-refusal assertion: must NOT read as an incidental lookup
  // miss. Without this negative check, a refactor hoisting line
  // construction above the `find()` would go undetected.
  assert.doesNotMatch(result.error, /not found|Could not find|No incomplete/i);
});

test("must-refuse 2/8: completeTask(note) with a forged-row payload is refused", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);

  const resultJson = await completeTask(ws, "T-A", `done${forgedSuffix()}`);
  assertDiscriminatingRefusal(ws, resultJson, before, /note must not contain a line break/, 1);
});

test("must-refuse 3/8: rollbackTask(taskId) with a forged-row payload is refused, not looked up", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T-A done\n- [ ] T-B second\n`);
  const before = readTasks(ws);
  const forgedId = `T-A${forgedSuffix()}`;

  const resultJson = await rollbackTask(ws, forgedId, "ordinary reason");
  const result = assertDiscriminatingRefusal(ws, resultJson, before, /task_id must not contain a line break/, 2);
  assert.doesNotMatch(result.error, /not found|Could not find|No incomplete/i);
});

test("must-refuse 4/8: rollbackTask(reason) with a forged-row payload is refused", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T-A done\n`);
  const before = readTasks(ws);

  const resultJson = await rollbackTask(ws, "T-A", `oops${forgedSuffix()}`);
  assertDiscriminatingRefusal(ws, resultJson, before, /reason must not contain a line break/, 1);
});

test("must-refuse 5/8: voidTask(taskId) with a forged-row payload is refused, not looked up", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  const before = readTasks(ws);
  const forgedId = `T-A${forgedSuffix()}`;

  const resultJson = await voidTask(ws, forgedId, "ordinary reason");
  const result = assertDiscriminatingRefusal(ws, resultJson, before, /task_id must not contain a line break/, 2);
  assert.doesNotMatch(result.error, /not found|Could not find|No incomplete/i);
});

test("must-refuse 6/8: voidTask(reason) with a forged-row payload is refused", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);

  const resultJson = await voidTask(ws, "T-A", `oops${forgedSuffix()}`);
  assertDiscriminatingRefusal(ws, resultJson, before, /reason must not contain a line break/, 1);
});

test("must-refuse 7/8: addTask(taskId) with a forged-row payload is refused — E121's headline defect, the one live forging site pre-round-3", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);
  const forgedId = `T-X${forgedSuffix()}`;

  const resultJson = await addTask(ws, forgedId, "ordinary description", "P");
  assertDiscriminatingRefusal(ws, resultJson, before, /task_id must not contain a line break/, 1);
});

test("must-refuse 8/8: addTask(description) with a forged-row payload is refused", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);

  const resultJson = await addTask(ws, "T-NEW", `real${forgedSuffix()}`, "P");
  assertDiscriminatingRefusal(ws, resultJson, before, /description must not contain a line break/, 1);
});

// ===========================================================================
// CR-only consistency (NOT a forging test): refused everywhere, correctly,
// as hygiene — CR never forges a row in either build (round 2 measurement).
// Asserting only the refusal + byte-identity, deliberately not claiming CR
// forges anything.
// ===========================================================================

test("CR-only in taskId is refused as a hygiene/consistency matter, not because it forges a row (LF is the whole forging class)", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);

  const resultJson = await addTask(ws, `T-X\r- [ ] ${FORGE_MARKER} forged`, "ordinary description", "P");
  const result = JSON.parse(resultJson);
  assert.match(result.error, /task_id must not contain a line break/);
  assert.equal(readTasks(ws), before, "a refused CR-bearing call must also leave tasks.md byte-identical");
});

// Must-succeed set (over-refusal floor). No id containing a line break can round-trip through tasks.md (parseTasks splits on "\n" and
// DEFAULT_TASK_REGEX captures the id as (\S+)), so the refused set is exactly the unrepresentable set and no realistic or
// machine-derived id is newly refused. The cases below are the empirical half of that argument.

test("must-succeed: addTask accepts a spread of benign id shapes with no line break", async () => {
  const benignIds = [
    "T-1",
    "JIRA-42",
    "T-$1",
    "T-$&",
    "T-$$",
    "T-`bt`",
    "T-E121-99",
    "ABC_123",
    "feat/login-01",
    "T-A.B.C",
    "T-中文-01",
    "T-emoji-🙂",
    "T-with space",
    "T-with\ttab",
    "#123",
  ];

  for (const id of benignIds) {
    const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-SEED seed\n`);
    const result = JSON.parse(await addTask(ws, id, "an ordinary benign description", "P"));
    assert.equal(result.success, true, `expected addTask to succeed for id ${JSON.stringify(id)}, got: ${JSON.stringify(result)}`);
    assert.equal(result.taskId, id);
  }
});

test("round-1 non-regression round trip: $-expansion payloads store literally through complete then rollback, and the id occurs exactly once", async () => {
  const dollarId = "T-$&";
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] ${dollarId} original\n`);

  const note = "$& $1 $` $' $$";
  const completed = JSON.parse(await completeTask(ws, dollarId, note));
  assert.equal(completed.success, true, `expected completeTask to succeed, got: ${JSON.stringify(completed)}`);

  const afterComplete = readTasks(ws);
  for (const token of ["$&", "$1", "$`", "$'", "$$"]) {
    assert.ok(afterComplete.includes(token), `expected the literal sequence ${JSON.stringify(token)} in tasks.md`);
  }
  const idOccurrences = afterComplete.split(dollarId).length - 1;
  assert.equal(idOccurrences, 1, "the id must occur exactly once in the file after completion");

  const reason = "reverted, keeping $& and $$ literal";
  const rolledBack = JSON.parse(await rollbackTask(ws, dollarId, reason));
  assert.equal(rolledBack.success, true, `expected rollbackTask to succeed, got: ${JSON.stringify(rolledBack)}`);

  const afterRollback = readTasks(ws);
  assert.ok(afterRollback.includes("$& and $$"), "the rollback reason must store its $ sequences literally");
  assert.equal(afterRollback.split(dollarId).length - 1, 1, "the id must still occur exactly once after rollback");
});

test("must-succeed: voidTask on a backtick id with a benign reason succeeds normally (no over-refusal)", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-`bt` first\n");
  const result = JSON.parse(await voidTask(ws, "T-`bt`", "plain, harmless reason"));
  assert.equal(result.success, true, `expected voidTask to succeed, got: ${JSON.stringify(result)}`);
});

// Line-separator (U+2028/U+2029) row erasure, the erasure sibling of the forging defect: these JS-only line terminators are not split by
// split("\n"), so a row carrying one is a single line on disk yet unparseable. Closed twice: Part A, the input boundary (containsLineBreak
// widened, same eight call sites); Part B, the parser, which fails loud on a live-shaped row carrying one but not on a voided row.
// Rationale: specs/e260f-comment-rationale.md (test/e121-tasks-file-injection.test.mjs).

const E131_TERMINATORS = [
  ["U+2028 LINE SEPARATOR", "\u2028"],
  ["U+2029 PARAGRAPH SEPARATOR", "\u2029"],
];

for (const [label, ch] of E131_TERMINATORS) {
  test(`E131 input boundary: completeTask(taskId) refuses a ${label}-bearing id`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A first\n- [ ] T-B second\n");
    const before = readTasks(ws);
    const result = JSON.parse(await completeTask(ws, `T-A${ch}`, "note"));
    assert.match(result.error, /task_id must not contain a line break/);
    assert.equal(readTasks(ws), before, "a refused completeTask(taskId) call must leave tasks.md byte-identical");
  });

  test(`E131 input boundary: completeTask(note) refuses a ${label}-bearing note`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A first\n");
    const before = readTasks(ws);
    const result = JSON.parse(await completeTask(ws, "T-A", `note${ch}`));
    assert.match(result.error, /note must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  test(`E131 input boundary: rollbackTask(taskId) refuses a ${label}-bearing id`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [x] T-A done\n- [ ] T-B second\n");
    const before = readTasks(ws);
    const result = JSON.parse(await rollbackTask(ws, `T-A${ch}`, "reason"));
    assert.match(result.error, /task_id must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  test(`E131 input boundary: rollbackTask(reason) refuses a ${label}-bearing reason`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [x] T-A done\n");
    const before = readTasks(ws);
    const result = JSON.parse(await rollbackTask(ws, "T-A", `reason${ch}`));
    assert.match(result.error, /reason must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  test(`E131 input boundary: voidTask(taskId) refuses a ${label}-bearing id`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A first\n- [ ] T-B second\n");
    const before = readTasks(ws);
    const result = JSON.parse(await voidTask(ws, `T-A${ch}`, "reason"));
    assert.match(result.error, /task_id must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  test(`E131 input boundary: voidTask(reason) refuses a ${label}-bearing reason`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A first\n");
    const before = readTasks(ws);
    const result = JSON.parse(await voidTask(ws, "T-A", `reason${ch}`));
    assert.match(result.error, /reason must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  test(`E131 input boundary: addTask(taskId) refuses a ${label}-bearing id`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A first\n");
    const before = readTasks(ws);
    const result = JSON.parse(await addTask(ws, `T-X${ch}`, "desc", "P"));
    assert.match(result.error, /task_id must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  test(`E131 input boundary: addTask(description) refuses a ${label}-bearing description`, async () => {
    const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A first\n");
    const before = readTasks(ws);
    const result = JSON.parse(await addTask(ws, "T-NEW", `desc${ch}`, "P"));
    assert.match(result.error, /description must not contain a line break/);
    assert.equal(readTasks(ws), before);
  });

  // ---------------------------------------------------------------------
  // Part B — the parser itself (fail-loud vs. intended invisibility).
  // ---------------------------------------------------------------------

  test(`E131 parser: a LIVE checkbox row carrying a raw ${label} throws instead of silently vanishing`, () => {
    const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-OK healthy\n- [ ] T-BAD note${ch} continues\n`);
    assert.throws(
      () => parseTasksFromFile(ws),
      new RegExp(`U\\+${ch.codePointAt(0).toString(16).toUpperCase()}`),
      "a live row that the strict regex cannot cross must fail loud, not disappear from every reader silently",
    );
  });

  test(`E131 parser: a VOIDED row carrying a raw ${label} in its reason parses clean — its invisibility is the contract, not a bug`, () => {
    const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-OK healthy\n- [-] T-V some task (voided: bad${ch}reason)\n`);
    const rows = parseTasksFromFile(ws);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["T-OK"],
      "the voided row must stay invisible (its own contract), and must NOT throw the way a live corrupted row does",
    );
  });
}

test("E131 parser: getNextTask returns normally (no throw) when a voided row carries a raw U+2028 in its reason", () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-OK healthy\n- [-] T-V some task (voided: bad\u2028reason)\n");
  const next = JSON.parse(getNextTask(ws));
  assert.equal(next.next.id, "T-OK", "the healthy row must still be offered normally");
  assert.equal(next.progress.total, 1, "the voided row must not be counted, and no throw must have interrupted the read");
});

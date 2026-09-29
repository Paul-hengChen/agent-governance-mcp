// Coded by @qa-engineer
// Tests that tools/tasks-file.ts's four mutators (completeTaskInFile,
// rollbackTaskInFile, voidTaskInFile, addTaskInFile) refuse caller-supplied
// strings that would forge a task row via either `$`-expansion (String.replace
// replacement-string grammar) or line injection (plain string concatenation /
// replacer-function embedding of a line-break-bearing value). E121, docs/backlog.md
// order 0t.
//
// The approved review report review_reports/review_T-E121-01.md is the spec this
// file executes. THE TRAP (restated from that report because it is the
// whole point of this file): the PRE-FIX behaviour also returned
// `success: true`. Asserting "no crash", `success === true`, or
// `error === undefined` is NOT a test of this defect — every one of those
// assertions passes against the broken base build. What discriminates is:
//   (a) an {error} matching /task_id must not contain a line break/ (or the
//       matching field name for a payload guard),
//   (b) tasks.md BYTE-IDENTICAL to its pre-call content,
//   (c) the forged id/marker absent from the whole file,
//   (d) parseTasksFromFile's row count unchanged,
//   (e) no `.lock` artefact left behind (the guard fires before
//       withFileLock is ever reached).
// Every must-refuse case below pins at least (a) + (b) + (c); most also
// pin (d) and (e).
//
// Coverage floor (the review's "8 MUST-REFUSE cells", field x mutator):
// completeTask(taskId), completeTask(note); rollbackTask(taskId),
// rollbackTask(reason); voidTask(taskId), voidTask(reason); addTask(taskId),
// addTask(description). The taskId column was the last one added —
// addTask's taskId guard was the only *live* forging site before it, so it
// is deliberately not tested alone; all four mutators get a taskId case.
//
// The EXPLICIT-refusal assertion (the point of guarding all four mutators): for complete/rollback/void with a line-break-bearing taskId,
// this file asserts POSITIVELY on /task_id must not contain a line break/
// AND NEGATIVELY that the message does NOT match
// /not found|Could not find|No incomplete/i. Without the negative
// assertion, a test cannot tell a STATED invariant (the input-boundary
// guard) from INCIDENTAL lookup-order safety (the earlier behaviour,
// where a newline-bearing id merely failed `Array.find` and returned a
// not-found error) — and a refactor that hoisted line construction above
// the `find()` call would go undetected by a test that only checked the
// call refused.
//
// Settled boundary, pinned not re-derived (settled in review): for
// ROW FORGING, LF is the WHOLE class. Every line-splitting reader in this
// file splits on LF alone — parseTasks (tools/tasks-file.ts:80-92,
// `migratedBody.split("\n")`), addTaskInFile's duplicate scan (:521,
// `content.split("\n")`), voidTaskInFile's post-write invariant (:490,
// `newContent.split("\n")`). DEFAULT_TASK_REGEX (tools/config.ts:100) has no
// `m` flag, and resolveTaskRegex (tools/config.ts:353-364) builds a custom
// pattern with `new RegExp(config.taskPattern)` — no flags argument — so a
// workspace-configured taskPattern cannot introduce `m` either; `^`/`$`
// always anchor to the whole candidate string. LF and CRLF forge at base and
// are refused now; CR is refused too but only as a hygiene/consistency
// matter (it never forged anything — see the CR test below, which does NOT
// assert forging). U+2028/U+2029/NEL/VT/FF/NBSP do not forge in either
// build, so no test here treats them as forging vectors.
//
// Explicitly OUT of scope for this file (do not fix, do not test as if
// fixed, do not let them block PASS):
//   - U+2028/U+2029 make a row *unparseable* (erasure, not forgery),
//     measured identical at base and working tree — pre-existing, filed as
//     its own ticket (review finding R2-C2). No failing test for this is written here.
//   - tools/registry.ts's `task_id: z.string().min(1)` schema — the
//     coordinator declined to tighten the public tool contract; the file
//     boundary is the chosen closure.
//   - SQLite mode — parameterised SQL, not a line-oriented store; not this
//     defect.
//
// Fixture helpers below mirror test/e117-void-task.test.mjs's
// mkWorkspaceWithTasks / readTasks (that file is NOT edited by this round —
// its :298 case, `voidTaskInFile` refusing a newline+$&-bearing reason,
// passes unchanged and stays that way as part of this fix's acceptance).

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

// e125a-lane-local-ledgers re-baseline (qa-owned, spec AC13 "Test impact";
// review_reports/review_T-E125A-05.md "Expected-Red Sampling"): a workspace
// fixture stamped `CURRENT_VERSIONS.tasks` (now 2) at the workspace ROOT is
// the workspace-"index" shape, not an unmigrated ledger — tw_* would throw
// TASKS_LEDGER_ABSENT (spec AC6b) reading it. These fixtures are about the
// injection-guard refusal matrix (E121), not migration mechanics (that has its own
// dedicated coverage in test/e125a-lane-local-ledgers.test.mjs), so — same
// re-baseline as test/e117-void-task.test.mjs — seed the lane-local ledger
// DIRECTLY at `.current/_primary/tasks.md` (no .git in these fixtures ⇒
// resolveCurrentLane === PRIMARY_LANE), the exact file tw_* now reads,
// writes, and locks (spec D-F/AC9).
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

// ===========================================================================
// Must-succeed set (over-refusal floor). Structural reasoning (round 3,
// R3-Q1 / part 5/9): no id containing a line break can round-trip through
// tasks.md at all — parseTasks (tools/tasks-file.ts:80-92) splits on "\n"
// and DEFAULT_TASK_REGEX (tools/config.ts:100) captures the id as (\S+),
// which excludes \r and \n by construction, and .trim() strips a leading
// CRLF's \r before the regex ever runs. The refused set is therefore exactly
// the unrepresentable set — there is no realistic id shape, and no
// machine-derived id from tw_sync/tw_detect_drift/getNextTask, that newly
// gets refused. The cases below are the empirical half of that argument.
// ===========================================================================

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

// ===========================================================================
// Line-separator (U+2028/U+2029) row-erasure cases (E131, docs/backlog.md order
// 13s) — added to this file per the backlog
// row's own placement ("qa-owned cases in the existing
// test/e121-tasks-file-injection.test.mjs") and the qa dispatch brief.
//
// This defect is the erasure sibling of this file's forging defect, NOT the same
// bug (E131): U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR are JS-only line
// terminators that `String.prototype.split("\n")` (used throughout
// tools/tasks-file.ts) does NOT split on, but that `.` cannot cross and an
// un-anchored `$` cannot cross either. So a row carrying one is physically a
// single line on disk yet unparseable — the opposite direction from row
// forging. Closed at two independent points (review_reports/
// review_T-E120131-01.md rounds 1-3, APPROVED):
//
//   Part A (below) — the INPUT BOUNDARY: `containsLineBreak`, this file's
//   own LF/CR guard, widened to include U+2028 and U+2029, reached from all
//   eight existing call sites (taskId + payload field of each of the four
//   mutators) — the exact coverage floor this file already established for
//   line-break forging, now extended to the two new characters. Structured
//   as one pair of characters (U+2028, U+2029) crossed with the same 8
//   field x mutator matrix above, but this is an INPUT-BOUNDARY refusal
//   test, not a forging test: U+2028/U+2029 do not plant a second row (LF
//   remains the whole forging class per this file's header), they would
//   silently ERASE the row that carries one if they ever reached disk. The
//   refusal is what prevents that from ever being reachable through the
//   tw_* API at all.
//
//   Part B (below) — the PARSER ITSELF: `parseTasks` (tools/tasks-file.ts)
//   now fails LOUD instead of silently dropping a row that (a) is shaped
//   like a live checkbox task row and (b) carries U+2028/U+2029 — this is
//   the defense for a tasks.md hand-edited directly, which never passes
//   through the input boundary at all. Critically, a VOIDED row carrying
//   the same character must NOT throw: its invisibility to every reader is
//   the voidTaskInFile contract (E117), not the line-separator corruption
//   case (E131), and
//   the shape heuristic (`TASK_LINE_SHAPE_RE`) deliberately excludes the
//   void marker's `-` checkmark for exactly this reason (an earlier review
//   finding, C2 — the pre-fix heuristic wrongly matched voided rows too).
// ===========================================================================

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

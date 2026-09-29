// Coded by @qa-engineer
// T-E125A-06: new coverage for specs/e125a-lane-local-ledgers.md AC4-AC11,
// AC4b, AC6b, AC14 (AC1-AC3/AC13 are covered in test/lane-paths.test.mjs,
// test/lane-migrate.test.mjs, test/schema-versions.test.mjs and
// test/tasks-versioning.test.mjs; AC12 is the existing SQLite suites, which
// this feature does not touch; AC10 is covered by test/success-metrics.test.mjs
// / test/drift-skew.test.mjs plus the AC9 tests below). Imports compiled
// dist/. Every fixture lives under os.tmpdir() and is never the repo root.
//
// Spec-to-Test map:
//   AC4  (_primary forward)                          -> AC4
//   AC4b (ignored lane path: no migration, option A)  -> AC4b-primary,
//                                                        AC4b-feat, AC4b-control
//   AC5  (feat forward, non-adjacent runs + no-op)     -> AC5a, AC5b
//   AC6  (idempotent / lock contention)                -> AC6-idempotent-*,
//                                                        AC6-busy-*
//   AC6b (ledger absent but required: loud, never
//         empty) + the feat-on-v2-no-marker empty
//         start (AC14(b))                              -> AC6b-a, AC6b-b,
//                                                        AC6b-c, AC6b-empty-start
//   AC7  (round trip)                                  -> AC7a, AC7b
//   AC8  (reverse refusals)                             -> AC8-primary-*,
//                                                        AC8-feat-*
//   AC9  (tw_* read/write lane-local only)              -> AC9
//   AC11 (freshness)                                    -> AC11
//   AC14 (merge interleave ownership filter)             -> AC14-1, AC14-2, AC14-3

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import {
  migratePrimaryReverse,
  migrateFeatReverse,
} from "../dist/tools/tasks-lane-migrate.js";
import {
  parseTasksFromFile,
  getNextTaskFromFile,
  completeTaskInFile,
  rollbackTaskInFile,
  voidTaskInFile,
  addTaskInFile,
} from "../dist/tools/tasks-file.js";
import { resetSession, markStateRead, verifyFreshness } from "../dist/guards/session.js";
import { detectDrift } from "../dist/tools/drift.js";
import { reconcileTasks } from "../dist/tools/sync.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { emitFeatureMetrics } from "../dist/tools/metrics.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

setActiveStorage(new FileHandoffStorage());

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function mkWorkspace(prefix = "e125a-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// A FAKE .git (pure fs — resolveCurrentLane only ever reads HEAD via fs, per
// tools/lane-paths.ts) is enough for every test below that wants "not
// git-ignored" behaviour: isLanePathIgnored's `git check-ignore` spawn fails
// against this non-repo (no real git internals) and that failure is caught
// and treated as "not ignored" — the exact same fallback as "no .git at
// all" (spec D-F: "any error → not ignored"). AC4b is the ONE place that
// needs a REAL git repo (below), because it specifically exercises `git
// check-ignore` actually consulting a real .gitignore.
function mkFeatWorkspaceFake(lane, prefix = "e125a-feat-") {
  const ws = mkWorkspace(prefix);
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), `ref: refs/heads/feat/${lane}-x\n`);
  return ws;
}

function gitInit(ws) {
  execFileSync("git", ["init", "-q"], { cwd: ws });
}
function gitSetBranch(ws, branch) {
  execFileSync("git", ["symbolic-ref", "HEAD", `refs/heads/${branch}`], { cwd: ws });
}
function mkRealGitWorkspace(prefix = "e125a-git-") {
  const ws = mkWorkspace(prefix);
  gitInit(ws);
  return ws;
}

function laneTasksPath(ws, lane = "_primary") {
  return path.join(ws, ".current", lane, "tasks.md");
}
function writeRoot(ws, body) {
  fs.writeFileSync(path.join(ws, "tasks.md"), body);
}
function readRoot(ws) {
  return fs.readFileSync(path.join(ws, "tasks.md"), "utf-8");
}
function readLane(ws, lane = "_primary") {
  return fs.readFileSync(laneTasksPath(ws, lane), "utf-8");
}
function receiptPath(ws) {
  return path.join(ws, ".current", "tasks-index-receipt.json");
}
function freshSession(ws) {
  resetSession(ws);
  markStateRead(ws);
}

const V1 = "<!-- schema_version: 1 -->\n";
const V2 = "<!-- schema_version: 2 -->\n";
const NOTICE =
  "<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->\n";

function isTasksLedgerAbsent(err) {
  assert.equal(err.code, "TASKS_LEDGER_ABSENT", `expected TASKS_LEDGER_ABSENT, got ${err.code}: ${err.message}`);
  return true;
}

// ===========================================================================
// AC4 — _primary forward migration
// ===========================================================================

test("AC4: _primary forward migration copies a v1 root into the lane ledger and stamps root as a v2 index; the tool's result is computed from the lane-local file", () => {
  const ws = mkWorkspace();
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01", "the tool's result must be computed from the lane-local file");

  assert.equal(readLane(ws), V2 + B, "the lane ledger must equal v2 sentinel + the original body verbatim");
  assert.equal(readRoot(ws), V2 + NOTICE + B, "root must equal v2 sentinel + the index notice + the original body");
});

// ===========================================================================
// AC4b — ignored lane path (option A): no migration, root stays the ledger
// ===========================================================================

test("AC4b: an ignored _primary lane path skips migration — root stays the ledger, no lane file, no receipt, advisory observable, tw_add_task writes root", async () => {
  const ws = mkRealGitWorkspace("e125a-ac4b-primary-");
  fs.writeFileSync(path.join(ws, ".gitignore"), ".current/\n");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const nextJson = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(nextJson.next.id, "T01", "the ignored root must serve the read");
  assert.ok(nextJson.advisory, "the ignored-lane advisory must be observable on the read result");
  assert.match(nextJson.advisory, /is git-ignored in this workspace/);

  assert.ok(!fs.existsSync(laneTasksPath(ws)), "no lane ledger may be created");
  assert.ok(!fs.existsSync(receiptPath(ws)), "no receipt may be created");
  assert.equal(readRoot(ws), V1 + B, "root must be byte-identical: no v2 stamp, no index notice, no marker");

  const added = JSON.parse(await addTaskInFile(ws, "T02", "second"));
  assert.equal(added.success, true);
  assert.equal(added.path, path.join(ws, "tasks.md"), "tw_add_task must write root, not a lane path");
  assert.ok(!fs.existsSync(laneTasksPath(ws)), "add must still not create a lane ledger");
});

test("AC4b: an ignored feat-lane path (real git init + .gitignore, feat/e999-x) also skips migration — root stays the ledger", () => {
  const ws = mkRealGitWorkspace("e125a-ac4b-feat-");
  gitSetBranch(ws, "feat/e999-x");
  fs.writeFileSync(path.join(ws, ".gitignore"), ".current/\n");
  const B = "## e999-x\n- [ ] T-E999-01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const nextJson = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(nextJson.next.id, "T-E999-01");
  assert.ok(nextJson.advisory);
  assert.match(nextJson.advisory, /is git-ignored in this workspace/);

  assert.ok(!fs.existsSync(laneTasksPath(ws, "e999")), "no lane ledger may be created");
  assert.ok(!fs.existsSync(receiptPath(ws)), "no receipt may be created");
  assert.equal(readRoot(ws), V1 + B, "root must be byte-identical — no marker either");

  // None of the ledger-absent refusals (TASKS_LEDGER_ABSENT, AC6b) may fire in this workspace.
  assert.doesNotThrow(() => getNextTaskFromFile(ws));
});

test("AC4b: a control fixture (real git, WITHOUT an ignore rule) migrates normally per AC4 — proves the two ignored fixtures above are testing the ignore rule, not something else about real git", () => {
  const ws = mkRealGitWorkspace("e125a-ac4b-control-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01");
  assert.equal(readLane(ws), V2 + B);
  assert.equal(readRoot(ws), V2 + NOTICE + B);
  assert.equal(result.advisory, undefined, "a non-ignored, migrated workspace must carry no advisory");
});

test("AC4b: a workspace with no .git at all counts as not-ignored (control) — migrates exactly like AC4", () => {
  const ws = mkWorkspace("e125a-ac4b-nogit-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T01");
  assert.equal(readLane(ws), V2 + B);
});

// ===========================================================================
// AC5 — feat forward migration
// ===========================================================================

test("AC5a: feat forward migration extracts two non-adjacent runs into the lane ledger verbatim and in order, leaves markers (with of=<N>) in root, keeps root's v1 sentinel, and leaves the unrelated section untouched", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac5a-");
  const run1 = "## e999-x\n- [ ] T-E999-01 first\n";
  const between = "## e123a-y\n- [ ] T-E123A-01 unrelated\n";
  const run2 = "## e999-x\n- [ ] T-E999-02 second\n";
  const B = run1 + between + run2;
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T-E999-01");

  assert.equal(
    readLane(ws, "e999"),
    "<!-- schema_version: 2 -->\n## e999-x\n- [ ] T-E999-01 first\n## e999-x\n- [ ] T-E999-02 second\n",
    "both e999 runs must land in the lane ledger verbatim, in document order, under a v2 sentinel",
  );
  assert.equal(
    readRoot(ws),
    "<!-- schema_version: 1 -->\n" +
      "<!-- tasks_moved: lane=e999 run=1 of=2 sections=1 -> .current/e999/tasks.md (E125a) -->\n" +
      "## e123a-y\n" +
      "- [ ] T-E123A-01 unrelated\n" +
      "<!-- tasks_moved: lane=e999 run=2 of=2 sections=1 -> .current/e999/tasks.md (E125a) -->\n",
    "root must hold two markers where the runs were, keep its v1 sentinel, and be otherwise byte-identical — the e123a-y section is untouched",
  );
});

test("AC5b: with zero matching sections for the lane, the feat forward migration is a no-op and root is byte-identical", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac5b-");
  const B = "# Tasks\n\n## e123a-y\n- [ ] T-E123A-01 unrelated only\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.match(result.error, /No task list file found/, "zero e999 sections -> nothing to extract -> no ledger yet");
  assert.equal(readRoot(ws), V1 + B, "root must be completely untouched");
  assert.ok(!fs.existsSync(laneTasksPath(ws, "e999")), "no lane ledger may be created for a no-op migration");
});

// ===========================================================================
// AC6 — idempotent / no re-migration; lock contention -> TASKS_MIGRATION_BUSY
// ===========================================================================

test("AC6: a lane file that already exists is never re-migrated — running the read path again changes neither file, nor its mtime", () => {
  const ws = mkWorkspace("e125a-ac6-idem-lane-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws); // first migration

  const laneBefore = readLane(ws);
  const rootBefore = readRoot(ws);
  const laneMtimeBefore = fs.statSync(laneTasksPath(ws)).mtimeMs;
  const rootMtimeBefore = fs.statSync(path.join(ws, "tasks.md")).mtimeMs;

  getNextTaskFromFile(ws); // second call — must be a pure no-op

  assert.equal(readLane(ws), laneBefore);
  assert.equal(readRoot(ws), rootBefore);
  assert.equal(fs.statSync(laneTasksPath(ws)).mtimeMs, laneMtimeBefore, "lane file mtime must not change on a re-run");
  assert.equal(fs.statSync(path.join(ws, "tasks.md")).mtimeMs, rootMtimeBefore, "root mtime must not change on a re-run");
});

test("AC6: a root already at v2 with the lane file ALSO already present is never treated as a forward source again — neither file changes", () => {
  const ws = mkWorkspace("e125a-ac6-idem-root-");
  writeRoot(ws, V2 + NOTICE + "# Tasks\n\n## Active\n- [ ] T01 first\n");
  fs.mkdirSync(path.dirname(laneTasksPath(ws)), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), V2 + "# Tasks\n\n## Active\n- [ ] T02 already-migrated\n");
  freshSession(ws);

  const rootBefore = readRoot(ws);
  const laneBefore = readLane(ws);
  const result = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(result.next.id, "T02");
  assert.equal(readRoot(ws), rootBefore);
  assert.equal(readLane(ws), laneBefore);
});

test("AC6 (R3): a lock held by THIS process on the INNER legacy lock fails fast with TASKS_MIGRATION_BUSY — never a silent empty result, never a lane ledger", () => {
  const ws = mkWorkspace("e125a-ac6-busy-legacy-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  const legacyLock = `${path.join(ws, "tasks.md")}.lock`;
  fs.mkdirSync(path.dirname(legacyLock), { recursive: true });
  fs.writeFileSync(legacyLock, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }));
  try {
    assert.throws(() => getNextTaskFromFile(ws), isTasksLedgerAbsentBusy);
    assert.ok(!fs.existsSync(laneTasksPath(ws)), "no lane ledger may be created on a busy migration");
    assert.equal(readRoot(ws), V1 + B, "root must be untouched");
  } finally {
    fs.rmSync(legacyLock, { force: true });
  }
});

test("AC6: a lock held on the OUTER lane path also fails fast with TASKS_MIGRATION_BUSY — legacy file untouched (D4 fixed lock order: lane outer, legacy inner)", () => {
  const ws = mkWorkspace("e125a-ac6-busy-lane-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  const laneLock = `${laneTasksPath(ws)}.lock`;
  fs.mkdirSync(path.dirname(laneLock), { recursive: true });
  fs.writeFileSync(laneLock, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }));
  try {
    assert.throws(() => getNextTaskFromFile(ws), isTasksLedgerAbsentBusy);
    assert.equal(readRoot(ws), V1 + B, "legacy file must be untouched when the OUTER lane lock itself is contended");
    assert.ok(!fs.existsSync(laneTasksPath(ws)), "no lane ledger may be created");
  } finally {
    fs.rmSync(laneLock, { force: true });
  }
});

function isTasksLedgerAbsentBusy(err) {
  assert.equal(err.code, "TASKS_MIGRATION_BUSY", `expected TASKS_MIGRATION_BUSY, got ${err.code}: ${err.message}`);
  return true;
}

// ===========================================================================
// AC6b — ledger absent but required: loud, never empty (review round 1, C1)
// ===========================================================================

async function assertAllThrowLedgerAbsent(ws, { skipDriftThrow = false } = {}) {
  freshSession(ws);
  assert.throws(() => getNextTaskFromFile(ws), isTasksLedgerAbsent, "tw_get_next_task must throw TASKS_LEDGER_ABSENT");
  freshSession(ws);
  assert.throws(() => parseTasksFromFile(ws), isTasksLedgerAbsent, "listTasks (parseTasksFromFile) must throw TASKS_LEDGER_ABSENT");
  freshSession(ws);
  if (skipDriftThrow) {
    // Case (c) only: the legacy-file-above-CURRENT check inside
    // drift.ts's OWN pre-existing version-skew precheck (checkVersionSkew,
    // T32/AC-6) short-circuits BEFORE detectDrift ever calls
    // storage.listTasks — so it never reaches the TASKS_LEDGER_ABSENT throw
    // at all. It is still loud (a first-class drift reason carrying the
    // exact newer-server message), never a lie — just via a different,
    // pre-existing mechanism than the other three readers.
    const report = JSON.parse(detectDrift(ws));
    assert.equal(report.driftDetected, true);
    assert.ok(
      report.details.some((d) => /Schema version skew: tasks on-disk v\d+ > server max v2/.test(d)),
      `expected a tasks schema-skew drift reason, got ${JSON.stringify(report.details)}`,
    );
  } else {
    assert.throws(() => detectDrift(ws), isTasksLedgerAbsent, "tw_detect_drift must throw TASKS_LEDGER_ABSENT");
  }
  freshSession(ws);
  await assert.rejects(() => reconcileTasks(ws), isTasksLedgerAbsent, "tw_sync must reject with TASKS_LEDGER_ABSENT");
  freshSession(ws);
  await assert.rejects(() => addTaskInFile(ws, "T-NEW", "x"), isTasksLedgerAbsent, "tw_add_task must reject with TASKS_LEDGER_ABSENT");
  freshSession(ws);
  await assert.rejects(() => completeTaskInFile(ws, "T-ANY"), isTasksLedgerAbsent, "tw_complete_task must reject with TASKS_LEDGER_ABSENT");
  freshSession(ws);
  await assert.rejects(() => rollbackTaskInFile(ws, "T-ANY", "r"), isTasksLedgerAbsent, "tw_rollback_task must reject with TASKS_LEDGER_ABSENT");
  freshSession(ws);
  await assert.rejects(() => voidTaskInFile(ws, "T-ANY", "r"), isTasksLedgerAbsent, "tw_void_task must reject with TASKS_LEDGER_ABSENT");

  assert.ok(
    !fs.existsSync(laneTasksPath(ws)) && !fs.existsSync(laneTasksPath(ws, "e999")),
    "no .current/<lane>/tasks.md may ever be created across any of these calls",
  );
}

test("AC6b(a): _primary — legacy file at v2 (index) with the ledger absent: every reader/mutator throws TASKS_LEDGER_ABSENT, never an empty list, never a clean drift report, never a silent fresh ledger", async () => {
  const ws = mkWorkspace("e125a-ac6b-a-");
  writeRoot(ws, V2 + NOTICE + "# Tasks\n\n## Active\n- [ ] T01 first\n");
  await assertAllThrowLedgerAbsent(ws);
});

test("AC6b(b): a feat lane whose legacy file carries a tasks_moved marker for it, with the ledger absent: every reader/mutator throws TASKS_LEDGER_ABSENT", async () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac6b-b-");
  const marker = "<!-- tasks_moved: lane=e999 run=1 of=1 sections=1 -> .current/e999/tasks.md (E125a) -->";
  writeRoot(ws, V1 + marker + "\n## e123a-y\n- [ ] T-E123A-01 unrelated\n");
  await assertAllThrowLedgerAbsent(ws);
});

test("AC6b(c): a legacy file above CURRENT_VERSIONS.tasks with the ledger absent: every reader/mutator throws TASKS_LEDGER_ABSENT carrying the runMigrations newer-server message — EXCEPT tw_detect_drift, which reports it as first-class schema-skew drift via its own pre-existing precheck (still loud, never a lie)", async () => {
  const ws = mkWorkspace("e125a-ac6b-c-");
  writeRoot(ws, "<!-- schema_version: 3 -->\n# Tasks\n\n## Active\n- [ ] T01 first\n");
  await assertAllThrowLedgerAbsent(ws, { skipDriftThrow: true });
});

test("AC6b: a feat lane on a v2 root with NO marker for itself still starts empty (AC14(b) unchanged) — tw_add_task succeeds and creates a fresh empty-start ledger, none of AC6b(a)/(b)/(c) fires", async () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac6b-empty-");
  writeRoot(ws, V2 + NOTICE + "# Tasks\n\n## Active\n- [ ] T01 unrelated to e999\n");
  freshSession(ws);

  const next = JSON.parse(getNextTaskFromFile(ws));
  assert.match(next.error, /No task list file found/, "no marker for e999 on a v2 root -> D13 no-op, not a throw -> empty read");

  const added = JSON.parse(await addTaskInFile(ws, "T-E999-01", "first e999 task"));
  assert.equal(added.success, true);
  assert.equal(
    readLane(ws, "e999"),
    "<!-- schema_version: 2 -->\n# Tasks\n\n## Active\n\n- [ ] T-E999-01 first e999 task\n",
  );
});

// ===========================================================================
// AC7 — round trip (forward then reverse)
// ===========================================================================

test("AC7a: the AC4 (_primary) fixture round-trips byte-identical with no edits in between; the receipt is written then consumed+deleted", () => {
  const ws = mkWorkspace("e125a-ac7a-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws); // forward

  assert.ok(fs.existsSync(receiptPath(ws)), "migratePrimaryForward must write the receipt");
  const receipt = JSON.parse(fs.readFileSync(receiptPath(ws), "utf-8"));
  assert.match(receipt.bodySha256, /^[0-9a-f]{64}$/);

  migratePrimaryReverse(ws);

  assert.equal(readRoot(ws), V1 + B, "root must be byte-identical to the original after a no-edits round trip");
  assert.ok(!fs.existsSync(laneTasksPath(ws)), "the lane tasks.md must be gone");
  assert.ok(!fs.existsSync(receiptPath(ws)), "the receipt must be consumed and deleted by the reverse run");
});

test("AC7a: the round trip still succeeds after the files' mtimes change with no content change", () => {
  const ws = mkWorkspace("e125a-ac7a-mtime-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws);

  // Touch root's mtime with no content change (simulates a `git checkout`).
  const content = readRoot(ws);
  fs.writeFileSync(path.join(ws, "tasks.md"), content);

  assert.doesNotThrow(() => migratePrimaryReverse(ws));
  assert.equal(readRoot(ws), V1 + B);
});

test("AC7b: the AC5 (feat) fixture round-trips byte-identical with no edits in between", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac7b-noedit-");
  const B = "## e999-x\n- [ ] T-E999-01 first\n## e123a-y\n- [ ] T-E123A-01 unrelated\n## e999-x\n- [ ] T-E999-02 second\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws); // forward

  migrateFeatReverse(ws, "e999");

  assert.equal(readRoot(ws), V1 + B, "root must be byte-identical to the original after a no-edits round trip");
  assert.ok(!fs.existsSync(laneTasksPath(ws, "e999")), "the lane tasks.md must be gone");
});

test("AC7b: a row completed and a new row added lane-locally between forward and reverse both survive the round trip — no row from either side is lost", async () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac7b-edits-");
  const B = "## e999-x\n- [ ] T-E999-01 first\n## e123a-y\n- [ ] T-E123A-01 unrelated\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws); // forward
  await completeTaskInFile(ws, "T-E999-01"); // edit 1
  await addTaskInFile(ws, "T-E999-02", "added lane-locally"); // edit 2

  migrateFeatReverse(ws, "e999");

  assert.equal(
    readRoot(ws),
    "<!-- schema_version: 1 -->\n" +
      "## e999-x\n- [x] T-E999-01 first\n\n" +
      "## Active\n- [ ] T-E999-02 added lane-locally\n" +
      "## e123a-y\n- [ ] T-E123A-01 unrelated\n",
    "root must contain both the completion AND the new lane-locally-added row after reverse, with the original e123a-y section intact",
  );
  assert.ok(!fs.existsSync(laneTasksPath(ws, "e999")));
});

// ===========================================================================
// AC8 — reverse refusals
// ===========================================================================

test("AC8 (_primary): the reverse refuses, touching nothing, when root is not a v2 index carrying the notice", () => {
  const ws = mkWorkspace("e125a-ac8-primary-notindex-");
  // A hand-built lane file exists but root was never actually migrated by
  // this module (e.g. hand-authored, or a v1 root) — reverse must refuse.
  fs.mkdirSync(path.dirname(laneTasksPath(ws)), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), V2 + "# Tasks\n\n## Active\n- [ ] T01 x\n");
  writeRoot(ws, V1 + "# Tasks\n\n## Active\n- [ ] T01 x\n");
  const rootBefore = readRoot(ws);
  const laneBefore = readLane(ws);

  assert.throws(() => migratePrimaryReverse(ws), /not a v2 tasks index carrying the E125a notice/);
  assert.equal(readRoot(ws), rootBefore);
  assert.equal(readLane(ws), laneBefore);
});

test("AC8 (_primary): the reverse refuses, touching nothing, when the root body has changed since the forward run (receipt hash mismatch)", () => {
  const ws = mkWorkspace("e125a-ac8-primary-changed-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws); // forward, writes the receipt
  fs.appendFileSync(path.join(ws, "tasks.md"), "extra line\n"); // tamper
  const rootBefore = readRoot(ws);
  const laneBefore = readLane(ws);

  assert.throws(() => migratePrimaryReverse(ws), /body changed since the forward migration/);
  assert.equal(readRoot(ws), rootBefore);
  assert.equal(readLane(ws), laneBefore);
  assert.ok(fs.existsSync(receiptPath(ws)), "a refused reverse must not consume the receipt");
});

test("AC8 (_primary): the reverse refuses, touching nothing, when the receipt is missing or unreadable", () => {
  const ws = mkWorkspace("e125a-ac8-primary-noreceipt-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws);
  fs.rmSync(receiptPath(ws), { force: true });
  const rootBefore = readRoot(ws);

  assert.throws(() => migratePrimaryReverse(ws), /receipt .* missing or unreadable/);
  assert.equal(readRoot(ws), rootBefore);
  assert.ok(fs.existsSync(laneTasksPath(ws)), "the lane ledger must survive a refused reverse");
});

test("AC8 (feat): the reverse refuses, touching nothing, when the LAST marker is missing (a tail marker dropped during merge-conflict resolution) — the previously-silent relocation bug this AC guards against", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac8-feat-lastmissing-");
  const run1 = "## e999-x\n- [ ] T-E999-01 first\n";
  const between = "## e123a-y\n- [ ] T-E123A-01 unrelated\n";
  const run2 = "## e999-x\n- [ ] T-E999-02 second\n";
  writeRoot(ws, V1 + run1 + between + run2);
  freshSession(ws);
  getNextTaskFromFile(ws); // forward

  let root = readRoot(ws);
  const marker2 = "<!-- tasks_moved: lane=e999 run=2 of=2 sections=1 -> .current/e999/tasks.md (E125a) -->\n";
  assert.ok(root.includes(marker2), "precondition: the last marker must be present before we remove it");
  root = root.replace(marker2, "");
  writeRoot(ws, root);
  const rootBefore = readRoot(ws);
  const laneBefore = readLane(ws, "e999");

  assert.throws(() => migrateFeatReverse(ws, "e999"), /marker\(s\) found but they declare of=/);
  assert.equal(readRoot(ws), rootBefore, "a refused reverse must touch nothing");
  assert.equal(readLane(ws, "e999"), laneBefore);
  assert.ok(fs.existsSync(laneTasksPath(ws, "e999")), "the lane ledger must survive a refused reverse");
});

test("AC8 (feat): the reverse refuses when a marker is duplicated (two markers claim run=1)", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac8-feat-dup-");
  const marker1a = "<!-- tasks_moved: lane=e999 run=1 of=1 sections=1 -> .current/e999/tasks.md (E125a) -->";
  const marker1b = "<!-- tasks_moved: lane=e999 run=1 of=1 sections=1 -> .current/e999/tasks.md (E125a) -->";
  writeRoot(ws, V1 + marker1a + "\n" + marker1b + "\n## e123a-y\n- [ ] T-E123A-01 unrelated\n");
  fs.mkdirSync(path.dirname(laneTasksPath(ws, "e999")), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws, "e999"), V2 + "## e999-x\n- [ ] T-E999-01 first\n");
  const rootBefore = readRoot(ws);

  assert.throws(() => migrateFeatReverse(ws, "e999"), /missing, duplicated or out of order/);
  assert.equal(readRoot(ws), rootBefore);
});

test("AC8 (feat): the reverse refuses when markers are out of order (run=2 appears before run=1)", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac8-feat-order-");
  const marker2 = "<!-- tasks_moved: lane=e999 run=2 of=2 sections=1 -> .current/e999/tasks.md (E125a) -->";
  const marker1 = "<!-- tasks_moved: lane=e999 run=1 of=2 sections=1 -> .current/e999/tasks.md (E125a) -->";
  writeRoot(ws, V1 + marker2 + "\n" + marker1 + "\n## e123a-y\n- [ ] T-E123A-01 unrelated\n");
  fs.mkdirSync(path.dirname(laneTasksPath(ws, "e999")), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws, "e999"), V2 + "## e999-x\n- [ ] T-E999-01 first\n## e999-x\n- [ ] T-E999-02 second\n");
  const rootBefore = readRoot(ws);

  assert.throws(() => migrateFeatReverse(ws, "e999"), /missing, duplicated or out of order/);
  assert.equal(readRoot(ws), rootBefore);
});

// ===========================================================================
// AC9 — tw_* read/write lane-local only
// ===========================================================================

test("AC9: once migrated, tw_add_task/tw_complete_task/tw_rollback_task/tw_void_task/tw_sync change ONLY the lane ledger — root stays byte-identical, mtime unchanged", async () => {
  const ws = mkWorkspace("e125a-ac9-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n- [ ] T02 second\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);
  getNextTaskFromFile(ws); // forward migration

  const rootAfterMigration = readRoot(ws);
  const rootMtimeAfterMigration = fs.statSync(path.join(ws, "tasks.md")).mtimeMs;
  await new Promise((r) => setTimeout(r, 5));

  await addTaskInFile(ws, "T03", "third");
  await completeTaskInFile(ws, "T01");
  await rollbackTaskInFile(ws, "T01", "undo");
  await voidTaskInFile(ws, "T02", "mis-cut");
  await reconcileTasks(ws);

  assert.equal(readRoot(ws), rootAfterMigration, "root must stay byte-identical across every subsequent tw_* mutator call");
  assert.equal(
    fs.statSync(path.join(ws, "tasks.md")).mtimeMs,
    rootMtimeAfterMigration,
    "root mtime must not change on any subsequent mutator call",
  );

  const lane = readLane(ws);
  assert.match(lane, /- \[ \] T01 first \(reverted: undo\)/);
  assert.match(lane, /- \[-\] T02 second \(voided: mis-cut\)/);
  assert.match(lane, /- \[ \] T03 third/);

  // tw_get_next_task / tw_detect_drift / listTasks ignore every checkbox row
  // in root — the root's frozen "T01"/"T02" rows must never surface.
  const drift = JSON.parse(detectDrift(ws));
  assert.ok(!drift.tasksIncomplete.includes("T02"), "the voided row from the lane must not surface as drift from root's stale copy either");
});

test("AC9: an unmigrated feat lane with no rows in root — tw_add_task creates the lane ledger and does not touch root", async () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac9-unmigrated-");
  const B = "## e123a-y\n- [ ] T-E123A-01 unrelated only\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  const added = JSON.parse(await addTaskInFile(ws, "T-E999-01", "first"));
  assert.equal(added.success, true);
  assert.equal(added.path, laneTasksPath(ws, "e999"));
  assert.equal(readRoot(ws), V1 + B, "root must not be touched by this add");
});

// ===========================================================================
// AC11 — freshness: the lazy migration triggered by a mutating call succeeds
// with no freshness violation, and a second mutating call in the same
// session also succeeds
// ===========================================================================

test("AC11: a tw_get_state snapshot taken BEFORE the first migration survives the migration — the triggering mutation succeeds, and a second mutation in the same session also succeeds", async () => {
  const ws = mkWorkspace("e125a-ac11-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n- [ ] T02 second\n";
  writeRoot(ws, V1 + B);
  // Snapshot taken against the PRE-migration (root) path.
  freshSession(ws);

  // First mutating call triggers the migration under its own lock.
  const first = JSON.parse(await completeTaskInFile(ws, "T01"));
  assert.equal(first.success, true, "the migration-triggering mutation must succeed with no STATE DRIFT");

  // Second mutating call in the SAME session must also succeed — proves the
  // session snapshot was carried over to the new lane path (R-1).
  const second = JSON.parse(await completeTaskInFile(ws, "T02"));
  assert.equal(second.success, true, "a second mutating call in the same session must also succeed");

  assert.match(readLane(ws), /- \[x\] T01 first/);
  assert.match(readLane(ws), /- \[x\] T02 second/);
});

test("AC11: R-1 — a read-path migration only carries the session snapshot when THIS call actually migrated", () => {
  const ws = mkWorkspace("e125a-ac11-read-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  freshSession(ws);

  // The read path triggers and completes the migration synchronously and in
  // full within getNextTaskFromFile — verifyFreshness against the NEW lane
  // path must not throw immediately afterward (proving the snapshot carried).
  getNextTaskFromFile(ws);
  assert.doesNotThrow(() => verifyFreshness(ws, laneTasksPath(ws), "tasks"));
});

// ===========================================================================
// AC14 — merge interleave: every task id is live in exactly one ledger
// ===========================================================================

test("AC14-1: feat-first fixture — a hand-built _primary ledger containing a stale copy of e999's rows, plus a separately-created e999 ledger: _primary's tw_get_next_task/tw_complete_task never see or touch the e999-owned id", async () => {
  const ws = mkWorkspace("e125a-ac14-feat-first-");
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.mkdirSync(path.join(ws, ".current", "e999"), { recursive: true });
  fs.writeFileSync(
    laneTasksPath(ws, "_primary"),
    V2 + "# Tasks\n\n## Active\n- [ ] T-A own row\n\n## e999-x\n- [ ] T-E999-01 stale foreign row\n",
  );
  fs.writeFileSync(laneTasksPath(ws, "e999"), V2 + "## e999-x\n- [ ] T-E999-01 real row\n");
  freshSession(ws);

  const rows = parseTasksFromFile(ws);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["T-A"],
    "_primary's live view must exclude the e999-owned section entirely",
  );

  const next = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(next.next.id, "T-A", "tw_get_next_task must never offer the foreign e999 row");

  const complete = JSON.parse(await completeTaskInFile(ws, "T-E999-01"));
  assert.match(complete.error, /not found/, "tw_complete_task must never reach the foreign e999 row through _primary");

  const drift = JSON.parse(detectDrift(ws));
  assert.ok(!drift.tasksIncomplete.includes("T-E999-01"), "tw_detect_drift's comparison must exclude the foreign row too");
});

test("AC14-1(d): addTaskInFile, resolved as _primary, refuses to add a task under a section name that resolves to an existing other lane's ticket id", async () => {
  const ws = mkWorkspace("e125a-ac14-d-");
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.mkdirSync(path.join(ws, ".current", "e999"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws, "_primary"), V2 + "# Tasks\n\n## Active\n- [ ] T-A own row\n");
  fs.writeFileSync(laneTasksPath(ws, "e999"), V2 + "## e999-x\n- [ ] T-E999-01 real row\n");
  freshSession(ws);

  const added = JSON.parse(await addTaskInFile(ws, "T-B", "new row", "e999-x"));
  assert.match(added.error, /has its own live task ledger/, "adding under a foreign lane's section name must be refused");
  assert.ok(!/T-B/.test(readLane(ws, "_primary")), "the refused row must never land in _primary's ledger");
});

test("AC14-2: primary-first fixture — root is already v2 before the lane's first access: the lane starts empty (D13)", () => {
  const ws = mkFeatWorkspaceFake("e999", "e125a-ac14-primary-first-");
  writeRoot(ws, V2 + NOTICE + "# Tasks\n\n## e999-x\n- [ ] T-E999-01 pre-existing on main\n");
  freshSession(ws);

  const next = JSON.parse(getNextTaskFromFile(ws));
  assert.match(next.error, /No task list file found/, "a v2 root is never a forward source (D13) — the lane starts empty");
  assert.ok(!fs.existsSync(laneTasksPath(ws, "e999")));
});

test("AC14-3: emitFeatureMetrics' ticket count is unaffected by the feat-first stale-duplicate fixture — deduplicated by task id, never double-counted", () => {
  const ws = mkWorkspace("e125a-ac14-metrics-");
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.mkdirSync(path.join(ws, ".current", "e999"), { recursive: true });
  // _primary's stale copy shows T-E999-01 as [x] (completed) — the exact
  // shape a stale pre-extraction snapshot could carry; e999's OWN ledger
  // also shows it [x]. Both must collapse to ONE counted id.
  fs.writeFileSync(
    laneTasksPath(ws, "_primary"),
    V2 + "# Tasks\n\n## Active\n- [x] T-E999-01 stale completed copy\n",
  );
  fs.writeFileSync(laneTasksPath(ws, "e999"), V2 + "## e999-x\n- [x] T-E999-01 real completed row\n");
  fs.writeFileSync(path.join(ws, "package.json"), JSON.stringify({ version: "0.0.0-test" }));
  writeRoot(ws, V1 + "# Tasks\n"); // legacy root, irrelevant to the count here

  emitFeatureMetrics({
    workspacePath: ws,
    feature: "e999-lane-merge-interleave",
    qaRoundsTotal: 0,
    reviewRoundsTotal: 0,
    visualRoundsTotal: 0,
    hops: 1,
  });

  const metricsFile = path.join(ws, ".current", "_primary", "metrics.jsonl");
  const lines = fs
    .readFileSync(metricsFile, "utf-8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].tickets, 1, "T-E999-01 must be counted exactly once across the root, _primary's stale copy, and e999's own ledger");
});

// ===========================================================================
// A _primary section for a lane whose ledger has CLOSED into
// .current/history/<bucket>/<lane>/tasks.md (not merely moved to another
// LIVE lane dir, AC14-1's shape) is foreign for exactly the same reason: the
// SAME makeForeignCheck existence check in tools/tasks-file.ts, now ORed with
// hasHistoryLedger (e125b spec AC8, T-E125B-01; ownership extended by the
// integrator pre-review 2026-09-25). Placed alongside the AC14 tests above (the
// nearest fixture test for the merge-interleave rule) — these two tests are
// the history-bucket-shaped twins of AC14-1 and AC14-1(d) respectively.
// ===========================================================================

function historyLaneTasksPath(ws, bucket, lane) {
  return path.join(ws, ".current", "history", bucket, lane, "tasks.md");
}

test("AC8 (e125b, X7): a _primary section for a CLOSED (history-bucket) lane is hidden on every read — tw_get_next_task/tw_complete_task/tw_detect_drift never see or touch the closed lane's id", async () => {
  const ws = mkWorkspace("e125b-ac8-x7-read-");
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(
    laneTasksPath(ws, "_primary"),
    V2 + "# Tasks\n\n## Active\n- [ ] T-A own row\n\n## e999-x\n- [ ] T-E999-01 stale foreign row\n",
  );
  // e999's OWN ledger is not live any more — it closed into the history
  // bucket (e125b AC1: closed lanes move to history), exactly what `agc feature finish --shipped` would
  // have produced.
  fs.mkdirSync(path.dirname(historyLaneTasksPath(ws, "2026-09", "e999")), { recursive: true });
  fs.writeFileSync(historyLaneTasksPath(ws, "2026-09", "e999"), V2 + "## e999-x\n- [ ] T-E999-01 real row\n");
  freshSession(ws);

  const rows = parseTasksFromFile(ws);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["T-A"],
    "_primary's live view must exclude the closed-lane e999 section, exactly as a live foreign lane's section is already excluded (D12/AC14(a))",
  );

  const next = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(next.next.id, "T-A", "tw_get_next_task must never offer a row from a closed (history-bucket) lane's stale _primary section");

  const complete = JSON.parse(await completeTaskInFile(ws, "T-E999-01"));
  assert.match(complete.error, /not found/, "tw_complete_task must never reach the closed lane's row through _primary");

  const drift = JSON.parse(detectDrift(ws));
  assert.ok(!drift.tasksIncomplete.includes("T-E999-01"), "tw_detect_drift's comparison must exclude the closed-lane row too");
});

test("AC8 (e125b, X7): tw_add_task refuses to add under a _primary section name that resolves to a CLOSED (history-bucket) lane — same refusal as a live foreign lane, no new message needed", async () => {
  const ws = mkWorkspace("e125b-ac8-x7-add-");
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws, "_primary"), V2 + "# Tasks\n\n## Active\n- [ ] T-A own row\n");
  fs.mkdirSync(path.dirname(historyLaneTasksPath(ws, "2026-09", "e999")), { recursive: true });
  fs.writeFileSync(historyLaneTasksPath(ws, "2026-09", "e999"), V2 + "## e999-x\n- [ ] T-E999-01 real row\n");
  freshSession(ws);

  const added = JSON.parse(await addTaskInFile(ws, "T-B", "new row", "e999-x"));
  assert.match(added.error, /has its own live task ledger/, "adding under a closed lane's section name must be refused — same isPrimaryLedger(...) && makeForeignCheck(...) check, now foreign for one more reason (hasHistoryLedger)");
  assert.ok(!/T-B/.test(readLane(ws, "_primary")), "the refused row must never land in _primary's ledger");
});

test("AC8 (e125b, X7): a _primary section for a lane with NEITHER a live ledger NOR a closed-history one is genuinely NOT foreign — resolveLaneName still recognizes the id, but nothing excludes it (own-section, not a stale copy)", async () => {
  // Guards against an over-eager hasHistoryLedger that would treat every
  // lane-shaped section as foreign regardless of whether anything backs it.
  const ws = mkWorkspace("e125b-ac8-x7-noforeign-");
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws, "_primary"), V2 + "# Tasks\n\n## e321-y\n- [ ] T-E321-01 genuinely _primary's own row\n");
  freshSession(ws);

  const rows = parseTasksFromFile(ws);
  assert.deepEqual(rows.map((r) => r.id), ["T-E321-01"], "a section with no live AND no closed-history sibling ledger must not be excluded");
});

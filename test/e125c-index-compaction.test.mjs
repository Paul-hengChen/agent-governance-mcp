// Coded by @qa-engineer
// T-E125C-05: new coverage for specs/e125c-index-compaction.md AC1-AC6, AC10,
// AC11 (E195 reverse-migration receipt/normalization behaviour + the
// real-data compaction round trip). AC7-AC9, AC12-AC14 are proved by
// `.current/e125c/compaction-procedure.md` (sr's evidence file) and by
// grep/golden checks run directly (see qa_reports/review_T-E125C-05.md ##
// AC Execution Log) — this file carries no test case for them. Imports
// compiled dist/. Every fixture lives under os.tmpdir() and is never the
// repo root; AC10/AC11 read FROZEN copies of tasks.md /
// .current/_primary/tasks.md / .current/tasks-index-receipt.json checked in
// under test/fixtures/e125c-frozen/ (byte-exact as of commit ed7432f, the
// E125c compaction snapshot AC11's facts describe) into a throwaway $TMPDIR
// copy, and never read or write the live repo tree (E204:
// T-E204-01 — the prior live-disk read drifted red the moment the primary
// ledger gained a row after ed7432f; see .current/e204/tasks.md).
//
// Spec-to-Test map:
//   AC1  (identity round trip, no CL/no markers)        -> AC1 identity round trip
//   AC2  (Closed Lanes carried across reverse)          -> AC2 closed-lanes carry
//   AC3  (root-side marker removal tolerated)           -> AC3 removed markers
//   AC4  (any other hand-edit still refuses)            -> AC4 hand-edit refuses
//   AC5  (legacy raw-sha receipt accepted)              -> AC5 legacy receipt
//   AC6  (CL-bearing double round trip; no-CL forward
//         unchanged modulo the disclosed receipt
//         deviation, F1)                                 -> AC6 double round trip,
//                                                           AC6 forward unchanged without CL
//   AC10 (real-data round trip)                          -> AC10 real-data round trip
//   AC11 (consumer parity: parseTasksFromFile,
//         getNextTaskFromFile, emitFeatureMetrics)        -> AC11 consumer parity
//   F2 (reviewer finding, pinned as known behaviour,
//       E125c-NEW-5 — NOT a failure)                      -> F2 fabricated marker absorbed

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  primaryIndexReceiptSha,
  migratePrimaryReverse,
} from "../dist/tools/tasks-lane-migrate.js";
import { parseTasksFromFile, getNextTaskFromFile } from "../dist/tools/tasks-file.js";
import { emitFeatureMetrics } from "../dist/tools/metrics.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

setActiveStorage(new FileHandoffStorage());

// T-E77-02 (hermetic test fixture rule): no test/ file may read repository
// HISTORY as a fixture (`git show <rev>:<path>`, `git log`, a pinned sha
// ref). AC10/AC11 satisfy this by reading FROZEN, checked-in copies under
// test/fixtures/e125c-frozen/ via plain fs (no git invocation anywhere in
// this file) — never the live repo tree, so there is no "working tree
// clean" precondition to maintain. The frozen copies are byte-exact
// snapshots of the repo's tasks.md / .current/_primary/tasks.md /
// .current/tasks-index-receipt.json as of commit ed7432f (cited here in a
// plain comment only, per T-E77-02); refreshing them is a deliberate,
// reviewed fixture update, not something this test file ever does itself.
const __filename = fileURLToPath(import.meta.url);
const FIXTURES = path.resolve(path.dirname(__filename), "fixtures", "e125c-frozen");

// ---------------------------------------------------------------------------
// Fixture helpers (mirrors test/e125a-lane-local-ledgers.test.mjs's shapes;
// re-declared locally — test files do not import each other).
// ---------------------------------------------------------------------------

function mkWorkspace(prefix = "e125c-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// A pure-fs fake .git is enough for every test below: `git check-ignore`
// spawned against it fails (not a real repo) and that failure is treated as
// "not ignored", the same fallback as "no .git at all" — none of these
// fixtures exercise the option-A ignored-lane path.
function mkPrimaryWorkspace(prefix = "e125c-") {
  const ws = mkWorkspace(prefix);
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/main\n");
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
function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}
// Frozen-fixture file names, keyed by the live repo path they pin (E204).
const FROZEN = {
  "tasks.md": "root-tasks.md",
  ".current/_primary/tasks.md": "primary-tasks.md",
  ".current/tasks-index-receipt.json": "tasks-index-receipt.json",
};
function readCommitted(relPath) {
  const frozenName = FROZEN[relPath];
  if (!frozenName) throw new Error(`readCommitted: no frozen fixture registered for ${relPath}`);
  return fs.readFileSync(path.join(FIXTURES, frozenName), "utf-8");
}

const V1 = "<!-- schema_version: 1 -->\n";
const V2 = "<!-- schema_version: 2 -->\n";
const NOTICE =
  "<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->\n";

function marker(lane, run, of, sections) {
  return `<!-- tasks_moved: lane=${lane} run=${run} of=${of} sections=${sections} -> .current/${lane}/tasks.md (E125a) -->`;
}

// ===========================================================================
// AC1 — identity round trip (no CL, no markers): normalize is the identity
// on a canonical body, so the receipt is plain sha256(B) and the round trip
// is byte-exact (e125a AC7 unchanged, plus this explicit receipt check).
// ===========================================================================

test("AC1 identity round trip: a v1 root with no CL section and no marker lines forwards to receipt === sha256(B) and reverses byte-identical", () => {
  const ws = mkPrimaryWorkspace("e125c-ac1-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);

  getNextTaskFromFile(ws); // forward

  assert.equal(readLane(ws), V2 + B, "ledger must be the raw body verbatim under a v2 sentinel");
  assert.equal(readRoot(ws), V2 + NOTICE + B, "root must be sentinel+notice+body verbatim");
  const receipt = JSON.parse(fs.readFileSync(receiptPath(ws), "utf-8"));
  assert.equal(receipt.bodySha256, sha256(B), "normalize is the identity on a canonical body: receipt === sha256(B)");
  assert.equal(receipt.bodySha256, primaryIndexReceiptSha(B), "and therefore also === primaryIndexReceiptSha(B)");

  migratePrimaryReverse(ws);

  assert.equal(readRoot(ws), V1 + B, "root must be byte-identical to the original after a no-edits round trip");
  assert.ok(!fs.existsSync(laneTasksPath(ws)));
  assert.ok(!fs.existsSync(receiptPath(ws)));
});

// ===========================================================================
// AC2 — Closed Lanes carried across reverse (never dropped; moved to the end
// when not already trailing).
// ===========================================================================

test("AC2 closed-lanes carry: a Closed-Lanes-shaped append to the post-forward root survives the reverse, and a CL section that was NOT trailing is moved to the end", () => {
  const ws = mkPrimaryWorkspace("e125c-ac2-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  getNextTaskFromFile(ws); // forward: no CL yet

  // Simulate applyClosedLanePointer-shaped text appended by `agc feature
  // finish --shipped`: blank line, heading, blank line, one pointer line.
  const cl = "\n## Closed Lanes\n\n<!-- lane_closed: ticket=e001 branch=feat/e001-x pr=1 base_sha=deadbeef -->\n";
  fs.appendFileSync(path.join(ws, "tasks.md"), cl);

  migratePrimaryReverse(ws);

  assert.equal(
    readRoot(ws),
    V1 + B + "\n## Closed Lanes\n\n<!-- lane_closed: ticket=e001 branch=feat/e001-x pr=1 base_sha=deadbeef -->\n",
    "the CL section must be carried into the restored v1 root, appended after the body",
  );
});

test("AC2 closed-lanes carry: a CL section that is NOT trailing in the root (prose follows it) is still carried, moved to the end of the restored body", () => {
  const ws = mkPrimaryWorkspace("e125c-ac2-nontrailing-");
  // A CL-bearing v1 root (the AC6 R1 shape) where a later section follows CL —
  // an unusual but well-formed input; the reverse must still relocate CL to
  // the end rather than drop it or leave it mid-body.
  const B =
    "# Tasks\n\n## Active\n- [ ] T01 first\n\n## Closed Lanes\n\n<!-- lane_closed: ticket=e001 branch=feat/e001-x pr=1 base_sha=deadbeef -->\n## Later\n- [ ] T02 second\n";
  writeRoot(ws, V1 + B);
  getNextTaskFromFile(ws); // forward peels CL out of the ledger copy (R1=A)

  migratePrimaryReverse(ws);

  assert.equal(
    readRoot(ws),
    V1 +
      "# Tasks\n\n## Active\n- [ ] T01 first\n## Later\n- [ ] T02 second\n\n## Closed Lanes\n\n<!-- lane_closed: ticket=e001 branch=feat/e001-x pr=1 base_sha=deadbeef -->\n",
    "CL must be relocated to the end, never left mid-body and never dropped",
  );
});

// ===========================================================================
// AC3 — root-side tasks_moved marker removal (finish --shipped's own
// removal) is tolerated: the reverse omits every ledger marker line no
// longer present in the root, keeps every one still present.
// ===========================================================================

test("AC3 removed markers: a marker deleted from the root only (finish --shipped's removal) is dropped from the restored root; a marker still present in the root is kept verbatim", () => {
  const ws = mkPrimaryWorkspace("e125c-ac3-");
  const m1 = marker("e001", 1, 1, 1);
  const m2 = marker("e002", 1, 1, 1);
  const B = `# Tasks\n\n${m1}\n${m2}\n## kept-section\n- [ ] T01 x\n`;
  writeRoot(ws, V1 + B);
  getNextTaskFromFile(ws); // forward: both markers land in the ledger body too

  assert.equal(readLane(ws), V2 + B, "the ledger copy carries both markers verbatim (no CL to peel)");

  // Simulate `finish --shipped` removing lane e002's marker from the root
  // index only — the ledger (never read by finish) still has it.
  const rootAfterForward = readRoot(ws);
  const rootAfterFinish = rootAfterForward.replace(`${m2}\n`, "");
  fs.writeFileSync(path.join(ws, "tasks.md"), rootAfterFinish);

  migratePrimaryReverse(ws);

  assert.equal(
    readRoot(ws),
    V1 + B.replace(`${m2}\n`, ""),
    "restored root must omit m2 (no longer in the root index) but keep m1 (still present) verbatim",
  );
});

// ===========================================================================
// AC4 — any OTHER change to the normalized body still refuses, touching
// nothing — even in the presence of markers (proves normalization does not
// mask a genuine hand-edit).
// ===========================================================================

test("AC4 hand-edit refuses: a hand-edited task row (not a marker, not CL) still refuses the reverse and touches nothing, even with markers present", () => {
  const ws = mkPrimaryWorkspace("e125c-ac4-");
  const m1 = marker("e001", 1, 1, 1);
  const B = `# Tasks\n\n${m1}\n## kept\n- [ ] T01 x\n`;
  writeRoot(ws, V1 + B);
  getNextTaskFromFile(ws); // forward

  const rootBefore = readRoot(ws);
  const ledgerBefore = readLane(ws);
  const tampered = rootBefore.replace("- [ ] T01 x", "- [ ] T01 x EDITED BY HAND");
  fs.writeFileSync(path.join(ws, "tasks.md"), tampered);

  assert.throws(() => migratePrimaryReverse(ws), /body changed since the forward migration/);
  assert.equal(readRoot(ws), tampered, "a refused reverse must not touch the (tampered) root");
  assert.equal(readLane(ws), ledgerBefore, "a refused reverse must not touch the ledger");
  assert.ok(fs.existsSync(receiptPath(ws)), "a refused reverse must not consume the receipt");
});

// ===========================================================================
// AC5 — a legacy receipt (stamped pre-E125c as sha256(raw body)) is still
// accepted when the root body is byte-identical to that raw body.
// ===========================================================================

test("AC5 legacy receipt: a receipt stamped as sha256(raw body) (pre-E125c shape) on an otherwise-untouched, marker-bearing root still lets the reverse succeed", () => {
  const ws = mkPrimaryWorkspace("e125c-ac5-");
  const m1 = marker("e001", 1, 1, 1);
  // A marker line in the body means primaryIndexReceiptSha(B) !== sha256(B) —
  // exactly the case that distinguishes "legacy raw sha" from "normalized
  // sha", so this test is meaningless on a marker-free body.
  const B = `# Tasks\n\n${m1}\n## Active\n- [ ] T01 first\n`;
  writeRoot(ws, V1 + B);
  getNextTaskFromFile(ws); // forward stamps the NEW-style (normalized) receipt

  assert.notEqual(sha256(B), primaryIndexReceiptSha(B), "sanity: the two sha flavours really do differ on this body");

  // Overwrite with the LEGACY shape a pre-E125c stamp would have written.
  fs.writeFileSync(receiptPath(ws), `${JSON.stringify({ bodySha256: sha256(B) })}\n`);

  assert.doesNotThrow(() => migratePrimaryReverse(ws), "AC5: receipt === sha256(raw body) must be accepted, not just receipt === primaryIndexReceiptSha(body)");
  assert.equal(readRoot(ws), V1 + B);
});

// ===========================================================================
// AC6 — CL-bearing double round trip, and the no-CL "forward unchanged"
// condition (amended by the integrator, to-lane#2: the receipt MAY differ
// for a marker-bearing no-CL body — see F1 in review_reports/review_T-E125C-04.md).
// ===========================================================================

test("AC6 double round trip: a v1 root ending in a CL section round-trips byte-exact (v1 -> forward -> reverse), and post-forward state round-trips byte-exact (reverse -> forward)", () => {
  const ws = mkPrimaryWorkspace("e125c-ac6-");
  const B =
    "# Tasks\n\n## Active\n- [ ] T01 first\n\n## Closed Lanes\n\n<!-- lane_closed: ticket=e001 branch=feat/e001-x pr=1 base_sha=deadbeef -->\n";
  writeRoot(ws, V1 + B);

  getNextTaskFromFile(ws); // forward #1
  const ledgerAfterForward1 = readLane(ws);
  const rootAfterForward1 = readRoot(ws);
  const receiptAfterForward1 = fs.readFileSync(receiptPath(ws), "utf-8");

  // The ledger must NOT carry the CL section (R1=A: peeled at forward time).
  assert.equal(
    ledgerAfterForward1,
    V2 + "# Tasks\n\n## Active\n- [ ] T01 first\n",
    "the _primary ledger must receive the body WITHOUT the CL section, canonical trailing newline",
  );
  assert.equal(rootAfterForward1, V2 + NOTICE + B, "the root index keeps the CL section verbatim");

  // Round trip #1: v1 -> forward -> reverse == original v1, byte-exact.
  migratePrimaryReverse(ws);
  assert.equal(readRoot(ws), V1 + B, "reverse of a CL-bearing forward must restore the original v1 root byte-for-byte");
  assert.ok(!fs.existsSync(laneTasksPath(ws)));
  assert.ok(!fs.existsSync(receiptPath(ws)));

  // Round trip #2: post-forward-#1 state -> reverse -> forward reproduces
  // ledger, root and receipt byte-for-byte (a pure function of the same B).
  getNextTaskFromFile(ws); // forward #2, from the restored v1 root
  assert.equal(readLane(ws), ledgerAfterForward1, "forward #2's ledger must reproduce forward #1's ledger byte-for-byte");
  assert.equal(readRoot(ws), rootAfterForward1, "forward #2's root must reproduce forward #1's root byte-for-byte");
  assert.equal(
    fs.readFileSync(receiptPath(ws), "utf-8"),
    receiptAfterForward1,
    "forward #2's receipt must reproduce forward #1's receipt byte-for-byte",
  );
});

test("AC6 forward unchanged without CL: a marker-free canonical body forwards to ledger/root/receipt byte-identical to the pre-change forward (receipt === sha256(body) too)", () => {
  const ws = mkPrimaryWorkspace("e125c-ac6-nocl-plain-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);

  getNextTaskFromFile(ws);

  assert.equal(readLane(ws), V2 + B);
  assert.equal(readRoot(ws), V2 + NOTICE + B);
  const receipt = JSON.parse(fs.readFileSync(receiptPath(ws), "utf-8"));
  assert.equal(receipt.bodySha256, sha256(B), "marker-free canonical body: receipt is byte-identical to the pre-change forward's plain sha256(body)");
});

test("AC6 forward unchanged without CL: a marker-bearing no-CL body still forwards ledger/root byte-identical to the pre-change forward; ONLY the receipt legitimately differs from sha256(raw body) (disclosed F1) — and stays valid via AC5's legacy-sha fallback", () => {
  const ws = mkPrimaryWorkspace("e125c-ac6-nocl-marker-");
  const m1 = marker("e001", 1, 1, 1);
  const B = `# Tasks\n\n${m1}\n## Active\n- [ ] T01 first\n`;
  writeRoot(ws, V1 + B);

  getNextTaskFromFile(ws);

  // Ledger and root index: byte-identical to what the pre-change forward
  // would have written (verbatim copy — untouched by markers, since there is
  // no CL to peel).
  assert.equal(readLane(ws), V2 + B, "ledger must still be the raw body verbatim (markers included) — integrator condition (ii), ledger half");
  assert.equal(readRoot(ws), V2 + NOTICE + B, "root index must still be the raw body verbatim — integrator condition (ii), root half");

  // Receipt: the disclosed deviation. It is NOT sha256(raw body) any more
  // (that would fail to tolerate AC3's root-side marker removal), but it IS
  // primaryIndexReceiptSha(body), and a legacy sha256(raw body) receipt
  // would ALSO still validate on reverse (AC5) — so nothing regresses.
  const receipt = JSON.parse(fs.readFileSync(receiptPath(ws), "utf-8"));
  assert.notEqual(
    receipt.bodySha256,
    sha256(B),
    "disclosed F1: a marker-bearing no-CL body's receipt is NOT byte-identical to the pre-change plain sha256(body)",
  );
  assert.equal(receipt.bodySha256, primaryIndexReceiptSha(B), "the receipt IS primaryIndexReceiptSha(body) — required so AC3 can hold");
  assert.doesNotThrow(() => migratePrimaryReverse(ws), "the new-style receipt must still let the reverse succeed");
});

// ===========================================================================
// AC10 — real-data round trip (Wave 8): frozen, checked-in copies (as of
// ed7432f — see test/fixtures/e125c-frozen/, E204) of the repo's tasks.md /
// _primary ledger / receipt, copied into a throwaway $TMPDIR workspace,
// round-trip through reverse then forward byte-for-byte. Never reads or
// writes the live repo tree.
// ===========================================================================

test("AC10 real-data round trip: the repo's committed tasks.md / _primary ledger / receipt reverse then forward byte-for-byte in a $TMPDIR copy", () => {
  const rootReal = readCommitted("tasks.md");
  const ledgerReal = readCommitted(".current/_primary/tasks.md");
  const receiptReal = readCommitted(".current/tasks-index-receipt.json");

  const ws = mkPrimaryWorkspace("e125c-ac10-");
  writeRoot(ws, rootReal);
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), ledgerReal);
  fs.writeFileSync(receiptPath(ws), receiptReal);

  migratePrimaryReverse(ws);
  assert.ok(readRoot(ws).startsWith(V1), "the reverse must restore a v1-sentinel root");
  assert.ok(!fs.existsSync(laneTasksPath(ws)));
  assert.ok(!fs.existsSync(receiptPath(ws)));

  getNextTaskFromFile(ws); // forward again, from the restored v1 root

  assert.equal(readRoot(ws), rootReal, "root must reproduce the real committed root byte-for-byte");
  assert.equal(readLane(ws), ledgerReal, "_primary ledger must reproduce the real committed ledger byte-for-byte");
  assert.equal(
    fs.readFileSync(receiptPath(ws), "utf-8"),
    receiptReal,
    "receipt must reproduce the real committed receipt byte-for-byte",
  );
});

// ===========================================================================
// AC11 — no tw_* consumer regresses on the compacted ledger.
// ===========================================================================

test("AC11 consumer parity: parseTasksFromFile returns only the kept sections' rows; getNextTaskFromFile reports allComplete; emitFeatureMetrics' E125A ticket count is unchanged (7)", () => {
  const rootReal = readCommitted("tasks.md");
  const ledgerReal = readCommitted(".current/_primary/tasks.md");

  const ws = mkPrimaryWorkspace("e125c-ac11-");
  writeRoot(ws, rootReal);
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), ledgerReal);

  const tasks = parseTasksFromFile(ws);
  assert.ok(Array.isArray(tasks) && tasks.length > 0, "parseTasksFromFile must return the kept sections' rows, not null/empty");
  const sections = new Set(tasks.map((t) => t.section));
  assert.deepEqual(
    [...sections].sort(),
    ["e125a-lane-local-ledgers", "e137-render-sanitise", "e145-md-tables-cited-donemark"].sort(),
    "the parsed rows must come from exactly the 3 kept sections",
  );

  const next = JSON.parse(getNextTaskFromFile(ws));
  assert.equal(next.allComplete, true, "getNextTaskFromFile must report allComplete: true — 0 open rows before and after compaction");

  const e125aIds = tasks.filter((t) => /^T-E125A-/.test(t.id));
  assert.equal(e125aIds.length, 7, "E125A ticket count must be unchanged at 7 because its rows are kept, not compacted");

  emitFeatureMetrics({
    workspacePath: ws,
    feature: "e125a-lane-local-ledgers",
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
  assert.equal(lines[0].tickets, 7, "emitFeatureMetrics must count exactly 7 T-E125A-* ids, deduplicated across root + _primary ledger");
});

// ===========================================================================
// F2 (code-reviewer finding, review_reports/review_T-E125C-04.md — filed as
// E125c-NEW-5, accepted by the integrator as a known residue, NOT a QA
// failure): a hand-fabricated tasks_moved marker line in the root index is
// silently absorbed by the reverse rather than refused. Pinned here so a
// future hardening (recording the forward-time marker set in the receipt)
// flips this deliberately, with a red test as the signal.
// ===========================================================================

test("F2 (pinned known behaviour, not a failure): a hand-fabricated tasks_moved marker line added to the root only is silently dropped by the reverse instead of refusing", () => {
  const ws = mkPrimaryWorkspace("e125c-f2-");
  const B = "# Tasks\n\n## Active\n- [ ] T01 first\n";
  writeRoot(ws, V1 + B);
  getNextTaskFromFile(ws); // forward: no markers anywhere yet

  const fake = marker("zzz-fake", 1, 1, 1);
  const tampered = readRoot(ws) + `${fake}\n`;
  fs.writeFileSync(path.join(ws, "tasks.md"), tampered);

  assert.doesNotThrow(() => migratePrimaryReverse(ws), "normalizeIndexBody strips every marker-shaped line, sanctioned or not, so this does not refuse");
  assert.equal(
    readRoot(ws),
    V1 + B,
    "the fabricated marker line never reaches the ledger, so it is silently absent from the restored root — no data loss, no refusal (known residue, E125c-NEW-5)",
  );
});

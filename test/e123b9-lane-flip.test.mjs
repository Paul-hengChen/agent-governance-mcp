// Coded by @qa-engineer
// Tests for the lane-layout flip (specs/e123b9-lane-flip.md) against real fixtures and
// child processes: reversibility (AC8), non-reentrant lock (AC12), cross-process
// concurrency (AC-MIG-3), own-workspace-only migration (AC13), dual-presence conflict
// (AC14). AC21 adds interrupted migration: after a real child-process death a stale lock
// makes the next read skip the partial migration, and only the next write finishes it.
// Rationale: specs/e260f-comment-rationale.md (test/e123b9-lane-flip.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseHandoff, readHandoffState, writeHandoffState } from "../dist/tools/handoff.js";
import { migrateFlatToLane, migrateLaneToFlat } from "../dist/tools/lane-migrate.js";
import {
  resolveCurrentLanePaths,
  resolveCurrentLane,
  resolveLaneDir,
  resolveLaneLockPath,
  LANE_FILES,
} from "../dist/tools/lane-paths.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

const __filename = fileURLToPath(import.meta.url);
const TEST_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(TEST_DIR, "..");
const WORKER_SCRIPT = path.join(TEST_DIR, "_e123b9-migration-worker.mjs");
const ROUND2_SCRIPT = path.join(TEST_DIR, "_e123b9-round2-migrate.mjs");
const CRASH_LOADER = path.join(TEST_DIR, "_e123b9-fault-fs-loader.mjs");
const CRASH_WORKER = path.join(TEST_DIR, "_e123b9-crash-worker.mjs");

// ---------------------------------------------------------------------------
// Shared fixture / verification helpers
// ---------------------------------------------------------------------------

function mkFlatFixture(prefix = "e123b9-flip-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---\nschema_version: 15\nactive_feature: "e123b9-flip-fixture"\nstatus: "In_Progress"\nlast_updated: "2026-01-01T00:00:00.000Z"\nlast_agent: "pm"\nqa_round: 0\nreview_round: 0\nvisual_round: 0\n---\n## Completed\n- (none)\n\n## Pending & Handoff Notes\n- (none)\n`,
  );
  return ws;
}

function mkFlatFixtureWithSidecars(prefix = "e123b9-flip-sc-") {
  const ws = mkFlatFixture(prefix);
  fs.writeFileSync(path.join(ws, ".current", "telemetry.jsonl"), '{"ts":"t1","gate":"g"}\n');
  return ws;
}

// A test-built flat fixture, never the primary checkout's live .current/ (which has no flat
// handoff.md since it migrated itself): already at the current schema and carrying every
// LANE_FILES entry, so both AC8 rounds exercise a real multi-sidecar flat->lane->flat round
// trip on any machine.
function mkFullFlatFixture(prefix = "e123b9-ac8-full-") {
  const ws = mkFlatFixture(prefix);
  fs.writeFileSync(path.join(ws, ".current", "telemetry.jsonl"), '{"ts":"2026-01-01T00:00:00.000Z","gate":"orchestrator","error_code":"TRANSITION_REJECTED","agent_id":"sr-engineer","feature":"e123b9-flip-fixture"}\n');
  fs.writeFileSync(
    path.join(ws, ".current", "metrics.jsonl"),
    '{"ts":"2026-01-01T00:00:00.000Z","feature":"e123b9-flip-fixture","tickets":1,"qa_rounds":0,"review_rounds":0,"visual_rounds":0,"hops":1,"one_pass":true,"released_version":"1.0.0"}\n',
  );
  fs.writeFileSync(
    path.join(ws, ".current", "usage.jsonl"),
    '{"ts":"2026-01-01T00:00:00.000Z","feature":"e123b9-flip-fixture","dispatch":"sr-engineer","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}\n',
  );
  fs.writeFileSync(path.join(ws, ".current", "dispatch.jsonl"), '{"ts":"2026-01-01T00:00:00.000Z","role":"sr-engineer"}\n');
  return ws;
}

/** Per-file SHA-256, keyed by path relative to `root`. */
function hashTree(root) {
  const out = new Map();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.set(path.relative(root, p), crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
    }
  };
  walk(root);
  return out;
}

/** True iff `name` is a lock file or the atomic-tmp-write shape the
 *  reversibility tolerance clause allows (AC8) — ONLY when absent from `before`. */
function isTolerableDebrisName(name) {
  return name === ".handoff.lock" || /\.\d+\.\d+\.tmp$/.test(name);
}

/** Compares two hashTree() Maps under the exact reversibility tolerance rule (AC8): every file
 *  present in `before` must be present, byte-identical, in `after`; any
 *  EXTRA file in `after` is tolerated ONLY if it's lock/tmp-shaped AND was
 *  absent from `before`. Returns a list of human-readable diff lines (empty
 *  = clean). */
function diffTrees(before, after) {
  const diffs = [];
  for (const [relPath, hash] of before) {
    if (!after.has(relPath)) {
      diffs.push(`MISSING after round-trip: ${relPath}`);
    } else if (after.get(relPath) !== hash) {
      diffs.push(`CHANGED: ${relPath} (${hash.slice(0, 12)} -> ${after.get(relPath).slice(0, 12)})`);
    }
  }
  for (const relPath of after.keys()) {
    if (before.has(relPath)) continue;
    const name = path.basename(relPath);
    if (!isTolerableDebrisName(name)) {
      diffs.push(`EXTRA, not tolerable debris: ${relPath}`);
    }
  }
  return diffs;
}

function spawnWorker(ws, mode, startAt) {
  return new Promise((resolve) => {
    let out = "";
    const child = spawn(process.execPath, [WORKER_SCRIPT, ws, mode, String(startAt)]);
    child.stdout.on("data", (d) => (out += d.toString("utf-8")));
    child.stderr.on("data", (d) => (out += d.toString("utf-8")));
    child.on("exit", () => resolve(out.trim()));
  });
}

// ============================================================================
// AC12 — non-reentrant lock: a write against an unmigrated flat fixture
// completes within a bounded timeout, not a silent hang/timeout.
// ============================================================================

test("AC12: writeHandoffState against an unmigrated flat fixture completes well within LOCK_MAX_WAIT_MS and ends up migrated (regression test for the self-deadlock this AC prevents)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkFlatFixture("e123b9-ac12-");
  resetSession(ws); // no markStateRead — mirrors a first-ever touch; verifyFreshness no-ops with no session

  const started = Date.now();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "ac12-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
  });
  const elapsed = Date.now() - started;

  // LOCK_MAX_WAIT_MS is 10_000ms (guards/file-lock.ts); a silent hang/timeout
  // on this path is exactly the regression this test guards against (AC12).
  assert.ok(elapsed < 3000, `expected well under LOCK_MAX_WAIT_MS (10000ms), took ${elapsed}ms`);

  const lanePaths = resolveCurrentLanePaths(ws);
  assert.ok(fs.existsSync(lanePaths.handoffPath), "the write must have migrated the flat fixture into the lane");
  assert.ok(!fs.existsSync(path.join(ws, ".current", "handoff.md")), "flat handoff.md must be gone post-migration");
  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "ac12-feat", "the write's own content must have landed, not just the migration");
});

// ============================================================================
// AC-MIG-3 — concurrency-safety: real cross-process concurrency (separate
// Node processes, each with its own in-memory guards/session.ts state — a
// true test of the FILE lock, not just in-process ordering).
// ============================================================================

test("AC-MIG-3: several concurrent processes (mixed reads/writes) hitting the same unmigrated flat workspace migrate exactly once, never observe half-moved state, and never leak a lock", { timeout: 20_000 }, async () => {
  const ws = mkFlatFixtureWithSidecars("e123b9-mig3-");
  const modes = ["r", "w", "r", "w", "r"];
  const startAt = Date.now() + 400; // give every spawn() enough head start to be ready before the shared instant

  const outputs = await Promise.all(modes.map((m) => spawnWorker(ws, m, startAt)));

  // Every worker's OWN process has independent guards/session.ts state (a
  // fresh readHandoffState-then-writeHandoffState per worker), so a writer
  // that lost the race to a sibling's write legitimately sees its own
  // snapshot go stale and is REJECTED with STATE DRIFT — that is correct,
  // fail-safe behavior (the implementer's own cross-process stress test found the same
  // shape: review_reports/review_T-E123B9-01.md Summary). Anything else is
  // an unexpected failure mode.
  for (const out of outputs) {
    assert.ok(
      out === "R-ok" || out === "W-ok" || /^ERR w ⛔ STATE DRIFT/.test(out),
      `unexpected worker outcome: ${out}`,
    );
  }
  assert.ok(!outputs.some((o) => o === "R-missing"), "every read must see SOME state — the fixture handoff.md existed from the start");

  // Exactly one migration occurred: the lane now holds every LANE_FILES
  // entry that started flat, and NOTHING remains at the flat path — never a
  // split where e.g. handoff.md moved but telemetry.jsonl didn't.
  const lane = resolveCurrentLane(ws);
  const lanePaths = resolveCurrentLanePaths(ws);
  assert.ok(fs.existsSync(lanePaths.handoffPath), "lane handoff.md must exist");
  assert.ok(fs.existsSync(lanePaths.telemetryPath), "lane telemetry.jsonl must exist (no half-moved sidecar)");
  assert.ok(!fs.existsSync(path.join(ws, ".current", "handoff.md")), "flat handoff.md must be gone — no split layout");
  assert.ok(!fs.existsSync(path.join(ws, ".current", "telemetry.jsonl")), "flat telemetry.jsonl must be gone — no split layout");

  // No leftover lock (every acquirer releases in a finally block).
  assert.ok(!fs.existsSync(resolveLaneLockPath(ws, lane)), "no lock file may survive the whole run");

  // The resulting handoff.md parses as well-formed YAML/state.
  const state = parseHandoff(ws);
  assert.ok(state && typeof state.active_feature === "string" && state.active_feature.length > 0, "post-concurrency handoff.md must parse as well-formed state");
});

// ============================================================================
// AC13 — own-workspace-only migration: a cross-workspace-style read
// (parseHandoff, the shared primitive tools/feature-rollup.ts /
// tools/join-precondition.ts actually call) never migrates, locks, or
// creates anything against a flat-only fixture.
// ============================================================================

test("AC13: a cross-workspace-pattern parseHandoff read of a flat-only fixture returns correct state and leaves the .current/ tree byte-identical — no lane dir, no lock, nothing created", () => {
  const ws = mkFlatFixtureWithSidecars("e123b9-ac13-");
  const before = hashTree(path.join(ws, ".current"));

  const state = parseHandoff(ws); // read-only shared primitive — never readHandoffState
  assert.ok(state, "parseHandoff must return the flat state");
  assert.equal(state.active_feature, "e123b9-flip-fixture");

  const after = hashTree(path.join(ws, ".current"));
  const diffs = diffTrees(before, after);
  assert.deepEqual(diffs, [], `parseHandoff (AC13's shared read-only primitive) must move/create/modify NOTHING — diffs: ${JSON.stringify(diffs)}`);

  const lane = resolveCurrentLane(ws);
  assert.ok(!fs.existsSync(path.join(ws, ".current", lane)), "no lane directory may be created by a read-only cross-workspace-pattern call");
  assert.ok(!fs.existsSync(resolveLaneLockPath(ws, lane)), "no lock file may be created");
});

// ============================================================================
// AC14 — dual-presence conflict, scoped to handoff.md ONLY: both the flat
// and lane handoff.md existing at once (the exact state a pre-flip server
// produces post-migration) must fail loud with a specific, actionable
// message on both the own-workspace read and write paths, and must not
// crash a cross-workspace-pattern caller past its own try/catch.
// ============================================================================

test("AC14: dual-presence (flat + lane handoff.md, distinct + one missing last_updated) throws HANDOFF_LAYOUT_CONFLICT on own-workspace read AND write, with both absolute paths, both last_updated values (or 'unparseable/missing'), and the repair steps — neither file is modified", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkFlatFixture("e123b9-ac14-"); // flat handoff.md, last_updated: 2026-01-01T00:00:00.000Z
  const flatPath = path.join(ws, ".current", "handoff.md");
  const lanePath = resolveCurrentLanePaths(ws).handoffPath;
  fs.mkdirSync(path.dirname(lanePath), { recursive: true });
  // The lane side deliberately has NO last_updated key at all — exercises
  // the "unparseable/missing" literal, per the spec's own worked example for
  // the dual-presence conflict (AC14).
  fs.writeFileSync(
    lanePath,
    `---\nschema_version: 15\nactive_feature: "e123b9-lane-side"\nstatus: "In_Progress"\n---\n## Completed\n- (none)\n\n## Pending & Handoff Notes\n- (none)\n`,
  );

  const flatBefore = fs.readFileSync(flatPath);
  const laneBefore = fs.readFileSync(lanePath);
  const absFlat = path.resolve(flatPath);
  const absLane = path.resolve(lanePath);

  function assertConflictMessage(message, why) {
    assert.match(message, /HANDOFF_LAYOUT_CONFLICT/, `${why}: must carry the HANDOFF_LAYOUT_CONFLICT prefix`);
    assert.ok(message.includes(absFlat), `${why}: must name the flat absolute path`);
    assert.ok(message.includes(absLane), `${why}: must name the lane absolute path`);
    assert.ok(message.includes("2026-01-01T00:00:00.000Z"), `${why}: must name the flat side's real last_updated`);
    assert.ok(message.includes("unparseable/missing"), `${why}: must name the lane side's missing last_updated as the literal`);
    assert.match(message, /restart/i, `${why}: must include the restart-every-server repair step`);
    assert.match(message, /delete|move/i, `${why}: must include the delete-or-move repair step`);
    assert.match(message, /retry/i, `${why}: must include the retry repair step`);
  }

  // (a) own-workspace READ.
  resetSession(ws);
  assert.throws(
    () => readHandoffState(ws),
    (err) => {
      assertConflictMessage(err.message, "own-workspace read");
      return true;
    },
    "readHandoffState must throw HANDOFF_LAYOUT_CONFLICT before any move",
  );

  // (b) own-workspace WRITE — must reject with the same conflict, before any move.
  resetSession(ws);
  await assert.rejects(
    () =>
      writeHandoffState({
        workspacePath: ws,
        activeFeature: "should-never-land",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: [],
        lastAgent: "pm",
      }),
    (err) => {
      assertConflictMessage(err.message, "own-workspace write");
      return true;
    },
    "writeHandoffState must reject with HANDOFF_LAYOUT_CONFLICT before any move",
  );

  // Neither file may have been touched by either attempt.
  assert.deepEqual(fs.readFileSync(flatPath), flatBefore, "flat handoff.md must be byte-unchanged after both refused attempts");
  assert.deepEqual(fs.readFileSync(lanePath), laneBefore, "lane handoff.md must be byte-unchanged after both refused attempts");

  // (c) cross-workspace-pattern read (parseHandoff, wrapped in try/catch —
  // the exact posture tools/feature-rollup.ts already has): must not
  // silently degrade to one side's content, and the caught message must
  // still name the conflict, not read as a generic parse failure.
  let caught = null;
  try {
    parseHandoff(ws);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "parseHandoff must also throw on dual presence — the caller's own try/catch is what turns this into readable:false");
  assertConflictMessage(caught.message, "cross-workspace-pattern parseHandoff (caught)");
});

// ============================================================================
// AC8 — reversibility on a test-BUILT flat layout (F2-NEW-1, human decision
// A, 2026-09-24: never the primary checkout's live .current/ — see
// mkFullFlatFixture's own comment), both rounds, entirely inside
// os.tmpdir() scratch (never the repo root, never primary itself).
// ============================================================================

test("AC8 Round 1: migrateFlatToLane then migrateLaneToFlat on a test-built flat fixture leaves every file byte-identical (per-file SHA-256), modulo only a not-previously-absent lock/tmp artifact", async () => {
  const scratchRoot = mkFullFlatFixture("e123b9-ac8-r1-");
  const scratchCurrent = path.join(scratchRoot, ".current");

  const before = hashTree(scratchCurrent);
  const fileCount = before.size;
  assert.ok(fileCount > 0, "sanity: the fixture's .current/ must be non-empty");

  const flatResult = await migrateFlatToLane(scratchRoot);
  assert.ok(!flatResult.alreadyMigrated, "sanity: this is a genuine first migration, not a race-loser no-op");
  const lane = flatResult.lane;
  assert.equal(lane, "_primary", "sanity: a scratch fixture carries no .git of its own, so resolveCurrentLane falls back to PRIMARY_LANE");

  const reverseResult = await migrateLaneToFlat(scratchRoot, lane);
  assert.ok(reverseResult.moved.length > 0, "sanity: the reverse leg must have moved something");

  const after = hashTree(scratchCurrent);
  const diffs = diffTrees(before, after);

  // Evidence, printed for the QA report transcript (captured via
  // `node --test` stdout) — file count + a hash excerpt.
  console.log(`[AC8 Round 1] file count (pre-migration snapshot): ${fileCount}`);
  console.log(`[AC8 Round 1] hash-table excerpt (first 5, path -> sha256):`);
  let shown = 0;
  for (const [relPath, hash] of before) {
    if (shown++ >= 5) break;
    console.log(`  ${relPath} -> ${hash}`);
  }
  console.log(`[AC8 Round 1] diff count after full round trip: ${diffs.length}`);

  assert.deepEqual(diffs, [], `Round 1 must be byte-identical modulo the one named tolerance — diffs: ${JSON.stringify(diffs, null, 2)}`);
});

test("AC8 Round 2: the WIRED trigger (readHandoffState, via a standalone node process against the built dist/) migrates a test-built flat fixture, lands every LANE_FILES entry under .current/_primary/, deep-equals the pre-migration flat parse, then reverses byte-identically", async () => {
  assert.ok(fs.existsSync(ROUND2_SCRIPT), `sanity: the standalone round-2 script must exist at ${ROUND2_SCRIPT}`);

  const scratchRoot = mkFullFlatFixture("e123b9-ac8-r2-");
  const scratchCurrent = path.join(scratchRoot, ".current");

  const before = hashTree(scratchCurrent);
  const fileCount = before.size;
  const rawHandoffBefore = fs.readFileSync(path.join(scratchCurrent, "handoff.md"), "utf-8");

  // Parse the PRE-MIGRATION flat handoff.md with the SAME parser
  // (parseHandoff), in THIS process, against the fixture's own
  // .current/handoff.md, BEFORE the standalone script ever touches it —
  // this is the "content survived the move" baseline the spec calls for
  // (module load order doesn't matter for a deep-equal comparison).
  const preCopyState = parseHandoff(scratchRoot);
  assert.ok(preCopyState && preCopyState.active_feature, "sanity: the fixture's flat handoff.md must parse");

  // The standalone node process: imports the BUILT dist/tools/handoff-parse.js
  // and calls readHandoffState(scratchRoot) — the actual own-workspace entry
  // point the migration is wired into (AC3).
  const child = spawnSync(process.execPath, [ROUND2_SCRIPT, scratchRoot], { encoding: "utf-8" });
  assert.equal(child.status, 0, `round-2 standalone script must exit 0; stderr: ${child.stderr}`);
  const wiredState = JSON.parse(child.stdout);

  // `exists` is a readHandoffState()-only envelope field (parseHandoff
  // returns the bare HandoffState) and `schema_version` may independently
  // climb via readHandoffState's own fire-and-forget heal write — neither
  // is part of what this comparison means by "content survived the move".
  const { exists: _wiredExists, schema_version: _wiredSv, ...wiredComparable } = wiredState;
  const { schema_version: _preSv, ...preCopyComparable } = preCopyState;
  assert.deepEqual(
    wiredComparable,
    preCopyComparable,
    "the wired-trigger read's returned state must deep-equal the pre-copy flat parse (content survived the move)",
  );

  // Every LANE_FILES entry now lives under .current/_primary/ (the scratch
  // fixture carries no .git of its own, so resolveCurrentLane falls back to
  // PRIMARY_LANE).
  for (const entry of LANE_FILES) {
    const flatSpot = path.join(scratchCurrent, entry.filename);
    const laneSpot = path.join(scratchCurrent, "_primary", entry.filename);
    if (fs.existsSync(laneSpot) || entry.required) {
      assert.ok(!fs.existsSync(flatSpot), `${entry.filename} must no longer exist at the flat root`);
    }
  }
  assert.ok(fs.existsSync(path.join(scratchCurrent, "_primary", "handoff.md")), "handoff.md must exist under .current/_primary/");

  // Reverse leg (direct call is fine per spec) + repeat the per-file
  // SHA-256 comparison against ROUND 2's OWN pre-migration snapshot.
  await migrateLaneToFlat(scratchRoot, "_primary");
  const after = hashTree(scratchCurrent);
  const diffs = diffTrees(before, after).filter((d) => !d.startsWith("CHANGED: handoff.md ("));

  // One narrow tolerance beyond the lock/tmp clause of the reversibility rule, for Round 2
  // (the wired path): readHandoffState's fire-and-forget schema heal is additive only, and
  // a no-op here because the fixture is already at the current schema. Tolerate ONLY a
  // changed `schema_version:` line (a future version bump must not start failing this);
  // every other line, `last_updated` included, must be byte-identical.
  const rawHandoffAfter = fs.readFileSync(path.join(scratchCurrent, "handoff.md"), "utf-8");
  if (rawHandoffBefore !== rawHandoffAfter) {
    const beforeLines = rawHandoffBefore.split("\n");
    const afterLines = rawHandoffAfter.split("\n");
    const lineDiffs = [];
    for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
      if (beforeLines[i] === afterLines[i]) continue;
      const isToleratedSchemaBump = /^schema_version:\s*\d+$/.test(beforeLines[i] ?? "") && /^schema_version:\s*15$/.test(afterLines[i] ?? "");
      if (!isToleratedSchemaBump) lineDiffs.push(`line ${i}: ${JSON.stringify(beforeLines[i])} -> ${JSON.stringify(afterLines[i])}`);
    }
    assert.deepEqual(lineDiffs, [], `handoff.md must differ ONLY by the schema_version heal landing at CURRENT (v15) — unexpected line diffs: ${JSON.stringify(lineDiffs, null, 2)}`);
  }

  console.log(`[AC8 Round 2] file count (pre-migration snapshot): ${fileCount}`);
  console.log(`[AC8 Round 2] hash-table excerpt (first 5, path -> sha256):`);
  let shown = 0;
  for (const [relPath, hash] of before) {
    if (shown++ >= 5) break;
    console.log(`  ${relPath} -> ${hash}`);
  }
  console.log(`[AC8 Round 2] wired-trigger state deep-equal check: PASS (active_feature=${wiredState.active_feature})`);
  console.log(`[AC8 Round 2] diff count after reverse leg: ${diffs.length}`);

  assert.deepEqual(diffs, [], `Round 2's reverse leg must be byte-identical modulo the one named tolerance — diffs: ${JSON.stringify(diffs, null, 2)}`);
});

// ============================================================================
// Interrupted-migration-then-read/write durability (T-E123B9-08, AC21).
// specs/e123b9-lane-flip.md "## Amendment 2026-09-24", AC21 (covers AC16-20).
// ============================================================================

// --- shared fixture / verification helpers (AC21(a)) -----------------------

const AC21_ACTIVE_FEATURE = "e123b9-ac21-fixture";
const AC21_LAST_UPDATED = "2026-01-01T00:00:00.000Z";
const AC21_SIDECAR_FILES = ["telemetry.jsonl", "metrics.jsonl", "usage.jsonl", "dispatch.jsonl"];

function ac21HandoffContent() {
  return `---\nschema_version: 15\nactive_feature: "${AC21_ACTIVE_FEATURE}"\nstatus: "In_Progress"\nlast_updated: "${AC21_LAST_UPDATED}"\nlast_agent: "pm"\nqa_round: 0\nreview_round: 0\nvisual_round: 0\n---\n## Completed\n- (none)\n\n## Pending & Handoff Notes\n- (none)\n`;
}

function ac21LinesToBuf(lines) {
  return Buffer.from(lines.map((l) => `${l}\n`).join(""), "utf-8");
}

function ac21BufToLines(buf) {
  const s = buf.toString("utf-8");
  return s.length === 0 ? [] : s.split("\n").filter((l) => l.length > 0);
}

// placement: "absent" | {at:"flat", lines} | {at:"lane", lines} |
//   {at:"both", flatLines, laneLines}   (independent both-present -> real merge)
//   {at:"prefix", flatLines, extraLaneLines}  (lane == flat ++ extra: mid-merge,
//                                               flat not yet unlinked -> "drop")
function ac21PlaceFile(flatDir, laneDir, filename, placement) {
  if (placement === "absent" || placement == null) return;
  if (placement.at === "flat") {
    fs.writeFileSync(path.join(flatDir, filename), ac21LinesToBuf(placement.lines));
  } else if (placement.at === "lane") {
    fs.mkdirSync(laneDir, { recursive: true });
    fs.writeFileSync(path.join(laneDir, filename), ac21LinesToBuf(placement.lines));
  } else if (placement.at === "both") {
    fs.writeFileSync(path.join(flatDir, filename), ac21LinesToBuf(placement.flatLines));
    fs.mkdirSync(laneDir, { recursive: true });
    fs.writeFileSync(path.join(laneDir, filename), ac21LinesToBuf(placement.laneLines));
  } else if (placement.at === "prefix") {
    fs.writeFileSync(path.join(flatDir, filename), ac21LinesToBuf(placement.flatLines));
    fs.mkdirSync(laneDir, { recursive: true });
    fs.writeFileSync(
      path.join(laneDir, filename),
      ac21LinesToBuf([...placement.flatLines, ...placement.extraLaneLines]),
    );
  } else {
    throw new Error(`ac21PlaceFile: unknown placement.at ${JSON.stringify(placement)}`);
  }
}

// The correct FINAL line set for a sidecar given its starting placement,
// per the migration's resume rule (spec AC15/AC18): flat lines first, then the lane's own
// PRE-EXISTING lines; a lane file that already starts with the flat bytes
// (the "prefix"/mid-merge case) is left untouched (drop), never re-merged.
function ac21ExpectedFinalLines(placement) {
  if (placement === "absent" || placement == null) return null; // never existed anywhere
  if (placement.at === "flat") return placement.lines;
  if (placement.at === "lane") return placement.lines;
  if (placement.at === "both") return [...placement.flatLines, ...placement.laneLines];
  if (placement.at === "prefix") return [...placement.flatLines, ...placement.extraLaneLines];
  throw new Error(`ac21ExpectedFinalLines: unknown placement.at ${JSON.stringify(placement)}`);
}

// Builds a fresh fixture workspace. `handoff` is "flat" | "lane" | "absent".
// `sidecars` maps filename -> placement (AC21_SIDECAR_FILES keys omitted
// default to "absent"). Returns {ws, lane, laneDir, flatDir}.
function ac21BuildFixture(prefix, { handoff, sidecars = {} }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const flatDir = path.join(ws, ".current");
  fs.mkdirSync(flatDir, { recursive: true });
  const lane = resolveCurrentLane(ws); // no .git in a fresh tmpdir -> PRIMARY_LANE ("_primary")
  const laneDir = resolveLaneDir(ws, lane);
  if (handoff === "flat") {
    fs.writeFileSync(path.join(flatDir, "handoff.md"), ac21HandoffContent());
  } else if (handoff === "lane") {
    fs.mkdirSync(laneDir, { recursive: true });
    fs.writeFileSync(path.join(laneDir, "handoff.md"), ac21HandoffContent());
  } else if (handoff !== "absent") {
    throw new Error(`ac21BuildFixture: unknown handoff ${JSON.stringify(handoff)}`);
  }
  for (const filename of AC21_SIDECAR_FILES) {
    ac21PlaceFile(flatDir, laneDir, filename, sidecars[filename] ?? "absent");
  }
  return { ws, lane, laneDir, flatDir };
}

// One canonical parsed reference state (fields only — not JSON-view shaped)
// to deep-equal the settled fixtures against. schema_version 15 is CURRENT
// (matching every other fixture in this file), so no schema-migration heal
// write ever fires here and last_updated after a plain READ is untouched.
let _ac21Gold;
function ac21Gold() {
  if (_ac21Gold) return _ac21Gold;
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e123b9-ac21-gold-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), ac21HandoffContent());
  _ac21Gold = parseHandoff(ws);
  fs.rmSync(ws, { recursive: true, force: true });
  return _ac21Gold;
}

function ac21WithoutTimestamp(state) {
  const { last_updated, ...rest } = state;
  return rest;
}

// Asserts the fully-settled end state after a migration-completing call:
// handoff.md at its lane path only, every sidecar's placement resolved per
// ac21ExpectedFinalLines with no flat leftover, no duplicate/lost lines, and
// (aside from a real write's own new last_updated stamp) state deep-equal to
// gold. `expectWriteStamp: true` excludes last_updated from the deep-equal
// and instead asserts it advanced past AC21_LAST_UPDATED.
function ac21AssertSettled({ ws, lane, laneDir, flatDir, sidecars, label, expectWriteStamp = false }) {
  assert.ok(fs.existsSync(path.join(laneDir, "handoff.md")), `${label}: handoff.md must sit at its lane path`);
  assert.ok(
    !fs.existsSync(path.join(flatDir, "handoff.md")),
    `${label}: no flat handoff.md may remain`,
  );
  for (const filename of AC21_SIDECAR_FILES) {
    const placement = sidecars[filename] ?? "absent";
    const expected = ac21ExpectedFinalLines(placement);
    const flatPath = path.join(flatDir, filename);
    const lanePath = path.join(laneDir, filename);
    assert.ok(!fs.existsSync(flatPath), `${label}: no flat ${filename} may remain`);
    if (expected === null) {
      assert.ok(!fs.existsSync(lanePath), `${label}: ${filename} must not have been conjured from nothing`);
      continue;
    }
    assert.ok(fs.existsSync(lanePath), `${label}: ${filename} must exist at its lane path`);
    const actualLines = ac21BufToLines(fs.readFileSync(lanePath));
    assert.deepEqual(
      actualLines,
      expected,
      `${label}: ${filename} lines must match exactly (no duplicates or losses) — got ${JSON.stringify(actualLines)}, expected ${JSON.stringify(expected)}`,
    );
    assert.equal(
      new Set(actualLines).size,
      actualLines.length,
      `${label}: ${filename} must contain no duplicate lines — got ${JSON.stringify(actualLines)}`,
    );
  }
  const state = parseHandoff(ws);
  assert.ok(state, `${label}: parseHandoff must return state after settling`);
  const gold = ac21Gold();
  if (expectWriteStamp) {
    assert.deepEqual(
      ac21WithoutTimestamp(state),
      ac21WithoutTimestamp(gold),
      `${label}: state (excluding the write's own new last_updated stamp) must deep-equal the original`,
    );
    assert.ok(
      Date.parse(state.last_updated) > Date.parse(AC21_LAST_UPDATED),
      `${label}: a real write must advance last_updated past the fixture's original stamp`,
    );
  } else {
    assert.deepEqual(state, gold, `${label}: state must deep-equal the original`);
  }
}

// Runs one interrupted-layout scenario against TWO fresh, independent
// fixture copies: one settled via a single readHandoffState, the other via a
// single writeHandoffState. Neither call may throw, and neither may surface
// HANDOFF_LAYOUT_CONFLICT (verified via a generic try/catch around each —
// any throw at all fails these tests, so a HANDOFF_LAYOUT_CONFLICT would be
// caught same as any other unexpected error).
function ac21RunInterruptedCase(name, spec) {
  test(`AC21(a) ${name}: readHandoffState settles the interrupted layout`, () => {
    const fx = ac21BuildFixture(`e123b9-ac21-r-${name}-`, spec);
    setActiveStorage(new FileHandoffStorage());
    resetSession(fx.ws);
    readHandoffState(fx.ws); // no markStateRead — first-ever touch of this fixture
    ac21AssertSettled({ ...fx, sidecars: spec.sidecars ?? {}, label: `read/${name}` });
  });

  test(`AC21(a) ${name}: writeHandoffState (fresh copy) settles the interrupted layout`, async () => {
    const fx = ac21BuildFixture(`e123b9-ac21-w-${name}-`, spec);
    setActiveStorage(new FileHandoffStorage());
    resetSession(fx.ws); // mirrors AC12's own convention: no prior read, verifyFreshness no-ops
    await writeHandoffState({
      workspacePath: fx.ws,
      activeFeature: AC21_ACTIVE_FEATURE,
      status: "In_Progress",
      completedTasks: [],
      pendingNotes: [],
      lastAgent: "pm",
    });
    ac21AssertSettled({
      ...fx,
      sidecars: spec.sidecars ?? {},
      label: `write/${name}`,
      expectWriteStamp: true,
    });
  });
}

// --- AC21(a) i: new ordering — k sidecars already in the lane dir, the rest
//     plus handoff.md still flat (the migration's write order: sidecars first,
//     required entry last, so a crash always leaves handoff.md at the flat
//     side; AC17). ----
for (const k of [0, 1, 2, 4]) {
  const sidecars = {};
  AC21_SIDECAR_FILES.forEach((filename, i) => {
    sidecars[filename] =
      i < k
        ? { at: "lane", lines: [`moved-${filename}-1`] }
        : { at: "flat", lines: [`flat-${filename}-1`, `flat-${filename}-2`] };
  });
  ac21RunInterruptedCase(`new-ordering k=${k}`, { handoff: "flat", sidecars });
}

// --- AC21(a) ii: legacy ordering — handoff.md already in the lane dir,
//     sidecars still flat, WITHOUT a lane copy of the same sidecar. --------
ac21RunInterruptedCase("legacy-ordering, no lane sidecar copy", {
  handoff: "lane",
  sidecars: {
    "telemetry.jsonl": { at: "flat", lines: ["legacy-telemetry-1", "legacy-telemetry-2"] },
    "usage.jsonl": { at: "flat", lines: ["legacy-usage-1"] },
  },
});

// --- AC21(a) ii: legacy ordering — WITH a lane copy of the same sidecar to
//     merge into (e.g. the usage hook appended to the lane path after an
//     interrupted prior migration left handoff.md there but usage.jsonl
//     flat) — must go through a REAL merge (flat lines first), not a refusal
//     and not a silent pick-one-side. ---------------------------------------
ac21RunInterruptedCase("legacy-ordering, WITH lane sidecar to merge", {
  handoff: "lane",
  sidecars: {
    "usage.jsonl": {
      at: "both",
      flatLines: ["merge-flat-usage-1", "merge-flat-usage-2"],
      laneLines: ["merge-lane-usage-1"],
    },
    "dispatch.jsonl": { at: "flat", lines: ["legacy-dispatch-1"] },
  },
});

// --- AC21(a) iii: mid-merge — the lane sidecar already STARTS WITH the flat
//     bytes (a merge already published, tmp renamed into place) but the
//     flat source has not been unlinked yet. Resume must "drop" (remove the
//     leftover flat file, leave the lane file's bytes untouched) — NOT
//     re-merge and duplicate the flat lines a second time. ------------------
ac21RunInterruptedCase("mid-merge: lane sidecar already starts with flat bytes", {
  handoff: "flat",
  sidecars: {
    "metrics.jsonl": {
      at: "prefix",
      flatLines: ["midmerge-flat-metrics-1", "midmerge-flat-metrics-2"],
      extraLaneLines: ["midmerge-lane-metrics-1"],
    },
  },
});

// AC21(b): a real process death mid-migration leaves the per-lane lock stale. The next read
// skips it (a single non-blocking lock attempt) and returns correct state without throwing
// but leaves the layout split; only the next write, whose withFileLock checks staleness,
// clears it and finishes.

test(
  "AC21(b) [J2-NEW-12]: a real crashed child process leaves a stale per-lane lock — the next read returns correct state but does not complete the migration; the next write clears the stale lock and completes it",
  { timeout: 20_000 },
  async () => {
    // handoff.md flat, one sidecar flat (migration order, AC17: telemetry renames FIRST,
    // handoff.md LAST) — CRASH_AFTER_RENAME=1 kills the child right after the
    // sidecar's rename completes, before handoff.md's rename ever runs.
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e123b9-ac21-crash-"));
    const flatDir = path.join(ws, ".current");
    fs.mkdirSync(flatDir, { recursive: true });
    fs.writeFileSync(path.join(flatDir, "handoff.md"), ac21HandoffContent());
    fs.writeFileSync(path.join(flatDir, "telemetry.jsonl"), ac21LinesToBuf(["crash-telemetry-1"]));

    const lane = resolveCurrentLane(ws);
    const laneDir = resolveLaneDir(ws, lane);
    const lockPath = resolveLaneLockPath(ws, lane);

    // --- crash the child process ------------------------------------------
    const registerImport =
      "data:text/javascript," +
      encodeURIComponent(
        `import { register } from "node:module"; import { pathToFileURL } from "node:url"; ` +
          `register(${JSON.stringify(pathToFileURL(CRASH_LOADER).href)}, pathToFileURL("${PROJECT_ROOT}/"));`,
      );
    const child = spawnSync(
      process.execPath,
      ["--import", registerImport, CRASH_WORKER, ws],
      { encoding: "utf-8", env: { ...process.env, CRASH_AFTER_RENAME: "1" } },
    );

    assert.equal(child.status, 137, `crash worker must exit(137); stdout=${child.stdout} stderr=${child.stderr}`);
    assert.ok(
      !/CRASH-WORKER-DID-NOT-CRASH/.test(child.stdout),
      "the worker must not have reached its own end-of-script marker — the injected crash must have fired",
    );

    // --- post-crash disk state: a genuinely split, mid-migration layout ---
    assert.ok(fs.existsSync(lockPath), "the crashed process must have left its lock file behind, stale");
    const staleLock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    assert.equal(typeof staleLock.pid, "number", "the stale lock must carry the dead child's PID");
    assert.throws(
      () => process.kill(staleLock.pid, 0),
      /ESRCH/,
      "the lock's PID must actually be dead (ESRCH) — this must be a REAL process death, not a simulated one",
    );
    assert.ok(
      fs.existsSync(path.join(laneDir, "telemetry.jsonl")),
      "the sidecar rename (before the crash) must have completed",
    );
    assert.ok(!fs.existsSync(path.join(flatDir, "telemetry.jsonl")), "the flat sidecar must be gone");
    assert.ok(
      fs.existsSync(path.join(flatDir, "handoff.md")),
      "handoff.md (AC17: moved last) must still be at the flat path — the crash landed before its rename",
    );
    assert.ok(!fs.existsSync(path.join(laneDir, "handoff.md")), "handoff.md must not yet exist at the lane path");

    // --- next READ: correct state, no throw, migration NOT completed ------
    setActiveStorage(new FileHandoffStorage());
    resetSession(ws);
    let readJson;
    assert.doesNotThrow(() => {
      readJson = JSON.parse(readHandoffState(ws));
    }, "the next read must not throw, despite the stale lock");
    assert.equal(readJson.exists, true, "the next read must still see the (still-flat) handoff.md");
    assert.equal(readJson.active_feature, AC21_ACTIVE_FEATURE, "the next read must return the correct state");
    // The read's own single non-blocking lock attempt gets EEXIST
    // on the still-stale lock and does NOT check staleness — so it skips the
    // migration outright (J2-NEW-12). Assert the documented (not fixed) limitation:
    assert.ok(
      fs.existsSync(path.join(flatDir, "handoff.md")),
      "J2-NEW-12: the read must NOT complete the migration — handoff.md stays flat",
    );
    assert.ok(fs.existsSync(lockPath), "J2-NEW-12: the read must not have touched (let alone cleared) the stale lock");

    // --- next WRITE: clears the stale lock AND completes the migration ----
    resetSession(ws);
    await writeHandoffState({
      workspacePath: ws,
      activeFeature: AC21_ACTIVE_FEATURE,
      status: "In_Progress",
      completedTasks: [],
      pendingNotes: [],
      lastAgent: "pm",
    });
    assert.ok(!fs.existsSync(lockPath), "the write must have cleared the stale lock (guards/file-lock.ts looksStale)");
    ac21AssertSettled({
      ws,
      lane,
      laneDir,
      flatDir,
      sidecars: { "telemetry.jsonl": { at: "flat", lines: ["crash-telemetry-1"] } },
      label: "AC21(b) post-crash write",
      expectWriteStamp: true,
    });
  },
);

// ============================================================================
// AC21(c) — flat sidecars exist, handoff.md exists at NEITHER path. The
// own-workspace read/write must move the sidecars and NOT throw; the read
// returns the normal "no state" result. A direct migrateFlatToLane call
// WITHOUT allowMissingRequired must still refuse (strict mode is unaffected by
// the own-workspace-only tolerance; e123a FL3, AC19).
// ============================================================================

test('AC21(c): flat sidecars with no handoff.md anywhere — readHandoffState moves them without throwing and returns "no state"', () => {
  const fx = ac21BuildFixture("e123b9-ac21-ac19-r-", {
    handoff: "absent",
    sidecars: {
      "telemetry.jsonl": { at: "flat", lines: ["ac19-telemetry-1"] },
      "usage.jsonl": { at: "flat", lines: ["ac19-usage-1", "ac19-usage-2"] },
    },
  });
  setActiveStorage(new FileHandoffStorage());
  resetSession(fx.ws);
  let json;
  assert.doesNotThrow(() => {
    json = JSON.parse(readHandoffState(fx.ws));
  }, "AC19: a flat-sidecars-only, no-handoff-anywhere workspace must not throw on read");
  assert.equal(json.exists, false, 'AC19: the read must return the normal "no state" result');

  assert.ok(!fs.existsSync(path.join(fx.flatDir, "telemetry.jsonl")), "AC19: flat telemetry.jsonl must have moved");
  assert.ok(!fs.existsSync(path.join(fx.flatDir, "usage.jsonl")), "AC19: flat usage.jsonl must have moved");
  assert.deepEqual(
    ac21BufToLines(fs.readFileSync(path.join(fx.laneDir, "telemetry.jsonl"))),
    ["ac19-telemetry-1"],
    "AC19: telemetry.jsonl content must survive the move exactly",
  );
  assert.deepEqual(
    ac21BufToLines(fs.readFileSync(path.join(fx.laneDir, "usage.jsonl"))),
    ["ac19-usage-1", "ac19-usage-2"],
    "AC19: usage.jsonl content must survive the move exactly",
  );
  assert.ok(!fs.existsSync(path.join(fx.laneDir, "handoff.md")), "AC19: no handoff.md may be conjured by a read");
});

test("AC21(c): flat sidecars with no handoff.md anywhere — writeHandoffState (fresh copy) moves them without throwing", async () => {
  const fx = ac21BuildFixture("e123b9-ac21-ac19-w-", {
    handoff: "absent",
    sidecars: { "dispatch.jsonl": { at: "flat", lines: ["ac19-dispatch-1"] } },
  });
  setActiveStorage(new FileHandoffStorage());
  resetSession(fx.ws);
  await assert.doesNotReject(
    () =>
      writeHandoffState({
        workspacePath: fx.ws,
        activeFeature: "ac19-write-created",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: [],
        lastAgent: "pm",
      }),
    "AC19: a write against a flat-sidecars-only, no-handoff-anywhere workspace must not throw",
  );
  assert.ok(!fs.existsSync(path.join(fx.flatDir, "dispatch.jsonl")), "AC19: flat dispatch.jsonl must have moved");
  assert.deepEqual(
    ac21BufToLines(fs.readFileSync(path.join(fx.laneDir, "dispatch.jsonl"))),
    ["ac19-dispatch-1"],
    "AC19: dispatch.jsonl content must survive the move exactly",
  );
  // The write itself creates handoff.md (that is what a write does) — this
  // is expected and is NOT part of the "no state" claim (AC19), which is a
  // read-only-result assertion.
  assert.ok(fs.existsSync(path.join(fx.laneDir, "handoff.md")), "the write's own handoff.md must land at the lane path");
});

test("AC21(c) [e123a FL3]: a DIRECT migrateFlatToLane call (no allowMissingRequired) still refuses when handoff.md is absent from both sides, touching nothing", async () => {
  const fx = ac21BuildFixture("e123b9-ac21-fl3-", {
    handoff: "absent",
    sidecars: { "telemetry.jsonl": { at: "flat", lines: ["fl3-telemetry-1"] } },
  });
  await assert.rejects(
    () => migrateFlatToLane(fx.ws),
    /required lane file .*handoff\.md.* not found/,
    "e123a FL3: the direct runner's default (allowMissingRequired unset) must still refuse a missing-everywhere required entry",
  );
  assert.ok(fs.existsSync(path.join(fx.flatDir, "telemetry.jsonl")), "a refused direct call must move nothing");
  assert.ok(!fs.existsSync(fx.laneDir), "a refused direct call must not create the lane directory (or must remove it if created only to host the lock)");
});

// ============================================================================
// AC21(d) — AC20 (J2-NEW-7): readHandoffState / parseHandoff on a
// workspace_path with a FILE as a path component degrades to the pre-ticket
// "no prior state" result (ENOTDIR treated exactly like ENOENT) instead of
// rethrowing.
// ============================================================================

test("AC21(d) [AC20]: a workspace_path with a file as a path component returns the no-state/null result, not a throw", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "e123b9-ac20-"));
  const fileNotDir = path.join(parent, "not-a-directory");
  fs.writeFileSync(fileNotDir, "this is a file, not a directory\n");
  // A "workspace" whose root itself is a file, plus one nested one level
  // deeper — both put a FILE where a directory component is expected while
  // resolving `<workspacePath>/.current/<lane>/handoff.md`.
  const bogusWorkspaces = [fileNotDir, path.join(fileNotDir, "nested-workspace")];

  for (const ws of bogusWorkspaces) {
    setActiveStorage(new FileHandoffStorage());
    resetSession(ws);
    let json;
    assert.doesNotThrow(() => {
      json = JSON.parse(readHandoffState(ws));
    }, `AC20: readHandoffState(${ws}) must not throw on ENOTDIR`);
    assert.equal(json.exists, false, `AC20: readHandoffState(${ws}) must return the no-prior-state result`);

    let parsed;
    assert.doesNotThrow(() => {
      parsed = parseHandoff(ws);
    }, `AC20: parseHandoff(${ws}) must not throw on ENOTDIR`);
    assert.equal(parsed, null, `AC20: parseHandoff(${ws}) must return null`);
  }

  // Sanity: the file itself must be untouched by either call (ENOTDIR is
  // read-only degrade, never a repair attempt).
  assert.equal(fs.readFileSync(fileNotDir, "utf-8"), "this is a file, not a directory\n");
});

// AC21(e): the existing AC8 Round 1 / AC8 Round 2 tests above are unchanged
// by this addendum and are asserted green by the same `npm test` run this
// file's own new tests are (the full-suite gate, AC11, with no expected-red).

// Coded by @qa-engineer
// Tests for tools/lane-migrate.ts, which moves a workspace's per-lane files between the flat `.current/` layout and
// the per-lane `.current/<lane>/` layout in both directions (specs/e123a-lane-layout-migration.md AC6-AC10, AC15).
// Labels: FL (flat to lane), CONFLICT, REV (lane to flat), RT1 (round trip), CALLERS1, COUNT (moved + skipped count).
// Rationale: specs/e260g-comment-rationale.md (test/lane-migrate.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { migrateFlatToLane, migrateLaneToFlat, hasFlatLaneFiles } from "../dist/tools/lane-migrate.js";
import { LANE_FILES, HANDOFF_LOCK_FILENAME } from "../dist/tools/lane-paths.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// A minimal, real-shaped handoff.md whose active_feature resolves (via
// resolveLaneName) to lane "e163" — the spec's own AC4 worked example.
function handoffBody(activeFeature) {
  return `---
schema_version: 15
active_feature: "${activeFeature}"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
---
## Completed
- 無

## Pending & Handoff Notes
- 無
`;
}

function mkFlatWorkspace(prefix = "lane-migrate-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function currentDir(ws) {
  return path.join(ws, ".current");
}

function writeFlatFile(ws, filename, content) {
  fs.writeFileSync(path.join(currentDir(ws), filename), content);
}

function laneDir(ws, lane) {
  return path.join(currentDir(ws), lane);
}

// LANE_FILES also carries "tasks" (tasks.md), marked `noFlatCounterpart`: its older location is not flat
// `.current/tasks.md`, so the two runners never move it. OPTIONAL_FILENAMES and ALL_FILENAMES stay derived from the
// full registry; assertions about what the runners MOVE use MOVABLE_FILENAMES, the same filter lane-migrate.ts
// applies.
const OPTIONAL_FILENAMES = LANE_FILES.filter((f) => !f.required).map((f) => f.filename);
const ALL_FILENAMES = LANE_FILES.map((f) => f.filename);
const MOVABLE_FILENAMES = LANE_FILES.filter((f) => !f.noFlatCounterpart).map((f) => f.filename);
const MOVABLE_OPTIONAL_FILENAMES = LANE_FILES.filter((f) => !f.required && !f.noFlatCounterpart).map(
  (f) => f.filename,
);

// Seeds every LANE_FILES entry the two runners move, including pendingTickets and baseSha, but not tasks
// (noFlatCounterpart). The name "Five" is kept so call sites stay unchanged; callers compare against
// MOVABLE_FILENAMES / MOVABLE_OPTIONAL_FILENAMES, both derived from LANE_FILES, so the helper tracks the registry.
function seedAllFiveFiles(ws, activeFeature) {
  writeFlatFile(ws, "handoff.md", handoffBody(activeFeature));
  writeFlatFile(ws, "telemetry.jsonl", '{"ts":"t1","gate":"g","error_code":"e","agent_id":"a","feature":"f"}\n');
  writeFlatFile(ws, "metrics.jsonl", '{"ts":"t1","feature":"f"}\n');
  writeFlatFile(ws, "usage.jsonl", '{"ts":"t1","tokens":100}\n');
  writeFlatFile(ws, "dispatch.jsonl", '{"ts":"t1","feature":"f","agent_id":"a","dispatch_mechanism":"task","dispatch_mechanism_tier":"fable"}\n');
  writeFlatFile(ws, "pending-tickets.md", "# pending tickets\n\nA seeded finding.\n");
  writeFlatFile(ws, "base-sha", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
}

// ============================================================================
// AC6 — flat -> lane
// ============================================================================

test("FL1: full-fixture move — all 5 present files move from flat .current/ into .current/<lane>/, none touched by non-LANE_FILES paths", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  // Non-lane files that must NEVER be touched.
  fs.writeFileSync(path.join(currentDir(ws), ".config.json"), '{"taskPattern":"x"}');
  fs.writeFileSync(path.join(currentDir(ws), "exemptions.json"), "{}");
  fs.writeFileSync(path.join(ws, "tasks.md"), "# tasks\n");
  fs.writeFileSync(path.join(currentDir(ws), "feature-split.md"), "# split\n");

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.equal(result.lane, "e163", "lane must be derived via resolveLaneName(active_feature)");
  assert.deepEqual(result.moved.sort(), MOVABLE_FILENAMES.slice().sort(), "all 5 present files must be reported moved");
  assert.deepEqual(result.skipped, [], "nothing skipped when all 5 are present");

  for (const filename of MOVABLE_FILENAMES) {
    assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), filename)), `${filename} must exist under .current/e163/`);
    assert.ok(!fs.existsSync(path.join(currentDir(ws), filename)), `${filename} must no longer exist at the flat path`);
  }

  // Never-touched files verification.
  assert.equal(fs.readFileSync(path.join(currentDir(ws), ".config.json"), "utf-8"), '{"taskPattern":"x"}', ".config.json must be untouched");
  assert.equal(fs.readFileSync(path.join(currentDir(ws), "exemptions.json"), "utf-8"), "{}", "exemptions.json must be untouched");
  assert.equal(fs.readFileSync(path.join(ws, "tasks.md"), "utf-8"), "# tasks\n", "tasks.md must be untouched");
  assert.equal(fs.readFileSync(path.join(currentDir(ws), "feature-split.md"), "utf-8"), "# split\n", "feature-split.md must be untouched");
});

test("FL2: handoff-only fixture — the 4 optional sidecars are skipped silently, no error, moved contains only handoff.md", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.deepEqual(result.moved, ["handoff.md"]);
  assert.deepEqual(result.skipped.sort(), MOVABLE_OPTIONAL_FILENAMES.slice().sort(), "all 4 optional entries absent at the source must be reported skipped");
  assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), "handoff.md")));
  for (const filename of MOVABLE_OPTIONAL_FILENAMES) {
    assert.ok(!fs.existsSync(path.join(laneDir(ws, "e163"), filename)), `${filename} must not be materialized when absent at the source`);
  }
});

test("FL3: a missing required entry (handoff.md absent) throws and moves nothing", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "telemetry.jsonl", "{}\n"); // optional file present, but handoff.md missing
  await assert.rejects(() => migrateFlatToLane(ws, { lane: "e163" }), /required lane file handoff\.md not found/);
  // Nothing moved: the optional file must still be at its flat path.
  assert.ok(fs.existsSync(path.join(currentDir(ws), "telemetry.jsonl")), "no move may have occurred when the required entry is absent");
});

test("FL4 (e123b9 J2, spec AC2, Decision 1 — FLIPPED): with no opts.lane, migrateFlatToLane derives the destination from resolveCurrentLane(ws) (PRIMARY_LANE for a workspace with no .git), NOT from the flat handoff's active_feature (the retired D1 fallback)", async () => {
  const ws = mkFlatWorkspace();
  // active_feature names a real ticket-id-shaped token ("e163..."), but the
  // lane must NOT be derived from it: this workspace has no .git, so
  // resolveCurrentLane falls back to PRIMARY_LANE regardless of
  // active_feature's content. (AC2; the old D1 fallback that read the lane
  // from active_feature is retired)
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  const result = await migrateFlatToLane(ws); // no opts.lane — exercise the real default
  assert.equal(result.lane, "_primary", "AC2: default lane is resolveCurrentLane(ws), not resolveLaneName(active_feature)");
  assert.ok(fs.existsSync(path.join(laneDir(ws, "_primary"), "handoff.md")));
  assert.ok(!fs.existsSync(laneDir(ws, "e163")), "the retired active_feature-derived lane must NOT be used");
});

test("FL5 (e123b9 J2, spec AC2 proof — Decision 1): a checked-out feat/<id>-* branch wins over a flat handoff's active_feature naming a DIFFERENT ticket", async () => {
  const ws = mkFlatWorkspace();
  // active_feature names a DIFFERENT ticket than the checked-out branch.
  writeFlatFile(ws, "handoff.md", handoffBody("e999-some-other-stale-ticket"));
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/e163-ci-gate-ordering\n");
  const result = await migrateFlatToLane(ws); // no opts.lane
  assert.equal(result.lane, "e163", "the migrated lane must match the checked-out branch, not the stale active_feature");
  assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), "handoff.md")));
  assert.ok(!fs.existsSync(laneDir(ws, "e999")), "the stale active_feature-derived lane must never be created");
});

// ============================================================================
// AC7 — conflict: refuse, never clobber.
// ============================================================================

test("CONFLICT1: a pre-existing DIFFERING .current/<lane>/handoff.md throws, and BOTH the source and destination stay byte-unchanged", async () => {
  const ws = mkFlatWorkspace();
  const flatBody = handoffBody("e163-ci-gate-ordering");
  writeFlatFile(ws, "handoff.md", flatBody);
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  const conflictingBody = handoffBody("e163-some-other-stale-run");
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), conflictingBody);

  await assert.rejects(() => migrateFlatToLane(ws, { lane: "e163" }), /already exists with different.*content|refusing to clobber/);

  assert.equal(fs.readFileSync(path.join(currentDir(ws), "handoff.md"), "utf-8"), flatBody, "the flat SOURCE must be byte-unchanged after a refused move");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), "utf-8"), conflictingBody, "the conflicting DESTINATION must be byte-unchanged after a refused move — no silent clobber");
});

test("CONFLICT2 (documented safety posture, not itself an AC): an IDENTICAL-content destination is treated as a resumed move — the redundant source is dropped, no throw", async () => {
  const ws = mkFlatWorkspace();
  const body = handoffBody("e163-ci-gate-ordering");
  writeFlatFile(ws, "handoff.md", body);
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), body); // byte-identical to the source

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.deepEqual(result.moved, ["handoff.md"], "an identical-content destination still counts as moved (idempotent resume)");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), "utf-8"), body, "the destination content is unchanged (still byte-identical)");
  assert.ok(!fs.existsSync(path.join(currentDir(ws), "handoff.md")), "the redundant flat source must be removed, not left behind");
});

// ============================================================================
// AC8 — lane -> flat (exact reverse).
// ============================================================================

test("REV1: full-fixture reverse — all 5 lane files move back to flat, then the now-empty lane dir is removed", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  const flatToLane = await migrateFlatToLane(ws, { lane: "e163" });
  assert.equal(flatToLane.lane, "e163");

  const result = await migrateLaneToFlat(ws, "e163");
  assert.deepEqual(result.moved.sort(), MOVABLE_FILENAMES.slice().sort());
  assert.deepEqual(result.skipped, []);
  for (const filename of MOVABLE_FILENAMES) {
    assert.ok(fs.existsSync(path.join(currentDir(ws), filename)), `${filename} must be back at the flat path`);
  }
  assert.ok(!fs.existsSync(laneDir(ws, "e163")), "the now-empty lane directory must be removed");
});

test("REV2: reverse of a handoff-only lane skips the 4 optional entries and still removes the lane dir", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  await migrateFlatToLane(ws, { lane: "e163" });

  const result = await migrateLaneToFlat(ws, "e163");
  assert.deepEqual(result.moved, ["handoff.md"]);
  assert.deepEqual(result.skipped.sort(), MOVABLE_OPTIONAL_FILENAMES.slice().sort());
  assert.ok(!fs.existsSync(laneDir(ws, "e163")));
});

test("REV3: a lane directory holding a non-LANE_FILES entry refuses (throws), never deletes the unknown content", async () => {
  const ws = mkFlatWorkspace();
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), handoffBody("e163-x"));
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "some-unknown-file.txt"), "unexpected");

  await assert.rejects(() => migrateLaneToFlat(ws, "e163"), /non-lane entries|holds non-lane/);
  assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), "some-unknown-file.txt")), "the unknown file must never be deleted");
  assert.ok(fs.existsSync(laneDir(ws, "e163")), "the lane directory itself must not be removed on a refused reverse");
});

test("REV4: migrateLaneToFlat validates the lane argument and refuses path traversal (../, absolute-looking segments)", async () => {
  const ws = mkFlatWorkspace();
  for (const hostile of ["../escape", "..", "a/b", "", ".hidden"]) {
    await assert.rejects(() => migrateLaneToFlat(ws, hostile), /invalid lane name|lane directory .* not found/, `lane=${JSON.stringify(hostile)} must be refused`);
  }
});

// ============================================================================
// AC5 — migrateLaneToFlat tolerates and removes two kinds of lane-dir debris instead of refusing the run: a
// leftover HANDOFF_LOCK_FILENAME and a stale atomic-write temp file (`<LANE_FILES filename>.<pid>.<epoch ms>.tmp`,
// left by tools/handoff-write.ts if a writer crashes mid-publish). Any other non-LANE_FILES entry is still foreign
// and refuses (REV3).
// ============================================================================

test("AC5-DEBRIS1 (e123b9 J2, spec AC5 — the lock's OWN path is now this same filename): a leftover STALE HANDOFF_LOCK_FILENAME in the lane dir is cleared by withFileLock's own stale-lock detection and the move succeeds, removing the (now-empty) lane dir", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  // Simulate a crashed writer that acquired the lock and died before
  // releasing it: a well-formed but old/dead-PID payload, so
  // guards/file-lock.ts's looksStale() recognizes it as stale and clears it
  // before migrateLaneToFlat's own lock acquisition — AC5 makes the lock live
  // at EXACTLY this path (.current/<lane>/.handoff.lock), so a leftover lock
  // is no longer just inert move-planning debris, it is the real lock file.
  fs.writeFileSync(
    path.join(laneDir(ws, "e163"), HANDOFF_LOCK_FILENAME),
    JSON.stringify({ pid: 999999999, acquiredAt: Date.now() - 60_000 }),
  );

  const result = await migrateLaneToFlat(ws, "e163");
  assert.deepEqual(result.moved.sort(), MOVABLE_FILENAMES.slice().sort(), "the 5 real lane files must still move normally");
  assert.ok(!fs.existsSync(laneDir(ws, "e163")), "the lane dir must be removed — the leftover lock is debris, not foreign content blocking cleanup");
});

test("AC5-DEBRIS2: a stale atomic-write temp file (`<lane filename>.<pid>.<ms>.tmp`) in the lane dir is tolerated — the move succeeds and the temp file is removed with the lane dir", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  const staleTmp = `handoff.md.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(path.join(laneDir(ws, "e163"), staleTmp), "half-written garbage");

  const result = await migrateLaneToFlat(ws, "e163");
  assert.deepEqual(result.moved.sort(), MOVABLE_FILENAMES.slice().sort(), "the 5 real lane files must still move normally");
  assert.ok(!fs.existsSync(laneDir(ws, "e163")), "the lane dir must be removed — the stale atomic tmp file is debris, not foreign content blocking cleanup");
});

test("AC5-DEBRIS3: any OTHER non-LANE_FILES entry (not the lock, not an atomic-tmp shape) still refuses before any move — debris tolerance is narrow, not a general amnesty", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  // Neither HANDOFF_LOCK_FILENAME nor the `<lane file>.<pid>.<ms>.tmp` shape —
  // an ordinary stray file must still be treated as foreign.
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "some-unrelated-debris.log"), "not tolerable");

  await assert.rejects(() => migrateLaneToFlat(ws, "e163"), /non-lane entries|holds non-lane/);
  assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), "some-unrelated-debris.log")), "the untolerated file must never be deleted");
  for (const filename of MOVABLE_FILENAMES) {
    assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), filename)), `${filename} must not have moved — a refused run touches nothing`);
  }
});

test("AC5-DEBRIS4 (e123b9 J2, spec AC5 — the debris-tolerance pre-flight now runs INSIDE the per-lane lock, so a directory squatting on the lock's own path fails at lock ACQUISITION, not the later foreign-content check): a DIRECTORY named exactly HANDOFF_LOCK_FILENAME refuses (via the lock-acquisition timeout) and touches nothing", { timeout: 15_000 }, async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  fs.mkdirSync(path.join(laneDir(ws, "e163"), HANDOFF_LOCK_FILENAME));

  // AC5-DEBRIS3 above proves the foreign-content check; this fixture differs: the debris sits at the exact path
  // withFileLock must open() to take the per-lane lock (.current/<lane>/.handoff.lock). openSync "wx" fails EEXIST
  // on a directory, looksStale() falls back to mtime and a fresh directory is never stale, so withFileLock retries
  // until LOCK_MAX_WAIT_MS and throws its own "could not acquire lock" error. Net effect matches AC5-DEBRIS3:
  // refuses, nothing moved, directory untouched.
  await assert.rejects(
    () => migrateLaneToFlat(ws, "e163"),
    /Could not acquire lock/,
    "a debris-NAMED directory must refuse (via the lock's own acquisition failure), never be silently treated as the tolerable lock file nor allowed to proceed",
  );
  assert.ok(fs.statSync(path.join(laneDir(ws, "e163"), HANDOFF_LOCK_FILENAME)).isDirectory(), "the directory must not be touched by a refused run");
  for (const filename of MOVABLE_FILENAMES) {
    assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), filename)), `${filename} must not have moved — a refused run touches nothing`);
  }
});

// ============================================================================
// AC9 — round trip: flat -> lane -> flat is byte-identical for all 5 files,
// except handoff.md's schema_version MAY already read CURRENT if a read
// during setup triggered the ordinary lazy migration — not the case here,
// since these fixtures are already written at schema_version 15 and neither
// runner ever calls a heal-writing read path (only the read-only parseHandoff).
// ============================================================================

test("RT1: migrateFlatToLane then migrateLaneToFlat leaves all 5 files byte-identical to their pre-migration content", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  const before = {};
  for (const filename of MOVABLE_FILENAMES) {
    before[filename] = fs.readFileSync(path.join(currentDir(ws), filename));
  }

  await migrateFlatToLane(ws, { lane: "e163" });
  await migrateLaneToFlat(ws, "e163");

  for (const filename of MOVABLE_FILENAMES) {
    const after = fs.readFileSync(path.join(currentDir(ws), filename));
    assert.ok(after.equals(before[filename]), `${filename} must be byte-identical after a flat->lane->flat round trip`);
  }
});

// ============================================================================
// AC11 (e125b): base-sha is the one lane-dir file migrateLaneToFlatLocked would refuse the lane over if it were not
// registered (it enumerates a lane dir strictly via MOVABLE_LANE_FILES). This test names base-sha explicitly so a
// regression that special-cases it (re-adding noFlatCounterpart, dropping the LANE_PATH_FIELD row) fails
// specifically, not as an unexplained RT1 diff.
// ============================================================================

test("AC11 (e125b): a lane dir containing base-sha reverse-migrates (migrateLaneToFlat) to flat .current/ without refusing, and round-trips forward again unchanged", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  const baseShaBytes = fs.readFileSync(path.join(currentDir(ws), "base-sha"));

  await migrateFlatToLane(ws, { lane: "e163" });
  assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), "base-sha")), "base-sha must have moved into the lane dir on the forward leg");
  assert.ok(
    fs.readFileSync(path.join(laneDir(ws, "e163"), "base-sha")).equals(baseShaBytes),
    "base-sha must be byte-identical after the forward move",
  );

  const reverse = await migrateLaneToFlat(ws, "e163");
  assert.ok(reverse.moved.includes("base-sha"), "migrateLaneToFlat must not refuse the lane over base-sha — it must report it moved like any other registered LANE_FILES entry");
  assert.ok(fs.existsSync(path.join(currentDir(ws), "base-sha")), "base-sha must be back at the flat path after the reverse leg");
  assert.ok(
    fs.readFileSync(path.join(currentDir(ws), "base-sha")).equals(baseShaBytes),
    "base-sha must round-trip byte-identical, flat -> lane -> flat",
  );
});

// ============================================================================
// The migration is wired into the server only through the lock-free cores (migrateFlatToLaneLocked,
// migrateLaneToFlatLocked). The public lock-acquiring wrappers stay referenced only inside tools/lane-migrate.ts: a
// caller already holding the per-lane lock must call the core, or it would self-deadlock re-acquiring the lock (AC12).
// ============================================================================

test("CALLERS1 (e123b9 J2, spec AC12): the PUBLIC migrateFlatToLane(/migrateLaneToFlat( wrappers are CALLED ONLY in tools/lane-migrate.ts's own SOURCE — never by readHandoffState/writeHandoffStateCore/tw_get_state/tw_update_state/any gates/ predicate/index.ts/TOOL_REGISTRY", () => {
  // Scoped to the TypeScript source tree (not dist/, which also names the symbols, nor test/). Matches an actual
  // CALL, the name directly followed by "(", so "migrateFlatToLaneLocked(" never counts and neither do comments in
  // tools/handoff-parse.ts and tools/handoff-write.ts that merely name the wrapper in prose.
  const dirs = ["tools", "gates", "guards", "prompts", "bin", "index.ts"];
  let output;
  try {
    output = execFileSync(
      "grep",
      ["-rnE", "-e", "migrateFlatToLane\\(", "-e", "migrateLaneToFlat\\(", "--include=*.ts", ...dirs],
      { cwd: PROJECT_ROOT, encoding: "utf-8" },
    );
  } catch (err) {
    if (err.status === 1) output = "";
    else throw err;
  }
  const files = new Set(
    output
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => line.split(":")[0]),
  );
  assert.deepEqual(
    [...files],
    ["tools/lane-migrate.ts"],
    `The public migrateFlatToLane(/migrateLaneToFlat( wrappers must be CALLED ONLY inside tools/lane-migrate.ts's own source — found in: ${[...files].join(", ")}`,
  );
});

test("CALLERS-LOCKED (e123b9 J2, spec AC12/AC13 — allow-list): migrateFlatToLaneLocked's production callers are exactly tools/handoff-parse.ts (readHandoffState, AC3) and tools/handoff-write.ts (writeHandoffStateCore, AC3) — a NEW unlisted caller still fails this", () => {
  const SANCTIONED_LOCKED_CORE_CALLERS = ["tools/handoff-parse.ts", "tools/handoff-write.ts", "tools/lane-migrate.ts"].sort();
  const dirs = ["tools", "gates", "guards", "prompts", "bin", "index.ts"];
  let output;
  try {
    output = execFileSync("grep", ["-rlw", "migrateFlatToLaneLocked", "--include=*.ts", ...dirs], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
  } catch (err) {
    if (err.status === 1) output = "";
    else throw err;
  }
  const files = output.split("\n").filter((l) => l.length > 0).sort();
  assert.deepEqual(
    files,
    SANCTIONED_LOCKED_CORE_CALLERS,
    `migrateFlatToLaneLocked callers must be exactly the sanctioned AC3 own-workspace entry points — found: ${files.join(", ")}`,
  );
});

// ============================================================================
// AC15 — both runners' moved-or-skipped key count equals the MOVABLE subset of LANE_FILES.length on the full
// fixture, derived from the registry. "tasks" is registered but noFlatCounterpart, so neither runner moves or skips
// it and it must be excluded from the count.
// ============================================================================

test("COUNT1: migrateFlatToLane's moved+skipped count equals MOVABLE_FILENAMES.length (LANE_FILES minus the noFlatCounterpart tasks entry) on the full 5-file fixture", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.equal(result.moved.length + result.skipped.length, MOVABLE_FILENAMES.length);
});

test("COUNT2: migrateLaneToFlat's moved+skipped count equals MOVABLE_FILENAMES.length (LANE_FILES minus the noFlatCounterpart tasks entry) on the full 5-file fixture", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  const result = await migrateLaneToFlat(ws, "e163");
  assert.equal(result.moved.length + result.skipped.length, MOVABLE_FILENAMES.length);
});

// ============================================================================
// AC15 — sidecar merge at migration: a pre-existing lane sidecar merges with the flat source's lines first (flat =
// oldest), never refuses, and is atomic. handoff.md is unchanged by this AC (CONFLICT1 covers its
// refuse-on-differing-content posture); this block covers the 4 optional LANE_FILES entries.
// ============================================================================

const MERGE_CASES = [
  ["telemetry.jsonl", '{"ts":"t1","gate":"g1"}\n', '{"ts":"t2","gate":"g2"}\n', '{"ts":"c1","gate":"gc1"}\n', '{"ts":"c2","gate":"gc2"}\n'],
  ["metrics.jsonl", '{"ts":"t1","feature":"f1"}\n', '{"ts":"t2","feature":"f2"}\n', '{"ts":"c1","feature":"fc1"}\n', '{"ts":"c2","feature":"fc2"}\n'],
  ["usage.jsonl", '{"ts":"t1","tokens":10}\n', '{"ts":"t2","tokens":20}\n', '{"ts":"c1","tokens":30}\n', '{"ts":"c2","tokens":40}\n'],
  ["dispatch.jsonl", '{"ts":"t1","feature":"f1"}\n', '{"ts":"t2","feature":"f2"}\n', '{"ts":"c1","feature":"fc1"}\n', '{"ts":"c2","feature":"fc2"}\n'],
];

for (const [filename, flatA, flatB, laneC, laneD] of MERGE_CASES) {
  test(`MERGE1 (AC15): migrateFlatToLane merges a pre-existing lane ${filename} — flat lines [A,B] first, then the lane's own pre-existing lines [C,D], flat source removed, no throw`, async () => {
    const ws = mkFlatWorkspace();
    writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
    writeFlatFile(ws, filename, flatA + flatB);
    fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
    fs.writeFileSync(path.join(laneDir(ws, "e163"), filename), laneC + laneD);

    const result = await migrateFlatToLane(ws, { lane: "e163" });
    assert.ok(!result.alreadyMigrated, "a genuine merge run, not a race-loser no-op");
    assert.ok(result.moved.includes(filename), `${filename} must be reported moved`);
    assert.ok(result.merged.includes(filename), `${filename} must be reported merged (AC15), not a plain rename`);

    const merged = fs.readFileSync(path.join(laneDir(ws, "e163"), filename), "utf-8");
    assert.equal(merged, flatA + flatB + laneC + laneD, "merged content must be exactly flat-lines-then-lane-lines, in that order");
    assert.ok(!fs.existsSync(path.join(currentDir(ws), filename)), "the flat source must be removed after a successful merge");
  });
}

test("MERGE2 (AC15): a fixture with ONLY a flat sidecar (no pre-existing lane file) behaves exactly as a plain move — AC8 unaffected, merge branch never exercised", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  writeFlatFile(ws, "telemetry.jsonl", '{"ts":"solo"}\n');

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.ok(result.moved.includes("telemetry.jsonl"));
  assert.ok(!result.merged.includes("telemetry.jsonl"), "no pre-existing lane file -> plain rename, not a merge");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "telemetry.jsonl"), "utf-8"), '{"ts":"solo"}\n');
});

test("MERGE3 (AC15): a flat sidecar with no trailing newline gets a separator inserted so the two JSONL streams never fuse into one malformed line", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  writeFlatFile(ws, "usage.jsonl", '{"ts":"no-trailing-newline"}'); // deliberately no \n
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "usage.jsonl"), '{"ts":"lane-line"}\n');

  await migrateFlatToLane(ws, { lane: "e163" });
  const merged = fs.readFileSync(path.join(laneDir(ws, "e163"), "usage.jsonl"), "utf-8");
  assert.equal(merged, '{"ts":"no-trailing-newline"}\n{"ts":"lane-line"}\n', "a separator newline must be inserted between the two streams");
});

test("MERGE4 (AC15): handoff.md (the required entry) is UNCHANGED by AC15 — a differing pre-existing lane handoff.md still refuses (CONFLICT1's posture), never merges", async () => {
  const ws = mkFlatWorkspace();
  const flatBody = handoffBody("e163-ci-gate-ordering");
  writeFlatFile(ws, "handoff.md", flatBody);
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  const conflictingBody = handoffBody("e163-some-other-run");
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), conflictingBody);

  await assert.rejects(() => migrateFlatToLane(ws, { lane: "e163" }), /already exists with different.*content|refusing to clobber/, "handoff.md must never take the sidecar merge branch");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "handoff.md"), "utf-8"), conflictingBody, "the lane handoff.md must be byte-unchanged, never merged with the flat source");
});

test("MERGE5 (AC15): a flat AND lane usage.jsonl present together with NO handoff.md conflict does NOT throw", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering")); // no lane handoff.md yet — no conflict
  writeFlatFile(ws, "usage.jsonl", '{"ts":"flat"}\n');
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "usage.jsonl"), '{"ts":"lane"}\n');

  await assert.doesNotReject(() => migrateFlatToLane(ws, { lane: "e163" }));
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "usage.jsonl"), "utf-8"), '{"ts":"flat"}\n{"ts":"lane"}\n');
});

test("MERGE6 (AC15): migrateLaneToFlat (the REVERSE runner) is UNCHANGED for sidecars — a differing flat-side sidecar on the return leg still refuses, exactly like before", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  // Simulate foreign content reappearing at the flat destination between the
  // forward and reverse legs (e.g. a stray write) — different bytes than
  // what the lane file holds.
  fs.writeFileSync(path.join(currentDir(ws), "metrics.jsonl"), '{"ts":"unrelated-foreign-content"}\n');

  await assert.rejects(
    () => migrateLaneToFlat(ws, "e163"),
    /already exists with different.*content|refusing to clobber/,
    "the reverse runner must never merge — differing flat-side content still refuses the whole run",
  );
  assert.equal(fs.readFileSync(path.join(currentDir(ws), "metrics.jsonl"), "utf-8"), '{"ts":"unrelated-foreign-content"}\n', "the flat-side file must be byte-unchanged after a refused reverse run");
});

// ============================================================================
// pendingTickets round-trips flat<->lane and is never merged. Unlike the four JSONL sidecars (MERGE1-6) it is
// committed markdown, so `isAppendLog` excludes it from the merge branch: identical bytes drop, conflicting bytes
// refuse, as with handoff.md (CONFLICT1/MERGE4). Concatenating would yield duplicate "## Applied" sections and
// duplicate lane_local_ids.
// ============================================================================

test("AC10 (e179): a pendingTickets file present ONLY at the flat source moves in flat->lane like any other optional sidecar", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  writeFlatFile(ws, "pending-tickets.md", "# pending tickets\n\nA finding.\n");

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.ok(result.moved.includes("pending-tickets.md"));
  assert.ok(!result.merged.includes("pending-tickets.md"), "pending-tickets.md must never be reported merged — it is not a JSONL append log (AC10)");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "pending-tickets.md"), "utf-8"), "# pending tickets\n\nA finding.\n");
});

test("AC10 (e179): matching-content pendingTickets at both flat and lane ends drops the redundant flat copy, never merges — flat->lane, no data loss", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  const body = "# pending tickets\n\nSame finding on both sides.\n";
  writeFlatFile(ws, "pending-tickets.md", body);
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "pending-tickets.md"), body);

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.ok(result.moved.includes("pending-tickets.md"), "identical-content destination still counts as moved (idempotent resume)");
  assert.ok(!result.merged.includes("pending-tickets.md"), "identical content must be a drop, never a merge — concatenating two markdown files would duplicate the content");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "pending-tickets.md"), "utf-8"), body, "the lane copy is unchanged");
  assert.ok(!fs.existsSync(path.join(currentDir(ws), "pending-tickets.md")), "the redundant flat source is removed");
});

test("AC10 (e179): conflicting-content pendingTickets at both flat and lane ends REFUSES the whole run — no silent data loss, never concatenated like a JSONL sidecar", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  const flatBody = "# pending tickets\n\nFlat-side finding.\n";
  const laneBody = "# pending tickets\n\nLane-side DIFFERENT finding.\n";
  writeFlatFile(ws, "pending-tickets.md", flatBody);
  fs.mkdirSync(laneDir(ws, "e163"), { recursive: true });
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "pending-tickets.md"), laneBody);

  await assert.rejects(
    () => migrateFlatToLane(ws, { lane: "e163" }),
    /already exists with different.*content|refusing to clobber/,
    "conflicting pending-tickets.md must refuse, never silently concatenate (AC10 — concatenating two markdown files would yield two ## Applied sections and duplicate lane_local_ids)",
  );
  assert.equal(fs.readFileSync(path.join(currentDir(ws), "pending-tickets.md"), "utf-8"), flatBody, "the flat SOURCE must be byte-unchanged after a refused move — no data loss");
  assert.equal(fs.readFileSync(path.join(laneDir(ws, "e163"), "pending-tickets.md"), "utf-8"), laneBody, "the conflicting DESTINATION must be byte-unchanged after a refused move — no silent clobber, no data loss");
});

test("AC10 (e179): pendingTickets round-trips lane->flat like the required entry — the reverse runner never merges either", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  writeFlatFile(ws, "pending-tickets.md", "# pending tickets\n\nRound-trip finding.\n");
  await migrateFlatToLane(ws, { lane: "e163" });

  const result = await migrateLaneToFlat(ws, "e163");
  assert.ok(result.moved.includes("pending-tickets.md"));
  assert.equal(fs.readFileSync(path.join(currentDir(ws), "pending-tickets.md"), "utf-8"), "# pending tickets\n\nRound-trip finding.\n");
});

test("AC10 (e179): a differing flat-side pendingTickets on the REVERSE leg still refuses — no silent data loss on lane->flat either", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  writeFlatFile(ws, "pending-tickets.md", "# pending tickets\n\nOriginal.\n");
  await migrateFlatToLane(ws, { lane: "e163" });
  // Foreign content reappears at the flat destination between the forward
  // and reverse legs (e.g. a stray write).
  fs.writeFileSync(path.join(currentDir(ws), "pending-tickets.md"), "# pending tickets\n\nUnrelated foreign content.\n");

  await assert.rejects(
    () => migrateLaneToFlat(ws, "e163"),
    /already exists with different.*content|refusing to clobber/,
  );
  assert.equal(
    fs.readFileSync(path.join(currentDir(ws), "pending-tickets.md"), "utf-8"),
    "# pending tickets\n\nUnrelated foreign content.\n",
    "the flat-side file must be byte-unchanged after a refused reverse run — no data loss",
  );
});

// ============================================================================
// The "tasks" entry is noFlatCounterpart: its older location is the taskPaths-resolved root file, not flat
// `.current/tasks.md`, so both runners and hasFlatLaneFiles ignore it. lane->flat refuses while the lane dir still
// holds tasks.md (the tasks reverse runner must run first); a leftover `tasks.md.lock` alone is tolerable debris
// like HANDOFF_LOCK_FILENAME or a stale atomic tmp.
// ============================================================================

test("AC2 (e125a): a flat .current/tasks.md is neither moved nor read by migrateFlatToLane — it is untouched and absent from moved/skipped", async () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "handoff.md", handoffBody("e163-ci-gate-ordering"));
  writeFlatFile(ws, "tasks.md", "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n- [ ] T01 x\n");

  const result = await migrateFlatToLane(ws, { lane: "e163" });
  assert.ok(!result.moved.includes("tasks.md"), "tasks.md must never be reported moved by the E123 flat->lane runner");
  assert.ok(!result.skipped.includes("tasks.md"), "tasks.md must never be reported skipped either — it is not in the runner's plan at all");
  assert.ok(fs.existsSync(path.join(currentDir(ws), "tasks.md")), "the flat tasks.md must still exist at its original path — never moved");
  assert.ok(!fs.existsSync(path.join(laneDir(ws, "e163"), "tasks.md")), "tasks.md must never be materialized under .current/<lane>/ by this runner");
  assert.equal(
    fs.readFileSync(path.join(currentDir(ws), "tasks.md"), "utf-8"),
    "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n- [ ] T01 x\n",
    "the flat tasks.md must be byte-unchanged",
  );
});

test("AC2 (e125a): hasFlatLaneFiles ignores a flat .current/tasks.md on its own — it is not an own-workspace migration trigger", () => {
  const ws = mkFlatWorkspace();
  writeFlatFile(ws, "tasks.md", "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n");
  assert.equal(
    hasFlatLaneFiles(ws),
    false,
    "a flat tasks.md alone must not trip hasFlatLaneFiles — its flat<->lane transition belongs to the tasks lane migration, not the E123 own-workspace trigger",
  );
  // Sanity: an ordinary LANE_FILES entry (e.g. telemetry.jsonl) DOES trip it —
  // proves the false result above is about tasks.md specifically, not a
  // broken predicate.
  writeFlatFile(ws, "telemetry.jsonl", "{}\n");
  assert.equal(hasFlatLaneFiles(ws), true, "an ordinary flat sidecar must still trip hasFlatLaneFiles");
});

test("AC2 (e125a): migrateLaneToFlat refuses outright while the lane dir still holds tasks.md — nothing moved, message names the tasks reverse runner", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  // Simulate a lane-local task ledger written by the server after the
// flat->lane move. (E123)
  fs.writeFileSync(path.join(laneDir(ws, "e163"), "tasks.md"), "<!-- schema_version: 2 -->\n# Tasks\n\n## Active\n- [ ] T01 x\n");

  await assert.rejects(
    () => migrateLaneToFlat(ws, "e163"),
    /holds tasks\.md.*run the tasks reverse migration first/,
    "the reverse runner must refuse with a message naming the tasks reverse migration, not attempt to move tasks.md to a flat path it never came from",
  );
  for (const filename of MOVABLE_FILENAMES) {
    assert.ok(fs.existsSync(path.join(laneDir(ws, "e163"), filename)), `${filename} must not have moved — a refused run touches nothing`);
  }
  assert.equal(
    fs.readFileSync(path.join(laneDir(ws, "e163"), "tasks.md"), "utf-8"),
    "<!-- schema_version: 2 -->\n# Tasks\n\n## Active\n- [ ] T01 x\n",
    "the lane-local tasks.md must be byte-unchanged by the refused run",
  );
});

test("AC2 (e125a): a leftover tasks.md.lock in the lane dir, on its own, is tolerable debris — the reverse move still succeeds and removes it with the lane dir", async () => {
  const ws = mkFlatWorkspace();
  seedAllFiveFiles(ws, "e163-ci-gate-ordering");
  await migrateFlatToLane(ws, { lane: "e163" });
  // A stale tasks.md.lock (dead-PID payload) with no accompanying tasks.md —
  // debris left by a crashed tasks-ledger migration, never itself a reason
  // to refuse the ordinary lane->flat move.
  fs.writeFileSync(
    path.join(laneDir(ws, "e163"), "tasks.md.lock"),
    JSON.stringify({ pid: 999999999, acquiredAt: Date.now() - 60_000 }),
  );

  const result = await migrateLaneToFlat(ws, "e163");
  assert.deepEqual(result.moved.sort(), MOVABLE_FILENAMES.slice().sort(), "the real lane files must still move normally");
  assert.ok(!fs.existsSync(laneDir(ws, "e163")), "the lane dir must be removed — a stale tasks.md.lock is debris, not foreign content blocking cleanup");
});

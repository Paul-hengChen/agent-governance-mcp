// Coded by @qa-engineer
// Tests for tools/lane-paths.ts, which maps a workspace and lane name to the
// per-lane files under .current/<lane>/ and works out which lane the current
// checkout belongs to. Covers specs/e123a-lane-layout-migration.md
// AC4/AC5/AC15 and specs/e123b0-lane-runtime-resolver.md AC1-AC5.
// (T-E123A3-08, T-E123B0-03)
//
// Spec-to-Test map:
//   e123a AC4 (resolveLaneName: leading ticket-id token, "_legacy" fallback,
//        MUST NEVER return "_primary")                -> RN1..RN9 (table-driven)
//   e123a AC5 (resolveLanePaths: derived-by-iterating-LANE_FILES stub,
//        only a short, listed set of callers of the FUNCTION resolveLanePaths
//        itself (the lane-aware code calls resolveCurrentLanePaths instead);
//        dispatch-log.ts imports its filename FROM LANE_FILES) -> RP1..RP4, CALLERS1
//        (CALLERS2 lists every module allowed to import "lane-paths", so a
//        new, unreviewed importer fails — see CALLERS2 below)
//   e123a AC15 (LANE_FILES is the single owner — resolveLanePaths's returned
//        key count equals LANE_FILES.length)          -> REG1, REG2
//   e123b0 AC1 (PRIMARY_LANE = "_primary" export)      -> AC1-1
//   e123b0 AC2 (resolveCurrentLane: pure-fs HEAD read over temp dirs — .git
//        dir, gitfile abs/relative gitdir, detached HEAD, missing .git,
//        malformed gitfile — never throws)             -> CL1..CLn (table-driven)
//   e123b0 AC3 (TICKET_ID_RE accepts a trailing letter/digit suffix, so ids
//        like e123b0/b1/b9 resolve to themselves; the older examples and the
//        _legacy fallback still hold; resolveLaneName never returns _primary)
//                                                        -> RESOLVE_LANE_NAME_CASES
//        additions below + existing RN-never-primary sweep
//   e123b0 AC4 (resolveCurrentLanePaths === resolveLanePaths(ws,
//        resolveCurrentLane(ws)) — zero behaviour change)  -> CLP1..CLPn
//   e123b0 AC5 (only reviewed modules call resolveCurrentLane)   ->
//        CALLERS3, an allow-list of those callers, so a new, unreviewed
//        caller fails

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  LANE_FILES,
  LEGACY_LANE,
  PRIMARY_LANE,
  HANDOFF_LOCK_FILENAME,
  laneFile,
  resolveCurrentLane,
  resolveCurrentLanePaths,
  resolveLaneName,
  resolveLanePaths,
  resolveFlatLanePaths,
  resolveLaneLockPath,
} from "../dist/tools/lane-paths.js";
import { dispatchLogPath } from "../dist/tools/dispatch-log.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// ============================================================================
// AC4 — resolveLaneName: leading ticket-id token, "_legacy" fallback.
// ============================================================================

const RESOLVE_LANE_NAME_CASES = [
  ["e163-ci-gate-ordering", "e163", "the spec's first worked example"],
  ["e123a-lane-layout-migration", "e123a", "the spec's second worked example (this feature's own name, alnum ticket id)"],
  ["lane-layout-migration", LEGACY_LANE, "no leading ticket-id token (doesn't match the [a-z]+\\d+[a-z]* shape)"],
  ["", LEGACY_LANE, "empty string"],
  [undefined, LEGACY_LANE, "absent (undefined)"],
  ["_primary", LEGACY_LANE, "already-legacy-shaped input must not round-trip to itself as a real ticket id"],
  ["E99", "e99", "bare uppercase ticket id, no trailing hyphenated slug — must lowercase"],
  ["e1x-some-feature", "e1x", "ticket id with a trailing single-letter suffix after the digits"],
  ["not-a-ticket-at-all", LEGACY_LANE, "ordinary English words with hyphens, no digit run"],
  // TICKET_ID_RE accepts a trailing [a-z0-9]* suffix, so sibling ids that
  // share a prefix (e123b0, e123b1, e123b9) resolve distinctly from one
  // another and from "e123b" instead of colliding on truncation. (e123b0 AC3)
  ["e123b0-lane-runtime-resolver", "e123b0", "AC3: widened suffix resolves this ticket's own id distinctly (was truncated before the widening)"],
  ["e123b1-core-write-path", "e123b1", "AC3: a sibling parallel-lane id resolves distinctly from e123b0/e123b9"],
  ["e123b9", "e123b9", "AC3: bare id with a digit trailing suffix, no hyphenated slug at all"],
];

for (const [input, expected, why] of RESOLVE_LANE_NAME_CASES) {
  test(`RN: resolveLaneName(${JSON.stringify(input)}) === ${JSON.stringify(expected)} (${why})`, () => {
    assert.equal(resolveLaneName(input), expected);
  });
}

test("RN-never-primary: resolveLaneName must NEVER return \"_primary\" for any input in the table above", () => {
  for (const [input] of RESOLVE_LANE_NAME_CASES) {
    assert.notEqual(
      resolveLaneName(input),
      "_primary",
      `resolveLaneName(${JSON.stringify(input)}) must never return "_primary" — that is the LIVE resolver's branch-based fallback (F1-owed), not this migration-time resolver's (spec AC4/Out of Scope)`,
    );
  }
});

test("RN-type-guard: resolveLaneName never throws on a non-string activeFeature (defensive)", () => {
  for (const hostile of [null, 42, {}, [], true]) {
    assert.doesNotThrow(() => resolveLaneName(hostile), `resolveLaneName(${JSON.stringify(hostile)}) must not throw`);
    assert.equal(resolveLaneName(hostile), LEGACY_LANE, `a non-string activeFeature must fall back to ${LEGACY_LANE}`);
  }
});

// ============================================================================
// AC6 — TICKET_ID_RE uses `\d[a-z0-9]*` (ONE mandatory digit), not
// `\d+[a-z0-9]*`: two adjacent quantifiers over the same [0-9] characters let
// a long digit run backtrack across O(n) splits of themselves. (e123b8 J1)
// Timing-free by design: the assertion below is a `{ timeout }` ceiling on
// the WHOLE test, never a measured-duration comparison, because measuring
// wall-clock milliseconds directly is exactly the kind of assertion that
// flakes under CI load. If TICKET_ID_RE regresses to a two-quantifier shape,
// this test times out (fails) instead of silently passing slow.
// ============================================================================

test(
  "AC6-PERF: a 10k-digit ticket-id-shaped input with no valid terminator anywhere in the run returns promptly, not quadratically",
  { timeout: 5000 },
  () => {
    // "e" + 10,000 digits + "@": [a-z]+ takes "e", \d[a-z0-9]* can only ever
    // stop somewhere inside the digit run, and NONE of those stopping points
    // is followed by "-" or end-of-string (the "@" blocks both) — so the
    // match is guaranteed to fail only after exhausting every split point.
    // That is precisely the failure shape that made the old `\d+[a-z0-9]*`
    // (two quantifiers both claiming the same [0-9] characters) backtrack
    // quadratically; the new single-mandatory-digit shape fails in one
    // linear pass instead.
    const hostile = "e" + "9".repeat(10_000) + "@";
    assert.equal(
      resolveLaneName(hostile),
      LEGACY_LANE,
      "no ticket-id token terminates before the trailing '@', so this must fall back to _legacy regardless of which regex shape produced it — only the TIME to reach that answer is what AC6 fixes",
    );
  },
);

// ============================================================================
// AC15 — LANE_FILES is the single canonical registry: exactly 8 entries,
// 1 required + 7 optional (pendingTickets, tasks and baseSha were the last
// three added; e179 AC1, e125a AC1, e125b AC11).
// ============================================================================

test("REG1: LANE_FILES has exactly 8 entries — 1 required (handoff) + 7 optional (telemetry/metrics/usage/dispatch/pendingTickets/tasks/baseSha)", () => {
  assert.equal(LANE_FILES.length, 8, "LANE_FILES must have exactly 8 entries (e125b spec AC11 added baseSha)");
  const required = LANE_FILES.filter((f) => f.required);
  const optional = LANE_FILES.filter((f) => !f.required);
  assert.equal(required.length, 1, "exactly 1 required entry");
  assert.equal(optional.length, 7, "exactly 7 optional entries");
  assert.equal(required[0].key, "handoff", "the sole required entry must be handoff.md");
  assert.deepEqual(
    LANE_FILES.map((f) => f.filename).sort(),
    ["base-sha", "dispatch.jsonl", "handoff.md", "metrics.jsonl", "pending-tickets.md", "tasks.md", "telemetry.jsonl", "usage.jsonl"],
    "LANE_FILES must name exactly today's 8 .current/ filenames — no more, no fewer",
  );
  const tasksEntry = LANE_FILES.find((f) => f.key === "tasks");
  assert.ok(tasksEntry, "LANE_FILES must carry a 'tasks' entry (e125a spec AC1)");
  assert.equal(tasksEntry.filename, "tasks.md");
  assert.equal(tasksEntry.required, false, "a lane with no tasks has no ledger — required:false");
  assert.equal(
    tasksEntry.noFlatCounterpart,
    true,
    "tasks.md's legacy location is the taskPaths-resolved root file, not .current/tasks.md — noFlatCounterpart marks that the E123 flat<->lane runners never move it (architecture D1)",
  );
});

// baseSha MUST be a registered LANE_FILES entry (not a standalone composer):
// a file inside .current/<lane>/ that migrateLaneToFlat
// doesn't recognize makes the whole lane refuse to reverse-migrate (see
// test/lane-migrate.test.mjs). required:false (an older lane has none) and
// deliberately NO noFlatCounterpart — unlike tasks.md, no other migration
// module owns base-sha's flat<->lane transition, so the flat<->lane
// migration runners must move it themselves. (e125b AC11)
test("AC11 (e125b): LANE_FILES carries the baseSha entry — key, filename, required:false, no noFlatCounterpart", () => {
  const baseShaEntry = LANE_FILES.find((f) => f.key === "baseSha");
  assert.ok(baseShaEntry, "LANE_FILES must carry a 'baseSha' entry (e125b spec AC11)");
  assert.equal(baseShaEntry.filename, "base-sha");
  assert.equal(baseShaEntry.required, false, "a lane started before this ticket shipped has no base-sha file — required:false");
  assert.equal(
    baseShaEntry.noFlatCounterpart,
    undefined,
    "baseSha must NOT carry noFlatCounterpart — no other migration module owns its flat<->lane transition (unlike tasks.md), so the E123 runners must move it",
  );
});

test("AC11 (e125b): LanePaths exposes baseShaPath at .current/<lane>/base-sha (via LANE_PATH_FIELD's baseSha: \"baseShaPath\" row)", () => {
  const paths = resolveLanePaths("/some/workspace", "e125b");
  assert.equal(paths.baseShaPath, path.join("/some/workspace", ".current", "e125b", "base-sha"));
});

// Each lane keeps its own task ledger: resolveLanePaths(ws, "e125a").tasksPath
// resolves under that lane's directory. (e125a AC1)
test("AC1 (e125a): resolveLanePaths exposes tasksPath at .current/<lane>/tasks.md", () => {
  const paths = resolveLanePaths("/some/workspace", "e125a");
  assert.equal(paths.tasksPath, path.join("/some/workspace", ".current", "e125a", "tasks.md"));
});

test("REG2: laneFile() looks up a registry entry by key and throws on an unknown key", () => {
  assert.equal(laneFile("dispatch").filename, "dispatch.jsonl");
  assert.equal(laneFile("handoff").required, true);
  assert.throws(() => laneFile("no-such-key"), /unknown lane file key/);
});

// ============================================================================
// pending-tickets.md is a registered, optional LANE_FILES entry with a
// matching LanePaths field, exposed by BOTH path resolvers (lane-scoped and
// legacy-flat). (e179 AC1)
// ============================================================================

test("AC1 (e179): LANE_FILES carries the pendingTickets entry — key, filename, and required:false", () => {
  const entry = laneFile("pendingTickets");
  assert.equal(entry.key, "pendingTickets");
  assert.equal(entry.filename, "pending-tickets.md");
  assert.equal(
    entry.required,
    false,
    "required:false is load-bearing — a lane that never filed a finding has no pending-tickets.md at all, and an ordinary lane<->flat migration must never refuse over its absence",
  );
});

test("AC1 (e179): resolveLanePaths exposes pendingTicketsPath at .current/<lane>/pending-tickets.md", () => {
  const paths = resolveLanePaths("/some/workspace", "e179");
  assert.equal(paths.pendingTicketsPath, path.join("/some/workspace", ".current", "e179", "pending-tickets.md"));
});

test("AC1 (e179): resolveFlatLanePaths exposes pendingTicketsPath at the legacy flat .current/pending-tickets.md", () => {
  const paths = resolveFlatLanePaths("/some/workspace");
  assert.equal(paths.pendingTicketsPath, path.join("/some/workspace", ".current", "pending-tickets.md"));
});

// ============================================================================
// AC5 — resolveLanePaths: zero-behaviour-change stub, identical output for
// every lane arg, derived by iterating LANE_FILES (not restating filenames).
// ============================================================================

test("RP1 (e123b9 J2, spec AC1 — FLIPPED): resolveLanePaths returns lane-scoped .current/<lane>/<filename> paths for every LANE_FILES entry", () => {
  const paths = resolveLanePaths("/some/workspace", "e163");
  assert.equal(paths.handoffPath, path.join("/some/workspace", ".current", "e163", "handoff.md"));
  assert.equal(paths.telemetryPath, path.join("/some/workspace", ".current", "e163", "telemetry.jsonl"));
  assert.equal(paths.metricsPath, path.join("/some/workspace", ".current", "e163", "metrics.jsonl"));
  assert.equal(paths.usagePath, path.join("/some/workspace", ".current", "e163", "usage.jsonl"));
  assert.equal(paths.dispatchLogPath, path.join("/some/workspace", ".current", "e163", "dispatch.jsonl"));
});

test("RP2 (e123b9 J2, spec AC1 — FLIPPED, retires the old zero-behaviour-change contract): resolveLanePaths returns genuinely DIFFERENT, lane-scoped output for distinct SAFE lane arguments", () => {
  const ws = "/another/workspace";
  const a = resolveLanePaths(ws, "e163");
  const b = resolveLanePaths(ws, "_legacy");
  const c = resolveLanePaths(ws, "_primary");
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), "lane='e163' vs lane='_legacy' must now differ — the lane argument is load-bearing, not ignored");
  assert.notEqual(JSON.stringify(b), JSON.stringify(c), "lane='_legacy' vs lane='_primary' must differ");
  assert.equal(a.handoffPath, path.join(ws, ".current", "e163", "handoff.md"));
  assert.equal(b.handoffPath, path.join(ws, ".current", "_legacy", "handoff.md"));
  assert.equal(c.handoffPath, path.join(ws, ".current", "_primary", "handoff.md"));
});

test("RP3: resolveLanePaths's returned key count equals LANE_FILES.length (AC15 — derived by iterating the registry, not hand-enumerated)", () => {
  const paths = resolveLanePaths("/ws", "e163");
  assert.equal(Object.keys(paths).length, LANE_FILES.length, "resolveLanePaths must return exactly one path field per LANE_FILES entry — no more, no fewer");
});

test("RP4 (e123b9 J2, spec AC1 — FLIPPED, retires the old tolerate-anything contract): resolveLanePaths THROWS on an unsafe lane argument — a hostile string, undefined, null, or empty", () => {
  // The lane becomes a real filesystem path segment (AC1), so
  // assertSafeLaneName rejects
  // anything that isn't one safe path segment — traversal strings, and
  // non-string/empty values that would otherwise resolve to "undefined"/""
  // on disk.
  assert.throws(() => resolveLanePaths("/ws", "../garbage"), /invalid lane name/);
  assert.throws(() => resolveLanePaths("/ws", ""), /invalid lane name/);
  assert.throws(() => resolveLanePaths("/ws", undefined), /invalid lane name/);
  assert.throws(() => resolveLanePaths("/ws", null), /invalid lane name/);
});

// ============================================================================
// AC5 — resolveLaneLockPath: the handoff lock is per-lane
// (.current/<lane>/.handoff.lock), not workspace-wide (.current/.handoff.lock),
// so lanes never block each other's writes. (Decision 2, T-E123B9-05)
// One table covers several lane shapes so a
// regression that special-cases any one of them (e.g. only _primary) fails
// loud.
// ============================================================================

const LOCK_PATH_CASES = [
  ["e163", "a ticket-id lane"],
  ["_primary", "the primary-checkout lane"],
  ["_legacy", "the legacy-fallback lane"],
];

for (const [lane, why] of LOCK_PATH_CASES) {
  test(`LOCK1 (AC5): resolveLaneLockPath("/ws", "${lane}") is .current/${lane}/${HANDOFF_LOCK_FILENAME}, never the workspace-wide path — ${why}`, () => {
    const resolved = resolveLaneLockPath("/ws", lane);
    assert.equal(resolved, path.join("/ws", ".current", lane, HANDOFF_LOCK_FILENAME));
    assert.notEqual(resolved, path.join("/ws", ".current", HANDOFF_LOCK_FILENAME), "must not resolve to the retired workspace-wide lock path");
  });
}

test("LOCK2 (AC5): resolveLaneLockPath composes resolveLaneDir + the single-owned HANDOFF_LOCK_FILENAME constant, not a restated literal", () => {
  const a = resolveLaneLockPath("/ws", "e999");
  const b = path.join("/ws", ".current", "e999", HANDOFF_LOCK_FILENAME);
  assert.equal(a, b);
});

// ============================================================================
// AC5 — allow-listed callers. Every module that imports "lane-paths" must be
// on a reviewed list, so a new importer cannot appear unnoticed. The list is
// expected to grow: AC15 requires tools/dispatch-log.ts and
// tools/lane-migrate.ts to import FROM lane-paths.ts, and the write path,
// sidecars, prompt builder and bin/ hooks all go through
// resolveCurrentLane(Paths). CALLERS1 above pins the separate, narrower list
// of callers of the resolveLanePaths FUNCTION itself.
// (T-E123BI-01, L-SCHEMA-NEW-6)
// ============================================================================

test("CALLERS1 (e125b spec AC11 — allow-list, was a zero-callers check): grep -rn resolveLanePaths tools/ gates/ guards/ prompts/ bin/ index.ts names exactly tools/lane-paths.ts + bin/agc-init.mjs — a NEW unlisted caller still fails this", () => {
  // Every base-sha consumer calls resolveLanePaths(ws, lane).baseShaPath
  // directly — the same
  // generic, registry-derived path every other lane file already goes
  // through — instead of a standalone composer. bin/agc-init.mjs is now a
  // genuine, sanctioned new caller: runFeatureStart writes baseShaPath after
  // `git worktree add`, and runFeatureFinish's readLaneBaseSha reads it back.
  // The test is an allow-list, so a FUTURE unlisted caller of the
  // resolveLanePaths FUNCTION still fails it. (e125b AC11)
  const dirs = ["tools", "gates", "guards", "prompts", "bin", "index.ts"];
  let output;
  try {
    output = execFileSync("grep", ["-rn", "resolveLanePaths", ...dirs], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  } catch (err) {
    // grep exits 1 when there are zero matches — treat that as "no hits",
    // never as a test-infra failure (only a non-1 exit is unexpected).
    if (err.status === 1) {
      output = "";
    } else {
      throw err;
    }
  }
  const files = new Set(
    output
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => line.split(":")[0]),
  );
  assert.deepEqual(
    [...files].sort(),
    ["bin/agc-init.mjs", "tools/lane-paths.ts"],
    `resolveLanePaths must be referenced ONLY inside tools/lane-paths.ts itself and the e125b AC11-sanctioned bin/agc-init.mjs — found in: ${[...files].join(", ")}`,
  );
});

test("CALLERS2 (allow-list): grep -rln \"lane-paths\" tools/ gates/ guards/ prompts/ bin/ index.ts names exactly the sanctioned F0 + L1-L3 importer set — a NEW unlisted importer still fails this", () => {
  // Each entry was checked against the spec that introduced the import before
  // it was added. Grouped by the change that added it; the group labels
  // (F0, L1-L3, J2, F2) are the rows of the lane-layout feature split.
  const SANCTIONED_LANE_PATHS_IMPORTERS = [
    // The module itself plus the LANE_FILES/laneFile/resolveLaneName consumers
    // AC15 requires. (F0, e123a/e123b0)
    "tools/dispatch-log.ts",
    "tools/lane-migrate.ts",
    "tools/lane-paths.ts",
    // The handoff write path and its session guard. (L1, e123b1)
    "guards/session.ts",
    "tools/drift.ts",
    "tools/handoff-parse.ts",
    "tools/handoff-write.ts",
    // The metrics and telemetry sidecar writers. (L2, e123b2)
    "tools/metrics.ts",
    "tools/telemetry.ts",
    // The prompt builder and the bin/ hooks. (L3, e123b3)
    "bin/agent-governance-context.mjs",
    "bin/agent-governance-usage-hook.mjs",
    "prompts/build.ts",
    // tools/lane-registry.ts imports isSafeLaneName for getLaneFeatureHistory's
    // lane-name filter instead of keeping its own copy. (J2, e123b9 AC7/AC10)
    "tools/lane-registry.ts",
    // Cross-lane sidecar readers: tools/gate-stats.ts imports
    // enumerateLaneSidecarSources/
    // resolveCurrentLanePaths/resolveFlatLanePaths (the cross-lane sidecar
    // reader), and tools/usage-accounting.ts imports
    // enumerateLaneSidecarSources/resolveCurrentLanePaths (sumUsageForFeature
    // aggregation and its lane-scoped write target). (F2, e123c AC1/AC11)
    "tools/gate-stats.ts",
    "tools/usage-accounting.ts",
    // bin/agc-init.mjs dynamically imports dist/tools/lane-paths.js for
    // `agc feature start`/`finish`, reusing resolveLaneName/resolveCurrentLane
    // rather than copying the ticket-id regex. (e73 AC3/AC4, T-E73-04B)
    "bin/agc-init.mjs",
    // Lane-local task ledgers: three importers. (e125a AC1/AC10)
    //   tools/tasks-lane-migrate.ts imports
    //     PRIMARY_LANE/laneFile/resolveCurrentLanePaths/resolveLaneDir/
    //     resolveLaneName for the forward/reverse lane-ledger migration.
    //   tools/config.ts imports resolveCurrentLanePaths — findTasksFile
    //     checks the lane path first, still side-effect-free.
    //   tools/tasks-file.ts imports LEGACY_LANE/PRIMARY_LANE/
    //     resolveCurrentLanePaths/resolveLaneName — the task tools read and
    //     write only the current lane's ledger.
    "tools/config.ts",
    "tools/tasks-file.ts",
    "tools/tasks-lane-migrate.ts",
    // tools/merge-invariants.ts imports isSafeLaneName/NON_LANE_DIRS/
    // HISTORY_BUCKET_RE/isBytePrefix (reuse by import, never a restated copy)
    // for its whole-tree ledger/sidecar enumeration over arbitrary git
    // commits. (e126, T-E126-01)
    "tools/merge-invariants.ts",
    // tools/lane-status.ts imports resolveLaneName/LEGACY_LANE/PRIMARY_LANE/
    // isSafeLaneName/laneFile for the evidence cross-check's ticket-token
    // parsing and lane-ledger path, instead of a copied ticket-id regex that
    // would drift from the real one. It does not call
    // resolveCurrentLane/resolveLanePaths (CALLERS1/CALLERS3 unaffected).
    // (e177b AC5/AC5a/AC5c, review fix R1)
    "tools/lane-status.ts",
  ].sort();
  let output;
  try {
    output = execFileSync("grep", ["-rln", "lane-paths", "tools", "gates", "guards", "prompts", "bin", "index.ts"], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
  } catch (err) {
    if (err.status === 1) output = "";
    else throw err;
  }
  const files = output
    .split("\n")
    .filter((l) => l.length > 0)
    .sort();
  assert.deepEqual(
    files,
    SANCTIONED_LANE_PATHS_IMPORTERS,
    `"lane-paths" importers must be exactly the sanctioned F0 + L1-L3 set — found: ${files.join(", ")}. A missing entry means this allow-list is stale (reconcile against .current/feature-split.md rows 1.0-1.3); an extra, unlisted entry is a genuine new caller — verify it against the feature split before adding it here, never allow-list it blind.`,
  );
});

// ============================================================================
// AC1 — PRIMARY_LANE export. (e123b0)
// ============================================================================

test("AC1-1: PRIMARY_LANE is exported and equals \"_primary\"", () => {
  assert.equal(PRIMARY_LANE, "_primary");
});

// ============================================================================
// AC2/AC3 — resolveCurrentLane: pure-fs HEAD read, table-driven over
// temp dirs. Every workspace is created under os.tmpdir() (never the repo
// root) and removed via t.after(), per a fixture never surviving its test.
// (e123b0)
// ============================================================================

function mkWorkspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e123b0-lane-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// CURRENT_LANE_CASES: each `setup(ws, t)` builds a `.git` shape inside a
// fresh temp workspace `ws`; `expected` is what resolveCurrentLane(ws) must
// return. Covers every AC2 proof shape (.git dir, gitfile abs/relative
// gitdir, detached HEAD, missing .git, malformed gitfile) plus the AC3
// branch-shape matrix (non-feat branches, feat/ with no id token, and the
// three S0/L/J ids).
const CURRENT_LANE_CASES = [
  {
    name: ".git dir, feat/<id>-* branch -> lowercased id (spec's own worked example)",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/e123b1-core-write-path\n");
    },
    expected: "e123b1",
  },
  {
    name: ".git dir, feat/e123b0-* branch -> e123b0 (this ticket's own id, distinct from e123b1/e123b9)",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/e123b0-lane-runtime-resolver\n");
    },
    expected: "e123b0",
  },
  {
    name: ".git dir, feat/e123b9-* branch -> e123b9 (the J-stage id, distinct from e123b0/e123b1)",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/e123b9-flip-the-seam\n");
    },
    expected: "e123b9",
  },
  {
    name: ".git dir, main branch -> PRIMARY_LANE",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/main\n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: ".git dir, integ/wave4 branch (non-feat prefix) -> PRIMARY_LANE",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/integ/wave4\n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: ".git dir, fix/x branch (non-feat prefix) -> PRIMARY_LANE",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/fix/x\n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: ".git dir, feat/ branch whose rest has no leading ticket-id token -> PRIMARY_LANE",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/no-ticket-id-here\n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: ".git dir, detached HEAD (bare sha, no ref:) -> PRIMARY_LANE",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.writeFileSync(path.join(ws, ".git", "HEAD"), "4b825dc642cb6eb9a060e54bf8d69288fbee4904\n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: ".git dir exists but HEAD file is missing -> PRIMARY_LANE (never throws on ENOENT)",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
    },
    expected: PRIMARY_LANE,
  },
  {
    name: ".git dir exists but HEAD is itself a directory -> PRIMARY_LANE (never throws on EISDIR)",
    setup: (ws) => {
      fs.mkdirSync(path.join(ws, ".git"));
      fs.mkdirSync(path.join(ws, ".git", "HEAD"));
    },
    expected: PRIMARY_LANE,
  },
  {
    name: "missing .git entirely -> PRIMARY_LANE",
    setup: () => {},
    expected: PRIMARY_LANE,
  },
  {
    name: "gitfile with an ABSOLUTE gitdir -> resolves through to the real HEAD (linked-worktree shape)",
    setup: (ws, t) => {
      const realGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "e123b0-gitdir-abs-"));
      t.after(() => fs.rmSync(realGitDir, { recursive: true, force: true }));
      fs.writeFileSync(path.join(ws, ".git"), `gitdir: ${realGitDir}\n`);
      fs.writeFileSync(path.join(realGitDir, "HEAD"), "ref: refs/heads/feat/e123b1-core-write-path\n");
    },
    expected: "e123b1",
  },
  {
    name: "gitfile with a RELATIVE gitdir, resolved against the workspace (not cwd) -> resolves through to the real HEAD",
    setup: (ws, t) => {
      // A relative gitdir is resolved against the directory CONTAINING the
      // gitfile (ws itself), per AC2 — never against process.cwd(). Place
      // the real gitdir as a sibling of ws and reference it by "../<name>".
      const siblingName = `${path.basename(ws)}-gitdir-rel`;
      const realGitDir = path.join(path.dirname(ws), siblingName);
      fs.mkdirSync(realGitDir);
      t.after(() => fs.rmSync(realGitDir, { recursive: true, force: true }));
      fs.writeFileSync(path.join(ws, ".git"), `gitdir: ../${siblingName}\n`);
      fs.writeFileSync(path.join(realGitDir, "HEAD"), "ref: refs/heads/feat/e123b9-flip-the-seam\n");
    },
    expected: "e123b9",
  },
  {
    name: "malformed gitfile (no 'gitdir:' prefix at all) -> PRIMARY_LANE",
    setup: (ws) => {
      fs.writeFileSync(path.join(ws, ".git"), "this is not a gitfile\n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: "malformed gitfile ('gitdir:' with an empty/whitespace-only value) -> PRIMARY_LANE",
    setup: (ws) => {
      fs.writeFileSync(path.join(ws, ".git"), "gitdir:    \n");
    },
    expected: PRIMARY_LANE,
  },
  {
    name: "gitfile points at a gitdir that does not exist (dangling) -> PRIMARY_LANE (never throws on ENOENT)",
    setup: (ws) => {
      fs.writeFileSync(path.join(ws, ".git"), `gitdir: ${path.join(ws, "nonexistent-gitdir")}\n`);
    },
    expected: PRIMARY_LANE,
  },
  {
    name: "workspacePath itself does not exist -> PRIMARY_LANE",
    setup: () => {},
    expected: PRIMARY_LANE,
    skipMkdir: true,
  },
];

for (const { name, setup, expected, skipMkdir } of CURRENT_LANE_CASES) {
  test(`CL: resolveCurrentLane — ${name}`, (t) => {
    const ws = skipMkdir
      ? path.join(os.tmpdir(), `e123b0-lane-test-nonexistent-${process.pid}-${Math.random().toString(36).slice(2)}`)
      : mkWorkspace(t);
    setup(ws, t);
    assert.equal(resolveCurrentLane(ws), expected);
  });
}

test("CL-type-guard: resolveCurrentLane never throws on a non-string workspacePath (defensive)", () => {
  for (const hostile of [null, undefined, 42, {}, [], true]) {
    assert.doesNotThrow(() => resolveCurrentLane(hostile), `resolveCurrentLane(${JSON.stringify(hostile)}) must not throw`);
    assert.equal(resolveCurrentLane(hostile), PRIMARY_LANE, `a non-string workspacePath must fall back to ${PRIMARY_LANE}`);
  }
});

// ============================================================================
// AC4 — resolveCurrentLanePaths is exactly resolveLanePaths(ws,
// resolveCurrentLane(ws)) across the branch shapes exercised above, so the
// two resolvers can never disagree about a lane's files. (e123b0)
// ============================================================================

test("CLP1: resolveCurrentLanePaths(ws) deep-equals resolveLanePaths(ws, resolveCurrentLane(ws)) for a feat-branch workspace", (t) => {
  const ws = mkWorkspace(t);
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/e123b1-core-write-path\n");
  const expected = resolveLanePaths(ws, resolveCurrentLane(ws));
  assert.deepEqual(resolveCurrentLanePaths(ws), expected);
});

test("CLP2: resolveCurrentLanePaths(ws) deep-equals resolveLanePaths(ws, resolveCurrentLane(ws)) for a primary-checkout (main) workspace", (t) => {
  const ws = mkWorkspace(t);
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/main\n");
  const expected = resolveLanePaths(ws, resolveCurrentLane(ws));
  assert.deepEqual(resolveCurrentLanePaths(ws), expected);
});

test("CLP3 (e123b9 J2, spec AC1 — FLIPPED): resolveCurrentLanePaths returns genuinely lane-scoped .current/<lane>/<filename> paths, keyed off the checked-out branch's ticket id", (t) => {
  const ws = mkWorkspace(t);
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), "ref: refs/heads/feat/e123b0-lane-runtime-resolver\n");
  const paths = resolveCurrentLanePaths(ws);
  assert.equal(paths.handoffPath, path.join(ws, ".current", "e123b0", "handoff.md"));
  assert.equal(paths.telemetryPath, path.join(ws, ".current", "e123b0", "telemetry.jsonl"));
  assert.equal(paths.metricsPath, path.join(ws, ".current", "e123b0", "metrics.jsonl"));
  assert.equal(paths.usagePath, path.join(ws, ".current", "e123b0", "usage.jsonl"));
  assert.equal(paths.dispatchLogPath, path.join(ws, ".current", "e123b0", "dispatch.jsonl"));
});

// ============================================================================
// AC5 — allow-listed callers of resolveCurrentLane. The write-path core,
// sidecars, prompt builder and bin/ hooks all go through
// resolveCurrentLane(Paths); this test lists every reviewed caller, so a new,
// unreviewed caller fails. (e123b0 AC5, T-E123BI-01)
// ============================================================================

test("CALLERS3 (allow-list): grep -rn resolveCurrentLane tools/ gates/ guards/ prompts/ bin/ index.ts names exactly the sanctioned L1-L3 caller set — a NEW unlisted caller still fails this", () => {
  // Each entry was checked against the spec that introduced the import before
  // it was added. Grouped by the change that added it; the group labels
  // (F0, L1-L3, J2, F2) are the rows of the lane-layout feature split.
  const SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS = [
    // tools/lane-paths.ts itself: the declaration and its comments. (F0)
    "tools/lane-paths.ts",
    // The handoff write path and its session guard. (L1, e123b1)
    "guards/session.ts",
    "tools/drift.ts",
    "tools/handoff-parse.ts",
    "tools/handoff-write.ts",
    // The metrics and telemetry sidecar writers. (L2, e123b2)
    "tools/metrics.ts",
    "tools/telemetry.ts",
    // The prompt builder and the bin/ hooks. (L3, e123b3)
    "bin/agent-governance-context.mjs",
    "bin/agent-governance-usage-hook.mjs",
    "prompts/build.ts",
    // dispatchLogPath calls resolveCurrentLanePaths (a raw
    // `resolveCurrentLane` grep also matches the "...Paths" substring, so this
    // routing shows up here too). (J1, e123b8 AC1/AC9)
    "tools/dispatch-log.ts",
    // migrateFlatToLane's destination lane defaults to resolveCurrentLane(ws)
    // (opts.lane ?? resolveCurrentLane(workspacePath)), because the lane is
    // decided by the checked-out branch, not by active_feature.
    // (J2, e123b9 AC2, T-E123B9-05)
    "tools/lane-migrate.ts",
    // tools/gate-stats.ts calls resolveCurrentLanePaths for the report's
    // current-lane path/caveat; tools/usage-accounting.ts calls it for
    // appendUsageRecord's write target. (F2, e123c AC1/AC7/AC11) Both also match this grep via
    // enumerateLaneSidecarSources's own doc-comment substring, same as
    // lane-registry.ts above.
    "tools/gate-stats.ts",
    "tools/usage-accounting.ts",
    // bin/agc-init.mjs's runFeatureStart calls resolveCurrentLane(lanePath)
    // to print the lane id, and runFeatureFinish calls it per worktree to find
    // the exact-match lane (finish never matches on a substring).
    // (e73 AC3, T-E73-04B)
    "bin/agc-init.mjs",
    // Lane-local task ledgers: three callers, all reaching resolveCurrentLane
    // via resolveCurrentLanePaths (which this grep also matches as a
    // substring) — see CALLERS2's matching entries above for the call sites.
    // (e125a)
    "tools/config.ts",
    "tools/tasks-file.ts",
    "tools/tasks-lane-migrate.ts",
  ].sort();
  const dirs = ["tools", "gates", "guards", "prompts", "bin", "index.ts"];
  let output;
  try {
    output = execFileSync("grep", ["-rn", "resolveCurrentLane", ...dirs], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  } catch (err) {
    if (err.status === 1) {
      output = "";
    } else {
      throw err;
    }
  }
  const files = [
    ...new Set(
      output
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => line.split(":")[0]),
    ),
  ].sort();
  assert.deepEqual(
    files,
    SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS,
    `resolveCurrentLane references must be exactly the sanctioned F0 + L1-L3 set — found: ${files.join(", ")}. A missing entry means this allow-list is stale (reconcile against .current/feature-split.md rows 1.0-1.3); an extra, unlisted entry is a genuine new caller — verify it against the feature split before adding it here, never allow-list it blind.`,
  );
});

// ============================================================================
// AC1 — tools/dispatch-log.ts's dispatchLogPath() gets `dispatch.jsonl` from
// resolveCurrentLanePaths(<absolute ws>).dispatchLogPath, not from a direct
// `.current/` join, so the dispatch log follows the same lane layout as every
// other lane file. The result is lane-scoped, which AC1-DL1 below asserts.
// (e123b8 J1, e123b9 J2)
// ============================================================================

test("AC1-DL1 (e123b9 J2, spec AC1 — FLIPPED): dispatchLogPath(absoluteWs) is lane-scoped .current/_primary/dispatch.jsonl for a workspace with no .git (PRIMARY_LANE fallback)", () => {
  const ws = "/some/absolute/workspace";
  assert.equal(dispatchLogPath(ws), path.join(ws, ".current", "_primary", "dispatch.jsonl"));
});

test("AC1-DL2: dispatchLogPath(absoluteWs) equals resolveCurrentLanePaths(ws).dispatchLogPath exactly — proves the call site now delegates to the shared resolver instead of restating the join", () => {
  const ws = "/another/absolute/workspace";
  assert.equal(dispatchLogPath(ws), resolveCurrentLanePaths(ws).dispatchLogPath);
});

test("AC1-DL3: dispatchLogPath resolves a RELATIVE workspacePath to an absolute path (path.resolve precedent from tools/handoff-write.ts's getHandoffPath), never returning a relative path", () => {
  const relative = "relative-workspace-dir";
  const result = dispatchLogPath(relative);
  assert.ok(path.isAbsolute(result), `dispatchLogPath("${relative}") must return an absolute path, got: ${result}`);
  // resolve(relative) has no .git of its own, so resolveCurrentLane falls
  // back to PRIMARY_LANE. (e123b9 J2, AC1)
  assert.equal(result, path.join(path.resolve(relative), ".current", "_primary", "dispatch.jsonl"));
});

test("AC1-DL4 (grep): tools/dispatch-log.ts contains no direct `.current` string-literal join — the path comes ONLY from the lane-path resolver", () => {
  const file = path.join(PROJECT_ROOT, "tools", "dispatch-log.ts");
  const src = fs.readFileSync(file, "utf-8");
  assert.doesNotMatch(
    src,
    /["']\.current["']/,
    "tools/dispatch-log.ts must not construct a `.current` path itself (AC1) — any lane-file path must come from resolveCurrentLanePaths",
  );
});

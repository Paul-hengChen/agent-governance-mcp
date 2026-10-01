// Coded by @qa-engineer
// Tests for tools/lane-registry.ts (specs/e132-lane-registry.md AC1-AC4, AC7-AC9) plus the tw_get_state wiring in tools/handoff-parse.ts.
// AC5/AC6 and the localFallbackLaneList / computeFeatureRollup cases live in test/feature-rollup.test.mjs. Case names carry the spec AC or the
// code-reviewer gap number (gap-4, gap-6, gap-7; review_reports/review_T-E132-04.md). Git is faked with real executable `git` shims prepended to PATH
// (node:test mock.method cannot redefine ESM core-module exports); worktree fixtures are real temp dirs with real handoff files.
// Rationale: specs/e260f-comment-rationale.md (test/e132-lane-registry.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  laneRegistryList,
  getLaneFeatureHistory,
  getLaneRegistrySummary,
} from "../dist/tools/lane-registry.js";
import { readHandoffState, writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// ---------- fixture helpers -------------------------------------------------

function mkWs(prefix = "e132-lr-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function write(ws, opts) {
  resetSession();
  markStateRead(ws);
  return writeHandoffState({
    workspacePath: ws,
    completedTasks: [],
    pendingNotes: [],
    status: "In_Progress",
    lastAgent: "sr-engineer",
    ...opts,
  });
}

/** A real, executable `git` that `cat`s a fixed JS-controlled byte sequence, so a test dictates the exact porcelain bytes (including CRLF)
 *  with no shell-escaping hazard. Warms the shim up with one throwaway call before returning: the first exec of a new script path costs 200ms+
 *  in this sandbox and would flake the 200ms-ceiling tests. A test-environment accommodation only. */
function fakeGitCat(content) {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "e132-fakegit-"));
  const dataPath = path.join(binDir, "porcelain.txt");
  fs.writeFileSync(dataPath, content);
  fs.writeFileSync(path.join(binDir, "git"), `#!/bin/sh\ncat "${dataPath}"\n`, { mode: 0o755 });
  withPath(binDir, () => {
    try {
      execFileSync("git", ["worktree", "list", "--porcelain"], {
        cwd: os.tmpdir(),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      // Warm-up only — content/exit-code irrelevant, this call exists solely
      // to pay the first-exec cost before any test's own timing assertion.
    }
  });
  return binDir;
}

/** A real, executable `git` with arbitrary shell behavior (hang, error exit,
 *  etc.) — for scenarios `fakeGitCat` can't express. */
function makeFakeGitBin(scriptBody) {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "e132-fakegit-"));
  fs.writeFileSync(path.join(binDir, "git"), scriptBody, { mode: 0o755 });
  return binDir;
}

function buildPorcelain(blocks, trailingNewline = true) {
  const text = blocks
    .map((b) => {
      const lines = [`worktree ${b.worktree}`, `HEAD ${b.head ?? "0".repeat(40)}`];
      if (b.detached) lines.push("detached");
      else if (b.branch) lines.push(`branch refs/heads/${b.branch}`);
      return lines.join("\n");
    })
    .join("\n\n");
  return trailingNewline ? text + "\n" : text;
}

/** Prepends binDir onto PATH for the duration of `fn` (in-process calls that
 *  shell out via child_process internally always resolve `git` against
 *  `process.env.PATH` when no explicit `env` override is passed). */
function withPath(binDir, fn) {
  const orig = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${orig}`;
  try {
    return fn();
  } finally {
    process.env.PATH = orig;
  }
}

// getLaneFeatureHistory scans live .current/<lane>/handoff.md plus closed .current/history/<YYYY-MM>/<lane>/handoff.md (e123b9 J2, spec AC7);
// it no longer reads .current/archive/. Closed-lane fixtures are built directly, as the spec's proof text prescribes
// (one live lane + two closed lanes across two history buckets).
function writeHistoryLaneFixture(ws, yyyymm, lane, activeFeature, lastUpdated = "2026-01-01T00:00:00.000Z") {
  const dir = path.join(ws, ".current", "history", yyyymm, lane);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "handoff.md"),
    `---\nactive_feature: "${activeFeature}"\nstatus: "In_Progress"\nlast_updated: "${lastUpdated}"\n---\n## Completed\n- (none)\n`,
  );
}

function snapshotMtimesRecursive(root) {
  const map = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else map.set(p, fs.statSync(p).mtimeMs);
    }
  };
  walk(root);
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// ============================================================================
// AC1 — laneRegistryList is read-only
// ============================================================================

test("AC1: laneRegistryList performs zero filesystem writes anywhere under any worktree (mtime-snapshot proof, verified by execution)", async () => {
  const wsA = mkWs();
  await write(wsA, { activeFeature: "lane-a", hopCount: 1 });
  const wsB = mkWs();
  await write(wsB, { activeFeature: "lane-b", hopCount: 2 });

  const binDir = fakeGitCat(
    buildPorcelain([
      { worktree: wsA, branch: "main" },
      { worktree: wsB, branch: "feature-x" },
    ]),
  );

  const before = [
    ...snapshotMtimesRecursive(path.join(wsA, ".current")),
    ...snapshotMtimesRecursive(path.join(wsB, ".current")),
  ];

  const result = withPath(binDir, () => laneRegistryList(process.cwd()));

  const after = [
    ...snapshotMtimesRecursive(path.join(wsA, ".current")),
    ...snapshotMtimesRecursive(path.join(wsB, ".current")),
  ];

  assert.deepEqual(after, before, "no path's mtime may change, and no new/removed path is permitted, across the call");
  assert.equal(result.source, "lane-registry");
  assert.equal(result.lanes.length, 2, "one lane entry per worktree found by git worktree list --porcelain");
});

// ============================================================================
// AC2 — LaneListProvider conformance + scripts/feature-rollup.mjs actually
// consumes it (not just imports it)
// ============================================================================

test("AC2: laneRegistryList returns source:\"lane-registry\", AND scripts/feature-rollup.mjs's output proves IT (not localFallbackLaneList) supplied the provider", async () => {
  const wsMatch = mkWs();
  await write(wsMatch, { activeFeature: "e132-ac2-feature", hopCount: 1, completedTasks: ["T-1"] });

  // A lane that PREVIOUSLY worked e132-ac2-feature but has since moved on.
  // featureHistory no longer comes from the old flat-era .current/archive/
  // directory (that signal is gone by design and is no longer read at all); it
  // comes from .current/history/<YYYY-MM>/<lane>/handoff.md, whose population
  // (the lane-close move) is a later ticket's job — so the fixture constructs
  // that closed-lane snapshot directly, as the spec's proof text prescribes
  // (e123b9 J2, AC7).
  const wsMovedOn = mkWs();
  writeHistoryLaneFixture(wsMovedOn, "2026-01", "_primary", "e132-ac2-feature", "2026-01-01T00:00:00.000Z");
  await write(wsMovedOn, { activeFeature: "some-other-feature", hopCount: 1 });

  const binDir = fakeGitCat(
    buildPorcelain([
      { worktree: wsMatch, branch: "main" },
      { worktree: wsMovedOn, branch: "later" },
    ]),
  );

  // Direct proof point (per the dispatch brief's own steer): source on the
  // LaneListResult from laneRegistryList itself.
  const direct = withPath(binDir, () => laneRegistryList(process.cwd()));
  assert.equal(direct.source, "lane-registry");
  const movedOnLane = direct.lanes.find((l) => l.workspacePath === wsMovedOn);
  assert.ok(movedOnLane, "moved-on lane must still be present");
  assert.ok(
    Array.isArray(movedOnLane.featureHistory) && movedOnLane.featureHistory.includes("e132-ac2-feature"),
    "laneRegistryList must attach featureHistory recovered from the real archive",
  );

  // Behavioral "actually consuming it" proof: run the REAL script as a child
  // process. localFallbackLaneList (the OTHER provider) NEVER populates
  // featureHistory (tools/feature-rollup.ts's own design comment) — so the
  // historical-only-match note line can only appear in this script's output
  // if it truly wired laneRegistryList as its provider, not merely imported
  // it unused. renderRollupReport never prints `source` directly, so this is
  // the correct proof point (per the dispatch brief's own note).
  const scriptPath = path.join(PROJECT_ROOT, "scripts", "feature-rollup.mjs");
  const stdout = execFileSync(process.execPath, [scriptPath, "e132-ac2-feature", process.cwd()], {
    encoding: "utf-8",
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
  });

  assert.match(
    stdout,
    /previously worked "e132-ac2-feature" per featureHistory/,
    "the historical-only-match note line proves the script's computeFeatureRollup call was fed laneRegistryList, not the default provider",
  );
});

// ============================================================================
// AC3 — wired into tw_get_state, non-blocking, byte-identical when absent
// ============================================================================

test("AC3: lane_registry is ABSENT and the payload is byte-identical whether git is truly absent or explicitly unavailable (verified via readHandoffState() executed directly, per the crash-resume brief)", async () => {
  const ws = mkWs();
  await write(ws, { activeFeature: "solo-feature", hopCount: 0 });

  // Case 1: the natural, unmodified "nothing to report" case — ws is a
  // plain temp dir with no git ancestry at all.
  const naturalJson = readHandoffState(ws);
  const natural = JSON.parse(naturalJson);
  assert.equal("lane_registry" in natural, false);

  // Case 2: "git is unavailable" — the spec's own wording — simulated via a fake
  // git that always errors loudly. Byte-identical output to Case 1 is the
  // spec's literal proof: both routes converge on "nothing to report." (AC3)
  const binDir = makeFakeGitBin("#!/bin/sh\necho 'fatal: not a git repository' 1>&2\nexit 128\n");
  const unavailableJson = withPath(binDir, () => readHandoffState(ws));

  assert.equal(
    unavailableJson,
    naturalJson,
    "byte-identical payload whether git is truly absent or explicitly errors — no lane_registry key either way",
  );
});

test("AC3: lane_registry key is PRESENT and shaped per LaneRegistryAdvisory when 2+ worktrees exist (verified via readHandoffState() executed directly)", async () => {
  const wsA = mkWs();
  await write(wsA, { activeFeature: "fanout-a", lastAgent: "pm" });
  const wsB = mkWs();
  await write(wsB, { activeFeature: "fanout-b", lastAgent: "sr-engineer" });

  const binDir = fakeGitCat(
    buildPorcelain([
      { worktree: wsA, branch: "main" },
      { worktree: wsB, branch: "feature-b" },
    ]),
  );

  const parsed = withPath(binDir, () => JSON.parse(readHandoffState(wsA)));

  assert.ok(parsed.lane_registry, "lane_registry key must be present");
  assert.equal(typeof parsed.lane_registry.degraded, "boolean");
  assert.ok(Array.isArray(parsed.lane_registry.lanes));
  assert.equal(parsed.lane_registry.lanes.length, 2);
  for (const lane of parsed.lane_registry.lanes) {
    assert.ok("workspace_path" in lane);
    assert.ok("active_feature" in lane);
    assert.ok("status" in lane);
    assert.ok("last_agent" in lane);
  }
  const laneA = parsed.lane_registry.lanes.find((l) => l.workspace_path === wsA);
  assert.equal(laneA.active_feature, "fanout-a");
  assert.equal(laneA.last_agent, "pm");
});

// gap-7: both readHandoffState() returns (exists:false early return AND the
// exists:true final return) must spread lane_registry the same way — the
// early-return spread is the easy one to regress per code-reviewer round 2.
test("gap-7: both readHandoffState() returns spread lane_registry — the exists:false early return AND the exists:true final return", async () => {
  const freshWs = mkWs(); // .current/ exists, but no handoff.md ever written
  const existingWs = mkWs();
  await write(existingWs, { activeFeature: "existing-feature" });

  const binDir = fakeGitCat(
    buildPorcelain([
      { worktree: freshWs, branch: "main" },
      { worktree: existingWs, branch: "main" },
    ]),
  );

  const freshParsed = withPath(binDir, () => JSON.parse(readHandoffState(freshWs)));
  const existingParsed = withPath(binDir, () => JSON.parse(readHandoffState(existingWs)));

  assert.equal(freshParsed.exists, false, "early-return branch: no .current/handoff.md yet");
  assert.ok(freshParsed.lane_registry, "the early-return spread must also carry lane_registry, not just the final return");
  assert.equal(freshParsed.lane_registry.lanes.length, 2);

  assert.equal(existingParsed.exists, true);
  assert.ok(existingParsed.lane_registry);
  assert.equal(existingParsed.lane_registry.lanes.length, 2);
});

// ============================================================================
// AC4 — cost ceiling honored: never blocks, never throws
// ============================================================================

test("AC4: getLaneRegistrySummary never blocks or throws — returns null within the stated ceiling when git hangs (real subprocess, stubs nothing)", () => {
  const binDir = makeFakeGitBin("#!/bin/sh\nsleep 5\n");

  const started = Date.now();
  let result;
  let threw = false;
  try {
    result = withPath(binDir, () => getLaneRegistrySummary(process.cwd(), { timeoutMs: 100 }));
  } catch {
    threw = true;
  }
  const elapsed = Date.now() - started;

  assert.equal(threw, false, "must never throw even when the underlying subprocess hangs past the ceiling");
  assert.equal(result, null, "degrades to null (key omitted from tw_get_state) rather than a false alarm");
  assert.ok(elapsed < 2000, `expected to return well within the ceiling (git sleeps 5s), took ${elapsed}ms`);
});

// gap-6: the 200ms figure bounds only the git subprocess; the N per-lane parseHandoff reads on top are additive and not counted against it.
// Padded completedTasks + min-of-3 trials: tiny handoff files parse so fast that jitter alone flaked a bare 2-vs-25 comparison (~4/15 runs);
// padding makes each lane's parse heavy enough for an order-of-magnitude gap, and min-of-3 absorbs scheduling spikes. Only the fixture size changes.
test("gap-6: the ceiling bounds only the git subprocess — per-lane parseHandoff reads are additive on top of it (elapsed time scales with sibling-lane count, not flat)", async () => {
  const PADDING_TASKS = Array.from({ length: 8000 }, (_, i) => `T-PADDING-${i}`);

  async function buildLaneBlocks(n, tag) {
    const blocks = [];
    for (let i = 0; i < n; i++) {
      const ws = mkWs(`e132-lr-gap6-${tag}-`);
      await write(ws, { activeFeature: `gap6-${tag}-${i}`, hopCount: i, completedTasks: PADDING_TASKS });
      blocks.push({ worktree: ws, branch: `lane-${i}` });
    }
    return blocks;
  }

  const small = await buildLaneBlocks(2, "small");
  const large = await buildLaneBlocks(15, "large");

  const binSmall = fakeGitCat(buildPorcelain(small));
  const binLarge = fakeGitCat(buildPorcelain(large));

  function minElapsedOverTrials(binDir, trials = 3) {
    let minElapsed = Infinity;
    let lastResult = null;
    for (let i = 0; i < trials; i++) {
      const started = Date.now();
      lastResult = withPath(binDir, () => getLaneRegistrySummary(process.cwd(), { timeoutMs: 200 }));
      minElapsed = Math.min(minElapsed, Date.now() - started);
    }
    return { minElapsed, lastResult };
  }

  const { minElapsed: minSmall, lastResult: resultSmall } = minElapsedOverTrials(binSmall);
  const { minElapsed: minLarge, lastResult: resultLarge } = minElapsedOverTrials(binLarge);

  assert.ok(resultSmall && resultSmall.lanes.length === 2);
  assert.ok(resultLarge && resultLarge.lanes.length === 15);
  // Neither side's git subprocess ever hits the 200ms ceiling (no hang in
  // this fixture) — what differs is purely the N synchronous parseHandoff
  // reads, which is why the 15-lane read measurably outweighs the 2-lane
  // read: that additive cost sits OUTSIDE the 200ms figure by design (spec's
  // own "riding on top of it, additive and unbounded by the 200ms figure").
  assert.ok(
    minLarge > minSmall,
    `expected the 15-lane read (min ${minLarge}ms over 3 trials) to take longer than the 2-lane read (min ${minSmall}ms) — if reads were bounded by timeoutMs, elapsed would stay flat`,
  );
});

// gap-4 (sharpest): getLaneRegistrySummary must SKIP the lane-history scan entirely; that is the whole reason for a second entry point
// beside laneRegistryList. Proven behaviourally (real sentinel + timing contrast), never by source-text inspection. The sentinel is a large
// .current/history/<YYYY-MM>/ bucket of closed-lane subdirectories (e123b9 J2, spec AC7), the new expensive-to-scan target.
test("gap-4 (sharpest): getLaneRegistrySummary skips the lane-history scan entirely — laneRegistryList (the OTHER entry point) does not", async () => {
  const wsPlain = mkWs();
  await write(wsPlain, { activeFeature: "gap4-plain", hopCount: 1 });

  const wsSentinel = mkWs();
  await write(wsSentinel, { activeFeature: "gap4-sentinel", hopCount: 1 });

  // Plant a LARGE, real, parseable history bucket as the sentinel (a real fixture; mock.method cannot intercept fs from compiled ESM). A history scan
  // would grow wall-clock with subdir count, as laneRegistryList's does below; getLaneRegistrySummary must not.
  // 3000 subdirs, not 1500: 1500 gave margins as tight as ~2.5x (page cache makes fresh buckets fast to scan) and flaked; 3000 gave 9-14x.
  const SENTINEL_FILE_COUNT = 3000;
  for (let i = 0; i < SENTINEL_FILE_COUNT; i++) {
    writeHistoryLaneFixture(wsSentinel, "2026-01", `lane-${i}`, `gap4-sentinel-history-${i}`);
  }

  const binDir = fakeGitCat(
    buildPorcelain([
      { worktree: wsPlain, branch: "main" },
      { worktree: wsSentinel, branch: "later" },
    ]),
  );

  // Control: laneRegistryList DOES scan lane-history buckets — confirm the
  // sentinel is "live" (would be observed if scanned) and costs real,
  // measurable time.
  const laneRegistryStarted = Date.now();
  const laneRegistryResult = withPath(binDir, () => laneRegistryList(process.cwd()));
  const laneRegistryElapsed = Date.now() - laneRegistryStarted;
  const sentinelLane = laneRegistryResult.lanes.find((l) => l.workspacePath === wsSentinel);
  assert.equal(
    sentinelLane.featureHistory.length,
    // +1: the sentinel's own LIVE lane ("gap4-sentinel") is now also part of
    // the combined featureHistory list (live and closed lanes merge into one, AC7).
    SENTINEL_FILE_COUNT + 1,
    "sanity: the sentinel history bucket is real and IS observed by laneRegistryList",
  );

  // Subject: getLaneRegistrySummary must return near-instantly regardless of
  // the sentinel's size — it must never even open that directory.
  const summaryStarted = Date.now();
  const summaryResult = withPath(binDir, () => getLaneRegistrySummary(process.cwd(), { timeoutMs: 200 }));
  const summaryElapsed = Date.now() - summaryStarted;

  assert.ok(summaryResult && summaryResult.lanes.length === 2);
  assert.ok(
    summaryElapsed < laneRegistryElapsed / 3,
    `getLaneRegistrySummary (${summaryElapsed}ms) should be dramatically faster than laneRegistryList (${laneRegistryElapsed}ms) scanning the same ${SENTINEL_FILE_COUNT}-file sentinel archive — comparable timing would mean the archive was scanned`,
  );
  // Belt-and-braces absolute bound: even accounting for CI slowness, a
  // 1500-file readdirSync+statSync+readFileSync+yaml.load pass cannot
  // plausibly complete this fast if actually performed.
  assert.ok(summaryElapsed < 250, `expected near-instant return, took ${summaryElapsed}ms`);
});

// ============================================================================
// AC7 — degrade-honestly for getLaneFeatureHistory
// ============================================================================

test("AC7: getLaneFeatureHistory returns featureHistory:null (NOT []) when .current/archive/ does not exist, and never throws", () => {
  const ws = mkWs(); // .current/ exists (mkWs creates it); no archive/ subdir
  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(result, { featureHistory: null });
});

test("AC7: getLaneFeatureHistory skips a malformed closed-lane file and returns the valid file's active_feature — never crashes, never falsely collapses to []", () => {
  // The malformed-sibling source is now a closed-lane history bucket entry, not
  // a .current/archive/ file (that flat-era signal is gone by design and is no
  // longer read at all; e123b9 J2, AC7). No live lane is seeded here, so the
  // result set is exactly the two history entries constructed below —
  // isolating the skip-malformed behavior cleanly.
  const ws = mkWs();
  writeHistoryLaneFixture(ws, "2026-01", "gap7-valid-lane", "gap7-old", "2026-01-01T00:00:00.000Z");

  // Plant a malformed sibling (different lane, same bucket) with NO
  // frontmatter at all.
  const malformedDir = path.join(ws, ".current", "history", "2026-01", "gap7-malformed-lane");
  fs.mkdirSync(malformedDir, { recursive: true });
  fs.writeFileSync(path.join(malformedDir, "handoff.md"), "not a valid handoff file, no frontmatter here\n");

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(
    result.featureHistory,
    ["gap7-old"],
    "malformed file skipped silently; the one valid file's active_feature is recovered — never a crash, never a silent false-empty result",
  );
});

// ============================================================================
// Feature-history ordering: by last_updated (never filesystem mtime),
// including the missing/unparseable-last-sorts-last and lane-name-tiebreak
// rules, and the null / [] contract's own cases (T-E123B9-05 (i), AC7).
// ============================================================================

function writeLiveLaneFixture(ws, lane, activeFeature, frontmatterExtra = "") {
  const dir = path.join(ws, ".current", lane);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "handoff.md"),
    `---\nactive_feature: "${activeFeature}"\nstatus: "In_Progress"\n${frontmatterExtra}---\n## Completed\n- (none)\n`,
  );
}

test("AC7-ORDER: one live lane + two closed lanes across two YYYY-MM history buckets order by each entry's OWN last_updated, oldest first — NOT filesystem mtime (every fixture file is forced to the SAME mtime), a missing-last_updated entry sorts last, and two entries tied on last_updated break by lane name ascending", () => {
  const ws = mkWs();

  // Oldest: a closed lane in bucket 2026-01.
  writeHistoryLaneFixture(ws, "2026-01", "hc-old", "order-hc-old", "2026-01-01T00:00:00.000Z");
  // Second: a LIVE lane.
  writeLiveLaneFixture(ws, "lv", "order-lv", 'last_updated: "2026-01-15T00:00:00.000Z"\n');
  // Third: a closed lane in a DIFFERENT bucket, 2026-03.
  writeHistoryLaneFixture(ws, "2026-03", "hc-new", "order-hc-new", "2026-03-01T00:00:00.000Z");
  // Fourth+fifth: tied on last_updated — lane name breaks the tie ascending.
  writeHistoryLaneFixture(ws, "2026-04", "zz-tie", "order-zz-tie", "2026-04-01T00:00:00.000Z");
  writeHistoryLaneFixture(ws, "2026-04", "aa-tie", "order-aa-tie", "2026-04-01T00:00:00.000Z");
  // Sixth: missing last_updated entirely — must sort LAST regardless of
  // every other entry's timestamp.
  writeLiveLaneFixture(ws, "no-ts", "order-no-ts"); // no last_updated line at all

  // Force every fixture file's mtime IDENTICAL (a fixed instant, deliberately
  // far from any last_updated value above) — a checkout gives every file the
  // same mtime, and this proves mtime is genuinely not consulted: if it
  // were, this fixture would produce an arbitrary/unstable order instead of
  // the deterministic last_updated-derived one asserted below.
  const fixedMtime = new Date("2020-06-15T00:00:00.000Z");
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else fs.utimesSync(p, fixedMtime, fixedMtime);
    }
  };
  walk(path.join(ws, ".current"));

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(
    result.featureHistory,
    ["order-hc-old", "order-lv", "order-hc-new", "order-aa-tie", "order-zz-tie", "order-no-ts"],
    `expected last_updated-ordered (oldest first), tie broken by lane name, missing-last sorted last — got ${JSON.stringify(result.featureHistory)}`,
  );
});

test("AC7-NULL1: zero lane dirs AND no .current/history/ directory at all -> null", () => {
  const ws = mkWs(); // .current/ exists (mkWs creates it), nothing else
  assert.deepEqual(getLaneFeatureHistory(ws), { featureHistory: null });
});

test("AC7-EMPTY1: a .current/history/ directory that EXISTS but contains no parseable entry -> [] (a place for history exists, nothing readable came out of it)", () => {
  const ws = mkWs();
  fs.mkdirSync(path.join(ws, ".current", "history"), { recursive: true }); // present, empty
  assert.deepEqual(getLaneFeatureHistory(ws), { featureHistory: [] });
});

test("AC7-FLATARCHIVE1 (e123b9 J2 — REDEFINED): a flat .current/archive/*.md-only fixture (no lane dirs, no .current/history/) now returns null — the flat-era signal is gone by design, this function no longer reads that directory at all", () => {
  const ws = mkWs();
  const archiveDir = path.join(ws, ".current", "archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(
    path.join(archiveDir, "old-style-archive-entry.md"),
    '---\nactive_feature: "flat-era-feature"\nstatus: "In_Progress"\nlast_updated: "2026-01-01T00:00:00.000Z"\n---\n',
  );
  assert.deepEqual(
    getLaneFeatureHistory(ws),
    { featureHistory: null },
    "a flat-archive-only workspace must read as null — AC7 no longer treats .current/archive/'s presence as a history signal",
  );
});

// =============================================================================
// getLaneFeatureHistory also merges each lane dir's metrics.jsonl {feature, ts} rows (readMetricsEntries), recovering a long-lived lane's
// (e.g. _primary) shipped predecessors that active_feature overwrote in place (e125b spec AC5, J2-NEW-4). Placed in this file because the
// extension file the ticket named does not exist and the existing coverage lives here.
// =============================================================================

function writeMetricsFixture(ws, lane, rows) {
  const dir = path.join(ws, ".current", lane);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "metrics.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

test('AC5 (e125b): in-place active_feature change preserves a shipped predecessor via metrics.jsonl — _primary\'s handoff.md names the CURRENT feature only, but a release-engineer shipped close left one metrics.jsonl row for the predecessor, and getLaneFeatureHistory recovers both, oldest first', () => {
  const ws = mkWs();
  // _primary changed active_feature IN PLACE — handoff.md only ever names the
  // current feature ("feat-b"); the earlier "feat-a" left no trace in
  // handoff.md at all (J2-NEW-4's exact gap).
  writeLiveLaneFixture(ws, "_primary", "feat-b", 'last_updated: "2026-03-01T00:00:00.000Z"\n');
  // The release-engineer shipped close for feat-a (emitFeatureMetrics's call
  // site) left this durable row BEFORE feat-b started.
  writeMetricsFixture(ws, "_primary", [{ feature: "feat-a", ts: "2026-01-01T00:00:00.000Z" }]);

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(
    result.featureHistory,
    ["feat-a", "feat-b"],
    "feat-a (recovered from metrics.jsonl, earlier ts) must precede feat-b (from handoff.md, later ts) — J2-NEW-4 closed",
  );
});

test("AC5 (e125b): within ONE lane dir, the handoff entry wins over a metrics.jsonl row for the SAME feature — no duplicate entry", () => {
  const ws = mkWs();
  writeLiveLaneFixture(ws, "_primary", "feat-current", 'last_updated: "2026-03-01T00:00:00.000Z"\n');
  // A metrics row for the SAME feature the handoff already names (e.g. the
  // shipped-close metrics write for the feature that is still active) must
  // not produce a second, duplicate entry.
  writeMetricsFixture(ws, "_primary", [{ feature: "feat-current", ts: "2026-01-01T00:00:00.000Z" }]);

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(result.featureHistory, ["feat-current"], "the handoff entry must win; the metrics row for the same feature must not duplicate it");
});

test("AC5 (e125b): repeated metrics.jsonl rows for the SAME feature (e.g. two released_version values) collapse to the EARLIEST ts, not one row per line", () => {
  const ws = mkWs();
  writeLiveLaneFixture(ws, "_primary", "feat-current", 'last_updated: "2026-05-01T00:00:00.000Z"\n');
  writeMetricsFixture(ws, "_primary", [
    { feature: "feat-a", ts: "2026-02-01T00:00:00.000Z" },
    { feature: "feat-a", ts: "2026-01-01T00:00:00.000Z" }, // earlier — must win
  ]);

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(result.featureHistory, ["feat-a", "feat-current"]);
});

test("AC5 (e125b): a blank line and a malformed JSON line in metrics.jsonl are skipped silently — never throws, the valid row is still recovered", () => {
  const ws = mkWs();
  writeLiveLaneFixture(ws, "_primary", "feat-current", 'last_updated: "2026-03-01T00:00:00.000Z"\n');
  const dir = path.join(ws, ".current", "_primary");
  fs.writeFileSync(
    path.join(dir, "metrics.jsonl"),
    '\n{"feature":"feat-a","ts":"2026-01-01T00:00:00.000Z"}\nnot valid json at all\n{"no_feature_field":true}\n',
  );

  assert.doesNotThrow(() => getLaneFeatureHistory(ws));
  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(result.featureHistory, ["feat-a", "feat-current"]);
});

test("AC5 (e125b): a live lane with a metrics.jsonl but NO handoff.md still contributes its metrics-recovered feature(s) — metrics alone is a valid candidate source", () => {
  const ws = mkWs();
  writeMetricsFixture(ws, "solo-metrics-lane", [{ feature: "solo-feature", ts: "2026-01-01T00:00:00.000Z" }]);

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(result.featureHistory, ["solo-feature"]);
});

test("AC5 (e125b): a CLOSED lane's history-bucket metrics.jsonl is merged the same way as a live lane's — recovery applies to both live and closed lane dirs", () => {
  const ws = mkWs();
  const histDir = path.join(ws, ".current", "history", "2026-01", "closed-lane");
  fs.mkdirSync(histDir, { recursive: true });
  fs.writeFileSync(
    path.join(histDir, "handoff.md"),
    '---\nactive_feature: "closed-feature-b"\nstatus: "In_Progress"\nlast_updated: "2026-01-15T00:00:00.000Z"\n---\n',
  );
  fs.writeFileSync(path.join(histDir, "metrics.jsonl"), '{"feature":"closed-feature-a","ts":"2026-01-01T00:00:00.000Z"}\n');

  const result = getLaneFeatureHistory(ws);
  assert.deepEqual(result.featureHistory, ["closed-feature-a", "closed-feature-b"]);
});

// ============================================================================
// AC8 — no writable state introduced
// ============================================================================

test("AC8: tools/lane-registry.ts performs no fs writes — no call to fs.write*/append*/mkdir*", () => {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "lane-registry.ts"), "utf-8");
  assert.doesNotMatch(
    source,
    /fs\.(write|append|mkdir)/,
    "tools/lane-registry.ts must contain zero write/append/mkdir calls — no registry file, no lockfile, no heartbeat (AC8)",
  );
});

// ============================================================================
// AC9 — build + boot safety for the new three-module import cycle
// ============================================================================
// `npm run build` exit 0 is verified in QA's Phase 4 gate, not re-run here; this covers the boot-smoke half of AC9 (a TDZ/circular-import failure surfaces at boot, not in unit tests).

test("AC9: dist/index.js boots cleanly with the new lane-registry import cycle — \"online\" appears on stderr, no thrown error", async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(PROJECT_ROOT, "dist", "index.js")], {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderrBuf = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`boot smoke test timed out after 10s; stderr so far: ${stderrBuf}`));
    }, 10_000);

    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString("utf-8");
      if (!settled && stderrBuf.includes("online")) {
        settled = true;
        clearTimeout(timer);
        child.kill();
        resolve();
      }
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`dist/index.js exited (code ${code}) before printing "online"; stderr: ${stderrBuf}`));
    });

    // Mirrors CLAUDE.md's documented boot smoke test: spawn, send initialize,
    // expect "online" on stderr.
    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "e132-boot-smoke", version: "0" },
        },
      }) + "\n",
    );
  });
});

// Coded by @qa-engineer
// Tests for tools/feature-rollup.ts, the per-feature hop and ticket roll-up across lanes
// (specs/e113-feature-level-rollup.md, AC2-AC5). The most important case is the cross-feature
// regression: only lanes whose active feature is the requested one may be summed.
// Lanes meant to stay `readable: true` are backed by real temp workspaces, because the roll-up
// re-reads each lane's handoff and downgrades a provider's `readable` claim when none exists.
// Rationale: specs/e260g-comment-rationale.md (test/feature-rollup.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeFeatureRollup,
  renderRollupReport,
  localFallbackLaneList,
} from "../dist/tools/feature-rollup.js";
import { HOP_CAP_EXPORTED } from "../dist/tools/transitions.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const FEATURE_ROLLUP_SOURCE = fs.readFileSync(
  path.join(ROOT, "tools", "feature-rollup.ts"),
  "utf-8",
);

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Creates a REAL workspace with a REAL, parseable .current/handoff.md — so a
// LaneInfo pointing at it survives computeFeatureRollup's second-level
// parseHandoff() call and lands in the report as `readable: true` (see file
// header WHY note).
async function mkRealLane({ activeFeature, hopCount, completedTasks = [] }) {
  const ws = mkWorkspace();
  resetSession();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature,
    status: "In_Progress",
    completedTasks,
    pendingNotes: [],
    hopCount,
    lastAgent: "sr-engineer",
  });
  return ws;
}

/** Build a LaneListProvider that returns exactly the given LaneInfo array. */
function providerFor(lanes, opts = {}) {
  return (_repoRoot) => ({
    source: opts.source ?? "local-fallback",
    lanes,
    degraded: opts.degraded ?? false,
    ...(opts.degradedReason ? { degradedReason: opts.degradedReason } : {}),
  });
}

// ---------- AC2: seam marker + LaneListProvider shape ----------

test("AC2: SEAM FOR E132 marker is present in tools/feature-rollup.ts", () => {
  // WHY: this is the documented injection point (spec Design section) — the
  // literal marker is what future E132 tooling / a human diffing this file
  // greps for; losing the comment silently loses the documented contract.
  assert.match(FEATURE_ROLLUP_SOURCE, /SEAM FOR E132/);
});

test("AC2: localFallbackLaneList is exported and is the documented default provider", () => {
  assert.equal(typeof localFallbackLaneList, "function");
  assert.equal(typeof computeFeatureRollup, "function");
  assert.equal(typeof renderRollupReport, "function");
});

test("AC2: a substitute LaneListProvider works with the SAME computeFeatureRollup call site (zero call-site change)", async () => {
  // WHY: AC2's entire point is that the tools/lane-registry.ts provider can
  // be dropped in by swapping only the `laneListProvider` value passed in
  // `opts` — computeFeatureRollup's own signature and call shape must not
  // need to change. Prove it by calling the exact same function, with the
  // exact same option shape, against two unrelated custom providers (one
  // labelled "local-fallback", one labelled "lane-registry" like the real
  // registry provider) and confirming both are honored identically. (E132)
  const ws = await mkRealLane({ activeFeature: "seam-feature", hopCount: 2 });

  const laneInfo = {
    workspacePath: ws,
    activeFeature: "seam-feature",
    status: "In_Progress",
    hopCount: 2,
    lastAgent: "sr-engineer",
    lastUpdated: new Date().toISOString(),
    readable: true,
  };

  const localFallbackShaped = providerFor([laneInfo], { source: "local-fallback" });
  const laneRegistryShaped = providerFor([laneInfo], { source: "lane-registry" });

  const reportA = computeFeatureRollup("seam-feature", { laneListProvider: localFallbackShaped });
  const reportB = computeFeatureRollup("seam-feature", { laneListProvider: laneRegistryShaped });

  assert.equal(reportA.totals.hopCount, 2);
  assert.equal(reportB.totals.hopCount, 2);
  assert.deepEqual(reportA.totals, reportB.totals);
  assert.deepEqual(reportA.capComparison, reportB.capComparison);
});

// ---------- AC3: multi-lane summation against HOP_CAP_EXPORTED ----------

test("AC3: sums matching lanes' hop_count and compares against the imported HOP_CAP_EXPORTED, never a bare 10", async () => {
  // WHY: the spec requires the cap to be imported from tools/transitions.ts,
  // never hardcoded — this test itself never spells out the cap as a literal
  // either, so a future change to HOP_CAP_EXPORTED's value cannot silently
  // desync this assertion from the module under test.
  assert.equal(typeof HOP_CAP_EXPORTED, "number");

  const hopA = HOP_CAP_EXPORTED - 3;
  const hopB = 5;
  const wsA = await mkRealLane({ activeFeature: "cap-feature", hopCount: hopA, completedTasks: ["T-1"] });
  const wsB = await mkRealLane({ activeFeature: "cap-feature", hopCount: hopB, completedTasks: ["T-2", "T-3"] });

  const provider = providerFor([
    { workspacePath: wsA, activeFeature: "cap-feature", status: "In_Progress", hopCount: hopA, lastAgent: null, lastUpdated: null, readable: true },
    { workspacePath: wsB, activeFeature: "cap-feature", status: "In_Progress", hopCount: hopB, lastAgent: null, lastUpdated: null, readable: true },
  ]);

  const report = computeFeatureRollup("cap-feature", { laneListProvider: provider });

  assert.equal(report.totals.hopCount, hopA + hopB);
  assert.equal(report.totals.ticketCount, 3);
  assert.equal(report.capComparison.hopCap, HOP_CAP_EXPORTED);
  assert.equal(report.capComparison.totalHop, hopA + hopB);
  assert.equal(report.capComparison.overCapBy, Math.max(0, hopA + hopB - HOP_CAP_EXPORTED));
  assert.ok(report.capComparison.overCapBy > 0, "fixture is constructed to land over cap");
});

// ---------- Round-1 regression: cross-feature lanes must never enter totals ----------

test("round-1 regression PIN: lanes belonging to OTHER features never enter totals/capComparison (healthy no-banner path)", async () => {
  // WHY: the most important case in this file. The shipped round-1 defect summed every lane in the
  // repo regardless of feature (observed live as `hop: 54, OVER BY 44` for a feature whose true
  // total was 3, with `degraded: false`). This fixture reproduces it at small scale: one matching
  // lane at hopCount 4 plus two lanes of OTHER features at hopCount 99 each.
  const wsMatch = await mkRealLane({ activeFeature: "rollup-target", hopCount: 4, completedTasks: ["T-1"] });
  const wsOther1 = await mkRealLane({ activeFeature: "unrelated-feature-1", hopCount: 99 });
  const wsOther2 = await mkRealLane({ activeFeature: "unrelated-feature-2", hopCount: 99 });

  const provider = providerFor([
    { workspacePath: wsMatch, activeFeature: "rollup-target", status: "In_Progress", hopCount: 4, lastAgent: null, lastUpdated: null, readable: true },
    { workspacePath: wsOther1, activeFeature: "unrelated-feature-1", status: "In_Progress", hopCount: 99, lastAgent: null, lastUpdated: null, readable: true },
    { workspacePath: wsOther2, activeFeature: "unrelated-feature-2", status: "PASS", hopCount: 99, lastAgent: null, lastUpdated: null, readable: true },
  ]);

  const report = computeFeatureRollup("rollup-target", { laneListProvider: provider });

  // The pinned values from the dispatch brief, verbatim.
  assert.equal(report.totals.hopCount, 4);
  assert.equal(report.capComparison.overCapBy, 0);
  assert.equal(report.capComparison.anySingleLaneReportsOverCap, false);

  // This is the "healthy" path: every lane parsed cleanly and one lane
  // matched, so nothing should be degraded and no banner should print — the
  // round-1 defect's defining property was that this exact path produced a
  // confident, unbannered wrong number.
  assert.equal(report.degraded, false);
  assert.equal(report.degradedReason, undefined);

  // All three lanes still appear in the report for a human to see (AC4-style
  // visibility) — the fix must not achieve correctness by dropping rows.
  assert.equal(report.lanes.length, 3);

  const rendered = renderRollupReport(report);
  const lines = rendered.split("\n");
  assert.notEqual(lines[0], "ROLL-UP INCOMPLETE", "no banner on the healthy matching-lane path");
  assert.ok(!rendered.startsWith("ROLL-UP INCOMPLETE"));
  assert.match(rendered, /Totals — hop: 4 \(cap/);
  assert.doesNotMatch(rendered, /Totals — hop: 202/, "must never print the whole-repo (4+99+99) sum");
});

// ---------- AC4: unreadable lanes carried, never dropped, never zero-filled ----------

test("AC4: an unreadable lane is carried with readable:false / hopCount:null (never dropped, never zero-filled), and degrades the report", async () => {
  const wsMatch = await mkRealLane({ activeFeature: "unread-feature", hopCount: 4, completedTasks: ["T-1"] });

  // Synthesized directly (no real workspace behind it) — mirrors exactly what
  // localFallbackLaneList itself produces for a lane whose handoff could not
  // be found/parsed (tools/feature-rollup.ts:117-127): activeFeature/status/
  // hopCount all null, readable: false, an `error` string carried for humans.
  const unreadableLane = {
    workspacePath: path.join(os.tmpdir(), "twfr-does-not-exist"),
    activeFeature: null,
    status: null,
    hopCount: null,
    lastAgent: null,
    lastUpdated: null,
    readable: false,
    error: "no .current/handoff.md found for this worktree",
  };

  const provider = providerFor([
    { workspacePath: wsMatch, activeFeature: "unread-feature", status: "In_Progress", hopCount: 4, lastAgent: null, lastUpdated: null, readable: true },
    unreadableLane,
  ]);

  const report = computeFeatureRollup("unread-feature", { laneListProvider: provider });

  // Never dropped: still present in the report.
  assert.equal(report.lanes.length, 2);
  const carried = report.lanes.find((l) => l.workspacePath === unreadableLane.workspacePath);
  assert.ok(carried, "unreadable lane must still appear in report.lanes");

  // Never zero-filled: hopCount stays null, not coerced to 0.
  assert.equal(carried.hopCount, null);
  assert.equal(carried.readable, false);

  // The matching readable lane's hop_count is unaffected by the unreadable
  // sibling — the sum reflects only the attributable, readable lane.
  assert.equal(report.totals.hopCount, 4);

  // Always degraded when any lane is unreadable.
  assert.equal(report.degraded, true);
  assert.ok(report.degradedReason && report.degradedReason.length > 0);

  const rendered = renderRollupReport(report);
  assert.ok(rendered.startsWith("ROLL-UP INCOMPLETE"));
});

test("AC4: an unreadable lane provided already-flagged unreadable by the provider is also carried, never dropped", async () => {
  // Same property, exercised via the OTHER unreadable branch
  // (tools/feature-rollup.ts's provider-level `!lane.readable` short-circuit
  // at :245, vs the second-level parseHandoff failure exercised above) —
  // both paths must carry, not drop.
  const provider = providerFor([
    {
      workspacePath: "/nonexistent/lane/path",
      activeFeature: "unread-feature-2",
      status: null,
      hopCount: null,
      lastAgent: null,
      lastUpdated: null,
      readable: false,
      error: "synthetic: provider itself reports unreadable",
    },
  ]);

  const report = computeFeatureRollup("unread-feature-2", { laneListProvider: provider });

  assert.equal(report.lanes.length, 1);
  assert.equal(report.lanes[0].readable, false);
  assert.equal(report.lanes[0].hopCount, null);
  assert.equal(report.degraded, true);
});

// ---------- AC5: ROLL-UP INCOMPLETE banner leads the output ----------

test("AC5: banner leads the output (line index 0) when zero lanes match the requested feature", async () => {
  // Round-2 attribution trigger #1: every lane is readable, but none belongs
  // to the requested feature. Nothing crashes, nothing is dropped, but the
  // surface must refuse to present a bare zero/undefined total as verified.
  const wsA = await mkRealLane({ activeFeature: "feature-a", hopCount: 3 });
  const wsB = await mkRealLane({ activeFeature: "feature-b", hopCount: 5 });

  const provider = providerFor([
    { workspacePath: wsA, activeFeature: "feature-a", status: "In_Progress", hopCount: 3, lastAgent: null, lastUpdated: null, readable: true },
    { workspacePath: wsB, activeFeature: "feature-b", status: "In_Progress", hopCount: 5, lastAgent: null, lastUpdated: null, readable: true },
  ]);

  const report = computeFeatureRollup("feature-z-nobody-matches", { laneListProvider: provider });

  assert.equal(report.degraded, true);
  assert.match(report.degradedReason ?? "", /no lane reports active_feature/);
  assert.equal(report.totals.hopCount, 0);

  const rendered = renderRollupReport(report);
  const lines = rendered.split("\n");
  assert.ok(lines[0].startsWith("ROLL-UP INCOMPLETE"), `expected banner at line 0, got: ${lines[0]}`);
  // Every lane must still be visible even though none matched (AC4-style
  // visibility carried into the attribution-degraded path).
  assert.match(rendered, /feature-a/);
  assert.match(rendered, /feature-b/);
});

test("AC5: banner leads the output (line index 0) when a readable lane has no active_feature recorded (unattributable)", async () => {
  // Round-2 attribution trigger #2: a readable lane whose `active_feature` is
  // null/unset cannot be attributed to any feature by this heuristic — that
  // uncertainty must degrade the report, not silently exclude the lane from
  // consideration while still claiming a clean/verified total.
  const wsMatch = await mkRealLane({ activeFeature: "attrib-feature", hopCount: 4 });
  const wsUnattributed = await mkRealLane({ activeFeature: "whatever-was-on-disk", hopCount: 7 });

  const provider = providerFor([
    { workspacePath: wsMatch, activeFeature: "attrib-feature", status: "In_Progress", hopCount: 4, lastAgent: null, lastUpdated: null, readable: true },
    // Provider declares this lane's active_feature as null/unset regardless
    // of what its own handoff happens to contain on disk — computeFeatureRollup
    // trusts the provider's activeFeature field for attribution, not a
    // re-derived value (only ticketsCompleted is re-read from disk).
    { workspacePath: wsUnattributed, activeFeature: null, status: "In_Progress", hopCount: 7, lastAgent: null, lastUpdated: null, readable: true },
  ]);

  const report = computeFeatureRollup("attrib-feature", { laneListProvider: provider });

  assert.equal(report.degraded, true);
  assert.match(report.degradedReason ?? "", /cannot be attributed/);

  const rendered = renderRollupReport(report);
  const lines = rendered.split("\n");
  assert.ok(lines[0].startsWith("ROLL-UP INCOMPLETE"), `expected banner at line 0, got: ${lines[0]}`);

  // The matching lane's own hop_count still contributes — attribution
  // uncertainty about ONE lane degrades the report but does not blank the
  // total for the lane that WAS attributed.
  assert.equal(report.totals.hopCount, 4);
});

test("AC5 (spec proof, literal): a real `git worktree list` failure (non-git directory) degrades localFallbackLaneList honestly, and computeFeatureRollup/renderRollupReport surface the banner", () => {
  // WHY: the spec's AC5 proof line forces a `git worktree list` failure and asserts the banner
  // appears with no bare numeric total. This test forces the real outright failure (a non-git
  // temp directory) through the DEFAULT provider via `repoRoot`; the other AC5 tests inject one.
  const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-nogit-"));

  const laneListResult = localFallbackLaneList(nonGitDir);
  assert.equal(laneListResult.degraded, true);
  assert.match(laneListResult.degradedReason ?? "", /git worktree list failed/);
  assert.deepEqual(laneListResult.lanes, []);

  const report = computeFeatureRollup("whatever-feature", { repoRoot: nonGitDir });
  assert.equal(report.degraded, true);

  const rendered = renderRollupReport(report);
  const lines = rendered.split("\n");
  assert.ok(lines[0].startsWith("ROLL-UP INCOMPLETE"), `expected banner at line 0, got: ${lines[0]}`);
  // No bare numeric "total" line before the banner (there IS no line before it).
  assert.equal(lines[0].indexOf("ROLL-UP INCOMPLETE"), 0);
});

test("AC5: no bare numeric total line prints without the banner across every degraded fixture in this file", async () => {
  // A direct check of the spec's own proof line ("no bare numeric 'total' line
  // appears without it") applied to both round-2 triggers together, forcing
  // BOTH a zero-match lane set AND an unreadable lane in the same run.
  const wsMatch = await mkRealLane({ activeFeature: "combo-feature", hopCount: 2 });

  const provider = providerFor([
    { workspacePath: "/nonexistent/combo/lane", activeFeature: null, status: null, hopCount: null, lastAgent: null, lastUpdated: null, readable: false, error: "synthetic" },
    { workspacePath: wsMatch, activeFeature: null, status: "In_Progress", hopCount: 2, lastAgent: null, lastUpdated: null, readable: true },
  ]);

  const report = computeFeatureRollup("combo-feature", { laneListProvider: provider });
  assert.equal(report.degraded, true);

  const rendered = renderRollupReport(report);
  const lines = rendered.split("\n");
  assert.ok(lines[0].startsWith("ROLL-UP INCOMPLETE"));

  // Find the first line that looks like a bare "Totals — ..." line and assert
  // the banner precedes it (index 0 always precedes any later line).
  const totalsIdx = lines.findIndex((l) => l.startsWith("Totals —"));
  assert.ok(totalsIdx > 0, "a Totals line should still be present, just preceded by the banner");
});

// Extension: the lane-registry spec's AC5/AC6 (specs/e132-lane-registry.md) and the coverage
// gaps a code review found, exercising localFallbackLaneList, computeFeatureRollup and
// renderRollupReport directly. Test names carry the AC and gap labels. Porcelain-shape tests
// put a small real `git` shim on PATH instead of mocking: see test/e132-lane-registry.test.mjs.

function fakeGitCat(content) {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-fakegit-"));
  const dataPath = path.join(binDir, "porcelain.txt");
  fs.writeFileSync(dataPath, content);
  fs.writeFileSync(path.join(binDir, "git"), `#!/bin/sh\ncat "${dataPath}"\n`, { mode: 0o755 });
  return binDir;
}

function withPath(binDir, fn) {
  const orig = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${orig}`;
  try {
    return fn();
  } finally {
    process.env.PATH = orig;
  }
}

// ---------- AC5: provider completedTasks preferred, N not 2N reads (E132 hand-forward 1/2) ----------

test("AC5 (E132): computeFeatureRollup prefers the provider's completedTasks over a second parseHandoff read — proven by deleting the on-disk handoff after the provider is built, so a stray re-read surfaces loudly instead of silently succeeding", async () => {
  // WHY this proof shape instead of a call-count spy: ESM named exports are not mockable in this
  // compiled output. Deleting the file the provider's workspacePath points at is sharper: a second
  // read (the 2N-reads defect) would find nothing (readable flips to false, ticketsCompleted
  // becomes []) instead of quietly recovering the provider's value, so a regression fails loudly.
  const ws = await mkRealLane({ activeFeature: "ac5-feature", hopCount: 3, completedTasks: ["ON-DISK-1", "ON-DISK-2"] });

  const provider = providerFor([
    {
      workspacePath: ws,
      activeFeature: "ac5-feature",
      status: "In_Progress",
      hopCount: 3,
      lastAgent: null,
      lastUpdated: null,
      readable: true,
      completedTasks: ["PROVIDER-1"],
    },
  ]);

  fs.rmSync(resolveCurrentLanePaths(ws).handoffPath);

  const report = computeFeatureRollup("ac5-feature", { laneListProvider: provider });

  assert.equal(report.lanes.length, 1);
  assert.equal(
    report.lanes[0].readable,
    true,
    "must stay readable — proves no second parseHandoff attempt was made against the now-deleted file",
  );
  assert.deepEqual(
    report.lanes[0].ticketsCompleted,
    ["PROVIDER-1"],
    "must use the provider's completedTasks verbatim, not a (failed) re-read",
  );
  assert.equal(report.totals.ticketCount, 1);
  assert.equal(report.degraded, false, "a provider-populated lane must never trigger the unreadable-lane degrade path");
});

// ---------- AC6: historical-only match surfaced, not summed (E132 hand-forward 3) ----------

test("AC6 (E132): a lane whose featureHistory includes featureId but whose CURRENT active_feature differs is excluded from totals/capComparison, sets degraded:true with a stated reason, and renderRollupReport prints a note line naming the count (also covers gap-11's positive control)", async () => {
  const wsMatch = await mkRealLane({ activeFeature: "ac6-feature", hopCount: 4, completedTasks: ["T-1"] });
  const wsMovedOn = await mkRealLane({ activeFeature: "later-feature", hopCount: 99, completedTasks: ["SHOULD-NOT-COUNT-1", "SHOULD-NOT-COUNT-2"] });

  const provider = providerFor([
    { workspacePath: wsMatch, activeFeature: "ac6-feature", status: "In_Progress", hopCount: 4, lastAgent: null, lastUpdated: null, readable: true, completedTasks: ["T-1"] },
    {
      workspacePath: wsMovedOn,
      activeFeature: "later-feature",
      status: "PASS",
      hopCount: 99,
      lastAgent: null,
      lastUpdated: null,
      readable: true,
      completedTasks: ["SHOULD-NOT-COUNT-1", "SHOULD-NOT-COUNT-2"],
      featureHistory: ["ac6-feature"],
    },
  ]);

  const report = computeFeatureRollup("ac6-feature", { laneListProvider: provider });

  // Excluded from totals — unchanged arithmetic, not retro-summed (Design
  // section's scope decision).
  assert.equal(report.totals.hopCount, 4);
  assert.equal(report.totals.ticketCount, 1);

  // Visibility, not silence.
  assert.equal(report.degraded, true);
  assert.match(report.degradedReason ?? "", /1 lane\(s\) previously worked "ac6-feature"/);

  const rendered = renderRollupReport(report);
  assert.match(rendered, /note: 1 lane\(s\) previously worked "ac6-feature" per featureHistory but have since moved/);
  // Still visible in the table even though excluded from totals (AC4-style
  // visibility carried forward into the historical-only-match path).
  assert.match(rendered, new RegExp(wsMovedOn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// ---------- git failure output stays off the process stderr, yet reaches degradedReason (gap-1, C1) ----------

test("gap-1 (C1, two-sided): localFallbackLaneList's git failure never prints to the real process stderr, AND the diagnostic still reaches degradedReason", () => {
  const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-c1-"));

  const chunks = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return originalWrite(chunk, ...rest);
  };

  let result;
  try {
    result = localFallbackLaneList(nonGitDir);
  } finally {
    process.stderr.write = originalWrite;
  }

  const capturedStderr = chunks.join("");
  // Half 1: the real process stderr channel (this MCP server's stdio-transport
  // log channel) must carry no `fatal:` line — a regression to inherited
  // stdio would fail this half.
  assert.doesNotMatch(capturedStderr, /fatal:/, "git's stderr must not be inherited onto the process's own stderr");

  // Half 2: the diagnostic must still reach degradedReason — Node only
  // appends CAPTURED stderr onto the thrown Error's message, so a regression
  // to stdio:["ignore","pipe","ignore"] (dropping stderr instead of piping
  // it) would pass half 1 but silently fail this half. A one-sided test
  // would pass either wrong direction.
  assert.match(
    result.degradedReason ?? "",
    /fatal:|not a git repository/i,
    "the git error detail must still reach degradedReason",
  );
  assert.equal(result.degraded, true);
  assert.deepEqual(result.lanes, []);
});

// ---------- CRLF porcelain gives the same result as LF porcelain (gap-2, C2) ----------

test("gap-2 (C2): CRLF-terminated porcelain output produces the SAME lane set as the LF fixture — only the line ending differs", () => {
  const wsA = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-crlf-a-"));
  const wsB = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-crlf-b-"));

  const lf = `worktree ${wsA}\nHEAD ${"a".repeat(40)}\nbranch refs/heads/main\n\nworktree ${wsB}\nHEAD ${"b".repeat(40)}\nbranch refs/heads/feature-x\n`;
  const crlf = lf.replace(/\n/g, "\r\n");

  const lfResult = withPath(fakeGitCat(lf), () => localFallbackLaneList(process.cwd()));
  const crlfResult = withPath(fakeGitCat(crlf), () => localFallbackLaneList(process.cwd()));

  const strip = (r) => r.lanes.map((l) => ({ workspacePath: l.workspacePath, branch: l.branch }));
  assert.deepEqual(
    strip(crlfResult),
    strip(lfResult),
    "CRLF input must survive with the same worktrees and the same per-block branch attribution as the LF fixture",
  );
  assert.equal(crlfResult.lanes.length, 2);
});

// ---------- an unreadable lane reports its read failure, never a "moved on" note (gap-3 & gap-10, C3) ----------

test("gap-3 & gap-10 (C3, refined + adversarial): an UNREADABLE lane whose featureHistory would otherwise match reports the read-failure reason (never the 'moved on' note), even alongside a readable MATCHING lane — and degraded stays true", async () => {
  const wsMatch = await mkRealLane({ activeFeature: "c3-feature", hopCount: 2, completedTasks: ["T-1"] });

  const provider = providerFor([
    { workspacePath: wsMatch, activeFeature: "c3-feature", status: "In_Progress", hopCount: 2, lastAgent: null, lastUpdated: null, readable: true, completedTasks: ["T-1"] },
    {
      workspacePath: "/nonexistent/c3-unreadable-lane",
      activeFeature: "later-feature",
      status: null,
      hopCount: null,
      lastAgent: null,
      lastUpdated: null,
      readable: false,
      error: "synthetic: unreadable",
      featureHistory: ["c3-feature"], // would match IF the lane were readable
    },
  ]);

  const report = computeFeatureRollup("c3-feature", { laneListProvider: provider });

  // gap-10: degraded must not vanish just because a readable MATCHING lane
  // is also present — only tools/feature-rollup.ts's per-lane
  // anyLaneUnreadableHere signal (set independently of the historical-match
  // filter) prevents that.
  assert.equal(report.degraded, true);

  // gap-3: the unreadable lane's own read-failure reason takes precedence
  // over the false "moved on" claim an earlier version printed.
  assert.doesNotMatch(report.degradedReason ?? "", /previously worked/);
  assert.match(report.degradedReason ?? "", /could not be read\/parsed/);

  const rendered = renderRollupReport(report);
  assert.doesNotMatch(
    rendered,
    /previously worked "c3-feature"/,
    "an unreadable lane must never be credited with a historical-only-match note",
  );

  // The matching readable lane's own contribution is unaffected.
  assert.equal(report.totals.hopCount, 2);
  assert.equal(report.totals.ticketCount, 1);
});

// ---------- gap-5: branch extraction ----------

test("gap-5: branch is extracted from 'branch refs/heads/<name>', stripped of the prefix, null for a detached worktree, and attributed to the RIGHT worktree across multiple blocks", () => {
  const wsMain = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-branch-main-"));
  const wsFeature = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-branch-feat-"));
  const wsDetached = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-branch-detached-"));

  const porcelain =
    `worktree ${wsMain}\nHEAD ${"1".repeat(40)}\nbranch refs/heads/main\n\n` +
    `worktree ${wsFeature}\nHEAD ${"2".repeat(40)}\nbranch refs/heads/feature/deep-name\n\n` +
    `worktree ${wsDetached}\nHEAD ${"3".repeat(40)}\ndetached\n`;

  const result = withPath(fakeGitCat(porcelain), () => localFallbackLaneList(process.cwd()));

  const byPath = Object.fromEntries(result.lanes.map((l) => [l.workspacePath, l.branch]));
  assert.equal(byPath[wsMain], "main");
  assert.equal(byPath[wsFeature], "feature/deep-name");
  assert.equal(byPath[wsDetached], null);
});

// ---------- gap-8: flush() control flow — two worktree lines in one block ----------

test("gap-8 (C2's flush() rewrite): two 'worktree ' lines with no blank-line separator still yield TWO lanes, the first appearing exactly once (defensive flush, not a silent drop)", () => {
  const wsA = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-flush-a-"));
  const wsB = fs.mkdtempSync(path.join(os.tmpdir(), "twfr-flush-b-"));

  // Deliberately NO blank line between the two "worktree " lines — both end
  // up in what the \n\n+ split treats as a single block, forcing the
  // defensive mid-block flush to fire instead of silently overwriting the
  // first lane's blockPath/blockBranch.
  const porcelain = `worktree ${wsA}\nHEAD ${"a".repeat(40)}\nbranch refs/heads/main\nworktree ${wsB}\nHEAD ${"b".repeat(40)}\nbranch refs/heads/feature-x\n`;

  const result = withPath(fakeGitCat(porcelain), () => localFallbackLaneList(process.cwd()));

  const paths = result.lanes.map((l) => l.workspacePath);
  assert.equal(paths.filter((p) => p === wsA).length, 1, "the first lane must appear exactly once — never dropped, never duplicated");
  assert.equal(result.lanes.length, 2);
  const byPath = Object.fromEntries(result.lanes.map((l) => [l.workspacePath, l.branch]));
  assert.equal(byPath[wsA], "main");
  assert.equal(byPath[wsB], "feature-x");
});

// ---------- gap-9: porcelain terminal shapes ----------

test("gap-9: porcelain terminal shapes — no trailing newline, fully empty output, and a single-worktree output", async () => {
  // (a) no trailing newline after the final block — the final flush() must
  // still fire without a trailing blank line to trigger it. Uses a REAL,
  // READABLE lane (mkRealLane) so the degrade path exercised is
  // specifically the "only one worktree found (no siblings)" case, not the
  // separate unreadable-lane path — an unwritten temp dir would be
  // unreadable and mask which degrade reason this test is pinning.
  const wsOnly = await mkRealLane({ activeFeature: "gap9-a", hopCount: 0 });
  const noTrailing = `worktree ${wsOnly}\nHEAD ${"1".repeat(40)}\nbranch refs/heads/main`;
  const resultNoTrailing = withPath(fakeGitCat(noTrailing), () => localFallbackLaneList(process.cwd()));
  // A lone worktree with no siblings is itself a named degrade case — but
  // the lane must still be PARSED (present in .lanes), not silently dropped
  // by the missing trailing newline.
  assert.equal(resultNoTrailing.lanes.length, 1);
  assert.equal(resultNoTrailing.lanes[0].workspacePath, wsOnly);
  assert.equal(resultNoTrailing.lanes[0].readable, true);
  assert.equal(resultNoTrailing.degraded, true);
  assert.match(resultNoTrailing.degradedReason ?? "", /only one worktree found/);

  // (b) fully empty output — zero worktrees.
  const resultEmpty = withPath(fakeGitCat(""), () => localFallbackLaneList(process.cwd()));
  assert.deepEqual(resultEmpty.lanes, []);
  assert.equal(resultEmpty.degraded, true);
  assert.match(resultEmpty.degradedReason ?? "", /returned no worktrees/);

  // (c) single-worktree output WITH a trailing newline (the more common
  // real-world shape) — same degrade case as (a), different byte shape.
  const wsOnly2 = await mkRealLane({ activeFeature: "gap9-c", hopCount: 0 });
  const singleWithTrailing = `worktree ${wsOnly2}\nHEAD ${"2".repeat(40)}\nbranch refs/heads/main\n`;
  const resultSingle = withPath(fakeGitCat(singleWithTrailing), () => localFallbackLaneList(process.cwd()));
  assert.equal(resultSingle.lanes.length, 1);
  assert.equal(resultSingle.lanes[0].readable, true);
  assert.equal(resultSingle.degraded, true);
  assert.match(resultSingle.degradedReason ?? "", /only one worktree found/);
});

// ---------- gap-12 (Q2): predicate parity between computeFeatureRollup and renderRollupReport ----------

test("gap-12 (Q2, predicate parity): one fixture driven through BOTH computeFeatureRollup's degrade predicate and renderRollupReport's note predicate agree on the historical-only-match count", async () => {
  const wsMatch = await mkRealLane({ activeFeature: "parity-feature", hopCount: 1, completedTasks: ["T-1"] });
  const wsMovedOn = await mkRealLane({ activeFeature: "moved-on", hopCount: 1 });
  const wsUnrelated = await mkRealLane({ activeFeature: "totally-unrelated", hopCount: 1 }); // featureHistory undefined — must NOT count

  const provider = providerFor([
    { workspacePath: wsMatch, activeFeature: "parity-feature", status: "In_Progress", hopCount: 1, lastAgent: null, lastUpdated: null, readable: true, completedTasks: ["T-1"] },
    { workspacePath: wsMovedOn, activeFeature: "moved-on", status: "In_Progress", hopCount: 1, lastAgent: null, lastUpdated: null, readable: true, featureHistory: ["parity-feature"] },
    { workspacePath: wsUnrelated, activeFeature: "totally-unrelated", status: "In_Progress", hopCount: 1, lastAgent: null, lastUpdated: null, readable: true },
  ]);

  const report = computeFeatureRollup("parity-feature", { laneListProvider: provider });
  const rendered = renderRollupReport(report);

  // computeFeatureRollup's own signal: degraded + reason naming the count.
  assert.equal(report.degraded, true);
  assert.match(report.degradedReason ?? "", /1 lane\(s\) previously worked "parity-feature"/);

  // renderRollupReport's independently-filtered note line must agree on the
  // SAME count — not merely both non-empty, but the same number, which is
  // exactly what a lockstep hand-edit drift (Q2) would desync.
  const noteMatch = rendered.match(/note: (\d+) lane\(s\) previously worked "parity-feature"/);
  assert.ok(noteMatch, "expected the historical-only-match note line to be present");
  const reasonCountMatch = (report.degradedReason ?? "").match(/^(\d+) lane\(s\) previously worked/);
  assert.ok(reasonCountMatch);
  assert.equal(
    noteMatch[1],
    reasonCountMatch[1],
    "computeFeatureRollup's degradedReason count and renderRollupReport's note count must agree (predicate parity)",
  );
});

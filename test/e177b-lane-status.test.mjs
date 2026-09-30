// Coded by @qa-engineer
// Tests (T-E177B-05) for tools/lane-status.ts (specs/e177b-lane-status-tooling.md,
// AC1-AC6, AC5a-AC5d).
//
// Spec-to-Test map:
//   AC1 (lane list via tools/lane-registry.ts, never a fan-out manifest)
//       -> "AC1: ...", "AC1 (structural): ..."
//   AC2 (per-lane handoff fields + git log + git status)
//       -> "AC2: ..."
//   AC3 (unreadable lane carried, never dropped; report degraded)
//       -> "AC3: no handoff.md at all ...", "AC3: unparseable handoff.md ...",
//          "AC3: handoff parses but carries no active_feature ..."
//   AC4 (--rollup sums vs the REAL exported cap constants)
//       -> "AC4: ..."
//   AC5 (independent evidence cross-check, never trusts the handoff's own count)
//       -> "AC5/AC5a/AC5b/AC5d: ..." (one worktree fixture layering all four)
//   AC5a (archive scoping parity — a release-style archive holding many
//        unrelated features' evidence must not false-positive)
//       -> same fixture as AC5, the "release-style archive" section
//   AC5b (PASS-only evidence — a FAIL-only file never counts)
//       -> same fixture, the "PASS-only" section
//   AC5c (ticket token not derivable -> completed_tasks-only fallback, printed)
//       -> "AC5c: ..."
//   AC5d (voided ids excluded even with leftover evidence on disk)
//       -> same fixture, the "voided" section
//   AC6 (cross-feature --lanes/--all roll-up: per-lane caps, informational sum)
//       -> "AC6: ..." (x3: --lanes subset, --all, missing lane name)
//
// WHY real git repos + real `git worktree add` (not a fan-out manifest, not a
// shimmed `git`, not synthetic LaneInfo objects): AC1-AC3 exercise
// computeLaneStatus's OWN `git log`/`git status --porcelain` subprocess calls
// (tools/lane-status.ts:239-248, 489-509), which a synthetic LaneListProvider
// bypasses entirely. The dispatch brief calls for temp git repos with real
// worktrees for exactly this reason — see also test/agc-adapters.test.mjs's
// mkWorktreeFixture for the same "a linked worktree needs a real primary repo
// plus `git worktree add`" precedent. AC4/AC5/AC5a-d/AC6 exercise the PURE
// roll-up/render functions over a `LaneStatusReport` a real fixture produced,
// so no git shimming is needed there beyond the same real fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  computeLaneStatus,
  rollupSameFeature,
  rollupAcrossLanes,
  renderLaneStatus,
  renderSameFeatureRollup,
  renderCrossLaneRollup,
  checkLaneEvidence,
  featureTicketToken,
  idCarriesTicketToken,
  laneMatchesName,
  parseLaneStatusArgs,
  runLaneStatusCli,
  TOKEN_NOT_DERIVABLE_NOTE,
  CROSS_FEATURE_BANNER,
} from "../dist/tools/lane-status.js";
import { HOP_CAP_EXPORTED, REVIEW_ROUND_CAP_EXPORTED } from "../dist/tools/transitions.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const LANE_STATUS_SOURCE = fs.readFileSync(path.join(ROOT, "tools", "lane-status.ts"), "utf-8");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function git(args, cwd) {
  // A bounded timeout: a hung git subprocess (e.g. an unexpected interactive
  // prompt) must fail this one call loudly rather than stall the whole
  // suite (same hang class fixed in the test-lock and mailbox-watch tests, E182).
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 });
}

/** A real, throwaway git repo on branch "main" with one commit.
 *  realpathSync'd immediately: on macOS, os.tmpdir() resolves under a
 *  symlinked /var, but `git worktree list --porcelain` always reports the
 *  fully-resolved path — comparing an un-resolved mkdtempSync path against a
 *  report row's workspacePath would spuriously never match. */
function mkPrimary(t, prefix) {
  const primary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(primary, { recursive: true, force: true }));
  git(["init", "-q", "-b", "main"], primary);
  git(["config", "user.email", "a@b.c"], primary);
  git(["config", "user.name", "t"], primary);
  fs.writeFileSync(path.join(primary, "README.md"), "primary\n");
  git(["add", "-A"], primary);
  git(["commit", "-q", "-m", "init"], primary);
  fs.mkdirSync(path.join(primary, ".current"), { recursive: true });
  return primary;
}

/** A real linked worktree of `primary`, checked out on a fresh branch.
 *  Same realpathSync note as mkPrimary above — resolved BEFORE `worktree add`
 *  recreates the directory, so the returned path is byte-identical to what
 *  `git worktree list --porcelain` (and hence every report row) will report. */
function addWorktree(t, primary, branch, prefix) {
  const wt = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.rmSync(wt, { recursive: true, force: true });
  t.after(() => fs.rmSync(wt, { recursive: true, force: true }));
  git(["worktree", "add", "-q", "-b", branch, wt], primary);
  fs.mkdirSync(path.join(wt, ".current"), { recursive: true });
  return wt;
}

async function writeLane(ws, opts) {
  resetSession();
  await writeHandoffState({
    workspacePath: ws,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
    ...opts,
  });
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

/** Write (or append a round to) a `review_<id>.md` evidence file. */
function writeReview(dir, id, { status = "PASS", covers, append = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const header = append ? "" : `# QA review — ${id}\n\n${covers ? `covers: ${covers.join(", ")}\n\n` : ""}`;
  const section = `## ${isoNow()} — ${status} — by qa-engineer\n\n${status === "PASS" ? "looks good" : "not yet"}\n\n`;
  const filePath = path.join(dir, `review_${id}.md`);
  if (append) fs.appendFileSync(filePath, section);
  else fs.writeFileSync(filePath, header + section);
}

function writeVoidedRow(ws, lane, id) {
  const p = path.join(ws, ".current", lane, "tasks.md");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const line = `- [-] ${id} [P1] sr-engineer: superseded (voided: replaced by a later cut)\n`;
  fs.appendFileSync(p, line);
}

// ---------------------------------------------------------------------------
// AC1 — lane list via tools/lane-registry.ts, never a fan-out manifest
// ---------------------------------------------------------------------------

test("AC1: lane-status lists every sibling lane derived from git worktree list, with no specs/fanout-*.md fixture present anywhere", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac1-primary-");
  const wt = addWorktree(t, primary, "feat/e901-alpha", "e177b-ac1-wt-");
  await writeLane(wt, { activeFeature: "e901-alpha", hopCount: 1 });

  assert.equal(fs.existsSync(path.join(primary, "specs")), false, "no specs/ dir exists in this fixture at all");
  const report = computeLaneStatus({ repoRoot: primary });
  assert.equal(report.source, "lane-registry");
  assert.equal(report.lanes.length, 2, "primary checkout + the one added worktree");
  const basenames = report.lanes.map((l) => l.lane);
  assert.ok(basenames.includes(path.basename(wt)));
});

test("AC1 (structural): no non-comment line in tools/lane-status.ts mentions a fan-out manifest — E177a's concern stays out of scope", { timeout: 30000 }, () => {
  const codeLines = LANE_STATUS_SOURCE.split("\n").filter((l) => !l.trim().startsWith("//"));
  for (const line of codeLines) {
    assert.doesNotMatch(line, /fanout/i, `unexpected fan-out reference in executable code: ${line}`);
  }
});

// ---------------------------------------------------------------------------
// AC2 — per-lane handoff fields + git log <base>..<branch> + git status
// ---------------------------------------------------------------------------

test("AC2: a lane row reports active_feature/status/last_agent from the handoff, the commit list+count vs base, and git status clean/dirty+count", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac2-primary-");
  const wt = addWorktree(t, primary, "feat/e902-beta", "e177b-ac2-wt-");
  await writeLane(wt, { activeFeature: "e902-beta", status: "In_Progress", lastAgent: "sr-engineer", hopCount: 2 });

  fs.writeFileSync(path.join(wt, "feature.txt"), "work\n");
  git(["add", "-A"], wt);
  git(["commit", "-q", "-m", "add feature"], wt);

  const clean = computeLaneStatus({ repoRoot: primary });
  const row = clean.lanes.find((l) => l.workspacePath === wt);
  assert.ok(row, "the lane row must exist");
  assert.equal(row.activeFeature, "e902-beta");
  assert.equal(row.status, "In_Progress");
  assert.equal(row.lastAgent, "sr-engineer");
  assert.equal(row.commits.count, 1);
  assert.ok(row.commits.list.some((l) => l.includes("add feature")), "commit list must name the real commit");
  assert.equal(row.gitStatus.clean, true);
  assert.equal(row.gitStatus.changedFiles, 0);

  fs.writeFileSync(path.join(wt, "untracked.txt"), "scratch\n");
  const dirty = computeLaneStatus({ repoRoot: primary });
  const dirtyRow = dirty.lanes.find((l) => l.workspacePath === wt);
  assert.equal(dirtyRow.gitStatus.clean, false);
  assert.equal(dirtyRow.gitStatus.changedFiles, 1);
});

// ---------------------------------------------------------------------------
// AC3 — degrade-honestly: a lane is CARRIED, never dropped, never zero-filled
// ---------------------------------------------------------------------------

test("AC3: a lane with no handoff.md at all is carried, readable:false, with a stated reason, and the report is degraded", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac3a-primary-");
  const wt = addWorktree(t, primary, "feat/e903-nohand", "e177b-ac3a-wt-");
  // Deliberately never write a handoff for this lane.

  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);
  assert.ok(row, "an unreadable lane must still be carried, never dropped");
  assert.equal(row.readable, false);
  assert.equal(typeof row.reason, "string");
  assert.ok(row.reason.length > 0);
  assert.equal(report.degraded, true);
  assert.match(report.degradedReason, /could not be read\/parsed/i);
});

test("AC3: a lane with an unparseable handoff.md (corrupt YAML frontmatter) is carried, readable:false, with a reason naming the parse failure", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac3b-primary-");
  const wt = addWorktree(t, primary, "feat/e904-corrupt", "e177b-ac3b-wt-");
  const laneDir = path.join(wt, ".current", "e904");
  fs.mkdirSync(laneDir, { recursive: true });
  // Unterminated flow sequence -> js-yaml throws a YAMLException.
  fs.writeFileSync(path.join(laneDir, "handoff.md"), "---\nactive_feature: [unterminated\nstatus: In_Progress\n---\n");

  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);
  assert.equal(row.readable, false);
  assert.match(row.reason, /unparseable|failed to parse/i);
  assert.equal(report.degraded, true);
});

test("AC3: a handoff that parses but carries no active_feature at all is still carried, never silently zero-filled", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac3c-primary-");
  const wt = addWorktree(t, primary, "feat/e905-blank", "e177b-ac3c-wt-");
  const laneDir = path.join(wt, ".current", "e905");
  fs.mkdirSync(laneDir, { recursive: true });
  fs.writeFileSync(path.join(laneDir, "handoff.md"), "---\nstatus: In_Progress\n---\n");

  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);
  assert.ok(row, "must still be carried");
  assert.equal(row.readable, false);
  assert.match(row.reason, /no active_feature/i);
  assert.equal(row.activeFeature, null);
  assert.deepEqual(row.completedTasks, []);
});

// ---------------------------------------------------------------------------
// AC4 — same-feature roll-up vs the REAL exported cap constants
// ---------------------------------------------------------------------------

test("AC4: --rollup sums hop/review_round/qa_round across matching lanes and names the REAL exported cap constant's value when over cap", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac4-primary-");
  // A third, non-matching lane keeps computeFeatureRollup's own degrade posture
  // clean (readable, real active_feature) so the OVER CAP assertions below
  // aren't drowned out by an unrelated "one or more lane handoffs..." reason.
  await writeLane(primary, { activeFeature: "e177b-unrelated-primary-lane", hopCount: 0 });
  const wtA = addWorktree(t, primary, "feat/e906a-capcheck", "e177b-ac4-a-");
  const wtB = addWorktree(t, primary, "feat/e906b-capcheck", "e177b-ac4-b-");
  await writeLane(wtA, { activeFeature: "e906-capcheck", hopCount: 6, reviewRound: 3, qaRound: 2 });
  await writeLane(wtB, { activeFeature: "e906-capcheck", hopCount: 6, reviewRound: 3, qaRound: 3 });

  const report = computeLaneStatus({ repoRoot: primary });
  const rollup = rollupSameFeature(report, "e906-capcheck");
  assert.equal(rollup.matchingLanes.length, 2);
  assert.equal(rollup.totals.hop, 12, `must sum only the ${rollup.featureId} lanes, never every lane in the repo`);
  assert.equal(rollup.totals.reviewRounds, 6);
  assert.equal(rollup.totals.qaRounds, 5);

  const hopCheck = rollup.capChecks.find((c) => c.metric === "hop");
  assert.equal(hopCheck.capName, "HOP_CAP_EXPORTED", "must name the REAL exported constant, never a bare number");
  assert.equal(hopCheck.cap, HOP_CAP_EXPORTED);
  assert.equal(hopCheck.over, true);
  const reviewCheck = rollup.capChecks.find((c) => c.metric === "review_round");
  assert.equal(reviewCheck.capName, "REVIEW_ROUND_CAP_EXPORTED");
  assert.equal(reviewCheck.over, true);

  const rendered = renderSameFeatureRollup(rollup);
  assert.match(
    rendered,
    new RegExp(`OVER CAP: feature total hop 12 exceeds HOP_CAP_EXPORTED = ${HOP_CAP_EXPORTED} \\(over by ${12 - HOP_CAP_EXPORTED}\\)`),
  );
  assert.match(
    rendered,
    new RegExp(`OVER CAP: feature total review_round 6 exceeds REVIEW_ROUND_CAP_EXPORTED = ${REVIEW_ROUND_CAP_EXPORTED}`),
  );
});

// ---------------------------------------------------------------------------
// AC5 / AC5a / AC5b / AC5d — one worktree fixture layering every filter the
// evidence cross-check applies IDENTICALLY to qa_reports/ and its archive.
// ---------------------------------------------------------------------------

test("AC5/AC5a/AC5b/AC5d: evidence cross-check independently counts PASS-only, in-scope, non-voided ids across BOTH qa_reports/ and a release-style archive holding unrelated features' evidence — never trusts the handoff's own count", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac5-primary-");
  const wt = addWorktree(t, primary, "feat/e908-archivetest", "e177b-ac5-wt-");
  // The handoff under-claims on purpose: only T-E908-01 is in completed_tasks,
  // even though several more ids will turn out to be evidence-backed below —
  // the shape where a lane's handoff under-reports finished work (E175(d), AC5).
  await writeLane(wt, { activeFeature: "e908-archivetest", completedTasks: ["T-E908-01"], hopCount: 1 });

  const qaDir = path.join(wt, "qa_reports");
  // Flat dir: the claimed id has real PASS evidence (no mismatch contribution
  // from this one).
  writeReview(qaDir, "T-E908-01");
  // A FAIL-only file must never count as evidence (AC5b).
  writeReview(qaDir, "T-E908-03-failonly", { status: "FAIL" });
  // A FAIL round followed by a later PASS round DOES count (AC5b).
  writeReview(qaDir, "T-E908-04-failthenpass", { status: "FAIL" });
  writeReview(qaDir, "T-E908-04-failthenpass", { status: "PASS", append: true });
  // A PASS file exists on disk, but the id is voided in the lane's own
  // ledger: it must be EXCLUDED from evidenceIds, and surfaced in excludedVoided (AC5d).
  writeReview(qaDir, "T-E908-05-voided");
  writeVoidedRow(wt, "e908", "T-E908-05-voided");

  // A release-style archive holding a whole wave's evidence: several
  // OUT-OF-SCOPE ids (no "e908" token) plus ONE in-scope id. None of the
  // out-of-scope ids may be counted or flagged (AC5a).
  const archiveDir = path.join(qaDir, "archive", "e908-archivetest");
  writeReview(archiveDir, "T-E908-02-archived"); // in scope (carries "e908")
  writeReview(archiveDir, "T-E125A-01");
  writeReview(archiveDir, "T-E125B-03");
  writeReview(archiveDir, "T-E145-07");

  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);
  assert.ok(row.evidence, "a readable lane always gets an evidence cross-check");
  const e = row.evidence;

  assert.equal(e.ticketToken, "e908");
  assert.deepEqual(
    e.evidenceIds,
    ["T-E908-01", "T-E908-02-archived", "T-E908-04-failthenpass"].sort(),
    "PASS-only (AC5b) + in-scope-by-token (AC5a) + non-voided (AC5d): FAIL-only, out-of-scope archive noise, and the voided id must all be excluded",
  );
  assert.deepEqual(e.excludedVoided, ["T-E908-05-voided"]);
  assert.equal(e.claimedCount, 1);
  assert.equal(e.evidenceCount, 3);
  assert.deepEqual(e.evidenceWithoutClaim, ["T-E908-02-archived", "T-E908-04-failthenpass"]);
  assert.deepEqual(e.claimedWithoutEvidence, []);
  assert.equal(e.mismatch, true, "evidence on disk that the handoff never claimed is still a mismatch (E175(d))");

  const rendered = renderLaneStatus(report);
  assert.match(rendered, /EVIDENCE MISMATCH/);
  assert.doesNotMatch(rendered, /T-E125A-01|T-E125B-03|T-E145-07/, "unrelated archived ids must never surface as evidence");
});

test("AC5a: a wave-level release archive holding MANY unrelated features' evidence produces NO false mismatch when every claimed id is already in scope", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac5a-primary-");
  const wt = addWorktree(t, primary, "feat/e909-releasewave", "e177b-ac5a-wt-");
  await writeLane(wt, { activeFeature: "e909-releasewave", completedTasks: ["T-E909-01"] });

  const archiveDir = path.join(wt, "qa_reports", "archive", "e909-releasewave");
  writeReview(archiveDir, "T-E909-01"); // in scope, already claimed
  // 5 unrelated ids from other features sharing the same wave-level archive.
  for (const id of ["T-E125A-01", "T-E125B-02", "T-E125C-03", "T-E126-04", "T-E145-05"]) {
    writeReview(archiveDir, id);
  }

  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);
  assert.equal(row.evidence.evidenceCount, 1, "only the in-scope id counts, never the whole archive directory's contents");
  assert.deepEqual(row.evidence.evidenceIds, ["T-E909-01"]);
  assert.equal(row.evidence.mismatch, false);
});

// ---------------------------------------------------------------------------
// AC5c — ticket token not derivable -> completed_tasks-only fallback, printed
// ---------------------------------------------------------------------------

test("AC5c: a feature id with no derivable ticket token prints the exact fallback line and scopes by completed_tasks alone (flat AND archive)", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac5c-primary-");
  const wt = addWorktree(t, primary, "integ/release-v4-wave9", "e177b-ac5c-wt-");
  await writeLane(wt, { activeFeature: "release-v4-wave9", completedTasks: [] });

  // Real evidence sits on disk (flat + archive), but with no completed_tasks
  // entry and no derivable token, none of it may be counted (AC5c trade-off).
  writeReview(path.join(wt, "qa_reports"), "T-RELV4W9-01");
  writeReview(path.join(wt, "qa_reports", "archive", "release-v4-wave9"), "T-RELV4W9-02");

  assert.equal(featureTicketToken("release-v4-wave9"), null);

  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);
  assert.equal(row.evidence.ticketToken, null);
  assert.equal(row.evidence.evidenceCount, 0, "no token -> completed_tasks-only scoping, and completed_tasks is empty here");
  assert.equal(row.evidence.mismatch, false);

  const rendered = renderLaneStatus(report);
  // The lane's own section header and the fallback note are separate lines
  // (workspace path sits between them) — assert each independently rather
  // than pinning their exact adjacency.
  assert.ok(rendered.includes(`[${row.lane}]`), "the lane's own section header must be present");
  assert.equal(TOKEN_NOT_DERIVABLE_NOTE, "ticket token not derivable — comparing completed_tasks only");
  assert.ok(rendered.includes(`  ${TOKEN_NOT_DERIVABLE_NOTE}`), "the exact AC5c fallback line must be printed for this lane");
});

// ---------------------------------------------------------------------------
// AC6 — cross-feature (wave-level) roll-up: per-lane caps, informational sum
// ---------------------------------------------------------------------------

test("AC6: --lanes/--all sums across DIFFERING active_feature values, evaluates caps PER LANE only, and marks the combined total informational", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-ac6-primary-");
  await writeLane(primary, { activeFeature: "e177b-ac6-primary-noise", hopCount: 0 });
  const wtA = addWorktree(t, primary, "feat/e910-one", "e177b-ac6-a-");
  const wtB = addWorktree(t, primary, "feat/e911-two", "e177b-ac6-b-");
  const wtC = addWorktree(t, primary, "feat/e912-three", "e177b-ac6-c-");
  await writeLane(wtA, { activeFeature: "e910-one", hopCount: 2 });
  await writeLane(wtB, { activeFeature: "e911-two", hopCount: 3 });
  // wtC's OWN hop total exceeds the cap all by itself.
  await writeLane(wtC, { activeFeature: "e912-three", hopCount: HOP_CAP_EXPORTED + 1 });

  const report = computeLaneStatus({ repoRoot: primary });

  const subset = rollupAcrossLanes(report, { lanes: ["e910", "e911", "e912"] });
  assert.equal(subset.mode, "cross");
  assert.equal(subset.lanes.length, 3);
  assert.deepEqual(new Set(subset.distinctFeatures), new Set(["e910-one", "e911-two", "e912-three"]));
  assert.equal(subset.combined.hop, 2 + 3 + (HOP_CAP_EXPORTED + 1));
  assert.equal(subset.degraded, false);

  // Caps are PER LANE: only wtC's own check is over; wtA/wtB are not, even
  // though the (informational) combined total would be well over the cap too.
  const overLines = subset.perLaneCaps.flatMap((p) => p.checks.filter((c) => c.over).map((c) => p.lane));
  assert.deepEqual(overLines, [path.basename(wtC)]);

  const rendered = renderCrossLaneRollup(subset);
  for (const bannerLine of CROSS_FEATURE_BANNER) assert.ok(rendered.includes(bannerLine));
  assert.match(rendered, /Caps are evaluated PER LANE/);
  assert.match(rendered, /Combined total \(informational only, not capped\)/);
  assert.match(rendered, new RegExp(`OVER CAP: lane ${path.basename(wtC)} .* hop ${HOP_CAP_EXPORTED + 1} exceeds HOP_CAP_EXPORTED`));

  // --all must include the noisy primary lane too, and every named lane is
  // listed under its OWN active_feature (never a shared/blended one).
  const all = rollupAcrossLanes(report, { all: true });
  assert.equal(all.lanes.length, 4);
  assert.ok(all.distinctFeatures.includes("e177b-ac6-primary-noise"));

  // A named lane that matches nothing degrades the roll-up with a stated
  // reason, never a silent drop.
  const withMissing = rollupAcrossLanes(report, { lanes: ["e910", "no-such-lane"] });
  assert.deepEqual(withMissing.missing, ["no-such-lane"]);
  assert.equal(withMissing.degraded, true);
  assert.match(withMissing.degradedReason, /no-such-lane/);
});

// ---------------------------------------------------------------------------
// Pure-function unit coverage (fast, no git fixture needed) + security smoke
// ---------------------------------------------------------------------------

test("idCarriesTicketToken: matches only a delimited segment, never a substring collision (e177 must not match e177b's own rows)", { timeout: 30000 }, () => {
  assert.equal(idCarriesTicketToken("T-E177B-04", "e177b"), true);
  assert.equal(idCarriesTicketToken("T-E177-04", "e177b"), false);
  assert.equal(idCarriesTicketToken("T-E177B-04", "e177"), false, "e177 is a DIFFERENT token than e177b — no partial-prefix match");
  assert.equal(idCarriesTicketToken("T-E177B-04", ""), false, "an empty token never matches anything");
});

test("laneMatchesName: matches by worktree basename, branch-derived laneId, or the literal branch name", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-lmn-primary-");
  const wt = addWorktree(t, primary, "feat/e913-lmn", "e177b-lmn-wt-");
  await writeLane(wt, { activeFeature: "e913-lmn" });
  const report = computeLaneStatus({ repoRoot: primary });
  const row = report.lanes.find((l) => l.workspacePath === wt);

  assert.equal(laneMatchesName(row, path.basename(wt)), true);
  assert.equal(laneMatchesName(row, "e913"), true);
  assert.equal(laneMatchesName(row, "feat/e913-lmn"), true);
  assert.equal(laneMatchesName(row, "  E913  "), true, "case/whitespace-insensitive");
  assert.equal(laneMatchesName(row, ""), false);
  assert.equal(laneMatchesName(row, "nope"), false);
});

test("Security/boundary: checkLaneEvidence never lets a hostile active_feature escape qa_reports/ as an archive path segment", { timeout: 30000 }, () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e177b-sec-archive-"));
  for (const hostile of ["../../etc", "a/b", "..", "."]) {
    const result = checkLaneEvidence(ws, hostile, [], "_primary");
    assert.match(result.scope, /no archive dir/, `"${hostile}" must never be treated as a safe archive path segment`);
  }
});

test("Security/boundary: checkLaneEvidence on a workspace with no qa_reports/ directory at all never throws (empty/oversized/absent inputs)", { timeout: 30000 }, () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e177b-sec-empty-"));
  assert.doesNotThrow(() => checkLaneEvidence(ws, null, [], "_primary"));
  assert.doesNotThrow(() => checkLaneEvidence(ws, "", [], "_primary"));
  const huge = Array.from({ length: 500 }, (_, i) => `T-HUGE-${i}`);
  const result = checkLaneEvidence(ws, null, huge, "_primary");
  assert.equal(result.evidenceCount, 0);
  assert.equal(result.claimedCount, 500);
});

// ---------------------------------------------------------------------------
// CLI: parseLaneStatusArgs / runLaneStatusCli — boundary + security smoke
// ---------------------------------------------------------------------------

test("CLI: --rollup, --lanes and --all are mutually exclusive", { timeout: 30000 }, () => {
  assert.throws(() => parseLaneStatusArgs(["--rollup", "e1", "--all"]), /mutually exclusive/);
  assert.throws(() => parseLaneStatusArgs(["--lanes", "a,b", "--all"]), /mutually exclusive/);
});

test("CLI: --base rejects a leading-dash or whitespace value (option-injection guard against git log)", { timeout: 30000 }, () => {
  assert.throws(() => parseLaneStatusArgs(["--base", "-x"]), /plain ref name/);
  assert.throws(() => parseLaneStatusArgs(["--base", "has space"]), /plain ref name/);
  const ok = parseLaneStatusArgs(["--base", "develop"]);
  assert.equal(ok.baseRef, "develop");
});

test("CLI: --lanes with an empty value after trimming is refused, never silently treated as --all", { timeout: 30000 }, () => {
  assert.throws(() => parseLaneStatusArgs(["--lanes", "  ,  ,"]), /at least one lane name/);
});

test("CLI: an unknown flag exits with the reserved usage exit code (64), never crashing the process", { timeout: 30000 }, () => {
  // Argument parsing fails before computeLaneStatus is ever reached, so no
  // repo fixture is needed here.
  const result = runLaneStatusCli(["--bogus"]);
  assert.equal(result.exitCode, 64);
  assert.equal(result.stream, "stderr");
  assert.match(result.output, /lane-status: unknown argument: --bogus/);
});

test("CLI: no-mode / --json round-trips computeLaneStatus's own shape end to end (real worktree)", { timeout: 30000 }, async (t) => {
  const primary = mkPrimary(t, "e177b-cli-json-primary-");
  const wt = addWorktree(t, primary, "feat/e914-clijson", "e177b-cli-json-wt-");
  await writeLane(wt, { activeFeature: "e914-clijson", hopCount: 1 });

  // The repo root is a CLI argument (--repo), not an opts-object override:
  // runLaneStatusCli's own opts param is typed to OMIT repoRoot/baseRef
  // (they always come from parsed argv) — see runLaneStatusCli's call to
  // computeLaneStatus({ ...opts, repoRoot: args.repoRoot, baseRef: args.baseRef }).
  const result = runLaneStatusCli(["--repo", primary, "--json"]);
  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.output);
  assert.equal(parsed.lanes.length, 2);
  assert.ok(parsed.lanes.some((l) => l.activeFeature === "e914-clijson"));
});

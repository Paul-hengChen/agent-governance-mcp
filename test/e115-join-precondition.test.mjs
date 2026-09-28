// Coded by @qa-engineer
// T-E115-03 — tests for tools/join-precondition.ts (specs/e115-join-precondition-check.md,
// amended AC3, new AC9, AC1/AC2/AC4/AC5/AC6). Executed against a REAL scratch
// git repo fixture with actual branches and commits (mkFixtureRepo) — per the
// dispatch brief's explicit bar for this ticket: verify by EXECUTION, not by
// reading the diff. Style mirrors test/e116-archive-on-feature-change.test.mjs
// (mkWs + writeHandoffState for the handoff side) and test/feature-rollup.test.mjs
// (real on-disk fixtures over synthesized objects wherever the code under test
// itself does a real read). AC7/AC8 are inspection-based and are recorded in
// qa_reports/review_T-E115-03.md, not here (Constitution §2: this file owns
// only what is proof-by-execution).
//
// Spec-to-Test map:
//   AC1 (ancestry: merged vs unmerged, real git merge-base --is-ancestor) -> AC1
//   AC2 (unknown/deleted branch degrades to false+error, never throws)   -> AC2
//   AC3, amended (MEMBERSHIP — actual present in ANY declared row incl.
//     a status:done row -> satisfied, mismatches:[]; actual absent from
//     EVERY declared row -> exactly ONE finding naming the full declared
//     set, never one finding per non-matching row)                       -> AC3
//   AC4 (missing feature-split.md / unrecognizable column / unparseable
//     handoff -> compared:false + reason, never a fabricated verdict)    -> AC4
//   AC5 (no exported signature takes a second workspace-path arg; no
//     read/exec parameterized outside repoRoot / repoRoot/.current/**)   -> AC5
//   AC6 (exactly one HOOK POINT FOR E126 comment, no E126 logic)         -> AC6
//   AC9, new (markdown-decorated header + backtick/underscore-decorated
//     declared values normalize before matching; internal underscore
//     round-trips unchanged; decoration-only cell drops, never becomes
//     an empty declared member)                                         -> AC9

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  checkLaneAncestry,
  checkDeclaredVsActualLaneIdentity,
  renderJoinPreconditionReport,
} from "../dist/tools/join-precondition.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const SOURCE = fs.readFileSync(
  path.join(PROJECT_ROOT, "tools", "join-precondition.ts"),
  "utf-8",
);
const SCRIPT_SOURCE = fs.readFileSync(
  path.join(PROJECT_ROOT, "scripts", "join-precondition.mjs"),
  "utf-8",
);
const DTS = fs.readFileSync(
  path.join(PROJECT_ROOT, "dist", "tools", "join-precondition.d.ts"),
  "utf-8",
);

// ---- helpers ---------------------------------------------------------------

/** Real, throwaway git repo with actual commits/branches — for AC1/AC2's
 * `git merge-base --is-ancestor` calls, which are answered from real git
 * object history and cannot be faked with synthesized objects. */
function mkGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e115-repo-"));
  // `-c init.defaultBranch=main` (not `-b main`, which needs git >= 2.28) makes
  // the scratch repo's initial branch name deterministic instead of inherited
  // from the host's `init.defaultBranch` — CI runners without that config
  // default to `master`, and the AC1 tests below hard-depend on `main` via
  // `git checkout -q main`. No version floor: this is a plain config override,
  // not a flag introduced in a specific git release.
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  // Likewise pin commit identity and disable signing so a scratch commit
  // never depends on the host's global config: without this, a host with
  // global commit.gpgsign=true and no usable signing key would hang or fail
  // the commit below. (Considered and rejected: pinning the object hash
  // format, e.g. via init.defaultObjectFormat. Left inherited, not pinned —
  // nothing in this file compares object ids across repos, so a host-level
  // SHA-1 vs SHA-256 default is irrelevant to what this test verifies.)
  execFileSync("git", ["config", "user.email", "a@b.c"], { cwd: root });
  execFileSync("git", ["config", "user.name", "t"], { cwd: root });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root });
  fs.writeFileSync(path.join(root, "README.md"), "init\n");
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: root });
  return root;
}

/** Plain workspace with a `.current/` dir — for AC3/AC4/AC9, which only ever
 * touch `.current/feature-split.md` + `.current/handoff.md`, never git. */
function mkWs(prefix = "e115-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeSplit(ws, content) {
  fs.writeFileSync(path.join(ws, ".current", "feature-split.md"), content);
}

async function writeHandoff(ws, activeFeature) {
  resetSession();
  markStateRead(ws);
  return writeHandoffState({
    workspacePath: ws,
    activeFeature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "sr-engineer",
  });
}

// ============================================================================
// AC1 — ancestry check distinguishes merged vs unmerged branches
// ============================================================================

test("AC1: ancestry check distinguishes merged vs unmerged branches", () => {
  const root = mkGitRepo();

  // merged branch: branch off main, commit, merge back with --no-ff so the
  // merge commit itself becomes HEAD (a fast-forward would also leave the
  // branch tip == HEAD, but --no-ff is the more general, always-true case).
  execFileSync("git", ["checkout", "-q", "-b", "merged-branch"], { cwd: root });
  fs.writeFileSync(path.join(root, "merged.txt"), "x\n");
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "merged work"], { cwd: root });
  execFileSync("git", ["checkout", "-q", "main"], { cwd: root });
  execFileSync("git", ["merge", "-q", "--no-ff", "-m", "merge it", "merged-branch"], {
    cwd: root,
  });

  // unmerged branch: exists, has commits, but is never merged into HEAD.
  execFileSync("git", ["checkout", "-q", "-b", "unmerged-branch"], { cwd: root });
  fs.writeFileSync(path.join(root, "unmerged.txt"), "y\n");
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "unmerged work"], { cwd: root });
  execFileSync("git", ["checkout", "-q", "main"], { cwd: root });

  const results = checkLaneAncestry(["merged-branch", "unmerged-branch"], root);

  assert.deepEqual(
    results.find((r) => r.branch === "merged-branch"),
    { branch: "merged-branch", isAncestor: true },
    "a branch actually merged into HEAD must report isAncestor:true with no error",
  );

  const unmerged = results.find((r) => r.branch === "unmerged-branch");
  assert.equal(unmerged.isAncestor, false, "an unmerged-but-existing branch must NOT report isAncestor:true");
  assert.equal(
    unmerged.error,
    undefined,
    "a clean git exit-1 negative (branch exists, simply not merged) must NOT populate error — only a real failure does",
  );
});

test("AC1: naming which branch(es) are unmerged — one result per branch, not a single pass/fail bit", () => {
  const root = mkGitRepo();
  execFileSync("git", ["checkout", "-q", "-b", "lane-a"], { cwd: root });
  fs.writeFileSync(path.join(root, "a.txt"), "a\n");
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "a"], { cwd: root });
  execFileSync("git", ["checkout", "-q", "main"], { cwd: root });
  execFileSync("git", ["merge", "-q", "--no-ff", "-m", "merge a", "lane-a"], { cwd: root });

  execFileSync("git", ["checkout", "-q", "-b", "lane-b"], { cwd: root });
  fs.writeFileSync(path.join(root, "b.txt"), "b\n");
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "b"], { cwd: root });
  execFileSync("git", ["checkout", "-q", "main"], { cwd: root });
  // lane-b is deliberately left unmerged.

  const results = checkLaneAncestry(["lane-a", "lane-b"], root);
  assert.equal(results.length, 2, "one result per input branch");
  assert.equal(results[0].branch, "lane-a");
  assert.equal(results[0].isAncestor, true);
  assert.equal(results[1].branch, "lane-b");
  assert.equal(results[1].isAncestor, false, "lane-b must be named as the one NOT yet merged");
});

// ============================================================================
// AC2 — unknown/deleted branch degrades to isAncestor:false + error, never throws
// ============================================================================

test("AC2: unknown branch degrades to isAncestor:false + populated error, does not throw", () => {
  const root = mkGitRepo();

  let results;
  assert.doesNotThrow(() => {
    results = checkLaneAncestry(["this-branch-never-existed"], root);
  }, "an unknown branch must never throw out of checkLaneAncestry");

  assert.equal(results.length, 1);
  assert.equal(results[0].isAncestor, false, "unknown branch must never be coerced to true");
  assert.equal(typeof results[0].error, "string", "unknown branch must carry a populated error string");
  assert.ok(results[0].error.length > 0);
});

test("AC2: bogus repoRoot (not a git repo) also degrades to false+error, does not throw", () => {
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), "e115-notrepo-"));
  let results;
  assert.doesNotThrow(() => {
    results = checkLaneAncestry(["whatever"], notARepo);
  });
  assert.equal(results[0].isAncestor, false);
  assert.equal(typeof results[0].error, "string");
  assert.ok(results[0].error.length > 0);
});

test("AC2: empty branch list never throws and returns an empty array", () => {
  const root = mkGitRepo();
  assert.doesNotThrow(() => {
    const results = checkLaneAncestry([], root);
    assert.deepEqual(results, []);
  });
});

// ============================================================================
// AC3 (amended — MEMBERSHIP) — checkDeclaredVsActualLaneIdentity
// ============================================================================

test("AC3: actual present in one declared row of a multi-row Split Table -> satisfied, mismatches: []", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    [
      "# Feature Split",
      "",
      "| lane | feature id | status |",
      "|---|---|---|",
      "| 0 | shared-foundation | done |",
      "| 1 | e115-join-precondition-check | in-progress |",
      "| 2 | some-other-lane | not-started |",
      "",
    ].join("\n"),
  );
  await writeHandoff(ws, "e115-join-precondition-check");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.deepEqual(
    result.mismatches,
    [],
    "actual present in ANY declared row must be satisfied — sibling rows declaring something else are expected, not mismatches",
  );
});

test("AC3: matching row carrying status:done is still satisfied — no status-column special-casing", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    [
      "| lane | feature id | status |",
      "|---|---|---|",
      "| 0 | e115-join-precondition-check | done |",
      "| 1 | some-other-lane | in-progress |",
    ].join("\n"),
  );
  await writeHandoff(ws, "e115-join-precondition-check");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.deepEqual(
    result.mismatches,
    [],
    "a matching row with status:done must still satisfy membership — the function reads no status column at all",
  );
});

test("AC3: actual absent from every declared row -> exactly ONE finding naming the full declared set + actual", async () => {
  const ws = mkWs();
  // Mirrors the incident this ticket was filed from: two planned lanes
  // collapse into one workspace running under a third, undeclared name.
  writeSplit(
    ws,
    [
      "| lane | feature id |",
      "|---|---|",
      "| 0 | source-list-mock |",
      "| 1 | source-list-contract-docs |",
    ].join("\n"),
  );
  await writeHandoff(ws, "source-list-mock-contract");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.equal(
    result.mismatches.length,
    1,
    "absence from every declared row must produce EXACTLY ONE finding for the whole check, never one per non-matching row",
  );
  const [finding] = result.mismatches;
  assert.equal(finding.actual, "source-list-mock-contract");
  assert.deepEqual(
    finding.declaredFeatureIds,
    ["source-list-mock", "source-list-contract-docs"],
    "the single finding must name the FULL declared set",
  );
});

test("AC3: five declared rows, none matching, still yields mismatches.length === 1", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    [
      "| feature id |",
      "|---|",
      "| lane-a |",
      "| lane-b |",
      "| lane-c |",
      "| lane-d |",
      "| lane-e |",
    ].join("\n"),
  );
  await writeHandoff(ws, "lane-z-not-declared-anywhere");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.mismatches.length, 1, "count must be asserted, not just presence");
  assert.equal(result.mismatches[0].declaredFeatureIds.length, 5);
});

// ============================================================================
// AC4 — degradation paths: missing file, unrecognizable column, unparseable
// handoff -> compared:false + reason, never a fabricated verdict
// ============================================================================

test("AC4: missing .current/feature-split.md degrades to compared:false + reason", () => {
  const ws = mkWs();
  // Deliberately do NOT write feature-split.md.
  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, false);
  assert.equal(typeof result.reason, "string");
  assert.ok(result.reason.length > 0);
  assert.deepEqual(result.mismatches, []);
});

test("AC4: unrecognizable column (no feature id / active_feature header) degrades honestly", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| lane | owner |", "|---|---|", "| 0 | alice |", "| 1 | bob |"].join("\n"),
  );
  await writeHandoff(ws, "whatever-feature");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, false, "no recognizable feature-identity column must never fabricate a verdict");
  assert.equal(typeof result.reason, "string");
  assert.deepEqual(result.mismatches, []);
});

test("AC4: unparseable handoff.md (malformed YAML frontmatter) degrades to compared:false, never throws", () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| feature id |", "|---|", "| e115-join-precondition-check |"].join("\n"),
  );
  // Deliberately malformed YAML frontmatter — an unterminated flow sequence.
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    "---\nactive_feature: [unterminated\n---\n# Handoff State\n",
  );

  let result;
  assert.doesNotThrow(() => {
    result = checkDeclaredVsActualLaneIdentity(ws);
  }, "an unparseable handoff must never throw out of checkDeclaredVsActualLaneIdentity");
  assert.equal(result.compared, false);
  assert.equal(typeof result.reason, "string");
  assert.deepEqual(result.mismatches, []);
});

test("AC4: parseable handoff with no active_feature recorded degrades honestly", () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| feature id |", "|---|", "| some-feature |"].join("\n"),
  );
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    '---\nstatus: "In_Progress"\n---\n# Handoff State\n',
  );

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, false);
  assert.equal(typeof result.reason, "string");
});

// ============================================================================
// AC5 — no exported signature takes a second workspace-path argument; no
// read/exec parameterized outside repoRoot / repoRoot/.current/**
// ============================================================================

test("AC5: exported function signatures (emitted .d.ts) take no second workspace-path argument", () => {
  assert.match(
    DTS,
    /export declare function checkLaneAncestry\(branches: string\[\], repoRoot: string\): LaneAncestryResult\[\];/,
    "checkLaneAncestry must take exactly (branches, repoRoot) — no additional workspace-path arg",
  );
  assert.match(
    DTS,
    /export declare function checkDeclaredVsActualLaneIdentity\(repoRoot: string\): LaneIdentityCheckResult;/,
    "checkDeclaredVsActualLaneIdentity must take exactly (repoRoot) — no additional workspace-path arg",
  );
  assert.match(
    DTS,
    /export declare function renderJoinPreconditionReport\(\s*ancestry: LaneAncestryResult\[\],\s*identity: LaneIdentityCheckResult,?\s*\): string;/,
    "renderJoinPreconditionReport must take only the two result objects — no path argument at all",
  );
});

test("AC5: no read/exec call in tools/join-precondition.ts is parameterized outside repoRoot / repoRoot/.current/**", () => {
  // Every fs.readFileSync / execFileSync call site in the source must be
  // anchored to `repoRoot` (directly, or via a path.join(repoRoot, ...)) —
  // never a second path parameter, never a sibling-worktree path.
  const readSites = [...SOURCE.matchAll(/fs\.readFileSync\(([^)]*)\)/g)].map((m) => m[1]);
  const execSites = [...SOURCE.matchAll(/execFileSync\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)].map(
    (m) => m[1],
  );
  assert.ok(readSites.length > 0, "sanity: source must contain at least one readFileSync call to check");
  for (const site of readSites) {
    assert.match(
      site,
      /splitPath|repoRoot/,
      `fs.readFileSync call must be anchored to repoRoot/.current path, got: ${site}`,
    );
  }
  for (const site of execSites) {
    assert.match(site, /repoRoot/, `execFileSync call must pin cwd to repoRoot, got: ${site}`);
  }
  // No second workspace-path-shaped parameter name anywhere in the module.
  assert.doesNotMatch(SOURCE, /workspacePath\d|otherRoot|siblingRoot|laneRoot/);
});

// ============================================================================
// AC6 — exactly one HOOK POINT FOR E126 comment, no E126 assertion logic
// ============================================================================

test("AC6: exactly one 'HOOK POINT FOR E126' comment exists, and no E126 assertion logic accompanies it", () => {
  const hookMatches = SOURCE.match(/HOOK POINT FOR E126/g) || [];
  assert.equal(hookMatches.length, 1, "exactly one HOOK POINT FOR E126 comment must exist in the module");

  const scriptHookMatches = SCRIPT_SOURCE.match(/HOOK POINT FOR E126/g) || [];
  assert.equal(scriptHookMatches.length, 0, "the CLI wrapper must carry zero hook-point comments of its own");

  // The hook point names what a future assertion needs but implements none
  // of it: no live pre/post-merge counting logic, no E126-specific export.
  assert.doesNotMatch(SOURCE, /function\s+\w*[Ee]126\w*/, "no E126-named function may exist yet");
  assert.doesNotMatch(
    SOURCE,
    /preMerge|postMerge/,
    "no pre/post-merge counting logic may be implemented ahead of E126",
  );
});

// ============================================================================
// AC9 (new) — markdown-decorated header + declared-value normalization
// ============================================================================

test("AC9: a **feature id** (bold-decorated) header is recognized, not degraded to compared:false", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| lane | **feature id** |", "|---|---|", "| 0 | e115-join-precondition-check |"].join(
      "\n",
    ),
  );
  await writeHandoff(ws, "e115-join-precondition-check");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(
    result.compared,
    true,
    "a markdown-decorated header must still be recognized as the feature-identity column",
  );
  assert.deepEqual(result.mismatches, []);
});

test("AC9: a backtick-quoted declared value normalizes before matching (no false mismatch)", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| feature id |", "|---|", "| `e115-join-precondition-check` |"].join("\n"),
  );
  await writeHandoff(ws, "e115-join-precondition-check");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.deepEqual(
    result.mismatches,
    [],
    "a backtick-decorated declared value equal to actual after stripping must NOT be reported as a mismatch",
  );
});

test("AC9: an internal underscore in a feature id round-trips unchanged (only leading/trailing decoration is stripped)", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| feature id |", "|---|", "| e115_join |", "| other-lane |"].join("\n"),
  );
  await writeHandoff(ws, "e115_join");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.deepEqual(
    result.mismatches,
    [],
    "an internal underscore is not decoration and must survive the strip unchanged so it still matches actual",
  );
});

test("AC9: internal underscore mismatch is still correctly reported (strip does not over-normalize into a false match)", async () => {
  const ws = mkWs();
  writeSplit(ws, ["| feature id |", "|---|", "| e115_join |"].join("\n"));
  // A DIFFERENT actual (no relation to e115_join) must still mismatch.
  await writeHandoff(ws, "e115-totally-different");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.equal(result.mismatches.length, 1);
  assert.deepEqual(result.mismatches[0].declaredFeatureIds, ["e115_join"]);
});

test("AC9: a decoration-only cell (e.g. '***') is dropped, never becomes an empty declared member", async () => {
  const ws = mkWs();
  writeSplit(
    ws,
    ["| feature id |", "|---|", "| *** |", "| e115-join-precondition-check |"].join("\n"),
  );
  await writeHandoff(ws, "e115-join-precondition-check");

  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(result.compared, true);
  assert.deepEqual(
    result.mismatches,
    [],
    "the decoration-only row must not pollute the declared set, and the real matching row must still satisfy membership",
  );
});

test("AC9: a Split Table whose ONLY rows are decoration-only cells degrades honestly (compared:false), never an empty-set fabricated verdict", () => {
  const ws = mkWs();
  writeSplit(ws, ["| feature id |", "|---|", "| *** |", "| ``` |"].join("\n"));
  const result = checkDeclaredVsActualLaneIdentity(ws);
  assert.equal(
    result.compared,
    false,
    "a declared set that collapses to nothing after stripping must degrade honestly, not fabricate a verdict",
  );
  assert.deepEqual(result.mismatches, []);
});

// ============================================================================
// AC7/AC8 — recorded as inspection-based in qa_reports/, not executed here.
// A thin marker test keeps the AC->test map complete without duplicating the
// SOP's inspection work as fake assertions.
// ============================================================================

test("AC7/AC8: inspection-only ACs are recorded in qa_reports/review_T-E115-03.md, not asserted here", () => {
  // Intentionally a no-op assertion of record — AC7 (CLI shape vs
  // scripts/feature-rollup.mjs) and AC8 (forbidden-path git diff --stat) are
  // inspection-based per the spec's own proof: line, executed and confirmed
  // in this round's review doc rather than encoded as a runtime assertion.
  assert.ok(true);
});

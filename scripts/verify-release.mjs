#!/usr/bin/env node
// Release self-check (E9): verifies a done-report's release claims before they
// are made. Checks run independently and any FAIL exits non-zero:
// (1) tag at HEAD, or only bookkeeping commits ahead of it (E141), (2) HEAD
// pushed upstream, (3) check-version.mjs green, (4) CHANGELOG entry, (5) dist/
// committed with a matching Server() version, (6) CI ground truth for this sha.
// Usage: node scripts/verify-release.mjs [vX.Y.Z] | --close-out | --ci-check [--strict] [--sha <sha>]
// Modes, posture and degradation rules: see specs/e260c-bin-scripts.md.

import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const EXEC_OPTS = {
  cwd: root,
  encoding: "utf-8",
  stdio: ["ignore", "pipe", "pipe"],
  maxBuffer: 32 * 1024 * 1024,
};

function git(args) {
  return execFileSync("git", args, EXEC_OPTS).trim();
}

// --- CLI flags ---------------------------------------------------------------
const argv = process.argv.slice(2);
const closeOut = argv.includes("--close-out");
const ciCheck = argv.includes("--ci-check");
const ciCheckStrict = argv.includes("--strict");
const shaFlagIdx = argv.indexOf("--sha");
let shaOverride;
if (shaFlagIdx !== -1) {
  const shaValue = argv[shaFlagIdx + 1];
  // A missing or flag-like value must fail loudly, not silently degrade to
  // HEAD: a caller who asked about a specific sha and got answered about a
  // different one (with no diagnostic) is the same class of defect this
  // gate exists to catch (F2, code-review round 1, T-E163-01).
  if (shaValue === undefined || shaValue.startsWith("--")) {
    console.error(
      `check:release — --sha requires a value (got ${JSON.stringify(shaValue ?? null)}) — refusing to silently fall back to HEAD`
    );
    process.exit(1);
  }
  shaOverride = shaValue;
}

// --- Independent check runner -----------------------------------------------
const failedChecks = [];

function runCheck(name, fn) {
  const fails = [];
  try {
    fn(fails);
  } catch (err) {
    // A guard that crashes must not pass silently: any unexpected error is a
    // FAIL for this check, and the remaining checks still run.
    fails.push(`FAIL: ${name} — unexpected error: ${err?.message ?? err}`);
  }
  if (fails.length === 0) {
    console.log(`OK: ${name}`);
  } else {
    for (const line of fails) console.error(line);
    failedChecks.push(name);
  }
}

// --- Close-out mode (E84): standalone ahead-of-upstream assertion -----------
// Runs no tag or version check, so it works AFTER the bookkeeping commit has
// moved HEAD past the release tag. Check 2 runs before that commit exists and
// cannot see it unpushed (how 6cd767b / v3.102.5 sat one commit ahead of origin).
if (closeOut) {
  runCheck("ahead-of-upstream", (fails) => {
    try {
      execFileSync("git", ["fetch", "origin"], EXEC_OPTS);
    } catch (err) {
      const detail = (err?.stderr ? String(err.stderr).trim() : "") || err?.message || String(err);
      fails.push(`FAIL: could not verify against origin: ${detail}`);
      return;
    }
    let upstreamRef;
    try {
      upstreamRef = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    } catch {
      fails.push("FAIL: no upstream tracking branch configured");
      return;
    }
    let aheadCount;
    try {
      aheadCount = Number(git(["rev-list", "--count", "@{u}..HEAD"]));
    } catch (err) {
      fails.push(`FAIL: could not compute ahead-of-upstream count: ${err?.message ?? err}`);
      return;
    }
    if (!Number.isFinite(aheadCount)) {
      fails.push("FAIL: could not compute ahead-of-upstream count: non-numeric git output");
      return;
    }
    if (aheadCount > 0) {
      fails.push(
        `FAIL: HEAD is ${aheadCount} commit(s) ahead of upstream ${upstreamRef} — not pushed`
      );
    }
  });

  if (failedChecks.length === 0) {
    console.log("check:release — CLOSE-OUT PASSED");
  } else {
    console.error(`check:release — FAILED (${failedChecks.length} check(s) failed)`);
    process.exit(1);
  }
  process.exit(0);
}

// --- CI-only mode (E163): pre-tag CI gate for SOP steps 2a and 8b -----------
// Runs ONLY the CI ground-truth check (see evaluateCIGroundTruth below, the
// same logic Check 6 uses) against a given sha — no version resolved, no tag
// required. `--strict` is the whole behavioral difference between step 2a's
// and step 8b's use of this mode; see the top-of-file comment for why.
if (ciCheck) {
  const sha = shaOverride || git(["rev-parse", "HEAD"]);
  console.log(
    `check:release — CI-only check (${ciCheckStrict ? "strict" : "lenient"}) for ${sha.slice(0, 12)}`
  );
  runCheck("CI ground-truth", (fails) => {
    evaluateCIGroundTruth({ sha, strict: ciCheckStrict, fails });
  });
  if (failedChecks.length === 0) {
    console.log(`check:release — CI-CHECK PASSED (${sha.slice(0, 12)})`);
    process.exit(0);
  } else {
    console.error(`check:release — CI-CHECK FAILED (${sha.slice(0, 12)})`);
    process.exit(1);
  }
}

// --- Resolve target version -------------------------------------------------
const rawArg = argv[0];
const version = rawArg
  ? rawArg.replace(/^v/, "")
  : JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8")).version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    `check:release — invalid target version ${JSON.stringify(rawArg ?? version)} (expected vX.Y.Z)`
  );
  process.exit(1);
}

console.log(`check:release — target version v${version}`);

// --- Bookkeeping-path allowlist (E141) ---------------------------------------
// Paths SOP step 13a stages at close-out (handoff, telemetry/metrics/usage
// sidecars), plus `tasks.md` as a harmless superset. Check 1 tolerates commits
// touching only these. Lane forms (E174a): any `.current/<lane>/`, lane as
// resolveCurrentLane() names it; LANE_SEGMENT_RE_SRC mirrors tools/lane-paths.ts
// (SAFE_LANE_RE, NON_LANE_DIRS) without a dist/ import, pinned by a drift-guard
// test. Flat forms stay for pre-flip workspaces. See specs/e260c-bin-scripts.md.
const LANE_SEGMENT_RE_SRC = "(?!(?:archive|history)\\/)[A-Za-z0-9_][A-Za-z0-9_-]*";
const BOOKKEEPING_PATH_RES = [
  /^\.current\/handoff\.md$/,
  /^\.current\/[^/]+\.jsonl$/,
  /^tasks\.md$/,
  new RegExp(`^\\.current\\/${LANE_SEGMENT_RE_SRC}\\/handoff\\.md$`),
  new RegExp(`^\\.current\\/${LANE_SEGMENT_RE_SRC}\\/[^/]+\\.jsonl$`),
  // Lane-local task ledgers are bookkeeping too (E126 T-E126-04; X5 / E198(a),
  // spec AC10) — a lane's tw_add_task / tw_complete_task write touches
  // `.current/<lane>/tasks.md` exactly as it touches that lane's handoff.md
  // and *.jsonl. The `_primary` literal is subsumed by the lane regex; it is
  // listed explicitly so the release lane's own ledger reads at a glance.
  /^\.current\/_primary\/tasks\.md$/,
  new RegExp(`^\\.current\\/${LANE_SEGMENT_RE_SRC}\\/tasks\\.md$`),
];

function isBookkeepingPath(p) {
  return BOOKKEEPING_PATH_RES.some((re) => re.test(p));
}

// --- Check 1: tag exists and points at HEAD (AC1/AC2; tolerance: E141) ------
// A tag not at HEAD keeps the FAIL UNLESS (i) the tag is an ancestor of HEAD
// AND (ii) every commit in <tag>..HEAD touches only the bookkeeping allowlist
// above — either condition failing keeps the existing FAIL (spec AC2/AC4).
runCheck("tag-at-HEAD", (fails) => {
  const tag = `v${version}`;
  let tagSha;
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]);
    tagSha = git(["rev-list", "-n", "1", tag]);
  } catch {
    fails.push(`FAIL: tag ${tag} does not exist`);
    return;
  }
  const headSha = git(["rev-parse", "HEAD"]);
  if (tagSha === headSha) {
    // AC1: byte-identical to today — the equality path is not the tolerance path.
    return;
  }

  const pointsAtHeadFail = `FAIL: tag ${tag} (${tagSha}) does not point at HEAD (${headSha})`;

  // AC4: ancestry is a precondition of the tolerance, never a substitute for
  // it — a rewritten/wrong-branch tag keeps the existing FAIL unchanged.
  let isAncestor = false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", tagSha, headSha], EXEC_OPTS);
    isAncestor = true;
  } catch {
    isAncestor = false;
  }
  if (!isAncestor) {
    fails.push(pointsAtHeadFail);
    return;
  }

  let commits;
  try {
    commits = git(["rev-list", `${tagSha}..${headSha}`])
      .split("\n")
      .filter(Boolean);
  } catch (err) {
    fails.push(`${pointsAtHeadFail} — could not enumerate commits in range: ${err?.message ?? err}`);
    return;
  }

  // AC6: an empty range cannot occur here — tagSha !== headSha and tagSha is
  // an ancestor of headSha together guarantee at least one commit ahead.
  const offenders = [];
  for (const sha of commits) {
    let files;
    try {
      // -m: a merge commit in range is judged by the same path rule (AC6) —
      // its diff against each parent is inspected, never vacuously skipped
      // (plain diff-tree reports no paths at all for a merge commit).
      files = git(["diff-tree", "-m", "--no-commit-id", "--name-only", "-r", sha])
        .split("\n")
        .filter(Boolean);
    } catch (err) {
      offenders.push(`${sha} (could not list changed paths: ${err?.message ?? err})`);
      continue;
    }
    const badPaths = [...new Set(files.filter((f) => !isBookkeepingPath(f)))];
    if (badPaths.length > 0) {
      offenders.push(`${sha.slice(0, 12)} touches ${badPaths.join(", ")}`);
    }
  }

  if (offenders.length > 0) {
    // AC3: the FAIL names the offending commit sha(s) and path(s) so the
    // operator does not have to re-derive the range by hand.
    fails.push(
      `${pointsAtHeadFail} — ${offenders.length} of ${commits.length} commit(s) in range touch non-bookkeeping paths: ${offenders.join("; ")}`
    );
    return;
  }

  // AC2: a tolerated pass must say so explicitly, naming the tolerated commit
  // count — a silent pass would hide exactly the state this check exists to
  // make visible.
  console.log(
    `NOTE: tag-at-HEAD — tolerated ${commits.length} governance-bookkeeping commit(s) ahead of tag ${tag} (${tagSha.slice(0, 12)}..${headSha.slice(0, 12)})`
  );
});

// --- Check 2: HEAD pushed to the upstream tracking branch (AC3) --------------
runCheck("pushed-to-origin", (fails) => {
  try {
    execFileSync("git", ["fetch", "origin"], EXEC_OPTS);
  } catch (err) {
    const detail = (err?.stderr ? String(err.stderr).trim() : "") || err?.message || String(err);
    fails.push(`FAIL: could not verify against origin: ${detail}`);
    return;
  }
  let upstreamRef;
  try {
    upstreamRef = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  } catch {
    fails.push("FAIL: no upstream tracking branch configured");
    return;
  }
  const headSha = git(["rev-parse", "HEAD"]);
  const upstreamSha = git(["rev-parse", "@{u}"]);
  if (headSha !== upstreamSha) {
    fails.push(
      `FAIL: HEAD (${headSha}) != upstream ${upstreamRef} (${upstreamSha}) — local commits not pushed`
    );
  }
});

// --- Check 3: check-version.mjs green, invoked as-is (AC4) -------------------
runCheck("check-version", (fails) => {
  const res = spawnSync(process.execPath, [path.join(here, "check-version.mjs")], {
    cwd: root,
    encoding: "utf-8",
  });
  if (res.status !== 0) {
    const stderr =
      (res.stderr || "").trim() || (res.error ? String(res.error.message) : "(no stderr)");
    fails.push(`FAIL: check-version.mjs failed: ${stderr}`);
  }
});

// --- Check 4: CHANGELOG entry for the target version (AC5) -------------------
runCheck("CHANGELOG entry", (fails) => {
  let changelog;
  try {
    changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");
  } catch {
    fails.push(`FAIL: CHANGELOG.md has no entry for v${version}`);
    return;
  }
  const escaped = version.replace(/\./g, "\\.");
  if (!new RegExp(`^##\\s+\\[${escaped}\\]`, "m").test(changelog)) {
    fails.push(`FAIL: CHANGELOG.md has no entry for v${version}`);
  }
});

// --- Check 5: dist committed + committed-artifact parity (AC6/AC7) -----------
// The two sub-checks report independently: uncommitted dist changes (AC6) do
// not mask a version mismatch in the dist actually committed at HEAD (AC7).
runCheck("dist committed+parity", (fails) => {
  const porcelain = git(["status", "--porcelain", "--", "dist/"]);
  if (porcelain !== "") {
    fails.push("FAIL: dist/ has uncommitted changes — rebuild and commit before releasing");
  }

  let committedDist;
  try {
    committedDist = execFileSync("git", ["show", "HEAD:dist/index.js"], EXEC_OPTS);
  } catch {
    fails.push("FAIL: dist/index.js not found at HEAD — was it committed?");
    return;
  }
  const dm = committedDist.match(/name:\s*"agent-governance-mcp",\s*version:\s*"([^"]+)"/);
  if (!dm) {
    fails.push("FAIL: could not find Server() version literal in committed dist/index.js");
  } else if (dm[1] !== version) {
    fails.push(`FAIL: committed dist/index.js version (${dm[1]}) != target v${version}`);
  }
});

// --- Check 6: CI ground truth on the derived branch (E14; sha-matched per ---
// --- E78; bounded-poll per E80; branch derived per E165) ---------------------
// Ground truth is the completed `--workflow CI` run whose headSha is the
// released commit, never simply the newest run (E78), on the branch derived
// from the checkout (E165). A not-yet-listed run is polled for (E80); any
// inability to get an answer WARNs, and only a non-success conclusion for this
// sha FAILs. See specs/e260c-bin-scripts.md.

// --- Shared CI ground-truth evaluator (E163) --------------------------------
// Check 6 and --ci-check (SOP steps 2a and 8b) share this one implementation.
// `strict` is the only parameter: false is Check 6's WARN-and-continue on any
// inability to get ground truth; true turns each such WARN into a FAIL (8b).
function evaluateCIGroundTruth({ sha: releaseSha, strict, fails }) {
  // WARNs (and poll-progress lines) go to stdout, not stderr: the script's
  // contract (pinned by VR-8) reserves stderr for FAIL lines — a fully
  // passing run prints nothing there. In strict mode there is no WARN path at
  // all: every reason that would otherwise be WARNed is instead pushed onto
  // `fails` (which does print to stderr, via runCheck), because an
  // unresolved CI status is not consent to publish an immutable tag.
  const warn = (reason) => {
    if (strict) {
      fails.push(
        `FAIL: CI ground-truth — ${reason} — refusing to proceed under the strict pre-tag gate (no graceful degradation here: an unresolved CI status is not consent to publish an immutable tag)`
      );
      return;
    }
    console.log(`WARN: CI ground-truth — ${reason}; continuing without CI verification (graceful degradation, E14)`);
  };

  const POLL_INTERVAL_SECONDS = 20;
  const DEFAULT_WAIT_SECONDS = 480;
  const rawBudget = process.env.AGC_VERIFY_CI_WAIT_SECONDS;
  const parsedBudget = rawBudget === undefined || rawBudget === "" ? NaN : Number(rawBudget);
  const waitBudgetSeconds =
    Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : DEFAULT_WAIT_SECONDS;

  // The CI branch (E165) is derived from the checkout, never assumed `main`:
  // the upstream (`@{u}`) with its remote prefix stripped, else the local branch;
  // a detached HEAD has none and goes through warn(). Returns { branch, label }
  // (`label` is the full upstream ref when there is one) or null after warn().
  function deriveCIBranch() {
    let current;
    try {
      current = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    } catch {
      warn("could not determine the current branch (git rev-parse --abbrev-ref HEAD failed)");
      return null;
    }
    if (current === "" || current === "HEAD") {
      warn("detached HEAD — no branch to query CI runs for");
      return null;
    }

    let upstream = "";
    try {
      upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    } catch {
      upstream = ""; // no upstream configured — fall back to the local branch
    }

    let branch = current;
    let label = current;
    if (upstream !== "") {
      let remote = "";
      try {
        remote = git(["config", "--get", `branch.${current}.remote`]);
      } catch {
        remote = "";
      }
      if (remote === ".") {
        // Upstream is a local branch — abbrev-ref already carries no prefix.
        branch = upstream;
      } else if (remote !== "" && upstream.startsWith(`${remote}/`)) {
        branch = upstream.slice(remote.length + 1);
      } else {
        const slash = upstream.indexOf("/");
        branch = slash === -1 ? upstream : upstream.slice(slash + 1);
      }
      label = upstream;
    }

    // Defensive boundary check before the value becomes a gh argv element:
    // git refnames can never be empty or begin with "-", so either shape
    // means the derivation went wrong — never pass it to gh as a flag.
    if (branch === "" || branch.startsWith("-")) {
      warn(`could not derive a usable branch name for the CI query (got ${JSON.stringify(branch)})`);
      return null;
    }
    return { branch, label };
  }

  const derived = deriveCIBranch();
  if (derived === null) return;
  const { branch: ciBranch, label: ciBranchLabel } = derived;

  function listCompletedRuns() {
    return spawnSync(
      "gh",
      [
        "run",
        "list",
        "--branch",
        ciBranch,
        "--workflow",
        "CI",
        "--status",
        "completed",
        "--limit",
        "10",
        "--json",
        "conclusion,headSha,url,updatedAt",
      ],
      { cwd: root, encoding: "utf-8" }
    );
  }

  // Synchronous sleep — this script runs as a plain top-to-bottom sequence of
  // subprocess calls (execFileSync/spawnSync throughout), so the poll loop
  // below blocks the same way rather than introducing async control flow.
  function sleepSync(ms) {
    if (ms <= 0) return;
    const view = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(view, 0, 0, ms);
  }

  const deadline = Date.now() + waitBudgetSeconds * 1000;

  for (;;) {
    const res = listCompletedRuns();

    if (res.error) {
      // Spawn-level failure — gh binary missing (ENOENT) or not executable.
      warn(`gh CLI unavailable (${res.error.code ?? res.error.message})`);
      return;
    }
    if (res.status !== 0) {
      // gh ran but errored — unauthenticated, network failure, workflow not
      // found, etc. All are "cannot obtain ground truth", never a release FAIL.
      const detail = (res.stderr || "").trim().split("\n")[0] || `gh exited ${res.status}`;
      warn(`gh run list failed: ${detail}`);
      return;
    }

    let runs;
    try {
      runs = JSON.parse(res.stdout);
    } catch {
      warn("could not parse gh run list output");
      return;
    }
    if (!Array.isArray(runs) || runs.length === 0) {
      warn(`no completed CI runs found on ${ciBranchLabel}`);
      return;
    }

    // Ground truth is the completed run whose headSha IS the released commit,
    // not runs[0], which may belong to an earlier commit (E78). A run for an
    // earlier commit is neither "no runs" nor "red", so it degrades like any
    // other cannot-obtain-ground-truth path.
    const matched = runs.find((r) => r.headSha === releaseSha);
    if (matched) {
      const { conclusion, headSha, url } = matched;
      if (conclusion !== "success") {
        fails.push(
          `FAIL: latest completed CI run on ${ciBranch} concluded "${conclusion}" (head ${String(headSha).slice(0, 12)}) — ${url ?? "no url"}`
        );
      }
      return;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      warn(
        `this commit's CI has not completed yet (head ${releaseSha.slice(0, 12)} not found among the last ${runs.length} completed run(s) on ${ciBranch})`
      );
      return;
    }

    const sleepMs = Math.min(POLL_INTERVAL_SECONDS * 1000, remainingMs);
    console.log(
      `check:release — CI ground-truth: head ${releaseSha.slice(0, 12)} not found among the last ${runs.length} completed run(s) yet; polling again in ${Math.round(sleepMs / 1000)}s (~${Math.round(remainingMs / 1000)}s left in budget)`
    );
    sleepSync(sleepMs);
  }
}

runCheck("CI ground-truth", (fails) => {
  // AC1/AC2: resolve the released sha from the tag first — the same
  // two-call pattern Check 1 uses above (rev-parse --verify then
  // rev-list -n 1) — so a governance-bookkeeping commit made AFTER the tag
  // (E141 tolerance) is never polled/matched in this check's place. Fall
  // back to HEAD only when the tag doesn't exist yet (unchanged pre-tag
  // behavior).
  let releaseSha;
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`]);
    releaseSha = git(["rev-list", "-n", "1", `v${version}`]);
  } catch {
    releaseSha = git(["rev-parse", "HEAD"]);
  }
  evaluateCIGroundTruth({ sha: releaseSha, strict: false, fails });
});

// --- Summary -----------------------------------------------------------------
if (failedChecks.length === 0) {
  console.log(`check:release — ALL CHECKS PASSED (v${version})`);
} else {
  console.error(`check:release — FAILED (${failedChecks.length} check(s) failed)`);
  process.exit(1);
}

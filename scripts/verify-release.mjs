#!/usr/bin/env node
// Release self-check (E9). Verifies that the release artifacts a done-report
// claims actually exist BEFORE the claim is made: (1) tag exists and points at
// HEAD — or, when HEAD has moved past the tag, every commit ahead of it is a
// governance-bookkeeping commit only (E141: touches nothing outside
// .current/<lane>/handoff.md, .current/<lane>/*.jsonl, tasks.md — lane paths
// per E174a, flat .current/ forms still accepted); any other path, or a tag
// that is not an ancestor of HEAD, keeps the FAIL — (2) HEAD is pushed to the
// upstream tracking branch, (3)
// scripts/check-version.mjs is green (invoked as a subprocess, never
// re-implemented), (4) CHANGELOG.md has an entry for the target version,
// (5) dist/ is committed and the committed dist/index.js Server() literal
// matches the target version, (6) CI ground truth (E14/E78/E80): the
// COMPLETED CI run for THIS release's sha on the release's branch (derived
// from the checkout's upstream, E165) concluded success —
// self-reported "npm test green" is not a substitute for what CI actually
// said. When that run hasn't completed yet, Check 6 bounded-polls `gh run
// list` for it (default ~480 seconds via AGC_VERIFY_CI_WAIT_SECONDS, `0` = no
// wait, exactly one `gh` call) before giving up. Check 6 degrades gracefully by
// design: when `gh` is missing, unauthenticated, there are no completed CI
// runs to read, or the poll budget expires with this sha still not found, it
// WARNs and continues (never blocks a release on missing tooling or a
// slow-finishing run); it FAILs ONLY on a definitively non-success conclusion
// for this sha.
//
// Checks run independently — a failure in one never prevents the others from
// running and reporting — so a multi-cause failure surfaces every cause in a
// single run. Any failure exits non-zero with per-check FAIL lines; the script
// can therefore never underwrite a false "Released" claim.
//
// Usage: node scripts/verify-release.mjs [vX.Y.Z]
// When the version argument is omitted, the target defaults to package.json's
// `version` field.
//
// Unlike check-version.mjs's advisory git-tag note, nothing here is advisory:
// a `git fetch origin` failure (network/auth) is itself a FAIL for the push
// check — this script never silently skips the check that closes the gap it
// exists for: a "Released" claim nobody verified (E9).
//
// --close-out mode (E84): `node scripts/verify-release.mjs --close-out` runs
// ONLY a standalone ahead-of-upstream assertion — no version is resolved or
// required, and Check 1 (tag-at-HEAD) and the version-dependent Checks 3-6 do
// not run. It exists to be runnable AFTER the governance bookkeeping commit
// (handoff/metrics — kept separate from the release commit per E71c; tasks.md
// is staged by step 8a's release commit itself, never by this bookkeeping
// commit, per E143) has landed and pushed HEAD past the release tag. A normal
// run's Check 1 now already tolerates that single bookkeeping-only commit
// automatically (E141; with an explicit tolerance note) — --close-out remains
// for what the tolerance does not cover: real source changes ahead of the tag,
// or a tag that is not an ancestor of HEAD, where a normal run still fails
// Check 1 by construction. Today this is a manual, documented command; no
// automatic invocation point exists yet.
//
// --ci-check mode (E163): `node scripts/verify-release.mjs --ci-check
// [--strict] [--sha <sha>]` runs ONLY the CI ground-truth logic that Check 6
// already implements below (same sha-resolution shape, same bounded poll via
// `gh run list`, same AGC_VERIFY_CI_WAIT_SECONDS budget) — factored out so
// neither release-SOP call site duplicates it. No version is resolved and no
// tag is required; the sha checked defaults to `git rev-parse HEAD` (or the
// literal passed via --sha). Two call sites, two postures:
//   - release-engineer SOP step 2a (lenient, no --strict): a pre-flight gate
//     at release entry, on whatever HEAD already is — a definite `failure`
//     conclusion for that sha exits non-zero (STOP); an inconclusive read
//     (`gh` missing/unauthenticated, no completed runs, poll budget expired
//     with this sha still not found) WARNs and exits 0, identical to Check
//     6's own graceful degradation (E14/E78/E80) — there is nothing to
//     protect yet at this point, so "we don't know" is not a reason to
//     refuse to start.
//   - release-engineer SOP step 8b (--strict): the gate between the branch
//     push (8a) and the tag push (8c) — the one point in the SOP before an
//     immutable artifact (the tag) is published. `--strict` disables the
//     WARN-and-continue path entirely: every condition that would normally
//     WARN instead FAILs, so an inconclusive CI read STOPs the release
//     exactly like a definite red does. This is intentionally stricter than
//     Check 6 (step 9a), which runs AFTER publication and rightly treats
//     "can't tell" as non-blocking — there is nothing left to prevent by
//     then. Before the tag push, there still is.
// Exit code: 0 on OK/WARN (lenient) or OK only (strict); 1 on FAIL. Output
// mirrors the OK:/WARN:/FAIL: lines Check 6 already prints, under a
// `check:release — CI-CHECK PASSED/FAILED` summary distinct from the
// full-run and --close-out summaries so a caller can grep unambiguously for
// its own mode's result.

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
// Deliberately does NOT run Check 1 (tag-at-HEAD) or any version-dependent
// check (3-6), and resolves no version argument at all — this mode exists to
// be runnable AFTER the governance bookkeeping commit lands and HEAD sits, by
// design, past the release tag. It closes the temporal gap Check 2 cannot:
// Check 2 runs BEFORE the bookkeeping commit exists, so at that point there
// is nothing unpushed yet to see (this is what left 6cd767b / v3.102.5 one
// commit ahead of origin/main, undetected, for a full release cycle).
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
// The paths SOP step 13a stages when it closes a release out: the handoff's
// closing write and the per-run telemetry/metrics/usage sidecars. `tasks.md`
// is staged by step 8's release commit, never by 13a (E143) — it stays in
// this allowlist anyway as a harmless superset: tolerating a stray
// tasks.md-only commit in range costs nothing, so the list is a safety
// margin rather than a precise mirror of 13a's `git add`. Check 1 below
// tolerates a tag followed ONLY by commit(s) that touch paths in this list
// and nothing else; any other path in range keeps the FAIL.
//
// Lane-layout paths (E174a): since state moved into per-lane directories (the
// lane flip, E123), 13a stages `.current/<lane>/handoff.md` +
// `.current/<lane>/*.jsonl` (lane = resolveCurrentLane(): `_primary` or a
// ticket id). Any single-segment lane dir is accepted, not only the release's
// own — the tolerance is about bookkeeping-only commits. LANE_SEGMENT_RE_SRC
// mirrors tools/lane-paths.ts: its char class is SAFE_LANE_RE /
// isSafeLaneName, its negative lookahead is NON_LANE_DIRS (archive, history).
// Kept standalone (no dist/ import) on purpose; a drift-guard test pins the
// mirror. The flat forms stay accepted for pre-flip workspaces and tag ranges
// that predate the flip.
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
// Reads recent COMPLETED runs of the CI workflow (`--workflow CI`) on the
// release's branch via the gh CLI and finds the one whose headSha matches the commit actually being
// released — NOT just "whatever completed run happens to be listed first".
// A fast release push can complete `git push` + `gh release` before its own
// CI run finishes; when that happens, the previously-first completed run
// belongs to an EARLIER commit, and treating its conclusion as ground truth
// for THIS release answers a different question (E78: v3.102.2 shipped this
// way — the release's own run was still in flight, 56s in, and the check
// reported PASS off the prior day's green run on a different sha).
//
// The branch is DERIVED from the current checkout (E165), never hardcoded to
// `main` (a release cut from a maintenance/hotfix branch previously had its CI
// interrogated on main's runs, so the sha never matched and the operator was
// told CI never answered when it had been asked about the wrong branch).
// Order: the checkout's upstream (`@{u}`, remote prefix stripped) -> else the
// current local branch -> a detached HEAD has no branch, which is a
// cannot-obtain-ground-truth condition (WARN here; FAIL under --strict). The
// `--workflow CI` qualifier is kept: without it `gh run list --branch` was
// observed returning fortnight-old runs. Only the branch is derived — how the
// released sha is resolved (from the tag, per E147) is unchanged.
//
// Bounded poll (E80): on a healthy release, THIS commit's CI run is almost
// always STILL IN FLIGHT the moment this check runs (step 9a fires seconds
// after the triggering push) — so the sha-not-found branch below is the
// DEFAULT path on a healthy release, not a degraded one, and giving up on the
// first miss let releases ship with CI silently unverified. That branch now
// bounded-polls `gh run list` for the released sha instead of giving up
// immediately: budget from AGC_VERIFY_CI_WAIT_SECONDS (default 480 seconds;
// `0` = no wait, exactly one `gh` call — the behavior before polling existed),
// polling every ~20s and printing progress to stdout (never stderr — see
// below). A completed run for this sha appearing mid-poll is evaluated exactly
// as before: success -> OK, non-success -> the existing FAIL.
//
// Graceful degradation is still load-bearing (backlog E14 / T-EB-01, extended
// by E78 and E80): any inability to OBTAIN ground truth for THIS commit — no
// derivable branch (detached HEAD, E165), gh not installed, gh
// unauthenticated, network/API error, unparseable output, zero completed runs,
// or the poll budget expiring with no completed run found for this sha — emits
// the SAME WARN and leaves the check green, preserving the exit-0 path that
// predates Check 6 exactly (the sha-match contract, E78, is preserved, not
// inverted: the poll only improves the odds of finding ground truth, it never
// turns a miss into a FAIL). The ONLY failure mode is a definitively red
// answer: a completed run for THIS commit whose conclusion is not "success".

// --- Shared CI ground-truth evaluator (E163) --------------------------------
// Factored out of Check 6 so SOP steps 2a and 8b (the --ci-check mode above)
// reuse this exact sha-resolution-and-poll mechanism rather than a second
// implementation. `strict` is the only behavioral parameter: false reproduces
// Check 6's behavior from before this extraction byte-for-byte
// (WARN-and-continue on any inability to obtain ground truth); true converts
// every one of those WARN conditions into a FAIL instead — used by step 8b,
// never by Check 6 itself.
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

  // The branch whose CI runs are ground truth (E165) is DERIVED from the
  // current checkout, never assumed to be `main` — a release cut from a
  // maintenance/hotfix branch must interrogate that branch's runs, not
  // main's. Derivation order:
  //   1. the checkout's upstream (`@{u}`), remote prefix stripped — the
  //      branch as the remote (and therefore GitHub Actions) names it;
  //   2. otherwise the current local branch name;
  //   3. a detached HEAD (`HEAD`) has no branch at all — that is a
  //      cannot-obtain-ground-truth condition, reported via warn() (so the
  //      strict pre-tag gate turns it into a FAIL, and the lenient paths
  //      degrade exactly like every other inconclusive read).
  // Returns { branch, label } on success — `label` is the human-readable
  // name used where messages previously said `origin/main` (the full upstream
  // ref when one exists, else the bare branch) — or null after warn().
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

    // Ground truth for THIS release is the completed run whose headSha IS the
    // commit being released — not runs[0], which is merely the most recently
    // completed run on the derived branch and may belong to an earlier, unrelated commit
    // (E78). A completed run for an earlier commit is not "nothing to go on"
    // (that's the zero-runs branch above) and it is not "this commit is red"
    // either — it is simply the wrong answer, so it degrades exactly like any
    // other cannot-obtain-ground-truth path rather than being accepted or
    // treated as a fatal mismatch.
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

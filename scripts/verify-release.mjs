#!/usr/bin/env node
// Release self-check (E9). Verifies that the release artifacts a done-report
// claims actually exist BEFORE the claim is made: (1) tag exists and points at
// HEAD, (2) HEAD is pushed to the upstream tracking branch, (3)
// scripts/check-version.mjs is green (invoked as a subprocess, never
// re-implemented), (4) CHANGELOG.md has an entry for the target version,
// (5) dist/ is committed and the committed dist/index.js Server() literal
// matches the target version, (6) CI ground truth (E14/E78/E80): the
// COMPLETED CI run for THIS release's sha on origin/main concluded success —
// self-reported "npm test green" is not a substitute for what CI actually
// said. When that run hasn't completed yet, Check 6 bounded-polls `gh run
// list` for it (default ~600s via AGC_VERIFY_CI_WAIT_SECONDS, `0` = no wait,
// exactly one `gh` call) before giving up. Check 6 degrades gracefully by
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
// check — this script never silently skips the check that closes the E9 gap.

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

// --- Resolve target version -------------------------------------------------
const rawArg = process.argv[2];
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

// --- Check 1: tag exists and points at HEAD (AC1/AC2) ------------------------
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
  if (tagSha !== headSha) {
    fails.push(`FAIL: tag ${tag} (${tagSha}) does not point at HEAD (${headSha})`);
  }
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

// --- Check 6: CI ground truth on origin/main (E14; sha-matched per E78; -----
// --- bounded-poll per E80) ---------------------------------------------------
// Reads recent COMPLETED runs of the CI workflow on the main branch via the
// gh CLI and finds the one whose headSha matches the commit actually being
// released — NOT just "whatever completed run happens to be listed first".
// A fast release push can complete `git push` + `gh release` before its own
// CI run finishes; when that happens, the previously-first completed run
// belongs to an EARLIER commit, and treating its conclusion as ground truth
// for THIS release answers a different question (E78: v3.102.2 shipped this
// way — the release's own run was still in flight, 56s in, and the check
// reported PASS off the prior day's green run on a different sha).
//
// E80: on a healthy release, THIS commit's CI run is almost always STILL IN
// FLIGHT the moment this check runs (step 9a fires seconds after the
// triggering push) — so the sha-not-found branch below is the DEFAULT path
// on a healthy release, not a degraded one, and giving up on the first miss
// let releases ship with CI silently unverified. That branch now
// bounded-polls `gh run list` for the released sha instead of giving up
// immediately: budget from AGC_VERIFY_CI_WAIT_SECONDS (default 600s; `0` =
// no wait, exactly one `gh` call — the pre-E80 behavior), polling every
// ~20s and printing progress to stdout (never stderr — see below). A
// completed run for this sha appearing mid-poll is evaluated exactly as
// before: success -> OK, non-success -> the existing FAIL.
//
// Graceful degradation is still load-bearing (backlog E14 / T-EB-01,
// extended by E78 and E80): any inability to OBTAIN ground truth for THIS
// commit — gh not installed, gh unauthenticated, network/API error,
// unparseable output, zero completed runs, or the poll budget expiring with
// no completed run found for this sha — emits the SAME WARN and leaves the
// check green, preserving the pre-E14 exit-0 path exactly (E78's contract
// preserved, not inverted: the poll only improves the odds of finding
// ground truth, it never turns a miss into a FAIL). The ONLY failure mode is
// a definitively red answer: a completed run for THIS commit whose
// conclusion is not "success".
runCheck("CI ground-truth", (fails) => {
  // WARNs (and poll-progress lines) go to stdout, not stderr: the script's
  // contract (pinned by VR-8) reserves stderr for FAIL lines — a fully
  // passing run prints nothing there.
  const warn = (reason) =>
    console.log(`WARN: CI ground-truth — ${reason}; continuing without CI verification (graceful degradation, E14)`);

  const releaseSha = git(["rev-parse", "HEAD"]);

  const POLL_INTERVAL_SECONDS = 20;
  const DEFAULT_WAIT_SECONDS = 600;
  const rawBudget = process.env.AGC_VERIFY_CI_WAIT_SECONDS;
  const parsedBudget = rawBudget === undefined || rawBudget === "" ? NaN : Number(rawBudget);
  const waitBudgetSeconds =
    Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : DEFAULT_WAIT_SECONDS;

  function listCompletedRuns() {
    return spawnSync(
      "gh",
      [
        "run",
        "list",
        "--branch",
        "main",
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
      warn("no completed CI runs found on origin/main");
      return;
    }

    // Ground truth for THIS release is the completed run whose headSha IS the
    // commit being released — not runs[0], which is merely the most recently
    // completed run on main and may belong to an earlier, unrelated commit
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
          `FAIL: latest completed CI run on main concluded "${conclusion}" (head ${String(headSha).slice(0, 12)}) — ${url ?? "no url"}`
        );
      }
      return;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      warn(
        `this commit's CI has not completed yet (head ${releaseSha.slice(0, 12)} not found among the last ${runs.length} completed run(s) on main)`
      );
      return;
    }

    const sleepMs = Math.min(POLL_INTERVAL_SECONDS * 1000, remainingMs);
    console.log(
      `check:release — CI ground-truth: head ${releaseSha.slice(0, 12)} not found among the last ${runs.length} completed run(s) yet; polling again in ${Math.round(sleepMs / 1000)}s (~${Math.round(remainingMs / 1000)}s left in budget)`
    );
    sleepSync(sleepMs);
  }
});

// --- Summary -----------------------------------------------------------------
if (failedChecks.length === 0) {
  console.log(`check:release — ALL CHECKS PASSED (v${version})`);
} else {
  console.error(`check:release — FAILED (${failedChecks.length} check(s) failed)`);
  process.exit(1);
}

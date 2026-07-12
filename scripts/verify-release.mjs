#!/usr/bin/env node
// Release self-check (E9). Verifies that the release artifacts a done-report
// claims actually exist BEFORE the claim is made: (1) tag exists and points at
// HEAD, (2) HEAD is pushed to the upstream tracking branch, (3)
// scripts/check-version.mjs is green (invoked as a subprocess, never
// re-implemented), (4) CHANGELOG.md has an entry for the target version,
// (5) dist/ is committed and the committed dist/index.js Server() literal
// matches the target version.
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

// --- Summary -----------------------------------------------------------------
if (failedChecks.length === 0) {
  console.log(`check:release — ALL CHECKS PASSED (v${version})`);
} else {
  console.error(`check:release — FAILED (${failedChecks.length} check(s) failed)`);
  process.exit(1);
}

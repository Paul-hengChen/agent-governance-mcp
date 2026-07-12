#!/usr/bin/env node
// Fail the build if package.json `version`, the Server() literal in index.ts,
// and (when available) the CHANGELOG's latest released version drift apart.
// Git tag verification is advisory: it only fires when running inside a git
// checkout AND a tag matching the package version exists — so fresh clones
// and pre-release commits aren't blocked.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
const indexSrc = readFileSync(path.join(root, "index.ts"), "utf-8");

const m = indexSrc.match(/name:\s*"agent-governance-mcp",\s*version:\s*"([^"]+)"/);
if (!m) {
  console.error("check:version — could not find Server() version literal in index.ts");
  process.exit(1);
}

if (m[1] !== pkg.version) {
  console.error(
    `check:version — version mismatch: package.json=${pkg.version} index.ts=${m[1]}.\n` +
      "Update both to the same value before building."
  );
  process.exit(1);
}

// Compiled-artifact parity: dist/index.js is what `npx github:...#<tag>`
// consumers actually run. A stale dist (built before the version bump) shipping
// alongside correctly-bumped source + package.json is the v3.74.0 near-miss —
// dist carried "3.73.1" while everything else was "3.74.0" and the check still
// passed. If dist/index.js exists we assert its Server() literal too, and fail
// loud on either a mismatch OR a parse failure (a guard that can't find what it
// checks must not pass silently). If dist/index.js is absent (fresh clone before
// `npm run build`), we skip with a note — mirroring the git-tag check's
// "not in a git checkout" tolerance.
const distPath = path.join(root, "dist", "index.js");
if (existsSync(distPath)) {
  const distSrc = readFileSync(distPath, "utf-8");
  const dm = distSrc.match(/name:\s*"agent-governance-mcp",\s*version:\s*"([^"]+)"/);
  if (!dm) {
    console.error(
      "check:version — could not find dist version literal: no Server() version literal in dist/index.js.\n" +
        "The compiled artifact exists but is unparseable — run `npm run build`."
    );
    process.exit(1);
  }
  if (dm[1] !== pkg.version) {
    console.error(
      `check:version — dist version mismatch: package.json=${pkg.version} dist/index.js=${dm[1]}.\n` +
        "Rebuild (`npm run build`) so the shipped artifact matches before tagging."
    );
    process.exit(1);
  }
  console.log(`check:version — dist/index.js parity OK (${dm[1]})`);
} else {
  console.log(
    "check:version — note: dist/index.js not present (unbuilt checkout). " +
      "Skipping dist parity check; run `npm run build` before publishing."
  );
}

// CHANGELOG check: highest `## [x.y.z]` heading should match package.json.
// If it doesn't, the version was bumped without recording the change.
try {
  const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");
  const versions = [...changelog.matchAll(/^##\s+\[(\d+\.\d+\.\d+)\]/gm)].map((x) => x[1]);
  if (versions.length > 0 && versions[0] !== pkg.version) {
    console.error(
      `check:version — CHANGELOG.md latest release is ${versions[0]} but package.json is ${pkg.version}.\n` +
        "Add a new CHANGELOG entry before bumping the package version."
    );
    process.exit(1);
  }
} catch {
  // No CHANGELOG yet — skip silently. This script pre-dates the file in old checkouts.
}

// Git tag check (advisory only). Fresh commits without a tag are normal during
// development; the message just nudges to tag before publishing.
try {
  execSync("git rev-parse --git-dir", { cwd: root, stdio: "ignore" });
  const tagName = `v${pkg.version}`;
  try {
    execSync(`git rev-parse --verify --quiet refs/tags/${tagName}`, {
      cwd: root,
      stdio: "ignore",
    });
    const head = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
    const tagged = execSync(`git rev-list -n 1 ${tagName}`, { cwd: root }).toString().trim();
    if (head !== tagged) {
      console.log(
        `check:version — note: HEAD (${head.slice(0, 7)}) is past tag ${tagName} (${tagged.slice(0, 7)}). ` +
          "Bump version + add CHANGELOG entry before tagging next release."
      );
    }
  } catch {
    console.log(`check:version — note: no git tag ${tagName} yet. Tag before publishing.`);
  }
} catch {
  // Not in a git checkout (e.g. npx tarball install). Skip silently.
}

console.log(`check:version — OK (${pkg.version})`);

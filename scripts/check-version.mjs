#!/usr/bin/env node
// Fail the build if package.json `version`, the Server() literal in index.ts,
// and (when available) the CHANGELOG's latest released version drift apart.
// Git tag verification is advisory: it only fires when running inside a git
// checkout AND a tag matching the package version exists — so fresh clones
// and pre-release commits aren't blocked.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
const indexSrc = readFileSync(path.join(root, "index.ts"), "utf-8");

const m = indexSrc.match(/name:\s*"teamwork-mcp-server",\s*version:\s*"([^"]+)"/);
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

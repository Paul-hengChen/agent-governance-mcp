#!/usr/bin/env node
// Fail the build if package.json `version` is out of sync with the version
// string passed to `new Server(...)` in index.ts.

import { readFileSync } from "node:fs";
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

console.log(`check:version — OK (${pkg.version})`);

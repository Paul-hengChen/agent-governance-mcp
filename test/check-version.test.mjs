// Coded by @qa-engineer
// Tests for specs/e11-e12-release-integrity-batch.md AC1-AC4 (E11 —
// check-version.mjs dist/index.js parity check), authored per T-E11E12-03
// (AC5, qa-owned). No prior test/check-version.test.mjs existed — this file
// is NEW, created under the dispatch's pre-authorization (tasks.md
// T-E11E12-03 / the approved cut) since skill-qa-engineer §Phase 3a normally
// requires asking before creating a parallel test file.
//
// check-version.mjs resolves its own `root` from `import.meta.url` (dirname
// of the script file, one level up) — it is NOT parameterized by cwd or argv.
// So to exercise it against synthetic fixtures (matching / mismatched /
// unparseable / absent dist), each test copies the REAL script byte-for-byte
// into a temp fixture root's scripts/ dir and lays out package.json +
// index.ts (+ dist/index.js) beside it, then spawns that copy. This drives
// the actual shipped logic (not a reimplementation) while never touching the
// real repo's package.json / index.ts / dist/index.js.
//
// Spec-to-Test map:
//   AC1 (match -> exit 0, existing checks unchanged)      -> CV-1
//   AC2 (dist mismatch -> exit non-zero, names both)      -> CV-2
//   AC3 (dist parse-fail -> exit non-zero, fail loud)     -> CV-3
//   AC3 (dist absent -> exit 0, skip note, no crash)      -> CV-4
//   AC4 (existing success line still prints unchanged)    -> CV-1, CV-4

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const REAL_SCRIPT = fs.readFileSync(
  path.join(PROJECT_ROOT, "scripts", "check-version.mjs"),
  "utf-8",
);

// Sanity: fail loudly (not silently skip) if the real script's shape drifts
// out from under this fixture builder (e.g. the Server() regex changes).
const EXPECTED_REGEX_SOURCE = 'name:\\s*"agent-governance-mcp",\\s*version:\\s*"([^"]+)"';
assert.ok(
  REAL_SCRIPT.includes(EXPECTED_REGEX_SOURCE),
  "fixture assumes the real script's Server() literal regex; update fixtures if this changes",
);

function mkFixtureRoot({
  pkgVersion = "1.0.0",
  indexVersion = pkgVersion,
  dist = "match", // "match" | "mismatch" | "parse-fail" | "absent"
  distVersion,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-version-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "check-version.mjs"), REAL_SCRIPT);
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "agent-governance-mcp", version: pkgVersion }),
  );
  fs.writeFileSync(
    path.join(root, "index.ts"),
    `new Server({ name: "agent-governance-mcp", version: "${indexVersion}" });\n`,
  );
  if (dist !== "absent") {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    let distContent;
    if (dist === "parse-fail") {
      distContent = "// compiled output with no recognizable Server() version literal\n";
    } else if (dist === "mismatch") {
      distContent = `new Server({ name: "agent-governance-mcp", version: "${distVersion}" });\n`;
    } else {
      // "match" — same version as package.json/index.ts unless overridden
      distContent = `new Server({ name: "agent-governance-mcp", version: "${distVersion ?? pkgVersion}" });\n`;
    }
    fs.writeFileSync(path.join(root, "dist", "index.js"), distContent);
  }
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, "scripts", "check-version.mjs")], {
    encoding: "utf-8",
  });
}

test("CV-1 (AC1/AC4): package.json, index.ts, and dist/index.js all agree -> exit 0, dist parity + final OK lines both print", () => {
  const root = mkFixtureRoot({ pkgVersion: "2.5.0", dist: "match" });
  const result = run(root);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /dist\/index\.js parity OK \(2\.5\.0\)/, "AC4 — dist-parity confirmation visible in stdout");
  assert.match(result.stdout, /check:version — OK \(2\.5\.0\)/, "AC4 — existing success line still prints unchanged");
});

test("CV-2 (AC2): dist/index.js carries a stale Server() version literal -> exit non-zero, error names BOTH versions", () => {
  const root = mkFixtureRoot({ pkgVersion: "3.75.0", dist: "mismatch", distVersion: "3.73.1" });
  const result = run(root);
  assert.notEqual(result.status, 0, "a stale dist version literal must trip the check (non-zero exit)");
  assert.match(result.stderr, /dist version mismatch/i, "fail-loud message names the mismatch");
  assert.match(result.stderr, /package\.json=3\.75\.0/, "error names the package.json version");
  assert.match(result.stderr, /dist\/index\.js=3\.73\.1/, "error names the dist/index.js version");
});

test("CV-3 (AC3, parse-fail branch): dist/index.js exists but has no parseable Server() version literal -> exit non-zero, fail-loud, distinct from the absent case", () => {
  const root = mkFixtureRoot({ pkgVersion: "1.0.0", dist: "parse-fail" });
  const result = run(root);
  assert.notEqual(result.status, 0, "an unparseable-but-present dist/index.js must fail loud, not pass silently");
  assert.match(
    result.stderr,
    /could not find dist version literal/i,
    "distinct message from the absent-file skip note — parse failure on an existing file is not tolerated",
  );
});

test("CV-4 (AC3, absent branch): dist/index.js does not exist at all (fresh unbuilt checkout) -> does not crash, skips with an informational note, exits 0", () => {
  const root = mkFixtureRoot({ pkgVersion: "1.2.3", dist: "absent" });
  assert.ok(!fs.existsSync(path.join(root, "dist", "index.js")), "sanity: fixture really has no dist/index.js");
  const result = run(root);
  assert.equal(result.status, 0, `a fresh unbuilt checkout must not fail the check; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /dist\/index\.js not present \(unbuilt checkout\)/,
    "AC3 — clear informational skip note, mirroring the git-tag 'not in a git checkout' tolerance",
  );
  assert.match(result.stdout, /check:version — OK \(1\.2\.3\)/, "AC4 — downstream checks still complete and the final success line still prints");
});

// Coded by @qa-engineer
// Tests for the check-version.mjs dist/index.js parity check (specs/e11-e12-release-integrity-batch.md
// AC1-AC4, E11), authored under T-E11E12-03, plus package-lock parity CV-5..CV-10 (E60). Each test copies
// the real script into a temp fixture root and spawns it, since it resolves its root from import.meta.url.
// Spec-to-Test map: specs/e260e-comment-rationale.md (check-version.test.mjs).

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
  // Lockfile parity (E60). Omitted entirely (the CV-1..CV-4 default) means no
  // package-lock.json is written at all — those tests exercise the tolerant
  // "lockfile absent" skip branch incidentally, same as they always have.
  // Pass either a raw string (to drive the parse-fail / shape branches with
  // exact byte content) or an object { rootVersion, packagesVersion } (each
  // defaulting to pkgVersion when omitted) to drive the parity/mismatch
  // branches without hand-writing JSON in every test.
  lockfile,
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
  if (lockfile !== undefined) {
    const lockContent =
      typeof lockfile === "string"
        ? lockfile
        : JSON.stringify({
            name: "agent-governance-mcp",
            version: lockfile.rootVersion ?? pkgVersion,
            lockfileVersion: 3,
            packages: {
              "": {
                name: "agent-governance-mcp",
                version: lockfile.packagesVersion ?? pkgVersion,
              },
            },
          });
    fs.writeFileSync(path.join(root, "package-lock.json"), lockContent);
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

// ============================================================================
// Lockfile version parity (E60) — CV-5..CV-10
// ============================================================================

test("CV-5: package-lock.json root version AND packages[\"\"].version both match pkg.version -> exit 0, parity line prints", () => {
  const root = mkFixtureRoot({ pkgVersion: "4.0.0", lockfile: {} });
  const result = run(root);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /package-lock\.json parity OK \(4\.0\.0\)/, "lockfile parity confirmation visible in stdout");
  assert.match(result.stdout, /check:version — OK \(4\.0\.0\)/, "existing success line still prints unchanged");
});

test("CV-6: package-lock.json root version is stale (packages[\"\"] matches) -> exit non-zero, names both observed values", () => {
  const root = mkFixtureRoot({ pkgVersion: "4.0.0", lockfile: { rootVersion: "3.9.0" } });
  const result = run(root);
  assert.notEqual(result.status, 0, "a stale lockfile root version must trip the check (non-zero exit)");
  assert.match(result.stderr, /lockfile version mismatch/i, "fail-loud message names the mismatch");
  assert.match(result.stderr, /package\.json=4\.0\.0/, "error names the package.json version");
  assert.match(result.stderr, /root version=3\.9\.0/, "error names the observed stale root version");
});

test("CV-7: package-lock.json packages[\"\"].version is stale, root version matches -> exit non-zero, names both observed values", () => {
  const root = mkFixtureRoot({ pkgVersion: "4.0.0", lockfile: { packagesVersion: "3.9.0" } });
  const result = run(root);
  assert.notEqual(result.status, 0, "a stale packages[\"\"].version must trip the check even though the root version matches");
  assert.match(result.stderr, /lockfile version mismatch/i, "fail-loud message names the mismatch");
  assert.match(result.stderr, /package\.json=4\.0\.0/, "error names the package.json version");
  assert.match(result.stderr, /packages\[""\]\.version=3\.9\.0/, "error names the observed stale packages[\"\"] version");
});

test("CV-8: package-lock.json absent -> does not crash, skips with an informational note, exits 0", () => {
  const root = mkFixtureRoot({ pkgVersion: "5.0.0" }); // lockfile omitted entirely
  assert.ok(!fs.existsSync(path.join(root, "package-lock.json")), "sanity: fixture really has no package-lock.json");
  const result = run(root);
  assert.equal(result.status, 0, `a checkout with no lockfile must not fail the check; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /package-lock\.json not present/,
    "clear informational skip note, mirroring the dist/index.js 'unbuilt checkout' tolerance",
  );
  assert.match(result.stdout, /check:version — OK \(5\.0\.0\)/, "downstream checks still complete and the final success line still prints");
});

test("CV-9: package-lock.json content is the JSON literal `null` -> guarded shape-branch message, not an unguarded crash (F2, round 2)", () => {
  const root = mkFixtureRoot({ pkgVersion: "6.0.0", lockfile: "null" });
  const result = run(root);
  assert.notEqual(result.status, 0, "a `null` lockfile is not in the expected shape and must fail loud");
  assert.match(
    result.stderr,
    /could not find lockfile version fields/i,
    "the guarded shape message, not a stack trace, must be what prints",
  );
  assert.doesNotMatch(result.stderr, /TypeError/, "must not surface as an unguarded TypeError — that was the pre-fix crash this pins against");
});

test("CV-10: package-lock.json content is a JSON array -> does NOT enter the null/non-object guard, but is still caught (not a vacuous pass)", () => {
  const root = mkFixtureRoot({ pkgVersion: "7.0.0", lockfile: "[]" });
  const result = run(root);
  assert.notEqual(result.status, 0, "an array has no root `version` or `packages[\"\"].version` and must not pass");
  assert.match(
    result.stderr,
    /could not find lockfile version fields/i,
    "caught by the pre-existing 'missing version fields' shape check one level down from the null/non-object guard",
  );
  assert.doesNotMatch(result.stderr, /TypeError/, "must not crash either — arrays are objects per typeof, so the early guard's own condition doesn't apply, but nothing downstream throws");
});

// ============================================================================
// check-transitions-sync.mjs — coverage for the transitions-doc sync checker (T-E39-03, E39/E58).
// Same copy-the-real-script fixture pattern as CV-1..CV-4, plus a "type": "module" package.json.
// Coverage map CTS-1..CTS-10 and rationale: specs/e260e-comment-rationale.md (check-version.test.mjs).
// ============================================================================

const REAL_SYNC_SCRIPT = fs.readFileSync(
  path.join(PROJECT_ROOT, "scripts", "check-transitions-sync.mjs"),
  "utf-8",
);

// Sanity: fail loudly if the real script's anchor/marker text drifts out from
// under this fixture builder's assumptions.
assert.ok(
  REAL_SYNC_SCRIPT.includes("## ALLOWED_TRANSITIONS Matrix"),
  "fixture assumes the real script's section-heading text; update fixtures if this changes",
);

const ROW_PM = "pm | In_Progress | (pm, In_Progress), (researcher, In_Progress)";
const ROW_PM_INCOMPLETE = "pm | In_Progress | (pm, In_Progress)"; // missing the researcher entry
const ROW_RESEARCHER = "researcher | In_Progress | (pm, In_Progress)";
const ROW_EXTRA = "architect | In_Progress | (pm, In_Progress)"; // key not in CORRECT_DIST

const CORRECT_DIST = `export const ALLOWED_TRANSITIONS = new Map([
  ["pm:In_Progress", [
    { agent: "pm", status: "In_Progress" },
    { agent: "researcher", status: "In_Progress" },
  ]],
  ["researcher:In_Progress", [
    { agent: "pm", status: "In_Progress" },
  ]],
]);
`;

function buildSpec({
  heading = "## ALLOWED_TRANSITIONS Matrix",
  rows = [ROW_PM, ROW_RESEARCHER],
  leadingProse = "",
  interposedHeading = null,
} = {}) {
  const tableHeader = "| prev_agent | prev_status | next |\n|---|---|---|\n";
  const tableBlock = rows.length ? tableHeader + rows.map((r) => `| ${r} |`).join("\n") + "\n" : "";
  const headingBlock =
    heading === null ? "" : `${heading}\n\nKey: (prev_agent, prev_status) -> (agent, status), ...\n\n`;
  const interposedBlock = interposedHeading ? `${interposedHeading}\n\nSome interposed prose.\n\n` : "";
  return (
    "# QA Flow Enforcement Architecture\n\n" +
    leadingProse +
    headingBlock +
    interposedBlock +
    tableBlock +
    "\n## Some Other Section\n\nMore text that mentions nothing special.\n"
  );
}

function mkSyncFixtureRoot({ distContent = CORRECT_DIST, specContent = buildSpec(), omitDist = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-transitions-sync-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "check-transitions-sync.mjs"), REAL_SYNC_SCRIPT);
  // "type": "module" so Node's ESM loader treats the fixture's bare
  // dist/tools/transitions.js as ESM (the real repo gets this from its own
  // root package.json — see package.json:5).
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  if (!omitDist) {
    fs.mkdirSync(path.join(root, "dist", "tools"), { recursive: true });
    fs.writeFileSync(path.join(root, "dist", "tools", "transitions.js"), distContent);
  }
  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "qa-flow-enforcement-architecture.md"), specContent);
  return root;
}

function runSync(root) {
  return spawnSync(process.execPath, [path.join(root, "scripts", "check-transitions-sync.mjs")], {
    encoding: "utf-8",
  });
}

test("CTS-1: corrected tree — dist and mirror agree -> exit 0, OK line names the key count", () => {
  const root = mkSyncFixtureRoot();
  const result = runSync(root);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /check:transitions-sync — OK \(2 keys, exact match/);
});

test("CTS-2: seeded doc-side omission — a row missing from the mirror -> RED, names the missing key", () => {
  const root = mkSyncFixtureRoot({ specContent: buildSpec({ rows: [ROW_PM] }) }); // researcher row dropped
  const result = runSync(root);
  assert.notEqual(result.status, 0, "a key present in source but absent from the mirror must fail");
  assert.match(result.stderr, /key\(s\) in ALLOWED_TRANSITIONS have NO row in the mirror table/);
  assert.match(result.stderr, /researcher:In_Progress/);
});

test("CTS-3: seeded doc-side extra row — present in doc, absent from source -> RED, names the extra key", () => {
  const root = mkSyncFixtureRoot({ specContent: buildSpec({ rows: [ROW_PM, ROW_RESEARCHER, ROW_EXTRA] }) });
  const result = runSync(root);
  assert.notEqual(result.status, 0, "a mirror row for a key the source doesn't have must fail");
  assert.match(result.stderr, /key\(s\) in the mirror table do not exist in ALLOWED_TRANSITIONS/);
  assert.match(result.stderr, /architect:In_Progress/);
});

test("CTS-4: heading absent entirely -> RED, not a vacuous pass", () => {
  const root = mkSyncFixtureRoot({ specContent: buildSpec({ heading: null }) });
  const result = runSync(root);
  assert.notEqual(result.status, 0, "a doc with no mirror heading at all must fail, never pass silently");
  assert.match(result.stderr, /could not find a line-exact/);
});

test("CTS-5: line-exact anchor — a renamed heading fails (does not bind to a near-miss)", () => {
  const root = mkSyncFixtureRoot({ specContent: buildSpec({ heading: "## ALLOWED_TRANSITIONS MatrixX" }) });
  const result = runSync(root);
  assert.notEqual(result.status, 0, "a renamed heading must not be treated as the real one");
  assert.match(result.stderr, /could not find a line-exact/);
});

test("CTS-6: line-exact anchor — an inline prose mention of the heading text elsewhere does NOT break a healthy document", () => {
  const root = mkSyncFixtureRoot({
    specContent: buildSpec({
      leadingProse:
        'This document\'s "## ALLOWED_TRANSITIONS Matrix" table is machine-checked; see below for the mirror.\n\n',
    }),
  });
  const result = runSync(root);
  assert.equal(result.status, 0, `a prose mention of the heading text must not misdirect the anchor; stderr: ${result.stderr}`);
  assert.match(result.stdout, /check:transitions-sync — OK \(2 keys, exact match/);
});

test("CTS-7: duplicate-row guard — wrong row first, correct row second -> RED (pins the round-1 false-green shape)", () => {
  // Round 1 found this exact shape printed "OK (21 keys, exact match)" while
  // the doc visibly contained a wrong row, because Map.set is last-write-wins
  // and nothing reconciled the row count against the key count. This test
  // pins that it can never regress: the corrected script must FAIL here,
  // never print the success line, regardless of which occurrence "wins".
  const root = mkSyncFixtureRoot({
    specContent: buildSpec({ rows: [ROW_PM_INCOMPLETE, ROW_PM, ROW_RESEARCHER] }),
  });
  const result = runSync(root);
  assert.notEqual(result.status, 0, "a duplicate mirror row must fail even when the later occurrence is correct");
  assert.match(result.stderr, /duplicate mirror row for pm:In_Progress/);
  assert.doesNotMatch(result.stdout, /OK \(/, "must never print the success line on a duplicate-key doc");
});

test("CTS-8: duplicate-row guard — correct row first, wrong row second -> RED with BOTH the duplicate message and the entry-set diff", () => {
  const root = mkSyncFixtureRoot({
    specContent: buildSpec({ rows: [ROW_PM, ROW_PM_INCOMPLETE, ROW_RESEARCHER] }),
  });
  const result = runSync(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate mirror row for pm:In_Progress/);
  assert.match(result.stderr, /DIFFERENT allowed-entry set/, "last-write-wins means the final (wrong) row also trips the entry-set diff");
});

test("CTS-9: dist/tools/transitions.js absent -> fails loud, no unbuilt-checkout skip", () => {
  const root = mkSyncFixtureRoot({ omitDist: true });
  assert.ok(!fs.existsSync(path.join(root, "dist", "tools", "transitions.js")), "sanity: fixture really has no dist file");
  const result = runSync(root);
  assert.notEqual(result.status, 0, "missing compiled output must fail, not silently skip (unlike check-version.mjs's unbuilt-checkout tolerance)");
  assert.match(result.stderr, /dist[\\/]tools[\\/]transitions\.js not found/);
  assert.match(result.stderr, /Run `npm run build` first/);
  assert.match(result.stderr, /no unbuilt-checkout skip/);
});

test("CTS-10: heading found but zero data rows — a `## ` heading interposed before the table truncates the section -> RED, not a vacuous pass", () => {
  const root = mkSyncFixtureRoot({
    specContent: buildSpec({ interposedHeading: "## An Interposed Section", rows: [ROW_PM, ROW_RESEARCHER] }),
  });
  const result = runSync(root);
  assert.notEqual(result.status, 0, "a section truncated to zero rows by an interposed heading must fail");
  assert.match(result.stderr, /parsed ZERO data rows/);
});

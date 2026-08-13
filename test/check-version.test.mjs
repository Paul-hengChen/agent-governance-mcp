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

// ============================================================================
// check-transitions-sync.mjs — T-E39-03 coverage (E39/E58)
// ============================================================================
// scripts/check-transitions-sync.mjs (T-E39-01) shipped with zero test
// coverage — its whole contract (the duplicate-row guard, the line-exact
// heading anchor, the fail-loud-not-silent branches) was instead verified by
// hand across three code-review rounds (review_reports/review_T-E39-01.md
// C2/C3/Q1, re-verified R2/R3) and would regress silently without a pin.
// tasks.md T-E39-03 item (2) names this file as the closest existing home for
// a scripts/-level checker; using it rather than creating a new file.
//
// Same fixture pattern as CV-1..CV-4 above (this file's own header, lines
// 9-16): copy the REAL script byte-for-byte into a temp fixture root, lay out
// a synthetic dist/tools/transitions.js + specs/qa-flow-enforcement-
// architecture.md beside it, spawn the copy — never touching this repo's
// real dist/ or specs/. One addition versus the CV fixtures: this script
// dynamically import()s dist/tools/transitions.js (check-version.mjs only
// ever regex-reads dist/index.js as text), so the fixture root needs its own
// "type": "module" package.json — the nearest one Node's ESM loader finds
// when resolving a bare .js file's module format.
//
// Coverage map (T-E39-03 item (2) "cover at minimum"):
//   green on the corrected tree                              -> CTS-1
//   RED on a seeded doc-side omission (row missing from mirror) -> CTS-2
//   RED on a seeded doc-side extra row (in doc, absent from source) -> CTS-3
//   RED, not a vacuous pass, heading absent entirely           -> CTS-4
//   line-exact anchor: heading rename fails                    -> CTS-5
//   line-exact anchor: inline prose mention still passes       -> CTS-6
//   duplicate-row guard: wrong-then-correct (the round-1 false-green shape:
//     "OK (21 keys, exact match)" printed while the doc visibly contained a
//     wrong row) -> CTS-7
//   duplicate-row guard: correct-then-wrong (duplicate message AND the
//     entry-set diff both fire) -> CTS-8
//   missing dist/tools/transitions.js fails loud, no skip       -> CTS-9
//   heading found but zero data rows (a `## ` heading interposed between the
//     section header and the table truncates the section to nothing)
//     -> CTS-10

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

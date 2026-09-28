#!/usr/bin/env node
// Fail if the "## ALLOWED_TRANSITIONS Matrix" mirror table in
// specs/qa-flow-enforcement-architecture.md drifts from the compiled
// ALLOWED_TRANSITIONS source of truth in tools/transitions.ts.
//
// Pattern follows scripts/check-version.mjs: resolve root from
// import.meta.url, read from dist/ (the compiled artifact, not the .ts
// source — dist is what actually ships and is what check-version.mjs itself
// treats as authoritative for parity checks), fail loud rather than skip
// silently, exit non-zero with an actionable message.
//
// E39/E58 (docs/backlog.md, .current/feature-split.md F0): this table has
// drifted from ALLOWED_TRANSITIONS before (E37 round 1 found 9 divergent
// sites across 16 mirrored rows) with nothing to catch it. Both sides are
// structured data — a Map in compiled JS, a markdown table with a fixed
// three-column shape — so a set-equality check is genuinely mechanizable
// here, unlike a hand-written prose expansion of a prose source, which has
// no structured source to diff against — the docs/skills/* mirror tree was
// exactly that case, and E48 deleted it rather than trying to check it.
//
// Hard requirement (explicit ticket condition, same defect class as E50's
// `grep -vxFf` empty-baseline bug): if this script cannot find or parse the
// mirror table, or cannot load ALLOWED_TRANSITIONS, that MUST be a failure,
// never a vacuous pass. An empty parse silently agreeing with an empty
// source would defeat the entire point of the check.
//
// Wiring (package.json): `postbuild`, deliberately NOT `prebuild` despite
// check-version.mjs's own placement there. This check imports
// ALLOWED_TRANSITIONS from dist/, which changes on every edit to
// tools/transitions.ts; hooked at `prebuild` it would run BEFORE `tsc`, so
// `npm run build` right after editing transitions.ts would validate the
// PREVIOUS build's dist — the exact "compare against stale compiled output"
// failure this ticket exists to prevent, reintroduced by the wiring itself.
// check-version.mjs's dist check tolerates the same prebuild timing because
// what it pins (the version literal) does not change mid-edit the way a
// transition table does. `postbuild` runs after `tsc` and still fires on
// every `npm run build` and every `npm test` (via `pretest` -> `build` ->
// `postbuild`), so it is exercised in the same places, against fresh output.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const distPath = path.join(root, "dist", "tools", "transitions.js");
const specPath = path.join(root, "specs", "qa-flow-enforcement-architecture.md");

let failed = false;
function fail(message) {
  failed = true;
  console.error(`check:transitions-sync — ${message}`);
}

// ---- 1. load ALLOWED_TRANSITIONS from the compiled artifact ----
// Deliberately dist/, not tools/transitions.ts: check-version.mjs already
// treats dist/index.js as the thing that must stay honest (the v3.74.0
// near-miss it guards against), and structured-source-vs-structured-table is
// exactly why this artifact is mechanizable — regex-parsing the .ts would
// reintroduce the same "one side isn't really structured" problem E48 hit.

if (!existsSync(distPath)) {
  fail(
    `${path.relative(root, distPath)} not found. Run \`npm run build\` first — ` +
      "this check has no unbuilt-checkout skip: a sync check that can't find " +
      "what it's checking must fail, not pass silently.",
  );
  process.exit(1);
}

let ALLOWED_TRANSITIONS;
try {
  ({ ALLOWED_TRANSITIONS } = await import(pathToFileURL(distPath).href));
} catch (err) {
  fail(`failed to import ${path.relative(root, distPath)}: ${err.message}`);
  process.exit(1);
}

if (!(ALLOWED_TRANSITIONS instanceof Map) || ALLOWED_TRANSITIONS.size === 0) {
  fail(
    `${path.relative(root, distPath)} loaded but ALLOWED_TRANSITIONS is missing, ` +
      "not a Map, or empty. Treating this as a failure, not a vacuous pass.",
  );
  process.exit(1);
}

const sourceTable = new Map();
for (const [key, entries] of ALLOWED_TRANSITIONS.entries()) {
  sourceTable.set(key, entries.map((e) => `(${e.agent}, ${e.status})`).sort());
}

// ---- 2. parse the markdown mirror table ----
// Anchored on the known section header so a heading or example table
// elsewhere in the file can't be mistaken for the mirror. Row shape:
// `| prev_agent | prev_status | (agent, status), (agent, status), ... |`

if (!existsSync(specPath)) {
  fail(`mirror spec not found at ${path.relative(root, specPath)}.`);
  process.exit(1);
}

const specSrc = readFileSync(specPath, "utf-8");
const headerMarker = "## ALLOWED_TRANSITIONS Matrix";
// Line-exact anchor, not a substring search: `indexOf` on the bare marker
// binds to the FIRST occurrence anywhere in the file, including an inline
// prose mention of the heading (this repo has one — tasks.md T-E39-01
// quotes this exact heading). That produces a confident, wrong-cause
// "parsed ZERO data rows" failure on an otherwise-healthy document. A
// `^## ...$` regex only matches an actual heading line.
const headerRe = /^## ALLOWED_TRANSITIONS Matrix\s*$/m;
const headerMatch = headerRe.exec(specSrc);

if (!headerMatch) {
  fail(
    `could not find a line-exact "${headerMarker}" heading in ${path.relative(root, specPath)}. ` +
      "A table this check cannot locate is a FAILURE, not a pass.",
  );
  process.exit(1);
}

const headerIdx = headerMatch.index;
const nextHeadingIdx = specSrc.indexOf("\n## ", headerIdx + headerMatch[0].length);
const section = nextHeadingIdx === -1 ? specSrc.slice(headerIdx) : specSrc.slice(headerIdx, nextHeadingIdx);

const rowPattern = /^\|\s*([\w-]+)\s*\|\s*([\w-]+)\s*\|\s*(.+?)\s*\|\s*$/gm;
const mirrorTable = new Map();
let dataRowCount = 0;
let m;
while ((m = rowPattern.exec(section)) !== null) {
  const [, prevAgentRaw, prevStatusRaw, cellsRaw] = m;
  // Skip the header row (`prev_agent | prev_status | ...`) and the markdown
  // separator row (`---|---|---`) — everything else between the section
  // header and the next `## ` heading is treated as a data row.
  if (prevAgentRaw === "prev_agent" || /^-+$/.test(prevAgentRaw)) continue;
  dataRowCount++;
  const key = `${prevAgentRaw}:${prevStatusRaw}`;
  const tuples = [...cellsRaw.matchAll(/\(([\w-]+),\s*(\w+)\)/g)]
    .map(([, agent, status]) => `(${agent}, ${status})`)
    .sort();
  // Duplicate-key guard: without this, mirrorTable.set is last-write-wins
  // and a stray duplicate row (e.g. a re-drift shaped like appending a new
  // row for a key that already has one, instead of editing it in place —
  // exactly the shape of the E58 edit itself) silently passes with only its
  // last occurrence ever checked.
  if (mirrorTable.has(key)) {
    fail(`duplicate mirror row for ${key} — the later row silently wins`);
  }
  mirrorTable.set(key, tuples);
}

if (dataRowCount === 0 || mirrorTable.size === 0) {
  fail(
    `found the "${headerMarker}" section but parsed ZERO data rows from it. ` +
      "An empty parse must be a failure, not a vacuous pass (the E50 " +
      "`grep -vxFf` empty-baseline defect class).",
  );
  process.exit(1);
}

// ---- 3. diff: set difference in either direction, plus entry-set mismatches ----

const sourceKeys = new Set(sourceTable.keys());
const mirrorKeys = new Set(mirrorTable.keys());

const missingFromMirror = [...sourceKeys].filter((k) => !mirrorKeys.has(k)).sort();
const extraInMirror = [...mirrorKeys].filter((k) => !sourceKeys.has(k)).sort();

const wrongRows = [];
for (const key of sourceKeys) {
  if (!mirrorKeys.has(key)) continue;
  const sourceEntries = sourceTable.get(key).join(" | ");
  const mirrorEntries = mirrorTable.get(key).join(" | ");
  if (sourceEntries !== mirrorEntries) {
    wrongRows.push({ key, sourceEntries, mirrorEntries });
  }
}

if (missingFromMirror.length) {
  fail(
    `${missingFromMirror.length} key(s) in ALLOWED_TRANSITIONS have NO row in the mirror table:\n` +
      missingFromMirror.map((k) => `    - ${k}`).join("\n"),
  );
}
if (extraInMirror.length) {
  fail(
    `${extraInMirror.length} key(s) in the mirror table do not exist in ALLOWED_TRANSITIONS:\n` +
      extraInMirror.map((k) => `    - ${k}`).join("\n"),
  );
}
if (wrongRows.length) {
  fail(
    `${wrongRows.length} key(s) exist on both sides but with a DIFFERENT allowed-entry set:\n` +
      wrongRows
        .map((r) => `    - ${r.key}\n        source: ${r.sourceEntries}\n        mirror: ${r.mirrorEntries}`)
        .join("\n"),
  );
}

if (failed) {
  console.error(
    `\ncheck:transitions-sync — FAILED (${sourceKeys.size} source keys, ${mirrorKeys.size} mirror keys). ` +
      "Re-derive the \"## ALLOWED_TRANSITIONS Matrix\" table in " +
      "specs/qa-flow-enforcement-architecture.md from tools/transitions.ts before this can pass.",
  );
  process.exit(1);
}

console.log(
  `check:transitions-sync — OK (${sourceKeys.size} keys, exact match between ` +
    "dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)",
);

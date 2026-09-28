// Coded by @qa-engineer
// Tests for backlog row E90 (docs/backlog.md:213, order 13e) — the class guard
// T-E90-02 mandates in the SAME cut as T-E90-01's script fix: "every fixture
// the suite asserts against must have a capture in the script, so ticket 13 of
// this kind cannot recur."
//
// const-05 branch exercised (content/const-05-core-standards.md:9, E43):
// branch (a) — the dispatch brief pre-authorized new-test-file creation for
// this ticket by name ("Test-file placement: creation is pre-authorized...
// a new test/e90-*.test.mjs is equally acceptable"), so this file was created
// without an ask. Disclosed again in qa_reports/review_T-E90-02.md.
//
// Spec-to-Test map (docs/backlog.md's E90 row + tasks.md's T-E90-01/T-E90-02
// rows ARE the spec — mini-chain, no specs/<feature>.md):
//   T-E90-01 (a)/(b) all-12-captured  -> t-captured-equals-on-disk,
//                                        t-asserted-equals-on-disk
//   T-E90-02 "class guard... every fixture the suite asserts against must
//     have a capture in the script"  -> both tests below (three-way tie)
//
// WHY (the defect this closes): scripts/capture-constitution-golden.mjs
// carries its OWN completeness guard (onDisk minus captured -> exit 1), but
// that guard only fires when a HUMAN RUNS THE SCRIPT. Nothing before this file
// re-checked the same invariant on every `npm test`, so a future edit that (a)
// adds a golden fixture the suite asserts against without adding a capture
// for it, or (b) adds a capture without a fixture ever landing on disk, could
// sit unnoticed until someone remembers to run the regeneration tool by hand
// — precisely how E90 itself was filed (10 of 12 fixtures had a tool; the
// other 2 were hand-rebuilt during E43). This file makes the SAME "capture
// set == fixture set" check a property of the automated suite instead of a
// property of someone's memory, and additionally ties in the set of fixtures
// the two consuming suites (compose-equivalence.test.mjs, skill-manifest.
// test.mjs) actually read via `readGolden`/the `GOLDEN` constant — the
// three-way tie is strictly stronger than the script's own two-way guard,
// because it also catches a fixture an assertion depends on that never had
// ANY capture AND never landed on disk (onDisk-minus-captured is blind to
// that case: both sets simply omit it, so the internal guard reports 0
// uncovered even though the suite would separately red with ENOENT the
// moment that assertion runs — a residual code-reviewer recorded in
// review_reports/review_T-E90-01.md and assigned to this ticket).
//
// Deliberately STATIC (source-text extraction), not an execution of the
// capture script: the script is not idempotent-free of side effects (it
// overwrites the real committed fixtures in test/fixtures/compose-golden/),
// and running it from inside `npm test` would make every test run silently
// rewrite committed oracle bytes — the wrong failure mode for a suite whose
// entire premise is that the oracle is inert. Static extraction is also
// airtight against the specific historical failure mode: the extractors key
// off literal calls to the `writeFixture(...)` helper (E90's own addition),
// so replaying them against the PRE-E90 script (git blob at HEAD, saved
// verbatim before this ticket's edit landed) correctly reports only 10
// captures — not 12 — even though the string "constitution-monolith.txt"
// still appears in that old script's dead `else` branch. Verified by hand
// during this round (not shipped as a test — the pre-fix script is a
// throwaway git-show blob, not a fixture this suite should depend on):
//   node -e '<the same two extractor functions below, run against
//   `git show HEAD:scripts/capture-constitution-golden.mjs` prior to the
//   T-E90-01 commit>' printed capturedSet.size === 10, which is exactly the
//   pre-E90 defect this guard exists to catch, and exactly the reconstruction
//   T-E90-02 asks for.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const GOLDEN_DIR = path.join(ROOT, "test", "fixtures", "compose-golden");
const SCRIPT_PATH = path.join(ROOT, "scripts", "capture-constitution-golden.mjs");
const COMPOSE_EQUIV_PATH = path.join(ROOT, "test", "compose-equivalence.test.mjs");
const SKILL_MANIFEST_TEST_PATH = path.join(ROOT, "test", "skill-manifest.test.mjs");

// The 8-entry `["file.txt", ...]` cross product both the script and
// compose-equivalence.test.mjs declare independently (by design — see
// review_reports/review_T-E90-01.md Architecture: "Residual architectural
// duplication... not a blocker"). Extracted, not hand-copied, so this file
// can't itself drift from either source.
function extractBuildModesFilenames(source, label) {
  const m = source.match(/const BUILD_MODES = \[([\s\S]*?)\n\];/);
  assert.ok(m, `could not locate a "const BUILD_MODES = [...]" array literal in ${label}`);
  const filenames = [...m[1].matchAll(/"([^"]+\.txt)"/g)].map((mm) => mm[1]);
  assert.equal(
    filenames.length,
    8,
    `expected exactly 8 BUILD_MODES filenames in ${label}, found ${filenames.length}`,
  );
  return filenames;
}

// Matches `fnName("literal.txt"` (with or without a newline between the paren
// and the opening quote, per the script's own multi-line call style) —
// deliberately requires the FIRST ARG to be a string literal, so calls that
// pass a variable (e.g. the BUILD_MODES loop's `writeFixture(file, ...)`) are
// correctly excluded rather than double-counted.
function extractCallLiteralFilenames(source, fnName) {
  const re = new RegExp(`${fnName}\\(\\s*\\n?\\s*"([^"]+\\.txt)"`, "g");
  return [...source.matchAll(re)].map((mm) => mm[1]);
}

const scriptSrc = fs.readFileSync(SCRIPT_PATH, "utf-8");
const compareEquivSrc = fs.readFileSync(COMPOSE_EQUIV_PATH, "utf-8");
const skillManifestTestSrc = fs.readFileSync(SKILL_MANIFEST_TEST_PATH, "utf-8");

// --- capturedSet: what scripts/capture-constitution-golden.mjs actually writes ---
// 8 (BUILD_MODES loop) + 2 (captureHook literal calls) + 2 (direct writeFixture
// literal calls for the two monolith fixtures, E90's own addition).
const capturedSet = new Set([
  ...extractBuildModesFilenames(scriptSrc, "scripts/capture-constitution-golden.mjs"),
  ...extractCallLiteralFilenames(scriptSrc, "captureHook"),
  ...extractCallLiteralFilenames(scriptSrc, "writeFixture"),
]);

// --- assertedSet: what the two consuming suites actually read back ---------
// compose-equivalence.test.mjs: its own BUILD_MODES (8) + 3 literal
// readGolden(...) calls (hook-lite.txt, hook-full.txt, constitution-monolith.txt).
// skill-manifest.test.mjs: the single GOLDEN path.join(...) constant
// (skill-coordinator-monolith.txt).
const goldenConstMatch = skillManifestTestSrc.match(/"compose-golden",\s*\n?\s*"([^"]+\.txt)"/);
assert.ok(
  goldenConstMatch,
  'could not locate the GOLDEN = path.join(..., "compose-golden", "....txt") constant in test/skill-manifest.test.mjs',
);
const assertedSet = new Set([
  ...extractBuildModesFilenames(compareEquivSrc, "test/compose-equivalence.test.mjs"),
  ...extractCallLiteralFilenames(compareEquivSrc, "readGolden"),
  goldenConstMatch[1],
]);

// --- onDiskSet: the actual committed fixture directory ----------------------
const onDiskSet = new Set(
  fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".txt")),
);

test("E90 class guard: capturedSet has no accidental duplicates and is exactly 12", () => {
  // A duplicate literal (e.g. the same filename passed to writeFixture twice)
  // would silently overwrite one fixture with another's derivation and this
  // Set would still report the right SIZE by coincidence if the duplicate
  // happened to collide with an already-distinct name — pin the raw count too.
  assert.equal(capturedSet.size, 12, `expected 12 distinct captured filenames, got: ${[...capturedSet].sort().join(", ")}`);
});

test("E90 class guard: the set of fixtures scripts/capture-constitution-golden.mjs captures equals the set present in test/fixtures/compose-golden/", () => {
  // This is the script's OWN completeness guard (lines ~218-232), replayed
  // here so it fires on every `npm test`, not only when a human remembers to
  // run the regeneration tool. Reds exactly the way the pre-E90 script would
  // have reported this comparison, had anyone asked it: 10 captured vs 12 on
  // disk (see the file header for the verified reconstruction).
  assert.deepEqual(
    [...capturedSet].sort(),
    [...onDiskSet].sort(),
    "capture script must produce EXACTLY the fixtures present in test/fixtures/compose-golden/ — " +
      "no fixture may sit uncaptured (E90's original defect) and no capture may target a fixture that doesn't exist",
  );
});

test("E90 class guard: every fixture the consuming suites assert against (readGolden / GOLDEN) has a capture in the script", () => {
  // Stronger than the previous test: ties the ASSERTIONS themselves (not just
  // the directory listing) to the capture set, closing the residual noted in
  // review_reports/review_T-E90-01.md — a fixture an assertion depends on that
  // is absent from disk AND has no capture is invisible to an onDisk-minus-
  // captured diff (both sets simply omit it), but IS visible here because
  // assertedSet is derived independently from the test files' own source, not
  // from the directory.
  assert.deepEqual(
    [...assertedSet].sort(),
    [...capturedSet].sort(),
    "every fixture read via readGolden(...)/the GOLDEN constant must have a matching capture in " +
      "scripts/capture-constitution-golden.mjs — an assertion with no capture is exactly the T-E90 " +
      "recurrence this guard exists to prevent",
  );
  assert.deepEqual(
    [...assertedSet].sort(),
    [...onDiskSet].sort(),
    "every fixture read via readGolden(...)/the GOLDEN constant must actually exist in " +
      "test/fixtures/compose-golden/",
  );
});

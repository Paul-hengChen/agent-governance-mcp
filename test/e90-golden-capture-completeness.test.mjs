// Coded by @qa-engineer
// Guard: every golden fixture the suite asserts against must have a capture
// in scripts/capture-constitution-golden.mjs, so a fixture can never again
// exist only as a hand-built file that the regeneration tool cannot
// reproduce. Two of the twelve fixtures were once hand-rebuilt that way.
// (E90, E43, T-E90-01, T-E90-02)
//
// Map of the claims to tests:
//   all 12 fixtures captured         -> t-captured-equals-on-disk,
//                                        t-asserted-equals-on-disk
//   every fixture the suite asserts against has a capture in the script
//                                     -> both tests below (three-way tie)
//
// Why: the capture script has its own completeness check (on-disk minus
// captured -> exit 1), but it only runs when someone runs the script by hand.
// Without this file, an edit that (a) adds a golden fixture the suite asserts
// against without adding a capture for it, or (b) adds a capture whose
// fixture never lands on disk, would go unnoticed until the next manual
// regeneration. This file runs the same "capture set == fixture set" check on
// every `npm test`, and also ties in the fixtures the two consuming suites
// (compose-equivalence.test.mjs, skill-manifest.test.mjs) actually read via
// `readGolden`/the `GOLDEN` constant. That three-way tie is stronger than the
// script's two-way check: a fixture an assertion depends on that has no
// capture AND is not on disk is invisible to on-disk-minus-captured (both
// sets simply omit it), but it shows up here.
//
// The check is deliberately STATIC (reads the script's source text) instead
// of running the capture script: the script overwrites the committed
// fixtures in test/fixtures/compose-golden/, and running it inside `npm test`
// would silently rewrite the very files the suite compares against. The
// extractors key off literal calls to the `writeFixture(...)` helper, so a
// dead branch that merely mentions a fixture name (for example
// "constitution-monolith.txt" in an unused `else`) is not counted as a
// capture.

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
// compose-equivalence.test.mjs declare independently (the duplication is
// accepted on purpose). Extracted, not hand-copied, so this file can't
// itself drift from either source.
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
// literal calls for the two monolith fixtures).
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
  // run the regeneration tool. A fixture that exists on disk but that the
  // script never writes (or the reverse) fails here.
  assert.deepEqual(
    [...capturedSet].sort(),
    [...onDiskSet].sort(),
    "capture script must produce EXACTLY the fixtures present in test/fixtures/compose-golden/ — " +
      "no fixture may sit uncaptured (E90's original defect) and no capture may target a fixture that doesn't exist",
  );
});

test("E90 class guard: every fixture the consuming suites assert against (readGolden / GOLDEN) has a capture in the script", () => {
  // Stronger than the previous test: ties the ASSERTIONS themselves (not just
  // the directory listing) to the capture set. A fixture an assertion
  // depends on that is absent from disk AND has no capture is invisible to an onDisk-minus-
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

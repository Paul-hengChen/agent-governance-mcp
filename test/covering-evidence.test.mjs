// Coded by @qa-engineer
// Tests for specs/c3-covering-evidence.md — AC-1 through AC-6.
//   parseCoversIds(content)                          — pure parser (C3-01)
//   buildCoverageIndex(dir)                           — fs composition helper (C3-02)
//   hasEvidenceInFile(ws, ids)                        — qa_reports/ gate + covers: fallback (C3-03)
//   hasCodeReviewEvidenceInFile(ws, ids)               — review_reports/ gate + covers: fallback (C3-04)
//
// AC coverage map:
//   AC-1: covering report satisfies N ids (code-reviewer path / review_reports/)
//   AC-2: covering report satisfies N ids (QA path / qa_reports/)
//   AC-3: partial coverage reports the exact missing subset
//   AC-4: backward compatible — classic per-id files unaffected
//   AC-5: malformed/empty/non-matching covers: line does not falsely satisfy
//   AC-6: lazy evaluation — no directory scan when every id has its own file
//   AC-7/AC-8 (SQLite unchanged / no schema bump) are scope-only, not exercised here.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseCoversIds,
  buildCoverageIndex,
} from "../dist/tools/evidence-file.js";
import { hasEvidenceInFile } from "../dist/gates/qa-review.js";
import { hasCodeReviewEvidenceInFile } from "../dist/gates/code-review.js";

// ---- helpers ----------------------------------------------------------------

function tmpWs() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agc-covers-"));
}

function writeQaReport(ws, filename, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), body, "utf-8");
}

function writeReviewReport(ws, filename, body) {
  const dir = path.join(ws, "review_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), body, "utf-8");
}

// AC-6 (lazy evaluation) test technique note:
// A runtime call-count spy on fs.readdirSync was evaluated and found NOT
// cleanly testable in this ESM setup. `tools/evidence-file.ts` does
// `import * as fs from "fs"`; Node's ESM loader resolves the "fs" specifier
// to a synthetic module whose bindings are captured once, at first
// resolution in the process (empirically confirmed: mutating the CJS
// `require("fs")` exports object AFTER any ESM module — including "node:fs",
// "node:test", or the test file's own transitive graph — has first touched
// the "fs" specifier no longer affects what evidence-file.js's `fs.*` calls
// resolve to; direct assignment to the ESM namespace binding itself throws
// "Cannot assign to read only property"). Because this test file necessarily
// imports the compiled module up front (matching this repo's test
// convention), by the time any test body runs, "fs" bindings are already
// fixed — so a same-process spy cannot observe evidence-file.js's internal
// fs.readdirSync calls. Per the AC-6 acceptance text ("code-path assertion or
// spy — exact technique is a QA implementation choice"), AC-6 is instead
// verified below via a source-order code-path assertion: reading the
// relevant gates/*.ts module (gates/qa-review.ts / gates/code-review.ts,
// post-A10 gate-registry split — relocated verbatim from
// tools/evidence-file.ts) and confirming the direct-file-found branch
// unconditionally `continue`s (skipping the rest of the loop body) BEFORE the
// `buildCoverageIndex` call is reached, and that the call itself is guarded
// by `coverage === null` (build-at-most-once-per-call). This pins the same
// structural invariant a spy would have measured at runtime, and matches the
// existing source-inspection convention used elsewhere in this suite (e.g.
// visual-evidence-gate.test.mjs's AC-8 test reading transitions.ts directly).
//
// Slices from a start marker to end-of-file: each predicate under test is the
// last export in its own gates/*.ts module, so there is no "next function"
// marker to bound the slice on the other end.
function sliceFrom(source, startMarker) {
  const startIdx = source.indexOf(startMarker);
  assert.ok(startIdx !== -1, `marker not found: ${JSON.stringify(startMarker)}`);
  return source.slice(startIdx);
}

function readSourceFile(relPath) {
  const root = path.resolve(import.meta.dirname, "..");
  return fs.readFileSync(path.join(root, relPath), "utf-8");
}

// ===========================================================================
// parseCoversIds — pure parser (C3-01)
// ===========================================================================

test("parseCoversIds: happy path — comma-separated list", () => {
  assert.deepEqual(parseCoversIds("covers: T-REG-01, T-REG-02, T-REG-03"), [
    "T-REG-01",
    "T-REG-02",
    "T-REG-03",
  ]);
});

test("parseCoversIds: whitespace-separated list (no commas)", () => {
  assert.deepEqual(parseCoversIds("covers: A B C"), ["A", "B", "C"]);
});

test("parseCoversIds: bullet label variants — leading '-' and '*'", () => {
  assert.deepEqual(parseCoversIds("- covers: A, B"), ["A", "B"]);
  assert.deepEqual(parseCoversIds("* covers: A, B"), ["A", "B"]);
});

test("parseCoversIds: bold label variants — **covers:** and - **covers**:", () => {
  assert.deepEqual(parseCoversIds("**covers:** A, B"), ["A", "B"]);
  assert.deepEqual(parseCoversIds("- **covers**: A, B"), ["A", "B"]);
});

test("parseCoversIds: separator variants — ':', '—' (em-dash), '-'", () => {
  assert.deepEqual(parseCoversIds("covers: A, B"), ["A", "B"]);
  assert.deepEqual(parseCoversIds("covers — A, B"), ["A", "B"]);
  assert.deepEqual(parseCoversIds("covers - A, B"), ["A", "B"]);
});

test("parseCoversIds: case-insensitivity — Covers / COVERS", () => {
  assert.deepEqual(parseCoversIds("Covers: A, B"), ["A", "B"]);
  assert.deepEqual(parseCoversIds("COVERS: A, B"), ["A", "B"]);
});

test("parseCoversIds: strips surrounding backticks/brackets/parens per token", () => {
  assert.deepEqual(parseCoversIds("covers: `A`, [B], (C)"), ["A", "B", "C"]);
});

test("parseCoversIds: malformed — bare label with no value → []", () => {
  assert.deepEqual(parseCoversIds("covers:"), []);
});

test("parseCoversIds: empty — no covers: line anywhere → []", () => {
  assert.deepEqual(parseCoversIds("# Review\n\nNothing to see here.\n"), []);
});

test("parseCoversIds: empty string content → []", () => {
  assert.deepEqual(parseCoversIds(""), []);
});

test("parseCoversIds: whitespace-only value → []", () => {
  assert.deepEqual(parseCoversIds("covers:   "), []);
});

test("parseCoversIds: commas-only value → []", () => {
  assert.deepEqual(parseCoversIds("covers: ,,,"), []);
});

test("parseCoversIds: prose false-positive guard — 'discovers:' does not match", () => {
  // 'discovers' contains 'covers' as a substring, but the line-start anchor
  // (optional whitespace/bullet/bold only) must reject a 'dis' prefix.
  assert.deepEqual(parseCoversIds("discovers: A, B"), []);
});

test("parseCoversIds: prose false-positive guard — mid-sentence 'covers:' does not match", () => {
  assert.deepEqual(parseCoversIds("This section covers: A, B"), []);
});

test("parseCoversIds: prose false-positive guard — mid-sentence 'discovers:' does not match", () => {
  assert.deepEqual(parseCoversIds("id discovers: A"), []);
});

// ===========================================================================
// buildCoverageIndex — fs composition helper (C3-02)
// ===========================================================================

test("buildCoverageIndex: multi-file — merges covers: ids across files", () => {
  const ws = tmpWs();
  writeQaReport(ws, "review_T-A.md", "# review\ncovers: T-A, T-B\n");
  writeQaReport(ws, "review_T-C.md", "# review\ncovers: T-C\n");
  const index = buildCoverageIndex(path.join(ws, "qa_reports"));
  assert.equal(index.get("T-A"), "review_T-A.md");
  assert.equal(index.get("T-B"), "review_T-A.md");
  assert.equal(index.get("T-C"), "review_T-C.md");
});

test("buildCoverageIndex: first-seen-wins determinism (sorted filename order)", () => {
  const ws = tmpWs();
  // Both files claim "T-DUP"; alphabetically "review_a.md" sorts before
  // "review_b.md", so "T-DUP" must resolve to the first file in sort order.
  writeQaReport(ws, "review_b.md", "covers: T-DUP\n");
  writeQaReport(ws, "review_a.md", "covers: T-DUP\n");
  const index = buildCoverageIndex(path.join(ws, "qa_reports"));
  assert.equal(index.get("T-DUP"), "review_a.md");
});

test("buildCoverageIndex: non-.md files are ignored", () => {
  const ws = tmpWs();
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "notes.txt"), "covers: T-X\n");
  const index = buildCoverageIndex(dir);
  assert.equal(index.has("T-X"), false);
});

test("buildCoverageIndex: unreadable/nonexistent dir → empty map, never throws", () => {
  const ws = tmpWs();
  let threw = false;
  let index;
  try {
    index = buildCoverageIndex(path.join(ws, "does-not-exist"));
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "must never throw on a missing directory");
  assert.equal(index.size, 0);
});

test("buildCoverageIndex: files with no covers: line contribute nothing", () => {
  const ws = tmpWs();
  writeQaReport(ws, "review_T-A.md", "# plain review, no covers line\n");
  const index = buildCoverageIndex(path.join(ws, "qa_reports"));
  assert.equal(index.size, 0);
});

// ===========================================================================
// hasEvidenceInFile — QA PASS gate (qa_reports/), C3-03
// ===========================================================================

test("AC-2: covering report satisfies N ids (QA path)", () => {
  const ws = tmpWs();
  writeQaReport(
    ws,
    "review_T-REG-01.md",
    "# QA review\ncovers: T-REG-01, T-REG-02, T-REG-03, T-REG-04, T-REG-05, T-REG-06, T-REG-07\n",
  );
  const ids = [
    "T-REG-01",
    "T-REG-02",
    "T-REG-03",
    "T-REG-04",
    "T-REG-05",
    "T-REG-06",
    "T-REG-07",
  ];
  const result = hasEvidenceInFile(ws, ids);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.present.sort(), [...ids].sort());
});

test("AC-3: partial coverage (QA path) reports exactly the correct missing subset", () => {
  const ws = tmpWs();
  writeQaReport(ws, "review_T-01.md", "covers: T-01, T-02, T-03\n");
  const result = hasEvidenceInFile(ws, ["T-01", "T-02", "T-03", "T-04", "T-05"]);
  assert.deepEqual(result.present.sort(), ["T-01", "T-02", "T-03"]);
  assert.deepEqual(result.missing.sort(), ["T-04", "T-05"]);
});

test("AC-4: backward compatible (QA path) — classic per-id files, no covers: line", () => {
  const ws = tmpWs();
  writeQaReport(ws, "review_T-01.md", "# plain per-id review\n");
  writeQaReport(ws, "review_T-02.md", "# plain per-id review\n");
  const result = hasEvidenceInFile(ws, ["T-01", "T-02", "T-03"]);
  assert.deepEqual(result.present.sort(), ["T-01", "T-02"]);
  assert.deepEqual(result.missing, ["T-03"]);
});

test("AC-5: non-matching covers: line does not falsely satisfy (QA path)", () => {
  const ws = tmpWs();
  // covers: line exists but does not name the requested id.
  writeQaReport(ws, "review_T-01.md", "covers: T-01, T-02\n");
  const result = hasEvidenceInFile(ws, ["T-99"]);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, ["T-99"]);
});

test("AC-5: empty covers: label does not falsely satisfy (QA path)", () => {
  const ws = tmpWs();
  writeQaReport(ws, "review_T-01.md", "covers:\n");
  const result = hasEvidenceInFile(ws, ["T-01", "T-02"]);
  // T-01's own per-id file exists so it's present via direct check; T-02 has
  // no direct file and the empty covers: line must not satisfy it.
  assert.deepEqual(result.present, ["T-01"]);
  assert.deepEqual(result.missing, ["T-02"]);
});

test("AC-6: functional — every id resolves via direct file (no covering file needed, none present)", () => {
  // Complements the code-path assertion below: no covers: file exists at all
  // in this workspace, yet every id is found. If the implementation ever
  // scanned unconditionally, this would still pass (buildCoverageIndex would
  // just return an empty map) — so this alone doesn't PROVE laziness, only
  // that laziness doesn't break the common case. The source-order assertion
  // below is what pins the actual AC-6 invariant.
  const ws = tmpWs();
  writeQaReport(ws, "review_T-01.md", "# per-id\n");
  writeQaReport(ws, "review_T-02.md", "# per-id\n");
  const result = hasEvidenceInFile(ws, ["T-01", "T-02"]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.present.sort(), ["T-01", "T-02"]);
});

test("AC-6 code-path (QA path): direct-file hit `continue`s before the coverage-index build line", () => {
  // Post-A10 gate-registry split: hasEvidenceInFile lives in gates/qa-review.ts
  // (relocated verbatim from tools/evidence-file.ts), and is the last export
  // in that file — slice to EOF rather than to a "next function" marker.
  const src = readSourceFile("gates/qa-review.ts");
  const body = sliceFrom(src, "export function hasEvidenceInFile");
  const existsIdx = body.indexOf("fs.existsSync(evidencePath(workspacePath, id))");
  const continueIdx = body.indexOf("continue;");
  const guardIdx = body.indexOf("if (coverage === null)");
  const buildIdx = body.indexOf("buildCoverageIndex(evidenceDir(workspacePath))");
  assert.ok(
    existsIdx !== -1 && continueIdx !== -1 && guardIdx !== -1 && buildIdx !== -1,
    "expected direct-file check, continue, coverage-null guard, and buildCoverageIndex call all present in hasEvidenceInFile",
  );
  assert.ok(existsIdx < continueIdx, "the direct per-id existence check must precede its `continue`");
  assert.ok(
    continueIdx < guardIdx,
    "the `continue` (skip-scan path for a direct hit) must precede the coverage-index guard in source order — " +
      "this is what makes a direct hit never reach the buildCoverageIndex call",
  );
  assert.ok(guardIdx < buildIdx, "the buildCoverageIndex call must sit inside the `coverage === null` guard (build at most once per call)");
});

// ===========================================================================
// hasCodeReviewEvidenceInFile — code-reviewer handoff gate (review_reports/), C3-04
// Mirrors the hasEvidenceInFile suite above exactly, over review_reports/.
// ===========================================================================

test("AC-1: covering report satisfies N ids (code-reviewer path)", () => {
  const ws = tmpWs();
  writeReviewReport(
    ws,
    "review_T-REG-01.md",
    "# Code review\ncovers: T-REG-01, T-REG-02, T-REG-03, T-REG-04, T-REG-05, T-REG-06, T-REG-07\n",
  );
  const ids = [
    "T-REG-01",
    "T-REG-02",
    "T-REG-03",
    "T-REG-04",
    "T-REG-05",
    "T-REG-06",
    "T-REG-07",
  ];
  const result = hasCodeReviewEvidenceInFile(ws, ids);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.present.sort(), [...ids].sort());
});

test("AC-3: partial coverage (code-reviewer path) reports exactly the correct missing subset", () => {
  const ws = tmpWs();
  writeReviewReport(ws, "review_T-01.md", "covers: T-01, T-02\n");
  const result = hasCodeReviewEvidenceInFile(ws, ["T-01", "T-02", "T-03"]);
  assert.deepEqual(result.present.sort(), ["T-01", "T-02"]);
  assert.deepEqual(result.missing, ["T-03"]);
});

test("AC-4: backward compatible (code-reviewer path) — classic per-id files unaffected", () => {
  const ws = tmpWs();
  writeReviewReport(ws, "review_T-01.md", "# plain per-id review\n");
  const result = hasCodeReviewEvidenceInFile(ws, ["T-01", "T-02"]);
  assert.deepEqual(result.present, ["T-01"]);
  assert.deepEqual(result.missing, ["T-02"]);
});

test("AC-5: non-matching covers: line does not falsely satisfy (code-reviewer path)", () => {
  const ws = tmpWs();
  writeReviewReport(ws, "review_T-01.md", "covers: T-01\n");
  const result = hasCodeReviewEvidenceInFile(ws, ["T-99"]);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, ["T-99"]);
});

test("AC-6: functional (code-reviewer path) — every id resolves via direct file", () => {
  const ws = tmpWs();
  writeReviewReport(ws, "review_T-01.md", "# per-id\n");
  const result = hasCodeReviewEvidenceInFile(ws, ["T-01"]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.present, ["T-01"]);
});

test("AC-6 code-path (code-reviewer path): direct-file hit `continue`s before the coverage-index build line", () => {
  // Post-A10 gate-registry split: hasCodeReviewEvidenceInFile lives in
  // gates/code-review.ts (relocated verbatim from tools/evidence-file.ts),
  // and is the last export in that file — slice to EOF.
  const src = readSourceFile("gates/code-review.ts");
  const body = sliceFrom(src, "export function hasCodeReviewEvidenceInFile");
  const existsIdx = body.indexOf("fs.existsSync(codeReviewPath(workspacePath, id))");
  const continueIdx = body.indexOf("continue;");
  const guardIdx = body.indexOf("if (coverage === null)");
  const buildIdx = body.indexOf("buildCoverageIndex(codeReviewDir(workspacePath))");
  assert.ok(
    existsIdx !== -1 && continueIdx !== -1 && guardIdx !== -1 && buildIdx !== -1,
    "expected direct-file check, continue, coverage-null guard, and buildCoverageIndex call all present in hasCodeReviewEvidenceInFile",
  );
  assert.ok(existsIdx < continueIdx, "the direct per-id existence check must precede its `continue`");
  assert.ok(
    continueIdx < guardIdx,
    "the `continue` (skip-scan path for a direct hit) must precede the coverage-index guard in source order",
  );
  assert.ok(guardIdx < buildIdx, "the buildCoverageIndex call must sit inside the `coverage === null` guard (build at most once per call)");
});

// ===========================================================================
// Cross-cutting: covers: line in qa_reports/ does not leak into review_reports/
// (the two gates scan independent directories) — regression guard for a
// plausible implementation slip (sharing one coverage index across both dirs).
// ===========================================================================

test("qa_reports/ covers: line does not satisfy review_reports/ gate (independent directories)", () => {
  const ws = tmpWs();
  writeQaReport(ws, "review_T-01.md", "covers: T-01, T-02\n");
  const result = hasCodeReviewEvidenceInFile(ws, ["T-02"]);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, ["T-02"]);
});

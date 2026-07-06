// Coded by @qa-engineer
// Tests for spec: error-code-contract-test (T-ECCT-02).
// Static contract: every SCREAMING_CASE gate error code named in
// content/*.md must exist as a real code-side token in index.ts /
// tools/*.ts / schema/*.ts / guards/*.ts, and vice versa. Interim guard
// (backlog A5) until A10 makes this generative. Zero behavior change —
// this file only reads source text via fs.readFileSync, never imports
// from dist/, so it stays valid against an unbuilt tree (AC-7).
//
// Spec-to-Test map lives in qa_reports/review_T-ECCT-01.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// ---------------------------------------------------------------------------
// Shape rule (spec: "Shape rule (used identically by both extraction sides)")
// ---------------------------------------------------------------------------

const TOKEN_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b/g;
const SUFFIX_RE = /_(REQUIRED|MISSING|INCOMPLETE|EXCEEDED|UNVERIFIED|REJECTED)$/;
const PREFIX_RE = /^MISSING_/;

function isGateErrorCode(token) {
  return SUFFIX_RE.test(token) || PREFIX_RE.test(token);
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function listFiles(dir, ext) {
  return fs
    .readdirSync(path.join(PROJECT_ROOT, dir))
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f));
}

// Code-side source set: index.ts, tools/*.ts, schema/*.ts, guards/*.ts.
const CODE_SOURCE_FILES = [
  "index.ts",
  ...listFiles("tools", ".ts"),
  ...listFiles("schema", ".ts"),
  ...listFiles("guards", ".ts"),
];

// Doc-side source set: every file in content/*.md.
const DOC_SOURCE_FILES = listFiles("content", ".md");

function extractCodeCodes() {
  const codes = new Map(); // code -> Set(file)
  for (const rel of CODE_SOURCE_FILES) {
    const text = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
    const matches = text.match(TOKEN_RE) || [];
    for (const token of matches) {
      if (!isGateErrorCode(token)) continue;
      if (!codes.has(token)) codes.set(token, new Set());
      codes.get(token).add(rel);
    }
  }
  return codes;
}

// Doc side: backtick-delimited spans `TOKEN` whose inner text matches the
// shape rule. Matched directly (backtick, shape-rule token, backtick) rather
// than capturing arbitrary `([^`]+)` content and filtering afterwards —
// content/*.md contains fenced code blocks whose embedded literal backticks
// throw off naive open/close backtick pairing across the whole file, which
// would corrupt spans for everything downstream in the same file. Anchoring
// the token pattern between the backticks sidesteps that: it only ever
// matches when a shape-rule token is flanked by exactly one backtick on
// each side, regardless of unrelated backtick parity elsewhere in the file.
const BACKTICK_TOKEN_RE = /`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)`/g;

function extractDocCodes() {
  const codes = new Map(); // code -> Set(file)
  for (const rel of DOC_SOURCE_FILES) {
    const text = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
    let m;
    while ((m = BACKTICK_TOKEN_RE.exec(text))) {
      const inner = m[1];
      if (!isGateErrorCode(inner)) continue;
      if (!codes.has(inner)) codes.set(inner, new Set());
      codes.get(inner).add(rel);
    }
  }
  return codes;
}

function fmt(codeMap, codes) {
  return codes
    .map((c) => `${c} (${[...codeMap.get(c)].join(", ")})`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// AC-1: code-side extraction, non-vacuous (sanity floor >= 18)
// ---------------------------------------------------------------------------

test("AC-1: CODE_CODES extraction is non-vacuous (>= 18 known gate codes)", () => {
  const codeCodes = extractCodeCodes();
  assert.ok(
    codeCodes.size >= 18,
    `expected >= 18 code-side gate error codes, got ${codeCodes.size}: ${[...codeCodes.keys()].sort().join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// AC-2: doc-side extraction, non-vacuous (sanity floor >= 1)
// ---------------------------------------------------------------------------

test("AC-2: DOC_CODES extraction is non-vacuous (>= 1 backtick-mentioned gate code)", () => {
  const docCodes = extractDocCodes();
  assert.ok(
    docCodes.size >= 1,
    `expected >= 1 doc-side gate error code, got ${docCodes.size}`,
  );
});

// ---------------------------------------------------------------------------
// AC-3 / AC-4: mutual subset (the actual contract)
// ---------------------------------------------------------------------------

test("AC-3: every doc-mentioned gate error code exists in code (DOC_CODES subset of CODE_CODES)", () => {
  const codeCodes = extractCodeCodes();
  const docCodes = extractDocCodes();

  const orphaned = [...docCodes.keys()].filter((c) => !codeCodes.has(c));

  assert.deepEqual(
    orphaned,
    [],
    `doc-only codes with no code-side emit site: ${fmt(docCodes, orphaned)}`,
  );
});

test("AC-4: every code-side gate error code is documented (CODE_CODES subset of DOC_CODES)", () => {
  const codeCodes = extractCodeCodes();
  const docCodes = extractDocCodes();

  const undocumented = [...codeCodes.keys()].filter((c) => !docCodes.has(c));

  assert.deepEqual(
    undocumented,
    [],
    `code-only codes with no content/*.md mention: ${fmt(codeCodes, undocumented)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-5: green on introduction — folded into AC-3/AC-4 above. Both must pass
// with zero hardcoded allowlist/exclude entries (there are none in this
// file — the two tests above compare the live-extracted sets directly).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC-6: shape-rule precision — known noise tokens must NOT classify as codes
// ---------------------------------------------------------------------------

test("AC-6: ALLOWED_TRANSITIONS is not classified as a gate error code (transition-matrix export name)", () => {
  assert.equal(isGateErrorCode("ALLOWED_TRANSITIONS"), false);
});

test("AC-6: REQUIRED_VISUAL_SECTIONS is not classified as a gate error code (constant name referenced in prose, not itself thrown)", () => {
  assert.equal(isGateErrorCode("REQUIRED_VISUAL_SECTIONS"), false);
});

test("AC-6: AGC_AUTO_ROUTE is not classified as a gate error code (routing-convention token never emitted in tools/*.ts or index.ts)", () => {
  assert.equal(isGateErrorCode("AGC_AUTO_ROUTE"), false);
});

test("AC-6: CHANGES_REQUESTED is not classified as a gate error code (code-reviewer verdict label, not a rejection code)", () => {
  assert.equal(isGateErrorCode("CHANGES_REQUESTED"), false);
});

// ---------------------------------------------------------------------------
// AC-7: no build dependency — this file itself only ever reads source .ts
// and content/*.md text via fs.readFileSync; it never imports from dist/.
// Enforced structurally (see imports above) and asserted here so a future
// edit that adds a dist/ import trips a visible failure.
// ---------------------------------------------------------------------------

test("AC-7: this test file does not import from dist/ (source-only, no build dependency)", () => {
  const selfText = fs.readFileSync(__filename, "utf-8");
  assert.equal(
    /from\s+["'].*\/dist\//.test(selfText),
    false,
    "error-code-contract.test.mjs must not import from dist/ — it must remain valid against an unbuilt tree",
  );
});

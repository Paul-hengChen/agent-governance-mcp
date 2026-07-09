// Coded by @qa-engineer
// Tests for spec: gate-registry (A10 + A2 folded in), AC-5.
// Generative registry↔code↔doc parity test — supersedes the interim
// regex-scan guard (backlog A5 / T-ECCT-02). Now imports the real
// GATE_REGISTRY/ALL_GATE_CODES from the built gates/registry.ts (the single
// structured source of truth, spec AC-1) and asserts parity BY CONSTRUCTION:
// the registry's code set must equal the code-side shape-rule harvest, the
// doc-side backtick-token harvest must be a subset of the registry, every
// `documentedInProse` entry must appear in >=1 content/*.md, and each entry's
// internal fields (hintStatic non-empty, errorCode literally present in its
// producer file) must be self-consistent. This is the qualitative upgrade
// over A5 the architecture calls for (specs/gate-registry-architecture.md
// "What the parity check guarantees").
//
// DR-8 (architecture): TransitionRejection["error"] in tools/transitions.ts
// is a deliberately-NOT-registry-sourced 12-member union (5 emitted by
// validateTransition + 7 handler-side envelope-consistency codes it must
// carry for narrowing). Non-drift is enforced here, not by re-typing: assert
// the union stays byte-identical at 12 members AND is a subset of
// ALL_GATE_CODES.
//
// AC-7 (relaxed per architecture Test Impact): this file now intentionally
// depends on a built tree (imports dist/gates/registry.js) — the old
// "never import from dist/" invariant no longer holds, by design, because
// AC-5 requires importing the real registry. `npm test`'s prebuild step
// already guarantees dist/ exists before this file runs.
//
// Spec-to-Test map lives in qa_reports/review_A10-10.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const { GATE_REGISTRY, ALL_GATE_CODES } = await import(
  path.join(PROJECT_ROOT, "dist", "gates", "registry.js")
);

// ---------------------------------------------------------------------------
// Shape rule (spec: "Shape rule (used identically by both extraction sides)")
// ---------------------------------------------------------------------------

const TOKEN_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b/g;
// b8-external-ref-ledger (qa-owned re-baseline): added UNRESOLVED. The new
// EXTERNAL_REFS_UNRESOLVED gate code introduces a novel suffix outside the
// prior vocabulary (spec S01 mandates the string verbatim; sr-engineer had no
// latitude to rename it) — code-reviewer flagged this as the QA-side fix,
// not a code rename. Without this, EXTERNAL_REFS_UNRESOLVED is invisible to
// BOTH extractCodeCodes and extractDocCodes (isGateErrorCode filters it out
// of both harvests identically), which would silently mask a missing-registry
// or missing-doc regression for this gate.
// c9-protocol-fields (DR-7, qa-owned re-baseline): added MISMATCH. The new
// REVIEW_VERDICT_STATUS_MISMATCH gate code introduces another novel suffix
// outside the prior vocabulary — exactly the b8 UNRESOLVED precedent. Without
// this, REVIEW_VERDICT_STATUS_MISMATCH is invisible to BOTH extraction sides
// identically, masking a missing-registry or missing-doc regression.
const SUFFIX_RE = /_(REQUIRED|MISSING|INCOMPLETE|EXCEEDED|UNVERIFIED|REJECTED|UNRESOLVED|MISMATCH)$/;
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

// Code-side source set: index.ts, tools/*.ts, schema/*.ts, guards/*.ts, and
// (architecture Test Impact: "the listFiles('tools','.ts') glob does NOT
// reach gates/, so add ...listFiles('gates','.ts')") gates/*.ts — the new
// registry + gate modules this feature introduced.
const CODE_SOURCE_FILES = [
  "index.ts",
  ...listFiles("tools", ".ts"),
  ...listFiles("schema", ".ts"),
  ...listFiles("guards", ".ts"),
  ...listFiles("gates", ".ts"),
];

// Doc-side source set: every file in content/*.md.
const DOC_SOURCE_FILES = listFiles("content", ".md");

function readSource(rel) {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
}

function extractCodeCodes() {
  const codes = new Map(); // code -> Set(file)
  for (const rel of CODE_SOURCE_FILES) {
    const text = readSource(rel);
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
    const text = readSource(rel);
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
// AC-1 / AC-5: GATE_REGISTRY is the single source of truth, exactly 20
// entries (c9-protocol-fields added the 20th, REVIEW_VERDICT_STATUS_MISMATCH;
// 19 in, 20 out — one gate added, none dropped). b8-external-ref-ledger had
// added the 19th, EXTERNAL_REFS_UNRESOLVED.
// ---------------------------------------------------------------------------

test("AC-1/AC-5: GATE_REGISTRY has exactly 20 entries (19 in, 20 out — c9-protocol-fields added REVIEW_VERDICT_STATUS_MISMATCH)", () => {
  assert.equal(
    GATE_REGISTRY.length,
    20,
    `expected exactly 20 GateDefinition entries, got ${GATE_REGISTRY.length}: ${GATE_REGISTRY.map((g) => g.errorCode).join(", ")}`,
  );
  assert.equal(
    ALL_GATE_CODES.length,
    20,
    "ALL_GATE_CODES must be GATE_REGISTRY.map(g => g.errorCode) — same length",
  );
  assert.deepEqual(
    [...ALL_GATE_CODES],
    GATE_REGISTRY.map((g) => g.errorCode),
    "ALL_GATE_CODES must preserve GATE_REGISTRY's catalog order",
  );
});

// ---------------------------------------------------------------------------
// AC-5 (generative core): the registry's code set is BY CONSTRUCTION equal
// to the code-side shape-rule harvest over the real source tree — not a
// hand-maintained allowlist. A gate added to code without a registry entry,
// or vice versa, fails this test.
// ---------------------------------------------------------------------------

test("AC-5: ALL_GATE_CODES === code-side shape-rule harvest (registry <-> code source parity)", () => {
  const codeCodes = extractCodeCodes();
  const registrySet = new Set(ALL_GATE_CODES);
  const codeSet = new Set(codeCodes.keys());

  const registryOnly = [...registrySet].filter((c) => !codeSet.has(c));
  const codeOnly = [...codeSet].filter((c) => !registrySet.has(c));

  assert.deepEqual(
    registryOnly,
    [],
    `registry entries with no code-side token match: ${registryOnly.join(", ")}`,
  );
  assert.deepEqual(
    codeOnly,
    [],
    `code-side gate-shaped tokens with no registry entry: ${fmt(codeCodes, codeOnly)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-3/AC-4 (doc <-> registry, replaces the old doc <-> code regex-scrape):
// doc-mentioned codes must all be real registry entries (no doc naming a
// phantom gate), and every documentedInProse registry entry must be
// backtick-quoted in >=1 content/*.md (no silently-undocumented gate).
// ---------------------------------------------------------------------------

test("doc ⊆ registry: every doc-mentioned gate error code exists in GATE_REGISTRY", () => {
  const docCodes = extractDocCodes();
  const registrySet = new Set(ALL_GATE_CODES);

  const orphaned = [...docCodes.keys()].filter((c) => !registrySet.has(c));

  assert.deepEqual(
    orphaned,
    [],
    `doc-only codes with no registry entry: ${fmt(docCodes, orphaned)}`,
  );
});

test("registry ⊆ doc: every documentedInProse:true entry is backtick-quoted in >=1 content/*.md", () => {
  const docCodes = extractDocCodes();

  const undocumented = GATE_REGISTRY.filter(
    (g) => g.documentedInProse && !docCodes.has(g.errorCode),
  ).map((g) => g.errorCode);

  assert.deepEqual(
    undocumented,
    [],
    `registry entries marked documentedInProse but not found backtick-quoted in content/*.md: ${undocumented.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Internal consistency: hintStatic is non-empty, and — for the emit-site
// producers this ticket actually touched — the entry's errorCode string
// literally appears in its producer's source file. Anchors the "code side"
// to the typed registry instead of a blind regex scrape (the qualitative
// upgrade over A5 the architecture calls out).
// ---------------------------------------------------------------------------

test("internal consistency: every GATE_REGISTRY entry has a non-empty hintStatic", () => {
  const empty = GATE_REGISTRY.filter((g) => !g.hintStatic || g.hintStatic.length === 0).map(
    (g) => g.errorCode,
  );
  assert.deepEqual(empty, [], `entries with empty hintStatic: ${empty.join(", ")}`);
});

test("internal consistency: validateTransition-producer entries' errorCode literally appears in tools/transitions.ts", () => {
  const transitionsSrc = readSource(path.join("tools", "transitions.ts"));
  const missing = GATE_REGISTRY.filter((g) => g.producer === "validateTransition")
    .filter((g) => !transitionsSrc.includes(g.errorCode))
    .map((g) => g.errorCode);
  assert.deepEqual(
    missing,
    [],
    `validateTransition-producer codes not found literally in tools/transitions.ts: ${missing.join(", ")}`,
  );
});

test("internal consistency: orchestrator-producer entries' errorCode literally appears in tools/handoff-orchestrator.ts", () => {
  const orchestratorSrc = readSource(path.join("tools", "handoff-orchestrator.ts"));
  const missing = GATE_REGISTRY.filter((g) => g.producer === "orchestrator")
    .filter((g) => !orchestratorSrc.includes(g.errorCode))
    .map((g) => g.errorCode);
  assert.deepEqual(
    missing,
    [],
    `orchestrator-producer codes not found literally in tools/handoff-orchestrator.ts: ${missing.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// DR-8 (architecture Interface Contracts / Decision Records): the
// TransitionRejection["error"] union in tools/transitions.ts is deliberately
// NOT re-sourced from the registry (it carries 5 emitted + 8 handler-side
// envelope-consistency codes, not a clean by-producer subset — narrowing it
// would silently delete 8 documented members). Guard against drift the cheap
// way instead: pin the union at exactly 13 members and assert it is a subset
// of ALL_GATE_CODES.
// b8-external-ref-ledger (B8-08, DR-9): EXTERNAL_REFS_UNRESOLVED joins the
// union as an 8th handler-side-only member (12 -> 13), for the same three
// reasons CUT_APPROVAL_REQUIRED/SCOPE_DECISION_REQUIRED carry theirs: envelope
// narrowing at the emit site, the union-subset-of-ALL_GATE_CODES invariant
// below, and catalog completeness. It is NOT added to TRANSITION_GATE_CODES
// (that set is the 5 validateTransition-emitted codes only).
// ---------------------------------------------------------------------------

test("DR-8: TransitionRejection[\"error\"] union stays byte-identical at 13 members, all ⊆ ALL_GATE_CODES", () => {
  const transitionsSrc = readSource(path.join("tools", "transitions.ts"));
  const unionMatch = transitionsSrc.match(
    /export interface TransitionRejection \{\s*error:\s*([\s\S]*?);\s*\n\s*attempted:/,
  );
  assert.ok(
    unionMatch,
    "could not locate the `error:` union inside `export interface TransitionRejection { ... attempted:` in tools/transitions.ts — DR-8 assertion is stale, update the anchor regex",
  );

  const members = [...unionMatch[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);

  assert.equal(
    members.length,
    13,
    `TransitionRejection["error"] must stay byte-identical at 13 members (DR-8, b8-external-ref-ledger re-baseline) — found ${members.length}: ${members.join(", ")}`,
  );
  assert.equal(
    new Set(members).size,
    13,
    "TransitionRejection[\"error\"] union members must be unique",
  );

  const registrySet = new Set(ALL_GATE_CODES);
  const notInRegistry = members.filter((m) => !registrySet.has(m));
  assert.deepEqual(
    notInRegistry,
    [],
    `TransitionRejection["error"] members not present in ALL_GATE_CODES: ${notInRegistry.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// AC-6: shape-rule precision — known noise tokens must NOT classify as codes.
// Unchanged from the interim A5 guard; still load-bearing (the shape rule is
// reused above for both the code-side and doc-side harvests).
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
// T-C9-11 / DR-7: explicit pin for the new gate, on top of the generic
// generative parity checks above — REVIEW_VERDICT_STATUS_MISMATCH must be a
// real registry entry AND backtick-quoted in at least one content/*.md file.
// ---------------------------------------------------------------------------

test("c9-protocol-fields: REVIEW_VERDICT_STATUS_MISMATCH is a GATE_REGISTRY entry, backtick-quoted in >=1 content/*.md", () => {
  assert.ok(
    ALL_GATE_CODES.includes("REVIEW_VERDICT_STATUS_MISMATCH"),
    "REVIEW_VERDICT_STATUS_MISMATCH must be registered in GATE_REGISTRY (AC-5)",
  );
  const docCodes = extractDocCodes();
  assert.ok(
    docCodes.has("REVIEW_VERDICT_STATUS_MISMATCH"),
    "REVIEW_VERDICT_STATUS_MISMATCH must be backtick-quoted in >=1 content/*.md (documentedInProse contract)",
  );
});

// ---------------------------------------------------------------------------
// AC-7 (relaxed, gate-registry era — architecture Test Impact, DR table):
// this test file now INTENTIONALLY depends on a built tree, because AC-5
// requires importing the real gates/registry.ts. The old "never import from
// dist/, stays valid against an unbuilt tree" invariant is superseded by the
// generative rewrite. This assertion pins the intentional dependency (so a
// future edit that reverts to source-text scanning under the same filename
// is a visible, deliberate choice rather than a silent regression) instead
// of forbidding it.
// ---------------------------------------------------------------------------

test("AC-7 (relaxed): this test file intentionally imports dist/gates/registry.js (requires a built tree; npm test's prebuild step guarantees it)", () => {
  const selfText = readSource(path.join("test", "error-code-contract.test.mjs"));
  assert.match(
    selfText,
    /from\s+["'].*dist\/gates\/registry\.js["']|import\(\s*path\.join\([\s\S]*?"dist",\s*"gates",\s*"registry\.js"/,
    "error-code-contract.test.mjs must import the built gates/registry.js — AC-5 requires the generative check to consume the real registry",
  );
});
